const crypto = require("crypto");

class WebhookValidator {
  // Validate Razorpay webhook signature
  static validateRazorpaySignature(payload, signature, secret) {
    try {
      if (!secret) {
        throw new Error("Webhook secret is required");
      }

      const body = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

      return expectedSignature === signature;
    } catch (error) {
      console.error("Razorpay signature validation error:", error);
      return false;
    }
  }

  // Validate webhook payload structure
  static validateWebhookPayload(payload, gateway) {
    try {
      if (!payload || typeof payload !== "object") {
        return { valid: false, error: "Invalid payload structure" };
      }

      switch (gateway) {
        case "razorpay":
          return this.validateRazorpayPayload(payload);
        default:
          return { valid: false, error: `Unsupported gateway: ${gateway}` };
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Validate Razorpay payload
  static validateRazorpayPayload(payload) {
    if (!payload.event) {
      return { valid: false, error: "Missing event field" };
    }

    if (!payload.payload) {
      return { valid: false, error: "Missing payload field" };
    }

    // Check if event contains required data
    const eventType = payload.event;
    const eventPayload = payload.payload;

    switch (eventType) {
      case "payment.captured":
        if (!eventPayload.payment) {
          return {
            valid: false,
            error: "Missing payment data for payment.captured event",
          };
        }
        break;
      case "payment.failed":
        if (!eventPayload.payment) {
          return {
            valid: false,
            error: "Missing payment data for payment.failed event",
          };
        }
        break;
      case "order.paid":
        if (!eventPayload.order || !eventPayload.payment) {
          return {
            valid: false,
            error: "Missing order/payment data for order.paid event",
          };
        }
        break;
      case "refund.created":
      case "refund.processed":
        if (!eventPayload.refund) {
          return {
            valid: false,
            error: `Missing refund data for ${eventType} event`,
          };
        }
        break;
      default:
    }

    return { valid: true };
  }

  // Sanitize webhook data
  static sanitizeWebhookData(payload) {
    try {
      // Remove sensitive data
      const sanitized = { ...payload };

      if (sanitized.payload?.payment?.card) {
        sanitized.payload.payment.card = "****";
      }

      return sanitized;
    } catch (error) {
      console.error("Sanitization error:", error);
      return payload;
    }
  }

  // Extract webhook metadata
  static extractWebhookMetadata(req) {
    return {
      ipAddress: req.ip || req.connection?.remoteAddress || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: {
        "content-type": req.headers["content-type"],
        "content-length": req.headers["content-length"],
        "user-agent": req.headers["user-agent"],
      },
    };
  }
}

module.exports = WebhookValidator;
