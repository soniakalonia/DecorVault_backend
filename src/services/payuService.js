const db = require("../config/db");
const Payment = require("../models/Payment");
const Transaction = require("../models/Transaction");
const PayUTransaction = require("../models/PayUTransaction");
const payuClient = require("../config/payu");
const { generateHash, verifyReverseHash } = require("../utils/payuHash");
const { validateAmount } = require("../utils/paymentHelper");

class PayUService {
  // ─── Create a PayU payment session (returns hash + form fields) ───
  static async createPaymentSession({
    orderId,
    userId,
    amount,
    currency = "INR",
    userEmail,
    userContact,
    firstName,
    productInfo = "Decor Vault Order",
    notes = {},
  }) {
    try {
      const validation = validateAmount(amount);
      if (!validation.valid) {
        return { success: false, error: validation.message };
      }

      const [orders] = await db.execute("SELECT * FROM orders WHERE id = ?", [
        orderId,
      ]);
      if (orders.length === 0) {
        return { success: false, error: "Order not found" };
      }

      const existingPayments = await Payment.findByOrderId(orderId);
      if (
        existingPayments.length > 0 &&
        existingPayments[0].status === "paid"
      ) {
        return { success: false, error: "Order already paid" };
      }

      const config = payuClient.getConfig();
      const txnid = `DV_${orderId}_${Date.now()}`;
      const amountStr = Number(amount).toFixed(2);

      // udf1 = orderId, udf2 = userId
      const udf1 = orderId.toString();
      const udf2 = userId.toString();
      const udf3 = "";
      const udf4 = "";
      const udf5 = "";

      const hash = generateHash({
        key: config.merchantKey,
        txnid,
        amount: amountStr,
        productinfo: productInfo,
        firstname: firstName || "Customer",
        email: userEmail,
        udf1,
        udf2,
        udf3,
        udf4,
        udf5,
        salt: config.salt,
      });

      // Save payment record (reuses your Payment model)
      const paymentId = await Payment.create({
        order_id: orderId,
        user_id: userId,
        gateway: "payu",
        amount,
        currency,
        payment_method: "payu",
        gateway_order_id: txnid,
        status: "pending",
      });

      // Save PayU-specific transaction record
      await PayUTransaction.create({
        payment_id: paymentId,
        order_id: orderId,
        user_id: userId,
        txnid,
        amount,
        currency,
        status: "pending",
        hash,
        raw_response: notes,
      });

      return {
        success: true,
        paymentId,
        txnid,
        payuForm: {
          action: config.baseURL,
          method: "POST",
          fields: {
            key: config.merchantKey,
            txnid,
            amount: amountStr,
            productinfo: productInfo,
            firstname: firstName || "Customer",
            email: userEmail,
            phone: userContact,
            surl: config.successURL,
            furl: config.failureURL,
            hash,
            udf1,
            udf2,
            udf3,
            udf4,
            udf5,
            service_provider: "payu_paisa",
          },
        },
      };
    } catch (error) {
      console.error("PayU create session error:", error);
      return { success: false, error: error.message };
    }
  }

  // ─── Verify payment after success redirect / webhook ───
  static async verifyPayment(payload) {
    try {
      const config = payuClient.getConfig();
      const {
        txnid,
        mihpayid,
        status,
        amount,
        mode,
        bank_ref_num,
        bankcode,
        error_Message,
        hash,
        additionalCharges,
      } = payload;

      if (!txnid) {
        return { success: false, error: "txnid missing" };
      }

      // Verify hash
      const isValid = verifyReverseHash(
        {
          status,
          udf5: payload.udf5 || "",
          udf4: payload.udf4 || "",
          udf3: payload.udf3 || "",
          udf2: payload.udf2 || "",
          udf1: payload.udf1 || "",
          email: payload.email,
          firstname: payload.firstname,
          productinfo: payload.productinfo,
          amount,
          txnid,
          key: payload.key,
          additionalCharges,
          hash,
        },
        config.salt,
      );

      if (!isValid) {
        // Log the failed verification
        await PayUTransaction.updateByTxnId(txnid, {
          status: "hash_mismatch",
          raw_response: payload,
        });
        return { success: false, error: "Hash mismatch" };
      }

      // Find the payment record
      const paymentRecord = await Payment.findByGatewayOrderId(txnid);
      if (!paymentRecord) {
        return { success: false, error: "Payment record not found" };
      }

      const normalizedStatus = String(status).toLowerCase();

      if (normalizedStatus === "success") {
        if (paymentRecord.status !== "paid") {
          await Payment.update(paymentRecord.id, {
            status: "paid",
            gateway_payment_id: mihpayid,
            gateway_signature: hash,
            gateway_response: payload,
          });

          await Transaction.create({
            payment_id: paymentRecord.id,
            gateway: "payu",
            gateway_transaction_id: mihpayid,
            type: "payment",
            amount: parseFloat(amount),
            status: "success",
            response_data: payload,
          });

          await db.execute(
            `UPDATE orders SET status = 'confirmed', confirmed_at = NOW() WHERE id = ?`,
            [paymentRecord.order_id],
          );
        }

        await PayUTransaction.updateByTxnId(txnid, {
          status: "success",
          mihpayid,
          mode,
          bank_ref_num,
          bankcode,
          raw_response: payload,
        });

        return {
          success: true,
          message: "Payment verified successfully",
          paymentId: paymentRecord.id,
          orderId: paymentRecord.order_id,
          mihpayid,
          status,
        };
      } else {
        // failure / pending / other
        await Payment.update(paymentRecord.id, {
          status: "failed",
          gateway_response: payload,
        });

        await Transaction.create({
          payment_id: paymentRecord.id,
          gateway: "payu",
          gateway_transaction_id: mihpayid || txnid,
          type: "payment",
          amount: parseFloat(amount || paymentRecord.amount),
          status: "failed",
          response_data: payload,
          error_message: error_Message || `PayU status: ${status}`,
        });

        await PayUTransaction.updateByTxnId(txnid, {
          status: "failed",
          mihpayid,
          mode,
          bank_ref_num,
          bankcode,
          error_message: error_Message,
          raw_response: payload,
        });

        return {
          success: false,
          error: error_Message || `PayU payment ${status}`,
          status,
        };
      }
    } catch (error) {
      console.error("PayU verify error:", error);
      return { success: false, error: error.message };
    }
  }

