-- Hockey Tryout App - Database Schema
-- Runs automatically on first postgres container start

-- ─────────────────────────────────────────
-- CORE TABLES (existing, unchanged)
-- ─────────────────────────────────────────

CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  role        VARCHAR(50) NOT NULL DEFAULT 'scorer',
  -- roles: scorer | coordinator | admin
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE age_groups (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(100) NOT NULL,
  code                VARCHAR(20) NOT NULL UNIQUE,
  sort_order          INT DEFAULT 0,
  default_template_id INT  -- FK added after evaluation_templates is created
);

CREATE TABLE tryout_events (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  season      VARCHAR(20) NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  archived    BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SESSION BLOCKS  (new)
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
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SESSIONS  (extended from existing)
-- ─────────────────────────────────────────

CREATE TABLE sessions (
  id              SERIAL PRIMARY KEY,
  event_id        INT REFERENCES tryout_events(id) ON DELETE CASCADE,
  age_group_id    INT REFERENCES age_groups(id),
  block_id        INT REFERENCES session_blocks(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  session_type    VARCHAR(20) NOT NULL DEFAULT 'skills',
  -- session_type: skills | game
  session_date    DATE NOT NULL,
  start_time      TIME,
  status          VARCHAR(20) DEFAULT 'pending',
  -- status: pending | active | complete
  -- Skills split range fields (null for game sessions or unsplit)
  last_name_start VARCHAR(5),
  last_name_end   VARCHAR(5),
  jersey_min      INT,
  jersey_max      INT,
  -- Game matchup fields
  home_team       SMALLINT,
  away_team       SMALLINT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- GAME TEAMS  (new)
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
-- PLAYERS  (extended from existing)
-- ─────────────────────────────────────────

CREATE TABLE players (
  id            SERIAL PRIMARY KEY,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  gender        VARCHAR(1),
  external_id   VARCHAR(100),
  shot          VARCHAR(1) CHECK (shot IN ('L','R')),
  birth_year    INT,
  -- Transitional legacy columns kept nullable during registration-model cutover
  jersey_number INT,
  age_group_id  INT REFERENCES age_groups(id),
  event_id      INT REFERENCES tryout_events(id) ON DELETE CASCADE,
  position      VARCHAR(20) DEFAULT 'skater',
  -- position: skater | goalie | defense | forward
  will_tryout   BOOLEAN DEFAULT TRUE,
  outcome       VARCHAR(20) DEFAULT NULL,
  -- outcome: moved_up | retained | left_program | NULL
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX players_external_id_uniq
  ON players (external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE player_event_registrations (
  id            SERIAL PRIMARY KEY,
  player_id     INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event_id      INT NOT NULL REFERENCES tryout_events(id) ON DELETE CASCADE,
  age_group_id  INT NOT NULL REFERENCES age_groups(id),
  jersey_number INT,
  position      VARCHAR(20) DEFAULT 'skater',
  shot          VARCHAR(1) CHECK (shot IN ('L','R')),
  will_tryout   BOOLEAN DEFAULT TRUE,
  outcome       VARCHAR(20) DEFAULT NULL,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, event_id)
);

-- ─────────────────────────────────────────
-- SESSION PLAYERS  (new)
-- Explicit player-to-session roster
-- Populated by split-method auto-assignment
-- ─────────────────────────────────────────

CREATE TABLE session_players (
  id                SERIAL PRIMARY KEY,
  session_id        INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id         INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  registration_id   INT REFERENCES player_event_registrations(id) ON DELETE CASCADE,
  team_number       SMALLINT,        -- populated for game sessions
  checked_in        BOOLEAN DEFAULT FALSE,
  checked_in_at     TIMESTAMPTZ,
  attendance_status VARCHAR(20),     -- checked_in | late_arrival | no_show | excused
  UNIQUE(session_id, player_id)
);

-- ─────────────────────────────────────────
-- EVALUATION TEMPLATES  (new)
-- ADM-aligned rubrics per age band
-- ─────────────────────────────────────────

CREATE TABLE evaluation_templates (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  is_default   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
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
-- SCORERS ASSIGNED TO SESSIONS (existing)
-- ─────────────────────────────────────────

CREATE TABLE session_scorers (
  id          SERIAL PRIMARY KEY,
  session_id  INT REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     INT REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- ─────────────────────────────────────────
-- SCORES  (extended from existing)
-- ─────────────────────────────────────────

CREATE TABLE scores (
  id             SERIAL PRIMARY KEY,
  session_id     INT REFERENCES sessions(id) ON DELETE CASCADE,
  player_id      INT REFERENCES players(id) ON DELETE CASCADE,
  registration_id INT REFERENCES player_event_registrations(id) ON DELETE CASCADE,
  scorer_id      INT REFERENCES users(id),
  -- Legacy hardcoded criteria (kept for backward compat during POC)
  skating        SMALLINT CHECK (skating BETWEEN 1 AND 5),
  puck_skills    SMALLINT CHECK (puck_skills BETWEEN 1 AND 5),
  hockey_sense   SMALLINT CHECK (hockey_sense BETWEEN 1 AND 5),
  notes          TEXT,
  -- Status & audit
  status         VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- status: draft | submitted | locked | finalized
  template_id    INT REFERENCES evaluation_templates(id),
  submitted_at   TIMESTAMPTZ,
  locked_at      TIMESTAMPTZ,
  finalized_at   TIMESTAMPTZ,
  locked_by      INT REFERENCES users(id),
  finalized_by   INT REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, player_id, scorer_id)
);

-- ─────────────────────────────────────────
-- SCORE ENTRIES  (new)
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
-- INDEXES
-- ─────────────────────────────────────────

CREATE INDEX idx_scores_session       ON scores(session_id);
CREATE INDEX idx_scores_player        ON scores(player_id);
CREATE INDEX idx_scores_scorer        ON scores(scorer_id);
CREATE INDEX idx_session_event        ON sessions(event_id);
CREATE INDEX idx_session_block        ON sessions(block_id);
CREATE INDEX idx_players_event        ON players(event_id);
CREATE INDEX idx_players_age_group    ON players(age_group_id);
CREATE INDEX idx_player_registrations_event       ON player_event_registrations(event_id);
CREATE INDEX idx_player_registrations_event_ag    ON player_event_registrations(event_id, age_group_id);
CREATE INDEX idx_player_registrations_player      ON player_event_registrations(player_id);
CREATE INDEX idx_session_scorers      ON session_scorers(session_id);
CREATE INDEX idx_session_players_sess ON session_players(session_id);
CREATE INDEX idx_session_players_play ON session_players(player_id);
CREATE INDEX idx_session_players_reg  ON session_players(registration_id);
CREATE INDEX idx_score_entries_score  ON score_entries(score_id);
CREATE INDEX idx_session_blocks_event ON session_blocks(event_id);
CREATE INDEX idx_scores_registration  ON scores(registration_id);

-- ─────────────────────────────────────────
-- AUDIT LOG
-- Security-relevant event trail.
-- Never store: passwords, tokens, DB credentials, secrets.
-- ─────────────────────────────────────────

CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  event      VARCHAR(100) NOT NULL,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  details    JSONB        NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_event      ON audit_log (event);
CREATE INDEX idx_audit_log_user_id    ON audit_log (user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log (created_at DESC);

COMMENT ON TABLE audit_log IS
  'Security/ops event trail. Audited events: login_success, login_failure, logout, '
  'account_created, role_changed, password_changed, score_submitted, player_moved, '
  'session_status_changed.';

-- ─────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────

-- Age groups
INSERT INTO age_groups (name, code, sort_order) VALUES
  ('Mites - U8',    'mites',    1),
  ('Squirts - U10', 'squirts',  2),
  ('Peewees - U12', 'peewees',  3),
  ('Bantams - U14', 'bantams',  4),
  ('Midgets - U16', 'midgets',  5);

-- ADM-aligned evaluation templates
INSERT INTO evaluation_templates (name, description, is_default) VALUES
  ('8U/10U Skills',   'ADM-aligned evaluation for Mites and Squirts — station-based agility focus', true),
  ('12U Skills',      'ADM-aligned evaluation for Peewees — skating, puck play, sense and compete', true),
  ('14U/16U Skills',  'ADM-aligned evaluation for Bantams and Midgets — full game-readiness rubric', true);

-- 8U/10U criteria  (template_id = 1)
INSERT INTO evaluation_criteria (template_id, key, label, description, weight, sort_order) VALUES
  (1, 'skating_agility', 'Skating Agility',      'Edge control, crossovers, balance and speed changes',       1.00, 1),
  (1, 'puck_control',    'Puck Control',          'Carrying, protecting and stickhandling at pace',            1.00, 2),
  (1, 'compete',         'Compete & Engagement',  'Effort level, battles, attention to instruction',           1.00, 3),
  (1, 'awareness',       'Small-Area Awareness',  'Positioning and reads in tight-space situations',           1.00, 4);

-- 12U criteria  (template_id = 2)
INSERT INTO evaluation_criteria (template_id, key, label, description, weight, sort_order) VALUES
  (2, 'skating',       'Skating',                     'Technique, speed, agility and transitions',             1.00, 1),
  (2, 'puck_play',     'Puck Play',                   'Puck skills under pressure and creativity',             1.00, 2),
  (2, 'hockey_sense',  'Hockey Sense / Decision Making', 'Reads, positioning and time-and-space decisions',    1.25, 3),
  (2, 'compete',       'Compete',                     'Physical and mental compete level',                     1.00, 4);

-- 14U/16U criteria  (template_id = 3)
INSERT INTO evaluation_criteria (template_id, key, label, description, weight, sort_order) VALUES
  (3, 'skating',      'Skating',                'Power, edges, transitions and gap closing',                   1.00, 1),
  (3, 'puck_play',    'Puck Play',              'Puck skills under pressure and at pace',                      1.00, 2),
  (3, 'hockey_sense', 'Hockey Sense',           'Reads, decision making and positioning',                      1.25, 3),
  (3, 'compete',      'Compete',                'Battle level, physicality and will to win',                   1.00, 4),
  (3, 'game_impact',  'Game Impact / Readiness','Overall effectiveness in game situations',                    1.50, 5);

-- Assign default templates to age groups
UPDATE age_groups SET default_template_id = 1 WHERE code IN ('mites', 'squirts');
UPDATE age_groups SET default_template_id = 2 WHERE code = 'peewees';
UPDATE age_groups SET default_template_id = 3 WHERE code IN ('bantams', 'midgets');

-- Demo admin user  (password: Admin1234!)
INSERT INTO users (email, password, first_name, last_name, role) VALUES
  ('admin@tryouts.local',
   '$2b$10$OhTCabsO6AlpKX9o/faLQ.umDxkUvqhuEDdz9zynA8Wpy5vDJAb4q',
   'Head', 'Admin', 'admin');

-- Demo tryout event
INSERT INTO tryout_events (name, season, start_date, end_date) VALUES
  ('Spring Tryouts 2026', '2025-2026', '2026-04-05', '2026-04-06');

-- Demo session block (Mites skills — last_name split)
INSERT INTO session_blocks (event_id, age_group_id, block_type, split_method, label, session_date) VALUES
  (1, 1, 'skills', 'last_name', 'Mites Skills — Monday', '2026-04-05');

-- Demo sessions within block (block_id = 1)
INSERT INTO sessions (event_id, age_group_id, block_id, name, session_type, session_date, start_time, status, last_name_start, last_name_end) VALUES
  (1, 1, 1, 'Mites 5:00 PM — A through F',  'skills', '2026-04-05', '17:00', 'pending', 'A', 'F'),
  (1, 1, 1, 'Mites 6:00 PM — G through R',  'skills', '2026-04-05', '18:00', 'pending', 'G', 'R'),
  (1, 1, 1, 'Mites 7:00 PM — S through Z',  'skills', '2026-04-05', '19:00', 'pending', 'S', 'Z');

-- Demo Squirts session (no block — legacy style, still works)
INSERT INTO sessions (event_id, age_group_id, name, session_type, session_date, start_time, status) VALUES
  (1, 2, 'Squirts Day 1 Session 1', 'skills', '2026-04-05', '12:00', 'pending');

-- Demo Mite players
INSERT INTO players (first_name, last_name, jersey_number, age_group_id, event_id, position) VALUES
  ('Jake',    'Thompson',  1,  1, 1, 'skater'),
  ('Liam',    'Rivera',    2,  1, 1, 'skater'),
  ('Noah',    'Smith',     3,  1, 1, 'skater'),
  ('Owen',    'Brooks',    4,  1, 1, 'skater'),
  ('Ethan',   'Kane',      5,  1, 1, 'skater'),
  ('Mason',   'Wright',    6,  1, 1, 'skater'),
  ('Aiden',   'Clark',     7,  1, 1, 'skater'),
  ('Lucas',   'Parker',    8,  1, 1, 'skater'),
  ('Carter',  'Davis',     9,  1, 1, 'skater'),
  ('Ryan',    'Harris',    10, 1, 1, 'skater'),
  ('Finn',    'Murphy',    11, 1, 1, 'skater'),
  ('Cole',    'Adams',     12, 1, 1, 'skater'),
  ('Brady',   'Lee',       13, 1, 1, 'skater'),
  ('Connor',  'Martinez',  14, 1, 1, 'skater'),
  ('Tyler',   'Vogt',      15, 1, 1, 'skater');

INSERT INTO player_event_registrations (player_id, event_id, age_group_id, jersey_number, position, will_tryout)
SELECT id, event_id, age_group_id, jersey_number, position, will_tryout
FROM players
WHERE event_id IS NOT NULL;

-- Auto-assign Mite players to their last-name sessions
-- Session 1: A-F  → Adams, Brooks, Clark, Davis
-- Session 2: G-R  → Harris, Kane, Lee, Martinez, Murphy, Parker, Rivera
-- Session 3: S-Z  → Smith, Thompson, Vogt, Wright
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
