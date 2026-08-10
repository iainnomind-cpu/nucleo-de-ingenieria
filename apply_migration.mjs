// Script para aplicar la migración de nuevas tablas en Supabase
// Ejecutar con: node apply_migration.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const url = 'https://fhpdyvrplgqffwamgknm.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocGR5dnJwbGdxZmZ3YW1na25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NjIzNTIsImV4cCI6MjA4NzEzODM1Mn0.ol6oF7XT78difgj9xstV_WyWXXnfbT_vPFs9qQstgNM';

const supabase = createClient(url, key);

// Run each statement one by one
const statements = [
  // well_uninstallations
  `CREATE TABLE IF NOT EXISTS well_uninstallations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folio VARCHAR(50),
    uninstallation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    location TEXT,
    ademe_diameter VARCHAR(50),
    ademe_material VARCHAR(100),
    pipe_diameter VARCHAR(50),
    pipe_length VARCHAR(50),
    pipe_segments INTEGER DEFAULT 0,
    valv_check INTEGER DEFAULT 0,
    cable_gauge VARCHAR(50),
    motor_hp VARCHAR(50),
    pump_model VARCHAR(100),
    starter_system VARCHAR(100),
    protection_type VARCHAR(100),
    has_ground BOOLEAN DEFAULT FALSE,
    ground_location TEXT,
    static_level DECIMAL(10,2) DEFAULT 0,
    dynamic_level DECIMAL(10,2) DEFAULT 0,
    flow_rate DECIMAL(10,2) DEFAULT 0,
    bottom_depth DECIMAL(10,2) DEFAULT 0,
    reason TEXT,
    notes TEXT,
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  )`,
  `ALTER TABLE well_uninstallations ENABLE ROW LEVEL SECURITY`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'well_uninstallations' AND policyname = 'Allow all access to well_uninstallations') THEN
      CREATE POLICY "Allow all access to well_uninstallations" ON well_uninstallations FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,

  // aforo_records
  `CREATE TABLE IF NOT EXISTS aforo_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folio VARCHAR(50),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    location TEXT,
    duration_hours INTEGER NOT NULL DEFAULT 24,
    pump_brand TEXT, pump_model TEXT, pump_diameter TEXT, impeller_model TEXT,
    suction_pipe TEXT, total_column_length TEXT, motor_info TEXT, flow_method TEXT,
    well_total_depth TEXT, well_pipe_diameter TEXT, well_pipe_use_length TEXT,
    well_ademe_length TEXT, well_annular_length TEXT, well_gravel_filter_length TEXT,
    well_cement_diameter TEXT, hydrostatic_level TEXT,
    drilled_by TEXT, start_datetime TIMESTAMP WITH TIME ZONE,
    aforo_formula TEXT, aforo_static TEXT, aforo_dynamic TEXT,
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  )`,
  `ALTER TABLE aforo_records ENABLE ROW LEVEL SECURITY`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'aforo_records' AND policyname = 'Allow all access to aforo_records') THEN
      CREATE POLICY "Allow all access to aforo_records" ON aforo_records FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,

  // aforo_measurements
  `CREATE TABLE IF NOT EXISTS aforo_measurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aforo_id UUID NOT NULL REFERENCES aforo_records(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    day_label TEXT, hour_label TEXT, dynamic_level TEXT,
    pump_rpm TEXT, amp_reading TEXT, flow_lps TEXT, nozzle TEXT, observations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  )`,
  `ALTER TABLE aforo_measurements ENABLE ROW LEVEL SECURITY`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'aforo_measurements' AND policyname = 'Allow all access to aforo_measurements') THEN
      CREATE POLICY "Allow all access to aforo_measurements" ON aforo_measurements FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,

  // electric_panel_records
  `CREATE TABLE IF NOT EXISTS electric_panel_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folio VARCHAR(50),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    location TEXT, well_name TEXT,
    record_date DATE DEFAULT CURRENT_DATE,
    trans_brand TEXT, trans_capacity TEXT, trans_lightning_rods TEXT, trans_switches TEXT,
    trans_insulators TEXT, trans_fuses TEXT, trans_dielectric TEXT, trans_cable_gauge TEXT,
    starter_model TEXT, starter_capacity TEXT, starter_protection TEXT, starter_channeled TEXT,
    motor_brand TEXT, motor_power TEXT, motor_amperage TEXT, motor_frequency TEXT, motor_meggeo TEXT,
    motor_feed TEXT, motor_ground_system TEXT, motor_ground_location TEXT, motor_cable_gauge TEXT,
    pump_brand TEXT, pump_power TEXT, pump_model TEXT, pump_material TEXT, pump_repaired TEXT,
    responsible TEXT, reviewed_by TEXT, authorized_by TEXT, notes TEXT,
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  )`,
  `ALTER TABLE electric_panel_records ENABLE ROW LEVEL SECURITY`,
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'electric_panel_records' AND policyname = 'Allow all access to electric_panel_records') THEN
      CREATE POLICY "Allow all access to electric_panel_records" ON electric_panel_records FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$`,
];

async function run() {
  for (const sql of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql_text: sql }).catch(() => ({ error: null }));
    // Use raw fetch if rpc not available
    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ sql_text: sql })
    });
    const label = sql.split('\n')[0].trim().substring(0, 60);
    if (!res.ok) {
      const body = await res.text();
      if (body.includes('already exists') || body.includes('duplicate')) {
        console.log(`⚠️ Already exists (OK): ${label}`);
      } else {
        console.log(`❌ Error on: ${label}\n   ${body.substring(0, 200)}`);
      }
    } else {
      console.log(`✅ OK: ${label}`);
    }
  }
  console.log('\n✨ Migration complete!');
}

run().catch(console.error);
