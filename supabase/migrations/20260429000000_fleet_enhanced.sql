-- =============================================
-- Fleet Module Enhancement: Full Vehicle Data + Service Scheduling
-- Adds: serial number, dealer, verification, fuel liters (rendimiento),
--        and a complete service scheduling system (by km or by time)
-- =============================================

-- 1. Enhance vehicles table with data from "Datos Vehiculares" spreadsheet
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS serial_number TEXT,
ADD COLUMN IF NOT EXISTS dealer TEXT,
ADD COLUMN IF NOT EXISTS verification_date DATE,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending'
    CHECK (verification_status IN ('current', 'pending', 'expired'));

-- 2. Add fuel liters to vehicle_mileage for rendimiento (km/l) calculations
ALTER TABLE vehicle_mileage
ADD COLUMN IF NOT EXISTS fuel_liters DECIMAL(10, 2) DEFAULT 0;

-- 3. Add next_service_date to vehicle_maintenance (already has next_service_mileage)
-- Already exists in schema, no change needed

-- 4. Service Schedule Templates
-- These are the recurring service definitions per vehicle
-- e.g. "Cambio de aceite cada 5000 km o cada 6 meses"
CREATE TABLE IF NOT EXISTS vehicle_service_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    -- Scheduling triggers (at least one must be set)
    interval_km DECIMAL(12, 2),          -- every X km
    interval_months INTEGER,              -- every X months
    -- Tracking state
    last_service_date DATE,
    last_service_mileage DECIMAL(12, 2),
    next_due_date DATE,                   -- auto-calculated from last_service_date + interval_months
    next_due_mileage DECIMAL(12, 2),      -- auto-calculated from last_service_mileage + interval_km
    -- Meta
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vss_vehicle ON vehicle_service_schedules(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vss_next_due ON vehicle_service_schedules(next_due_date);
CREATE INDEX IF NOT EXISTS idx_vss_next_mileage ON vehicle_service_schedules(next_due_mileage);
CREATE INDEX IF NOT EXISTS idx_vss_status ON vehicle_service_schedules(status);

-- RLS
ALTER TABLE vehicle_service_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access on vehicle_service_schedules" ON vehicle_service_schedules FOR SELECT USING (true);
CREATE POLICY "Allow all access on vehicle_service_schedules" ON vehicle_service_schedules FOR ALL USING (true) WITH CHECK (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_vss_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vss_timestamp
BEFORE UPDATE ON vehicle_service_schedules
FOR EACH ROW EXECUTE FUNCTION update_vss_timestamp();

-- 5. Function to calculate next_due_date and next_due_mileage on insert/update
CREATE OR REPLACE FUNCTION calculate_service_schedule_next()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate next due date if interval_months is set
    IF NEW.interval_months IS NOT NULL AND NEW.last_service_date IS NOT NULL THEN
        NEW.next_due_date = NEW.last_service_date + (NEW.interval_months || ' months')::INTERVAL;
    END IF;
    
    -- Calculate next due mileage if interval_km is set
    IF NEW.interval_km IS NOT NULL AND NEW.last_service_mileage IS NOT NULL THEN
        NEW.next_due_mileage = NEW.last_service_mileage + NEW.interval_km;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_schedule_next
BEFORE INSERT OR UPDATE ON vehicle_service_schedules
FOR EACH ROW EXECUTE FUNCTION calculate_service_schedule_next();
