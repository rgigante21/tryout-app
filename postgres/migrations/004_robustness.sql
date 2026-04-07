-- Migration 004: Database robustness hardening
-- Idempotent — safe to re-run (DO blocks guard every change).
-- Adds CHECK constraints, NOT NULL enforcement, missing indexes,
-- updated_at triggers, checked_in_at automation, and a GIN index
-- on audit_log.details JSONB.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CHECK CONSTRAINTS — enforce domain values at the DB layer
--    Application comments existed, but nothing stopped bad writes.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_role_check
      CHECK (role IN ('scorer', 'coordinator', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sessions
    ADD CONSTRAINT sessions_status_check
      CHECK (status IN ('pending','active','complete','scoring_complete','finalized'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE sessions
    ADD CONSTRAINT sessions_session_type_check
      CHECK (session_type IN ('skills','game'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE session_blocks
    ADD CONSTRAINT session_blocks_block_type_check
      CHECK (block_type IN ('skills','game'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE session_blocks
    ADD CONSTRAINT session_blocks_split_method_check
      CHECK (split_method IN ('last_name','jersey_range','division','manual','none'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE session_blocks
    ADD CONSTRAINT session_blocks_scoring_mode_check
      CHECK (scoring_mode IN ('full','observe'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE players
    ADD CONSTRAINT players_position_check
      CHECK (position IN ('skater','goalie','defense','forward'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE players
    ADD CONSTRAINT players_outcome_check
      CHECK (outcome IN ('moved_up','retained','left_program'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE players
    ADD CONSTRAINT players_gender_check
      CHECK (gender IN ('M','F','X'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE scores
    ADD CONSTRAINT scores_status_check
      CHECK (status IN ('draft','submitted','locked','finalized'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE session_players
    ADD CONSTRAINT session_players_attendance_status_check
      CHECK (attendance_status IN ('checked_in','late_arrival','no_show','excused'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. NOT NULL on critical FK columns
--    These were declared as nullable FKs but are always required by the app.
-- ─────────────────────────────────────────────────────────────────────────────

-- scores
DO $$ BEGIN
  ALTER TABLE scores ALTER COLUMN session_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE scores ALTER COLUMN player_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE scores ALTER COLUMN scorer_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- session_scorers
DO $$ BEGIN
  ALTER TABLE session_scorers ALTER COLUMN session_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE session_scorers ALTER COLUMN user_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- session_players (already NOT NULL via UNIQUE, but explicit is cleaner)
DO $$ BEGIN
  ALTER TABLE session_players ALTER COLUMN session_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE session_players ALTER COLUMN player_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. MISSING INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- sessions.age_group_id — missing; every join from age_groups to sessions needs it
CREATE INDEX IF NOT EXISTS idx_sessions_age_group
  ON sessions(age_group_id);

-- Composite (event_id, age_group_id) — covers the most common dual-filter pattern
CREATE INDEX IF NOT EXISTS idx_sessions_event_ag
  ON sessions(event_id, age_group_id);

-- Partial index on pending sessions — the scheduler runs this every minute
CREATE INDEX IF NOT EXISTS idx_sessions_pending
  ON sessions(session_date, start_time)
  WHERE status = 'pending';

-- Composite for players — most queries filter by both event_id and age_group_id
CREATE INDEX IF NOT EXISTS idx_players_event_ag
  ON players(event_id, age_group_id);

-- Last-name first letter — used by the last_name split assignment function
CREATE INDEX IF NOT EXISTS idx_players_last_name_initial
  ON players(upper(left(last_name, 1)));

-- scores.status — filter by draft / submitted
CREATE INDEX IF NOT EXISTS idx_scores_status
  ON scores(status);

-- session_blocks.age_group_id — joining blocks to age groups
CREATE INDEX IF NOT EXISTS idx_session_blocks_ag
  ON session_blocks(age_group_id);

-- tryout_events — partial index for non-archived events (the common case)
CREATE INDEX IF NOT EXISTS idx_tryout_events_active
  ON tryout_events(start_date DESC)
  WHERE archived = false;

-- audit_log.details — GIN index enables @> and ->> queries on the JSONB column
CREATE INDEX IF NOT EXISTS idx_audit_log_details_gin
  ON audit_log USING GIN (details);

-- Composite audit_log index for per-user timeline queries
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON audit_log(user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. updated_at TRIGGER — shared function + per-table triggers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- users — has updated_at column but no trigger
DO $$ BEGIN
  CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- session_blocks — has updated_at column but no trigger
DO $$ BEGIN
  CREATE TRIGGER trg_session_blocks_updated_at
    BEFORE UPDATE ON session_blocks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- scores — has updated_at; the upsert sets it manually, but UPDATE paths miss it
DO $$ BEGIN
  CREATE TRIGGER trg_scores_updated_at
    BEFORE UPDATE ON scores
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- sessions — add the missing updated_at column, then wire the trigger
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$ BEGIN
  CREATE TRIGGER trg_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. checked_in_at — auto-set when a player is marked checked_in = true
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_checked_in_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.checked_in = TRUE AND (OLD.checked_in IS DISTINCT FROM TRUE) THEN
    NEW.checked_in_at = NOW();
  ELSIF NEW.checked_in = FALSE THEN
    NEW.checked_in_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_session_players_checked_in_at
    BEFORE UPDATE ON session_players
    FOR EACH ROW EXECUTE FUNCTION set_checked_in_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. COLUMN COMMENTS — document the now-enforced domains
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON COLUMN users.role IS
  'scorer | coordinator | admin';

COMMENT ON COLUMN sessions.status IS
  'pending | active | complete | scoring_complete | finalized';

COMMENT ON COLUMN sessions.session_type IS
  'skills | game';

COMMENT ON COLUMN session_blocks.block_type IS
  'skills | game';

COMMENT ON COLUMN session_blocks.split_method IS
  'last_name | jersey_range | division | manual | none';

COMMENT ON COLUMN players.position IS
  'skater | goalie | defense | forward';

COMMENT ON COLUMN players.outcome IS
  'moved_up | retained | left_program';

COMMENT ON COLUMN players.gender IS
  'M | F | X (non-binary/other)';

COMMENT ON COLUMN scores.status IS
  'draft | submitted | locked | finalized';

COMMENT ON COLUMN session_players.attendance_status IS
  'checked_in | late_arrival | no_show | excused';
