const db = require("../config/db");
const multer = require("multer");
const { uploadImage } = require("../utils/imagekit");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// Create category
const createCategory = async (req, res) => {
  try {
    const { name, status = "active" } = req.body;
    const image = req.file ? await uploadImage(req.file, "categories") : null;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const [existing] = await db.execute(
      "SELECT id FROM categories WHERE slug = ?",
      [slug],
    );
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists",
      });
    }

    const [result] = await db.execute(
      "INSERT INTO categories (name, slug, image, status) VALUES (?, ?, ?, ?)",
      [name, slug, image, status],
    );

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category: { id: result.insertId, name, slug, image, status },
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({
      success: false,
      message: "Error creating category",
      error: error.message,
    });
  }
};

// Get all categories
const getAllCategories = async (req, res) => {
  try {
    // Simple query without any filters first
    const [categories] = await db.execute(
      "SELECT * FROM categories ORDER BY created_at DESC",
    );

    res.json({
      success: true,
      categories: categories,
      currentPage: 1,
      totalPages: 1,
      totalItems: categories.length,
      itemsPerPage: categories.length,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message,
    });
  }
};

// Get categories list for dropdown
const getAllCategoriesList = async (req, res) => {
  try {
    const [categories] = await db.execute(
      'SELECT id, name FROM categories WHERE status = "active" ORDER BY name ASC',
    );
    res.json({
      success: true,
      categories: categories,
    });
  } catch (error) {
    console.error("Error fetching categories list:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message,
    });
  }
};

// Get category by ID
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const [categories] = await db.execute(
      "SELECT * FROM categories WHERE id = ?",
      [id],
    );

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      category: categories[0],
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching category",
      error: error.message,
    });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;
    const image = req.file ? await uploadImage(req.file, "categories") : null;

    const [existing] = await db.execute(
      "SELECT * FROM categories WHERE id = ?",
      [id],
    );
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    let slug = existing[0].slug;
    if (name && name !== existing[0].name) {
      slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const [existingSlug] = await db.execute(
        "SELECT id FROM categories WHERE slug = ? AND id != ?",
        [slug, id],
      );
      if (existingSlug.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists",
        });
      }
    }

    await db.execute(
      "UPDATE categories SET name = ?, slug = ?, image = ?, status = ? WHERE id = ?",
      [
        name || existing[0].name,
        slug,
        image || existing[0].image,
        status || existing[0].status,
        id,
      ],
    );

    res.json({
      success: true,
      message: "Category updated successfully",
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({
      success: false,
      message: "Error updating category",
      error: error.message,
    });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute("DELETE FROM categories WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting category",
      error: error.message,
    });
  }
};

module.exports = {
  upload,
  createCategory,
  getAllCategories,
  getAllCategoriesList,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
