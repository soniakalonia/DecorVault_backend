// src/utils/csvParser.js

/**
 * Parse CSV string to array of product objects
 */
function parseCSV(csvString) {
  const lines = csvString.split("\n").filter((line) => line.trim());
  if (lines.length === 0) {
    throw new Error("CSV file is empty");
  }

  // Get headers from first line
  const headers = parseCSVLine(lines[0]);

  // Map headers to expected fields
  const fieldMap = {
    name: "name",
    "product name": "name",
    title: "name",
    price: "price",
    category: "category",
    brand: "brand",
    stock: "stock_quantity",
    "stock quantity": "stock_quantity",
    quantity: "stock_quantity",
    description: "description",
    "long description": "long_description",
    weight: "weight",
    status: "status",
    "discount price": "discount_price",
    discount_price: "discount_price",
    sku: "sku",
    images: "product_images",
    tags: "tags",
    colors: "colors",
    sizes: "sizes",
    type: "type",
    "is featured": "is_featured",
    is_featured: "is_featured",
    "is new arrival": "is_new_arrival",
    is_new_arrival: "is_new_arrival",
  };

  // Map headers to database fields
  const mappedHeaders = headers.map((header) => {
    const trimmed = header.trim().toLowerCase();
    return fieldMap[trimmed] || trimmed;
  });

  const products = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const product = {};

    for (let j = 0; j < mappedHeaders.length; j++) {
      const field = mappedHeaders[j];
      const value = values[j] ? values[j].trim() : "";

      // Convert values based on field type
      if (
        [
          "price",
          "discount_price",
          "weight",
          "default_delivery_charge",
        ].includes(field)
      ) {
        product[field] = parseFloat(value) || 0;
      } else if (["stock_quantity"].includes(field)) {
        product[field] = parseInt(value) || 0;
      } else if (["is_featured", "is_new_arrival"].includes(field)) {
        product[field] =
          value.toLowerCase() === "true" || value === "1" ? 1 : 0;
      } else if (
        [
          "product_images",
          "tags",
          "colors",
          "sizes",
          "features",
          "variants",
          "delivery_charges",
          "specifications",
        ].includes(field)
      ) {
        try {
          product[field] = JSON.parse(value);
        } catch {
          product[field] = value
            ? value.split(",").map((item) => item.trim())
            : [];
        }
      } else {
        product[field] = value;
      }
    }

    // Validate product
    const validation = validateProductData(product);
    product._validation = validation;

    products.push(product);
  }

  return products;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Validate product data against required fields
 */
function validateProductData(product) {
  const errors = [];

  // Required fields
  if (!product.name || product.name.trim() === "") {
    errors.push("Product name is required");
  }

  if (!product.price || isNaN(product.price) || product.price <= 0) {
    errors.push("Valid price is required (must be > 0)");
  }

  if (!product.category || product.category.trim() === "") {
    errors.push("Category is required");
  }

  if (
    product.stock_quantity === undefined ||
    isNaN(product.stock_quantity) ||
    product.stock_quantity < 0
  ) {
    errors.push("Valid stock quantity is required (must be >= 0)");
  }

  // Validate status
  if (
    product.status &&
    !["active", "inactive", "draft"].includes(product.status)
  ) {
    errors.push("Status must be: active, inactive, or draft");
  }

  // Validate type
  if (product.type && !["own", "affiliate"].includes(product.type)) {
    errors.push("Type must be: own or affiliate");
  }

  // Validate discount price
  if (product.discount_price && product.discount_price >= product.price) {
    errors.push("Discount price must be less than regular price");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate CSV template headers
 */
function getCSVTemplate() {
  return [
    "name",
    "price",
    "category",
    "brand",
    "stock_quantity",
    "description",
    "long_description",
    "weight",
    "discount_price",
    "status",
    "type",
    "product_images",
    "tags",
    "colors",
    "sizes",
    "features",
    "is_featured",
    "is_new_arrival",
  ].join(",");
}

// ✅ EXPORT ALL FUNCTIONS
module.exports = {
  parseCSV,
  validateProductData,
  getCSVTemplate,
  parseCSVLine,
};
