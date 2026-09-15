const db = require("../config/db");
const {
  sendContactFormEmail,
  sendContactConfirmationToUser,
} = require("../utils/emailService");

// Submit contact form
exports.submitContactForm = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, subject, and message are required",
      });
    }

    // Check if table exists, if not create it
    const [tableCheck] = await db.execute(
      'SHOW TABLES LIKE "contact_inquiries"',
    );

    if (tableCheck.length === 0) {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS contact_inquiries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(20) DEFAULT NULL,
          subject VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          status ENUM('pending', 'read', 'replied') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    }

    // Insert into database
    const query = `
      INSERT INTO contact_inquiries (name, email, phone, subject, message, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(query, [
      name,
      email,
      phone || "",
      subject,
      message,
      "pending",
    ]);

    // 📧 Send email to admin (non-blocking — failure won't break the request)
    try {
      await sendContactFormEmail({ name, email, phone, subject, message });
      console.log("✅ Contact email sent to admin");
    } catch (emailError) {
      console.error("⚠️ Failed to send admin email:", emailError.message);
    }

    // 📧 Send confirmation to the user
    try {
      await sendContactConfirmationToUser({ name, email });
      console.log("✅ Confirmation email sent to user");
    } catch (emailError) {
      console.error("⚠️ Failed to send user confirmation:", emailError.message);
    }

    // ✅ SINGLE response
    return res.status(201).json({
      success: true,
      message:
        "Your message has been sent successfully. We will get back to you soon.",
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error("❌ Error processing contact form:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send message. Please try again.",
      error: error.message,
    });
  }
};

// Get all contacts (Admin)
exports.getAllContacts = async (req, res) => {
  try {
    // Check if table exists
    const [tableCheck] = await db.execute(
      'SHOW TABLES LIKE "contact_inquiries"',
    );

    if (tableCheck.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: "No inquiries found",
      });
    }

    const [rows] = await db.execute(
      "SELECT * FROM contact_inquiries ORDER BY created_at DESC",
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching inquiries:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inquiries",
      error: error.message,
    });
  }
};

// Get single contact by ID
exports.getContactById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.execute(
      "SELECT * FROM contact_inquiries WHERE id = ?",
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("Error fetching contact:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact",
      error: error.message,
    });
  }
};

// Update contact status
exports.updateContactStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["pending", "read", "replied"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be pending, read, or replied",
      });
    }

    const [result] = await db.execute(
      "UPDATE contact_inquiries SET status = ? WHERE id = ?",
      [status, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    res.json({
      success: true,
      message: "Contact status updated successfully",
    });
  } catch (error) {
    console.error("Error updating contact:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update contact",
      error: error.message,
    });
  }
};

// Delete contact
exports.deleteContact = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute(
      "DELETE FROM contact_inquiries WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    res.json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete contact",
      error: error.message,
    });
  }
};