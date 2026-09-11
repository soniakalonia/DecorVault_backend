const razorpay = require("../config/razorpay");
const crypto = require("crypto");
const Payment = require("../models/Payment");
const Transaction = require("../models/Transaction");

class RazorpayService {
  // Create a Razorpay order
  static async createOrder(orderData) {
    try {
      const { amount, currency = "INR", receipt, notes = {} } = orderData;

      const options = {
        amount: amount * 100, // Convert to paise
        currency,
        receipt,
        notes,
      };

      const order = await razorpay.orders.create(options);

      return {
        success: true,
        orderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
      };
    } catch (error) {
      console.error("Razorpay create order error:", error);
      return {
        success: false,
        error: error.message,
        details: error,
      };
    }
  }

  // Verify payment signature
  static verifyPaymentSignature(paymentData) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
        paymentData;

      const body = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");

      const isValid = expectedSignature === razorpay_signature;

      return {
        success: true,
        isValid,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      };
    } catch (error) {
      console.error("Signature verification error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Capture payment
  static async capturePayment(paymentId, amount) {
    try {
      const payment = await razorpay.payments.capture(
        paymentId,
        amount * 100,
        "INR",
      );

      return {
        success: true,
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount / 100,
        currency: payment.currency,
        method: payment.method,
        bank: payment.bank,
        wallet: payment.wallet,
        vpa: payment.vpa,
      };
    } catch (error) {
      console.error("Capture payment error:", error);
      return {
        success: false,
        error: error.message,
        details: error,
      };
    }
  }

  // Refund payment
  static async refundPayment(paymentId, amount, notes = {}) {
    try {
      const refund = await razorpay.payments.refund(paymentId, {
        amount: amount * 100,
        notes,
      });

      return {
        success: true,
        refundId: refund.id,
        paymentId: refund.payment_id,
        amount: refund.amount / 100,
        status: refund.status,
        notes: refund.notes,
      };
    } catch (error) {
      console.error("Refund payment error:", error);
      return {
        success: false,
        error: error.message,
        details: error,
      };
    }
  }

  // Fetch payment details
  static async fetchPayment(paymentId) {
    try {
      const payment = await razorpay.payments.fetch(paymentId);

      return {
        success: true,
        id: payment.id,
        orderId: payment.order_id,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        bank: payment.bank,
        wallet: payment.wallet,
        vpa: payment.vpa,
        email: payment.email,
        contact: payment.contact,
        description: payment.description,
      };
    } catch (error) {
      console.error("Fetch payment error:", error);
      return {
        success: false,
        error: error.message,
        details: error,
      };
    }
  }

  // Fetch order details
  static async fetchOrder(orderId) {
    try {
      const order = await razorpay.orders.fetch(orderId);

      return {
        success: true,
        id: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        status: order.status,
        receipt: order.receipt,
        notes: order.notes,
        attempts: order.attempts,
      };
    } catch (error) {
      console.error("Fetch order error:", error);
      return {
        success: false,
        error: error.message,
        details: error,
      };
    }
  }

  // Process webhook event
  static async processWebhookEvent(event, payload) {
    try {
      const { event: eventType, payload: eventPayload } = payload;

      switch (eventType) {
        case "payment.captured":
          return await this.handlePaymentCaptured(eventPayload);
        case "payment.failed":
          return await this.handlePaymentFailed(eventPayload);
        case "order.paid":
          return await this.handleOrderPaid(eventPayload);
        case "refund.created":
          return await this.handleRefundCreated(eventPayload);
        case "refund.processed":
          return await this.handleRefundProcessed(eventPayload);
        default:
          return { success: true, message: "Event processed" };
      }
    } catch (error) {
      console.error("Webhook processing error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Handle payment captured event
  static async handlePaymentCaptured(payload) {
    const { payment } = payload;

    // Find payment by gateway order ID
    const paymentRecord = await Payment.findByGatewayOrderId(payment.order_id);
    if (!paymentRecord) {
      console.error(`Payment not found for order: ${payment.order_id}`);
      return { success: false, error: "Payment record not found" };
    }

    // Create transaction record
    await Transaction.create({
      payment_id: paymentRecord.id,
      gateway: "razorpay",
      gateway_transaction_id: payment.id,
      type: "payment",
      amount: payment.amount / 100,
      status: "success",
      response_data: payment,
    });

    // Update payment status
    await Payment.update(paymentRecord.id, {
      status: "paid",
      gateway_payment_id: payment.id,
      gateway_response: payment,
    });

    // Update order status
    const db = require("../config/db");
    await db.execute(
      `UPDATE orders SET status = 'confirmed', confirmed_at = NOW() WHERE id = ?`,
      [paymentRecord.order_id],
    );
    return { success: true, message: "Payment captured and processed" };
  }

  // Handle payment failed event
  static async handlePaymentFailed(payload) {
    const { payment } = payload;

    const paymentRecord = await Payment.findByGatewayOrderId(payment.order_id);
    if (!paymentRecord) {
      console.error(`Payment not found for order: ${payment.order_id}`);
      return { success: false, error: "Payment record not found" };
    }

    // Create transaction record
    await Transaction.create({
      payment_id: paymentRecord.id,
      gateway: "razorpay",
      gateway_transaction_id: payment.id,
      type: "payment",
      amount: payment.amount / 100,
      status: "failed",
      response_data: payment,
      error_message: payment.error_description || "Payment failed",
    });

    // Update payment status
    await Payment.update(paymentRecord.id, {
      status: "failed",
      gateway_payment_id: payment.id,
      gateway_response: payment,
    });

    return { success: true, message: "Payment failure recorded" };
  }

  // Handle order paid event
  static async handleOrderPaid(payload) {
    const { order, payment } = payload;
    return { success: true, message: "Order paid event processed" };
  }

  // Handle refund created event
  static async handleRefundCreated(payload) {
    const { refund } = payload;
    return { success: true, message: "Refund created event processed" };
  }

  // Handle refund processed event
  static async handleRefundProcessed(payload) {
    const { refund } = payload;
    return { success: true, message: "Refund processed event processed" };
  }
}

module.exports = RazorpayService;
