const db = require("../config/db");

const hasMissingUserIdColumn = (error) => {
  return (
    error &&
    error.code === "ER_BAD_FIELD_ERROR" &&
    String(error.message || "").includes("user_id")
  );
};

const hasMissingNotificationsTable = (error) => {
  return (
    error &&
    error.code === "ER_NO_SUCH_TABLE" &&
    String(error.message || "").includes("notifications")
  );
};

const hasMissingCreatedAtColumn = (error) => {
  return (
    error &&
    error.code === "ER_BAD_FIELD_ERROR" &&
    String(error.message || "").includes("created_at")
  );
};

const hasBadFieldError = (error) => {
  return error && error.code === "ER_BAD_FIELD_ERROR";
};

const getAllNotifications = async (req, res) => {
  try {
    const { type, is_read, priority, limit = 50 } = req.query;
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 200)
        : 50;

    let query = "SELECT * FROM notifications WHERE 1=1";
    const params = [];

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }
    if (is_read !== undefined) {
      query += " AND is_read = ?";
      params.push(is_read === "true" ? 1 : 0);
    }
    if (priority) {
      query += " AND priority = ?";
      params.push(priority);
    }

    query += ` ORDER BY created_at DESC LIMIT ${safeLimit}`;

    let notifications;
    try {
      [notifications] = await db.query(query, params);
    } catch (error) {
      if (hasMissingCreatedAtColumn(error)) {
        const fallbackQuery = query.replace(
          "ORDER BY created_at DESC",
          "ORDER BY id DESC",
        );
        [notifications] = await db.query(fallbackQuery, params);
      } else if (hasBadFieldError(error)) {
        [notifications] = await db.query(
          `SELECT * FROM notifications ORDER BY id DESC LIMIT ${safeLimit}`,
        );
      } else if (!hasMissingNotificationsTable(error)) throw error;
      else notifications = [];
    }
    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createNotification = async (req, res) => {
  try {
    const {
      user_id,
      type,
      title,
      message,
      link,
      priority = "medium",
    } = req.body;

    if (!type || !title || !message) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Type, title, and message are required",
        });
    }

    let result;
    try {
      [result] = await db.execute(
        "INSERT INTO notifications (user_id, type, title, message, link, priority) VALUES (?, ?, ?, ?, ?, ?)",
        [user_id || null, type, title, message, link || null, priority],
      );
    } catch (error) {
      if (!hasMissingUserIdColumn(error)) throw error;
      [result] = await db.execute(
        "INSERT INTO notifications (type, title, message, link, priority) VALUES (?, ?, ?, ?, ?)",
        [type, title, message, link || null, priority],
      );
    }

    res.status(201).json({ success: true, notificationId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    let result;
    try {
      [result] = await db.execute(
        "UPDATE notifications SET is_read = 1 WHERE id = ?",
        [id],
      );
    } catch (error) {
      if (!hasMissingNotificationsTable(error)) throw error;
      return res.json({
        success: true,
        message: "Notification table not found, nothing to update",
      });
    }

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    try {
      await db.execute(
        "UPDATE notifications SET is_read = 1 WHERE is_read = 0",
      );
    } catch (error) {
      if (!hasMissingNotificationsTable(error)) throw error;
      return res.json({
        success: true,
        message: "Notification table not found, nothing to update",
      });
    }
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    let result;
    try {
      [result] = await db.execute("DELETE FROM notifications WHERE id = ?", [
        id,
      ]);
    } catch (error) {
      if (!hasMissingNotificationsTable(error)) throw error;
      return res.json({
        success: true,
        message: "Notification table not found, nothing to delete",
      });
    }

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    let result;
    try {
      [result] = await db.execute(
        "SELECT COUNT(*) as count FROM notifications WHERE is_read = 0",
      );
    } catch (error) {
      if (!hasMissingNotificationsTable(error)) throw error;
      return res.json({ success: true, count: 0 });
    }
    res.json({ success: true, count: result[0].count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getNotificationStats = async (req, res) => {
  try {
    let total;
    let unread;
    let byType;
    let byPriority;

    try {
      [total] = await db.execute("SELECT COUNT(*) as count FROM notifications");
      [unread] = await db.execute(
        "SELECT COUNT(*) as count FROM notifications WHERE is_read = 0",
      );
      [byType] = await db.execute(
        "SELECT type, COUNT(*) as count FROM notifications GROUP BY type",
      );
      [byPriority] = await db.execute(
        "SELECT priority, COUNT(*) as count FROM notifications GROUP BY priority",
      );
    } catch (error) {
      if (hasBadFieldError(error)) {
        [total] = await db.execute(
          "SELECT COUNT(*) as count FROM notifications",
        );
        [unread] = await db.execute(
          "SELECT COUNT(*) as count FROM notifications WHERE is_read = 0",
        );
        byType = [];
        byPriority = [];
      } else if (!hasMissingNotificationsTable(error)) throw error;
      else {
        return res.json({
          success: true,
          stats: {
            total: 0,
            unread: 0,
            byType: [],
            byPriority: [],
          },
        });
      }
    }

    res.json({
      success: true,
      stats: {
        total: total[0].count,
        unread: unread[0].count,
        byType,
        byPriority,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// User-specific notification endpoints
const getUserNotifications = async (req, res) => {
  try {
    const rawUserId = req.user?.id;
    const userId = Number.isFinite(Number(rawUserId))
      ? Number(rawUserId)
      : null;
    if (userId === null) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid user context" });
    }
    const { limit = 50 } = req.query;
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;

    // Some MySQL setups are picky with LIMIT placeholders in prepared statements.
    // Build a sanitized numeric LIMIT and then try a fallback chain.
    const limitSql = Math.min(safeLimit, 200);
    const attempts = [];

    attempts.push({
      sql: `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ${limitSql}`,
      params: [userId],
    });
    attempts.push({
      sql: `SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ${limitSql}`,
      params: [userId],
    });

    let notifications = [];
    let lastError = null;
    for (const attempt of attempts) {
      try {
        const [rows] = await db.query(attempt.sql, attempt.params);
        notifications = rows;
        lastError = null;
        break;
      } catch (error) {
        if (hasMissingNotificationsTable(error)) {
          return res.json({ success: true, notifications: [] });
        }
        if (
          hasMissingUserIdColumn(error) ||
          hasMissingCreatedAtColumn(error) ||
          error.code === "ER_BAD_FIELD_ERROR"
        ) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    if (lastError) {
      return res
        .status(500)
        .json({ success: false, message: lastError.message });
    }

    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markUserNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    let result;
    try {
      [result] = await db.execute(
        "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
        [id, userId],
      );
    } catch (error) {
      if (hasMissingNotificationsTable(error)) {
        return res.json({
          success: true,
          message: "Notification table not found, nothing to update",
        });
      }
      if (!hasMissingUserIdColumn(error)) throw error;
      return res
        .status(500)
        .json({
          success: false,
          message: "Notifications migration required (missing user_id column)",
        });
    }

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markAllUserNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    try {
      await db.execute(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
        [userId],
      );
    } catch (error) {
      if (hasMissingNotificationsTable(error)) {
        return res.json({
          success: true,
          message: "Notification table not found, nothing to update",
        });
      }
      if (!hasMissingUserIdColumn(error)) throw error;
      return res
        .status(500)
        .json({
          success: false,
          message: "Notifications migration required (missing user_id column)",
        });
    }
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    let result;
    try {
      [result] = await db.execute(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
        [userId],
      );
    } catch (error) {
      if (hasMissingNotificationsTable(error)) {
        return res.json({ success: true, count: 0 });
      }
      if (!hasMissingUserIdColumn(error)) throw error;
      return res
        .status(500)
        .json({
          success: false,
          message: "Notifications migration required (missing user_id column)",
        });
    }
    res.json({ success: true, count: result[0].count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  getNotificationStats,
  getUserNotifications,
  markUserNotificationAsRead,
  markAllUserNotificationsAsRead,
  getUserUnreadCount,
};
