const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const payuController = require("../controllers/payuController");

// Initiate PayU payment (authenticated)
router.post("/initiate", authenticate, payuController.initiatePayment);

// Verify payment manually (after redirect, frontend can double-verify)
router.post("/verify", authenticate, payuController.verifyPayment);

// Get payment status by order ID
router.get("/status/:orderId", payuController.getPaymentStatus);

// PayU redirects (POST) here after payment — NOT authenticated (PayU server hits these)
router.post("/success", payuController.handleSuccess);
router.post("/failure", payuController.handleFailure);

module.exports = router;