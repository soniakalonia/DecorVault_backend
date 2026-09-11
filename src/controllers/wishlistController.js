const db = require("../config/db");

exports.getWishlist = async (req, res) => {
  try {
    const [items] = await db.query(
      `SELECT w.*, p.name, p.price, p.discount_price, p.product_images, p.slug 
       FROM wishlist w 
       JOIN products p ON w.product_id = p.id 
       WHERE w.user_id = ?`,
      [req.user.id],
    );
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addToWishlist = async (req, res) => {
  try {
    const { product_id, variant_id } = req.body;
    await db.query(
      "INSERT IGNORE INTO wishlist (user_id, product_id, variant_id) VALUES (?, ?, ?)",
      [req.user.id, product_id, variant_id],
    );
    res.json({ success: true, message: "Added to wishlist" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM wishlist WHERE id = ? AND user_id = ?", [
      id,
      req.user.id,
    ]);
    res.json({ success: true, message: "Removed from wishlist" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
