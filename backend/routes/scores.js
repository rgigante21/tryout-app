const express = require('express');
const pool    = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/scores - submit or update a score
router.post('/', authMiddleware, async (req, res) => {
  const { sessionId, playerId, skating, puckSkills, hockeySense, notes } = req.body;

  if (!sessionId || !playerId || !skating || !puckSkills || !hockeySense) {
    return res.status(400).json({ error: 'All score fields required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO scores (session_id, player_id, scorer_id, skating, puck_skills, hockey_sense, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (session_id, player_id, scorer_id)
      DO UPDATE SET
        skating      = EXCLUDED.skating,
        puck_skills  = EXCLUDED.puck_skills,
        hockey_sense = EXCLUDED.hockey_sense,
        notes        = EXCLUDED.notes,
        updated_at   = NOW()
      RETURNING *
    `, [sessionId, playerId, req.user.id, skating, puckSkills, hockeySense, notes || null]);

    res.json({ score: result.rows[0] });
  } catch (err) {
    console.error('Submit score error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/scores/rankings/:ageGroupId/:eventId - combined rankings
router.get('/rankings/:ageGroupId/:eventId',
  authMiddleware, requireRole('admin', 'coordinator'),
  async (req, res) => {
    const { ageGroupId, eventId } = req.params;
    try {
      const result = await pool.query(`
        SELECT
          p.id,
          p.first_name,
          p.last_name,
          p.jersey_number,
          ROUND(AVG(sc.skating)::numeric, 2)      AS avg_skating,
          ROUND(AVG(sc.puck_skills)::numeric, 2)  AS avg_puck,
          ROUND(AVG(sc.hockey_sense)::numeric, 2) AS avg_sense,
          ROUND(AVG(
            (sc.skating + sc.puck_skills + sc.hockey_sense) / 3.0
          )::numeric, 2) AS avg_overall,
          COUNT(sc.id) AS score_count
        FROM players p
        LEFT JOIN scores sc ON sc.player_id = p.id
        LEFT JOIN sessions s ON s.id = sc.session_id
          AND s.age_group_id = $1
          AND s.event_id = $2
        WHERE p.age_group_id = $1
          AND p.event_id = $2
        GROUP BY p.id, p.first_name, p.last_name, p.jersey_number
        ORDER BY avg_overall DESC NULLS LAST, p.jersey_number
      `, [ageGroupId, eventId]);

      res.json({ rankings: result.rows });
    } catch (err) {
      console.error('Rankings error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/scores/dashboard - ops dashboard summary
router.get('/dashboard',
  authMiddleware, requireRole('admin', 'coordinator'),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          ag.name       AS age_group,
          ag.code       AS age_group_code,
          ag.sort_order,
          COUNT(DISTINCT s.id)    AS total_sessions,
          COUNT(DISTINCT CASE WHEN s.status = 'complete' THEN s.id END) AS complete_sessions,
          COUNT(DISTINCT p.id)    AS total_players,
          COUNT(DISTINCT sc.id)   AS total_scores,
          COUNT(DISTINCT ss.user_id) AS total_scorers
        FROM age_groups ag
        LEFT JOIN sessions s ON s.age_group_id = ag.id
        LEFT JOIN players p ON p.age_group_id = ag.id
        LEFT JOIN scores sc ON sc.session_id = s.id
        LEFT JOIN session_scorers ss ON ss.session_id = s.id
        GROUP BY ag.id, ag.name, ag.code, ag.sort_order
        ORDER BY ag.sort_order
      `);
      res.json({ dashboard: result.rows });
    } catch (err) {
      console.error('Dashboard error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
