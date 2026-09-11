const db = require("../config/db");
const multer = require("multer");
const { uploadImage } = require("../utils/imagekit");

const upload = multer({ storage: multer.memoryStorage() });

// Create brand
const createBrand = async (req, res) => {
  try {
    const { name, status = "active" } = req.body;
    const image = req.file ? await uploadImage(req.file, "brands") : null;

    if (!name) {
      return res.status(400).json({ message: "Brand name is required" });
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const [result] = await db.execute(
      "INSERT INTO brands (name, slug, image, status) VALUES (?, ?, ?, ?)",
      [name, slug, image, status],
    );

    res.status(201).json({
      message: "Brand created successfully",
      brand: { id: result.insertId, name, slug, image, status },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Brand name already exists" });
    }
    res
      .status(500)
      .json({ message: "Error creating brand", error: error.message });
  }
};

// Get all brands
const getAllBrands = async (req, res) => {
  try {
    const [brands] = await db.execute(
      "SELECT * FROM brands ORDER BY created_at DESC",
    );
    res.json({ brands });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching brands", error: error.message });
  }
};

// Get brand by ID
const getBrandById = async (req, res) => {
  try {
    const { id } = req.params;
    const [brands] = await db.execute("SELECT * FROM brands WHERE id = ?", [
      id,
    ]);

    if (brands.length === 0) {
      return res.status(404).json({ message: "Brand not found" });
    }

    res.json({ brand: brands[0] });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching brand", error: error.message });
  }
};

// Update brand
const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;
    const image = req.file ? await uploadImage(req.file, "brands") : null;

    const [existing] = await db.execute("SELECT * FROM brands WHERE id = ?", [
      id,
    ]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Brand not found" });
    }

    const slug = name
      ? name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
      : existing[0].slug;

    await db.execute(
      "UPDATE brands SET name = ?, slug = ?, image = ?, status = ? WHERE id = ?",
      [
        name || existing[0].name,
        slug,
        image || existing[0].image,
        status || existing[0].status,
        id,
      ],
    );

    res.json({ message: "Brand updated successfully" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Brand name already exists" });
    }
    res
      .status(500)
      .json({ message: "Error updating brand", error: error.message });
  }
};

// Delete brand
const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute("DELETE FROM brands WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Brand not found" });
    }

    res.json({ message: "Brand deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting brand", error: error.message });
  }
};

module.exports = {
  upload,
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
};
