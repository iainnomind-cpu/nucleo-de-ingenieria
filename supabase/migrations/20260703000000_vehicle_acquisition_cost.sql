-- Agrega campo para costo de adquisición de vehículos
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS acquisition_cost DECIMAL(12,2) DEFAULT 0;
