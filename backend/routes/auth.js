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
const LOGIN_CODE_RE = /^[a-z0-9-]{2,100}$/;

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

function normalizeLoginCode(value) {
  if (!value || typeof value !== 'string') return null;
  const loginCode = value.toLowerCase().trim();
  return LOGIN_CODE_RE.test(loginCode) ? loginCode : null;
}

// ── GET /api/auth/orgs/lookup/:loginCode ─────────────────────────────────────
// Public Organization Lookup. Returns only safe sign-in page metadata.
router.get('/orgs/lookup/:loginCode', async (req, res) => {
  const loginCode = normalizeLoginCode(req.params.loginCode);
  if (!loginCode) {
    return res.status(400).json({ error: 'Invalid organization login code' });
  }

  try {
    const result = await pool.query(
      `SELECT name, subdomain, accent_color
         FROM organizations
        WHERE subdomain = $1 AND archived_at IS NULL`,
      [loginCode]
    );
    const org = result.rows[0];
    if (!org) {
      return res.status(404).json({ error: 'No organization found for that login code' });
    }
    return res.json({
      organization: {
        name: org.name,
        loginCode: org.subdomain,
        accent_color: org.accent_color || '#6B1E2E',
      },
    });
  } catch (err) {
    console.error('Organization lookup error:', err);
    return res.status(500).json({ error: 'Organization lookup failed — please try again' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Accepts { email, password, loginCode }.
// Credentials are checked only inside the resolved Organization Login Context.
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const loginCode = normalizeLoginCode(req.body?.loginCode);

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!loginCode) {
    return res.status(400).json({ error: 'Organization login code is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const orgRes = await pool.query(
      'SELECT id FROM organizations WHERE subdomain = $1 AND archived_at IS NULL',
      [loginCode]
    );
    const org = orgRes.rows[0];
    if (!org) {
      await logAudit('login_failure', null, { email: normalizedEmail, loginCode }, null);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.password, u.first_name, u.last_name, u.role, u.organization_id,
              o.name AS org_name
         FROM users u JOIN organizations o ON o.id = u.organization_id
        WHERE u.email = $1 AND u.organization_id = $2`,
      [normalizedEmail, org.id]
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
      await logAudit('login_failure', null, { email: normalizedEmail, loginCode }, org.id);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id:             user.id,
        email:          user.email,
        role:           user.role,
        firstName:      user.first_name,
        lastName:       user.last_name,
        organization_id: user.organization_id,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_TTL_S }
    );

    // Set HttpOnly cookie — do NOT expose the raw token to JS
    res.cookie('auth_token', token, cookieOptions());

    await logAudit('login_success', user.id, { email: user.email, role: user.role }, user.organization_id);

    return res.json({
      user: {
        id:              user.id,
        email:           user.email,
        firstName:       user.first_name,
        lastName:        user.last_name,
        role:            user.role,
        organization_id: user.organization_id,
        org_name:        user.org_name,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed — please try again' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', authMiddleware, async (req, res) => {
  await logAudit('logout', req.user.id, { email: req.user.email }, req.user.organization_id);
  res.clearCookie('auth_token', { path: '/' });
  return res.json({ success: true });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.organization_id,
              o.name AS org_name
         FROM users u JOIN organizations o ON o.id = u.organization_id
        WHERE u.id = $1`,
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
