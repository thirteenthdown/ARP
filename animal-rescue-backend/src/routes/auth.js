// src/routes/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const crypto = require("crypto");
const Twilio = require("twilio");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "change_this";
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Optional Twilio client (only if env vars present)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = Twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

// Try to use lib/otp if present. If not present, fallback to local dev OTP store.
let otpLib = null;
try {
  otpLib = require("../lib/otp");
} catch (e) {
  otpLib = null;
}

// Local fallback OTP store & helpers (dev-only)
const localOtpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
function genOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
async function sendOtpDev(phone) {
  const code = genOtp();
  const expiresAt = Date.now() + OTP_TTL_MS;
  localOtpStore.set(phone, { otp: code, expiresAt });
  // auto-cleanup
  setTimeout(() => {
    const e = localOtpStore.get(phone);
    if (e && e.expiresAt <= Date.now()) localOtpStore.delete(phone);
  }, OTP_TTL_MS + 2000);
  console.log(`[DEV OTP] phone=${phone} code=${code} (expires in 5m)`);
  return code;
}
function validateOtpDev(phone, code) {
  const it = localOtpStore.get(phone);
  if (!it) return false;
  if (Date.now() > it.expiresAt) {
    localOtpStore.delete(phone);
    return false;
  }
  if (String(it.otp) !== String(code)) return false;
  localOtpStore.delete(phone);
  return true;
}

// Wrap OTP helpers so code can use otpSend/otpValidate independent of implementation
async function otpSend(phone) {
  if (otpLib && typeof otpLib.sendOtpToPhone === "function") {
    return otpLib.sendOtpToPhone(phone);
  }
  // Twilio path if configured and lib not provided
  if (twilioClient && process.env.TWILIO_FROM_NUMBER) {
    const code = genOtp();
    const expiresAt = Date.now() + OTP_TTL_MS;
    localOtpStore.set(phone, { otp: code, expiresAt });
    setTimeout(() => {
      const e = localOtpStore.get(phone);
      if (e && e.expiresAt <= Date.now()) localOtpStore.delete(phone);
    }, OTP_TTL_MS + 2000);
    try {
      await twilioClient.messages.create({
        body: `Your Animal Rescue code: ${code}`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: phone,
      });
      console.log(`OTP sent via Twilio to ${phone}`);
      return code;
    } catch (err) {
      console.error("Twilio error:", err);
      throw err;
    }
  }
  // fallback dev
  return sendOtpDev(phone);
}

function otpValidate(phone, code) {
  if (otpLib && typeof otpLib.validateOtp === "function") {
    return otpLib.validateOtp(phone, code);
  }
  if (otpLib && otpLib.otpStore && otpLib.otpStore.get) {
    // if lib exported otpStore directly (Map-like)
    const entry = otpLib.otpStore.get(phone);
    if (!entry) return false;
    if (Date.now() > (entry.expiresAt || 0)) {
      if (otpLib.otpStore.delete) otpLib.otpStore.delete(phone);
      return false;
    }
    if (String(entry.otp || entry.code) !== String(code)) return false;
    if (otpLib.otpStore.delete) otpLib.otpStore.delete(phone);
    return true;
  }
  // fallback dev
  return validateOtpDev(phone, code);
}

// Helper: return only public user fields
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    favourite_animal: u.favourite_animal || null,
    avatar: u.avatar || null,
    reputation: u.reputation || 0,
    created_at: u.created_at,
  };
}

// ------------------------
// POST /auth/request-otp
// ------------------------
router.post("/request-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "phone is required" });

  try {
    await otpSend(phone);
    return res.json({
      ok: true,
      message: "OTP generated (dev: logged to server). Use /auth/verify-otp to verify.",
    });
  } catch (err) {
    console.error("request-otp send error", err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
});

// ------------------------
// POST /auth/verify-otp
// Behavior: verifies OTP for EXISTING USERS only.
// If user does not exist -> returns 404 user_not_found
// ------------------------
router.post("/verify-otp", async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: "phone and code required" });

  try {
    const ok = otpValidate(phone, code);
    if (!ok) return res.status(400).json({ error: "INVALID_OR_EXPIRED_OTP" });

    // find user by phone
    const { rows } = await db.query("SELECT * FROM users WHERE phone = $1 LIMIT 1", [phone]);
    if (!rows.length) return res.status(404).json({ error: "user_not_found" });

    const user = rows[0];

    // mark phone verified
    try {
      await db.query("UPDATE users SET phone_verified = true WHERE id = $1", [user.id]);
    } catch (e) {
      console.warn("Could not update phone_verified:", e);
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
// (create account)
// ------------------------
router.post("/register", async (req, res) => {
  try {
    const {
      username,
      password,
      phone,
      email,
      full_name,
      gender,
      age,
      favourite_animal,
      reason,
      avatar,
    } = req.body;

    if (!username || !password || !phone) {
      return res.status(400).json({ error: "username, password and phone required" });
    }
    if (!validator.isAlphanumeric(username.replace(/[_-]/g, ""))) {
      return res.status(400).json({ error: "username invalid" });
    }
    if (email && !validator.isEmail(email)) {
      return res.status(400).json({ error: "invalid email" });
    }

    // uniqueness checks
    const u1 = await db.query("SELECT id FROM users WHERE username = $1 LIMIT 1", [username]);
    if (u1.rows.length) return res.status(400).json({ error: "username_taken" });

    const u2 = await db.query("SELECT id FROM users WHERE phone = $1 LIMIT 1", [phone]);
    if (u2.rows.length) return res.status(400).json({ error: "phone_already_registered" });

    if (email) {
      const u3 = await db.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
      if (u3.rows.length) return res.status(400).json({ error: "email_already_registered" });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const insertSql = `
      INSERT INTO users
      (username, phone, email, full_name, gender, age, favourite_animal, reason, avatar, password_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, username, phone, email, avatar, favourite_animal, created_at, kyc_submitted, reputation
    `;

    const { rows } = await db.query(insertSql, [
      username,
      phone,
      email || null,
      full_name || null,
      gender || null,
      age || null,
      favourite_animal || null,
      reason || null,
      avatar || null,
      hashed,
    ]);

    const user = rows[0];

    // send OTP for phone verification (non-blocking)
    try {
      await otpSend(phone);
    } catch (e) {
      console.warn("Failed to send OTP after register:", e);
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.status(201).json({ token, user: publicUser(user), needs_verification: true });
  } catch (err) {
    console.error("register error", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ------------------------
// POST /auth/login (password-based)
// Accepts username OR phone OR email in usernameOrPhoneOrEmail field
// ------------------------
router.post("/login", async (req, res) => {
  const { usernameOrPhoneOrEmail, password } = req.body;
  if (!usernameOrPhoneOrEmail || !password) {
    return res.status(400).json({ error: "usernameOrPhoneOrEmail and password required" });
  }

  try {
    const { rows } = await db.query(
      `SELECT * FROM users WHERE username = $1 OR phone = $1 OR email = $1 LIMIT 1`,
      [usernameOrPhoneOrEmail]
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

module.exports = router;
