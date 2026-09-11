const db = require("../config/db");

class Transaction {
  static async create(transactionData) {
    const {
      payment_id,
      gateway,
      gateway_transaction_id,
      type,
      amount,
      currency = "INR",
      status,
      response_data,
    } = transactionData;

    const [result] = await db.execute(
      `INSERT INTO transactions 
       (payment_id, gateway, gateway_transaction_id, type, amount, currency, status, response_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payment_id,
        gateway,
        gateway_transaction_id,
        type,
        amount,
        currency,
        status,
        JSON.stringify(response_data),
      ],
    );

    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.execute("SELECT * FROM transactions WHERE id = ?", [
      id,
    ]);
    return rows[0];
  }

  static async findByPaymentId(paymentId) {
    const [rows] = await db.execute(
      "SELECT * FROM transactions WHERE payment_id = ? ORDER BY created_at DESC",
      [paymentId],
    );
    return rows;
  }

  static async findByGatewayTransactionId(gatewayTransactionId) {
    const [rows] = await db.execute(
      "SELECT * FROM transactions WHERE gateway_transaction_id = ?",
      [gatewayTransactionId],
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
    if (updates.response_data) {
      fields.push("response_data = ?");
      values.push(JSON.stringify(updates.response_data));
    }
    if (updates.error_message) {
      fields.push("error_message = ?");
      values.push(updates.error_message);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE transactions SET ${fields.join(", ")} WHERE id = ?`;
    await db.execute(query, values);
  }

  static async getTransactionStats() {
    const [rows] = await db.execute(
      `SELECT 
         COUNT(*) as total_transactions,
         COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
         SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END) as total_amount
       FROM transactions`,
    );
    return rows[0];
  }
}

module.exports = Transaction;
