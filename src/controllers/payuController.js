const db = require("../config/db");
const PayUService = require("../services/payuService");
const { validateAmount } = require("../utils/paymentHelper");

// Initiate PayU payment
exports.initiatePayment = async (req, res) => {
  try {
    const { orderId, amount, currency = "INR", productInfo } = req.body;
    const userId = req.user.id;

    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return res
        .status(400)
        .json({ success: false, message: amountValidation.message });
    }

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

    const result = await PayUService.createPaymentSession({
      orderId,
      userId,
      amount,
      currency,
      userEmail: user.email,
      userContact: user.mobile,
      firstName: "Customer",  
      productInfo: productInfo || `Order #${orderId}`,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      data: result,
      message: "PayU payment session created",
    });
  } catch (error) {
    console.error("PayU initiate error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify PayU payment
exports.verifyPayment = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.txnid) {
      return res
        .status(400)
        .json({ success: false, message: "txnid required" });
    }

    const result = await PayUService.verifyPayment(payload);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      data: result,
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.error("PayU verify error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get payment status by order ID
exports.getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await PayUService.getPaymentStatus(orderId);
    if (!result.success) {
      return res.status(404).json({ success: false, message: result.error });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("PayU status error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// PayU redirects here (POST) on success — we verify then redirect to frontend
exports.handleSuccess = async (req, res) => {
  try {
    const payload = req.body;
    const result = await PayUService.verifyPayment(payload);

    const frontendURL =
      process.env.FRONTEND_URL || "http://localhost:3000";

    if (!result.success) {
      return res.redirect(
        `${frontendURL}/payment/payu/failure?txnid=${payload.txnid}&reason=${encodeURIComponent(
          result.error || "verification_failed",
        )}`,
      );
    }

    return res.redirect(
      `${frontendURL}/payment/payu/success?txnid=${payload.txnid}&orderId=${result.orderId}&paymentId=${result.paymentId}`,
    );
  } catch (error) {
    console.error("PayU success handler error:", error);
    const frontendURL =
      process.env.FRONTEND_URL || "http://localhost:3000";
    return res.redirect(
      `${frontendURL}/payment/payu/failure?reason=server_error`,
    );
  }
};

// PayU redirects here (POST) on failure — verify then redirect to frontend
exports.handleFailure = async (req, res) => {
  try {
    const payload = req.body;
    if (payload && payload.txnid) {
      await PayUService.verifyPayment(payload);
    }
    const frontendURL =
      process.env.FRONTEND_URL || "http://localhost:3000";
    return res.redirect(
      `${frontendURL}/payment/payu/failure?txnid=${payload.txnid || ""}&reason=${encodeURIComponent(
        payload.error_Message || "payment_failed",
      )}`,
    );
  } catch (error) {
    console.error("PayU failure handler error:", error);
    const frontendURL =
      process.env.FRONTEND_URL || "http://localhost:3000";
    return res.redirect(
      `${frontendURL}/payment/payu/failure?reason=server_error`,
    );
  }
};

// Webhook handler
exports.handleWebhook = async (req, res) => {
  try {
    const result = req.webhookResult;
    if (!result || !result.success) {
      return res.status(400).json({
        success: false,
        message: result?.error || "Webhook processing failed",
      });
    }
    res.json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("PayU webhook handler error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};