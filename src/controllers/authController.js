const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const emailService = require("../utils/emailService");

// Register User
exports.register = async (req, res) => {
  try {
    const { fullName, email, mobile, password } = req.body;

    // Validation basic
    if (!fullName || !email || !mobile || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if user exists
    const [existingUsers] = await db.query(
      "SELECT * FROM users WHERE email = ? OR mobile = ?",
      [email, mobile],
    );

    if (existingUsers.length > 0) {
      return res
        .status(400)
        .json({ message: "User with this email or mobile already exists" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user with OTP
    const [result] = await db.query(
      "INSERT INTO users (full_name, email, mobile, password, otp, otp_expiry) VALUES (?, ?, ?, ?, ?, ?)",
      [fullName, email, mobile, hashedPassword, otp, otpExpiry],
    );

    // Send OTP via email
    try {
      await emailService.sendOTP(email, otp);
    } catch (mailError) {
      console.error("Error sending email:", mailError);
    }

    res.status(201).json({
      message: "User registered successfully. Please check your email for OTP.",
      userId: result.insertId,
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { emailOrMobile, otp } = req.body;

    if (!emailOrMobile || !otp) {
      return res
        .status(400)
        .json({ message: "Email/Mobile and OTP are required" });
    }

    const [users] = await db.query(
      "SELECT * FROM users WHERE (email = ? OR mobile = ?) AND otp = ?",
      [emailOrMobile, emailOrMobile, otp],
    );

    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const user = users[0];

    // Check if OTP is expired
    if (new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Mark as verified and clear OTP
    await db.query(
      "UPDATE users SET is_verified = TRUE, otp = NULL, otp_expiry = NULL WHERE id = ?",
      [user.id],
    );

    // Generate Token
    const payload = { user: { id: user.id, role: user.role } };
    const token = jwt.sign(payload, process.env.JWT_SECRET || "secret", {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Email verified successfully",
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
  try {
    const { emailOrMobile } = req.body;

    if (!emailOrMobile) {
      return res.status(400).json({ message: "Email or Mobile is required" });
    }

    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ? OR mobile = ?",
      [emailOrMobile, emailOrMobile],
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Update DB
    await db.query("UPDATE users SET otp = ?, otp_expiry = ? WHERE id = ?", [
      otp,
      otpExpiry,
      user.id,
    ]);

    // Send via email (if it's an email)
    if (user.email.includes("@")) {
      try {
        await emailService.sendOTP(user.email, otp);
      } catch (mailError) {
        console.error("Error resending email:", mailError);
      }
    }

    res.status(200).json({ message: "OTP resent successfully" });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Login User
exports.login = async (req, res) => {
  try {
    const { emailOrMobile, password } = req.body;

    if (!emailOrMobile || !password) {
      return res
        .status(400)
        .json({ message: "Please provide email/mobile and password" });
    }

    // Find user
    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ? OR mobile = ?",
      [emailOrMobile, emailOrMobile],
    );

    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = users[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate Token
    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || "secret", {
      expiresIn: "7d",
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get User Profile (Protected Route)
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await db.query(
      "SELECT id, full_name, email, mobile, role, is_verified, created_at FROM users WHERE id = ?",
      [userId],
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update User Role (Admin Only)
exports.updateUserRole = async (req, res) => {
  try {
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ message: "User ID and role are required" });
    }

    if (!["user", "admin"].includes(role)) {
      return res
        .status(400)
        .json({ message: 'Invalid role. Must be "user" or "admin"' });
    }

    // Check if user exists
    const [users] = await db.query("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update role
    await db.query("UPDATE users SET role = ? WHERE id = ?", [role, userId]);

    res.json({
      message: "User role updated successfully",
      user: {
        id: userId,
        role: role,
      },
    });
  } catch (error) {
    console.error("Update Role Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get All Users (Admin Only)
exports.getAllUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, full_name, email, mobile, role, is_verified, created_at FROM users ORDER BY created_at DESC",
    );

    res.json({ users });
  } catch (error) {
    console.error("Get All Users Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  try {
    const { emailOrMobile } = req.body;

    if (!emailOrMobile) {
      return res.status(400).json({ message: "Email or Mobile is required" });
    }

    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ? OR mobile = ?",
      [emailOrMobile, emailOrMobile],
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await db.query("UPDATE users SET otp = ?, otp_expiry = ? WHERE id = ?", [
      otp,
      otpExpiry,
      user.id,
    ]);

    if (user.email.includes("@")) {
      await emailService.sendPasswordResetOTP(user.email, otp);
    }

    res.json({ message: "Reset OTP sent to your registered email/mobile" });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { emailOrMobile, otp, newPassword } = req.body;

    if (!emailOrMobile || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const [users] = await db.query(
      "SELECT * FROM users WHERE (email = ? OR mobile = ?) AND otp = ?",
      [emailOrMobile, emailOrMobile, otp],
    );

    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const user = users[0];

    if (new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.query(
      "UPDATE users SET password = ?, otp = NULL, otp_expiry = NULL WHERE id = ?",
      [hashedPassword, user.id],
    );

    res.json({
      message:
        "Password reset successful. Please login with your new password.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Send Login OTP
exports.sendLoginOTP = async (req, res) => {
  try {
    const { emailOrMobile } = req.body;

    if (!emailOrMobile) {
      return res.status(400).json({ message: "Email or Mobile is required" });
    }

    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ? OR mobile = ?",
      [emailOrMobile, emailOrMobile],
    );

    if (users.length === 0) {
      return res
        .status(404)
        .json({ message: "User not found. Please register first." });
    }

    const user = users[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await db.query("UPDATE users SET otp = ?, otp_expiry = ? WHERE id = ?", [
      otp,
      otpExpiry,
      user.id,
    ]);

    if (user.email.includes("@")) {
      await emailService.sendLoginOTP(user.email, otp);
    }

    res.json({ message: "Login OTP sent successfully" });
  } catch (error) {
    console.error("Send Login OTP Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Verify Login OTP
exports.verifyLoginOTP = async (req, res) => {
  try {
    const { emailOrMobile, otp } = req.body;

    if (!emailOrMobile || !otp) {
      return res
        .status(400)
        .json({ message: "Email/Mobile and OTP are required" });
    }

    const [users] = await db.query(
      "SELECT * FROM users WHERE (email = ? OR mobile = ?) AND otp = ?",
      [emailOrMobile, emailOrMobile, otp],
    );

    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const user = users[0];

    if (new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    await db.query(
      "UPDATE users SET is_verified = TRUE, otp = NULL, otp_expiry = NULL WHERE id = ?",
      [user.id],
    );

    const payload = { user: { id: user.id, role: user.role } };
    const token = jwt.sign(payload, process.env.JWT_SECRET || "secret", {
      expiresIn: "7d",
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Verify Login OTP Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update User Profile (Protected Route) - Works for BOTH Admin & User
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, email, mobile, dateOfBirth } = req.body;

    // Check if user exists
    const [users] = await db.query("SELECT * FROM users WHERE id = ?", [
      userId,
    ]);
    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if email is already taken by another user
    if (email) {
      const [existingUsers] = await db.query(
        "SELECT * FROM users WHERE email = ? AND id != ?",
        [email, userId],
      );
      if (existingUsers.length > 0) {
        return res
          .status(400)
          .json({ message: "Email already in use by another account" });
      }
    }

    // Check if mobile is already taken by another user
    if (mobile) {
      const [existingUsers] = await db.query(
        "SELECT * FROM users WHERE mobile = ? AND id != ?",
        [mobile, userId],
      );
      if (existingUsers.length > 0) {
        return res
          .status(400)
          .json({ message: "Mobile number already in use by another account" });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (fullName) {
      updates.push("full_name = ?");
      values.push(fullName);
    }
    if (email) {
      updates.push("email = ?");
      values.push(email);
    }
    if (mobile) {
      updates.push("mobile = ?");
      values.push(mobile);
    }
    if (dateOfBirth) {
      updates.push("date_of_birth = ?");
      values.push(dateOfBirth);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    values.push(userId);
    await db.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values,
    );

    // Get updated user
    const [updatedUser] = await db.query(
      "SELECT id, full_name, email, mobile, is_verified, created_at FROM users WHERE id = ?",
      [userId],
    );

    res.json({
      message: "Profile updated successfully",
      user: updatedUser[0],
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
