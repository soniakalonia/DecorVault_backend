const db = require("../config/db");

exports.createShipment = async (req, res) => {
  try {
    const {
      order_id,
      tracking_number,
      courier,
      tracking_url,
      estimated_delivery,
    } = req.body;

    const [result] = await db.execute(
      `INSERT INTO shipments (order_id, tracking_number, courier, tracking_url, estimated_delivery, status) 
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [order_id, tracking_number, courier, tracking_url, estimated_delivery],
    );

    await db.execute(
      "UPDATE orders SET status = ?, shipped_at = NOW() WHERE id = ?",
      ["shipped", order_id],
    );

    res.status(201).json({ success: true, shipmentId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateShipmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, location, description } = req.body;

    await db.execute("UPDATE shipments SET status = ? WHERE id = ?", [
      status,
      id,
    ]);

    await db.execute(
      "INSERT INTO shipment_history (shipment_id, status, location, description, timestamp) VALUES (?, ?, ?, ?, NOW())",
      [id, status, location, description],
    );

    if (status === "delivered") {
      const [shipment] = await db.execute(
        "SELECT order_id FROM shipments WHERE id = ?",
        [id],
      );
      await db.execute(
        "UPDATE orders SET status = ?, delivered_at = NOW() WHERE id = ?",
        ["delivered", shipment[0].order_id],
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrderShipment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const [shipments] = await db.execute(
      "SELECT * FROM shipments WHERE order_id = ?",
      [orderId],
    );

    if (shipments.length > 0) {
      const [history] = await db.execute(
        "SELECT * FROM shipment_history WHERE shipment_id = ? ORDER BY timestamp DESC",
        [shipments[0].id],
      );
      shipments[0].history = history;
    }

    res.json({ success: true, shipment: shipments[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
