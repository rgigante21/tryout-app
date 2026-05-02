-- Migration 010: Per-org feature flags
-- Adds a JSONB `features` column to organizations.
-- New flags are added to this object rather than as individual boolean columns.
-- See docs/adr/0001-org-feature-flags-jsonb.md

ALTER TABLE organizations
  ADD COLUMN features JSONB NOT NULL DEFAULT '{}';

-- Seed known flags for org 1
UPDATE organizations SET features = '{"multi_rink": false}' WHERE id = 1;
