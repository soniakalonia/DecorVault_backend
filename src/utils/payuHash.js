const crypto = require("crypto");

/**
 * Generate forward hash for PayU payment request.
 * Format:
 * sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 */
const generateHash = ({
  key,
  txnid,
  amount,
  productinfo,
  firstname,
  email,
  udf1 = "",
  udf2 = "",
  udf3 = "",
  udf4 = "",
  udf5 = "",
  salt,
}) => {
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${salt}`;

  const hash = crypto.createHash("sha512").update(hashString).digest("hex");
  return hash;
};

/**
 * Verify reverse hash returned by PayU in response / webhook.
 *
 * Format (no additionalCharges):
 * sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 *
 * Format (with additionalCharges):
 * sha512(additionalCharges|SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 */
const verifyReverseHash = (response, salt) => {
  const {
    status,
    udf5 = "",
    udf4 = "",
    udf3 = "",
    udf2 = "",
    udf1 = "",
    email = "",
    firstname = "",
    productinfo = "",
    amount = "",
    txnid = "",
    key = "",
    additionalCharges,
    hash,
  } = response;

  if (!hash) {
    return false;
  }

  let hashString = `${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;

  let usedAdditionalCharges = false;
  if (
    additionalCharges !== undefined &&
    additionalCharges !== null &&
    String(additionalCharges).trim() !== "" &&
    String(additionalCharges).trim() !== "0"
  ) {
    hashString = `${additionalCharges}|${hashString}`;
    usedAdditionalCharges = true;
  }

  const calculatedHash = crypto
    .createHash("sha512")
    .update(hashString)
    .digest("hex");

  return calculatedHash === hash;
};

module.exports = { generateHash, verifyReverseHash };