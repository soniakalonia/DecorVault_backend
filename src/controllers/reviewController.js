const db = require("../config/db");

exports.createReview = async (req, res) => {
  try {
    const { product_id, rating, title, comment, images } = req.body;
    const user_id = req.user?.id || null;

    if (!product_id || !rating || !comment) {
      return res
        .status(400)
        .json({ message: "Product ID, rating, and comment are required" });
    }

    const [settings] = await db.query(
      "SELECT value FROM settings WHERE `key` = 'review_auto_approve'",
    );
    const autoApprove = settings[0]?.value === "true";
    const status = autoApprove ? "approved" : "pending";

    const [result] = await db.query(
      "INSERT INTO reviews (product_id, user_id, rating, title, comment, images, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        product_id,
        user_id,
        rating,
        title || null,
        comment,
        images ? JSON.stringify(images) : null,
        status,
      ],
    );

    res
      .status(201)
      .json({
        message: "Review created successfully",
        reviewId: result.insertId,
        status,
      });
  } catch (error) {
    console.error("Error creating review:", error);
    res
      .status(500)
      .json({ message: "Failed to create review", error: error.message });
  }
};

exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    const [reviews] = await db.query(
      `SELECT r.*, u.full_name as user_name 
       FROM reviews r 
       LEFT JOIN users u ON r.user_id = u.id 
       WHERE r.product_id = ? AND r.status = 'approved'
       ORDER BY r.created_at DESC`,
      [productId],
    );

    res.json({ data: reviews });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
};

exports.getUserReviews = async (req, res) => {
  try {
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const [reviews] = await db.query(
      `SELECT r.*, p.name as product_name, p.images as product_image
       FROM reviews r 
       LEFT JOIN products p ON r.product_id = p.id 
       WHERE r.user_id = ? 
       ORDER BY r.created_at DESC`,
      [user_id],
    );

    res.json(reviews);
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
};
