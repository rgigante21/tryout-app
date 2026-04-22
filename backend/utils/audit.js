/**
 * Audit logging helper.
 * Writes security-relevant events to the audit_log table.
 *
 * NEVER pass passwords, tokens, session identifiers, DB credentials,
 * or secrets into the details object.
 */
const pool = require('../db/pool');

/**
 * @param {string} event          - Event name, e.g. 'login_success', 'score_submitted'
 * @param {number|null} userId    - User who performed the action (null for unauthenticated)
 * @param {object} details        - Sanitized metadata (no secrets)
 * @param {number|null} orgId     - Organization context (required by schema; defaults to 1 for Phase 0.1)
 * @param {object} [client]       - Optional pg transaction client
 */
async function logAudit(event, userId, details = {}, orgId = null, client = null) {
  const db = client || pool;
  // Phase 0.1: single org — fall back to org 1 if no org context is available.
  // In Phase 0.2+ this will be required and the fallback will be removed.
  const resolvedOrgId = orgId || 1;
  try {
    await db.query(
      `INSERT INTO audit_log (organization_id, event, user_id, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [resolvedOrgId, event, userId || null, JSON.stringify(details)]
    );
  } catch (err) {
    // Audit failures must not crash the primary operation — log to console only
    console.error('[audit] Failed to write audit log:', event, err.message);
  }
}

module.exports = { logAudit };
