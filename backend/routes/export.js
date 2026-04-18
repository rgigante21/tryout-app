/**
 * export.js
 * Event-scoped export routes: /api/events/:eventId/export/...
 *
 * All endpoints are read-only. No DB writes except audit log entries.
 * Exports are streamed directly as CSV (no full in-memory buffer).
 *
 * Endpoints:
 *   GET /api/events/:eventId/export/team-recommendations
 *   GET /api/events/:eventId/export/sportsengine
 *
 * Query params:
 *   ageGroupId     — optional integer, filter by age group
 *   finalizedOnly  — boolean string ('true'/'false'), include scores from finalized sessions only
 *   outcome        — optional player outcome filter
 *   includeNotes   — boolean string ('true'/'false'), for team-recommendations only
 *
 * TODO: When score_entries (per-criterion weighted scoring) becomes the primary
 * scoring path, update SCORE_AGGREGATION_SQL to use a lateral join aggregating
 * score_entries instead of the legacy skating/puck_skills/hockey_sense columns.
 */

const express = require('express');
const pool    = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { csvRow, formatDateSE, formatShotSE, formatGenderSE, safeFilename } = require('../utils/export-formatters');

const router = express.Router({ mergeParams: true });
const guard  = [authMiddleware, requireRole('admin', 'coordinator')];

// ─────────────────────────────────────────
// SHARED: score aggregation query
// Returns one row per player registration for an event, with averaged scores.
// ─────────────────────────────────────────

const SCORE_AGGREGATION_SQL = `
  SELECT
    p.id                                                                    AS player_id,
    p.first_name,
    p.last_name,
    p.external_id,
    p.date_of_birth,
    p.gender,
    per.jersey_number,
    per.position,
    per.shot,
    per.will_tryout,
    per.outcome,
    ag.name                                                                 AS age_group,
    ag.code                                                                 AS age_group_code,
    COUNT(DISTINCT sc.session_id)                                           AS sessions_scored,
    ROUND(AVG(sc.skating)::numeric, 2)                                     AS avg_skating,
    ROUND(AVG(sc.puck_skills)::numeric, 2)                                 AS avg_puck_skills,
    ROUND(AVG(sc.hockey_sense)::numeric, 2)                                AS avg_hockey_sense,
    ROUND(
      AVG(
        (COALESCE(sc.skating, 0) + COALESCE(sc.puck_skills, 0) + COALESCE(sc.hockey_sense, 0)) / 3.0
      )::numeric, 2
    )                                                                       AS avg_overall,
    STRING_AGG(sc.notes, ' | ' ORDER BY sc.created_at)                    AS all_notes
  FROM player_event_registrations per
  JOIN players p        ON p.id  = per.player_id
  JOIN age_groups ag    ON ag.id = per.age_group_id
  LEFT JOIN sessions s  ON s.event_id = per.event_id
    AND s.age_group_id = per.age_group_id
    AND ($3::bool = false OR s.status = 'finalized')
  LEFT JOIN scores sc   ON sc.session_id = s.id
    AND (
      sc.registration_id = per.id
      OR (sc.registration_id IS NULL AND sc.player_id = p.id)
    )
  WHERE per.event_id = $1
    AND ($2::int IS NULL OR per.age_group_id = $2)
    AND ($4::text IS NULL OR per.outcome = $4)
  GROUP BY
    p.id, p.first_name, p.last_name, p.external_id, p.date_of_birth, p.gender,
    per.jersey_number, per.position, per.shot, per.will_tryout, per.outcome,
    ag.name, ag.code, ag.sort_order
  ORDER BY ag.sort_order, avg_overall DESC NULLS LAST, per.jersey_number
`;

function parseExportFilters(req) {
  const ageGroupId = req.query.ageGroupId ? parseInt(req.query.ageGroupId, 10) : null;
  const finalizedOnly = req.query.finalizedOnly === 'true';
  const outcome = req.query.outcome || null;
  const validOutcomes = ['moved_up', 'retained', 'left_program'];

  if (req.query.ageGroupId && Number.isNaN(ageGroupId)) {
    return { error: 'ageGroupId must be a number' };
  }
  if (outcome && !validOutcomes.includes(outcome)) {
    return { error: `outcome must be one of: ${validOutcomes.join(', ')}` };
  }

  return { ageGroupId, finalizedOnly, outcome };
}

function exportQueryParams(eventId, filters) {
  return [eventId, filters.ageGroupId || null, filters.finalizedOnly, filters.outcome];
}

// GET /:eventId/export/preview
// Cheap row-count preview for export filters.
router.get('/:eventId/export/preview', ...guard, async (req, res) => {
  const { eventId } = req.params;
  const type = req.query.type === 'sportsengine' ? 'sportsengine' : 'team-recommendations';
  const filters = parseExportFilters(req);
  if (filters.error) return res.status(400).json({ error: filters.error });

  try {
    const { rows: evRows } = await pool.query('SELECT id FROM tryout_events WHERE id = $1', [eventId]);
    if (!evRows[0]) return res.status(404).json({ error: 'Event not found' });

    const { rows } = await pool.query(SCORE_AGGREGATION_SQL, exportQueryParams(eventId, filters));
    const filteredRows = type === 'sportsengine'
      ? rows.filter((r) => r.will_tryout !== false)
      : rows;

    res.json({ rowCount: filteredRows.length });
  } catch (err) {
    console.error('[export] preview error:', err);
    res.status(500).json({ error: 'Export preview failed' });
  }
});

