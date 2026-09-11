const express = require("express");
const {
  addProduct,
  getAllProducts,
  getProductById,
  getProductBySlug,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const categoryController = require("../controllers/categoryController");
const {
  upload: brandUpload,
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
} = require("../controllers/brandController");
const {
  getAllSubscriptions,
  deleteSubscription,
} = require("../controllers/subscriptionController");
const {
  getAllInventory,
  updateStock,
  getLowStockProducts,
  getInventoryStats,
} = require("../controllers/inventoryController");
const {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  applyCoupon,
  getCouponStats,
} = require("../controllers/couponController");
const {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  getAnalyticsSummary,
} = require("../controllers/orderController");
const {
  getAllNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  getNotificationStats,
} = require("../controllers/notificationController");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// Product routes
router.post("/product", authenticate, addProduct);
router.get("/products", authenticate, getAllProducts);
router.get("/product/:id", authenticate, getProductById);
router.get("/product/slug/:slug", authenticate, getProductBySlug);
router.put("/product/:id", authenticate, updateProduct);
router.delete("/product/:id", authenticate, deleteProduct);

// Category routes
router.post(
  "/category",
  authenticate,
  categoryController.upload.single("image"),
  categoryController.createCategory,
);
router.get("/categories", authenticate, categoryController.getAllCategories);
router.get(
  "/categories/list",
  authenticate,
  categoryController.getAllCategoriesList,
);
router.get("/category/:id", authenticate, categoryController.getCategoryById);
router.put(
  "/category/:id",
  authenticate,
  categoryController.upload.single("image"),
  categoryController.updateCategory,
);
router.delete("/category/:id", authenticate, categoryController.deleteCategory);

// Brand routes
router.post("/brand", authenticate, brandUpload.single("image"), createBrand);
router.get("/brands", authenticate, getAllBrands);
router.get("/brand/:id", authenticate, getBrandById);
router.put(
  "/brand/:id",
  authenticate,
  brandUpload.single("image"),
  updateBrand,
);
router.delete("/brand/:id", authenticate, deleteBrand);

// Subscription routes
router.get("/subscriptions", authenticate, getAllSubscriptions);
router.delete("/subscription/:id", authenticate, deleteSubscription);

// Inventory routes
router.get("/inventory", authenticate, getAllInventory);
router.put("/inventory/:id/stock", authenticate, updateStock);
router.get("/inventory/low-stock", authenticate, getLowStockProducts);
router.get("/inventory/stats", authenticate, getInventoryStats);

// Coupon routes
router.post("/coupon", authenticate, createCoupon);
router.get("/coupons", authenticate, getAllCoupons);
router.get("/coupon/stats", authenticate, getCouponStats);
router.get("/coupon/:id", authenticate, getCouponById);
router.put("/coupon/:id", authenticate, updateCoupon);
router.delete("/coupon/:id", authenticate, deleteCoupon);
router.post("/coupon/validate", validateCoupon);
router.post("/coupon/apply", applyCoupon);

// Order routes
router.get("/orders", authenticate, getAllOrders);
router.get("/analytics", authenticate, getAnalyticsSummary);
router.get("/order/:id", authenticate, getOrderById);
router.put("/order/:id/status", authenticate, updateOrderStatus);

// Notification routes
router.get(
  "/notifications",
  authenticate,
  authorize("admin"),
  getAllNotifications,
);
router.post(
  "/notification",
  authenticate,
  authorize("admin"),
  createNotification,
);
router.put(
  "/notification/:id/read",
  authenticate,
  authorize("admin"),
  markAsRead,
);
router.put(
  "/notifications/read-all",
  authenticate,
  authorize("admin"),
  markAllAsRead,
);
router.delete(
  "/notification/:id",
  authenticate,
  authorize("admin"),
  deleteNotification,
);
router.get(
  "/notifications/unread-count",
  authenticate,
  authorize("admin"),
  getUnreadCount,
);
router.get(
  "/notifications/stats",
  authenticate,
  authorize("admin"),
  getNotificationStats,
);

module.exports = router;
