-- Módulo: Instalación y Mantenimiento
-- Nueva tabla de Maniobras y actualización de equipos/videos

-- 1. Tabla de Instalaciones/Maniobras
CREATE TABLE IF NOT EXISTS well_installations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    folio VARCHAR(50) NOT NULL,
    installation_date DATE NOT NULL,
    location TEXT,
    
    -- Datos del Pozo/Ademe
    ademe_diameter VARCHAR(50),
    ademe_material VARCHAR(100),
    pipe_diameter VARCHAR(50),
    pipe_length VARCHAR(50),
    pipe_segments INTEGER,
    valv_check INTEGER,
    
    -- Datos del Equipo Principal
    cable_gauge VARCHAR(50),
    motor_hp VARCHAR(50),
    pump_model VARCHAR(100),
    starter_system VARCHAR(100),
    protection_type VARCHAR(100),
    has_ground BOOLEAN DEFAULT false,
    ground_location TEXT,
    
    -- Niveles
    static_level DECIMAL(10,2),
    dynamic_level DECIMAL(10,2),
    flow_rate DECIMAL(10,2),
    bottom_depth DECIMAL(10,2),
    
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Políticas RLS para well_installations
ALTER TABLE well_installations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to well_installations" 
ON well_installations FOR ALL USING (true) WITH CHECK (true);


-- 2. Modificar installed_equipment para vincularlo a una instalación
ALTER TABLE installed_equipment
ADD COLUMN IF NOT EXISTS installation_id UUID REFERENCES well_installations(id) ON DELETE SET NULL;


-- 3. Modificar video_recordings para agregar los nuevos campos
ALTER TABLE video_recordings
ADD COLUMN IF NOT EXISTS ademe_material VARCHAR(100),
ADD COLUMN IF NOT EXISTS ademe_diameter VARCHAR(50),
ADD COLUMN IF NOT EXISTS slot_type VARCHAR(100);

-- Asegurarnos de que el RLS permita modificaciones
-- (Aunque las tablas originales asumen tener RLS público en esta app, es bueno prevenir)
