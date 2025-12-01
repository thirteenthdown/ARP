// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this';

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid Authorization header' });

  const token = parts[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const { rows } = await db.query(
      `SELECT id, username, kyc_submitted, reputation, created_at FROM users WHERE id = $1`,
      [payload.userId]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });

    req.user = rows[0]; // minimal safe user object
    next();
  } catch (err) {
    console.error('auth error', err.message || err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
