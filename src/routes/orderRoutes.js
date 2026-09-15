const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authenticate } = require("../middleware/auth");
const { uploadReportImage } = require("../middleware/upload");

// ===================== ADDRESS ROUTES =====================
// ✅ Make sure these routes exist

// Get user addresses
router.get("/addresses", authenticate, orderController.getUserAddresses);

// Add address
router.post("/addresses", authenticate, orderController.addAddress);

// Set default address
router.put(
  "/addresses/:addressId/default",
  authenticate,
  orderController.setDefaultAddress,
);

// ===================== ORDER ROUTES =====================

// Get user orders
router.get("/user", authenticate, orderController.getUserOrders);

// Get user activity
router.get("/user/activity", authenticate, orderController.getUserActivity);

// Get recommended products
router.get(
  "/user/recommended",
  authenticate,
  orderController.getRecommendedProducts,
);

// Create order
router.post("/create", authenticate, orderController.createOrder);

// Get order by ID
router.get("/:id", authenticate, orderController.getOrderById);

// Get order invoice
router.get("/:id/invoice", authenticate, orderController.getOrderInvoice);
// Download invoice as PDF (streamed)
router.get( "/:id/invoice/pdf", authenticate,orderController.downloadInvoicePDF,
);

// Cancel order
router.post("/:id/cancel", authenticate, orderController.cancelOrder);

// Report issue
router.post(
  "/:id/report",
  authenticate,
  uploadReportImage.single("file"),
  orderController.reportIssue,
);

// Get order status
router.get("/:id/status", authenticate, orderController.getOrderStatus);

// ===================== ADMIN ROUTES =====================

// Get all orders (admin only)
router.get("/admin", authenticate, orderController.getAllOrders);

// Get analytics summary (admin only)
router.get(
  "/admin/analytics",
  authenticate,
  orderController.getAnalyticsSummary,
);

// Update order status (admin only)
router.put("/:id/status", authenticate, orderController.updateOrderStatus);

// Update order payment status
router.put(
  "/:id/payment",
  authenticate,
  orderController.updateOrderPaymentStatus,
);

module.exports = router;
