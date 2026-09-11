const db = require("../config/db");
const { notifyLowStock } = require("../utils/notificationService");

const getAllInventory = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.name,
        p.slug,
        p.stock_quantity,
        p.price,
        p.discount_price,
        p.category,
        p.brand,
        p.status,
        p.product_images,
        p.created_at,
        p.updated_at
      FROM products p 
      ORDER BY p.updated_at DESC
    `);

    res.status(200).json({
      success: true,
      message: "Inventory retrieved successfully",
      data: rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory",
      error: error.message,
    });
  }
};

const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock_quantity, action } = req.body;

    if (!stock_quantity || !action) {
      return res.status(400).json({
        success: false,
        message: "Stock quantity and action are required",
      });
    }

    let updateQuery;
    let newStock;

    if (action === "set") {
      updateQuery = "UPDATE products SET stock_quantity = ? WHERE id = ?";
      newStock = stock_quantity;
    } else if (action === "add") {
      updateQuery =
        "UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?";
      newStock = stock_quantity;
    } else if (action === "subtract") {
      updateQuery =
        "UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - ?) WHERE id = ?";
      newStock = stock_quantity;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "set", "add", or "subtract"',
      });
    }

    const [result] = await db.execute(updateQuery, [stock_quantity, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Get updated product
    const [updatedProduct] = await db.execute(
      "SELECT * FROM products WHERE id = ?",
      [id],
    );

    // Create notification if stock is low
    if (updatedProduct[0].stock_quantity <= 10) {
      await notifyLowStock(
        updatedProduct[0].name,
        updatedProduct[0].stock_quantity,
      );
    }

    res.status(200).json({
      success: true,
      message: "Stock updated successfully",
      data: updatedProduct[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update stock",
      error: error.message,
    });
  }
};

const getLowStockProducts = async (req, res) => {
  try {
    const { threshold = 10 } = req.query;

    const [rows] = await db.query(
      `
      SELECT 
        id, name, slug, stock_quantity, price, category, brand, status
      FROM products 
      WHERE stock_quantity <= ? AND status = 'active'
      ORDER BY stock_quantity ASC
    `,
      [threshold],
    );

    res.status(200).json({
      success: true,
      message: "Low stock products retrieved successfully",
      data: rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch low stock products",
      error: error.message,
    });
  }
};

const getInventoryStats = async (req, res) => {
  try {
    const [totalProducts] = await db.query(
      'SELECT COUNT(*) as total FROM products WHERE status = "active"',
    );
    const [lowStock] = await db.query(
      'SELECT COUNT(*) as count FROM products WHERE stock_quantity <= 10 AND status = "active"',
    );
    const [outOfStock] = await db.query(
      'SELECT COUNT(*) as count FROM products WHERE stock_quantity = 0 AND status = "active"',
    );
    const [totalValue] = await db.query(
      'SELECT SUM(stock_quantity * price) as value FROM products WHERE status = "active"',
    );

    res.status(200).json({
      success: true,
      message: "Inventory stats retrieved successfully",
      data: {
        totalProducts: totalProducts[0].total,
        lowStockProducts: lowStock[0].count,
        outOfStockProducts: outOfStock[0].count,
        totalInventoryValue: totalValue[0].value || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory stats",
      error: error.message,
    });
  }
};

module.exports = {
  getAllInventory,
  updateStock,
  getLowStockProducts,
  getInventoryStats,
};
