const { verifyReverseHash } = require("../utils/payuHash");
const payuClient = require("../config/payu");

/**
 * PayU does not send a signature header like Razorpay.
 * Instead, the payload itself contains a `hash` field which is the
 * reverse hash (SALT|status|...). We verify that.
 *
 * PayU POSTs form-urlencoded data to your surl/furl. Ensure your
 * express app uses express.urlencoded({ extended: true }).
 */
const validatePayUWebhook = async (req, res, next) => {
  try {
    const payload = req.body;
    if (!payload || !payload.txnid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid PayU payload" });
    }

    const config = payuClient.getConfig();
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
        key: payload.key,
        additionalCharges: payload.additionalCharges,
        hash: payload.hash,
      },
      config.salt,
    );

    if (!isValid) {
      console.warn("Invalid PayU webhook hash for txnid:", payload.txnid);
      return res
        .status(401)
        .json({ success: false, message: "Invalid hash" });
    }

    req.webhookEvent = payload;
    req.webhookResult = { success: true, event: payload };
    next();
  } catch (error) {
    console.error("PayU webhook validation error:", error);
    res
      .status(500)
      .json({ success: false, message: "Webhook validation failed" });
  }
};

module.exports = { validatePayUWebhook };