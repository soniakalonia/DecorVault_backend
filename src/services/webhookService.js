const crypto = require("crypto");
const db = require("../config/db");
const Payment = require("../models/Payment");
const Transaction = require("../models/Transaction");
const WebhookLog = require("../models/WebhookLog");

class WebhookService {
  // ─── Log helper ───
  static async log({
    gateway,
    eventType,
    gatewayEventId,
    payload,
    signature,
    status,
    errorMessage,
    ipAddress,
    userAgent,
  }) {
    try {
      await WebhookLog.create({
        gateway,
        event_type: eventType,
        gateway_event_id: gatewayEventId,
        payload: JSON.stringify(payload),
        signature,
        status,
        error_message: errorMessage,
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    } catch (e) {
      console.error("WebhookLog.create failed:", e.message);
    }
  }

  // ─── Razorpay signature verification ───
  static verifyRazorpaySignature(rawBody, signature) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return false;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    return expected === signature;
  }

  // ─── Main entry: process any webhook ───
  static async processWebhook(
    gateway,
    payload,
    signature,
    ipAddress,
    userAgent,
  ) {
    try {
      // Log every incoming webhook
      await this.log({
        gateway,
        eventType: payload?.event || "unknown",
        gatewayEventId: payload?.payload?.payment?.entity?.id || payload?.id,
        payload,
        signature,
        status: "received",
        ipAddress,
        userAgent,
      });

      if (gateway === "razorpay") {
        return await this.handleRazorpay(payload, signature, ipAddress, userAgent);
      }

      return { success: false, error: `Unsupported gateway: ${gateway}` };
    } catch (error) {
      console.error("processWebhook error:", error);
      return { success: false, error: error.message };
    }
  }

  // ─── Razorpay handler ───
  static async handleRazorpay(payload, signature, ipAddress, userAgent) {
    try {
      const event = payload?.event;
      const entity = payload?.payload?.payment?.entity;
      const razorpayOrderId = entity?.order_id;
      const razorpayPaymentId = entity?.id;

      if (!razorpayOrderId) {
        return { success: false, error: "Missing order_id in webhook" };
      }

      // Only act on captured/authorized payments
      if (
        event !== "payment.captured" &&
        event !== "payment.authorized" &&
        event !== "order.paid"
      ) {
        await this.log({
          gateway: "razorpay",
          eventType: event,
          payload,
          signature,
          status: "ignored",
          ipAddress,
          userAgent,
        });
        return { success: true, message: `Ignored event ${event}` };
      }

      const payment = await Payment.findByGatewayOrderId(razorpayOrderId);
      if (!payment) {
        return { success: false, error: "Payment record not found" };
      }

      // Idempotency: if already paid, still ensure invoice went out
      if (payment.status !== "paid") {
        await Payment.update(payment.id, {
          status: "paid",
          gateway_payment_id: razorpayPaymentId,
          gateway_signature: signature,
          gateway_response: payload,
        });

        await Transaction.create({
          payment_id: payment.id,
          gateway: "razorpay",
          gateway_transaction_id: razorpayPaymentId,
          type: "payment",
          amount: Number(entity?.amount || 0) / 100,
          status: "success",
          response_data: payload,
        });

        await db.execute(
          `UPDATE orders SET status = 'confirmed', confirmed_at = NOW() WHERE id = ?`,
          [payment.order_id],
        );
      }

      // 🧾 Fire invoice email (non-blocking). sendInvoiceAfterSuccess is
      // idempotent — safe even if the verify endpoint already triggered it.
      require("../controllers/orderController")
        .sendInvoiceAfterSuccess(payment.order_id)
        .catch((e) => console.error("Webhook invoice email error:", e.message));

      await this.log({
        gateway: "razorpay",
        eventType: event,
        gatewayEventId: razorpayPaymentId,
        payload,
        signature,
        status: "processed",
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: "Razorpay webhook processed",
        orderId: payment.order_id,
      };
    } catch (error) {
      console.error("Razorpay webhook error:", error);
      return { success: false, error: error.message };
    }
  }

  // ─── Admin helpers ───
  static async getWebhookLogs(gateway, limit = 100) {
    try {
      const [rows] = gateway
        ? await db.execute(
            `SELECT * FROM webhook_logs WHERE gateway = ? ORDER BY created_at DESC LIMIT ?`,
            [gateway, String(limit)],
          )
        : await db.execute(
            `SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT ?`,
            [String(limit)],
          );
      return { success: true, logs: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getWebhookStats() {
    try {
      const [rows] = await db.execute(
        `SELECT gateway, status, COUNT(*) as count FROM webhook_logs GROUP BY gateway, status`,
      );
      return { success: true, stats: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = WebhookService;