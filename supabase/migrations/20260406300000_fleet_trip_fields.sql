-- =============================================
-- Fleet Module Enhancement: Trip Log Fields
-- Adds destination, fuel levels, departure/return dates
-- =============================================

ALTER TABLE vehicle_mileage
ADD COLUMN IF NOT EXISTS destination TEXT,
ADD COLUMN IF NOT EXISTS departure_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS return_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS fuel_level_start DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS fuel_level_end DECIMAL(5,2);
