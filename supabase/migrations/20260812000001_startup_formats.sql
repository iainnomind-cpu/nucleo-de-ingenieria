-- Tabla: startup_formats (Servicio de Arranque)
CREATE TABLE IF NOT EXISTS startup_formats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio VARCHAR(50),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  location VARCHAR(200),
  technician VARCHAR(200),
  equipment VARCHAR(200),
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Main Table Data
  time_logged TIME,
  volts_l1 VARCHAR(50),
  volts_l2 VARCHAR(50),
  volts_l3 VARCHAR(50),
  amp_l1 VARCHAR(50),
  amp_l2 VARCHAR(50),
  amp_l3 VARCHAR(50),
  flow_rate VARCHAR(50),
  dynamic_level VARCHAR(50),
  discharge_pressure VARCHAR(50),
  observations_table VARCHAR(200),
  avg_volts VARCHAR(50),
  avg_amps VARCHAR(50),
  unbalance_percentage VARCHAR(50),
  
  -- Parámetros Eléctricos
  low_voltage VARCHAR(50),
  high_voltage VARCHAR(50),
  overload_amps VARCHAR(50),
  underload_amps VARCHAR(50),
  phase_unbalance VARCHAR(50),
  
  -- Datos Motor
  motor_power_hp VARCHAR(50),
  motor_feed_volts VARCHAR(50),
  motor_frequency_hz VARCHAR(50),
  motor_nom_amps VARCHAR(50),
  motor_protection_type VARCHAR(100),
  
  -- Footer
  recommendations TEXT,
  received_by VARCHAR(200),
  reviewed_by VARCHAR(200),
  authorized_by VARCHAR(200),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE startup_formats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to startup_formats"
  ON startup_formats FOR ALL USING (true) WITH CHECK (true);