  // ─── Get payment status ───
  static async getPaymentStatus(orderId) {
    try {
      const payments = await Payment.findByOrderId(orderId);
      if (payments.length === 0) {
        return { success: false, error: "No payment found for this order" };
      }
      const payment = payments[0];
      const payuTx = await PayUTransaction.findByPaymentId(payment.id);

      return {
        success: true,
        payment,
        payuTransactions: payuTx,
        status: payment.status,
      };
    } catch (error) {
      console.error("PayU status error:", error);
      return { success: false, error: error.message };
    }
  }

  // ─── DEV ONLY: Simulate PayU payment (bypasses hosted page) ───
  static async simulatePayment({ txnid, orderId, status = "success" }) {
    try {
      if (process.env.PAYU_MODE !== "TEST") {
        return {
          success: false,
          error: "Simulate only available in TEST mode",
        };
      }

      // Find payment record — by txnid OR orderId (whichever provided)
      let paymentRecord = null;
      if (txnid) {
        paymentRecord = await Payment.findByGatewayOrderId(txnid);
      } else if (orderId) {
        const payments = await Payment.findByOrderId(orderId);
        paymentRecord = payments[0] || null;
      }

      if (!paymentRecord) {
        return { success: false, error: "Payment record not found" };
      }

      const isSuccess = String(status).toLowerCase() === "success";
      const mihpayid = `SIM_${Date.now()}`;
      const simPayload = {
        txnid: paymentRecord.gateway_order_id,
        mihpayid,
        status: isSuccess ? "success" : "failure",
        amount: paymentRecord.amount,
        mode: "SIMULATED",
        bank_ref_num: "SIM_" + Date.now(),
        bankcode: "SIM",
        error_Message: isSuccess ? null : "Simulated failure",
        simulated: true,
        simulated_at: new Date().toISOString(),
      };

      if (isSuccess) {
        if (paymentRecord.status !== "paid") {
          await Payment.update(paymentRecord.id, {
            status: "paid",
            gateway_payment_id: mihpayid,
            gateway_response: simPayload,
          });

          await Transaction.create({
            payment_id: paymentRecord.id,
            gateway: "payu",
            gateway_transaction_id: mihpayid,
            type: "payment",
            amount: parseFloat(paymentRecord.amount),
            status: "success",
            response_data: simPayload,
          });

          await db.execute(
            `UPDATE orders SET status = 'confirmed', confirmed_at = NOW() WHERE id = ?`,
            [paymentRecord.order_id],
          );
        }

        await PayUTransaction.updateByTxnId(
          paymentRecord.gateway_order_id,
          {
            status: "success",
            mihpayid,
            mode: "SIMULATED",
            raw_response: simPayload,
          },
        );

        return {
          success: true,
          message: "Simulated payment success",
          paymentId: paymentRecord.id,
          orderId: paymentRecord.order_id,
          txnid: paymentRecord.gateway_order_id,
          mihpayid,
          status: "success",
        };
      } else {
        await Payment.update(paymentRecord.id, {
          status: "failed",
          gateway_response: simPayload,
        });

        await Transaction.create({
          payment_id: paymentRecord.id,
          gateway: "payu",
          gateway_transaction_id: mihpayid,
          type: "payment",
          amount: parseFloat(paymentRecord.amount),
          status: "failed",
          response_data: simPayload,
          error_message: "Simulated failure",
        });

        await PayUTransaction.updateByTxnId(
          paymentRecord.gateway_order_id,
          {
            status: "failed",
            mihpayid,
            mode: "SIMULATED",
            error_message: "Simulated failure",
            raw_response: simPayload,
          },
        );

        return {
          success: false,
          error: "Simulated payment failure",
          orderId: paymentRecord.order_id,
          txnid: paymentRecord.gateway_order_id,
          mihpayid,
          status: "failure",
        };
      }
    } catch (error) {
      console.error("PayU simulate error:", error);
      return { success: false, error: error.message };
    }
  }

  // ─── Process webhook (same as success payload, but idempotent) ───
  static async processWebhook(payload) {
    return this.verifyPayment(payload);
  }
}

module.exports = PayUService;