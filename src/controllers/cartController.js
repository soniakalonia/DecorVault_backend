const db = require("../config/db");

exports.getCart = async (req, res) => {
  try {
    const [items] = await db.query(
      `SELECT c.*, p.name, p.price, p.discount_price, p.product_images, p.variants, p.packing_standard 
       FROM cart c 
       JOIN products p ON c.product_id = p.id 
       WHERE c.user_id = ?`,
      [req.user.id],
    );
    res.json({ success: true, data: items });
  } catch (error) {
    console.error("❌ Get cart error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const { product_id, variant_id, quantity, replaceQuantity } = req.body;
    const finalVariantId = variant_id || "default";

    const query = replaceQuantity
      ? `INSERT INTO cart (user_id, product_id, variant_id, quantity) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE quantity = ?`
      : `INSERT INTO cart (user_id, product_id, variant_id, quantity) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE quantity = quantity + ?`;

    await db.query(query, [
      req.user.id,
      product_id,
      finalVariantId,
      quantity,
      quantity,
    ]);
    res.json({ success: true, message: "Added to cart" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCart = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    // First, check if the cart item exists
    const [existing] = await db.query(
      "SELECT * FROM cart WHERE id = ? AND user_id = ?",
      [id, req.user.id],
    );

    if (existing.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Cart item not found" });
    }

    if (quantity <= 0) {
      const [result] = await db.query(
        "DELETE FROM cart WHERE id = ? AND user_id = ?",
        [id, req.user.id],
      );
      res.json({ success: true, message: "Item removed from cart" });
    } else {
      const [result] = await db.query(
        "UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?",
        [quantity, id, req.user.id],
      );
      res.json({
        success: true,
        message: "Cart updated",
        data: { id, quantity },
      });
    }
  } catch (error) {
    console.error("❌ Update cart error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM cart WHERE id = ? AND user_id = ?", [
      id,
      req.user.id,
    ]);
    res.json({ success: true, message: "Removed from cart" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    await db.query("DELETE FROM cart WHERE user_id = ?", [req.user.id]);
    res.json({ success: true, message: "Cart cleared" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
