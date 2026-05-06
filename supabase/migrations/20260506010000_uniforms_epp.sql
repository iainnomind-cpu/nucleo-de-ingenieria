-- 1. CREATE TABLES

CREATE TABLE inventory_uniforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(20) NOT NULL,
    size VARCHAR(20),
    current_stock DECIMAL(10,2) DEFAULT 0,
    unit_cost DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE uniform_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uniform_id UUID REFERENCES inventory_uniforms(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES hr_employees(id) ON DELETE CASCADE,
    quantity DECIMAL(10,2) NOT NULL,
    assigned_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_inventory_uniforms_modtime BEFORE UPDATE ON inventory_uniforms FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

ALTER TABLE inventory_uniforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE uniform_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access on inventory_uniforms" ON inventory_uniforms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on uniform_assignments" ON uniform_assignments FOR ALL USING (true) WITH CHECK (true);

-- 2. INSERT UNIFORMES Y EPP
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PlLAYERA MANGA LARGA GRIS', 'uniforme', 'CH', 5.0, 185.6);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PLAYERA MANGA LARGA NEGRA', 'uniforme', 'M', 10.0, 517.36);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PLAYERA MANGA LARGA NEGRA', 'uniforme', 'G', 8.0, 517.36);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PLAYERA MANGA LARGA NEGRA', 'uniforme', 'CH', 4.0, 517.36);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PLAYERA MANGA LARGA GRIS', 'uniforme', 'M', 10.0, 185.6);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PLAYERA MANGA LARGA GRIS', 'uniforme', 'G', 8.0, 185.6);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PLAYERA MANGA CORTA NEGRA', 'uniforme', 'M', 8.0, 127.6);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PLAYERA MANGA CORTA NEGRA', 'uniforme', 'G', 6.0, 127.6);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PLAYERA MANGA CORTA NEGRA', 'uniforme', 'CH', 4.0, 127.6);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PLAYERA MANGA CORTA GRIS', 'uniforme', 'G', 6.0, 127.6);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PLAYERA MANGA CORTA GRIS', 'uniforme', 'CH', 10.0, 127.6);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PLAYERA MANGA CORTA GRIS', 'uniforme', 'M', 0.0, 0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PANTALON 34', 'uniforme', NULL, 31.0, 313.2);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PANTALON 32', 'uniforme', NULL, 16.0, 313.2);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PANTALON 30', 'uniforme', NULL, 13.0, 313.2);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('OVEROL', 'uniforme', 'CH', 0.0, 0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('OVEROL', 'uniforme', 'M', 5.0, 626.4);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('OVEROL', 'uniforme', 'G', 4.0, 626.4);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('OVEROL 40', 'uniforme', NULL, 12.0, 765.34);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('OVEROL 38', 'uniforme', NULL, 0, 0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('OVEROL 36', 'uniforme', NULL, 11.0, 765.34);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CAMISA MEZCLILLA T.38 (M)', 'uniforme', NULL, 2.0, 538.98);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CAMISA MEZCLILLA T.40 (G)', 'uniforme', NULL, 19.0, 538.98);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CAMISA MEZCLILLA T.36 (S)', 'uniforme', NULL, 6.0, 538.98);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CAMISA MEZCLILLA', 'uniforme', 'G', 10.0, 563.76);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CAMISA GRIS', 'uniforme', 'M', 1.0, 255.2);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CAMISA GRIS', 'uniforme', 'G', 2.0, 255.22);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CAMISA GRIS', 'uniforme', 'CH', 4.0, 255.2);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CAMISA FIELD OUTDOOR TG', 'uniforme', NULL, 3.0, 551.0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CAMISA FIELD OUTDOOR TCH', 'uniforme', NULL, 4.0, 551.0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BOTAS 29', 'uniforme', NULL, 1.0, 481.4);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BOTAS 28', 'uniforme', NULL, 0.0, 481.4);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BOTAS 27.5', 'uniforme', NULL, 1.0, 481.4);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BOTAS 27', 'uniforme', NULL, 2.0, 481.4);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BOTAS 26', 'uniforme', NULL, 0.0, 481.4);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BLUSA DRY ACTION NEGRA T. CH (AUX. CONTABLE)', 'uniforme', NULL, 1.0, 319.0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BLUSA DRY ACTION NEGRA T. CH (AUX. ADMINISTRATIVO)', 'uniforme', NULL, 1.0, 319.0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BLUSA DRY ACTION BLANCA T. CH (AUX. CONTABLE)', 'uniforme', NULL, 1.0, 319.0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BLUSA DRY ACTION BLANCA T. CH (AUX. ADMINISTRATIVO)', 'uniforme', NULL, 1.0, 319.0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BLUSA DRY ACTION AZUL MARINO T. CH (AUX. CONTABLE)', 'uniforme', NULL, 2.0, 319.0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BLUSA DRY ACTION AZUL MARINO T. CH (AUX. ADMINISTRATIVO)', 'uniforme', NULL, 2.0, 319.0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PLAYERAS DRY ACTION DAMA T. M (COLOR NEGRO)', 'uniforme', NULL, 2.0, 280.00079999999997);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PLAYERAS DRY ACTION DAMA T.M (COLOR BLANCO)', 'uniforme', NULL, 2.0, 280.00079999999997);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BLIUSA PESCADOR (FORT LAUDER) T.CH  (AZUL MARINO)', 'uniforme', NULL, 3.0, 949.0075999999999);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BLUSA PESCADOR (FORT LAUDER) T.CH (BALNCA)', 'uniforme', NULL, 1.0, 949.0075999999999);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BLUSA PESCADOR (FORT LAUDER) T.M (BLANCA)', 'uniforme', NULL, 1.0, 949.0075999999999);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('BLUSA PESCADOR (FORT LAUDER) T.M (AZUL MARINO)', 'uniforme', NULL, 1.0, 949.0075999999999);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CAMISA PESCADOR (FORT LAUDER) T.CH (CENIZO)', 'uniforme', NULL, 4.0, 989.0043999999999);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CAMISA PESCADOR (FORT LAUDER) T.CH (AZUL MARINO)', 'uniforme', NULL, 2.0, 989.0043999999999);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CAMISA PESCADOR (FORT LAUDER) T.G (AZUL MARINO)', 'uniforme', NULL, 2.0, 989.0043999999999);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CAMISA PESCADOR (FORT LAUDER) T.G (CENIZO)', 'uniforme', NULL, 3.0, 989.0043999999999);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CAMISA PESCADOR (FORT LAUDER) T.M (CENIZO)', 'uniforme', NULL, 2.0, 989.0043999999999);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PLAYERA POLO T.', 'uniforme', 'M', 0, 0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('LENTES DE SEGURIDAD TRANSPARENTES', 'epp', NULL, 75.0, 9.512);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('LENTES DE SEGURIDAD NEGRO', 'epp', NULL, 41.0, 9.512);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('LENTE TIPO NEMESIS NEGRO', 'epp', NULL, 0.0, 45.008);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('LENTE TIPO NEMESIS AZUL', 'epp', NULL, 0.0, 45.008);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('LENTE DE SEGURIDAD AZUL', 'epp', NULL, 2.0, 21.924);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('GUANTE CHINO DOBLE PALMA', 'epp', NULL, 0.0, 38.164);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('GUANTE DE SOLDAR AZUL', 'epp', NULL, 0.0, 74.704);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('GUANTES PIEL DE CABRA UNIT (PARES)', 'epp', NULL, 7.0, 213.44);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('GUANTES DIELECTRICO (PARES)', 'epp', NULL, 1.0, 9860.0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('GUANTES DE SOLDADOR UNIT (PARES)', 'epp', NULL, 7.0, 371.2);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('GUANTES DE NITRILO T8 (PARES)', 'epp', NULL, 45.0, 10.324);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('GANTES DE ALTA NITRILO  T9 (PARES)', 'epp', NULL, 36.0, 10.324);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('GUANTES CARNAZA TRUPPER UNIT (PARES)', 'epp', NULL, 15.0, 129.92);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('GUANTE DE CARNAZA DOBLE REFUERZO', 'epp', NULL, 15.0, 0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('GUANTES ANTIDERRAPANTES', 'epp', NULL, 10.0, 229.68);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('GUANTE DE CARNAZA PRETUL UNIT (PARES)', 'epp', NULL, 1.0, 52.2);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('GUANTE MULTIUSOS', 'epp', NULL, 4.0, 0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('GOGLE DE SEGURIDAD ANTIPAÑO', 'epp', NULL, 8.0, 127.6);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CHALECOS REFLECTANTES', 'epp', NULL, 5.0, 38.0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CASCO AMARILLO', 'epp', NULL, 5.0, 0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CASCO ANARANJADO', 'epp', NULL, 4.0, 0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CASCO VERDE', 'epp', NULL, 1.0, 0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CASCO ALA ANCHA BLANCO', 'epp', NULL, 6.0, 76.328);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CASCO ALA ANCHA AZUL', 'epp', NULL, 0, 76.328);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CASCO DE PROTECCIÓN', 'epp', NULL, 1.0, 129.31);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('RESPIRADOR MEDIA CARA', 'epp', NULL, 2.0, 0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CARTUCHO FILTRO DE REPUESTO', 'epp', NULL, 2.0, 0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('PROTECTOR FACIAL DE MALLA', 'epp', NULL, 5.0, 0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('LENTE DE PROTECCIÓN TORNASOL', 'epp', NULL, 2.0, 0);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('MANDIL DE CARNAZA', 'epp', NULL, 0, 63.684);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('MANGAS DE CARNAZA', 'epp', NULL, 0, 63.684);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('OVEROL LAMINADO', 'epp', NULL, 0, 38.164);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('IMPERMEABLE', 'epp', NULL, 0, 126.44);
INSERT INTO inventory_uniforms (name, category, size, current_stock, unit_cost) VALUES ('CUBRENUCA', 'epp', NULL, 10.0, 25.404);