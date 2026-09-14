const express = require("express");
const router = express.Router();
const { validateWebhook } = require("../middleware/webhook");
const { validateSetuWebhook } = require("../middleware/setuWebhookValidator");
const { validatePayUWebhook } = require("../middleware/payuWebhookValidator");
const paymentController = require("../controllers/paymentController");
const setuController = require("../controllers/setuController");
const payuController = require("../controllers/payuController");
const { authenticate, isAdmin } = require("../middleware/auth");

// ─── Razorpay webhook ────────────────────────────────
router.post("/razorpay", validateWebhook, paymentController.handleWebhook);

// ─── Setu webhook ─────────────────────────────────────
router.post("/setu", validateSetuWebhook, setuController.handleWebhook);

// ─── PayU webhook ─────────────────────────────────────
router.post("/payu", validatePayUWebhook, payuController.handleWebhook);

// ─── Admin webhook logs & stats ──────────────────────
router.get("/logs", [authenticate, isAdmin], paymentController.getWebhookLogs);
router.get(
  "/stats",
  [authenticate, isAdmin],
  paymentController.getWebhookStats,
);

module.exports = router;