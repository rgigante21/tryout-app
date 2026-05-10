-- Hockey Tryout App - Database Schema
-- Runs automatically on first postgres container start.
-- Reflects the fully-migrated state (migrations 001–007 applied).
-- For in-place upgrades run the individual migration files.

-- ─────────────────────────────────────────
-- ORGANIZATIONS (must be first — other tables FK to it)
-- ─────────────────────────────────────────

CREATE TABLE organizations (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  subdomain   VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  CONSTRAINT organizations_subdomain_key UNIQUE (subdomain),
  CONSTRAINT organizations_slug_key      UNIQUE (slug)
);

-- ─────────────────────────────────────────
-- CORE TABLES
-- ─────────────────────────────────────────

CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id),
  email           VARCHAR(255) NOT NULL,
  password        VARCHAR(255) NOT NULL,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  role            VARCHAR(50) NOT NULL DEFAULT 'scorer',
  -- roles: scorer | coordinator | admin
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT users_email_org_uniq UNIQUE (email, organization_id),
  CONSTRAINT users_role_check CHECK (role IN ('scorer', 'coordinator', 'admin'))
);

CREATE TABLE age_groups (
  id                  SERIAL PRIMARY KEY,
  organization_id     INT NOT NULL REFERENCES organizations(id),
  name                VARCHAR(100) NOT NULL,
  code                VARCHAR(20) NOT NULL,
  sort_order          INT DEFAULT 0,
  default_template_id INT,  -- FK added after evaluation_templates is created
  CONSTRAINT age_groups_code_org_uniq UNIQUE (code, organization_id)
);

CREATE TABLE tryout_events (
  id              SERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id),
  name            VARCHAR(255) NOT NULL,
  season          VARCHAR(20) NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  archived        BOOLEAN NOT NULL DEFAULT false,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SESSION BLOCKS
-- Organizes related sessions by split strategy
-- ─────────────────────────────────────────

CREATE TABLE session_blocks (
  id            SERIAL PRIMARY KEY,
  event_id      INT NOT NULL REFERENCES tryout_events(id) ON DELETE CASCADE,
  age_group_id  INT NOT NULL REFERENCES age_groups(id),
  block_type    VARCHAR(20) NOT NULL DEFAULT 'skills',
  -- block_type: skills | game
  split_method  VARCHAR(20) NOT NULL DEFAULT 'none',
  -- split_method: last_name | jersey_range | division | manual | none
  label         VARCHAR(255),
  session_date  DATE NOT NULL,
  team_count    SMALLINT CHECK (team_count BETWEEN 2 AND 8),
  scoring_mode  VARCHAR(20) NOT NULL DEFAULT 'full',
  -- scoring_mode: full | observe
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT session_blocks_block_type_check   CHECK (block_type   IN ('skills', 'game')),
  CONSTRAINT session_blocks_split_method_check CHECK (split_method IN ('last_name', 'jersey_range', 'division', 'manual', 'none')),
  CONSTRAINT session_blocks_scoring_mode_check CHECK (scoring_mode IN ('full', 'observe'))
);

-- ─────────────────────────────────────────
-- SESSIONS
-- ─────────────────────────────────────────

CREATE TABLE sessions (
  id              SERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id),
  event_id        INT REFERENCES tryout_events(id) ON DELETE CASCADE,
  age_group_id    INT REFERENCES age_groups(id),
  block_id        INT REFERENCES session_blocks(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  session_type    VARCHAR(20) NOT NULL DEFAULT 'skills',
  -- session_type: skills | game
  session_date    DATE NOT NULL,
  start_time      TIME,
  status          VARCHAR(20) DEFAULT 'pending',
  -- status: pending | active | complete | scoring_complete | finalized
  last_name_start VARCHAR(255),
  last_name_end   VARCHAR(255),
  jersey_min      INT,
  jersey_max      INT,
  home_team       SMALLINT,
  away_team       SMALLINT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sessions_session_type_check CHECK (session_type IN ('skills', 'game')),
  CONSTRAINT sessions_status_check       CHECK (status       IN ('pending', 'active', 'complete', 'scoring_complete', 'finalized'))
);

