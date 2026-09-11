const fs = require("fs");
const path = require("path");
const bulkProductService = require("../services/bulkProductService");
const {
  parseCSV,
  validateProductData,
  getCSVTemplate,
} = require("../utils/csvParser");
const { uploadDir } = require("../middleware/upload");

/**
 * Upload CSV file and process products
 */
const uploadCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV file",
      });
    }

    // Read CSV file
    const filePath = req.file.path;
    const csvData = fs.readFileSync(filePath, "utf8");

    // Parse CSV
    let products;
    try {
      products = parseCSV(csvData);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Error parsing CSV: " + error.message,
      });
    }

    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid product data found in CSV",
      });
    }

    // Process products
    const result = await bulkProductService.processBulkProducts(
      products,
      req.user.id,
    );

    // Clean up temp file
    fs.unlinkSync(filePath);

    return res.status(200).json({
      success: true,
      data: {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        message: result.message,
        errors: result.errors,
        insertedIds: result.insertedIds,
      },
    });
  } catch (error) {
    // Clean up temp file if exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }

    console.error("Bulk upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process bulk upload: " + error.message,
    });
  }
};

/**
 * Process products submitted as JSON array (manual row entry)
 */
const processProducts = async (req, res) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of products",
      });
    }

    // Validate each product
    const validatedProducts = products.map((product, index) => {
      const validation = validateProductData(product);
      return {
        ...product,
        _validation: validation,
        _index: index,
      };
    });

    // Check if any products have validation errors
    const hasErrors = validatedProducts.some((p) => !p._validation.isValid);
    if (hasErrors) {
      const errors = validatedProducts
        .filter((p) => !p._validation.isValid)
        .map((p) => ({
          row: p._index + 1,
          errors: p._validation.errors,
          data: p,
        }));

      return res.status(400).json({
        success: false,
        message: "Validation errors found",
        data: {
          total: products.length,
          valid: validatedProducts.filter((p) => p._validation.isValid).length,
          invalid: errors.length,
          errors: errors,
        },
      });
    }

    // Process products
    const result = await bulkProductService.processBulkProducts(
      validatedProducts,
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      data: {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        message: result.message,
        errors: result.errors,
        insertedIds: result.insertedIds,
      },
    });
  } catch (error) {
    console.error("Process products error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process products: " + error.message,
    });
  }
};

/**
 * Get CSV template
 */
const getTemplate = async (req, res) => {
  try {
    const template = getCSVTemplate();
    return res.status(200).json({
      success: true,
      data: {
        template: template,
        description:
          "CSV template for bulk upload. First row should be headers.",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get template: " + error.message,
    });
  }
};

/**
 * Preview CSV file without importing
 */
const previewCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV file",
      });
    }

    const filePath = req.file.path;
    const csvData = fs.readFileSync(filePath, "utf8");

    let products;
    try {
      products = parseCSV(csvData);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Error parsing CSV: " + error.message,
      });
    }

    // Preview first 10 products with validation
    const preview = products.slice(0, 10).map((product, index) => {
      const validation = validateProductData(product);
      return {
        row: index + 1,
        product: {
          name: product.name || "",
          price: product.price || 0,
          category: product.category || "",
          brand: product.brand || "",
          stock_quantity: product.stock_quantity || 0,
        },
        isValid: validation.isValid,
        errors: validation.errors,
      };
    });

    // Clean up temp file
    fs.unlinkSync(filePath);

    return res.status(200).json({
      success: true,
      data: {
        total: products.length,
        preview: preview,
        validCount: products.filter((p) => validateProductData(p).isValid)
          .length,
        invalidCount: products.filter((p) => !validateProductData(p).isValid)
          .length,
      },
    });
  } catch (error) {
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }

    return res.status(500).json({
      success: false,
      message: "Failed to preview CSV: " + error.message,
    });
  }
};

module.exports = {
  uploadCSV,
  processProducts,
  getTemplate,
  previewCSV,
};
