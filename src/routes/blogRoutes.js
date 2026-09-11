const express = require("express");
const router = express.Router();
const blogController = require("../controllers/blogController");
const { authenticate, authorize } = require("../middleware/auth");

router.get("/", blogController.getAllBlogs);
router.get("/slug/:slug", blogController.getBlogBySlug);
router.get("/:id", blogController.getBlog);
router.post("/", authenticate, authorize("admin"), blogController.createBlog);
router.put("/:id", authenticate, authorize("admin"), blogController.updateBlog);
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  blogController.deleteBlog,
);

module.exports = router;
