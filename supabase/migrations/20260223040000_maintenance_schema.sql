-- MÓDULO: M5 · MANTENIMIENTO PREDICTIVO & POSTVENTA

DROP TABLE IF EXISTS maintenance_contracts CASCADE;
DROP TABLE IF EXISTS equipment_warranties CASCADE;
DROP TABLE IF EXISTS monitoring_logs CASCADE;
DROP TABLE IF EXISTS maintenance_schedules CASCADE;
DROP TABLE IF EXISTS installed_equipment CASCADE;

-- 1. Equipos instalados
CREATE TABLE installed_equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    equipment_type VARCHAR(100) NOT NULL, -- variador, ventilador, bomba, motor, tablero, cable, tuberia, otro
    brand VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    well_name VARCHAR(255), -- nombre del pozo
    installation_date DATE,
    location TEXT,
    specs JSONB DEFAULT '{}', -- {hp, voltage, frequency, depth, etc}
    status VARCHAR(50) DEFAULT 'active', -- active, maintenance, inactive, replaced
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Agenda de mantenimiento
CREATE TABLE maintenance_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID REFERENCES installed_equipment(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    service_type VARCHAR(100) NOT NULL, -- revision_general, variador, ventilador, termografia, ppm, videograbacion, otro
    title VARCHAR(255) NOT NULL,
    description TEXT,
    frequency_months INTEGER DEFAULT 12, -- cada cuántos meses
    last_service_date DATE,
    next_service_date DATE NOT NULL,
    alert_days_before INTEGER DEFAULT 15, -- días antes para alertar
    assigned_to VARCHAR(255),
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, notified, confirmed, in_progress, completed, overdue, cancelled
    completed_at TIMESTAMP WITH TIME ZONE,
    completion_notes TEXT,
    cost DECIMAL(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bitácora de monitoreo (lecturas de campo)
CREATE TABLE monitoring_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID REFERENCES installed_equipment(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by VARCHAR(255),
    -- Lecturas
    static_level DECIMAL(10,2),      -- nivel estático (m)
    dynamic_level DECIMAL(10,2),     -- nivel dinámico (m)
    amperage DECIMAL(10,2),          -- amperaje (A)
    voltage DECIMAL(10,2),           -- voltaje (V)
    flow_rate DECIMAL(10,2),         -- caudal (L/s)
    pressure DECIMAL(10,2),          -- presión (PSI/kg)
    ppm DECIMAL(10,2),               -- partículas por millón
    insulation_resistance DECIMAL(10,2), -- resistencia de aislamiento (MΩ)
    kw DECIMAL(10,2),                -- kilowatts
    motor_torque DECIMAL(10,2),      -- par motor
    temperature DECIMAL(10,2),       -- temperatura (°C)
    frequency DECIMAL(10,2),         -- frecuencia (Hz)
    -- Extra
    observations TEXT,
    photos JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Garantías
CREATE TABLE equipment_warranties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID REFERENCES installed_equipment(id) ON DELETE CASCADE,
    warranty_type VARCHAR(50) NOT NULL, -- supplier, nucleo
    provider VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    coverage TEXT,
    conditions TEXT,
    document_url TEXT,
    status VARCHAR(50) DEFAULT 'active', -- active, expired, claimed, void
    alert_days_before INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Contratos de mantenimiento
CREATE TABLE maintenance_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    contract_number VARCHAR(50) UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    billing_type VARCHAR(50) DEFAULT 'monthly', -- monthly, annual, per_service
    monthly_amount DECIMAL(15,2) DEFAULT 0,
    annual_amount DECIMAL(15,2) DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE,
    auto_renew BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'active', -- draft, active, paused, expired, cancelled
    included_services JSONB DEFAULT '[]', -- ["revision_general", "variador", "termografia"]
    equipment_ids JSONB DEFAULT '[]', -- UUIDs of covered equipment
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Triggers
CREATE TRIGGER update_installed_equipment_modtime
    BEFORE UPDATE ON installed_equipment
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_maintenance_schedules_modtime
    BEFORE UPDATE ON maintenance_schedules
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_maintenance_contracts_modtime
    BEFORE UPDATE ON maintenance_contracts
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- RLS
ALTER TABLE installed_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to installed_equipment" ON installed_equipment FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to maintenance_schedules" ON maintenance_schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to monitoring_logs" ON monitoring_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to equipment_warranties" ON equipment_warranties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to maintenance_contracts" ON maintenance_contracts FOR ALL USING (true) WITH CHECK (true);
