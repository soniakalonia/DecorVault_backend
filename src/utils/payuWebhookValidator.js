const { verifyReverseHash } = require("../utils/payuHash");
const payuClient = require("../config/payu");

/**
 * PayU webhook / redirect validation middleware.
 *
 * PayU does NOT send a signature header like Razorpay or Setu.
 * Instead, the POST body itself contains a `hash` field which is the
 * reverse hash: sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 * (If additionalCharges is present, it is prepended to that string.)
 *
 * This middleware:
 *  1. Ensures required fields exist (txnid, status, hash, key).
 *  2. Recomputes the reverse hash and compares with payload.hash.
 *  3. Attaches req.webhookEvent and req.webhookResult for the controller.
 *
 * NOTE: PayU POSTs application/x-www-form-urlencoded data. Ensure your
 * express app uses: app.use(express.urlencoded({ extended: true }))
 * BEFORE this middleware runs, otherwise req.body will be empty.
 */
const validatePayUWebhook = async (req, res, next) => {
  try {
    const payload = req.body || {};

    // ── 1. Presence checks ────────────────────────────
    if (!payload.txnid) {
      console.warn("PayU webhook: missing txnid");
      return res
        .status(400)
        .json({ success: false, message: "Missing txnid" });
    }

    if (!payload.hash) {
      console.warn(`PayU webhook: missing hash for txnid=${payload.txnid}`);
      return res
        .status(400)
        .json({ success: false, message: "Missing hash" });
    }

    if (!payload.status) {
      console.warn(`PayU webhook: missing status for txnid=${payload.txnid}`);
      return res
        .status(400)
        .json({ success: false, message: "Missing status" });
    }

    // ── 2. Reverse hash verification ──────────────────
    const config = payuClient.getConfig();
    if (!config.salt) {
      console.error("PAYU_SALT not configured");
      return res
        .status(500)
        .json({ success: false, message: "Webhook salt not configured" });
    }

    const isValid = verifyReverseHash(
      {
        status: payload.status,
        udf5: payload.udf5 || "",
        udf4: payload.udf4 || "",
        udf3: payload.udf3 || "",
        udf2: payload.udf2 || "",
        udf1: payload.udf1 || "",
        email: payload.email,
        firstname: payload.firstname,
        productinfo: payload.productinfo,
        amount: payload.amount,
        txnid: payload.txnid,
        key: payload.key || config.merchantKey,
        additionalCharges: payload.additionalCharges,
        hash: payload.hash,
      },
      config.salt,
    );

    if (!isValid) {
      console.warn(
        `PayU webhook: invalid reverse hash for txnid=${payload.txnid}`,
      );
      return res
        .status(401)
        .json({ success: false, message: "Invalid hash" });
    }

    // ── 3. Attach parsed event for the controller ─────
    req.webhookEvent = payload;
    req.webhookResult = { success: true, event: payload };

    next();
  } catch (error) {
    console.error("PayU webhook validation error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Webhook validation failed" });
  }
};

module.exports = { validatePayUWebhook };