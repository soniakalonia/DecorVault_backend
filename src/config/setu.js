const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

class SetuClient {
  constructor() {
    // OAuth requires the /v2 path segment
    this.baseURL =
      process.env.SETU_MODE === "PRODUCTION"
        ? "https://prod.setu.co/api/v2"
        : "https://uat.setu.co/api/v2";

    this.schemeId = process.env.SETU_SCHEME_ID;
    this.secret = process.env.SETU_SECRET;
    this.productInstanceId = process.env.SETU_PRODUCT_INSTANCE_ID;

    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/auth/token`,
        {
          clientID: this.schemeId,
          secret: this.secret,
        },
        {
          headers: { "Content-Type": "application/json" },
        },
      );

      // Setu wraps the real payload inside "data"
      const { token, expiresIn } = response.data.data;
      this.accessToken = token;
      this.tokenExpiry = Date.now() + expiresIn * 1000 - 60000;
      return token;
    } catch (error) {
      console.error("❌ Setu OAuth error:");
      if (error.response) {
        console.error("  Status:", error.response.status);
        console.error("  Data:", JSON.stringify(error.response.data, null, 2));
      } else {
        console.error("  Error:", error.message);
      }
      throw new Error(
        "Failed to authenticate with Setu – check credentials and network.",
      );
    }
  }

  async getClient() {
    const token = await this.getAccessToken();
    return axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Setu-Product-Instance-ID": this.productInstanceId,
        "Content-Type": "application/json",
      },
    });
  }
}

module.exports = new SetuClient();
