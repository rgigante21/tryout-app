async function findOrCreatePlayer(client, {
  firstName,
  lastName,
  dateOfBirth = null,
  gender = null,
  externalId = null,
  shot = null,
  birthYear = null,
}) {
  let player = null;

  if (externalId) {
    const existing = await client.query(
      `SELECT *
       FROM players
       WHERE external_id = $1`,
      [externalId]
    );
    player = existing.rows[0] || null;
  }

  if (!player && dateOfBirth) {
    const existing = await client.query(
      `SELECT *
       FROM players
       WHERE lower(first_name) = lower($1)
         AND lower(last_name) = lower($2)
         AND date_of_birth = $3`,
      [firstName, lastName, dateOfBirth]
    );
    player = existing.rows[0] || null;
  }

  if (!player) {
    const inserted = await client.query(
      `INSERT INTO players
         (first_name, last_name, date_of_birth, gender, external_id, shot, birth_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [firstName, lastName, dateOfBirth, gender, externalId, shot, birthYear]
    );
    return inserted.rows[0];
  }

  const updated = await client.query(
    `UPDATE players
     SET first_name    = COALESCE($2, first_name),
         last_name     = COALESCE($3, last_name),
         date_of_birth = COALESCE($4, date_of_birth),
         gender        = COALESCE($5, gender),
         external_id   = COALESCE($6, external_id),
         shot          = COALESCE($7, shot),
         birth_year    = COALESCE($8, birth_year),
         updated_at    = NOW()
     WHERE id = $1
     RETURNING *`,
    [player.id, firstName, lastName, dateOfBirth, gender, externalId, shot, birthYear]
  );
  return updated.rows[0];
}

async function upsertPlayerRegistration(client, {
  playerId,
  eventId,
  ageGroupId,
  jerseyNumber = null,
  position = 'skater',
  shot = null,
  willTryout = true,
  outcome = null,
}) {
  const result = await client.query(
    `INSERT INTO player_event_registrations
       (player_id, event_id, age_group_id, jersey_number, position, shot, will_tryout, outcome, registered_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (player_id, event_id)
     DO UPDATE SET
       age_group_id   = EXCLUDED.age_group_id,
       jersey_number  = EXCLUDED.jersey_number,
       position       = EXCLUDED.position,
       shot           = EXCLUDED.shot,
       will_tryout    = EXCLUDED.will_tryout,
       outcome        = EXCLUDED.outcome,
       updated_at     = NOW()
     RETURNING *, (xmax <> 0) AS was_updated`,
    [playerId, eventId, ageGroupId, jerseyNumber, position, shot, willTryout, outcome]
  );
  return result.rows[0];
}

async function resolveRegistrationForSession(client, sessionId, playerId) {
  const existing = await client.query(
    `SELECT sp.registration_id
     FROM session_players sp
     WHERE sp.session_id = $1
       AND sp.player_id = $2
       AND sp.registration_id IS NOT NULL
     LIMIT 1`,
    [sessionId, playerId]
  );
  if (existing.rows[0]?.registration_id) return existing.rows[0].registration_id;

  const derived = await client.query(
    `SELECT per.id AS registration_id
     FROM sessions s
     JOIN player_event_registrations per
       ON per.event_id = s.event_id
      AND per.player_id = $2
     WHERE s.id = $1
     LIMIT 1`,
    [sessionId, playerId]
  );

  return derived.rows[0]?.registration_id || null;
}

module.exports = {
  findOrCreatePlayer,
  upsertPlayerRegistration,
  resolveRegistrationForSession,
};
