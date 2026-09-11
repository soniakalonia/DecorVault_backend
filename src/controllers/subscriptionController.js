const db = require("../config/db");

// Create subscription
const createSubscription = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if email already exists
    const [existing] = await db.execute(
      "SELECT * FROM subscriptions WHERE email = ?",
      [email],
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already subscribed" });
    }

    const [result] = await db.execute(
      "INSERT INTO subscriptions (email) VALUES (?)",
      [email],
    );

    res.status(201).json({
      message: "Subscribed successfully",
      subscription: { id: result.insertId, email, status: "active" },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating subscription", error: error.message });
  }
};

// Get all subscriptions
const getAllSubscriptions = async (req, res) => {
  try {
    const [subscriptions] = await db.execute(
      "SELECT * FROM subscriptions ORDER BY created_at DESC",
    );
    res.json({ subscriptions });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching subscriptions", error: error.message });
  }
};

// Delete subscription
const deleteSubscription = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute(
      "DELETE FROM subscriptions WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    res.json({ message: "Subscription deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting subscription", error: error.message });
  }
};

module.exports = {
  createSubscription,
  getAllSubscriptions,
  deleteSubscription,
};
