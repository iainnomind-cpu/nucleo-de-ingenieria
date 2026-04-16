-- Add meta_name column to wa_templates
-- Stores the exact snake_case name registered with Meta, so we send the correct identifier
-- when using the template. Fixes error #132001 "Template name does not exist in the translation".

ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS meta_name VARCHAR(255);

-- Backfill: for existing templates that already have a meta_template_id or are approved,
-- derive meta_name from the current name (lowercase snake_case)
UPDATE wa_templates
SET meta_name = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9_]', '_', 'g'))
WHERE meta_name IS NULL
  AND meta_status IN ('approved', 'pending');
