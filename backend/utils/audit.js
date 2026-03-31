/**
 * Audit logging helper.
 * Writes security-relevant events to the audit_log table.
 *
 * NEVER pass passwords, tokens, session identifiers, DB credentials,
 * or secrets into the details object.
 */
const pool = require('../db/pool');

/**
 * @param {string} event     - Event name, e.g. 'login_success', 'score_submitted'
 * @param {number|null} userId  - User who performed the action (null for unauthenticated)
 * @param {object} details   - Sanitized metadata (no secrets)
 * @param {object} [client]  - Optional pg transaction client
 */
async function logAudit(event, userId, details = {}, client = null) {
  const db = client || pool;
  try {
    await db.query(
      `INSERT INTO audit_log (event, user_id, details, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [event, userId || null, JSON.stringify(details)]
    );
  } catch (err) {
    // Audit failures must not crash the primary operation — log to console only
    console.error('[audit] Failed to write audit log:', event, err.message);
  }
}

module.exports = { logAudit };
