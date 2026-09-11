const express = require("express");
const router = express.Router();
const { authenticate, isAdmin } = require("../middleware/auth");
const paymentController = require("../controllers/paymentController");
const PaymentService = require("../services/paymentService");

// Initialize payment (authenticated users only)
router.post("/initiate", authenticate, paymentController.initiatePayment);

// Verify payment (authenticated users only)
router.post("/verify", authenticate, paymentController.verifyPayment);

// Get payment status by order ID (authenticated users only)
router.get(
  "/status/:orderId",
  authenticate,
  paymentController.getPaymentStatus,
);

// Get user payment history (authenticated users only)
router.get("/history", authenticate, paymentController.getPaymentHistory);

// Refund payment (admin only)
router.post(
  "/refund",
  [authenticate, isAdmin],
  paymentController.refundPayment,
);

// Webhook endpoint (no auth - handled separately in webhookRoutes)
// This is just a placeholder to show the route exists

module.exports = router;
