-- Migration 006: Import batch tracking
-- Adds import_batches and import_batch_rows tables so every import upload is
-- tracked end-to-end. The commit step reads pre-validated mapped_data from
-- import_batch_rows instead of re-parsing the original file, eliminating the
-- race condition in the old preview/commit flow.

CREATE TABLE import_batches (
  id            SERIAL PRIMARY KEY,
  event_id      INT NOT NULL REFERENCES tryout_events(id) ON DELETE CASCADE,
  age_group_id  INT REFERENCES age_groups(id),
  import_type   VARCHAR(30) NOT NULL,   -- 'players' | 'evaluators' | 'session_assignments'
  status        VARCHAR(20) NOT NULL DEFAULT 'preview',  -- 'preview' | 'committed' | 'rolled_back'
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
  raw_data     JSONB NOT NULL,   -- original parsed row as uploaded
  mapped_data  JSONB,            -- post-normalization data that commit will write
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'ok' | 'update' | 'error' | 'warning' | 'skipped'
  errors       TEXT[],
  warnings     TEXT[],
  result_data  JSONB,            -- populated after commit: { player_id, registration_id, ... }
  UNIQUE(batch_id, row_index)
);

CREATE INDEX idx_import_batches_event     ON import_batches(event_id);
CREATE INDEX idx_import_batch_rows_batch  ON import_batch_rows(batch_id);
CREATE INDEX idx_import_batch_rows_status ON import_batch_rows(batch_id, status);
