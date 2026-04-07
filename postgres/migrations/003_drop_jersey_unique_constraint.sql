-- Migration 003: Drop jersey uniqueness constraint
-- Duplicate jersey numbers within an age group and event are now allowed.
-- A non-unique index replaces the constraint to preserve query performance.
-- Apply AFTER migration 002.

-- Drop the unique constraint if it exists (name may vary; try both common names)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'players_jersey_number_age_group_id_event_id_key'
  ) THEN
    ALTER TABLE players DROP CONSTRAINT players_jersey_number_age_group_id_event_id_key;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'players_jersey_age_group_event_unique'
  ) THEN
    ALTER TABLE players DROP CONSTRAINT players_jersey_age_group_event_unique;
  END IF;
END$$;

-- Non-unique index for query performance
CREATE INDEX IF NOT EXISTS players_jersey_age_group_event_idx
  ON players (jersey_number, age_group_id, event_id);
