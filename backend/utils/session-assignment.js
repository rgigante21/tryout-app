/**
 * session-assignment.js
 * Shared helper — auto-assigns players to session_players
 * based on the split_method of the parent session_block.
 *
 * Called after:
 *   1. A session block is created (assign existing players)
 *   2. A player is added (assign to matching sessions in their age_group/event)
 */

function normalizeLastNameKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function lastNameInRange(lastName, start, end) {
  const key = normalizeLastNameKey(lastName);
  if (!key) return false;
  const startKey = normalizeLastNameKey(start) || 'A';
  const rawEndKey = normalizeLastNameKey(end) || 'Z';
  const endKey = rawEndKey.length === 1 ? `${rawEndKey}ZZZZZZZZ` : rawEndKey;
  return key >= startKey && key <= endKey;
}

/**
 * Assign all eligible players to sessions within a block.
 * Uses the block's split_method to determine which players
 * belong in which session.
 *
 * @param {object} client  - pg transaction client
 * @param {number} blockId
 */
async function assignPlayersToBlock(client, blockId) {
  // Load the block
  const blockRes = await client.query(
    'SELECT * FROM session_blocks WHERE id = $1',
    [blockId]
  );
  const block = blockRes.rows[0];
  if (!block) throw new Error(`Session block ${blockId} not found`);

  // Load sessions in the block
  const sessionRes = await client.query(
    'SELECT * FROM sessions WHERE block_id = $1 ORDER BY start_time',
    [blockId]
  );
  const sessions = sessionRes.rows;
  if (!sessions.length) return { assigned: 0 };

  // Load all eligible players for this age group + event
  const playerRes = await client.query(
    `SELECT
       per.id AS registration_id,
       per.player_id,
       p.first_name,
       p.last_name,
       per.jersey_number
     FROM player_event_registrations per
     JOIN players p ON p.id = per.player_id
     WHERE per.age_group_id = $1
       AND per.event_id = $2
       AND per.will_tryout = true`,
    [block.age_group_id, block.event_id]
  );
  const players = playerRes.rows;

  let assigned = 0;

  if (block.block_type === 'game') {
    // For game blocks: add all players from session_players (team assignment)
    // to every game session in the block — they appear in all games
    for (const session of sessions) {
      // Get all players assigned to a team in this block
      const teamPlayerRes = await client.query(
        `SELECT DISTINCT player_id, registration_id FROM session_players sp
         JOIN sessions s ON s.id = sp.session_id
         WHERE s.block_id = $1`,
        [blockId]
      );
      for (const row of teamPlayerRes.rows) {
        await client.query(
          `INSERT INTO session_players (session_id, player_id, registration_id)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [session.id, row.player_id, row.registration_id]
        );
        assigned++;
      }
    }
    return { assigned };
  }

  // Skills sessions — split by method
  for (const session of sessions) {
    let eligible = [];

    switch (block.split_method) {
      case 'last_name': {
        eligible = players.filter(p => lastNameInRange(
          p.last_name,
          session.last_name_start,
          session.last_name_end
        ));
        break;
      }
      case 'jersey_range': {
        const min = session.jersey_min ?? 0;
        const max = session.jersey_max ?? 99999;
        eligible = players.filter(p => p.jersey_number >= min && p.jersey_number <= max);
        break;
      }
      case 'none':
      case 'manual':
      default: {
        // 'none' → single session, all players go in
        // 'manual' → no auto-assign
        if (block.split_method === 'none') {
          eligible = players;
        }
        break;
      }
    }

    for (const player of eligible) {
        await client.query(
        `INSERT INTO session_players (session_id, player_id, registration_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [session.id, player.player_id, player.registration_id]
      );
      assigned++;
    }
  }

  return { assigned };
}

/**
 * Assign a single player to all matching sessions within their
 * age_group + event based on each block's split_method.
 *
 * @param {object} client
 * @param {number} playerId
 * @param {number} ageGroupId
 * @param {number} eventId
 */
async function assignPlayerToSessions(client, playerId, ageGroupId, eventId) {
  const playerRes = await client.query(
    `SELECT
       p.*,
       per.id AS registration_id,
       per.jersey_number AS registration_jersey_number
     FROM players p
     LEFT JOIN player_event_registrations per
       ON per.player_id = p.id
      AND per.event_id = $2
     WHERE p.id = $1`,
    [playerId, eventId]
  );
  const player = playerRes.rows[0];
  if (!player) return { assigned: 0 };

  // Get all session blocks for this age group + event
  const blockRes = await client.query(
    `SELECT sb.*, s.id AS session_id,
            s.last_name_start, s.last_name_end,
            s.jersey_min, s.jersey_max
     FROM session_blocks sb
     JOIN sessions s ON s.block_id = sb.id
     WHERE sb.age_group_id = $1 AND sb.event_id = $2`,
    [ageGroupId, eventId]
  );

  let assigned = 0;
  for (const row of blockRes.rows) {
    let matches = false;

    switch (row.split_method) {
      case 'last_name': {
        matches = lastNameInRange(player.last_name, row.last_name_start, row.last_name_end);
        break;
      }
      case 'jersey_range': {
        const min = row.jersey_min ?? 0;
        const max = row.jersey_max ?? 99999;
        const jerseyNumber = player.registration_jersey_number ?? player.jersey_number;
        matches = jerseyNumber >= min && jerseyNumber <= max;
        break;
      }
      case 'none':
        matches = true;
        break;
      case 'game':
      case 'manual':
      default:
        matches = false; // game and manual require explicit assignment
        break;
    }

    if (matches) {
      await client.query(
        `INSERT INTO session_players (session_id, player_id, registration_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [row.session_id, playerId, player.registration_id]
      );
      assigned++;
    }
  }

  return { assigned };
}

module.exports = {
  assignPlayersToBlock,
  assignPlayerToSessions,
  lastNameInRange,
  normalizeLastNameKey,
};
