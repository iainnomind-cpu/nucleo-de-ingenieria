-- MIGRATION: Geo fields for Google Maps integration
-- Add latitude, longitude, formatted_address to clients, client_assets, projects

-- ─── Clients ───
ALTER TABLE clients ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS formatted_address TEXT;

-- ─── Client Assets (pozos have their own coordinates) ───
ALTER TABLE client_assets ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE client_assets ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- ─── Projects ───
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS formatted_address TEXT;

-- ─── Installed Equipment ───
ALTER TABLE installed_equipment ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE installed_equipment ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- ─── Field Logs: checkin geolocation ───
ALTER TABLE field_logs ADD COLUMN IF NOT EXISTS checkin_lat DOUBLE PRECISION;
ALTER TABLE field_logs ADD COLUMN IF NOT EXISTS checkin_lng DOUBLE PRECISION;
ALTER TABLE field_logs ADD COLUMN IF NOT EXISTS checkin_time TIMESTAMPTZ;

-- ─── Seed: geo coordinates for existing sample data ───
-- Agrícola San José — Predio en Tecalitlán, Jalisco
UPDATE clients SET
    latitude = 19.4725, longitude = -103.3055,
    formatted_address = 'Tecalitlán, Jalisco, México'
WHERE id = '47e70259-21cb-4bc9-93b5-7c0ef95cfdbf';

-- Inmobiliaria Bosques — Predio en Autlán de Navarro, Jalisco
UPDATE clients SET
    latitude = 19.7716, longitude = -104.3650,
    formatted_address = 'Autlán de Navarro, Jalisco, México'
WHERE id = 'bd94e772-c518-472b-8a16-6cdaaab54c9a';

-- Activos / Pozos
UPDATE client_assets SET latitude = 19.4730, longitude = -103.3060
WHERE id = 'f0882ef9-8b89-4a94-b1eb-1db17dc02b85'; -- Pozo Agrícola Norte 1

UPDATE client_assets SET latitude = 19.7720, longitude = -104.3655
WHERE id = 'c3260792-7fcc-4158-b0a3-3b1a8f906e57'; -- Pozo Residencial Sur

-- Equipos instalados
UPDATE installed_equipment SET latitude = 19.4730, longitude = -103.3060
WHERE id = '21111111-1111-4111-a111-111111111111'; -- Bomba Principal Norte

-- Proyectos
UPDATE projects SET
    latitude = 19.4730, longitude = -103.3060,
    formatted_address = 'Pozo Agrícola Norte 1, Tecalitlán, Jalisco'
WHERE id = '8a513d6a-5435-43a9-a78b-d7d8c7c93cb5';

UPDATE projects SET
    latitude = 19.7720, longitude = -104.3655,
    formatted_address = 'Pozo Residencial Sur, Autlán, Jalisco'
WHERE id = '86ea25f1-34e8-46eb-8e5f-e5cb09abcddf';
