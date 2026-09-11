const WebhookService = require("../services/webhookService");

// Validate webhook signature and payload
const validateWebhook = async (req, res, next) => {
  try {
    const gateway = req.params.gateway || "razorpay";
    const signature =
      req.headers["x-razorpay-signature"] || req.headers["x-webhook-signature"];
    const payload = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    if (!payload) {
      return res.status(400).json({ error: "Missing payload" });
    }

    if (!signature) {
      return res.status(400).json({ error: "Missing signature" });
    }

    // Process webhook
    const result = await WebhookService.processWebhook(
      gateway,
      payload,
      signature,
      ipAddress,
      userAgent,
    );

    if (!result.success) {
      return res
        .status(400)
        .json({ error: result.error || "Webhook processing failed" });
    }

    req.webhookResult = result;
    next();
  } catch (error) {
    console.error("Webhook validation error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Validate Razorpay webhook specifically
const validateRazorpayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature) {
      return res.status(400).json({ error: "Missing signature" });
    }

    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET not configured");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }

    const crypto = require("crypto");
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Add IP and user agent for logging
    req.webhookIp = req.ip || req.connection.remoteAddress;
    req.webhookUserAgent = req.headers["user-agent"];

    next();
  } catch (error) {
    console.error("Razorpay webhook validation error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  validateWebhook,
  validateRazorpayWebhook,
};
