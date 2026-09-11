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