-- ─────────────────────────────────────────
-- GAME TEAMS
-- Team definitions within a game block
-- ─────────────────────────────────────────

CREATE TABLE game_teams (
  id            SERIAL PRIMARY KEY,
  block_id      INT NOT NULL REFERENCES session_blocks(id) ON DELETE CASCADE,
  team_number   SMALLINT NOT NULL,
  jersey_color  VARCHAR(50),
  label         VARCHAR(100),
  UNIQUE(block_id, team_number)
);

-- ─────────────────────────────────────────
-- PLAYERS
-- ─────────────────────────────────────────

CREATE TABLE players (
  id              SERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id),
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  date_of_birth   DATE,
  gender          VARCHAR(1),
  external_id     VARCHAR(100),
  shot            VARCHAR(1) CHECK (shot IN ('L', 'R')),
  birth_year      INT,
  jersey_number   INT,
  age_group_id    INT REFERENCES age_groups(id),
  event_id        INT REFERENCES tryout_events(id) ON DELETE CASCADE,
  position        VARCHAR(20) DEFAULT 'skater',
  -- position: skater | goalie | defense | forward
  will_tryout     BOOLEAN DEFAULT TRUE,
  outcome         VARCHAR(20) DEFAULT NULL,
  -- outcome: moved_up | retained | left_program | NULL
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT players_position_check CHECK (position IN ('skater', 'goalie', 'defense', 'forward')),
  CONSTRAINT players_outcome_check  CHECK (outcome  IN ('moved_up', 'retained', 'left_program')),
  CONSTRAINT players_gender_check   CHECK (gender   IN ('M', 'F'))
);

