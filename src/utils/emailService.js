const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.sendOTP = async (email, otp) => {
  const mailOptions = {
    from: `"Decor Vault" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Verification Code - Decor Vault",
    text: `Your OTP for registration is: ${otp}. It is valid for 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333; text-align: center;">Decor Vault</h2>
        <p>Hello,</p>
        <p>Your one-time password (OTP) for completing your registration is:</p>
        <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
          ${otp}
        </div>
        <p>This code is valid for 10 minutes. Please do not share this OTP with anyone.</p>
        <p>If you did not request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">&copy; 2026 Decor Vault. All rights reserved.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

exports.sendPasswordResetOTP = async (email, otp) => {
  const mailOptions = {
    from: `"Decor Vault" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Password Reset Code - Decor Vault",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password. Use the code below to proceed:</p>
        <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
          ${otp}
        </div>
        <p>This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">&copy; 2026 Decor Vault. All rights reserved.</p>
      </div>
    `,
  };
  return transporter.sendMail(mailOptions);
};

exports.sendLoginOTP = async (email, otp) => {
  const mailOptions = {
    from: `"Decor Vault" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Login Verification Code - Decor Vault",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333; text-align: center;">Secure Login</h2>
        <p>Hello,</p>
        <p>Your one-time password (OTP) for logging into Decor Vault is:</p>
        <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
          ${otp}
        </div>
        <p>This code is valid for 10 minutes. Please do not share this OTP with anyone.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">&copy; 2026 Decor Vault. All rights reserved.</p>
      </div>
    `,
  };
  return transporter.sendMail(mailOptions);
};
// ==================== CONTACT FORM EMAIL ====================
exports.sendContactFormEmail = async ({ name, email, phone, subject, message }) => {
  const subjectLabels = {
    general: "General Inquiry",
    bulk: "Bulk Order / Wholesale",
    support: "Order Support",
    feedback: "Feedback",
    collaboration: "Collaboration / Partnership",
  };

  const readableSubject = subjectLabels[subject] || subject;

  const mailOptions = {
    from: `"Decor Vault Contact" <${process.env.EMAIL_USER}>`,
    to: process.env.CONTACT_RECEIVER_EMAIL || process.env.EMAIL_USER,
    replyTo: email, // So you can reply directly to the customer
    subject: `📩 New Contact Inquiry: ${readableSubject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #D4AF37; text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">
          New Contact Form Submission
        </h2>

        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 10px; background: #f9f9f9; font-weight: bold; width: 130px;">Name</td>
            <td style="padding: 10px;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 10px; background: #f9f9f9; font-weight: bold;">Email</td>
            <td style="padding: 10px;"><a href="mailto:${email}">${email}</a></td>
          </tr>
          <tr>
            <td style="padding: 10px; background: #f9f9f9; font-weight: bold;">Phone</td>
            <td style="padding: 10px;">${phone || "Not provided"}</td>
          </tr>
          <tr>
            <td style="padding: 10px; background: #f9f9f9; font-weight: bold;">Subject</td>
            <td style="padding: 10px;">${readableSubject}</td>
          </tr>
        </table>

        <div style="margin-top: 20px;">
          <h3 style="color: #333;">Message:</h3>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; white-space: pre-wrap;">${message}</div>
        </div>

        <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">
          Received on ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}<br>
          &copy; 2026 Decor Vault. All rights reserved.
        </p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

// Optional: send a confirmation email to the customer
exports.sendContactConfirmationToUser = async ({ name, email }) => {
  const mailOptions = {
    from: `"Decor Vault" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "We've received your message - Decor Vault",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #D4AF37; text-align: center;">Thank You, ${name}!</h2>
        <p>We've received your message and our team will get back to you within 24 hours.</p>
        <p>In the meantime, feel free to explore our latest collections on our website.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">&copy; 2026 Decor Vault. All rights reserved.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};
// ==================== INVOICE EMAIL ====================
exports.sendInvoiceEmail = async ({
  to,
  customerName,
  orderNumber,
  orderId,
  pdfBuffer,
}) => {
  const companyName = process.env.COMPANY_NAME || "Our Store";
  const companyEmail = process.env.COMPANY_EMAIL || process.env.EMAIL_USER;
  const companyPhone = process.env.COMPANY_PHONE || "";
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  const mailOptions = {
    from: `"${companyName}" <${process.env.EMAIL_USER}>`,
    to,
    subject: `🧾 Invoice for Order ${orderNumber} - ${companyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #D4AF37; text-align: center; margin-bottom: 0;">${companyName}</h2>
        <p style="text-align: center; color: #888; font-size: 12px; margin-top: 4px;">Thank you for your order!</p>

        <p style="margin-top: 24px;">Hi ${customerName || "Customer"},</p>

        <p>Your order <strong>#${orderNumber}</strong> has been successfully placed. Please find your invoice attached to this email.</p>

        <div style="background: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 13px; color: #555;">Order ID</p>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: bold; color: #1A1A2E;">${orderNumber}</p>
        </div>

        <p>You can also view and download your invoice anytime from your account:</p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${frontendUrl}/user-dashboard/orders"
             style="background: #D4AF37; color: #1A1A2E; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            View My Orders
          </a>
        </div>

        <p style="font-size: 13px; color: #777;">If you have any questions, reach us at <a href="mailto:${companyEmail}">${companyEmail}</a>${companyPhone ? ` or call ${companyPhone}` : ""}.</p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">
          &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.
        </p>
      </div>
    `,
    attachments: [
      {
        filename: `Invoice-${orderNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };

  return transporter.sendMail(mailOptions);
};