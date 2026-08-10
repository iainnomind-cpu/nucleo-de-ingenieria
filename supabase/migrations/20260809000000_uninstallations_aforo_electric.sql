-- ============================================================
-- MIGRACIÓN: Desinstalaciones, Aforo y Cuadro Eléctrico
-- Fecha: 2026-08-09
-- ============================================================

-- ============================================================
-- TABLA: well_uninstallations
-- Registro de desinstalaciones (tabla separada de instalaciones)
-- ============================================================
CREATE TABLE IF NOT EXISTS well_uninstallations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio             VARCHAR(50),
  uninstallation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id         UUID REFERENCES clients(id) ON DELETE SET NULL,
  location          TEXT,
  -- Datos del pozo
  ademe_diameter    VARCHAR(50),
  ademe_material    VARCHAR(100),
  pipe_diameter     VARCHAR(50),
  pipe_length       VARCHAR(50),
  pipe_segments     INTEGER DEFAULT 0,
  valv_check        INTEGER DEFAULT 0,
  cable_gauge       VARCHAR(50),
  -- Motor y bomba
  motor_hp          VARCHAR(50),
  pump_model        VARCHAR(100),
  starter_system    VARCHAR(100),
  protection_type   VARCHAR(100),
  has_ground        BOOLEAN DEFAULT FALSE,
  ground_location   TEXT,
  -- Niveles
  static_level      DECIMAL(10,2) DEFAULT 0,
  dynamic_level     DECIMAL(10,2) DEFAULT 0,
  flow_rate         DECIMAL(10,2) DEFAULT 0,
  bottom_depth      DECIMAL(10,2) DEFAULT 0,
  -- Motivo y notas
  reason            TEXT,
  notes             TEXT,
  -- Auditoría
  created_by        UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE well_uninstallations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to well_uninstallations"
  ON well_uninstallations FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- TABLA: aforo_records
-- Encabezado del formato de aforo PERTOPO TECHAGUE
-- ============================================================
CREATE TABLE IF NOT EXISTS aforo_records (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio                 VARCHAR(50),
  client_id             UUID REFERENCES clients(id) ON DELETE SET NULL,
  location              TEXT,
  duration_hours        INTEGER NOT NULL DEFAULT 24,
  -- Características del Equipo
  pump_brand            TEXT,
  pump_model            TEXT,
  pump_diameter         TEXT,
  impeller_model        TEXT,
  suction_pipe          TEXT,
  total_column_length   TEXT,
  motor_info            TEXT,
  flow_method           TEXT,
  -- Características del PC (Pozo)
  well_total_depth      TEXT,
  well_pipe_diameter    TEXT,
  well_pipe_use_length  TEXT,
  well_ademe_length     TEXT,
  well_annular_length   TEXT,
  well_gravel_filter_length TEXT,
  well_cement_diameter  TEXT,
  hydrostatic_level     TEXT,
  -- Perforación
  drilled_by            TEXT,
  start_datetime        TIMESTAMP WITH TIME ZONE,
  -- Fórmula de Gasto
  aforo_formula         TEXT,
  aforo_static          TEXT,
  aforo_dynamic         TEXT,
  -- Auditoría
  created_by            UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE aforo_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to aforo_records"
  ON aforo_records FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- TABLA: aforo_measurements
-- Filas de la tabla de mediciones (una por lectura)
-- ============================================================
CREATE TABLE IF NOT EXISTS aforo_measurements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aforo_id        UUID NOT NULL REFERENCES aforo_records(id) ON DELETE CASCADE,
  row_index       INTEGER NOT NULL,
  day_label       TEXT,
  hour_label      TEXT,
  dynamic_level   TEXT,
  pump_rpm        TEXT,
  amp_reading     TEXT,
  flow_lps        TEXT,
  nozzle          TEXT,
  observations    TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE aforo_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to aforo_measurements"
  ON aforo_measurements FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- TABLA: electric_panel_records
-- Formato de Cuadro Eléctrico
-- ============================================================
CREATE TABLE IF NOT EXISTS electric_panel_records (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio                 VARCHAR(50),
  client_id             UUID REFERENCES clients(id) ON DELETE SET NULL,
  location              TEXT,
  well_name             TEXT,
  record_date           DATE DEFAULT CURRENT_DATE,
  -- TRANSFORMADOR
  trans_brand           TEXT,
  trans_capacity        TEXT,
  trans_lightning_rods  TEXT,
  trans_switches        TEXT,
  trans_insulators      TEXT,
  trans_fuses           TEXT,
  trans_dielectric      TEXT,
  trans_cable_gauge     TEXT,
  -- ARRANCADOR
  starter_model         TEXT,
  starter_capacity      TEXT,
  starter_protection    TEXT,
  starter_channeled     TEXT,
  -- MOTOR
  motor_brand           TEXT,
  motor_power           TEXT,
  motor_amperage        TEXT,
  motor_frequency       TEXT,
  motor_meggeo          TEXT,
  motor_feed            TEXT,
  motor_ground_system   TEXT,
  motor_ground_location TEXT,
  motor_cable_gauge     TEXT,
  -- BOMBA
  pump_brand            TEXT,
  pump_power            TEXT,
  pump_model            TEXT,
  pump_material         TEXT,
  pump_repaired         TEXT,
  -- Firmas
  responsible           TEXT,
  reviewed_by           TEXT,
  authorized_by         TEXT,
  notes                 TEXT,
  -- Auditoría
  created_by            UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE electric_panel_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to electric_panel_records"
  ON electric_panel_records FOR ALL USING (true) WITH CHECK (true);