CREATE UNIQUE INDEX players_external_id_org_uniq
  ON players (external_id, organization_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE player_event_registrations (
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

-- ─────────────────────────────────────────
-- SESSION PLAYERS
-- Explicit player-to-session roster
-- ─────────────────────────────────────────

CREATE TABLE session_players (
  id                SERIAL PRIMARY KEY,
  session_id        INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id         INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  registration_id   INT REFERENCES player_event_registrations(id) ON DELETE CASCADE,
  team_number       SMALLINT,
  checked_in        BOOLEAN DEFAULT FALSE,
  checked_in_at     TIMESTAMPTZ,
  attendance_status VARCHAR(20),
  -- attendance_status: checked_in | late_arrival | no_show | excused
  UNIQUE(session_id, player_id),
  CONSTRAINT session_players_attendance_check
    CHECK (attendance_status IN ('checked_in', 'late_arrival', 'no_show', 'excused'))
);

-- ─────────────────────────────────────────
-- EVALUATION TEMPLATES
-- ─────────────────────────────────────────

CREATE TABLE evaluation_templates (
  id              SERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  is_default      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE evaluation_criteria (
  id           SERIAL PRIMARY KEY,
  template_id  INT NOT NULL REFERENCES evaluation_templates(id) ON DELETE CASCADE,
  key          VARCHAR(50) NOT NULL,
  label        VARCHAR(100) NOT NULL,
  description  TEXT,
  weight       NUMERIC(4,2) DEFAULT 1.0,
  sort_order   INT DEFAULT 0,
  UNIQUE(template_id, key)
);

-- FK now that evaluation_templates exists
ALTER TABLE age_groups
  ADD CONSTRAINT fk_age_groups_default_template
  FOREIGN KEY (default_template_id) REFERENCES evaluation_templates(id);

-- ─────────────────────────────────────────
-- SESSION SCORERS
-- ─────────────────────────────────────────

CREATE TABLE session_scorers (
  id          SERIAL PRIMARY KEY,
  session_id  INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- ─────────────────────────────────────────
-- SCORES
-- ─────────────────────────────────────────

CREATE TABLE scores (
  id              SERIAL PRIMARY KEY,
  session_id      INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id       INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  registration_id INT REFERENCES player_event_registrations(id) ON DELETE CASCADE,
  scorer_id       INT NOT NULL REFERENCES users(id),
  skating         SMALLINT CHECK (skating    BETWEEN 1 AND 5),
  puck_skills     SMALLINT CHECK (puck_skills BETWEEN 1 AND 5),
  hockey_sense    SMALLINT CHECK (hockey_sense BETWEEN 1 AND 5),
  notes           TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- status: draft | submitted | locked | finalized
  template_id     INT REFERENCES evaluation_templates(id),
  submitted_at    TIMESTAMPTZ,
  locked_at       TIMESTAMPTZ,
  finalized_at    TIMESTAMPTZ,
  locked_by       INT REFERENCES users(id),
  finalized_by    INT REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, player_id, scorer_id),
  CONSTRAINT scores_status_check CHECK (status IN ('draft', 'submitted', 'locked', 'finalized'))
);

-- ─────────────────────────────────────────
-- SCORE ENTRIES
-- Per-criterion values for rubric-driven scoring
-- ─────────────────────────────────────────

CREATE TABLE score_entries (
  id           SERIAL PRIMARY KEY,
  score_id     INT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  criterion_id INT NOT NULL REFERENCES evaluation_criteria(id),
  value        SMALLINT NOT NULL CHECK (value BETWEEN 1 AND 5),
  UNIQUE(score_id, criterion_id)
);

-- ─────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────

CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id),
  event           VARCHAR(100) NOT NULL,
  user_id         INT REFERENCES users(id) ON DELETE SET NULL,
  details         JSONB        NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_log IS
  'Security/ops event trail. Audited events: login_success, login_failure, logout, '
  'account_created, role_changed, password_changed, score_submitted, player_moved, '
  'session_status_changed, import_uploaded, import_committed, export_team_recommendations, '
  'export_sportsengine, evaluator_import_committed.';

-- ─────────────────────────────────────────
-- IMPORT BATCH TRACKING
-- ─────────────────────────────────────────

CREATE TABLE import_batches (
  id            SERIAL PRIMARY KEY,
  event_id      INT NOT NULL REFERENCES tryout_events(id) ON DELETE CASCADE,
  age_group_id  INT REFERENCES age_groups(id),
  import_type   VARCHAR(30) NOT NULL,
  -- import_type: players | evaluators | session_assignments
  status        VARCHAR(20) NOT NULL DEFAULT 'preview',
  -- status: preview | committed | rolled_back
  file_name     VARCHAR(255),
  row_count     INT NOT NULL DEFAULT 0,
  added_count   INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  error_count   INT NOT NULL DEFAULT 0,
  created_by    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  committed_at  TIMESTAMPTZ
);

CREATE TABLE import_batch_rows (
  id           SERIAL PRIMARY KEY,
  batch_id     INT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_index    INT NOT NULL,
  raw_data     JSONB NOT NULL,
  mapped_data  JSONB,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- status: ok | update | error | warning | skipped
  errors       TEXT[],
  warnings     TEXT[],
  result_data  JSONB,
  UNIQUE(batch_id, row_index)
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────

-- Per-org leading-column composites (RLS performance + tenant scoping)
CREATE INDEX idx_users_org_email            ON users (organization_id, email);
CREATE INDEX idx_tryout_events_org_start    ON tryout_events (organization_id, start_date DESC) WHERE archived = false;
CREATE INDEX idx_age_groups_org_sort        ON age_groups (organization_id, sort_order);
CREATE INDEX idx_sessions_org_date_time     ON sessions (organization_id, session_date, start_time);
CREATE INDEX idx_players_org_age_group      ON players (organization_id, age_group_id);
CREATE INDEX idx_eval_templates_org_default ON evaluation_templates (organization_id, is_default);
CREATE INDEX idx_audit_log_org_created      ON audit_log (organization_id, created_at DESC);

-- Event/session operational indexes
CREATE INDEX idx_session_event              ON sessions (event_id);
CREATE INDEX idx_session_block              ON sessions (block_id);
CREATE INDEX idx_sessions_age_group         ON sessions (age_group_id);
CREATE INDEX idx_sessions_event_ag          ON sessions (event_id, age_group_id);
CREATE INDEX idx_sessions_pending           ON sessions (session_date, start_time) WHERE status = 'pending';
CREATE INDEX idx_session_blocks_event       ON session_blocks (event_id);
CREATE INDEX idx_session_blocks_ag          ON session_blocks (age_group_id);

-- Player indexes
CREATE INDEX idx_players_event              ON players (event_id);
CREATE INDEX idx_players_age_group          ON players (age_group_id);
CREATE INDEX idx_players_event_ag           ON players (event_id, age_group_id);
CREATE INDEX idx_players_last_name_initial  ON players (upper(left(last_name, 1)));
CREATE INDEX idx_players_jersey_age_group_event ON players (jersey_number, age_group_id, event_id);

-- Registration indexes
CREATE INDEX idx_player_registrations_event    ON player_event_registrations (event_id);
CREATE INDEX idx_player_registrations_event_ag ON player_event_registrations (event_id, age_group_id);
CREATE INDEX idx_player_registrations_player   ON player_event_registrations (player_id);

-- Session roster/scorer indexes
CREATE INDEX idx_session_scorers            ON session_scorers (session_id);
CREATE INDEX idx_session_players_sess       ON session_players (session_id);
CREATE INDEX idx_session_players_play       ON session_players (player_id);
CREATE INDEX idx_session_players_reg        ON session_players (registration_id);

-- Score indexes
CREATE INDEX idx_scores_session             ON scores (session_id);
CREATE INDEX idx_scores_player              ON scores (player_id);
CREATE INDEX idx_scores_scorer              ON scores (scorer_id);
CREATE INDEX idx_scores_status              ON scores (status);
CREATE INDEX idx_scores_registration        ON scores (registration_id);
CREATE INDEX idx_score_entries_score        ON score_entries (score_id);

-- Audit log indexes
CREATE INDEX idx_audit_log_event            ON audit_log (event);
CREATE INDEX idx_audit_log_user_id          ON audit_log (user_id);
CREATE INDEX idx_audit_log_created_at       ON audit_log (created_at DESC);
CREATE INDEX idx_audit_log_user_created     ON audit_log (user_id, created_at DESC);
CREATE INDEX idx_audit_log_details_gin      ON audit_log USING GIN (details);

-- Import indexes
CREATE INDEX idx_import_batches_event       ON import_batches (event_id);
CREATE INDEX idx_import_batch_rows_batch    ON import_batch_rows (batch_id);
CREATE INDEX idx_import_batch_rows_status   ON import_batch_rows (batch_id, status);

-- ─────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_session_blocks_updated_at
  BEFORE UPDATE ON session_blocks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_scores_updated_at
  BEFORE UPDATE ON scores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-set checked_in_at when checked_in flips to true
CREATE OR REPLACE FUNCTION fn_session_player_checked_in_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.checked_in = TRUE AND (OLD.checked_in IS NULL OR OLD.checked_in = FALSE) THEN
    NEW.checked_in_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_session_players_checked_in_at
  BEFORE UPDATE ON session_players
  FOR EACH ROW EXECUTE FUNCTION fn_session_player_checked_in_at();

-- Cascade org_id from tryout_events to denorm children (sessions, players)
CREATE OR REPLACE FUNCTION fn_cascade_org_to_children()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    UPDATE sessions SET organization_id = NEW.organization_id WHERE event_id = NEW.id;
    UPDATE players  SET organization_id = NEW.organization_id WHERE event_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cascade_org_from_event
  AFTER UPDATE OF organization_id ON tryout_events
  FOR EACH ROW EXECUTE FUNCTION fn_cascade_org_to_children();

-- R2: age_group.default_template_id must belong to the same org
CREATE OR REPLACE FUNCTION fn_verify_template_org_matches_age_group()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_template_org INT;
BEGIN
  IF NEW.default_template_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT organization_id INTO v_template_org
    FROM evaluation_templates WHERE id = NEW.default_template_id;
  IF v_template_org <> NEW.organization_id THEN
    RAISE EXCEPTION
      'age_group.default_template_id must belong to the same org (age_group.org=%, template.org=%)',
      NEW.organization_id, v_template_org;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verify_template_org
  BEFORE INSERT OR UPDATE ON age_groups
  FOR EACH ROW EXECUTE FUNCTION fn_verify_template_org_matches_age_group();

-- R3: sessions.organization_id must match its parent event and age_group
CREATE OR REPLACE FUNCTION fn_verify_session_org_consistency()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_event_org INT; v_ag_org INT;
BEGIN
  SELECT organization_id INTO v_event_org FROM tryout_events WHERE id = NEW.event_id;
  IF NEW.organization_id <> v_event_org THEN
    RAISE EXCEPTION
      'sessions.organization_id (%) does not match tryout_events.organization_id (%)',
      NEW.organization_id, v_event_org;
  END IF;
  IF NEW.age_group_id IS NOT NULL THEN
    SELECT organization_id INTO v_ag_org FROM age_groups WHERE id = NEW.age_group_id;
    IF v_ag_org IS NOT NULL AND NEW.organization_id <> v_ag_org THEN
      RAISE EXCEPTION
        'sessions.organization_id (%) does not match age_groups.organization_id (%)',
        NEW.organization_id, v_ag_org;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verify_session_org
  BEFORE INSERT OR UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION fn_verify_session_org_consistency();

-- R4: scorer org must match the session's org
CREATE OR REPLACE FUNCTION fn_verify_scorer_org_matches_session()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_session_org INT; v_scorer_org INT;
BEGIN
  SELECT organization_id INTO v_session_org FROM sessions WHERE id = NEW.session_id;
  SELECT organization_id INTO v_scorer_org  FROM users    WHERE id = NEW.scorer_id;
  IF v_session_org IS DISTINCT FROM v_scorer_org THEN
    RAISE EXCEPTION
      'Cross-tenant score write blocked: session.org=%, scorer.org=%',
      v_session_org, v_scorer_org;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verify_scorer_org
  BEFORE INSERT ON scores
  FOR EACH ROW EXECUTE FUNCTION fn_verify_scorer_org_matches_session();

-- R5: import creator must belong to the same org as the event
CREATE OR REPLACE FUNCTION fn_verify_importer_org_matches_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_event_org INT; v_user_org INT;
BEGIN
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT organization_id INTO v_event_org FROM tryout_events WHERE id = NEW.event_id;
  SELECT organization_id INTO v_user_org  FROM users          WHERE id = NEW.created_by;
  IF v_event_org IS DISTINCT FROM v_user_org THEN
    RAISE EXCEPTION
      'Cross-tenant import blocked: event.org=%, user.org=%',
      v_event_org, v_user_org;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verify_importer_org
  BEFORE INSERT ON import_batches
  FOR EACH ROW EXECUTE FUNCTION fn_verify_importer_org_matches_event();

-- ─────────────────────────────────────────
-- RLS — Strategy C safety net
-- App-layer WHERE filters are primary; RLS returns 0 rows (not a leak)
-- if the app-layer filter is missing or wrong.
-- ─────────────────────────────────────────

DO $$ BEGIN
  CREATE ROLE tryout_app NOINHERIT LOGIN PASSWORD 'tryout_app_changeme';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT CONNECT ON DATABASE tryoutapp TO tryout_app;
GRANT USAGE ON SCHEMA public TO tryout_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tryout_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tryout_app;

DO $$ BEGIN
  CREATE ROLE tryout_migrations BYPASSRLS LOGIN PASSWORD 'tryout_migrations_changeme';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tryout_migrations;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO tryout_migrations;

ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryout_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_groups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE players              ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON users
  FOR ALL TO tryout_app
  USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::int);

CREATE POLICY tenant_isolation ON tryout_events
  FOR ALL TO tryout_app
  USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::int);

CREATE POLICY tenant_isolation ON age_groups
  FOR ALL TO tryout_app
  USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::int);

