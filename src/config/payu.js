const dotenv = require("dotenv");
dotenv.config();

class PayUClient {
  constructor() {
    this.merchantKey = process.env.PAYU_MERCHANT_KEY;
    this.salt = process.env.PAYU_SALT;
    this.mode = process.env.PAYU_MODE || "TEST"; // TEST | LIVE

    this.baseURL =
      this.mode === "LIVE"
        ? "https://secure.payu.in/_payment"
        : "https://test.payu.in/_payment";

    this.successURL =
      process.env.PAYU_SUCCESS_URL ||
      "http://localhost:5000/api/payu/success";
    this.failureURL =
      process.env.PAYU_FAILURE_URL ||
      "http://localhost:5000/api/payu/failure";
  }

  getConfig() {
    return {
      merchantKey: this.merchantKey,
      salt: this.salt,
      baseURL: this.baseURL,
      successURL: this.successURL,
      failureURL: this.failureURL,
      mode: this.mode,
    };
  }
}

module.exports = new PayUClient();