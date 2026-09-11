const express = require("express");
const router = express.Router();
const { authenticate, authorize, isAdmin } = require("../middleware/auth");
const cartController = require("../controllers/cartController");
const wishlistController = require("../controllers/wishlistController");

// Cart routes
router.get("/cart", authenticate, cartController.getCart);
router.post("/cart", authenticate, cartController.addToCart);
router.put("/cart/:id", authenticate, cartController.updateCart);
router.delete("/cart/:id", authenticate, cartController.removeFromCart);
router.delete("/cart", authenticate, cartController.clearCart);

// Wishlist routes
router.get("/wishlist", authenticate, wishlistController.getWishlist);
router.post("/wishlist", authenticate, wishlistController.addToWishlist);
router.delete(
  "/wishlist/:id",
  authenticate,
  wishlistController.removeFromWishlist,
);

// User Notification routes
const {
  getUserNotifications,
  markUserNotificationAsRead,
  markAllUserNotificationsAsRead,
  getUserUnreadCount,
} = require("../controllers/notificationController");
router.get("/notifications", authenticate, getUserNotifications);
router.put("/notification/:id/read", authenticate, markUserNotificationAsRead);
router.put(
  "/notifications/read-all",
  authenticate,
  markAllUserNotificationsAsRead,
);
router.get("/notifications/unread-count", authenticate, getUserUnreadCount);

// Example: Route accessible by any authenticated user
router.get("/profile", authenticate, (req, res) => {
  res.json({
    message: "User profile",
    userId: req.user.id,
    role: req.user.role,
  });
});

// Example: Route accessible only by users with 'user' role
router.get("/user-dashboard", [authenticate, authorize("user")], (req, res) => {
  res.json({
    message: "User Dashboard",
    data: "This is user-specific data",
  });
});

// Example: Route accessible only by admins
router.get("/admin-dashboard", isAdmin, (req, res) => {
  res.json({
    message: "Admin Dashboard",
    data: "This is admin-specific data",
  });
});

// Example: Route accessible by both users and admins
router.get(
  "/shared-resource",
  [authenticate, authorize("user", "admin")],
  (req, res) => {
    res.json({
      message: "Shared Resource",
      userRole: req.user.role,
    });
  },
);

module.exports = router;