CREATE POLICY tenant_isolation ON sessions
  FOR ALL TO tryout_app
  USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::int);

CREATE POLICY tenant_isolation ON players
  FOR ALL TO tryout_app
  USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::int);

CREATE POLICY tenant_isolation ON evaluation_templates
  FOR ALL TO tryout_app
  USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::int);

CREATE POLICY tenant_isolation ON audit_log
  FOR ALL TO tryout_app
  USING (organization_id = NULLIF(current_setting('app.current_org', true), '')::int);

-- ─────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────

-- Default org: Weymouth Youth Hockey
INSERT INTO organizations (id, name, subdomain, slug)
VALUES (1, 'Weymouth Youth Hockey', 'weymouth', 'weymouth');

SELECT setval('organizations_id_seq', 1);

-- Evaluation templates (must come before age_groups so FK resolves)
INSERT INTO evaluation_templates (id, organization_id, name, description, is_default) VALUES
  (1, 1, '8U/10U Skills',  'ADM-aligned evaluation for Mites and Squirts — station-based agility focus', true),
  (2, 1, '12U Skills',     'ADM-aligned evaluation for Peewees — skating, puck play, sense and compete',  true),
  (3, 1, '14U/16U Skills', 'ADM-aligned evaluation for Bantams and Midgets — full game-readiness rubric', true);

