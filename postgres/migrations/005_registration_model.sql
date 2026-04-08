-- Migration 005: Registration-centered player model
-- Adds player_event_registrations and dual-writes roster/score references
-- while preserving legacy player_id links during the transition.

-- 1. Make players usable as persistent identities
DO $$ BEGIN
  ALTER TABLE players ALTER COLUMN jersey_number DROP NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Normalize legacy gender values before tightening the domain.
UPDATE players
SET gender = CASE
  WHEN UPPER(gender) IN ('MALE', 'M') THEN 'M'
  WHEN UPPER(gender) IN ('FEMALE', 'F') THEN 'F'
  ELSE NULL
END
WHERE gender IS NOT NULL;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'players_gender_check'
  ) THEN
    ALTER TABLE players DROP CONSTRAINT players_gender_check;
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE players
    ADD CONSTRAINT players_gender_check
      CHECK (gender IN ('M', 'F'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS players_external_id_uniq
  ON players (external_id)
  WHERE external_id IS NOT NULL;

DROP INDEX IF EXISTS players_external_id_event_uniq;

-- 2. Add event registration layer
CREATE TABLE IF NOT EXISTS player_event_registrations (
  id            SERIAL PRIMARY KEY,
  player_id     INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event_id      INT NOT NULL REFERENCES tryout_events(id) ON DELETE CASCADE,
  age_group_id  INT NOT NULL REFERENCES age_groups(id),
  jersey_number INT,
  position      VARCHAR(20) DEFAULT 'skater',
  shot          VARCHAR(1) CHECK (shot IN ('L', 'R')),
  will_tryout   BOOLEAN DEFAULT TRUE,
  outcome       VARCHAR(20) DEFAULT NULL,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_player_registrations_event
  ON player_event_registrations(event_id);

CREATE INDEX IF NOT EXISTS idx_player_registrations_event_ag
  ON player_event_registrations(event_id, age_group_id);

CREATE INDEX IF NOT EXISTS idx_player_registrations_player
  ON player_event_registrations(player_id);

-- 3. Backfill one registration per existing event-bound player row
INSERT INTO player_event_registrations (
  player_id, event_id, age_group_id, jersey_number, position, shot, will_tryout, outcome, registered_at, created_at, updated_at
)
SELECT
  p.id,
  p.event_id,
  COALESCE(p.age_group_id, 1),
  p.jersey_number,
  COALESCE(p.position, 'skater'),
  p.shot,
  COALESCE(p.will_tryout, true),
  p.outcome,
  p.created_at,
  p.created_at,
  COALESCE(p.updated_at, p.created_at, NOW())
FROM players p
WHERE p.event_id IS NOT NULL
ON CONFLICT (player_id, event_id) DO NOTHING;

-- 4. Add registration references to session rosters and scores
ALTER TABLE session_players
  ADD COLUMN IF NOT EXISTS registration_id INT REFERENCES player_event_registrations(id) ON DELETE CASCADE;

ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS registration_id INT REFERENCES player_event_registrations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_session_players_reg
  ON session_players(registration_id);

CREATE INDEX IF NOT EXISTS idx_scores_registration
  ON scores(registration_id);

CREATE UNIQUE INDEX IF NOT EXISTS session_players_session_registration_uniq
  ON session_players(session_id, registration_id)
  WHERE registration_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS scores_session_registration_scorer_uniq
  ON scores(session_id, registration_id, scorer_id)
  WHERE registration_id IS NOT NULL;

-- 5. Backfill registration_id on roster/score rows from session event context
UPDATE session_players sp
SET registration_id = per.id
FROM sessions s
JOIN player_event_registrations per
  ON per.event_id = s.event_id
 AND per.player_id = sp.player_id
WHERE sp.session_id = s.id
  AND sp.registration_id IS NULL;

UPDATE scores sc
SET registration_id = per.id
FROM sessions s
JOIN player_event_registrations per
  ON per.event_id = s.event_id
 AND per.player_id = sc.player_id
WHERE sc.session_id = s.id
  AND sc.registration_id IS NULL;
