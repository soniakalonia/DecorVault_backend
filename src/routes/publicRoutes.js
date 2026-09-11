const express = require("express");
const { getAllCategories } = require("../controllers/categoryController");
const { getAllBrands } = require("../controllers/brandController");
const { createSubscription } = require("../controllers/subscriptionController");
const { validateCoupon } = require("../controllers/couponController");
const {
  getAllProducts,
  getProductBySlug,
  getRelatedProducts,
} = require("../controllers/productController");
const {
  createReview,
  getProductReviews,
  getUserReviews,
} = require("../controllers/reviewController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Public category routes (no authentication required)
router.get("/categories", getAllCategories);
router.get("/brands", getAllBrands);
router.post("/subscribe", createSubscription);
router.post("/coupon/validate", validateCoupon);

// Public product routes
router.get("/products", getAllProducts);
router.get("/product/slug/:slug", getProductBySlug);
router.get("/product/slug/:slug/related", getRelatedProducts);

// Review routes
router.post("/reviews", createReview);
router.get("/reviews/:productId", getProductReviews);
router.get("/reviews/user", authenticate, getUserReviews);

module.exports = router;
