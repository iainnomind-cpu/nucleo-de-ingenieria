-- MÓDULO: GASTOS DE CAMPO (VIÁTICOS) Y EMPLEADOS DINÁMICOS

-- 1. Tabla de Gastos de Campo (Viáticos)
CREATE TABLE field_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    expense_type VARCHAR(100) NOT NULL, -- alimentation, hotel, fuel, emergency_part, other
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_url TEXT,
    authorized_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para updated_at en field_expenses
CREATE TRIGGER update_field_expenses_modtime
    BEFORE UPDATE ON field_expenses
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Habilitar Políticas de Privacidad (RLS) Permisivas
ALTER TABLE field_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to field_expenses" ON field_expenses FOR ALL USING (true) WITH CHECK (true);

-- 2. Migración del Hardcoding de Empleados hacia la Configuración.
-- Inyectaremos una nueva clave JSON en System Settings que administrará a los miembros del equipo actual (los "ya cargados")
INSERT INTO system_settings (key, value, description)
VALUES (
    'team_directory',
    '["Director", "Joel", "Samara", "Paulina", "Alejandro"]'::jsonb,
    'Listado oficial de empleados y técnicos activos en la aplicación. Reemplaza lista dura.'
) ON CONFLICT (key) DO NOTHING;
