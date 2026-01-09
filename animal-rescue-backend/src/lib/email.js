// src/lib/email.js
const nodemailer = require("nodemailer");

// Create a transporter using Gmail service
// Requires EMAIL_USER and EMAIL_PASS in .env
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOtpEmail(toEmail, otp) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("Skipping Email Send: EMAIL_USER or EMAIL_PASS not set in .env");
    console.log(`[DEV MODE] OTP for ${toEmail}: ${otp}`);
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: "Animal Rescue - Verification Code",
    text: `Your verification code is: ${otp}\n\nThis code will expire in 5 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #333;">Animal Rescue Verification</h2>
        <p>Please use the following OTP to verify your account:</p>
        <h1 style="color: #d32f2f; letter-spacing: 5px;">${otp}</h1>
        <p style="font-size: 0.9em; color: #555;">This code expires in 5 minutes.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    // Determine if we should throw or just log. For OTP, we should probably fail.
    throw new Error("Failed to send email.");
  }
}

module.exports = { sendOtpEmail };
