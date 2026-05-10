-- Session planning automation
-- Allows generated last-name split boundaries to use full normalized names
-- instead of only first-letter ranges.

ALTER TABLE sessions
  ALTER COLUMN last_name_start TYPE VARCHAR(255),
  ALTER COLUMN last_name_end   TYPE VARCHAR(255);
