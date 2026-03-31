/**
 * Session-player management routes.
 * Handles moving players between sessions with full audit trail.
 *
 * PATCH /api/session-players/move
 */
const express = require('express');
const pool    = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();

/**
 * PATCH /api/session-players/move
 *
 * Move a player from one session to another within the same event.
 * Requires admin or coordinator.
 *
 * Body:
 *   playerId        integer  — player to move
 *   fromSessionId   integer  — source session
 *   toSessionId     integer  — destination session
 *   keepCheckinStatus boolean (default false) — preserve checked_in / attendance_status
 */
router.patch('/move', authMiddleware, requireRole('admin', 'coordinator'), async (req, res) => {
  const { playerId, fromSessionId, toSessionId, keepCheckinStatus = false } = req.body || {};

  if (!playerId || !fromSessionId || !toSessionId) {
    return res.status(400).json({ error: 'playerId, fromSessionId, and toSessionId are required' });
  }
  if (fromSessionId === toSessionId) {
    return res.status(400).json({ error: 'fromSessionId and toSessionId must be different' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify both sessions exist and belong to the same event & age group
    const sessRes = await client.query(
      `SELECT id, event_id, age_group_id, status, name
       FROM sessions WHERE id = ANY($1::int[])`,
      [[fromSessionId, toSessionId]]
    );
    if (sessRes.rows.length !== 2) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'One or both sessions not found' });
    }
    const [sessA, sessB] = sessRes.rows;
    if (sessA.event_id !== sessB.event_id || sessA.age_group_id !== sessB.age_group_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Sessions must belong to the same event and age group' });
    }

    const toSess = sessRes.rows.find((s) => s.id === toSessionId);
    if (toSess.status === 'finalized' && req.user.role !== 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Destination session is finalized — only admins can move players in' });
    }

    // 2. Verify player is in the source session
    const srcPlayerRes = await client.query(
      'SELECT * FROM session_players WHERE session_id = $1 AND player_id = $2',
      [fromSessionId, playerId]
    );
    if (!srcPlayerRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not found in source session' });
    }
    const srcRecord = srcPlayerRes.rows[0];

    // 3. Remove from source session
    await client.query(
      'DELETE FROM session_players WHERE session_id = $1 AND player_id = $2',
      [fromSessionId, playerId]
    );

    // 4. Insert into destination session (preserving or resetting check-in)
    const checkedIn      = keepCheckinStatus ? srcRecord.checked_in : false;
    const checkedInAt    = keepCheckinStatus ? srcRecord.checked_in_at : null;
    const attendanceStat = keepCheckinStatus ? srcRecord.attendance_status : null;

    const insertRes = await client.query(
      `INSERT INTO session_players (session_id, player_id, checked_in, checked_in_at, attendance_status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (session_id, player_id) DO UPDATE
         SET checked_in        = EXCLUDED.checked_in,
             checked_in_at     = EXCLUDED.checked_in_at,
             attendance_status = EXCLUDED.attendance_status
       RETURNING *`,
      [toSessionId, playerId, checkedIn, checkedInAt, attendanceStat]
    );

    await logAudit('player_moved', req.user.id, {
      playerId,
      fromSessionId,
      toSessionId,
      keepCheckinStatus,
    }, client);

    await client.query('COMMIT');

    res.json({
      success:       true,
      sessionPlayer: insertRes.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Move player error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
