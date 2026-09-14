const db = require("../config/db");

class PayUTransaction {
  static async create(data) {
    const {
      payment_id,
      order_id,
      user_id,
      txnid,
      mihpayid = null,
      amount,
      currency = "INR",
      status = "pending",
      hash = null,
      mode = null,
      bank_ref_num = null,
      bankcode = null,
      error_Message = null,
      raw_response = null,
    } = data;

    const [result] = await db.execute(
      `INSERT INTO payu_transactions
        (payment_id, order_id, user_id, txnid, mihpayid, amount, currency, status, hash, mode, bank_ref_num, bankcode, error_message, raw_response)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payment_id,
        order_id,
        user_id,
        txnid,
        mihpayid,
        amount,
        currency,
        status,
        hash,
        mode,
        bank_ref_num,
        bankcode,
        error_Message,
        raw_response ? JSON.stringify(raw_response) : null,
      ],
    );

    return result.insertId;
  }

  static async findByTxnId(txnid) {
    const [rows] = await db.execute(
      "SELECT * FROM payu_transactions WHERE txnid = ? LIMIT 1",
      [txnid],
    );
    return rows[0] || null;
  }

  static async findByMihpayId(mihpayid) {
    const [rows] = await db.execute(
      "SELECT * FROM payu_transactions WHERE mihpayid = ? LIMIT 1",
      [mihpayid],
    );
    return rows[0] || null;
  }

  static async findByPaymentId(payment_id) {
    const [rows] = await db.execute(
      "SELECT * FROM payu_transactions WHERE payment_id = ? ORDER BY id DESC",
      [payment_id],
    );
    return rows;
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(
        typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : value,
      );
    }

    if (fields.length === 0) return;

    values.push(id);
    await db.execute(
      `UPDATE payu_transactions SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );
  }

  static async updateByTxnId(txnid, updates) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(
        typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : value,
      );
    }

    if (fields.length === 0) return;

    values.push(txnid);
    await db.execute(
      `UPDATE payu_transactions SET ${fields.join(", ")} WHERE txnid = ?`,
      values,
    );
  }
}

module.exports = PayUTransaction;