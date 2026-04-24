const express = require('express');
const bcrypt  = require('bcrypt');
const pool    = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { assignPlayerToSessions } = require('../utils/session-assignment');
const { logAudit } = require('../utils/audit');
const { findOrCreatePlayer, upsertPlayerRegistration } = require('../utils/registrations');

const router     = express.Router();
const guard      = [authMiddleware, requireRole('admin', 'coordinator')];
const adminGuard = [authMiddleware, requireRole('admin')];

// ── Age Groups ────────────────────────────────────────────────────────────────

router.get('/age-groups', ...guard, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM age_groups WHERE organization_id = $1 ORDER BY sort_order',
      [req.org_id]
    );
    res.json({ ageGroups: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/age-groups', ...adminGuard, async (req, res) => {
  const { name, code, sortOrder } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'name and code required' });
  }
  try {
    const r = await pool.query(
      `INSERT INTO age_groups (organization_id, name, code, sort_order) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.org_id, name, code.toUpperCase(), sortOrder || 0]
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
    const r = await pool.query(
      'SELECT * FROM tryout_events WHERE organization_id = $1 ORDER BY start_date DESC',
      [req.org_id]
    );
    res.json({ events: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/events', ...adminGuard, async (req, res) => {
  const { name, season, startDate, endDate } = req.body;
  if (!name || !season || !startDate || !endDate) {
    return res.status(400).json({ error: 'name, season, startDate, endDate required' });
  }
  try {
    const r = await pool.query(
      `INSERT INTO tryout_events (organization_id, name, season, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.org_id, name, season, startDate, endDate]
    );
    res.status(201).json({ event: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/events/:id', ...adminGuard, async (req, res) => {
  const { name, season, startDate, endDate } = req.body;
  if (!name || !season || !startDate || !endDate) {
    return res.status(400).json({ error: 'name, season, startDate, endDate required' });
  }
  try {
    const r = await pool.query(
      `UPDATE tryout_events SET name=$1, season=$2, start_date=$3, end_date=$4
       WHERE id=$5 AND organization_id=$6 RETURNING *`,
      [name, season, startDate, endDate, req.params.id, req.org_id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Event not found' });
    res.json({ event: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/events/:id/archive', ...adminGuard, async (req, res) => {
  const { archive } = req.body;
  try {
    const r = await pool.query(
      `UPDATE tryout_events
       SET archived    = $1,
           archived_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END
       WHERE id = $2
         AND organization_id = $3
       RETURNING *`,
      [!!archive, req.params.id, req.org_id]
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
      pool.query(
        'SELECT * FROM tryout_events WHERE id = $1 AND organization_id = $2',
        [id, req.org_id]
      ),
      pool.query(`
        SELECT ag.name, ag.code, ag.sort_order,
          COUNT(DISTINCT per.id)::int AS players,
          COUNT(DISTINCT sc.id)::int  AS scores,
          COUNT(DISTINCT s.id)::int   AS sessions,
          SUM(CASE WHEN per.outcome = 'moved_up'      THEN 1 ELSE 0 END)::int AS moved_up,
          SUM(CASE WHEN per.outcome = 'retained'      THEN 1 ELSE 0 END)::int AS retained,
          SUM(CASE WHEN per.outcome = 'left_program'  THEN 1 ELSE 0 END)::int AS left_program
        FROM age_groups ag
        LEFT JOIN player_event_registrations per
          ON per.age_group_id = ag.id
         AND per.event_id = $1
        LEFT JOIN sessions s ON s.age_group_id = ag.id AND s.event_id = $1
        LEFT JOIN scores sc  ON sc.session_id = s.id
        WHERE ag.organization_id = $2
        GROUP BY ag.id ORDER BY ag.sort_order
      `, [id, req.org_id]),
      pool.query('SELECT COUNT(*)::int AS total FROM player_event_registrations WHERE event_id = $1', [id]),
      pool.query('SELECT COUNT(*)::int AS total FROM sessions WHERE event_id = $1 AND organization_id = $2', [id, req.org_id]),
      pool.query(`
        SELECT COUNT(DISTINCT sc.id)::int AS total
        FROM scores sc JOIN sessions s ON s.id = sc.session_id
        WHERE s.event_id = $1 AND s.organization_id = $2
      `, [id, req.org_id]),
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
    // Verify the registration belongs to this org via its event
    const r = await pool.query(
      `UPDATE player_event_registrations per
       SET outcome = $1, updated_at = NOW()
       FROM tryout_events te
       WHERE per.id = $2
         AND per.event_id = te.id
         AND te.organization_id = $3
       RETURNING per.*`,
      [outcome, req.params.id, req.org_id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Player not found' });
    res.json({ player: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/players', ...guard, async (req, res) => {
  const age_group_id = req.query.age_group_id || req.query.ageGroupId;
  const event_id = req.query.event_id || req.query.eventId;
  if (!age_group_id || !event_id) {
    return res.status(400).json({ error: 'age_group_id and event_id required' });
  }
  try {
    const r = await pool.query(
      `SELECT
         per.id,
         per.player_id,
         p.first_name,
         p.last_name,
         p.date_of_birth,
         p.gender,
         p.external_id,
         per.jersey_number,
         per.position,
         per.shot,
         per.will_tryout,
         per.outcome,
         per.age_group_id,
         per.event_id
       FROM player_event_registrations per
       JOIN players p ON p.id = per.player_id
       JOIN tryout_events te ON te.id = per.event_id
       WHERE per.age_group_id = $1
         AND per.event_id = $2
         AND te.organization_id = $3
       ORDER BY per.jersey_number NULLS LAST, p.last_name, p.first_name`,
      [age_group_id, event_id, req.org_id]
    );
    res.json({ players: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/players', ...adminGuard, async (req, res) => {
  const { firstName, lastName, jerseyNumber, ageGroupId, eventId } = req.body;
  if (!firstName || !lastName || !jerseyNumber || !ageGroupId || !eventId) {
    return res.status(400).json({ error: 'All fields required' });
  }
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Verify event belongs to this org
      const eventCheck = await client.query(
        'SELECT id FROM tryout_events WHERE id = $1 AND organization_id = $2',
        [eventId, req.org_id]
      );
      if (!eventCheck.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Event not found' });
      }
      const player = await findOrCreatePlayer(client, { firstName, lastName, orgId: req.org_id });
      const registration = await upsertPlayerRegistration(client, {
        playerId: player.id,
        eventId,
        ageGroupId,
        jerseyNumber: parseInt(jerseyNumber),
      });
      await assignPlayerToSessions(client, player.id, ageGroupId, eventId);
      await client.query('COMMIT');
      res.status(201).json({
        player: {
          id: registration.id,
          player_id: player.id,
          first_name: player.first_name,
          last_name: player.last_name,
          date_of_birth: player.date_of_birth,
          gender: player.gender,
          external_id: player.external_id,
          jersey_number: registration.jersey_number,
          position: registration.position,
          shot: registration.shot,
          will_tryout: registration.will_tryout,
          outcome: registration.outcome,
          age_group_id: registration.age_group_id,
          event_id: registration.event_id,
        },
      });
      return;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Add player error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/players/:id', ...adminGuard, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Verify the registration belongs to this org via its event
      const lookup = await client.query(
        `SELECT per.player_id FROM player_event_registrations per
         JOIN tryout_events te ON te.id = per.event_id
         WHERE per.id = $1 AND te.organization_id = $2`,
        [req.params.id, req.org_id]
      );
      if (!lookup.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Player not found' });
      }
      const playerId = lookup.rows[0].player_id;
      await client.query('DELETE FROM player_event_registrations WHERE id = $1', [req.params.id]);
      if (playerId) {
        await client.query(
          `DELETE FROM players p
           WHERE p.id = $1
             AND p.organization_id = $2
             AND NOT EXISTS (
               SELECT 1 FROM player_event_registrations per WHERE per.player_id = p.id
             )`,
          [playerId, req.org_id]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/players/bulk', ...adminGuard, async (req, res) => {
  const { players, ageGroupId, eventId } = req.body;
  if (!Array.isArray(players) || !ageGroupId || !eventId) {
    return res.status(400).json({ error: 'players, ageGroupId, eventId required' });
  }
  const added = [], errors = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Verify event belongs to this org
    const eventCheck = await client.query(
      'SELECT id FROM tryout_events WHERE id = $1 AND organization_id = $2',
      [eventId, req.org_id]
    );
    if (!eventCheck.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }
    for (const p of players) {
      if (!p.firstName || !p.lastName || !p.jerseyNumber) {
        errors.push({ ...p, reason: 'Missing fields' }); continue;
      }
      try {
        const player = await findOrCreatePlayer(client, {
          firstName: p.firstName.trim(),
          lastName: p.lastName.trim(),
          orgId: req.org_id,
        });
        const registration = await upsertPlayerRegistration(client, {
          playerId: player.id,
          eventId,
          ageGroupId,
          jerseyNumber: parseInt(p.jerseyNumber),
        });
        added.push({
          id: registration.id,
          player_id: player.id,
          first_name: player.first_name,
          last_name: player.last_name,
          jersey_number: registration.jersey_number,
          age_group_id: registration.age_group_id,
          event_id: registration.event_id,
          position: registration.position,
          will_tryout: registration.will_tryout,
          outcome: registration.outcome,
        });
        await assignPlayerToSessions(client, player.id, ageGroupId, eventId);
      } catch (e) {
        if (e.code === '23505') errors.push({ ...p, reason: 'registration conflict' });
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
       FROM users
       WHERE organization_id = $1
       ORDER BY last_name, first_name`,
      [req.org_id]
    );
    res.json({ users: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/admin/users — admin-only account creation.
 * Replaces the removed public POST /api/auth/register.
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
      `INSERT INTO users (organization_id, email, password, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role`,
      [req.org_id, normalizedEmail, hashed, firstName.trim(), lastName.trim(), assignedRole]
    );
    await logAudit('account_created', req.user.id, {
      newUserId: result.rows[0].id,
      email: normalizedEmail,
      role: assignedRole,
    }, req.org_id);
    return res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Account creation failed — please try again' });
  }
});

router.patch('/users/:id', ...adminGuard, async (req, res) => {
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
    vals.push(req.org_id);
    const r = await pool.query(
      `UPDATE users SET ${fields.join(',')} WHERE id=$${i} AND organization_id=$${i + 1} RETURNING id,email,first_name,last_name,role`,
      vals
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });

    if (role) {
      await logAudit('role_changed', req.user.id, {
        targetUserId: parseInt(req.params.id),
        newRole: role,
      }, req.org_id);
    }
    if (password) {
      await logAudit('password_changed', req.user.id, {
        targetUserId: parseInt(req.params.id),
      }, req.org_id);
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
        AND s.organization_id = $2
      ORDER BY s.session_date, s.start_time
    `, [req.params.id, req.org_id]);
    res.json({ sessions: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Session finalization ──────────────────────────────────────────────────────

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
      `UPDATE sessions SET status = $1 WHERE id = $2 AND organization_id = $3 RETURNING *`,
      [status, req.params.id, req.org_id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Session not found' });

    await logAudit('session_status_changed', req.user.id, {
      sessionId: parseInt(req.params.id),
      newStatus: status,
    }, req.org_id);

    res.json({ session: r.rows[0] });
  } catch (err) {
    console.error('Finalize session error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Scorer completion stats ───────────────────────────────────────────────────

router.get('/sessions/:id/completion', ...guard, async (req, res) => {
  const sessionId = parseInt(req.params.id);
  try {
    // Verify session belongs to this org
    const sessionCheck = await pool.query(
      'SELECT id FROM sessions WHERE id = $1 AND organization_id = $2',
      [sessionId, req.org_id]
    );
    if (!sessionCheck.rows[0]) return res.status(404).json({ error: 'Session not found' });

    const [totalsRes, perScorerRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(DISTINCT COALESCE(sp.registration_id, per.id))::int AS total_players,
          COUNT(DISTINCT CASE WHEN sp.checked_in THEN COALESCE(sp.registration_id, per.id) END)::int AS checked_in_count,
          COUNT(DISTINCT COALESCE(sc.registration_id, per.id))::int AS players_with_any_score,
          COUNT(DISTINCT COALESCE(sp.registration_id, per.id))
            - COUNT(DISTINCT COALESCE(sc.registration_id, per.id)) AS players_missing_scores
        FROM session_players sp
        LEFT JOIN player_event_registrations per ON per.id = sp.registration_id
        LEFT JOIN scores sc
          ON sc.session_id = $1
         AND (
              sc.registration_id = sp.registration_id
           OR (sp.registration_id IS NULL AND sc.player_id = sp.player_id)
         )
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

// Org settings — branding
router.get('/org', ...guard, async (req, res) => {
  try {
    const { rows: [org] } = await pool.query(
      'SELECT accent_color FROM organizations WHERE id = $1',
      [req.orgId]
    );
    res.json({ org: org || { accent_color: '#6B1E2E' } });
  } catch (err) {
    console.error('org settings error:', err);
    res.status(500).json({ error: 'Failed to load org settings' });
  }
});

router.patch('/org', ...adminGuard, async (req, res) => {
  try {
    const { accentColor } = req.body;
    const { rows: [org] } = await pool.query(
      'UPDATE organizations SET accent_color = $1 WHERE id = $2 RETURNING accent_color',
      [accentColor || '#6B1E2E', req.orgId]
    );
    res.json({ org });
  } catch (err) {
    console.error('org update error:', err);
    res.status(500).json({ error: 'Failed to update org settings' });
  }
});

module.exports = router;
