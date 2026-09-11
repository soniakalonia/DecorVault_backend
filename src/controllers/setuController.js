const db = require("../config/db");
const SetuService = require("../services/setuService");
const { validateAmount } = require("../utils/paymentHelper");

// Initiate Setu payment
exports.initiatePayment = async (req, res) => {
  try {
    const { orderId, amount, currency = "INR" } = req.body;
    const userId = req.user.id;

    // Validate amount
    const amountValidation = validateAmount(amount);
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

    const result = await SetuService.createPaymentSession({
      orderId,
      userId,
      amount,
      currency,
      userEmail: user.email,
      userContact: user.mobile,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      data: result,
      message: "Setu payment session created",
    });
  } catch (error) {
    console.error("Setu initiate error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Setu payment (usually called after user returns from Setu)
exports.verifyPayment = async (req, res) => {
  try {
    const { platformBillID } = req.body;
    if (!platformBillID) {
      return res
        .status(400)
        .json({ success: false, message: "platformBillID required" });
    }
    const result = await SetuService.verifyPayment(platformBillID);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      data: result,
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.error("Setu verify error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get payment status by order ID
exports.getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await SetuService.getPaymentStatus(orderId);
    if (!result.success) {
      return res.status(404).json({ success: false, message: result.error });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Setu status error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Refund payment (admin only)
exports.refundPayment = async (req, res) => {
  try {
    const { orderId, amount, reason } = req.body;

    if (!orderId || !amount) {
      return res
        .status(400)
        .json({ success: false, message: "Order ID and amount required" });
    }

    const result = await SetuService.refundPayment(orderId, amount, reason);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      data: result,
      message: "Refund processed",
    });
  } catch (error) {
    console.error("Setu refund error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Webhook handler (called by Setu)
exports.handleWebhook = async (req, res) => {
  try {
    // The webhook middleware should have validated and attached the event
    const result = req.webhookResult;

    if (!result || !result.success) {
      return res
        .status(400)
        .json({
          success: false,
          message: result?.error || "Webhook processing failed",
        });
    }

    res.json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Setu webhook handler error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
