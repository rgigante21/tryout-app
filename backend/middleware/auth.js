const jwt  = require('jsonwebtoken');
const pool = require('../db/pool');

/**
 * Verify JWT from HttpOnly cookie (primary) or Authorization Bearer header (fallback).
 * Attaches decoded payload to req.user.
 */
function authMiddleware(req, res, next) {
  // Cookie-based (preferred)
  let token = req.cookies?.auth_token;

  // Bearer-token fallback (useful for API tooling / testing)
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) token = authHeader.slice(7);
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session — please log in again' });
  }
}

/**
 * Role guard: caller must have one of the listed roles.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Shorthand guard for admin or coordinator.
 */
const requireAdminOrCoordinator = requireRole('admin', 'coordinator');

/**
 * Resource-level session guard.
 * Scorers may only access sessions they are assigned to.
 * Admins and coordinators always pass.
 *
 * Expects req.params.id (or req.params.sessionId) to hold the session ID.
 */
function requireAssignedSessionAccess(idParam = 'id') {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    // Admins and coordinators skip the assignment check
    if (req.user.role === 'admin' || req.user.role === 'coordinator') return next();

    const sessionId = parseInt(req.params[idParam]);
    if (!sessionId || isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    try {
      const r = await pool.query(
        'SELECT 1 FROM session_scorers WHERE session_id = $1 AND user_id = $2',
        [sessionId, req.user.id]
      );
      if (!r.rows[0]) {
        return res.status(403).json({ error: 'Access denied: you are not assigned to this session' });
      }
      next();
    } catch (err) {
      console.error('requireAssignedSessionAccess error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  };
}

module.exports = { authMiddleware, requireRole, requireAdminOrCoordinator, requireAssignedSessionAccess };
