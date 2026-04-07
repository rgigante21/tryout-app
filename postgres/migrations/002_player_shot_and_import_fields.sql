-- Migration 002: Player shot hand and import-quality fields
-- Adds shot, date_of_birth, external_id, and gender to players table.
-- Apply before migration 003.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS shot        VARCHAR(1)   CHECK (shot IN ('L','R')),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gender      VARCHAR(10);

-- Partial unique index: external_id must be unique within an event (nulls excluded)
CREATE UNIQUE INDEX IF NOT EXISTS players_external_id_event_uniq
  ON players (external_id, event_id)
  WHERE external_id IS NOT NULL;

-- Backfill date_of_birth from birth_year for existing rows (Jan 1 of birth year)
UPDATE players
   SET date_of_birth = make_date(birth_year, 1, 1)
 WHERE date_of_birth IS NULL
   AND birth_year IS NOT NULL;
