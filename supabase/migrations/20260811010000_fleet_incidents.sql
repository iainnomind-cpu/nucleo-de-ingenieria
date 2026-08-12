-- 1. Create fleet_incidents table
CREATE TABLE IF NOT EXISTS fleet_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
    driver_name TEXT,
    location TEXT,
    description TEXT NOT NULL,
    severity TEXT DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'total_loss')),
    reported_to_insurance BOOLEAN DEFAULT false,
    insurance_claim_number TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_fleet_incidents_vehicle ON fleet_incidents(vehicle_id);

ALTER TABLE fleet_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on fleet_incidents" ON fleet_incidents FOR ALL USING (true) WITH CHECK (true);

-- 2. Add access_token to equipment_repairs for public tracking links
ALTER TABLE equipment_repairs ADD COLUMN IF NOT EXISTS access_token UUID DEFAULT uuid_generate_v4() UNIQUE;
