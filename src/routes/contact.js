const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const {
  submitContactForm,
  getAllContacts,
  getContactById,
  updateContactStatus,
  deleteContact,
} = require("../controllers/contactController");

// Public route - Submit contact form (No authentication required)
router.post("/", submitContactForm);

// Admin routes - Protected (Authentication required)
router.get("/all", authenticate, getAllContacts);
router.get("/:id", authenticate, getContactById);
router.put("/:id/status", authenticate, updateContactStatus);
router.delete("/:id", authenticate, deleteContact);

module.exports = router;
