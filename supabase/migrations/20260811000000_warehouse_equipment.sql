-- Tabla: warehouse_equipment (equipos de bodega)
CREATE TABLE IF NOT EXISTS warehouse_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'bomba', -- bomba, motor, soldadora, generador, compresor, pulidora, otro
  brand VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(100),
  power_hp VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'available', -- available, in_repair, out_of_service
  location VARCHAR(200) DEFAULT 'Bodega Núcleo',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE warehouse_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to warehouse_equipment"
  ON warehouse_equipment FOR ALL USING (true) WITH CHECK (true);

-- Tabla: warehouse_equipment_observations (observaciones de equipos de bodega)
CREATE TABLE IF NOT EXISTS warehouse_equipment_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID NOT NULL REFERENCES warehouse_equipment(id) ON DELETE CASCADE,
  observation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  observation TEXT NOT NULL,
  reported_by VARCHAR(200),
  status VARCHAR(50) DEFAULT 'pendiente', -- pendiente, revisado, resuelto
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE warehouse_equipment_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to warehouse_equipment_observations"
  ON warehouse_equipment_observations FOR ALL USING (true) WITH CHECK (true);

-- Agregar columna warehouse_equipment_id a equipment_repairs para poder linkear reparaciones con bodega
ALTER TABLE equipment_repairs ADD COLUMN IF NOT EXISTS warehouse_equipment_id UUID REFERENCES warehouse_equipment(id) ON DELETE SET NULL;
ALTER TABLE equipment_repairs ADD COLUMN IF NOT EXISTS repair_source VARCHAR(50) DEFAULT 'client'; -- 'client' | 'warehouse'

INSERT INTO warehouse_equipment (name, category, brand, power_hp, status) VALUES
  ('Bomba Altamira 100HP', 'bomba', 'Altamira', '100 HP', 'available'),
  ('Bomba Altamira 50HP', 'bomba', 'Altamira', '50 HP', 'available'),
  ('Bomba Altamira 75HP', 'bomba', 'Altamira', '75 HP', 'available'),
  ('Bomba Franklin 100HP', 'bomba', 'Franklin', '100 HP', 'available'),
  ('Bomba Franklin 125HP', 'bomba', 'Franklin', '125 HP', 'available'),
  ('Bomba Franklin 50HP', 'bomba', 'Franklin', '50 HP', 'available'),
  ('Bomba Goulds 150HP', 'bomba', 'Goulds', '150 HP', 'available'),
  ('Bomba SME 125HP', 'bomba', 'SME', '125 HP', 'available'),
  ('Motor Altamira 75HP', 'motor', 'Altamira', '75 HP', 'available'),
  ('Motor KSB 305HP', 'motor', 'KSB', '305 HP', 'available'),
  ('Motor Shakti 177HP', 'motor', 'Shakti', '177 HP', 'available'),
  ('Motor SME 100HP', 'motor', 'SME', '100 HP', 'available'),
  ('Motor SME 60HP', 'motor', 'SME', '60 HP', 'available'),
  ('Motor SME 125HP', 'motor', 'SME', '125 HP', 'available'),
  ('Motosoldadora AXT-MS160CD 120A-1000W', 'soldadora', 'AXT', '1000 W', 'available'),
  ('Generador Bakarac150 1000W', 'generador', 'Bakarac', '1000 W', 'available'),
  ('Soldadura Infra MI-250-CD', 'soldadora', 'Infra', null, 'available'),
  ('Compresor 2.5HP-25lts', 'compresor', null, '2.5 HP', 'available'),
  ('Motosoldadora ATX-MS232 200A-5500W', 'soldadora', 'ATX', '5500 W', 'available'),
  ('Motosoldadora AXT-MS232 200A-5500W', 'soldadora', 'AXT', '5500 W', 'available')
ON CONFLICT DO NOTHING;