SELECT setval('evaluation_templates_id_seq', 3);

-- 8U/10U criteria
INSERT INTO evaluation_criteria (template_id, key, label, description, weight, sort_order) VALUES
  (1, 'skating_agility', 'Skating Agility',     'Edge control, crossovers, balance and speed changes',    1.00, 1),
  (1, 'puck_control',    'Puck Control',         'Carrying, protecting and stickhandling at pace',         1.00, 2),
  (1, 'compete',         'Compete & Engagement', 'Effort level, battles, attention to instruction',        1.00, 3),
  (1, 'awareness',       'Small-Area Awareness', 'Positioning and reads in tight-space situations',        1.00, 4);

-- 12U criteria
INSERT INTO evaluation_criteria (template_id, key, label, description, weight, sort_order) VALUES
  (2, 'skating',      'Skating',                       'Technique, speed, agility and transitions',          1.00, 1),
  (2, 'puck_play',    'Puck Play',                     'Puck skills under pressure and creativity',          1.00, 2),
  (2, 'hockey_sense', 'Hockey Sense / Decision Making', 'Reads, positioning and time-and-space decisions',   1.25, 3),
  (2, 'compete',      'Compete',                       'Physical and mental compete level',                  1.00, 4);

-- 14U/16U criteria
INSERT INTO evaluation_criteria (template_id, key, label, description, weight, sort_order) VALUES
  (3, 'skating',      'Skating',                 'Power, edges, transitions and gap closing',               1.00, 1),
  (3, 'puck_play',    'Puck Play',               'Puck skills under pressure and at pace',                  1.00, 2),
  (3, 'hockey_sense', 'Hockey Sense',            'Reads, decision making and positioning',                  1.25, 3),
  (3, 'compete',      'Compete',                 'Battle level, physicality and will to win',               1.00, 4),
  (3, 'game_impact',  'Game Impact / Readiness', 'Overall effectiveness in game situations',                1.50, 5);

