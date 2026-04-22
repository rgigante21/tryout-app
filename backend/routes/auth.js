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
// Accepts { email, password, subdomain }.
// subdomain is optional in Phase 0.1 (single org). In Phase 0.2+ it will be required.
router.post('/login', authLimiter, async (req, res) => {
  const { email, password, subdomain } = req.body || {};

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    let orgId = null;

    if (subdomain && typeof subdomain === 'string') {
      const orgRes = await pool.query(
        'SELECT id FROM organizations WHERE subdomain = $1 AND archived_at IS NULL',
        [subdomain.toLowerCase().trim()]
      );
      if (!orgRes.rows[0]) {
        // Return the same generic error to avoid org enumeration
        await logAudit('login_failure', null, { email: normalizedEmail, subdomain }, 1);
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      orgId = orgRes.rows[0].id;
    }

    // Phase 0.1: if no subdomain provided, look up user across orgs (single-org scenario).
    // Phase 0.2 will require subdomain and remove this fallback.
    const userQuery = orgId
      ? `SELECT u.id, u.email, u.password, u.first_name, u.last_name, u.role, u.organization_id,
               o.name AS org_name
           FROM users u JOIN organizations o ON o.id = u.organization_id
          WHERE u.email = $1 AND u.organization_id = $2`
      : `SELECT u.id, u.email, u.password, u.first_name, u.last_name, u.role, u.organization_id,
               o.name AS org_name
           FROM users u JOIN organizations o ON o.id = u.organization_id
          WHERE u.email = $1`;
    const userParams = orgId ? [normalizedEmail, orgId] : [normalizedEmail];

    const result = await pool.query(userQuery, userParams);
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

    const resolvedOrgId = user?.organization_id || orgId || 1;

    if (!user || !valid) {
      await logAudit('login_failure', null, { email: normalizedEmail }, resolvedOrgId);
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
