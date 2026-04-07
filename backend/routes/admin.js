const express = require('express');
const bcrypt  = require('bcrypt');
const pool    = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { assignPlayerToSessions } = require('../utils/session-assignment');
const { logAudit } = require('../utils/audit');

const router = express.Router();
const guard  = [authMiddleware, requireRole('admin', 'coordinator')];

// ── Age Groups ────────────────────────────────────────────────────────────────

router.get('/age-groups', ...guard, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM age_groups ORDER BY sort_order');
    res.json({ ageGroups: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/age-groups', ...guard, async (req, res) => {
  const { name, code, sortOrder } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'name and code required' });
  }
  try {
    const r = await pool.query(
      `INSERT INTO age_groups (name, code, sort_order) VALUES ($1, $2, $3) RETURNING *`,
      [name, code.toUpperCase(), sortOrder || 0]
    );
    res.status(201).json({ ageGroup: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Age group code already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Events ────────────────────────────────────────────────────────────────────

router.get('/events', ...guard, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM tryout_events ORDER BY start_date DESC');
    res.json({ events: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/events', ...guard, async (req, res) => {
  const { name, season, startDate, endDate } = req.body;
  if (!name || !season || !startDate || !endDate) {
    return res.status(400).json({ error: 'name, season, startDate, endDate required' });
  }
  try {
    const r = await pool.query(
      `INSERT INTO tryout_events (name, season, start_date, end_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, season, startDate, endDate]
    );
    res.status(201).json({ event: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/events/:id/archive', ...guard, async (req, res) => {
  const { archive } = req.body;
  try {
    const r = await pool.query(
      `UPDATE tryout_events
       SET archived    = $1,
           archived_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END
       WHERE id = $2 RETURNING *`,
      [!!archive, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Event not found' });
    res.json({ event: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/events/:id/stats', ...guard, async (req, res) => {
  const { id } = req.params;
  try {
    const [eventRes, ageRes, playerRes, sessionRes, scoreRes] = await Promise.all([
      pool.query('SELECT * FROM tryout_events WHERE id = $1', [id]),
      pool.query(`
        SELECT ag.name, ag.code, ag.sort_order,
          COUNT(DISTINCT p.id)::int   AS players,
          COUNT(DISTINCT sc.id)::int  AS scores,
          COUNT(DISTINCT s.id)::int   AS sessions,
          SUM(CASE WHEN p.outcome = 'moved_up'      THEN 1 ELSE 0 END)::int AS moved_up,
          SUM(CASE WHEN p.outcome = 'retained'      THEN 1 ELSE 0 END)::int AS retained,
          SUM(CASE WHEN p.outcome = 'left_program'  THEN 1 ELSE 0 END)::int AS left_program
        FROM age_groups ag
        LEFT JOIN players p  ON p.age_group_id = ag.id AND p.event_id = $1
        LEFT JOIN sessions s ON s.age_group_id = ag.id AND s.event_id = $1
        LEFT JOIN scores sc  ON sc.session_id = s.id
        GROUP BY ag.id ORDER BY ag.sort_order
      `, [id]),
      pool.query('SELECT COUNT(*)::int AS total FROM players WHERE event_id = $1', [id]),
      pool.query('SELECT COUNT(*)::int AS total FROM sessions WHERE event_id = $1', [id]),
      pool.query(`
        SELECT COUNT(DISTINCT sc.id)::int AS total
        FROM scores sc JOIN sessions s ON s.id = sc.session_id WHERE s.event_id = $1
      `, [id]),
    ]);
    if (!eventRes.rows[0]) return res.status(404).json({ error: 'Event not found' });
    res.json({
      event:         eventRes.rows[0],
      byAgeGroup:    ageRes.rows,
      totalPlayers:  playerRes.rows[0].total,
      totalSessions: sessionRes.rows[0].total,
      totalScores:   scoreRes.rows[0].total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Players ───────────────────────────────────────────────────────────────────

router.patch('/players/:id/outcome', ...guard, async (req, res) => {
  const { outcome } = req.body;
  const valid = ['moved_up', 'retained', 'left_program', null];
  if (!valid.includes(outcome)) return res.status(400).json({ error: 'Invalid outcome' });
  try {
    const r = await pool.query(
      'UPDATE players SET outcome = $1 WHERE id = $2 RETURNING *',
      [outcome, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Player not found' });
    res.json({ player: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/players', ...guard, async (req, res) => {
  const { age_group_id, event_id } = req.query;
  if (!age_group_id || !event_id) {
    return res.status(400).json({ error: 'age_group_id and event_id required' });
  }
  try {
    const r = await pool.query(
      `SELECT * FROM players
       WHERE age_group_id = $1 AND event_id = $2
       ORDER BY jersey_number`,
      [age_group_id, event_id]
    );
    res.json({ players: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/players', ...guard, async (req, res) => {
  const { firstName, lastName, jerseyNumber, ageGroupId, eventId } = req.body;
  if (!firstName || !lastName || !jerseyNumber || !ageGroupId || !eventId) {
    return res.status(400).json({ error: 'All fields required' });
  }
  try {
    const r = await pool.query(
      `INSERT INTO players (first_name, last_name, jersey_number, age_group_id, event_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [firstName, lastName, parseInt(jerseyNumber), ageGroupId, eventId]
    );
    const client = await pool.connect();
    try {
      await assignPlayerToSessions(client, r.rows[0].id, ageGroupId, eventId);
    } finally {
      client.release();
    }
    res.status(201).json({ player: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Jersey number already used in this age group' });
    }
    console.error('Add player error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/players/:id', ...guard, async (req, res) => {
  try {
    await pool.query('DELETE FROM players WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/players/bulk', ...guard, async (req, res) => {
  const { players, ageGroupId, eventId } = req.body;
  if (!Array.isArray(players) || !ageGroupId || !eventId) {
    return res.status(400).json({ error: 'players, ageGroupId, eventId required' });
  }
  const added = [], errors = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of players) {
      if (!p.firstName || !p.lastName || !p.jerseyNumber) {
        errors.push({ ...p, reason: 'Missing fields' }); continue;
      }
      try {
        const r = await client.query(
          `INSERT INTO players (first_name,last_name,jersey_number,age_group_id,event_id)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [p.firstName.trim(), p.lastName.trim(), parseInt(p.jerseyNumber), ageGroupId, eventId]
        );
        added.push(r.rows[0]);
        await assignPlayerToSessions(client, r.rows[0].id, ageGroupId, eventId);
      } catch (e) {
        if (e.code === '23505') errors.push({ ...p, reason: 'external_id conflict (concurrent import)' });
        else errors.push({ ...p, reason: e.message });
      }
    }
    await client.query('COMMIT');
    res.json({ added, errors });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ── Users ─────────────────────────────────────────────────────────────────────

router.get('/users', ...guard, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, email, first_name, last_name, role
       FROM users ORDER BY last_name, first_name`
    );
    res.json({ users: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/admin/users — admin-only account creation.
 * Replaces the removed public POST /api/auth/register.
 * Minimum password: 12 chars for admin/coordinator; 8 for scorer.
 */
router.post('/users', authMiddleware, requireRole('admin'), async (req, res) => {
  const { email, password, firstName, lastName, role } = req.body || {};

  if (!email || typeof email !== 'string' ||
      !password || typeof password !== 'string' ||
      !firstName || typeof firstName !== 'string' ||
      !lastName || typeof lastName !== 'string') {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const allowedRoles = ['scorer', 'coordinator', 'admin'];
  const assignedRole = allowedRoles.includes(role) ? role : 'scorer';

  const minPwLen = (assignedRole === 'admin' || assignedRole === 'coordinator') ? 12 : 8;
  if (password.length < minPwLen) {
    return res.status(400).json({
      error: `Password must be at least ${minPwLen} characters for the ${assignedRole} role`,
    });
  }
  if (password.length > 128) {
    return res.status(400).json({ error: 'Password must not exceed 128 characters' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const hashed = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name, role`,
      [normalizedEmail, hashed, firstName.trim(), lastName.trim(), assignedRole]
    );
    await logAudit('account_created', req.user.id, {
      newUserId: result.rows[0].id,
      email: normalizedEmail,
      role: assignedRole,
    });
    return res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Account creation failed — please try again' });
  }
});

router.patch('/users/:id', ...guard, async (req, res) => {
  const { firstName, lastName, email, role, password } = req.body || {};
  try {
    const fields = [], vals = [];
    let i = 1;
    if (firstName) { fields.push(`first_name=$${i++}`); vals.push(firstName.trim()); }
    if (lastName)  { fields.push(`last_name=$${i++}`);  vals.push(lastName.trim()); }
    if (email)     { fields.push(`email=$${i++}`);      vals.push(email.toLowerCase().trim()); }
    if (role) {
      if (!['scorer', 'coordinator', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      fields.push(`role=$${i++}`);
      vals.push(role);
    }
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      if (password.length > 128) {
        return res.status(400).json({ error: 'Password must not exceed 128 characters' });
      }
      const hash = await bcrypt.hash(password, 12);
      fields.push(`password=$${i++}`);
      vals.push(hash);
    }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    const r = await pool.query(
      `UPDATE users SET ${fields.join(',')} WHERE id=$${i} RETURNING id,email,first_name,last_name,role`,
      vals
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });

    if (role) {
      await logAudit('role_changed', req.user.id, {
        targetUserId: parseInt(req.params.id),
        newRole: role,
      });
    }
    if (password) {
      await logAudit('password_changed', req.user.id, {
        targetUserId: parseInt(req.params.id),
      });
    }

    return res.json({ user: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    console.error('Update user error:', err);
    return res.status(500).json({ error: 'Update failed — please try again' });
  }
});

router.get('/users/:id/sessions', ...guard, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT s.id, s.name, s.session_date, s.start_time, s.status,
             ag.name AS age_group_name, ag.id AS age_group_id,
             ag.code AS age_group_code
      FROM session_scorers ss
      JOIN sessions s ON s.id = ss.session_id
      JOIN age_groups ag ON ag.id = s.age_group_id
      WHERE ss.user_id = $1
      ORDER BY s.session_date, s.start_time
    `, [req.params.id]);
    res.json({ sessions: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Session finalization ──────────────────────────────────────────────────────

/**
 * PATCH /api/admin/sessions/:id/finalize
 * Transition a session to scoring_complete or finalized status.
 * Only admins can finalize (coordinators can mark scoring_complete).
 */
router.patch('/sessions/:id/finalize', authMiddleware, requireRole('admin', 'coordinator'), async (req, res) => {
  const { status } = req.body;
  const validTransitions = ['scoring_complete', 'finalized'];

  if (!validTransitions.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validTransitions.join(', ')}` });
  }
  if (status === 'finalized' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can finalize sessions' });
  }

  try {
    const r = await pool.query(
      `UPDATE sessions SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Session not found' });

    await logAudit('session_status_changed', req.user.id, {
      sessionId: parseInt(req.params.id),
      newStatus: status,
    });

    res.json({ session: r.rows[0] });
  } catch (err) {
    console.error('Finalize session error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Scorer completion stats ───────────────────────────────────────────────────

/**
 * GET /api/admin/sessions/:id/completion
 * Returns completion tracking for a session: total players, checked-in, scored per scorer.
 */
router.get('/sessions/:id/completion', ...guard, async (req, res) => {
  const sessionId = parseInt(req.params.id);
  try {
    const [totalsRes, perScorerRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(DISTINCT sp.player_id)::int                                    AS total_players,
          COUNT(DISTINCT CASE WHEN sp.checked_in THEN sp.player_id END)::int   AS checked_in_count,
          COUNT(DISTINCT sc.player_id)::int                                     AS players_with_any_score,
          COUNT(DISTINCT sp.player_id) - COUNT(DISTINCT sc.player_id)           AS players_missing_scores
        FROM session_players sp
        LEFT JOIN scores sc ON sc.player_id = sp.player_id AND sc.session_id = $1
        WHERE sp.session_id = $1
      `, [sessionId]),
      pool.query(`
        SELECT
          u.id, u.first_name, u.last_name, u.email,
          COUNT(sc.id)::int AS scores_submitted,
          (SELECT COUNT(*)::int FROM session_players sp2 WHERE sp2.session_id = $1) AS total_players
        FROM session_scorers ss
        JOIN users u ON u.id = ss.user_id
        LEFT JOIN scores sc ON sc.scorer_id = u.id AND sc.session_id = $1
        WHERE ss.session_id = $1
        GROUP BY u.id, u.first_name, u.last_name, u.email
        ORDER BY u.last_name, u.first_name
      `, [sessionId]),
    ]);

    res.json({
      totals:     totalsRes.rows[0] || {},
      perScorer:  perScorerRes.rows,
    });
  } catch (err) {
    console.error('Completion stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
