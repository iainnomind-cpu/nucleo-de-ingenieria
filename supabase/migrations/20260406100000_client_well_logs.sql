-- =============================================
-- Client Well Logs (Bitácora de Pozo del Cliente)
-- Public access via token — no auth required
-- =============================================

-- 1. Add access_token to installed_equipment
ALTER TABLE installed_equipment
ADD COLUMN IF NOT EXISTS access_token UUID DEFAULT uuid_generate_v4();

-- Ensure existing equipment gets tokens
UPDATE installed_equipment SET access_token = uuid_generate_v4() WHERE access_token IS NULL;

-- Index for fast token lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_access_token ON installed_equipment(access_token);

-- 2. Client Well Logs table
CREATE TABLE IF NOT EXISTS client_well_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES installed_equipment(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    log_date DATE NOT NULL,
    recorded_by TEXT,
    -- Basic readings the client can observe
    static_level DECIMAL(10, 2),
    dynamic_level DECIMAL(10, 2),
    flow_rate DECIMAL(10, 2),
    pressure DECIMAL(10, 2),
    hours_operation DECIMAL(10, 2),
    -- Observations
    observations TEXT,
    functionality_status TEXT DEFAULT 'normal'
        CHECK (functionality_status IN ('normal', 'intermittent', 'stopped', 'anomaly')),
    photos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX idx_client_well_logs_equipment ON client_well_logs(equipment_id);
CREATE INDEX idx_client_well_logs_client ON client_well_logs(client_id);
CREATE INDEX idx_client_well_logs_date ON client_well_logs(log_date DESC);

-- RLS
ALTER TABLE client_well_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access on client_well_logs" ON client_well_logs FOR SELECT USING (true);
CREATE POLICY "Allow all access on client_well_logs" ON client_well_logs FOR ALL USING (true) WITH CHECK (true);
