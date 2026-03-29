-- Vehicle Fleet Management Schema
-- Drop if they accidentally existed from a failed run
DROP TABLE IF EXISTS vehicle_maintenance CASCADE;
DROP TABLE IF EXISTS vehicle_mileage CASCADE;
DROP TABLE IF EXISTS vehicle_insurances CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
-- 1. Vehicles Master Table
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plates TEXT NOT NULL UNIQUE,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('sedan', 'pickup', 'suv', 'crane', 'truck', 'other')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    assigned_to TEXT,
    cost_per_km DECIMAL(10, 2) NOT NULL DEFAULT 5.00,
    current_mileage DECIMAL(12, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Vehicle Insurances
CREATE TABLE vehicle_insurances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    policy_number TEXT NOT NULL,
    provider TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cost DECIMAL(12, 2) NOT NULL,
    coverage_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Vehicle Mileage / Log
CREATE TABLE vehicle_mileage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    driver_name TEXT NOT NULL,
    date DATE NOT NULL,
    odometer_start DECIMAL(12, 2) NOT NULL,
    odometer_end DECIMAL(12, 2) NOT NULL,
    distance DECIMAL(12, 2) GENERATED ALWAYS AS (odometer_end - odometer_start) STORED,
    fuel_cost DECIMAL(12, 2) DEFAULT 0,
    calculated_trip_cost DECIMAL(12, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Vehicle Maintenance
CREATE TABLE vehicle_maintenance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    service_type TEXT NOT NULL,
    service_date DATE NOT NULL,
    cost DECIMAL(12, 2) NOT NULL,
    provider TEXT,
    odometer_reading DECIMAL(12, 2),
    next_service_date DATE,
    next_service_mileage DECIMAL(12, 2),
    notes TEXT,
    invoice_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicle_insurances_vehicle ON vehicle_insurances(vehicle_id);
CREATE INDEX idx_vehicle_mileage_vehicle ON vehicle_mileage(vehicle_id);
CREATE INDEX idx_vehicle_mileage_project ON vehicle_mileage(project_id);
CREATE INDEX idx_vehicle_maintenance_vehicle ON vehicle_maintenance(vehicle_id);
CREATE INDEX idx_vehicle_maintenance_project ON vehicle_maintenance(project_id);

-- RLS Policies
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_insurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_mileage ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_maintenance ENABLE ROW LEVEL SECURITY;

-- Allow read access to all users
CREATE POLICY "Allow read access for all authenticated users on vehicles" ON vehicles FOR SELECT USING (true);
CREATE POLICY "Allow read access for all authenticated users on insurances" ON vehicle_insurances FOR SELECT USING (true);
CREATE POLICY "Allow read access for all authenticated users on mileage" ON vehicle_mileage FOR SELECT USING (true);
CREATE POLICY "Allow read access for all authenticated users on maintenance" ON vehicle_maintenance FOR SELECT USING (true);

-- Allow full access to admins or managers (simplified for ERP context)
CREATE POLICY "Allow all access on vehicles" ON vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on insurances" ON vehicle_insurances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on mileage" ON vehicle_mileage FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on maintenance" ON vehicle_maintenance FOR ALL USING (true) WITH CHECK (true);

-- Trigger to update updated_at on vehicles
CREATE OR REPLACE FUNCTION update_vehicle_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vehicle_timestamp
BEFORE UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION update_vehicle_timestamp();

-- Trigger to auto-update vehicle's current_mileage after a mileage log
CREATE OR REPLACE FUNCTION update_vehicle_mileage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE vehicles 
    SET current_mileage = GREATEST(current_mileage, NEW.odometer_end)
    WHERE id = NEW.vehicle_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vehicle_mileage
AFTER INSERT OR UPDATE ON vehicle_mileage
FOR EACH ROW EXECUTE FUNCTION update_vehicle_mileage();
