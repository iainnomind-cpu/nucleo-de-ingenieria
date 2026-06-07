CREATE TABLE vehicle_fuel_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    odometer NUMERIC NOT NULL,
    fuel_liters NUMERIC NOT NULL,
    cost NUMERIC NOT NULL,
    provider VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE vehicle_fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on vehicle_fuel_logs" ON vehicle_fuel_logs FOR ALL USING (true) WITH CHECK (true);
