const db = require("../config/db");
const Payment = require("../models/Payment");
const Transaction = require("../models/Transaction");
const setuClient = require("../config/setu");
const { validateAmount } = require("../utils/paymentHelper");

class SetuService {
  // Create a payment link (Setu UPI DeepLinks: POST /payment-links)
  static async createPaymentSession({
    orderId,
    userId,
    amount,
    currency = "INR",
    userEmail,
    userContact,
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

      const client = await setuClient.getClient();

      const amountInPaise = Math.round(amount * 100);
      const billerBillID = `order_${orderId}_${Date.now()}`;

      const payload = {
        billerBillID,
        amount: {
          value: amountInPaise,
          currencyCode: currency.toUpperCase(),
        },
        amountExactness: "EXACT",
        transactionNote: `Payment for order ${orderId}`,
        additionalInfo: {
          orderId: orderId.toString(),
          userId: userId.toString(),
          ...notes,
        },
      };

      const response = await client.post("/payment-links", payload);
      const result = response.data.data;

      const paymentId = await Payment.create({
        order_id: orderId,
        user_id: userId,
        gateway: "setu",
        amount,
        currency,
        payment_method: "setu",
        gateway_order_id: result.platformBillID,
        status: "pending",
      });

      return {
        success: true,
        paymentId,
        platformBillID: result.platformBillID,
        paymentLink: result.paymentLink.shortURL,
        upiLink: result.paymentLink.upiLink,
        upiID: result.paymentLink.upiID,
        session: result,
      };
    } catch (error) {
      console.error(
        "Setu create payment link error:",
        error.response?.data || error.message,
      );
      return {
        success: false,
        error:
          error.response?.data?.error?.detail ||
          error.response?.data?.message ||
          error.message,
        details: error.response?.data,
      };
    }
  }

  static async verifyPayment(platformBillID) {
    try {
      const client = await setuClient.getClient();
      const response = await client.get(`/payment-links/${platformBillID}`);
      const session = response.data.data;

      if (
        session.status === "PAYMENT_SUCCESSFUL" ||
        session.status === "SETTLEMENT_SUCCESSFUL"
      ) {
        const paymentRecord =
          await Payment.findByGatewayOrderId(platformBillID);
        if (!paymentRecord) {
          return { success: false, error: "Payment record not found" };
        }

        if (paymentRecord.status !== "paid") {
          await Payment.update(paymentRecord.id, {
            status: "paid",
            gateway_payment_id: session.receipt?.id || platformBillID,
            gateway_response: session,
          });

          await Transaction.create({
            payment_id: paymentRecord.id,
            gateway: "setu",
            gateway_transaction_id: session.receipt?.id || platformBillID,
            type: "payment",
            amount: session.amountPaid.value / 100,
            status: "success",
            response_data: session,
          });

          await db.execute(
            `UPDATE orders SET status = 'confirmed', confirmed_at = NOW() WHERE id = ?`,
            [paymentRecord.order_id],
          );
        }

        return {
          success: true,
          message: "Payment verified and processed",
          paymentId: paymentRecord.id,
          orderId: paymentRecord.order_id,
          session,
        };
      } else {
        return {
          success: false,
          error: `Payment not completed. Status: ${session.status}`,
          status: session.status,
        };
      }
    } catch (error) {
      console.error(
        "Setu verify payment error:",
        error.response?.data || error.message,
      );
      return {
        success: false,
        error: error.response?.data?.error?.detail || error.message,
      };
    }
  }

