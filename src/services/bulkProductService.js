// src/services/bulkProductService.js
const db = require("../config/db");

class BulkProductService {
  async processBulkProducts(products, adminId) {
    const results = {
      total: products.length,
      successful: 0,
      failed: 0,
      errors: [],
      insertedIds: [],
    };

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const validation = this.validateProduct(product);

        if (!validation.isValid) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            errors: validation.errors,
            data: product,
          });
          continue;
        }

        try {
          if (!product.slug) {
            product.slug = this.generateSlug(product.name);
          }

          const insertResult = await this.insertProduct(
            connection,
            product,
            adminId,
          );
          results.successful++;
          results.insertedIds.push(insertResult.insertId);
        } catch (error) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            errors: [`Database error: ${error.message}`],
            data: product,
          });
        }
      }

      if (results.successful === 0) {
        await connection.rollback();
        results.message =
          "All products failed to import. Transaction rolled back.";
      } else {
        await connection.commit();
        results.message = `${results.successful} products imported successfully. ${results.failed} failed.`;
      }
    } catch (error) {
      await connection.rollback();
      throw new Error(`Bulk import failed: ${error.message}`);
    } finally {
      connection.release();
    }

    return results;
  }

  async insertProduct(connection, product, adminId) {
    const query = `
            INSERT INTO products (
                name, slug, description, long_description, materials, care_instructions,
                specifications, additional_info, weight, warranty, admin_email, admin_name,
                admin_number, price, discount_price, stock_quantity, category, brand,
                packing_standard, video_url, type, affiliate_link, product_images,
                tags, colors, sizes, features, variants, delivery_charges,
                default_delivery_charge, is_featured, is_new_arrival, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const values = [
      product.name,
      product.slug || this.generateSlug(product.name),
      product.description || "",
      product.long_description || null,
      product.materials || null,
      product.care_instructions || null,
      product.specifications ? JSON.stringify(product.specifications) : null,
      product.additional_info || null,
      product.weight || 0.0,
      product.warranty || null,
      product.admin_email || null,
      product.admin_name || null,
      product.admin_number || null,
      product.price || 0,
      product.discount_price || 0,
      product.stock_quantity || 0,
      product.category || null,
      product.brand || null,
      product.packing_standard || null,
      product.video_url || null,
      product.type || "own",
      product.affiliate_link || null,
      product.product_images ? JSON.stringify(product.product_images) : null,
      product.tags ? JSON.stringify(product.tags) : null,
      product.colors ? JSON.stringify(product.colors) : null,
      product.sizes ? JSON.stringify(product.sizes) : null,
      product.features ? JSON.stringify(product.features) : null,
      product.variants ? JSON.stringify(product.variants) : null,
      product.delivery_charges
        ? JSON.stringify(product.delivery_charges)
        : null,
      product.default_delivery_charge || 0.0,
      product.is_featured || 0,
      product.is_new_arrival || 0,
      product.status || "active",
    ];

    const [result] = await connection.query(query, values);
    return result;
  }

  generateSlug(name) {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") +
      "-" +
      Date.now().toString(36)
    );
  }

  validateProduct(product) {
    const errors = [];

    if (!product.name || product.name.trim() === "") {
      errors.push("Product name is required");
    }

    if (!product.price || isNaN(product.price) || product.price < 0) {
      errors.push("Valid price is required");
    }

    if (!product.category || product.category.trim() === "") {
      errors.push("Category is required");
    }

    if (
      product.stock_quantity === undefined ||
      isNaN(product.stock_quantity) ||
      product.stock_quantity < 0
    ) {
      errors.push("Valid stock quantity is required");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = new BulkProductService();
