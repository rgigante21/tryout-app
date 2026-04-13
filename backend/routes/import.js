/**
 * import.js
 * Event-scoped import routes: /api/events/:eventId/import/...
 *
 * Supports CSV and XLSX uploads via multipart/form-data.
 * Every upload creates an import_batches record and per-row import_batch_rows records.
 * The commit step reads pre-validated mapped_data from import_batch_rows — no re-parsing.
 *
 * Supported import types:
 *   - players          (Sprint 2)
 *   - evaluators       (Sprint 3)
 *   - session_assignments (Sprint 4)
 */

const express = require('express');
const bcrypt  = require('bcrypt');
const pool    = require('../db/pool');
const upload  = require('../middleware/upload');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { parseUpload } = require('../utils/parse-upload');
const { assignPlayerToSessions } = require('../utils/session-assignment');
const { findOrCreatePlayer, upsertPlayerRegistration } = require('../utils/registrations');
const { logAudit } = require('../utils/audit');

const router = express.Router({ mergeParams: true });
const guard  = [authMiddleware, requireRole('admin', 'coordinator')];

// ─────────────────────────────────────────
// PLAYER FIELD ALIASES (SportsEngine-compatible)
// ─────────────────────────────────────────

const PLAYER_ALIASES = {
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
  for (const [field, aliasList] of Object.entries(PLAYER_ALIASES)) {
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`;
  const dmy = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmy) {
    const months = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                     jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
    const mo = months[dmy[2].toLowerCase()];
    if (mo) return `${dmy[3]}-${mo}-${dmy[1].padStart(2,'0')}`;
  }
  return null;
}

function normalizeGender(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (lower === 'male'   || lower === 'm') return 'M';
  if (lower === 'female' || lower === 'f') return 'F';
  return null;
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 12; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
}

// ─────────────────────────────────────────
// SHARED: validate eventId exists
// ─────────────────────────────────────────

async function validateEvent(eventId) {
  const { rows } = await pool.query('SELECT id, name FROM tryout_events WHERE id = $1', [eventId]);
  return rows[0] || null;
}

// ─────────────────────────────────────────
// PLAYER ROW PROCESSOR (preview + validation)
// ─────────────────────────────────────────

async function processPlayerRows(rows, eventId, ageGroupId) {
  // Load existing context for duplicate detection
  const [existingJerseyRes, externalIdRes, blocksRes, crossAgeJerseyRes] = await Promise.all([
    pool.query(
      `SELECT per.jersey_number FROM player_event_registrations per
       WHERE per.age_group_id = $1 AND per.event_id = $2`,
      [ageGroupId, eventId]
    ),
    pool.query(`SELECT external_id FROM players WHERE external_id IS NOT NULL`),
    pool.query(
      `SELECT sb.split_method, s.id AS session_id, s.name AS session_name,
              s.start_time, s.last_name_start, s.last_name_end, s.jersey_min, s.jersey_max
         FROM session_blocks sb
         JOIN sessions s ON s.block_id = sb.id
        WHERE sb.age_group_id = $1 AND sb.event_id = $2 AND sb.block_type = 'skills'
        ORDER BY s.start_time`,
      [ageGroupId, eventId]
    ),
    pool.query(
      `SELECT per.jersey_number FROM player_event_registrations per
       WHERE per.event_id = $1 AND per.age_group_id != $2`,
      [eventId, ageGroupId]
    ),
  ]);

  const existingJerseys     = new Set(existingJerseyRes.rows.map(r => r.jersey_number));
  const existingExternalIds = new Set(externalIdRes.rows.map(r => r.external_id));
  const crossAgeJerseys     = new Set(crossAgeJerseyRes.rows.map(r => r.jersey_number));
  const sessions            = blocksRes.rows;

  // Count jersey occurrences within this batch for intra-file duplicate detection
  const batchJerseyCount = {};
  rows.forEach(row => {
    const fields = mapPlayerFields(row);
    const num = parseInt(fields.jersey_number);
    if (!isNaN(num)) batchJerseyCount[num] = (batchJerseyCount[num] || 0) + 1;
  });

  const processed = [];

  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i];
    const fields = mapPlayerFields(row);
    const shotResult = normalizeShot(fields.shot);
    const jerseyRaw  = parseInt(fields.jersey_number);

    const errors   = [];
    const warnings = [];

    // Required field validation
    if (!fields.first_name) errors.push('Missing first_name');
    if (!fields.last_name)  errors.push('Missing last_name');
    if (!fields.jersey_number || isNaN(jerseyRaw)) {
      errors.push('Missing or invalid jersey_number');
    } else if (jerseyRaw < 1 || jerseyRaw > 99) {
      errors.push(`Jersey number ${jerseyRaw} is invalid — must be between 1 and 99`);
    }

    // Shot warning
    if (fields.shot && shotResult.warn) {
      warnings.push(`Unrecognized shot value "${fields.shot}" — will be stored as NULL`);
    }

    const jerseyNum = isNaN(jerseyRaw) ? null : jerseyRaw;

    // Duplicate jersey warnings
    if (jerseyNum && batchJerseyCount[jerseyNum] > 1) {
      warnings.push(`Jersey #${jerseyNum} appears more than once in this file`);
    }
    if (jerseyNum && existingJerseys.has(jerseyNum)) {
      warnings.push(`Jersey #${jerseyNum} already exists in this age group`);
    }
    if (jerseyNum && crossAgeJerseys.has(jerseyNum)) {
      warnings.push(`Jersey #${jerseyNum} is used in a different age group for this event`);
    }

    // DOB future date warning
    const dob = parseDateOfBirth(fields.date_of_birth);
    if (dob && new Date(dob) > new Date()) {
      warnings.push(`Date of birth ${dob} is in the future — please verify`);
    }

    const externalId = fields.external_id || null;
    let status = errors.length > 0 ? 'error' : 'ok';

    // External ID match → update
    if (externalId && existingExternalIds.has(externalId) && status !== 'error') {
      warnings.push(`external_id ${externalId} matches existing player — will update`);
      status = 'update';
    }

    // Predict session assignment
    let assignedSession = null;
    if (status !== 'error' && fields.last_name && sessions.length > 0) {
      const initial = (fields.last_name || '').charAt(0).toUpperCase();
      for (const session of sessions) {
        let matches = false;
        if (session.split_method === 'last_name') {
          const start = (session.last_name_start || 'A').toUpperCase();
          const end   = (session.last_name_end   || 'Z').toUpperCase();
          matches = initial >= start && initial <= end;
        } else if (session.split_method === 'jersey_range' && jerseyNum) {
          matches = jerseyNum >= (session.jersey_min ?? 0) && jerseyNum <= (session.jersey_max ?? 99999);
        } else if (session.split_method === 'none') {
          matches = true;
        }
        if (matches) {
          assignedSession = { id: session.session_id, name: session.session_name, startTime: session.start_time };
          break;
        }
      }
    }

    const mappedData = {
      firstName:   (fields.first_name || '').trim(),
      lastName:    (fields.last_name  || '').trim(),
      jerseyNumber: jerseyNum,
      position:    normalizePosition(fields.position),
      shot:        shotResult.value,
      willTryout:  parseWillTryout(fields.will_tryout),
      birthYear:   parseInt(fields.birth_year) || null,
      dateOfBirth: dob,
      gender:      normalizeGender(fields.gender),
      externalId,
      eventId:     parseInt(eventId),
      ageGroupId:  parseInt(ageGroupId),
    };

    processed.push({
      rowIndex:       i,
      rawData:        row,
      mappedData,
      status,
      errors,
      warnings,
      assignedSession,
    });
  }

  return processed;
}

