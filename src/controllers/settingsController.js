const db = require("../config/db");

exports.getAllSettings = async (req, res) => {
  try {
    const [settings] = await db.execute(
      "SELECT * FROM settings ORDER BY `group`, `key`",
    );
    const grouped = settings.reduce((acc, setting) => {
      if (!acc[setting.group]) acc[setting.group] = {};
      acc[setting.group][setting.key] = setting.value;
      return acc;
    }, {});
    res.json({ success: true, settings: grouped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSetting = async (req, res) => {
  try {
    const { key, value } = req.body;
    await db.execute("UPDATE settings SET value = ? WHERE `key` = ?", [
      value,
      key,
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const [rows] = await db.execute(
      "SELECT value, type FROM settings WHERE `key` = ?",
      [key],
    );
    if (rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Setting not found" });
    res.json({ success: true, value: rows[0].value, type: rows[0].type });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
