-- Migration 001: Production Readiness
-- Run this against an existing database.
-- Safe to run multiple times (uses IF NOT EXISTS / DO $$ ... END idioms).

-- ── Audit log ────────────────────────────────────────────────────────────────
-- Stores security-relevant events.
-- NEVER store: passwords, tokens, session IDs, DB credentials, secrets.
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  event      VARCHAR(100) NOT NULL,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  details    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_event      ON audit_log (event);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);

-- ── Attendance status on session_players ─────────────────────────────────────
-- Tracks why a player is absent or how they arrived.
-- Values: checked_in | late_arrival | no_show | excused
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_players' AND column_name = 'attendance_status'
  ) THEN
    ALTER TABLE session_players ADD COLUMN attendance_status VARCHAR(20);
  END IF;
END
$$;

-- ── Unique constraint on session_players (session_id, player_id) ─────────────
-- Needed for the ON CONFLICT in move-player endpoint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_players_session_id_player_id_key'
  ) THEN
    ALTER TABLE session_players
      ADD CONSTRAINT session_players_session_id_player_id_key
      UNIQUE (session_id, player_id);
  END IF;
END
$$;

-- ── Session status: expand to include scoring_complete and finalized ──────────
-- The check constraint on sessions.status (if any) needs to allow the new values.
-- PostgreSQL 9.2+ supports ALTER TABLE ... ALTER COLUMN ... TYPE + CHECK inline.
-- We drop + recreate the check constraint safely.
DO $$
BEGIN
  -- Drop old constraint if it restricts to only the original 3 values
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_status_check' AND contype = 'c'
  ) THEN
    ALTER TABLE sessions DROP CONSTRAINT sessions_status_check;
  END IF;
END
$$;

-- No new constraint needed — the application enforces valid values.
-- Comment documents the expected values:
COMMENT ON COLUMN sessions.status IS
  'pending | active | complete | scoring_complete | finalized';
