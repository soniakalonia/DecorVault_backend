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
  return crypto.createHash("sha512").update(hashString).digest("hex");
};

/**
 * Verify reverse hash returned by PayU in response / webhook.
 * Format:
 * sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 *
 * Note: additionalCharges is prepended to the string when present.
 */
const verifyReverseHash = (response, salt) => {
  const {
    status,
    udf5 = "",
    udf4 = "",
    udf3 = "",
    udf2 = "",
    udf1 = "",
    email,
    firstname,
    productinfo,
    amount,
    txnid,
    key,
    additionalCharges,
  } = response;

  let hashString = `${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;

  if (additionalCharges) {
    hashString = `${additionalCharges}|${hashString}`;
  }

  const calculatedHash = crypto
    .createHash("sha512")
    .update(hashString)
    .digest("hex");

  return calculatedHash === response.hash;
};

module.exports = { generateHash, verifyReverseHash };