const db = require("../config/db");
const PaymentService = require("../services/paymentService");
const WebhookService = require("../services/webhookService");
const { validateAmount } = require("../utils/paymentHelper");

// Initiate payment
exports.initiatePayment = async (req, res) => {
  try {
    const {
      orderId,
      amount,
      currency = "INR",
      paymentMethod = "razorpay",
    } = req.body;
    const userId = req.user.id;

    // ─── 1. Load order and use SERVER total (never trust client) ───
    const [orders] = await db.execute(
      "SELECT id, user_id, total, payment_status FROM orders WHERE id = ?",
      [orderId],
    );
    if (orders.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const order = orders[0];

    if (order.user_id !== userId) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized for this order" });
    }

    if (order.payment_status === "paid") {
      return res
        .status(400)
        .json({ success: false, message: "Order already paid" });
    }

    // Use the order's stored total — server-computed at createOrder time
    const serverAmount = Number(order.total);

    // Client may send a mismatched amount; warn but use server value
    if (Number(amount) !== serverAmount) {
      console.warn(
        `[payment] Amount mismatch order=${orderId} client=${amount} server=${serverAmount} — using server value`,
      );
    }

    const amountValidation = validateAmount(serverAmount);
    if (!amountValidation.valid) {
      return res
        .status(400)
        .json({ success: false, message: amountValidation.message });
    }

    // Get user details
    const [users] = await db.execute(
      "SELECT email, mobile FROM users WHERE id = ?",
      [userId],
    );
    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const user = users[0];

    // Initialize payment with SERVER amount
    const result = await PaymentService.initializePayment({
      orderId,
      userId,
      amount: serverAmount,
      paymentMethod,
      currency,
      userEmail: user.email,
      userContact: user.mobile,
      notes: {
        userId: userId.toString(),
        orderId: orderId.toString(),
      },
    });

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      data: result,
      message: "Payment initiated successfully",
    });
  } catch (error) {
    console.error("Initiate payment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify payment
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment verification data",
      });
    }

    const result = await PaymentService.verifyPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      data: result,
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get payment status
exports.getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await PaymentService.getPaymentStatus(orderId);

    if (!result.success) {
      return res.status(404).json({ success: false, message: result.error });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Get payment status error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user payment history
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await PaymentService.getUserPaymentHistory(userId);

    if (!result.success) {
      return res.status(404).json({ success: false, message: result.error });
    }

    res.json({ success: true, payments: result.payments });
  } catch (error) {
    console.error("Get payment history error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Refund payment (admin only)
exports.refundPayment = async (req, res) => {
  try {
    const { orderId, amount, reason } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Order ID and amount are required",
      });
    }

    const result = await PaymentService.refundPayment(orderId, amount, reason);

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      data: result,
      message: "Refund processed successfully",
    });
  } catch (error) {
    console.error("Refund payment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Handle webhook
exports.handleWebhook = async (req, res) => {
  try {
    const result = req.webhookResult;

    if (!result || !result.success) {
      return res.status(400).json({
        success: false,
        message: result?.error || "Webhook processing failed",
      });
    }

    res.json({ success: true, message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Webhook handler error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get webhook logs (admin only)
exports.getWebhookLogs = async (req, res) => {
  try {
    const { gateway, limit = 100 } = req.query;

    const result = await WebhookService.getWebhookLogs(
      gateway,
      parseInt(limit),
    );

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({ success: true, logs: result.logs });
  } catch (error) {
    console.error("Get webhook logs error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get webhook stats (admin only)
exports.getWebhookStats = async (req, res) => {
  try {
    const result = await WebhookService.getWebhookStats();

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({ success: true, stats: result.stats });
  } catch (error) {
    console.error("Get webhook stats error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};