// ─────────────────────────────────────────
// GET /:eventId/export/team-recommendations
// Full tryout results CSV for internal admin use.
// ─────────────────────────────────────────

router.get('/:eventId/export/team-recommendations', ...guard, async (req, res) => {
  const { eventId } = req.params;
  const filters = parseExportFilters(req);
  if (filters.error) return res.status(400).json({ error: filters.error });
  const includeNotes = req.query.includeNotes !== 'false';

  try {
    // Validate event exists and get name for filename
    const { rows: evRows } = await pool.query(
      'SELECT name, season FROM tryout_events WHERE id = $1', [eventId]
    );
    if (!evRows[0]) return res.status(404).json({ error: 'Event not found' });

    const { rows } = await pool.query(SCORE_AGGREGATION_SQL, exportQueryParams(eventId, filters));

    const eventSlug    = safeFilename(evRows[0].name);
    const seasonSlug   = safeFilename(evRows[0].season || '');
    const dateStr      = new Date().toISOString().slice(0, 10);
    const filename     = `team-recommendations-${eventSlug}${seasonSlug ? `-${seasonSlug}` : ''}-${dateStr}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const headers = [
      'jersey_number', 'first_name', 'last_name', 'position', 'shot', 'gender',
      'date_of_birth', 'age_group', 'sessions_scored',
      'avg_skating', 'avg_puck_skills', 'avg_hockey_sense', 'avg_overall', 'outcome',
    ];
    if (includeNotes) headers.push('notes');

    res.write(csvRow(headers) + '\n');

    for (const r of rows) {
      const values = [
        r.jersey_number ?? '',
        r.first_name,
        r.last_name,
        r.position ?? '',
        r.shot ?? '',
        r.gender ?? '',
        r.date_of_birth ? String(r.date_of_birth).slice(0, 10) : '',
        r.age_group,
        r.sessions_scored ?? 0,
        r.avg_skating ?? '',
        r.avg_puck_skills ?? '',
        r.avg_hockey_sense ?? '',
        r.avg_overall ?? '',
        r.outcome ?? '',
      ];
      if (includeNotes) values.push(r.all_notes ?? '');
      res.write(csvRow(values) + '\n');
    }

    res.end();

    await logAudit('export_team_recommendations', req.user?.id, {
      eventId,
      ageGroupId: filters.ageGroupId,
      finalizedOnly: filters.finalizedOnly,
      outcome: filters.outcome,
      rowCount: rows.length,
      includeNotes,
    });
  } catch (err) {
    console.error('[export] team-recommendations error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Export failed' });
    }
  }
});

// ─────────────────────────────────────────
// GET /:eventId/export/sportsengine
// SportsEngine-compatible roster CSV for downstream roster handling.
// Only includes players where will_tryout = true.
// Values formatted to SportsEngine conventions:
//   shot: L → Left, R → Right
//   gender: M → male, F → female
//   date_of_birth: YYYY-MM-DD → MM/DD/YYYY
//   external_id exported as profile_id
// ─────────────────────────────────────────

router.get('/:eventId/export/sportsengine', ...guard, async (req, res) => {
  const { eventId } = req.params;
  const filters = parseExportFilters(req);
  if (filters.error) return res.status(400).json({ error: filters.error });

  try {
    const { rows: evRows } = await pool.query(
      'SELECT name FROM tryout_events WHERE id = $1', [eventId]
    );
    if (!evRows[0]) return res.status(404).json({ error: 'Event not found' });

    const { rows: allRows } = await pool.query(SCORE_AGGREGATION_SQL, exportQueryParams(eventId, filters));
    // Filter to tryout participants only
    const rows = allRows.filter(r => r.will_tryout !== false);

    const ageCodeSlug = filters.ageGroupId
      ? safeFilename((rows[0]?.age_group_code) || String(filters.ageGroupId))
      : 'all';
    const dateStr  = new Date().toISOString().slice(0, 10);
    const filename = `sportsengine-roster-${ageCodeSlug}-${dateStr}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const headers = [
      'profile_id', 'first_name', 'last_name', 'date_of_birth',
      'gender', 'jersey_number', 'position', 'shot',
    ];

    res.write(csvRow(headers) + '\n');

    for (const r of rows) {
      const values = [
        r.external_id ?? '',
        r.first_name,
        r.last_name,
        formatDateSE(r.date_of_birth),
        formatGenderSE(r.gender),
        r.jersey_number ?? '',
        r.position ?? '',
        formatShotSE(r.shot),
      ];
      res.write(csvRow(values) + '\n');
    }

    res.end();

    await logAudit('export_sportsengine', req.user?.id, {
      eventId,
      ageGroupId: filters.ageGroupId,
      finalizedOnly: filters.finalizedOnly,
      outcome: filters.outcome,
      rowCount: rows.length,
    });
  } catch (err) {
    console.error('[export] sportsengine error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Export failed' });
    }
  }
});

module.exports = router;
