/**
 * import.js
 * CSV import endpoint for player roster onboarding.
 * Accepts CSV as plain text (no file upload dependency needed).
 * Frontend reads file via FileReader.readAsText() and sends it as JSON.
 *
 * Supports SportEngine export column naming conventions via alias mapping.
 * Duplicate jersey numbers produce warnings, not errors — both rows import.
 * Players with a matching external_id (SportEngine profileId) are upserted.
 */

const express = require('express');
const pool    = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { assignPlayerToSessions } = require('../utils/session-assignment');
const { findOrCreatePlayer, upsertPlayerRegistration } = require('../utils/registrations');

const router = express.Router();
const guard  = [authMiddleware, requireRole('admin', 'coordinator')];

// ─────────────────────────────────────────
// CSV PARSING HELPERS
// ─────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

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

// ─────────────────────────────────────────
// ALIAS MAPPING
// ─────────────────────────────────────────

const ALIASES = {
  first_name: [
    'first_name', 'firstname', 'first', 'player_first_name', 'given_name',
    'participant_first_name',
  ],
  last_name: [
    'last_name', 'lastname', 'last', 'player_last_name', 'surname',
    'participant_last_name',
  ],
  jersey_number: [
    'jersey_number', 'jersey', 'number',
    'jersey_number_during_tryouts_', 'jersey_', 'tryout_number',
    'uniform_number', 'player_number',
  ],
  position: [
    'position', 'position_s_', 'positions', 'position_skater',
  ],
  shot: [
    'shot', 'shoots', 'shot_hand', 'shooting_hand', 'shot_l_or_r', 'shot_l_or_r_',
    'shot_left_or_right', 'preferred_shot', 'preferred_shot_hand',
    'dominant_hand', 'stick_hand', 'handedness', 'hand',
  ],
  will_tryout: [
    'will_player_tryout_', 'will_tryout', 'tryout', 'tryout_participant',
  ],
  birth_year: [
    'birth_year', 'dob_year', 'year_of_birth', 'grad_year',
  ],
  date_of_birth: [
    'date_of_birth', 'dob', 'birthdate', 'birth_date', 'birthday',
    'date_of_birth_mm_dd_yyyy', 'participant_dob',
  ],
  gender: [
    'gender', 'sex', 'participant_gender',
  ],
  external_id: [
    'external_id', 'profile_id', 'profileid', 'se_id',
    'sports_engine_id', 'registration_id',
  ],
};

function mapPlayerFields(row) {
  const mapped = {};
  for (const [field, aliasList] of Object.entries(ALIASES)) {
    for (const alias of aliasList) {
      if (row[alias] !== undefined && row[alias] !== '') {
        mapped[field] = row[alias];
        break;
      }
    }
  }
  return mapped;
}

// ─────────────────────────────────────────
// FIELD NORMALIZERS
// ─────────────────────────────────────────

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

// Returns 'L', 'R', or null. Warns on unrecognized values.
function normalizeShot(raw) {
  if (!raw) return { value: null, warn: false };
  const upper = raw.trim().toUpperCase();
  if (upper === 'L' || upper === 'LEFT')  return { value: 'L', warn: false };
  if (upper === 'R' || upper === 'RIGHT') return { value: 'R', warn: false };
  return { value: null, warn: true };
}

