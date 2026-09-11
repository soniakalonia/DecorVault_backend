const db = require("../config/db");

class WebhookLog {
  static async create(logData) {
    const {
      gateway,
      event_type,
      payload,
      status,
      signature_valid,
      error_message,
      ip_address,
      user_agent,
    } = logData;

    const [result] = await db.execute(
      `INSERT INTO webhook_logs 
       (gateway, event_type, payload, status, signature_valid, error_message, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gateway,
        event_type,
        JSON.stringify(payload),
        status,
        signature_valid,
        error_message,
        ip_address,
        user_agent,
      ],
    );

    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.execute("SELECT * FROM webhook_logs WHERE id = ?", [
      id,
    ]);
    return rows[0];
  }

  static async findByGateway(gateway, limit = 50) {
    const [rows] = await db.execute(
      "SELECT * FROM webhook_logs WHERE gateway = ? ORDER BY created_at DESC LIMIT ?",
      [gateway, limit],
    );
    return rows;
  }

  static async getRecent(limit = 100) {
    const [rows] = await db.execute(
      "SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT ?",
      [limit],
    );
    return rows;
  }

  static async getStats() {
    const [rows] = await db.execute(
      `SELECT 
         COUNT(*) as total_webhooks,
         SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
         SUM(CASE WHEN signature_valid = 1 THEN 1 ELSE 0 END) as valid_signatures,
         SUM(CASE WHEN signature_valid = 0 THEN 1 ELSE 0 END) as invalid_signatures,
         COUNT(DISTINCT event_type) as unique_events
       FROM webhook_logs`,
    );
    return rows[0];
  }
}

module.exports = WebhookLog;
