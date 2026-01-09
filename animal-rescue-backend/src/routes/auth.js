// src/routes/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const auth = require("../middleware/auth");
const { sendOtpEmail } = require("../lib/email");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "change_this";
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// ---------------------------------------------------------
// OTP HELPERS (In-Memory for Dev / Email Production)
// ---------------------------------------------------------
const localOtpStore = new Map(); // Key: email, Value: { otp, expiresAt }
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function genOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function otpSend(email) {
  const code = genOtp();
  const expiresAt = Date.now() + OTP_TTL_MS;
  localOtpStore.set(email, { otp: code, expiresAt });

  // Auto-cleanup
  setTimeout(() => {
    const e = localOtpStore.get(email);
    if (e && e.expiresAt <= Date.now()) localOtpStore.delete(email);
  }, OTP_TTL_MS + 2000);

  // Send via Email (Nodemailer)
  try {
    await sendOtpEmail(email, code);
  } catch (err) {
    console.error("Failed to send email via nodemailer:", err);
    // Fallback log for dev if email fails (or if creds missing)
    console.log(`[DEV OTP FALLBACK] email=${email} code=${code}`);
  }
  return code;
}

function otpValidate(email, code) {
  const it = localOtpStore.get(email);
  if (!it) return false;
  
  if (Date.now() > it.expiresAt) {
    localOtpStore.delete(email);
    return false;
  }
  
  if (String(it.otp) !== String(code)) return false;
  
  localOtpStore.delete(email);
  return true;
}

// Helper: return only public user fields
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    favourite_animal: u.favourite_animal || null,
    avatar: u.avatar || null,
    reputation: u.reputation || 0,
    created_at: u.created_at,
    email_verified: u.email_verified
  };
}

// ------------------------
// POST /auth/request-otp
// Expects: { email }
// ------------------------
router.post("/request-otp", async (req, res) => {
  const { email } = req.body;
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  try {
    await otpSend(email);
    return res.json({
      ok: true,
      message: "OTP sent to your email. Please check your inbox (and spam).",
    });
  } catch (err) {
    console.error("request-otp send error", err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
});

// ------------------------
// POST /auth/verify-otp
// Expects: { email, code }
// ------------------------
router.post("/verify-otp", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "email and code required" });

  try {
    const ok = otpValidate(email, code);
    if (!ok) return res.status(400).json({ error: "INVALID_OR_EXPIRED_OTP" });

    // Find user by email
    const { rows } = await db.query("SELECT * FROM users WHERE email = $1 LIMIT 1", [email]);
    if (!rows.length) return res.status(404).json({ error: "user_not_found" });

    const user = rows[0];

    // Mark email verified
    try {
      await db.query("UPDATE users SET email_verified = true WHERE id = $1", [user.id]);
      user.email_verified = true; // update local object
    } catch (e) {
      console.warn("Could not update email_verified:", e);
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("verify-otp error", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ------------------------
// POST /auth/register
// ------------------------
router.post("/register", async (req, res) => {
  try {
    const {
      username,
      password,
      email,        // Now Required
      phone,        // Optional now
      full_name,
      gender,
      age,
      favourite_animal,
      reason,
      avatar,
    } = req.body;

    const parsedAge = age ? parseInt(age, 10) : null;

    if (!username || !password || !email) {
        return res.status(400).json({ error: "username, password and email required" });
    }
    if (!validator.isAlphanumeric(username.replace(/[_-]/g, ""))) {
      return res.status(400).json({ error: "username invalid (alphanumeric only)" });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: "invalid email format" });
    }

    // Check uniqueness
    const u1 = await db.query("SELECT id FROM users WHERE username = $1 LIMIT 1", [username]);
    if (u1.rows.length) return res.status(400).json({ error: "username_taken" });

    const u2 = await db.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
    if (u2.rows.length) return res.status(400).json({ error: "email_already_registered" });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const insertSql = `
      INSERT INTO users
      (username, email, phone, full_name, gender, age, favourite_animal, reason, avatar, password_hash, email_verified)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, FALSE)
      RETURNING id, username, email, phone, avatar, favourite_animal, created_at, kyc_submitted, reputation, email_verified
    `;

    const { rows } = await db.query(insertSql, [
      username,
      email,
      phone || null,
      full_name || null,
      gender || null,
      parsedAge,
      favourite_animal || null,
      reason || null,
      avatar || null,
      hashed,
    ]);

    const user = rows[0];

    // Auto-send OTP to Email
    try {
      await otpSend(email);
    } catch (e) {
      console.warn("Failed to send OTP after register:", e);
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    // needs_verification flag tells frontend to go to Verify Email page
    return res.status(201).json({ token, user: publicUser(user), needs_verification: true });

  } catch (err) {
    console.error("register error", err);
    return res.status(500).json({ error: err.message || "server_error" });
  }
});

// ------------------------
// POST /auth/login
// Accepts usernameOrEmail (or phone)
// ------------------------
router.post("/login", async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  
  // Backwards compatibility: if frontend sends usernameOrPhoneOrEmail, verify that too
  const identifier = usernameOrEmail || req.body.usernameOrPhoneOrEmail;

  if (!identifier || !password) {
    return res.status(400).json({ error: "username/email and password required" });
  }

  try {
    // We still allow phone login if desired, but prioritize email/username
    const { rows } = await db.query(
      `SELECT * FROM users WHERE username = $1 OR email = $1 OR phone = $1 LIMIT 1`,
      [identifier]
    );

    if (!rows.length) return res.status(400).json({ error: "invalid_credentials" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash || "");

    if (!ok) return res.status(400).json({ error: "invalid_credentials" });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("login error", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /auth/me - Get current user details
router.get("/me", auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT id, username, email, phone, full_name, gender, age, favourite_animal, reason, avatar, email_verified FROM users WHERE id = $1",
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// PUT /auth/me - Update user details
router.put("/me", auth, async (req, res) => {
  const { full_name, gender, age, phone, email, favourite_animal, reason, avatar } = req.body;
  try {
    // Note: If updating email, we might want to reset email_verified to false, 
    // but for simplicity we'll just allow update.
    await db.query(
      `UPDATE users 
       SET full_name=$1, gender=$2, age=$3, phone=$4, email=$5, favourite_animal=$6, reason=$7, avatar=$8
       WHERE id=$9`,
      [full_name, gender, age, phone, email, favourite_animal, reason, avatar, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

module.exports = router;