-- Age groups (with org + template FKs now that both exist)
INSERT INTO age_groups (id, organization_id, name, code, sort_order, default_template_id) VALUES
  (1, 1, 'Mites - U8',    'mites',   1, 1),
  (2, 1, 'Squirts - U10', 'squirts', 2, 1),
  (3, 1, 'Peewees - U12', 'peewees', 3, 2),
  (4, 1, 'Bantams - U14', 'bantams', 4, 3),
  (5, 1, 'Midgets - U16', 'midgets', 5, 3);

SELECT setval('age_groups_id_seq', 5);

-- Demo admin user (password: Admin1234!)
INSERT INTO users (organization_id, email, password, first_name, last_name, role) VALUES
  (1, 'admin@tryouts.local',
   '$2b$10$OhTCabsO6AlpKX9o/faLQ.umDxkUvqhuEDdz9zynA8Wpy5vDJAb4q',
   'Head', 'Admin', 'admin');

-- Demo tryout event
INSERT INTO tryout_events (organization_id, name, season, start_date, end_date) VALUES
  (1, 'Spring Tryouts 2026', '2025-2026', '2026-04-05', '2026-04-06');

-- Demo session block (Mites skills — last_name split)
INSERT INTO session_blocks (event_id, age_group_id, block_type, split_method, label, session_date) VALUES
  (1, 1, 'skills', 'last_name', 'Mites Skills — Monday', '2026-04-05');

