const express = require("express");
const router = express.Router();
const { authenticate, isAdmin } = require("../middleware/auth");
const setuController = require("../controllers/setuController");

// Initiate Setu payment (authenticated users)
router.post("/initiate", authenticate, setuController.initiatePayment);

// Verify Setu payment (after return from Setu)
router.post("/verify", authenticate, setuController.verifyPayment);

// Get payment status by order ID
router.get("/status/:orderId", authenticate, setuController.getPaymentStatus);

// Refund (admin only)
router.post("/refund", [authenticate, isAdmin], setuController.refundPayment);

module.exports = router;
