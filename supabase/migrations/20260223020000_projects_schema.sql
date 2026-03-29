-- MÓDULO: M3 · GESTIÓN DE PROYECTOS & OPERACIONES

-- Dropping existing tables if they exist (to replace mock data from Dashboard analytics phase)
DROP TABLE IF EXISTS project_incidents CASCADE;
DROP TABLE IF EXISTS field_logs CASCADE;
DROP TABLE IF EXISTS project_tasks CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- 1. Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_number VARCHAR(50) UNIQUE NOT NULL, -- PRY-2026-0001
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    work_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending', -- pending, preparation, in_field, completed, invoiced, cancelled
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    -- Technical details
    well_depth DECIMAL(10,2),
    motor_hp DECIMAL(10,2),
    location TEXT,
    -- Schedule
    start_date DATE,
    end_date DATE,
    actual_start DATE,
    actual_end DATE,
    estimated_days INTEGER DEFAULT 1,
    -- Team
    project_manager VARCHAR(255),
    assigned_team JSONB DEFAULT '[]', -- ["Samara", "Joel", "Alejandro"]
    -- Financials
    quoted_amount DECIMAL(15,2) DEFAULT 0,
    actual_cost DECIMAL(15,2) DEFAULT 0,
    -- Checklist pre-trabajo
    checklist_invoice BOOLEAN DEFAULT false,
    checklist_materials BOOLEAN DEFAULT false,
    checklist_vehicle BOOLEAN DEFAULT false,
    checklist_team BOOLEAN DEFAULT false,
    checklist_completed_at TIMESTAMP WITH TIME ZONE,
    -- Meta
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Project Tasks (Cronograma)
CREATE TABLE project_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, blocked
    priority VARCHAR(20) DEFAULT 'normal',
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_hours DECIMAL(6,2),
    actual_hours DECIMAL(6,2),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Field Logs (Bitácora de campo)
CREATE TABLE field_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    author VARCHAR(255),
    weather VARCHAR(50), -- sunny, cloudy, rainy, windy
    arrival_time TIME,
    departure_time TIME,
    summary TEXT NOT NULL,
    activities_done TEXT,
    materials_used TEXT,
    -- Pump test / startup report
    pump_test_data JSONB, -- { pressure, flow, voltage, amps, frequency, etc. }
    photos JSONB DEFAULT '[]', -- URLs de fotos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Incidents
CREATE TABLE project_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    incident_type VARCHAR(50) NOT NULL, -- tire, leak, delay, equipment, weather, other
    severity VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cost_impact DECIMAL(15,2) DEFAULT 0,
    time_impact_hours DECIMAL(6,2) DEFAULT 0,
    resolution TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    reported_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Triggers
CREATE TRIGGER update_projects_modtime
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_project_tasks_modtime
    BEFORE UPDATE ON project_tasks
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to project_tasks" ON project_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to field_logs" ON field_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to project_incidents" ON project_incidents FOR ALL USING (true) WITH CHECK (true);

-- Sequence
CREATE SEQUENCE IF NOT EXISTS project_number_seq START 1;
