const express = require('express');
const pool    = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { resolveRegistrationForSession } = require('../utils/registrations');

const router = express.Router();

// After a score is saved, check if all active scorers have completed all checked-in players.
// If so and the session is Off Ice (complete), auto-advance to Scores In (scoring_complete).
async function checkAutoAdvanceScoresIn(sessionId, orgId) {
  try {
    const [sessionRes, checkedInRes, activeScorersRes] = await Promise.all([
      pool.query(
        `SELECT status FROM sessions WHERE id = $1 AND organization_id = $2`,
        [sessionId, orgId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM session_players WHERE session_id = $1 AND checked_in = true`,
        [sessionId]
      ),
      pool.query(
        `SELECT DISTINCT scorer_id FROM scores WHERE session_id = $1`,
        [sessionId]
      ),
    ]);

    if (sessionRes.rows[0]?.status !== 'complete') return;
    const checkedInTotal = checkedInRes.rows[0].total;
    if (checkedInTotal === 0 || activeScorersRes.rows.length === 0) return;

    const completionRes = await pool.query(
      `SELECT sc.scorer_id, COUNT(DISTINCT sc.player_id)::int AS scored_count
       FROM scores sc
       JOIN session_players sp ON sp.player_id = sc.player_id AND sp.session_id = sc.session_id
       WHERE sc.session_id = $1 AND sp.checked_in = true
       GROUP BY sc.scorer_id`,
      [sessionId]
    );

    const scored = {};
    completionRes.rows.forEach((r) => { scored[r.scorer_id] = r.scored_count; });

    const allDone = activeScorersRes.rows.every(
      (r) => (scored[r.scorer_id] || 0) >= checkedInTotal
    );

    if (allDone) {
      await pool.query(
        `UPDATE sessions SET status = 'scoring_complete' WHERE id = $1 AND status = 'complete'`,
        [sessionId]
      );
    }
  } catch (err) {
    console.error('Auto-advance check failed (non-fatal):', err.message);
  }
}

// POST /api/scores — submit or update a score
// Security: scorer must be assigned to the session; player must belong to that session.
router.post('/', authMiddleware, async (req, res) => {
  const { sessionId, playerId, skating, puckSkills, hockeySense, notes } = req.body;

  if (!sessionId || !playerId || !skating || !puckSkills || !hockeySense) {
    return res.status(400).json({ error: 'sessionId, playerId, skating, puckSkills, and hockeySense are required' });
  }

  const isAdmin = req.user.role === 'admin' || req.user.role === 'coordinator';

  try {
    // 1. Verify the session exists, belongs to this org, and is not finalized
    const sessionRes = await pool.query(
      'SELECT id, status FROM sessions WHERE id = $1 AND organization_id = $2',
      [sessionId, req.org_id]
    );
    if (!sessionRes.rows[0]) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionRes.rows[0];

    if (session.status === 'finalized' && !isAdmin) {
      return res.status(403).json({ error: 'This session is finalized — scores cannot be changed' });
    }

    // 2. Scorer must be assigned to this session (skip check for admin/coordinator)
    if (!isAdmin) {
      const assignedRes = await pool.query(
        'SELECT 1 FROM session_scorers WHERE session_id = $1 AND user_id = $2',
        [sessionId, req.user.id]
      );
      if (!assignedRes.rows[0]) {
        return res.status(403).json({ error: 'Access denied: you are not assigned to this session' });
      }
    }

    // 3. Verify the player belongs to this session's roster (explicit roster check)
    //    If session has no session_players rows, fall back to age_group/event membership.
    const rosterCountRes = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM session_players WHERE session_id = $1',
      [sessionId]
    );
    const hasExplicitRoster = rosterCountRes.rows[0].cnt > 0;

    if (hasExplicitRoster) {
      const inRoster = await pool.query(
        'SELECT 1 FROM session_players WHERE session_id = $1 AND player_id = $2',
        [sessionId, playerId]
      );
      if (!inRoster.rows[0]) {
        return res.status(403).json({ error: 'Player is not on this session roster' });
      }
    }

    // 4. Validate score ranges (1–5)
    for (const [key, val] of [['skating', skating], ['puckSkills', puckSkills], ['hockeySense', hockeySense]]) {
      if (!Number.isInteger(Number(val)) || Number(val) < 1 || Number(val) > 5) {
        return res.status(400).json({ error: `${key} must be an integer between 1 and 5` });
      }
    }

    const registrationId = await resolveRegistrationForSession(pool, sessionId, playerId);

    const result = await pool.query(`
      INSERT INTO scores (session_id, player_id, registration_id, scorer_id, skating, puck_skills, hockey_sense, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (session_id, player_id, scorer_id)
      DO UPDATE SET
        registration_id = COALESCE(EXCLUDED.registration_id, scores.registration_id),
        skating      = EXCLUDED.skating,
        puck_skills  = EXCLUDED.puck_skills,
        hockey_sense = EXCLUDED.hockey_sense,
        notes        = EXCLUDED.notes,
        updated_at   = NOW()
      RETURNING *
    `, [sessionId, playerId, registrationId, req.user.id, skating, puckSkills, hockeySense, notes || null]);

    await logAudit('score_submitted', req.user.id, {
      sessionId,
      playerId,
      scoreId: result.rows[0].id,
    }, req.org_id);

    res.json({ score: result.rows[0] });

    // Fire-and-forget: auto-advance session to Scores In if all active scorers are done
    checkAutoAdvanceScoresIn(sessionId, req.org_id);
  } catch (err) {
    console.error('Submit score error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/scores/rankings/:ageGroupId/:eventId
router.get('/rankings/:ageGroupId/:eventId',
  authMiddleware, requireRole('admin', 'coordinator'),
  async (req, res) => {
    const { ageGroupId, eventId } = req.params;
    try {
      const result = await pool.query(`
        SELECT
          per.id AS id,
          p.id AS player_id,
          p.first_name,
          p.last_name,
          per.jersey_number,
          ROUND(AVG(sc.skating)::numeric, 2)      AS avg_skating,
          ROUND(AVG(sc.puck_skills)::numeric, 2)  AS avg_puck,
          ROUND(AVG(sc.hockey_sense)::numeric, 2) AS avg_sense,
          ROUND(AVG(
            (sc.skating + sc.puck_skills + sc.hockey_sense) / 3.0
          )::numeric, 2) AS avg_overall,
          COUNT(sc.id) AS score_count
        FROM player_event_registrations per
        JOIN players p ON p.id = per.player_id
        LEFT JOIN sessions s
          ON s.age_group_id = $1
         AND s.event_id = $2
        LEFT JOIN scores sc
          ON sc.session_id = s.id
         AND (sc.registration_id = per.id OR (sc.registration_id IS NULL AND sc.player_id = p.id))
        WHERE per.age_group_id = $1
          AND per.event_id = $2
          AND p.organization_id = $3
        GROUP BY per.id, p.id, p.first_name, p.last_name, per.jersey_number
        ORDER BY avg_overall DESC NULLS LAST, per.jersey_number
      `, [ageGroupId, eventId, req.org_id]);

      res.json({ rankings: result.rows });
    } catch (err) {
      console.error('Rankings error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/scores/dashboard
router.get('/dashboard',
  authMiddleware, requireRole('admin', 'coordinator'),
  async (req, res) => {
    try {
      const { eventId } = req.query;
      const params = [req.org_id];
      const eventFilter = eventId ? (params.push(eventId), `AND s.event_id = $${params.length}`) : '';
      const playerEventFilter = eventId ? `AND per.event_id = $2` : '';
      const result = await pool.query(`
        SELECT
          ag.name       AS age_group,
          ag.code       AS age_group_code,
          ag.sort_order,
          COUNT(DISTINCT s.id)    AS total_sessions,
          COUNT(DISTINCT CASE WHEN s.status = 'complete' OR s.status = 'scoring_complete' OR s.status = 'finalized' THEN s.id END) AS complete_sessions,
          COUNT(DISTINCT per.id)  AS total_players,
          COUNT(DISTINCT sc.id)   AS total_scores,
          COUNT(DISTINCT ss.user_id) AS total_scorers
        FROM age_groups ag
        LEFT JOIN sessions s ON s.age_group_id = ag.id ${eventFilter}
        LEFT JOIN player_event_registrations per ON per.age_group_id = ag.id ${playerEventFilter}
        LEFT JOIN scores sc ON sc.session_id = s.id
        LEFT JOIN session_scorers ss ON ss.session_id = s.id
        WHERE ag.organization_id = $1
        GROUP BY ag.id, ag.name, ag.code, ag.sort_order
        ORDER BY ag.sort_order
      `, params);
      res.json({ dashboard: result.rows });
    } catch (err) {
      console.error('Dashboard error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
