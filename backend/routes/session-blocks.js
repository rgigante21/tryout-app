const express = require('express');
const pool    = require('../db/pool');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { assignPlayersToBlock, normalizeLastNameKey } = require('../utils/session-assignment');

const router     = express.Router();
const guard      = [authMiddleware, requireRole('admin', 'coordinator')];
const adminGuard = [authMiddleware, requireRole('admin')];

// ── Helper: sync tryout_event dates from session min/max ──────────────
async function syncEventDates(client, eventId) {
  await client.query(`
    UPDATE tryout_events
    SET start_date = sub.min_date,
        end_date   = sub.max_date
    FROM (
      SELECT MIN(session_date) AS min_date,
             MAX(session_date) AS max_date
      FROM   sessions
      WHERE  event_id = $1
    ) sub
    WHERE id = $1 AND sub.min_date IS NOT NULL
  `, [eventId]);
}

function parseTimeToMinutes(value) {
  if (!value) return null;
  const [h, m] = String(value).slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToTime(value) {
  const minutes = ((value % 1440) + 1440) % 1440;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toDateKey(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function splitIntoBalancedLastNameRanges(players, slotCount) {
  if (slotCount <= 0) return [];
  if (!players.length) {
    return Array.from({ length: slotCount }, (_, index) => ({
      index,
      count: 0,
      lastNameStart: index === 0 ? 'A' : '',
      lastNameEnd: index === slotCount - 1 ? 'Z' : '',
    }));
  }

  const sorted = [...players].sort((a, b) => (
    normalizeLastNameKey(a.last_name).localeCompare(normalizeLastNameKey(b.last_name)) ||
    String(a.first_name || '').localeCompare(String(b.first_name || '')) ||
    Number(a.registration_id) - Number(b.registration_id)
  ));

  const ranges = [];
  let cursor = 0;
  for (let index = 0; index < slotCount; index++) {
    const remainingPlayers = sorted.length - cursor;
    const remainingSlots = slotCount - index;
    let size = Math.ceil(remainingPlayers / remainingSlots);
    let endExclusive = Math.min(sorted.length, cursor + size);

    // Keep identical last-name keys together so generated ranges do not overlap.
    while (
      endExclusive < sorted.length &&
      endExclusive > cursor &&
      normalizeLastNameKey(sorted[endExclusive - 1].last_name) === normalizeLastNameKey(sorted[endExclusive].last_name)
    ) {
      endExclusive++;
    }

    const chunk = sorted.slice(cursor, endExclusive);
    ranges.push({
      index,
      count: chunk.length,
      lastNameStart: chunk[0]?.last_name || '',
      lastNameEnd: chunk[chunk.length - 1]?.last_name || '',
    });
    cursor = endExclusive;
  }

  return ranges;
}

function buildPlanningGaps(sessions, slotMinutes) {
  const byDate = new Map();
  for (const session of sessions) {
    const date = toDateKey(session.session_date);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(session);
  }

  return [...byDate.entries()].map(([date, dateSessions]) => {
    const starts = dateSessions
      .map((s) => parseTimeToMinutes(s.start_time))
      .filter((v) => v !== null)
      .sort((a, b) => a - b);
    const occupied = new Set(starts);
    const openStarts = [];
    for (const start of starts) {
      const candidate = start + slotMinutes;
      if (!occupied.has(candidate) && candidate < 24 * 60) {
        openStarts.push(minutesToTime(candidate));
      }
    }
    return {
      date,
      sessionCount: dateSessions.length,
      firstStart: starts.length ? minutesToTime(starts[0]) : null,
      lastStart: starts.length ? minutesToTime(starts[starts.length - 1]) : null,
      openStarts: [...new Set(openStarts)].slice(0, 6),
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

// ─────────────────────────────────────────────────────────────────────
// GET /api/session-blocks?event_id=&age_group_id=
// List blocks with session counts and player counts
// ─────────────────────────────────────────────────────────────────────
router.get('/', ...guard, async (req, res) => {
  const { event_id, age_group_id } = req.query;
  if (!event_id) return res.status(400).json({ error: 'event_id required' });

  try {
    // Verify event belongs to org, then list blocks
    const conditions = ['sb.event_id = $1', 'te.organization_id = $2'];
    const params     = [event_id, req.org_id];

    if (age_group_id) {
      conditions.push(`sb.age_group_id = $${params.length + 1}`);
      params.push(age_group_id);
    }

    const r = await pool.query(`
      SELECT
        sb.*,
        ag.name        AS age_group_name,
        ag.code        AS age_group_code,
        COUNT(DISTINCT s.id)::int           AS session_count,
        COUNT(DISTINCT COALESCE(sp.registration_id, sp.player_id))::int AS player_count
      FROM session_blocks sb
      JOIN age_groups ag ON ag.id = sb.age_group_id
      JOIN tryout_events te ON te.id = sb.event_id
      LEFT JOIN sessions s ON s.block_id = sb.id
      LEFT JOIN session_players sp ON sp.session_id = s.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY sb.id, ag.name, ag.code, ag.sort_order
      ORDER BY sb.session_date, ag.sort_order
    `, params);

    res.json({ blocks: r.rows });
  } catch (err) {
    console.error('List session blocks error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/session-blocks/planning-preview?event_id=&age_group_id=&slots=&slot_minutes=
// Preview balanced split counts and simple schedule openings before creating a block.
// ─────────────────────────────────────────────────────────────────────
router.get('/planning-preview', ...guard, async (req, res) => {
  const eventId = parseInt(req.query.event_id, 10);
  const ageGroupId = parseInt(req.query.age_group_id, 10);
  const slotCount = Math.min(Math.max(parseInt(req.query.slots, 10) || 1, 1), 12);
  const slotMinutes = Math.min(Math.max(parseInt(req.query.slot_minutes, 10) || 30, 15), 180);

  if (!eventId || !ageGroupId) {
    return res.status(400).json({ error: 'event_id and age_group_id are required' });
  }

  try {
    const eventCheck = await pool.query(
      'SELECT id FROM tryout_events WHERE id = $1 AND organization_id = $2',
      [eventId, req.org_id]
    );
    if (!eventCheck.rows[0]) return res.status(404).json({ error: 'Event not found' });

    const [playerRes, sessionRes] = await Promise.all([
      pool.query(
        `SELECT
           per.id AS registration_id,
           p.first_name,
           p.last_name
         FROM player_event_registrations per
         JOIN players p ON p.id = per.player_id
         WHERE per.age_group_id = $1
           AND per.event_id = $2
           AND per.will_tryout = true
           AND p.organization_id = $3`,
        [ageGroupId, eventId, req.org_id]
      ),
      pool.query(
        `SELECT id, name, session_date, start_time, session_type
         FROM sessions
         WHERE event_id = $1
           AND organization_id = $2
         ORDER BY session_date, start_time`,
        [eventId, req.org_id]
      ),
    ]);

    const balancedSplits = splitIntoBalancedLastNameRanges(playerRes.rows, slotCount);
    res.json({
      totalPlayers: playerRes.rows.length,
      targetPerSlot: slotCount ? Math.ceil(playerRes.rows.length / slotCount) : 0,
      balancedSplits,
      planningGaps: buildPlanningGaps(sessionRes.rows, slotMinutes),
    });
  } catch (err) {
    console.error('Planning preview error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/session-blocks/:id
// Block detail with sessions and per-session player counts
// ─────────────────────────────────────────────────────────────────────
router.get('/:id', ...guard, async (req, res) => {
  try {
    const blockRes = await pool.query(`
      SELECT sb.*, ag.name AS age_group_name, ag.code AS age_group_code
      FROM session_blocks sb
      JOIN age_groups ag ON ag.id = sb.age_group_id
      WHERE sb.id = $1
    `, [req.params.id]);

    if (!blockRes.rows[0]) return res.status(404).json({ error: 'Block not found' });
    const block = blockRes.rows[0];

    const sessionsRes = await pool.query(`
      SELECT
        s.*,
        COUNT(DISTINCT COALESCE(sp.registration_id, sp.player_id))::int AS player_count,
        COUNT(sc.id)::int         AS score_count,
        COUNT(ss.user_id)::int    AS scorer_count
      FROM sessions s
      LEFT JOIN session_players sp ON sp.session_id = s.id
      LEFT JOIN scores sc ON sc.session_id = s.id
      LEFT JOIN session_scorers ss ON ss.session_id = s.id
      WHERE s.block_id = $1
      GROUP BY s.id
      ORDER BY s.start_time
    `, [req.params.id]);

    // For game blocks, also return team roster
    let teams = [];
    if (block.block_type === 'game') {
      const teamsRes = await pool.query(`
        SELECT gt.*,
          COUNT(DISTINCT COALESCE(sp.registration_id, sp.player_id))::int AS player_count
        FROM game_teams gt
        LEFT JOIN sessions s ON s.block_id = gt.block_id
        LEFT JOIN session_players sp ON sp.session_id = s.id AND sp.team_number = gt.team_number
        WHERE gt.block_id = $1
        GROUP BY gt.id
        ORDER BY gt.team_number
      `, [req.params.id]);
      teams = teamsRes.rows;
    }

    res.json({ block, sessions: sessionsRes.rows, teams });
  } catch (err) {
    console.error('Get session block error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/session-blocks
// Create a block + auto-generate sessions + auto-assign players
//
// Skills payload example:
// {
//   "eventId": 1, "ageGroupId": 1,
//   "blockType": "skills", "splitMethod": "last_name",
//   "label": "Mites Skills — Monday",
//   "sessionDate": "2026-03-30",
//   "scoringMode": "full",
//   "slots": [
//     { "time": "17:00", "lastNameStart": "A", "lastNameEnd": "H", "name": "5 PM — A through H" },
//     { "time": "18:00", "lastNameStart": "I", "lastNameEnd": "Q", "name": "6 PM — I through Q" },
//     { "time": "19:00", "lastNameStart": "R", "lastNameEnd": "Z", "name": "7 PM — R through Z" }
//   ]
// }
//
// Game payload example:
// {
//   "eventId": 1, "ageGroupId": 1,
//   "blockType": "game", "splitMethod": "none",
//   "label": "Mites Games — Thursday",
//   "sessionDate": "2026-04-02",
//   "teamCount": 4,
//   "playerAssignment": "random",
//   "teams": [
//     { "teamNumber": 1, "jerseyColor": "white",  "label": "Team 1" },
//     { "teamNumber": 2, "jerseyColor": "maroon", "label": "Team 2" },
//     { "teamNumber": 3, "jerseyColor": "white",  "label": "Team 3" },
//     { "teamNumber": 4, "jerseyColor": "maroon", "label": "Team 4" }
//   ],
//   "games": [
//     { "time": "17:00", "homeTeam": 1, "awayTeam": 2, "name": "Team 1 vs Team 2" },
//     { "time": "18:00", "homeTeam": 3, "awayTeam": 4, "name": "Team 3 vs Team 4" }
//   ]
// }
// ─────────────────────────────────────────────────────────────────────
router.post('/', ...adminGuard, async (req, res) => {
  const {
    eventId, ageGroupId, blockType = 'skills', splitMethod = 'none',
    label, sessionDate, scoringMode = 'full',
    slots = [], teams = [], games = [],
    teamCount, playerAssignment = 'manual',
  } = req.body;

  if (!eventId || !ageGroupId || !sessionDate) {
    return res.status(400).json({ error: 'eventId, ageGroupId, sessionDate required' });
  }
  if (blockType === 'skills' && slots.length === 0) {
    return res.status(400).json({ error: 'Skills blocks require at least one slot' });
  }
  if (blockType === 'game' && games.length === 0) {
    return res.status(400).json({ error: 'Game blocks require at least one game' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify event belongs to this org before creating anything
    const eventCheck = await client.query(
      'SELECT id FROM tryout_events WHERE id = $1 AND organization_id = $2',
      [eventId, req.org_id]
    );
    if (!eventCheck.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }

    // 1. Create the block
    const blockRes = await client.query(
      `INSERT INTO session_blocks
         (event_id, age_group_id, block_type, split_method, label, session_date, team_count, scoring_mode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [eventId, ageGroupId, blockType, splitMethod, label || null, sessionDate,
       teamCount || null, scoringMode]
    );
    const block = blockRes.rows[0];

    const createdSessions = [];

    if (blockType === 'skills') {
      // 2a. Create a session per slot
      for (const slot of slots) {
        const sessionName = slot.name
          || buildSessionName(splitMethod, slot, label);

        const sRes = await client.query(
          `INSERT INTO sessions
             (organization_id, event_id, age_group_id, block_id, name, session_type,
              session_date, start_time, last_name_start, last_name_end,
              jersey_min, jersey_max, status)
           VALUES ($1,$2,$3,$4,$5,'skills',$6,$7,$8,$9,$10,$11,'pending') RETURNING *`,
          [
            req.org_id, eventId, ageGroupId, block.id, sessionName, sessionDate,
            slot.time || null,
            slot.lastNameStart || null, slot.lastNameEnd || null,
            slot.jerseyMin    || null,  slot.jerseyMax   || null,
          ]
        );
        createdSessions.push(sRes.rows[0]);
      }

      // 3a. Auto-assign players (skip for manual split)
      if (splitMethod !== 'manual') {
        await assignPlayersToBlock(client, block.id);
      }

    } else {
      // blockType === 'game'

      // 2b. Create game_teams
      for (const t of teams) {
        await client.query(
          `INSERT INTO game_teams (block_id, team_number, jersey_color, label)
           VALUES ($1,$2,$3,$4)`,
          [block.id, t.teamNumber, t.jerseyColor || null, t.label || `Team ${t.teamNumber}`]
        );
      }

      // 2c. Create a session per game matchup
      for (const game of games) {
        const sessionName = game.name
          || `Team ${game.homeTeam} vs Team ${game.awayTeam}`;
        const sRes = await client.query(
          `INSERT INTO sessions
             (organization_id, event_id, age_group_id, block_id, name, session_type,
              session_date, start_time, home_team, away_team, status)
           VALUES ($1,$2,$3,$4,$5,'game',$6,$7,$8,$9,'pending') RETURNING *`,
          [req.org_id, eventId, ageGroupId, block.id, sessionName, sessionDate,
           game.time || null, game.homeTeam, game.awayTeam]
        );
        createdSessions.push(sRes.rows[0]);
      }

      // 3b. Assign players to teams if random
      if (playerAssignment === 'random' && teams.length > 0) {
        const playerRes = await client.query(
          `SELECT player_id, id AS registration_id FROM player_event_registrations
           WHERE age_group_id = $1 AND event_id = $2 AND will_tryout = true
           ORDER BY RANDOM()`,
          [ageGroupId, eventId]
        );
        const registrations = playerRes.rows;
        const teamNums   = teams.map(t => t.teamNumber);

        // Round-robin assign to teams
        for (let i = 0; i < registrations.length; i++) {
          const teamNum = teamNums[i % teamNums.length];
          // Add to first game session as a representative assignment
          // (team membership tracked via team_number in session_players)
          for (const session of createdSessions) {
            await client.query(
              `INSERT INTO session_players (session_id, player_id, registration_id, team_number)
               VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
              [session.id, registrations[i].player_id, registrations[i].registration_id, teamNum]
            );
          }
        }
      }
    }

    await syncEventDates(client, eventId);
    await client.query('COMMIT');

    res.status(201).json({ block, sessions: createdSessions });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create session block error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────
// PATCH /api/session-blocks/:id
// Update block settings (split_method or player_assignment) and re-assign
// ─────────────────────────────────────────────────────────────────────
router.patch('/:id', ...adminGuard, async (req, res) => {
  const { splitMethod, playerAssignment } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const blockRes = await client.query('SELECT * FROM session_blocks WHERE id = $1', [req.params.id]);
    if (!blockRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Block not found' });
    }
    const block = blockRes.rows[0];

    if (splitMethod && block.block_type === 'skills') {
      await client.query(
        'UPDATE session_blocks SET split_method = $1, updated_at = NOW() WHERE id = $2',
        [splitMethod, block.id]
      );
      await client.query(`
        DELETE FROM session_players
        WHERE session_id IN (SELECT id FROM sessions WHERE block_id = $1) AND checked_in = false
      `, [block.id]);
      if (splitMethod !== 'manual') {
        await assignPlayersToBlock(client, block.id);
      }
    }

    if (playerAssignment && block.block_type === 'game') {
      await client.query(`
        DELETE FROM session_players
        WHERE session_id IN (SELECT id FROM sessions WHERE block_id = $1) AND checked_in = false
      `, [block.id]);
      if (playerAssignment === 'random') {
        const sessionsRes = await client.query(
          'SELECT id, home_team, away_team FROM sessions WHERE block_id = $1 ORDER BY start_time', [block.id]
        );
        const teamsRes = await client.query(
          'SELECT team_number FROM game_teams WHERE block_id = $1 ORDER BY team_number', [block.id]
        );
        const playerRes = await client.query(
          `SELECT player_id, id AS registration_id
           FROM player_event_registrations
           WHERE age_group_id = $1 AND event_id = $2 AND will_tryout = true
           ORDER BY RANDOM()`,
          [block.age_group_id, block.event_id]
        );
        const registrations = playerRes.rows;
        const teamNums = teamsRes.rows.map(r => r.team_number);
        for (let i = 0; i < registrations.length; i++) {
          const teamNum = teamNums[i % teamNums.length];
          for (const session of sessionsRes.rows) {
            await client.query(
              `INSERT INTO session_players (session_id, player_id, registration_id, team_number)
               VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
              [session.id, registrations[i].player_id, registrations[i].registration_id, teamNum]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
    const updated = await pool.query('SELECT * FROM session_blocks WHERE id = $1', [req.params.id]);
    res.json({ block: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update session block error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/session-blocks/:id/reassign
// Re-run auto-assignment for a block (useful after player import)
// ─────────────────────────────────────────────────────────────────────
router.post('/:id/reassign', ...adminGuard, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing non-checked-in session_players for this block's sessions
    await client.query(`
      DELETE FROM session_players
      WHERE session_id IN (SELECT id FROM sessions WHERE block_id = $1)
        AND checked_in = false
    `, [req.params.id]);

    const result = await assignPlayersToBlock(client, parseInt(req.params.id));

    await client.query('COMMIT');
    res.json({ ...result });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reassign error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/session-blocks/:id/suggest-ranges?slots=6
// Suggest last-name ranges based on actual player distribution
// ─────────────────────────────────────────────────────────────────────
router.get('/:id/suggest-ranges', ...guard, async (req, res) => {
  const slotCount = parseInt(req.query.slots) || 3;
  if (slotCount < 1 || slotCount > 12) {
    return res.status(400).json({ error: 'slots must be between 1 and 12' });
  }

  try {
    const blockRes = await pool.query(
      'SELECT * FROM session_blocks WHERE id = $1', [req.params.id]
    );
    const block = blockRes.rows[0];
    if (!block) return res.status(404).json({ error: 'Block not found' });

    const playerRes = await pool.query(
      `SELECT UPPER(LEFT(p.last_name, 1)) AS initial, COUNT(*)::int AS cnt
       FROM player_event_registrations per
       JOIN players p ON p.id = per.player_id
       WHERE per.age_group_id = $1 AND per.event_id = $2 AND per.will_tryout = true
       GROUP BY initial ORDER BY initial`,
      [block.age_group_id, block.event_id]
    );

    const distribution = playerRes.rows; // [{ initial: 'A', cnt: 5 }, ...]
    const totalPlayers  = distribution.reduce((sum, r) => sum + r.cnt, 0);
    const targetPerSlot = Math.ceil(totalPlayers / slotCount);

    // Greedy bucketing
    const suggestions = [];
    let currentStart = null;
    let currentCount = 0;

    for (const row of distribution) {
      if (!currentStart) currentStart = row.initial;
      currentCount += row.cnt;

      if (currentCount >= targetPerSlot || row === distribution[distribution.length - 1]) {
        suggestions.push({
          lastNameStart: currentStart,
          lastNameEnd:   row.initial,
          estimatedCount: currentCount,
        });
        currentStart = null;
        currentCount = 0;
      }
    }

    res.json({ suggestions, totalPlayers, targetPerSlot });
  } catch (err) {
    console.error('Suggest ranges error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// DELETE /api/session-blocks/:id
// Delete block and cascade to sessions + session_players
// ─────────────────────────────────────────────────────────────────────
router.delete('/:id', ...adminGuard, async (req, res) => {
  try {
    const lookup = await pool.query(
      'SELECT event_id FROM session_blocks WHERE id = $1', [req.params.id]
    );
    const eventId = lookup.rows[0]?.event_id;
    await pool.query('DELETE FROM session_blocks WHERE id = $1', [req.params.id]);
    if (eventId) {
      const client = await pool.connect();
      try { await syncEventDates(client, eventId); } finally { client.release(); }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete block error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
function buildSessionName(splitMethod, slot, blockLabel) {
  const prefix = blockLabel ? `${blockLabel} — ` : '';
  const time   = slot.time || '';
  switch (splitMethod) {
    case 'last_name':
      return `${prefix}${time} Last Name ${slot.lastNameStart}–${slot.lastNameEnd}`;
    case 'jersey_range':
      return `${prefix}${time} Jersey #${slot.jerseyMin}–${slot.jerseyMax}`;
    default:
      return `${prefix}${time}`;
  }
}

module.exports = router;
