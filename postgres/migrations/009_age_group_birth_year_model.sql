-- Migration 009: Age group birth year validation model
-- Adds max_age (U-level), birth_year_min, birth_year_max to age_groups.
-- U-level groups store max_age; valid birth years are derived at runtime from the event's season year.
-- Birth-year groups store birth_year_min/max explicitly.
-- If all three are null, no birth year validation runs.

ALTER TABLE age_groups
  ADD COLUMN max_age        INT NULL,
  ADD COLUMN birth_year_min INT NULL,
  ADD COLUMN birth_year_max INT NULL;

-- Seed max_age for org 1's existing age groups
UPDATE age_groups SET max_age =  8 WHERE organization_id = 1 AND code = 'mites';
UPDATE age_groups SET max_age = 10 WHERE organization_id = 1 AND code = 'squirts';
UPDATE age_groups SET max_age = 12 WHERE organization_id = 1 AND code = 'peewees';
UPDATE age_groups SET max_age = 14 WHERE organization_id = 1 AND code = 'bantams';
UPDATE age_groups SET max_age = 16 WHERE organization_id = 1 AND code = 'midgets';