  static async getPaymentStatus(orderId) {
    try {
      const payments = await Payment.findByOrderId(orderId);
      if (payments.length === 0) {
        return { success: false, error: "No payment found for this order" };
      }
      const payment = payments[0];

      const client = await setuClient.getClient();
      const response = await client.get(
        `/payment-links/${payment.gateway_order_id}`,
      );
      const session = response.data.data;

      if (
        (session.status === "PAYMENT_SUCCESSFUL" ||
          session.status === "SETTLEMENT_SUCCESSFUL") &&
        payment.status !== "paid"
      ) {
        await Payment.update(payment.id, {
          status: "paid",
          gateway_response: session,
        });
        const existingTx = await Transaction.findByPaymentId(payment.id);
        if (existingTx.length === 0) {
          await Transaction.create({
            payment_id: payment.id,
            gateway: "setu",
            gateway_transaction_id:
              session.receipt?.id || payment.gateway_order_id,
            type: "payment",
            amount: session.amountPaid.value / 100,
            status: "success",
            response_data: session,
          });
        }
      }

      return {
        success: true,
        payment,
        session,
        status: payment.status,
      };
    } catch (error) {
      console.error(
        "Get Setu status error:",
        error.response?.data || error.message,
      );
      return { success: false, error: error.message };
    }
  }

  static async refundPayment(orderId, amount, reason = "") {
    try {
      const payments = await Payment.findByOrderId(orderId);
      if (payments.length === 0) {
        return { success: false, error: "No payment found" };
      }
      const payment = payments[0];

      if (payment.status !== "paid") {
        return { success: false, error: "Payment not in paid status" };
      }

      const client = await setuClient.getClient();

      const payload = {
        refunds: [
          {
            identifier: payment.gateway_order_id,
            identifierType: "BILL_ID",
            refundType: "FULL",
          },
        ],
      };

      const response = await client.post("/refund/batch", payload);
      const refundData = response.data.data;

      await Transaction.create({
        payment_id: payment.id,
        gateway: "setu",
        gateway_transaction_id: refundData.batchID,
        type: "refund",
        amount,
        status: "success",
        response_data: refundData,
      });

      if (amount >= payment.amount) {
        await Payment.update(payment.id, {
          status: "refunded",
          gateway_response: { refund: refundData },
        });
      }

      return {
        success: true,
        batchID: refundData.batchID,
        amount,
      };
    } catch (error) {
      console.error(
        "Setu refund error:",
        error.response?.data || error.message,
      );
      return {
        success: false,
        error: error.response?.data?.error?.detail || error.message,
      };
    }
  }

  static async processWebhookEvent(eventData) {
    try {
      const events = eventData.events || [eventData];
      for (const event of events) {
        if (event.type === "BILL_FULFILMENT_STATUS") {
          await this.handleBillFulfilment(event.data);
        } else {
          console.warn("Unhandled event type:", event.type);
        }
      }
      return { success: true, message: "Event(s) processed" };
    } catch (error) {
      console.error("Setu webhook processing error:", error);
      return { success: false, error: error.message };
    }
  }

  static async handleBillFulfilment(data) {
    const { platformBillID, status, amountPaid, transactionId } = data;

    const paymentRecord = await Payment.findByGatewayOrderId(platformBillID);
    if (!paymentRecord) {
      console.error(
        `Payment record not found for platformBillID: ${platformBillID}`,
      );
      return { success: false, error: "Payment record not found" };
    }

    if (status === "PAYMENT_SUCCESSFUL") {
      if (paymentRecord.status === "paid") {
        return { success: true, message: "Payment already processed" };
      }

      await Payment.update(paymentRecord.id, {
        status: "paid",
        gateway_payment_id: transactionId,
        gateway_response: data,
      });

      await Transaction.create({
        payment_id: paymentRecord.id,
        gateway: "setu",
        gateway_transaction_id: transactionId,
        type: "payment",
        amount: amountPaid.value / 100,
        status: "success",
        response_data: data,
      });

      await db.execute(
        `UPDATE orders SET status = 'confirmed', confirmed_at = NOW() WHERE id = ?`,
        [paymentRecord.order_id],
      );
    } else if (status === "PAYMENT_FAILED") {
      await Payment.update(paymentRecord.id, {
        status: "failed",
        gateway_response: data,
      });

      await Transaction.create({
        payment_id: paymentRecord.id,
        gateway: "setu",
        gateway_transaction_id: transactionId,
        type: "payment",
        amount: amountPaid.value / 100,
        status: "failed",
        response_data: data,
        error_message: "Payment failed",
      });
    }

    return { success: true, message: "Webhook processed" };
  }
}

module.exports = SetuService;
