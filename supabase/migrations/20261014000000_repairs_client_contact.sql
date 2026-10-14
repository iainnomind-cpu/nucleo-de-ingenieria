-- =============================================
-- Reparaciones: campos de contacto del cliente y fecha límite de recogida
-- Permite avisar al cliente por WhatsApp/correo si no recoge su equipo
-- =============================================

-- Campos de contacto directo en la reparación (para clientes externos no registrados en CRM)
ALTER TABLE equipment_repairs
    ADD COLUMN IF NOT EXISTS client_phone       TEXT,
    ADD COLUMN IF NOT EXISTS client_email       TEXT,
    ADD COLUMN IF NOT EXISTS pickup_deadline_date DATE;   -- Fecha límite para recoger el equipo

COMMENT ON COLUMN equipment_repairs.client_phone       IS 'Celular de contacto del cliente para esta reparación (puede ser distinto al del CRM)';
COMMENT ON COLUMN equipment_repairs.client_email       IS 'Correo de contacto del cliente para esta reparación';
COMMENT ON COLUMN equipment_repairs.pickup_deadline_date IS 'Fecha límite para que el cliente recoja el equipo; si no lo hace, se desecha';
