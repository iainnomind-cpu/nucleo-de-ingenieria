-- MÓDULO: CONFIGURACIÓN DEL SISTEMA — Parámetros Operativos por Defecto

-- 1. Tabla de configuración del sistema (key-value con JSON)
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para updated_at
CREATE TRIGGER update_system_settings_modtime
    BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- RLS (permissive while no auth)
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to system_settings" ON system_settings FOR ALL USING (true) WITH CHECK (true);

-- 2. Seed: Valores operativos por defecto
INSERT INTO system_settings (key, value, description) VALUES (
    'operational_defaults',
    '{
        "cost_per_km": 5.50,
        "viaticos_per_person": 850,
        "insurance_cost": 0,
        "vehicle_wear": 0,
        "maniobra_cost": 0,
        "margin_percent": 20,
        "tax_percent": 16,
        "crew_size": 2,
        "estimated_days": 1
    }'::jsonb,
    'Valores operativos base que se pre-cargan automáticamente al crear nuevas cotizaciones. Modificar estos valores NO afecta cotizaciones ya generadas.'
);
