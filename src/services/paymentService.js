const db = require("../config/db");
const Payment = require("../models/Payment");
const Transaction = require("../models/Transaction");
const RazorpayService = require("./razorpayService");
const { generateOrderNumber } = require("../utils/paymentHelper");

class PaymentService {
  // Initialize payment
  static async initializePayment(paymentData) {
    try {
      const {
        orderId,
        userId,
        amount,
        paymentMethod = "razorpay",
        currency = "INR",
        userEmail,
        userContact,
        notes = {},
      } = paymentData;

      // Check if order exists
      const [orders] = await db.execute("SELECT * FROM orders WHERE id = ?", [
        orderId,
      ]);
      if (orders.length === 0) {
        return { success: false, error: "Order not found" };
      }

      const order = orders[0];

      // Check if payment already exists
      const existingPayments = await Payment.findByOrderId(orderId);
      if (existingPayments.length > 0) {
        const existingPayment = existingPayments[0];
        if (existingPayment.status === "paid") {
          return { success: false, error: "Order already paid" };
        }
      }

      // Generate receipt
      const receipt = `order_${orderId}_${Date.now()}`;

      // Create Razorpay order
      const razorpayOrder = await RazorpayService.createOrder({
        amount,
        currency,
        receipt,
        notes: {
          orderId: orderId.toString(),
          userId: userId.toString(),
          ...notes,
        },
      });

      if (!razorpayOrder.success) {
        return { success: false, error: razorpayOrder.error };
      }

      // Save payment record
      const paymentId = await Payment.create({
        order_id: orderId,
        user_id: userId,
        gateway: "razorpay",
        amount,
        currency,
        payment_method: paymentMethod,
        gateway_order_id: razorpayOrder.orderId,
        status: "pending",
      });

      return {
        success: true,
        paymentId,
        razorpayOrder: {
          id: razorpayOrder.orderId,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          receipt: razorpayOrder.receipt,
          status: razorpayOrder.status,
        },
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: orderId,
      };
    } catch (error) {
      console.error("Payment initialization error:", error);
      return { success: false, error: error.message };
    }
  }

  // Verify payment
  static async verifyPayment(verificationData) {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        orderId,
      } = verificationData;

      // Verify signature
      const verification = RazorpayService.verifyPaymentSignature({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });

      if (!verification.success) {
        return { success: false, error: verification.error };
      }

      if (!verification.isValid) {
        return { success: false, error: "Invalid payment signature" };
      }

      // Find payment record
      const payment = await Payment.findByGatewayOrderId(razorpay_order_id);
      if (!payment) {
        return { success: false, error: "Payment record not found" };
      }

      // Fetch payment details from Razorpay
      const paymentDetails =
        await RazorpayService.fetchPayment(razorpay_payment_id);
      if (!paymentDetails.success) {
        return { success: false, error: paymentDetails.error };
      }

      // Update payment status
      await Payment.update(payment.id, {
        status: "paid",
        gateway_payment_id: razorpay_payment_id,
        gateway_signature: razorpay_signature,
        gateway_response: paymentDetails,
      });

      // Create transaction record
      await Transaction.create({
        payment_id: payment.id,
        gateway: "razorpay",
        gateway_transaction_id: razorpay_payment_id,
        type: "payment",
        amount: paymentDetails.amount,
        status: "success",
        response_data: paymentDetails,
      });

      // Update order status
      await db.execute(
        `UPDATE orders SET status = 'confirmed', confirmed_at = NOW() WHERE id = ?`,
        [payment.order_id],
      );

      return {
        success: true,
        message: "Payment verified successfully",
        paymentId: payment.id,
        orderId: payment.order_id,
        paymentDetails,
      };
    } catch (error) {
      console.error("Payment verification error:", error);
      return { success: false, error: error.message };
    }
  }

  // Get payment status
  static async getPaymentStatus(orderId) {
    try {
      const payments = await Payment.findByOrderId(orderId);
      if (payments.length === 0) {
        return { success: false, error: "No payment found for this order" };
      }

      const latestPayment = payments[0];

      // Get transactions
      const transactions = await Transaction.findByPaymentId(latestPayment.id);

      return {
        success: true,
        payment: latestPayment,
        transactions,
        status: latestPayment.status,
      };
    } catch (error) {
      console.error("Get payment status error:", error);
      return { success: false, error: error.message };
    }
  }

  // Refund payment
  static async refundPayment(orderId, amount, reason = "") {
    try {
      const payments = await Payment.findByOrderId(orderId);
      if (payments.length === 0) {
        return { success: false, error: "No payment found for this order" };
      }

      const payment = payments[0];

      if (payment.status !== "paid") {
        return { success: false, error: "Payment is not in paid status" };
      }

      if (!payment.gateway_payment_id) {
        return { success: false, error: "No gateway payment ID found" };
      }

      // Process refund
      const refund = await RazorpayService.refundPayment(
        payment.gateway_payment_id,
        amount,
        { orderId, reason },
      );

      if (!refund.success) {
        return { success: false, error: refund.error };
      }

      // Create transaction record for refund
      await Transaction.create({
        payment_id: payment.id,
        gateway: "razorpay",
        gateway_transaction_id: refund.refundId,
        type: "refund",
        amount: refund.amount,
        status: "success",
        response_data: refund,
      });

      // Update payment status if full refund
      if (amount >= payment.amount) {
        await Payment.update(payment.id, {
          status: "refunded",
          gateway_response: { refund },
        });
      }

      return {
        success: true,
        refundId: refund.refundId,
        amount: refund.amount,
        status: refund.status,
      };
    } catch (error) {
      console.error("Refund payment error:", error);
      return { success: false, error: error.message };
    }
  }

  // Get user payment history
  static async getUserPaymentHistory(userId) {
    try {
      const payments = await Payment.findByUserId(userId);
      return { success: true, payments };
    } catch (error) {
      console.error("Get user payment history error:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = PaymentService;
