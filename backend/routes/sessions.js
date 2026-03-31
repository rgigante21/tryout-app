const express = require('express');
const pool    = require('../db/pool');
const { authMiddleware, requireRole, requireAssignedSessionAccess } = require('../middleware/auth');

const router = express.Router();

// ── Sync event start/end dates to MIN/MAX of its sessions ────────
async function syncEventDates(eventId) {
  await pool.query(`
    UPDATE tryout_events
    SET start_date = sub.min_date,
        end_date   = sub.max_date
    FROM (
      SELECT MIN(session_date) AS min_date,
             MAX(session_date) AS max_date
      FROM   sessions
      WHERE  event_id = $1
    ) sub
    WHERE id = $1
      AND sub.min_date IS NOT NULL
  `, [eventId]);
}

// GET /api/sessions/mine
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id, s.name, s.session_date, s.start_time, s.status,
        s.session_type, s.last_name_start, s.last_name_end,
        s.home_team, s.away_team, s.block_id,
        ag.name  AS age_group,
        ag.code  AS age_group_code,
        te.name  AS event_name,
        te.season,
        (SELECT COUNT(*) FROM session_players sp WHERE sp.session_id = s.id) AS player_count,
        (SELECT COUNT(*) FROM scores sc
         WHERE sc.session_id = s.id AND sc.scorer_id = $1) AS score_count
      FROM sessions s
      JOIN session_scorers ss ON ss.session_id = s.id
      JOIN age_groups ag ON ag.id = s.age_group_id
      JOIN tryout_events te ON te.id = s.event_id
      WHERE ss.user_id = $1
      ORDER BY s.session_date, s.start_time
    `, [req.user.id]);

    res.json({ sessions: result.rows });
  } catch (err) {
    console.error('Get my sessions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/sessions
router.get('/', authMiddleware, requireRole('admin', 'coordinator'), async (req, res) => {
  const { age_group_id, event_id, date } = req.query;
  try {
    const conditions = [];
    const params = [];

    if (age_group_id) { conditions.push(`s.age_group_id = $${params.length + 1}`); params.push(age_group_id); }
    if (event_id)     { conditions.push(`s.event_id = $${params.length + 1}`);     params.push(event_id); }
    if (date)         { conditions.push(`s.session_date = $${params.length + 1}`); params.push(date); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        s.id, s.name, s.session_date, s.start_time, s.status,
        s.session_type, s.last_name_start, s.last_name_end,
        s.jersey_min, s.jersey_max, s.home_team, s.away_team,
        s.age_group_id, s.event_id, s.block_id,
        ag.name  AS age_group,
        ag.code  AS age_group_code,
        te.name  AS event_name,
        COUNT(DISTINCT ss.user_id)   AS scorer_count,
        COUNT(DISTINCT sp.player_id) AS player_count,
        COUNT(DISTINCT sc.id)        AS total_scores
      FROM sessions s
      JOIN age_groups ag ON ag.id = s.age_group_id
      JOIN tryout_events te ON te.id = s.event_id
      LEFT JOIN session_scorers ss ON ss.session_id = s.id
      LEFT JOIN session_players sp ON sp.session_id = s.id
      LEFT JOIN scores sc ON sc.session_id = s.id
      ${where}
      GROUP BY s.id, ag.name, ag.code, ag.sort_order, te.name
      ORDER BY s.session_date, s.start_time, ag.sort_order
    `, params);

    res.json({ sessions: result.rows });
  } catch (err) {
    console.error('Get all sessions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/sessions/:id/siblings — sessions from the same block
// Admin/coordinator: always; scorer: only if assigned to the source session
router.get('/:id/siblings', authMiddleware, requireAssignedSessionAccess(), async (req, res) => {
  const sessionId = parseInt(req.params.id);
  try {
    const srcRes = await pool.query('SELECT block_id FROM sessions WHERE id = $1', [sessionId]);
    const src = srcRes.rows[0];
    if (!src) return res.status(404).json({ error: 'Session not found' });
    if (!src.block_id) return res.json({ sessions: [] });

    const r = await pool.query(`
      SELECT s.id, s.name, s.session_date, s.start_time, s.status,
             s.last_name_start, s.last_name_end, s.jersey_min, s.jersey_max
      FROM sessions s
      WHERE s.block_id = $1 AND s.id != $2
      ORDER BY s.start_time
    `, [src.block_id, sessionId]);

    res.json({ sessions: r.rows });
  } catch (err) {
    console.error('Get session siblings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sessions
router.post('/', authMiddleware, requireRole('admin', 'coordinator'), async (req, res) => {
  const { eventId, ageGroupId, name, sessionDate, startTime, sessionType = 'skills' } = req.body;
  if (!eventId || !ageGroupId || !name || !sessionDate || !startTime) {
    return res.status(400).json({ error: 'eventId, ageGroupId, name, sessionDate, and startTime are required' });
  }
  try {
    const r = await pool.query(
      `INSERT INTO sessions (event_id, age_group_id, name, session_date, start_time, session_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [eventId, ageGroupId, name, sessionDate, startTime, sessionType]
    );
    await syncEventDates(eventId);
    res.status(201).json({ session: r.rows[0] });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/sessions/:id
router.patch('/:id', authMiddleware, requireRole('admin', 'coordinator'), async (req, res) => {
  const { status, name, sessionDate, startTime, sessionType } = req.body;
  if (sessionType && !['skills', 'game'].includes(sessionType)) {
    return res.status(400).json({ error: 'sessionType must be "skills" or "game"' });
  }
  if (status && !['pending', 'active', 'complete', 'scoring_complete', 'finalized'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }
  try {
    const r = await pool.query(
      `UPDATE sessions
       SET status       = COALESCE($1, status),
           name         = COALESCE($2, name),
           session_date = COALESCE($3, session_date),
           start_time   = COALESCE($4, start_time),
           session_type = COALESCE($5, session_type)
       WHERE id = $6 RETURNING *`,
      [status || null, name || null, sessionDate || null, startTime || null, sessionType || null, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Session not found' });
    await syncEventDates(r.rows[0].event_id);
    res.json({ session: r.rows[0] });
  } catch (err) {
    console.error('Update session error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', authMiddleware, requireRole('admin', 'coordinator'), async (req, res) => {
  try {
    const lookup = await pool.query('SELECT event_id FROM sessions WHERE id = $1', [req.params.id]);
    const eventId = lookup.rows[0]?.event_id;
    await pool.query('DELETE FROM sessions WHERE id = $1', [req.params.id]);
    if (eventId) await syncEventDates(eventId);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete session error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/sessions/:id/players
// Resource-level check: scorers can only access sessions they are assigned to.
router.get('/:id/players', authMiddleware, requireAssignedSessionAccess(), async (req, res) => {
  const sessionId = parseInt(req.params.id);
  const isAdmin   = req.user.role === 'admin' || req.user.role === 'coordinator';

  try {
    const sessionResult = await pool.query(
      `SELECT s.*, ag.name AS age_group, ag.code AS age_group_code
       FROM sessions s
       JOIN age_groups ag ON ag.id = s.age_group_id
       WHERE s.id = $1`,
      [sessionId]
    );
    if (!sessionResult.rows[0]) return res.status(404).json({ error: 'Session not found' });
    const session = sessionResult.rows[0];

    if (!isAdmin && session.status === 'pending') {
      const opensAt = session.start_time ? session.start_time.slice(0, 5) : null;
      return res.status(403).json({
        error: 'Session not yet open', code: 'PENDING',
        opensAt, sessionDate: session.session_date,
      });
    }

    // Determine if this session has an explicit roster (session_players)
    const rosterCountRes = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM session_players WHERE session_id = $1',
      [sessionId]
    );
    const hasExplicitRoster = rosterCountRes.rows[0].cnt > 0;

    let playersResult;
    if (hasExplicitRoster) {
      playersResult = await pool.query(`
        SELECT
          p.id, p.first_name, p.last_name, p.jersey_number, p.position,
          sp.checked_in, sp.checked_in_at, sp.team_number, sp.attendance_status,
          sc.skating, sc.puck_skills, sc.hockey_sense, sc.notes,
          sc.id AS score_id, sc.status AS score_status,
          CASE WHEN sc.id IS NOT NULL THEN true ELSE false END AS scored
        FROM session_players sp
        JOIN players p ON p.id = sp.player_id
        LEFT JOIN scores sc
          ON sc.player_id = p.id
          AND sc.session_id = $1
          AND sc.scorer_id = $2
        WHERE sp.session_id = $1
        ORDER BY p.jersey_number
      `, [sessionId, req.user.id]);
    } else {
      playersResult = await pool.query(`
        SELECT
          p.id, p.first_name, p.last_name, p.jersey_number, p.position,
          false AS checked_in, null AS checked_in_at, null AS team_number,
          null AS attendance_status,
          sc.skating, sc.puck_skills, sc.hockey_sense, sc.notes,
          sc.id AS score_id, sc.status AS score_status,
          CASE WHEN sc.id IS NOT NULL THEN true ELSE false END AS scored
        FROM players p
        LEFT JOIN scores sc
          ON sc.player_id = p.id
          AND sc.session_id = $1
          AND sc.scorer_id = $2
        WHERE p.age_group_id = $3 AND p.event_id = $4
        ORDER BY p.jersey_number
      `, [sessionId, req.user.id, session.age_group_id, session.event_id]);
    }

    // Completion stats: how many players have been scored by at least one scorer
    const completionRes = await pool.query(`
      SELECT
        COUNT(DISTINCT sp2.player_id)::int                                    AS total_players,
        COUNT(DISTINCT CASE WHEN sp2.checked_in THEN sp2.player_id END)::int  AS checked_in_count,
        COUNT(DISTINCT sc2.player_id)::int                                     AS scored_players
      FROM session_players sp2
      LEFT JOIN scores sc2 ON sc2.player_id = sp2.player_id AND sc2.session_id = $1
      WHERE sp2.session_id = $1
    `, [sessionId]);

    res.json({
      session,
      players: playersResult.rows,
      hasExplicitRoster,
      completion: completionRes.rows[0] || { total_players: 0, checked_in_count: 0, scored_players: 0 },
    });
  } catch (err) {
    console.error('Get session players error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/sessions/:id/players/:playerId/checkin
router.patch('/:id/players/:playerId/checkin', authMiddleware, requireRole('admin', 'coordinator'), async (req, res) => {
  const { checkedIn = true, attendanceStatus } = req.body;
  const sessionId  = parseInt(req.params.id);
  const playerId   = parseInt(req.params.playerId);

  const validStatuses = [null, 'checked_in', 'late_arrival', 'no_show', 'excused'];
  if (attendanceStatus !== undefined && !validStatuses.includes(attendanceStatus)) {
    return res.status(400).json({ error: 'Invalid attendanceStatus' });
  }

  try {
    const r = await pool.query(
      `UPDATE session_players
       SET checked_in        = $1,
           checked_in_at     = CASE WHEN $1 = true THEN NOW() ELSE NULL END,
           attendance_status = COALESCE($4, attendance_status)
       WHERE session_id = $2 AND player_id = $3
       RETURNING *`,
      [!!checkedIn, sessionId, playerId, attendanceStatus || null]
    );

    if (!r.rows[0]) {
      const insert = await pool.query(
        `INSERT INTO session_players (session_id, player_id, checked_in, checked_in_at, attendance_status)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [sessionId, playerId, !!checkedIn, checkedIn ? new Date() : null, attendanceStatus || null]
      );
      return res.json({ sessionPlayer: insert.rows[0], walkin: true });
    }

    res.json({ sessionPlayer: r.rows[0] });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/sessions/:id/scorers
router.get('/:id/scorers', authMiddleware, requireRole('admin', 'coordinator'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role
       FROM session_scorers ss
       JOIN users u ON u.id = ss.user_id
       WHERE ss.session_id = $1
       ORDER BY u.last_name, u.first_name`,
      [req.params.id]
    );
    res.json({ scorers: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sessions/:id/assign
router.post('/:id/assign', authMiddleware, requireRole('admin', 'coordinator'), async (req, res) => {
  const { userId } = req.body;
  const sessionId  = parseInt(req.params.id);
  try {
    await pool.query(
      `INSERT INTO session_scorers (session_id, user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [sessionId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Assign scorer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/sessions/:id/scorers/:userId
router.delete('/:id/scorers/:userId', authMiddleware, requireRole('admin', 'coordinator'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM session_scorers WHERE session_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
