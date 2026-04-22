-- Migration 007: Multi-Tenant Foundation
-- Adds organizations table and scopes all tenant-owned tables to it.
-- Strategy C: app-layer WHERE filters (primary) + RLS (safety net).
-- Runs in a single transaction — any failure rolls back completely.

BEGIN;

-- =========================================================
-- Phase A: organizations table + seed Weymouth
-- =========================================================

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

INSERT INTO organizations (id, name, subdomain, slug)
VALUES (1, 'Weymouth Youth Hockey', 'weymouth', 'weymouth');

-- Advance sequence past 1 so next org gets id=2
SELECT setval('organizations_id_seq', 1);

-- =========================================================
-- Phase B: Add nullable organization_id columns
-- =========================================================

ALTER TABLE users                ADD COLUMN organization_id INT REFERENCES organizations(id);
ALTER TABLE tryout_events        ADD COLUMN organization_id INT REFERENCES organizations(id);
ALTER TABLE age_groups           ADD COLUMN organization_id INT REFERENCES organizations(id);
ALTER TABLE sessions             ADD COLUMN organization_id INT REFERENCES organizations(id);
ALTER TABLE players              ADD COLUMN organization_id INT REFERENCES organizations(id);
ALTER TABLE evaluation_templates ADD COLUMN organization_id INT REFERENCES organizations(id);
ALTER TABLE audit_log            ADD COLUMN organization_id INT REFERENCES organizations(id);

-- =========================================================
-- Phase C: Backfill — all existing rows belong to Weymouth
-- =========================================================

UPDATE users                SET organization_id = 1;
UPDATE tryout_events        SET organization_id = 1;
UPDATE age_groups           SET organization_id = 1;
UPDATE evaluation_templates SET organization_id = 1;
UPDATE audit_log            SET organization_id = 1;

-- sessions and players: denorm from their parent event
UPDATE sessions s
  SET organization_id = e.organization_id
  FROM tryout_events e
  WHERE s.event_id = e.id;

UPDATE players p
  SET organization_id = e.organization_id
  FROM tryout_events e
  WHERE p.event_id = e.id;

-- =========================================================
-- Phase D: Swap globally-unique constraints
-- (These block multi-tenancy until replaced with composite UNIQUEs)
-- =========================================================

-- users.email: drop global, add per-org
ALTER TABLE users DROP CONSTRAINT users_email_key;
ALTER TABLE users ADD CONSTRAINT users_email_org_uniq UNIQUE (email, organization_id);

-- age_groups.code: drop global, add per-org
ALTER TABLE age_groups DROP CONSTRAINT age_groups_code_key;
ALTER TABLE age_groups ADD CONSTRAINT age_groups_code_org_uniq UNIQUE (code, organization_id);

-- players.external_id: was a partial unique index from migration 005
-- Drop it and replace with org-scoped partial index
DROP INDEX IF EXISTS players_external_id_uniq;
CREATE UNIQUE INDEX players_external_id_org_uniq
  ON players (external_id, organization_id)
  WHERE external_id IS NOT NULL;

-- =========================================================
-- Phase E: NOT NULL — enforce tenant membership
-- =========================================================

ALTER TABLE users                ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE tryout_events        ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE age_groups           ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE sessions             ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE players              ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE evaluation_templates ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE audit_log            ALTER COLUMN organization_id SET NOT NULL;

-- =========================================================
-- Phase F: RLS roles + policies (Strategy C safety net)
-- If app-layer filter is missing, RLS returns 0 rows (not a leak).
-- =========================================================

-- Application role: used by pool.js at request time
DO $$ BEGIN
  CREATE ROLE tryout_app NOINHERIT LOGIN PASSWORD 'tryout_app_changeme';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT CONNECT ON DATABASE tryoutapp TO tryout_app;
GRANT USAGE ON SCHEMA public TO tryout_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tryout_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tryout_app;

-- Migrations role: bypasses RLS so DDL scripts and the scheduler can run
DO $$ BEGIN
  CREATE ROLE tryout_migrations BYPASSRLS LOGIN PASSWORD 'tryout_migrations_changeme';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tryout_migrations;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO tryout_migrations;

-- Enable RLS on all Class 1 (direct tenant-owned) tables
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryout_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_groups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE players              ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;

-- RLS policies for tryout_app role.
-- current_setting('app.current_org', true) returns NULL if not set (missing_ok=true).
-- NULL::int comparison yields NULL (not true), so unset context returns 0 rows — safe by default.
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

-- =========================================================
-- Phase G: Triggers — DB-level consistency invariants
-- =========================================================

-- Cascade org_id from tryout_events to denorm children (sessions, players).
-- In practice org_id never changes post-creation, but this enforces the invariant.
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

-- R2: age_group.default_template_id must belong to the same org as the age_group.
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

-- R3: sessions.organization_id must match its parent event (and age_group when set).
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

-- R4: scorer org must match the session's org — primary cross-tenant leak vector.
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

-- R5: import creator must belong to the same org as the event being imported into.
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

-- =========================================================
-- Phase H: Composite indexes — organization_id as leading column
-- Critical for RLS policy evaluation performance.
-- =========================================================

CREATE INDEX idx_users_org_email
  ON users (organization_id, email);

CREATE INDEX idx_tryout_events_org_start
  ON tryout_events (organization_id, start_date DESC)
  WHERE archived = false;

CREATE INDEX idx_age_groups_org_sort
  ON age_groups (organization_id, sort_order);

CREATE INDEX idx_sessions_org_date_time
  ON sessions (organization_id, session_date, start_time);

CREATE INDEX idx_players_org_age_group
  ON players (organization_id, age_group_id);

CREATE INDEX idx_eval_templates_org_default
  ON evaluation_templates (organization_id, is_default);

CREATE INDEX idx_audit_log_org_created
  ON audit_log (organization_id, created_at DESC);

COMMIT;
