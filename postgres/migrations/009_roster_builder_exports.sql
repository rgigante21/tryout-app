-- Persist admin-built roster team assignments and generated export packages.

CREATE TABLE IF NOT EXISTS roster_teams (
  id              SERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id),
  event_id        INT NOT NULL REFERENCES tryout_events(id) ON DELETE CASCADE,
  age_group_id    INT NOT NULL REFERENCES age_groups(id) ON DELETE CASCADE,
  name            VARCHAR(120) NOT NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  created_by      INT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, age_group_id, sort_order)
);

CREATE TABLE IF NOT EXISTS roster_team_players (
  id             SERIAL PRIMARY KEY,
  roster_team_id INT NOT NULL REFERENCES roster_teams(id) ON DELETE CASCADE,
  registration_id INT NOT NULL REFERENCES player_event_registrations(id) ON DELETE CASCADE,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(roster_team_id, registration_id),
  UNIQUE(registration_id)
);

CREATE TABLE IF NOT EXISTS roster_exports (
  id              SERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id),
  event_id        INT NOT NULL REFERENCES tryout_events(id) ON DELETE CASCADE,
  age_group_id    INT NOT NULL REFERENCES age_groups(id) ON DELETE CASCADE,
  export_type     VARCHAR(50) NOT NULL DEFAULT 'sportsengine_roster',
  folder_name     VARCHAR(255) NOT NULL,
  file_name       VARCHAR(255) NOT NULL,
  row_count       INT NOT NULL DEFAULT 0,
  csv_content     TEXT NOT NULL,
  created_by      INT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roster_teams_event_group
  ON roster_teams (organization_id, event_id, age_group_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_roster_exports_event_group_created
  ON roster_exports (organization_id, event_id, age_group_id, created_at DESC);
