const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate, isAdmin } = require("../middleware/auth");

// Public routes
router.post("/register", authController.register);
router.post("/verify-otp", authController.verifyOTP);
router.post("/resend-otp", authController.resendOTP);
router.post("/login", authController.login);

// Password Reset Routes
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// Login with OTP Routes
router.post("/send-login-otp", authController.sendLoginOTP);
router.post("/verify-login-otp", authController.verifyLoginOTP);

// Protected routes (require authentication)
router.get("/profile", authenticate, authController.getProfile);
router.put("/profile", authenticate, authController.updateProfile);

// Admin only routes
router.get("/users", isAdmin, authController.getAllUsers);
router.put("/users/role", isAdmin, authController.updateUserRole);

module.exports = router;
