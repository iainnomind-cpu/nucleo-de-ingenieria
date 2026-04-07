-- =============================================
-- Project Vehicles Assignment Table
-- Links specific vehicles to projects with date ranges
-- to prevent double-booking and enable fleet planning
-- =============================================

CREATE TABLE IF NOT EXISTS project_vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    assigned_date DATE NOT NULL,
    release_date DATE,
    operator_name TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX idx_project_vehicles_project ON project_vehicles(project_id);
CREATE INDEX idx_project_vehicles_vehicle ON project_vehicles(vehicle_id);
CREATE INDEX idx_project_vehicles_dates ON project_vehicles(assigned_date, release_date);

-- RLS
ALTER TABLE project_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access on project_vehicles" ON project_vehicles FOR SELECT USING (true);
CREATE POLICY "Allow all access on project_vehicles" ON project_vehicles FOR ALL USING (true) WITH CHECK (true);
