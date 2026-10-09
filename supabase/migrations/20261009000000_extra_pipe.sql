ALTER TABLE well_installations ADD COLUMN IF NOT EXISTS extra_pipe_desc TEXT;
ALTER TABLE well_installations ADD COLUMN IF NOT EXISTS extra_pipe_length VARCHAR(50);
ALTER TABLE well_uninstallations ADD COLUMN IF NOT EXISTS extra_pipe_desc TEXT;
ALTER TABLE well_uninstallations ADD COLUMN IF NOT EXISTS extra_pipe_length VARCHAR(50);
