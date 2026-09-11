const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "mysql",
  password: process.env.DB_PASSWORD || "12345",
  database: process.env.DB_NAME || "decorvault",
});

async function seedAdmin() {
  try {
    console.log("🌱 Starting database seed...");

    const [existingUsers] = await db.query(
      "SELECT id, email, role FROM users WHERE email = ?",
      ["admin@gmail.com"],
    );

    if (existingUsers.length > 0) {
      const existingAdmin = existingUsers[0];

      if (existingAdmin.role !== "admin") {
        await db.query(
          "UPDATE users SET role = ?, is_verified = TRUE WHERE id = ?",
          ["admin", existingAdmin.id],
        );

        console.log("✅ Existing user promoted to admin.");
      } else {
        console.log("ℹ️ Admin already exists. No changes made.");
      }

      return;
    }

    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    await db.query(
      `INSERT INTO users
            (full_name, email, mobile, password, role, is_verified)
            VALUES (?, ?, ?, ?, ?, ?)`,
      ["Admin", "admin@gmail.com", "9999999999", hashedPassword, "admin", true],
    );
  } catch (error) {
    console.error("❌ Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

seedAdmin();