-- Demo sessions within block
INSERT INTO sessions (organization_id, event_id, age_group_id, block_id, name, session_type, session_date, start_time, status, last_name_start, last_name_end) VALUES
  (1, 1, 1, 1, 'Mites 5:00 PM — A through F', 'skills', '2026-04-05', '17:00', 'pending', 'A', 'F'),
  (1, 1, 1, 1, 'Mites 6:00 PM — G through R', 'skills', '2026-04-05', '18:00', 'pending', 'G', 'R'),
  (1, 1, 1, 1, 'Mites 7:00 PM — S through Z', 'skills', '2026-04-05', '19:00', 'pending', 'S', 'Z');

-- Legacy-style session (no block)
INSERT INTO sessions (organization_id, event_id, age_group_id, name, session_type, session_date, start_time, status) VALUES
  (1, 1, 2, 'Squirts Day 1 Session 1', 'skills', '2026-04-05', '12:00', 'pending');

-- Demo Mite players
INSERT INTO players (organization_id, first_name, last_name, jersey_number, age_group_id, event_id, position) VALUES
  (1, 'Jake',   'Thompson',  1,  1, 1, 'skater'),
  (1, 'Liam',   'Rivera',    2,  1, 1, 'skater'),
  (1, 'Noah',   'Smith',     3,  1, 1, 'skater'),
  (1, 'Owen',   'Brooks',    4,  1, 1, 'skater'),
  (1, 'Ethan',  'Kane',      5,  1, 1, 'skater'),
  (1, 'Mason',  'Wright',    6,  1, 1, 'skater'),
  (1, 'Aiden',  'Clark',     7,  1, 1, 'skater'),
  (1, 'Lucas',  'Parker',    8,  1, 1, 'skater'),
  (1, 'Carter', 'Davis',     9,  1, 1, 'skater'),
  (1, 'Ryan',   'Harris',    10, 1, 1, 'skater'),
  (1, 'Finn',   'Murphy',    11, 1, 1, 'skater'),
  (1, 'Cole',   'Adams',     12, 1, 1, 'skater'),
  (1, 'Brady',  'Lee',       13, 1, 1, 'skater'),
  (1, 'Connor', 'Martinez',  14, 1, 1, 'skater'),
  (1, 'Tyler',  'Vogt',      15, 1, 1, 'skater');

INSERT INTO player_event_registrations (player_id, event_id, age_group_id, jersey_number, position, will_tryout)
SELECT id, event_id, age_group_id, jersey_number, position, will_tryout
FROM players
WHERE event_id IS NOT NULL;

-- Auto-assign Mite players to last-name split sessions
INSERT INTO session_players (session_id, player_id, registration_id)
SELECT 1, p.id, per.id FROM players p
JOIN player_event_registrations per ON per.player_id = p.id AND per.event_id = p.event_id
WHERE p.event_id = 1 AND p.age_group_id = 1
  AND UPPER(LEFT(p.last_name, 1)) BETWEEN 'A' AND 'F';

INSERT INTO session_players (session_id, player_id, registration_id)
SELECT 2, p.id, per.id FROM players p
JOIN player_event_registrations per ON per.player_id = p.id AND per.event_id = p.event_id
WHERE p.event_id = 1 AND p.age_group_id = 1
  AND UPPER(LEFT(p.last_name, 1)) BETWEEN 'G' AND 'R';

INSERT INTO session_players (session_id, player_id, registration_id)
SELECT 3, p.id, per.id FROM players p
JOIN player_event_registrations per ON per.player_id = p.id AND per.event_id = p.event_id
WHERE p.event_id = 1 AND p.age_group_id = 1
  AND UPPER(LEFT(p.last_name, 1)) BETWEEN 'S' AND 'Z';
