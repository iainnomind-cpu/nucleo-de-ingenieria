-- Add created_by column to track who prospected/registered the client
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES app_users(id) ON DELETE SET NULL;

-- Log activity reference if needed later
