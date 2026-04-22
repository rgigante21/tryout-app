/**
 * Org context middleware.
 * Extracts organization_id from the authenticated user (set by authMiddleware via JWT)
 * and sets req.org_id for all downstream handlers.
 *
 * Also makes a best-effort attempt to set the Postgres session-level variable
 * app.current_org for RLS policy evaluation. Uses SET (not SET LOCAL) because
 * full transaction-per-request wrapping is deferred to Phase 1. With the
 * app-layer WHERE filters as the primary gate, this is safe for Phase 0.1
 * (single org): stale context on a reused connection can only reduce visible
 * rows, never expand them to another tenant.
 *
 * Must be mounted AFTER authMiddleware so req.user is populated.
 */
const pool = require('../db/pool');

async function orgMiddleware(req, res, next) {
  if (!req.user || !req.user.organization_id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.org_id = req.user.organization_id;

  // Best-effort: set connection-level setting for RLS safety net.
  // Non-fatal if this fails — app-layer filter is the primary mechanism.
  try {
    await pool.query(`SELECT set_config('app.current_org', $1::text, false)`, [req.org_id]);
  } catch (_) {
    // Intentionally swallowed — RLS is belt-and-suspenders, not primary gate
  }

  next();
}

module.exports = { orgMiddleware };
