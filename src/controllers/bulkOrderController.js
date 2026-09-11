const db = require("../config/db");

exports.getBulkOrders = async (req, res) => {
  try {
    const query = `
      SELECT id, name, email, phone, message, product_name, status, created_at
      FROM bulk_orders
      ORDER BY created_at DESC
    `;

    const [rows] = await db.execute(query);

    res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching bulk orders:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.createBulkOrder = async (req, res) => {
  try {
    const { name, email, number, message, productName } = req.body;

    if (!name || !email || !number || !productName) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone number, and product name are required",
      });
    }

    const query = `
      INSERT INTO bulk_orders (name, email, phone, message, product_name)
      VALUES (?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(query, [
      name,
      email,
      number,
      message || "",
      productName,
    ]);

    res.status(201).json({
      success: true,
      message: "Bulk order request submitted successfully",
      data: {
        id: result.insertId,
        name,
        email,
        phone: number,
        message,
        productName,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("Error processing bulk order:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.updateBulkOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const query = "UPDATE bulk_orders SET status = ? WHERE id = ?";
    await db.execute(query, [status, id]);

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
    });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
