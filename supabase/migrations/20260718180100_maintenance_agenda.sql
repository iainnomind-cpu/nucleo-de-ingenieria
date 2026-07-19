-- Migración para soportar la agenda diaria
ALTER TABLE maintenance_schedules
ADD COLUMN IF NOT EXISTS departure_time TIME;

-- Asegurar que equipment_id no tenga restricción NOT NULL
ALTER TABLE maintenance_schedules ALTER COLUMN equipment_id DROP NOT NULL;
