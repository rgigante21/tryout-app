/**
 * import.js
 * CSV import endpoint for player roster onboarding.
 * Accepts CSV as plain text (no file upload dependency needed).
 * Frontend reads file via FileReader.readAsText() and sends it as JSON.
 *
 * Supports SportEngine export column naming conventions.
 */

const express = require('express');
const pool    = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { assignPlayerToSessions } = require('../utils/session-assignment');

const router = express.Router();
const guard  = [authMiddleware, requireRole('admin', 'coordinator')];

// ─────────────────────────────────────────
// CSV PARSING HELPERS
// ─────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

  // Normalize headers: lowercase, replace spaces/special chars with underscore
  const headers = lines[0]
    .split(',')
    .map(h => h.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
    );

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle basic quoted fields
    const values = splitCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line) {
  const values = [];
  let current  = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

// Map raw CSV row to player fields using known SportEngine/common aliases
function mapPlayerFields(row) {
  const aliases = {
    first_name:    ['first_name', 'firstname', 'first', 'player_first_name', 'given_name'],
    last_name:     ['last_name', 'lastname', 'last', 'player_last_name', 'surname'],
    jersey_number: ['jersey_number', 'jersey', 'number', 'jersey_number_during_tryouts_', 'jersey_', 'tryout_number'],
    position:      ['position', 'position_s_', 'positions', 'position_skater'],
    will_tryout:   ['will_player_tryout_', 'will_tryout', 'tryout', 'tryout_participant'],
    birth_year:    ['birth_year', 'dob_year', 'year_of_birth', 'grad_year'],
  };

  const mapped = {};
  for (const [field, aliasList] of Object.entries(aliases)) {
    for (const alias of aliasList) {
      if (row[alias] !== undefined && row[alias] !== '') {
        mapped[field] = row[alias];
        break;
      }
    }
  }
  return mapped;
}

function normalizePosition(raw) {
  if (!raw) return 'skater';
  const lower = raw.toLowerCase();
  if (lower.includes('goalie') || lower.includes('goaltender') || lower.includes('keeper')) return 'goalie';
  if (lower.includes('defense') || lower.includes('defence') || lower.includes('def')) return 'defense';
  if (lower.includes('forward') || lower.includes('fwd')) return 'forward';
  return 'skater';
}

function parseWillTryout(raw) {
  if (raw === undefined || raw === null || raw === '') return true;
  const lower = String(raw).toLowerCase().trim();
  return !['no', 'false', '0', 'n'].includes(lower);
}

// ─────────────────────────────────────────
// GET /api/import/csv-template
// Download a sample CSV file for import
// ─────────────────────────────────────────
router.get('/csv-template', ...guard, (_req, res) => {
  const csv = [
    'first_name,last_name,jersey_number,position,will_tryout,birth_year',
    'Jake,Thompson,1,skater,yes,2018',
    'Sam,Rivera,2,goalie,yes,2018',
    'Alex,Brooks,3,defense,yes,2017',
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="player-import-template.csv"');
  res.send(csv);
});

// ─────────────────────────────────────────
// POST /api/import/preview
// Parse CSV and return preview with session assignment preview
// Does NOT write to database
//
// Body: { csvText, eventId, ageGroupId }
// ─────────────────────────────────────────
router.post('/preview', ...guard, async (req, res) => {
  const { csvText, eventId, ageGroupId } = req.body;

  if (!csvText || !eventId || !ageGroupId) {
    return res.status(400).json({ error: 'csvText, eventId, ageGroupId required' });
  }

  try {
    const rows    = parseCSV(csvText);
    const preview = [];
    const seen    = new Set(); // jersey numbers seen in this import

    // Load existing players and sessions for context
    const [existingRes, blocksRes] = await Promise.all([
      pool.query(
        'SELECT jersey_number FROM players WHERE age_group_id = $1 AND event_id = $2',
        [ageGroupId, eventId]
      ),
      pool.query(
        `SELECT sb.split_method, s.id AS session_id, s.name AS session_name,
                s.start_time, s.last_name_start, s.last_name_end,
                s.jersey_min, s.jersey_max
         FROM session_blocks sb
         JOIN sessions s ON s.block_id = sb.id
         WHERE sb.age_group_id = $1 AND sb.event_id = $2 AND sb.block_type = 'skills'
         ORDER BY s.start_time`,
        [ageGroupId, eventId]
      ),
    ]);

    const existingJerseys = new Set(existingRes.rows.map(r => r.jersey_number));
    const sessions        = blocksRes.rows;

    for (const row of rows) {
      const fields = mapPlayerFields(row);
      const result = {
        raw:          row,
        firstName:    fields.first_name    || '',
        lastName:     fields.last_name     || '',
        jerseyNumber: parseInt(fields.jersey_number) || null,
        position:     normalizePosition(fields.position),
        willTryout:   parseWillTryout(fields.will_tryout),
        birthYear:    parseInt(fields.birth_year) || null,
        warnings:     [],
        errors:       [],
        assignedSession: null,
        status:       'ok',
      };

      // Validation
      if (!result.firstName) result.errors.push('Missing first_name');
      if (!result.lastName)  result.errors.push('Missing last_name');
      if (!result.jerseyNumber || isNaN(result.jerseyNumber)) {
        result.errors.push('Missing or invalid jersey_number');
      }

      // Duplicate in this import batch
      if (result.jerseyNumber && seen.has(result.jerseyNumber)) {
        result.errors.push(`Jersey #${result.jerseyNumber} appears more than once in this file`);
      } else if (result.jerseyNumber) {
        seen.add(result.jerseyNumber);
      }

      // Conflict with existing DB
      if (result.jerseyNumber && existingJerseys.has(result.jerseyNumber)) {
        result.warnings.push(`Jersey #${result.jerseyNumber} already exists — will be skipped`);
        result.status = 'skip';
      }

      // Predict session assignment
      if (result.errors.length === 0 && result.lastName && sessions.length > 0) {
        const initial = result.lastName.charAt(0).toUpperCase();
        for (const session of sessions) {
          let matches = false;
          if (session.split_method === 'last_name') {
            const start = (session.last_name_start || 'A').toUpperCase();
            const end   = (session.last_name_end   || 'Z').toUpperCase();
            matches = initial >= start && initial <= end;
          } else if (session.split_method === 'jersey_range' && result.jerseyNumber) {
            matches = result.jerseyNumber >= (session.jersey_min ?? 0) &&
                      result.jerseyNumber <= (session.jersey_max ?? 99999);
          } else if (session.split_method === 'none') {
            matches = true;
          }
          if (matches) {
            result.assignedSession = {
              id:        session.session_id,
              name:      session.session_name,
              startTime: session.start_time,
            };
            break;
          }
        }
      }

      if (result.errors.length > 0) result.status = 'error';
      preview.push(result);
    }

    const summary = {
      total:   preview.length,
      valid:   preview.filter(r => r.status === 'ok').length,
      skipped: preview.filter(r => r.status === 'skip').length,
      errors:  preview.filter(r => r.status === 'error').length,
    };

    res.json({ preview, summary });
  } catch (err) {
    console.error('Import preview error:', err);
    res.status(400).json({ error: err.message || 'Failed to parse CSV' });
  }
});

// ─────────────────────────────────────────
// POST /api/import/commit
// Commit parsed CSV to database
// Body: { csvText, eventId, ageGroupId }
// ─────────────────────────────────────────
router.post('/commit', ...guard, async (req, res) => {
  const { csvText, eventId, ageGroupId } = req.body;

  if (!csvText || !eventId || !ageGroupId) {
    return res.status(400).json({ error: 'csvText, eventId, ageGroupId required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rows   = parseCSV(csvText);
    const added  = [];
    const skipped = [];
    const errors = [];

    for (const row of rows) {
      const fields = mapPlayerFields(row);

      const firstName    = (fields.first_name    || '').trim();
      const lastName     = (fields.last_name     || '').trim();
      const jerseyNumber = parseInt(fields.jersey_number);
      const position     = normalizePosition(fields.position);
      const willTryout   = parseWillTryout(fields.will_tryout);
      const birthYear    = parseInt(fields.birth_year) || null;

      if (!firstName || !lastName || isNaN(jerseyNumber)) {
        errors.push({ row, reason: 'Missing first_name, last_name, or jersey_number' });
        continue;
      }

      try {
        const r = await client.query(
          `INSERT INTO players
             (first_name, last_name, jersey_number, age_group_id, event_id,
              position, will_tryout, birth_year)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING *`,
          [firstName, lastName, jerseyNumber, ageGroupId, eventId,
           position, willTryout, birthYear]
        );

        const player = r.rows[0];
        added.push(player);

        // Auto-assign player to matching sessions
        await assignPlayerToSessions(client, player.id, ageGroupId, eventId);

      } catch (e) {
        if (e.code === '23505') {
          skipped.push({ firstName, lastName, jerseyNumber, reason: 'Jersey # already used' });
        } else {
          errors.push({ firstName, lastName, jerseyNumber, reason: e.message });
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      summary: { added: added.length, skipped: skipped.length, errors: errors.length },
      added,
      skipped,
      errors,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import commit error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