// Accepts MM/DD/YYYY, YYYY-MM-DD, DD-Mon-YYYY
function parseDateOfBirth(raw) {
  if (!raw) return null;
  const s = raw.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`;

  // DD-Mon-YYYY  e.g. 15-Jan-2015
  const dmy = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmy) {
    const months = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                     jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
    const mo = months[dmy[2].toLowerCase()];
    if (mo) return `${dmy[3]}-${mo}-${dmy[1].padStart(2,'0')}`;
  }

  return null; // unparseable — caller treats as null
}

function normalizeGender(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (lower === 'male'   || lower === 'm') return 'M';
  if (lower === 'female' || lower === 'f') return 'F';
  return null;
}

// ─────────────────────────────────────────
// GET /api/import/csv-template
// ─────────────────────────────────────────
router.get('/csv-template', ...guard, (_req, res) => {
  const csv = [
    'first_name,last_name,jersey_number,position,shot,will_tryout,birth_year,date_of_birth,gender,external_id',
    'Jake,Thompson,1,skater,L,yes,2018,01/15/2018,male,',
    'Sam,Rivera,2,goalie,R,yes,2018,03/22/2018,female,',
    'Alex,Brooks,3,defense,L,yes,2017,07/04/2017,male,',
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="player-import-template.csv"');
  res.send(csv);
});

// ─────────────────────────────────────────
// POST /api/import/preview
// Parse CSV, return preview. Does NOT write to DB.
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

    // jersey counts within this batch (for duplicate detection)
    const batchJerseyCount = {};
    rows.forEach(row => {
      const fields = mapPlayerFields(row);
      const num = parseInt(fields.jersey_number);
      if (!isNaN(num)) batchJerseyCount[num] = (batchJerseyCount[num] || 0) + 1;
    });

    // Load existing jerseys and external_ids for context
    const [existingRes, externalRes, blocksRes] = await Promise.all([
      pool.query(
        `SELECT per.jersey_number
         FROM player_event_registrations per
         WHERE per.age_group_id = $1
           AND per.event_id = $2`,
        [ageGroupId, eventId]
      ),
      pool.query(
        `SELECT external_id
         FROM players
         WHERE external_id IS NOT NULL`
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

    const existingJerseys    = new Set(existingRes.rows.map(r => r.jersey_number));
    const existingExternalIds = new Set(
      externalRes.rows.map(r => r.external_id)
    );
    const sessions = blocksRes.rows;

    for (const row of rows) {
      const fields = mapPlayerFields(row);
      const shotResult = normalizeShot(fields.shot);

      const result = {
        raw:          row,
        firstName:    fields.first_name    || '',
        lastName:     fields.last_name     || '',
        jerseyNumber: parseInt(fields.jersey_number) || null,
        position:     normalizePosition(fields.position),
        shot:         shotResult.value,
        willTryout:   parseWillTryout(fields.will_tryout),
        birthYear:    parseInt(fields.birth_year) || null,
        dateOfBirth:  parseDateOfBirth(fields.date_of_birth),
        gender:       normalizeGender(fields.gender),
        externalId:   fields.external_id || null,
        warnings:     [],
        errors:       [],
        assignedSession: null,
        status:       'ok',
      };

      // Hard errors: missing required fields
      if (!result.firstName)  result.errors.push('Missing first_name');
      if (!result.lastName)   result.errors.push('Missing last_name');
      if (!result.jerseyNumber || isNaN(result.jerseyNumber)) {
        result.errors.push('Missing or invalid jersey_number');
      }

      // Warnings: shot hand unrecognized
      if (fields.shot && shotResult.warn) {
        result.warnings.push(`Unrecognized shot value "${fields.shot}" — will be stored as NULL`);
      }

      // Warning: duplicate jersey in this batch
      if (result.jerseyNumber && batchJerseyCount[result.jerseyNumber] > 1) {
        result.warnings.push(`Jersey #${result.jerseyNumber} appears more than once in this file`);
      }

      // Warning: duplicate jersey vs existing DB
      if (result.jerseyNumber && existingJerseys.has(result.jerseyNumber)) {
        result.warnings.push(`Jersey #${result.jerseyNumber} already exists in this group`);
      }

      // Info: external_id match → will upsert
      if (result.externalId && existingExternalIds.has(result.externalId)) {
        result.warnings.push(`external_id ${result.externalId} already exists — will update existing player`);
        result.status = 'update';
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
      total:    preview.length,
      valid:    preview.filter(r => r.status === 'ok' || r.status === 'update').length,
      warnings: preview.filter(r => r.warnings.length > 0).length,
      errors:   preview.filter(r => r.status === 'error').length,
    };

    res.json({ preview, summary });
  } catch (err) {
    console.error('Import preview error:', err);
    res.status(400).json({ error: err.message || 'Failed to parse CSV' });
  }
});

// ─────────────────────────────────────────
// POST /api/import/commit
// Commit parsed CSV to database.
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

    const rows    = parseCSV(csvText);
    const added   = [];
    const updated = [];
    const errors  = [];

    for (const row of rows) {
      const fields = mapPlayerFields(row);

      const firstName    = (fields.first_name    || '').trim();
      const lastName     = (fields.last_name     || '').trim();
      const jerseyNumber = parseInt(fields.jersey_number);
      const position     = normalizePosition(fields.position);
      const willTryout   = parseWillTryout(fields.will_tryout);
      const birthYear    = parseInt(fields.birth_year) || null;
      const dateOfBirth  = parseDateOfBirth(fields.date_of_birth);
      const shotResult   = normalizeShot(fields.shot);
      const shot         = shotResult.value;
      const gender       = normalizeGender(fields.gender);
      const externalId   = fields.external_id || null;

      if (!firstName || !lastName || isNaN(jerseyNumber)) {
        errors.push({ row, reason: 'Missing first_name, last_name, or jersey_number' });
        continue;
      }

      try {
        const player = await findOrCreatePlayer(client, {
          firstName,
          lastName,
          dateOfBirth,
          gender,
          externalId,
          shot,
          birthYear,
        });

        const registration = await upsertPlayerRegistration(client, {
          playerId: player.id,
          eventId,
          ageGroupId,
          jerseyNumber,
          position,
          shot,
          willTryout,
          outcome: null,
        });

        if (registration.was_updated) {
          updated.push({
            id: registration.id,
            player_id: player.id,
            first_name: player.first_name,
            last_name: player.last_name,
            jersey_number: registration.jersey_number,
            age_group_id: registration.age_group_id,
            event_id: registration.event_id,
            position: registration.position,
            shot: registration.shot,
            gender: player.gender,
            external_id: player.external_id,
          });
        } else {
          added.push({
            id: registration.id,
            player_id: player.id,
            first_name: player.first_name,
            last_name: player.last_name,
            jersey_number: registration.jersey_number,
            age_group_id: registration.age_group_id,
            event_id: registration.event_id,
            position: registration.position,
            shot: registration.shot,
            gender: player.gender,
            external_id: player.external_id,
          });
        }

        await assignPlayerToSessions(client, player.id, ageGroupId, eventId);
      } catch (e) {
        if (e.code === '23505') {
          errors.push({ firstName, lastName, jerseyNumber, reason: 'player or registration conflict' });
        } else {
          errors.push({ firstName, lastName, jerseyNumber, reason: e.message });
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      summary: { added: added.length, updated: updated.length, errors: errors.length },
      added,
      updated,
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
