const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const { authLimiter }    = require('../middleware/security');
const { logAudit }       = require('../utils/audit');

const router = express.Router();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET   = process.env.JWT_SECRET;
const TOKEN_TTL_S  = 12 * 60 * 60; // 12 hours in seconds
const isProd       = process.env.NODE_ENV === 'production';

/** Build cookie options for auth_token */
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure:   isProd,          // Secure only in production (HTTPS)
    path:     '/',
    maxAge:   TOKEN_TTL_S * 1000,
  };
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const result = await pool.query(
      'SELECT id, email, password, first_name, last_name, role FROM users WHERE email = $1',
      [normalizedEmail]
    );
    const user = result.rows[0];

    // Use a dummy compare when user not found to prevent timing attacks
    const dummyHash = '$2b$10$abcdefghijklmnopqrstuvuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu';
    const hashToCompare = user ? user.password : dummyHash;

    let valid = false;
    try {
      valid = await bcrypt.compare(password, hashToCompare);
    } catch (bcryptErr) {
      console.error('bcrypt.compare error for', normalizedEmail, ':', bcryptErr.message);
      valid = false;
    }

    if (!user || !valid) {
      await logAudit('login_failure', null, { email: normalizedEmail });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id:        user.id,
        email:     user.email,
        role:      user.role,
        firstName: user.first_name,
        lastName:  user.last_name,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_TTL_S }
    );

    // Set HttpOnly cookie — do NOT expose the raw token to JS
    res.cookie('auth_token', token, cookieOptions());

    await logAudit('login_success', user.id, { email: user.email, role: user.role });

    return res.json({
      user: {
        id:        user.id,
        email:     user.email,
        firstName: user.first_name,
        lastName:  user.last_name,
        role:      user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed — please try again' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', authMiddleware, async (req, res) => {
  await logAudit('logout', req.user.id, { email: req.user.email });
  res.clearCookie('auth_token', { path: '/' });
  return res.json({ success: true });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) {
      res.clearCookie('auth_token', { path: '/' });
      return res.status(404).json({ error: 'User not found' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/register — REMOVED (public self-service disabled) ──────────
// Account creation is handled by admin-only POST /api/admin/users.
// This endpoint is intentionally closed.
router.post('/register', (_req, res) => {
  return res.status(404).json({ error: 'Not found' });
});

module.exports = router;
