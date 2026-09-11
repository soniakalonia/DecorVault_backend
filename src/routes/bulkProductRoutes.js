// src/routes/bulkProductRoutes.js
const express = require("express");
const { upload } = require("../middleware/upload");
const { authenticate, authorize } = require("../middleware/auth");
const {
  uploadCSV,
  processProducts,
  getTemplate,
  previewCSV,
} = require("../controllers/bulkProductController");

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate, authorize("admin"));

// Upload CSV file and process
router.post("/upload-csv", upload.single("file"), uploadCSV);

// Preview CSV without importing
router.post("/preview-csv", upload.single("file"), previewCSV);

// Process products from JSON array (manual row entry)
router.post("/process", processProducts);

// Get CSV template
router.get("/template", getTemplate);

module.exports = router;
