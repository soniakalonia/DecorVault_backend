const crypto = require("crypto");

// Setu webhook signature validation
const validateSetuWebhook = (req, res, next) => {
  try {
    const signature = req.headers["x-setu-signature"];
    if (!signature) {
      return res
        .status(401)
        .json({ success: false, message: "Missing signature" });
    }

    // Compute HMAC with secret
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", process.env.SETU_SECRET)
      .update(payload)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.warn("Invalid Setu webhook signature");
      return res
        .status(401)
        .json({ success: false, message: "Invalid signature" });
    }

    // Attach parsed event to req
    const event = req.body;
    req.webhookEvent = event;
    req.webhookResult = { success: true, event };

    next();
  } catch (error) {
    console.error("Setu webhook validation error:", error);
    res
      .status(500)
      .json({ success: false, message: "Webhook validation failed" });
  }
};

module.exports = { validateSetuWebhook };
