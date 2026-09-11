const db = require("../config/db");

class Payment {
  static async create(paymentData) {
    const {
      order_id,
      user_id,
      gateway,
      amount,
      currency = "INR",
      payment_method,
      gateway_order_id,
      status = "pending",
    } = paymentData;

    const [result] = await db.execute(
      `INSERT INTO payments 
       (order_id, user_id, gateway, amount, currency, payment_method, gateway_order_id, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order_id,
        user_id,
        gateway,
        amount,
        currency,
        payment_method,
        gateway_order_id,
        status,
      ],
    );

    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.execute("SELECT * FROM payments WHERE id = ?", [
      id,
    ]);
    return rows[0];
  }

  static async findByOrderId(orderId) {
    const [rows] = await db.execute(
      "SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC",
      [orderId],
    );
    return rows;
  }

  static async findByGatewayOrderId(gatewayOrderId) {
    const [rows] = await db.execute(
      "SELECT * FROM payments WHERE gateway_order_id = ?",
      [gatewayOrderId],
    );
    return rows[0];
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];

    if (updates.status) {
      fields.push("status = ?");
      values.push(updates.status);
    }
    if (updates.gateway_payment_id) {
      fields.push("gateway_payment_id = ?");
      values.push(updates.gateway_payment_id);
    }
    if (updates.gateway_signature) {
      fields.push("gateway_signature = ?");
      values.push(updates.gateway_signature);
    }
    if (updates.gateway_response) {
      fields.push("gateway_response = ?");
      values.push(JSON.stringify(updates.gateway_response));
    }
    if (updates.status === "paid") {
      fields.push("paid_at = NOW()");
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE payments SET ${fields.join(", ")} WHERE id = ?`;
    await db.execute(query, values);
  }

  static async findByUserId(userId) {
    const [rows] = await db.execute(
      `SELECT p.*, o.order_number, o.total as order_total 
       FROM payments p 
       LEFT JOIN orders o ON p.order_id = o.id 
       WHERE p.user_id = ? 
       ORDER BY p.created_at DESC`,
      [userId],
    );
    return rows;
  }

  static async getPaymentStats() {
    const [rows] = await db.execute(
      `SELECT 
         COUNT(*) as total_payments,
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_revenue,
         COUNT(CASE WHEN status = 'paid' THEN 1 END) as successful_payments,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
         AVG(CASE WHEN status = 'paid' THEN amount ELSE NULL END) as avg_payment_amount
       FROM payments`,
    );
    return rows[0];
  }
}

module.exports = Payment;