// ─────────────────────────────────────────
// EVALUATOR ROW PROCESSOR
// ─────────────────────────────────────────

async function processEvaluatorRows(rows, eventId) {
  const processed = [];

  for (let i = 0; i < rows.length; i++) {
    const row      = rows[i];
    const email    = (row.email || '').trim().toLowerCase();
    const firstName = (row.first_name || row.firstname || row.given_name || '').trim();
    const lastName  = (row.last_name  || row.lastname  || row.surname   || '').trim();
    const role      = (row.role || 'scorer').trim().toLowerCase();
    const sessionNames = (row.session_names || '').split(',').map(s => s.trim()).filter(Boolean);

    const errors   = [];
    const warnings = [];

    if (!email) {
      errors.push('Missing email');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Invalid email: ${email}`);
    }
    if (!firstName) errors.push('Missing first_name');
    if (!lastName)  errors.push('Missing last_name');
    if (!['scorer', 'coordinator', 'admin'].includes(role)) {
      warnings.push(`Unknown role "${role}" — will default to scorer`);
    }

    let status = errors.length > 0 ? 'error' : 'ok';
    let existingUser = null;

    if (status !== 'error') {
      const { rows: userRows } = await pool.query(
        'SELECT id, email, role FROM users WHERE email = $1', [email]
      );
      existingUser = userRows[0] || null;
      if (existingUser) {
        status = 'update';
        if (existingUser.role === 'admin' && role !== 'admin') {
          warnings.push(`User is an admin — role will not be downgraded to "${role}"`);
        }
      }
    }

    // Validate session names belong to this event
    const validatedSessions = [];
    if (sessionNames.length > 0 && status !== 'error') {
      for (const name of sessionNames) {
        const { rows: sRows } = await pool.query(
          'SELECT id, name FROM sessions WHERE event_id = $1 AND name ILIKE $2 LIMIT 1',
          [eventId, name]
        );
        if (sRows[0]) {
          validatedSessions.push(sRows[0]);
        } else {
          errors.push(`Session not found in this event: "${name}"`);
          status = 'error';
        }
      }
    }

    processed.push({
      rowIndex: i,
      rawData:  row,
      mappedData: {
        email,
        firstName,
        lastName,
        role: ['scorer', 'coordinator', 'admin'].includes(role) ? role : 'scorer',
        sessionIds: validatedSessions.map(s => s.id),
        existingUserId: existingUser?.id || null,
        existingRole:   existingUser?.role || null,
        eventId: parseInt(eventId),
      },
      status,
      errors,
      warnings,
    });
  }

  return processed;
}

// ─────────────────────────────────────────
// SESSION ASSIGNMENT ROW PROCESSOR
// ─────────────────────────────────────────

async function processSessionAssignmentRows(rows, eventId, ageGroupId) {
  const processed = [];

  for (let i = 0; i < rows.length; i++) {
    const row     = rows[i];
    const jersey  = parseInt(row.jersey_number);
    const extId   = (row.external_id || '').trim() || null;
    const fromName = (row.from_session_name || row.from_session || '').trim();
    const toName   = (row.to_session_name   || row.to_session   || '').trim();

    const errors   = [];
    const warnings = [];

    if (!fromName) errors.push('Missing from_session_name');
    if (!toName)   errors.push('Missing to_session_name');
    if (isNaN(jersey) && !extId && !row.first_name) {
      errors.push('Must provide jersey_number, external_id, or first_name+last_name to identify player');
    }

    let player      = null;
    let fromSession = null;
    let toSession   = null;

    if (errors.length === 0) {
      // Resolve player
      if (extId) {
        const { rows: pr } = await pool.query(
          `SELECT p.id FROM players p
           JOIN player_event_registrations per ON per.player_id = p.id
           WHERE p.external_id = $1 AND per.event_id = $2 AND per.age_group_id = $3 LIMIT 1`,
          [extId, eventId, ageGroupId]
        );
        player = pr[0] || null;
      }
      if (!player && !isNaN(jersey)) {
        const { rows: pr } = await pool.query(
          `SELECT p.id FROM player_event_registrations per
           JOIN players p ON p.id = per.player_id
           WHERE per.jersey_number = $1 AND per.event_id = $2 AND per.age_group_id = $3 LIMIT 1`,
          [jersey, eventId, ageGroupId]
        );
        player = pr[0] || null;
      }
      if (!player && row.first_name && row.last_name) {
        const { rows: pr } = await pool.query(
          `SELECT p.id FROM players p
           JOIN player_event_registrations per ON per.player_id = p.id
           WHERE lower(p.first_name) = lower($1) AND lower(p.last_name) = lower($2)
             AND per.event_id = $3 AND per.age_group_id = $4 LIMIT 1`,
          [row.first_name, row.last_name, eventId, ageGroupId]
        );
        player = pr[0] || null;
      }

      if (!player) {
        errors.push('Player not found in this event/age group');
      }

      // Resolve sessions
      if (fromName) {
        const { rows: sr } = await pool.query(
          'SELECT id, name, status, age_group_id FROM sessions WHERE event_id = $1 AND name ILIKE $2 LIMIT 1',
          [eventId, fromName]
        );
        fromSession = sr[0] || null;
        if (!fromSession) {
          errors.push(`from_session not found: "${fromName}"`);
        } else if (fromSession.age_group_id !== parseInt(ageGroupId)) {
          errors.push(`from_session "${fromName}" belongs to a different age group`);
        } else if (['complete', 'scoring_complete', 'finalized'].includes(fromSession.status)) {
          warnings.push(`Session "${fromName}" is ${fromSession.status} — reassignment may affect scoring history`);
        }
      }

      if (toName) {
        const { rows: sr } = await pool.query(
          'SELECT id, name, status, age_group_id FROM sessions WHERE event_id = $1 AND name ILIKE $2 LIMIT 1',
          [eventId, toName]
        );
        toSession = sr[0] || null;
        if (!toSession) {
          errors.push(`to_session not found: "${toName}"`);
        } else if (fromSession && toSession.age_group_id !== fromSession.age_group_id) {
          errors.push('from_session and to_session have different age groups');
        }
      }

      // Same session check
      if (fromSession && toSession && fromSession.id === toSession.id) {
        warnings.push('from_session and to_session are the same — row will be skipped');
        if (errors.length === 0) {
          processed.push({ rowIndex: i, rawData: row, mappedData: null, status: 'skipped', errors: [], warnings });
          continue;
        }
      }

      // Check player already in to_session
      if (player && toSession) {
        const { rows: spRows } = await pool.query(
          'SELECT id FROM session_players WHERE session_id = $1 AND player_id = $2',
          [toSession.id, player.id]
        );
        if (spRows.length > 0) {
          warnings.push(`Player is already in session "${toName}" — row will be skipped`);
          if (errors.length === 0) {
            processed.push({ rowIndex: i, rawData: row, mappedData: null, status: 'skipped', errors: [], warnings });
            continue;
          }
        }
      }
    }

    const status = errors.length > 0 ? 'error' : 'ok';

    processed.push({
      rowIndex:   i,
      rawData:    row,
      mappedData: errors.length > 0 ? null : {
        playerId:      player?.id,
        fromSessionId: fromSession?.id,
        toSessionId:   toSession?.id,
        eventId:       parseInt(eventId),
        ageGroupId:    parseInt(ageGroupId),
      },
      status,
      errors,
      warnings,
    });
  }

  return processed;
}

// ─────────────────────────────────────────
// SHARED: store batch + rows in DB
// ─────────────────────────────────────────

async function storeBatch(client, { eventId, ageGroupId, importType, fileName, processedRows, userId }) {
  const rowCount    = processedRows.length;
  const errorCount  = processedRows.filter(r => r.status === 'error').length;
  const updateCount = processedRows.filter(r => r.status === 'update').length;
  const skipCount   = processedRows.filter(r => r.status === 'skipped').length;
  const addCount    = rowCount - errorCount - updateCount - skipCount;

  const { rows: batchRows } = await client.query(
    `INSERT INTO import_batches
       (event_id, age_group_id, import_type, status, file_name,
        row_count, added_count, updated_count, error_count, created_by)
     VALUES ($1, $2, $3, 'preview', $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [eventId, ageGroupId || null, importType, fileName || null,
     rowCount, addCount, updateCount, errorCount, userId || null]
  );
  const batchId = batchRows[0].id;

  for (const pr of processedRows) {
    await client.query(
      `INSERT INTO import_batch_rows
         (batch_id, row_index, raw_data, mapped_data, status, errors, warnings)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [batchId, pr.rowIndex, JSON.stringify(pr.rawData),
       pr.mappedData ? JSON.stringify(pr.mappedData) : null,
       pr.status, pr.errors || [], pr.warnings || []]
    );
  }

  return batchId;
}

// ─────────────────────────────────────────
// TEMPLATE DOWNLOADS
// ─────────────────────────────────────────

router.get('/:eventId/import/players-template', ...guard, (_req, res) => {
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

router.get('/:eventId/import/evaluators-template', ...guard, (_req, res) => {
  const csv = [
    'email,first_name,last_name,role,session_names',
    'coach@example.com,Jane,Smith,scorer,"Mites Skills A, Mites Skills B"',
    'head@example.com,Bob,Johnson,coordinator,',
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="evaluator-import-template.csv"');
  res.send(csv);
});

router.get('/:eventId/import/assignments-template', ...guard, (_req, res) => {
  const csv = [
    'jersey_number,from_session_name,to_session_name',
    '7,Mites Skills A,Mites Skills B',
    '12,Squirts Skills A,Squirts Skills C',
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="session-assignment-template.csv"');
  res.send(csv);
});

// ─────────────────────────────────────────
// POST /:eventId/import/upload
// Multipart upload: parse, validate, store batch+rows, return preview.
// Form fields: file (required), importType (required), ageGroupId (required for players/assignments)
// ─────────────────────────────────────────

router.post('/:eventId/import/upload', ...guard, upload.single('file'), async (req, res) => {
  const { eventId } = req.params;
  const importType  = (req.body.importType || 'players').trim();
  const ageGroupId  = req.body.ageGroupId ? parseInt(req.body.ageGroupId) : null;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded — use field name "file"' });
  }
  if (!['players', 'evaluators', 'session_assignments'].includes(importType)) {
    return res.status(400).json({ error: 'Invalid importType — must be players, evaluators, or session_assignments' });
  }
  if (['players', 'session_assignments'].includes(importType) && !ageGroupId) {
    return res.status(400).json({ error: 'ageGroupId is required for players and session_assignments imports' });
  }

  const event = await validateEvent(eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  let parseResult;
  try {
    parseResult = parseUpload(req.file);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const { rows, warnings: parseWarnings } = parseResult;
  if (!rows.length) {
    return res.status(400).json({ error: 'File contains no data rows' });
  }

  let processedRows;
  try {
    if (importType === 'players') {
      processedRows = await processPlayerRows(rows, eventId, ageGroupId);
    } else if (importType === 'evaluators') {
      processedRows = await processEvaluatorRows(rows, eventId);
    } else {
      processedRows = await processSessionAssignmentRows(rows, eventId, ageGroupId);
    }
  } catch (err) {
    console.error('[import] Row processing error:', err);
    return res.status(500).json({ error: 'Failed to process file rows' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const batchId = await storeBatch(client, {
      eventId, ageGroupId, importType,
      fileName: req.file.originalname,
      processedRows,
      userId: req.user?.id,
    });
    await client.query('COMMIT');

    await logAudit('import_uploaded', req.user?.id, {
      batchId, eventId, importType, fileName: req.file.originalname, rowCount: rows.length,
    });

    const summary = {
      total:    processedRows.length,
      valid:    processedRows.filter(r => r.status === 'ok' || r.status === 'update').length,
      updates:  processedRows.filter(r => r.status === 'update').length,
      skipped:  processedRows.filter(r => r.status === 'skipped').length,
      errors:   processedRows.filter(r => r.status === 'error').length,
      parseWarnings,
    };

    const hasNoSessions = importType === 'players' &&
      processedRows.every(r => !r.assignedSession) &&
      processedRows.some(r => r.status !== 'error');

    res.json({
      batchId,
      summary,
      noSessionsWarning: hasNoSessions
        ? 'No sessions found for this age group — players will import but won\'t be assigned to sessions yet'
        : null,
      preview: processedRows.map(r => ({
        rowIndex:       r.rowIndex,
        status:         r.status,
        errors:         r.errors,
        warnings:       r.warnings,
        assignedSession: r.assignedSession || null,
        // Key display fields
        firstName:    r.mappedData?.firstName   || r.rawData?.first_name || '',
        lastName:     r.mappedData?.lastName    || r.rawData?.last_name  || '',
        jerseyNumber: r.mappedData?.jerseyNumber ?? null,
        email:        r.mappedData?.email        || r.rawData?.email     || null,
      })),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[import] Batch store error:', err);
    res.status(500).json({ error: 'Failed to store import preview' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────
// GET /:eventId/import/:batchId/preview
// Fetch stored batch rows for display.
// ─────────────────────────────────────────

router.get('/:eventId/import/:batchId/preview', ...guard, async (req, res) => {
  const { eventId, batchId } = req.params;
  try {
    const { rows: batch } = await pool.query(
      'SELECT * FROM import_batches WHERE id = $1 AND event_id = $2',
      [batchId, eventId]
    );
    if (!batch[0]) return res.status(404).json({ error: 'Import batch not found' });

    const { rows: batchRows } = await pool.query(
      'SELECT * FROM import_batch_rows WHERE batch_id = $1 ORDER BY row_index',
      [batchId]
    );

    res.json({
      batch: batch[0],
      rows: batchRows.map(r => ({
        rowIndex:    r.row_index,
        status:      r.status,
        errors:      r.errors,
        warnings:    r.warnings,
        rawData:     r.raw_data,
        mappedData:  r.mapped_data,
        resultData:  r.result_data,
      })),
    });
  } catch (err) {
    console.error('[import] Preview fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch preview' });
  }
});

// ─────────────────────────────────────────
// POST /:eventId/import/:batchId/commit
// Commit valid batch rows to the database.
// ─────────────────────────────────────────

router.post('/:eventId/import/:batchId/commit', ...guard, async (req, res) => {
  const { eventId, batchId } = req.params;

  const { rows: batchCheck } = await pool.query(
    'SELECT * FROM import_batches WHERE id = $1 AND event_id = $2',
    [batchId, eventId]
  );
  const batch = batchCheck[0];
  if (!batch) return res.status(404).json({ error: 'Import batch not found' });
  if (batch.status === 'committed') {
    return res.status(409).json({ error: 'This import batch has already been committed' });
  }

  const { rows: batchRows } = await pool.query(
    `SELECT * FROM import_batch_rows
     WHERE batch_id = $1 AND status NOT IN ('error', 'skipped')
     ORDER BY row_index`,
    [batchId]
  );

  if (!batchRows.length) {
    return res.status(400).json({ error: 'No valid rows to commit' });
  }

  let added = 0, updated = 0, errors = 0;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const row of batchRows) {
      const data = row.mapped_data;
      try {
        if (batch.import_type === 'players') {
          const player = await findOrCreatePlayer(client, {
            firstName:   data.firstName,
            lastName:    data.lastName,
            dateOfBirth: data.dateOfBirth,
            gender:      data.gender,
            externalId:  data.externalId,
            shot:        data.shot,
            birthYear:   data.birthYear,
          });

          const registration = await upsertPlayerRegistration(client, {
            playerId:    player.id,
            eventId:     data.eventId,
            ageGroupId:  data.ageGroupId,
            jerseyNumber: data.jerseyNumber,
            position:    data.position,
            shot:        data.shot,
            willTryout:  data.willTryout,
            outcome:     null,
          });

          await assignPlayerToSessions(client, player.id, data.ageGroupId, data.eventId);

          if (registration.was_updated) updated++; else added++;

          await client.query(
            `UPDATE import_batch_rows SET status = $1, result_data = $2 WHERE id = $3`,
            [registration.was_updated ? 'update' : 'ok',
             JSON.stringify({ player_id: player.id, registration_id: registration.id }),
             row.id]
          );

        } else if (batch.import_type === 'evaluators') {
          // bcrypt was NOT run at preview time — we pre-validate, but hash at commit
          let userId = data.existingUserId;

          if (!userId) {
            const tempPw = generateTempPassword();
            const hashed = await bcrypt.hash(tempPw, 10);
            const { rows: newUser } = await client.query(
              `INSERT INTO users (email, password, first_name, last_name, role)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id`,
              [data.email, hashed, data.firstName, data.lastName, data.role]
            );
            userId = newUser[0].id;
            added++;
            await client.query(
              `UPDATE import_batch_rows SET status = 'ok', result_data = $1 WHERE id = $2`,
              [JSON.stringify({ user_id: userId, temp_password: tempPw }), row.id]
            );
          } else {
            // Only update role if not downgrading from admin
            if (data.existingRole !== 'admin') {
              await client.query(
                `UPDATE users SET first_name = $1, last_name = $2, role = $3 WHERE id = $4`,
                [data.firstName, data.lastName, data.role, userId]
              );
            }
            updated++;
            await client.query(
              `UPDATE import_batch_rows SET status = 'update', result_data = $1 WHERE id = $2`,
              [JSON.stringify({ user_id: userId }), row.id]
            );
          }

          // Assign to sessions
          for (const sessionId of (data.sessionIds || [])) {
            await client.query(
              `INSERT INTO session_scorers (session_id, user_id) VALUES ($1, $2)
               ON CONFLICT DO NOTHING`,
              [sessionId, userId]
            );
          }

        } else if (batch.import_type === 'session_assignments') {
          await client.query(
            `UPDATE session_players SET session_id = $1
             WHERE session_id = $2 AND player_id = $3`,
            [data.toSessionId, data.fromSessionId, data.playerId]
          );
          added++;
          await client.query(
            `UPDATE import_batch_rows SET status = 'ok', result_data = $1 WHERE id = $2`,
            [JSON.stringify({ player_id: data.playerId, to_session_id: data.toSessionId }), row.id]
          );
        }

      } catch (rowErr) {
        errors++;
        await client.query(
          `UPDATE import_batch_rows SET status = 'error', errors = $1 WHERE id = $2`,
          [[rowErr.message], row.id]
        );
      }
    }

    await client.query(
      `UPDATE import_batches
       SET status = 'committed', committed_at = NOW(),
           added_count = $1, updated_count = $2, error_count = $3
       WHERE id = $4`,
      [added, updated, errors, batchId]
    );

    await logAudit('import_committed', req.user?.id, {
      batchId, eventId, importType: batch.import_type, added, updated, errors,
    }, client);

    await client.query('COMMIT');

    res.json({
      summary: { added, updated, errors },
      batchId,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[import] Commit error:', err);
    res.status(500).json({ error: 'Commit failed — no changes were saved' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────
// GET /:eventId/import/history
// List import batches for this event.
// ─────────────────────────────────────────

router.get('/:eventId/import/history', ...guard, async (req, res) => {
  const { eventId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT ib.id, ib.import_type, ib.status, ib.file_name,
              ib.row_count, ib.added_count, ib.updated_count, ib.error_count,
              ib.created_at, ib.committed_at,
              u.first_name, u.last_name
         FROM import_batches ib
         LEFT JOIN users u ON u.id = ib.created_by
        WHERE ib.event_id = $1
        ORDER BY ib.created_at DESC
        LIMIT 50`,
      [eventId]
    );
    res.json({ history: rows });
  } catch (err) {
    console.error('[import] History error:', err);
    res.status(500).json({ error: 'Failed to load import history' });
  }
});

// ─────────────────────────────────────────
// GET /:eventId/import/:batchId/errors.csv
// Download error rows as CSV for review.
// ─────────────────────────────────────────

router.get('/:eventId/import/:batchId/errors.csv', ...guard, async (req, res) => {
  const { eventId, batchId } = req.params;
  try {
    const { rows: batchCheck } = await pool.query(
      'SELECT id, import_type, file_name FROM import_batches WHERE id = $1 AND event_id = $2',
      [batchId, eventId]
    );
    if (!batchCheck[0]) return res.status(404).json({ error: 'Import batch not found' });

    const { rows: errorRows } = await pool.query(
      `SELECT row_index, raw_data, errors
       FROM import_batch_rows
       WHERE batch_id = $1 AND status = 'error'
       ORDER BY row_index`,
      [batchId]
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="import-errors-${batchId}.csv"`);

    // Build a CSV with row number + all raw fields + errors column
    const allKeys = new Set();
    errorRows.forEach(r => Object.keys(r.raw_data).forEach(k => allKeys.add(k)));
    const keys = ['row_number', ...allKeys, 'errors'];

    res.write(keys.join(',') + '\n');
    for (const r of errorRows) {
      const values = keys.map(k => {
        let val;
        if (k === 'row_number') val = r.row_index + 2; // +2: 1 for header, 1 for 1-based
        else if (k === 'errors') val = (r.errors || []).join('; ');
        else val = r.raw_data[k] ?? '';
        const s = String(val);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s;
      });
      res.write(values.join(',') + '\n');
    }
    res.end();
  } catch (err) {
    console.error('[import] Error CSV error:', err);
    res.status(500).json({ error: 'Failed to generate error report' });
  }
});

module.exports = router;
