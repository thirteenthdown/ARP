// src/routes/auth.js
const express = require('express');
const db = require('../db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Twilio = require('twilio');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change_this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// In-memory OTP store: phone => { code, expiresAt, attempts }
const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_RETRY_LIMIT = 5;

// Optional Twilio client (only if env vars present)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

// helper: generate 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /auth/request-otp { phone }
router.post('/request-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  const code = generateCode();
  const expiresAt = Date.now() + OTP_TTL_MS;

  otpStore.set(phone, { code, expiresAt, attempts: 0 });

  // schedule cleanup
  setTimeout(() => {
    const entry = otpStore.get(phone);
    if (entry && entry.expiresAt <= Date.now()) otpStore.delete(phone);
  }, OTP_TTL_MS + 1000);

  // Send via Twilio if configured, otherwise log
  if (twilioClient && process.env.TWILIO_FROM_NUMBER) {
    try {
      await twilioClient.messages.create({
        body: `Your Animal Rescue login code: ${code}`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: phone
      });
      console.log(`OTP sent to ${phone} via Twilio`);
    } catch (err) {
      console.error('Twilio send error', err);
      return res.status(500).json({ error: 'Failed to send OTP' });
    }
  } else {
    console.log(`[DEV OTP] phone=${phone} code=${code} (expires in 5m)`);
  }

  return res.json({ ok: true, message: 'OTP generated (dev: logged to server). Use /auth/verify-otp to verify.' });
});

// POST /auth/verify-otp { phone, code, username? }
router.post('/verify-otp', async (req, res) => {
  const { phone, code, username } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });

  const entry = otpStore.get(phone);
  if (!entry) return res.status(400).json({ error: 'No OTP requested for this phone or OTP expired' });

  // attempts limit
  entry.attempts = (entry.attempts || 0) + 1;
  if (entry.attempts > OTP_RETRY_LIMIT) {
    otpStore.delete(phone);
    return res.status(429).json({ error: 'Too many attempts. Request a new OTP.' });
  }

  if (entry.code !== String(code)) {
    otpStore.set(phone, entry); // update attempts
    return res.status(400).json({ error: 'Invalid code' });
  }

  // valid
  otpStore.delete(phone);

  try {
    // Find user by phone
    let { rows } = await db.query(`SELECT id, username, kyc_submitted, reputation, created_at FROM users WHERE phone = $1`, [phone]);
    let user;
    if (rows.length === 0) {
      // create user record. If client provides username use it, otherwise generate one.
      let finalUsername = username && username.trim().length ? username.trim() : `anon_${crypto.randomBytes(3).toString('hex')}`;
      // ensure unique username; try inserting, if conflicts append suffix
      let inserted = null;
      let attempts = 0;
      while (!inserted && attempts < 5) {
        try {
          const q = `INSERT INTO users (username, phone) VALUES ($1,$2) RETURNING id, username, kyc_submitted, reputation, created_at`;
          const resp = await db.query(q, [finalUsername, phone]);
          inserted = resp.rows[0];
          user = inserted;
        } catch (err) {
          if (err.code === '23505') { // username collision
            finalUsername = `${finalUsername}_${Math.floor(Math.random() * 90 + 10)}`;
            attempts++;
          } else {
            throw err;
          }
        }
      }
      if (!user) throw new Error('Could not create unique username after retries');
    } else {
      user = rows[0];
      // ensure phone is up-to-date; (we don't need to update)
    }

    // sign JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    return res.json({ token, user });
  } catch (err) {
    console.error('verify-otp error', err);
    return res.status(500).json({ error: 'Database or server error' });
  }
});

// Keep previous username-only endpoints (optional)
router.post('/signup', async (req, res) => {
  const { username, phone, email } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });

  try {
    const { rows } = await db.query(
      `INSERT INTO users (username, phone, email) VALUES ($1, $2, $3)
       RETURNING id, username, kyc_submitted, reputation, created_at`,
      [username, phone || null, email || null]
    );
    const user = rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    return res.json({ token, user });
  } catch (err) {
    console.error('signup error', err);
    if (err.code === '23505') return res.status(409).json({ error: 'username already taken' });
    return res.status(500).json({ error: 'Database error' });
  }
});

router.post('/login', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });

  try {
    const { rows } = await db.query(
      `SELECT id, username, kyc_submitted, reputation, created_at FROM users WHERE username = $1`,
      [username]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const user = rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    return res.json({ token, user });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
