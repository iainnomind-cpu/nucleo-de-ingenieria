-- MÓDULO: M2 · COTIZADOR INTELIGENTE

-- 1. Catálogo de Servicios
CREATE TABLE service_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- aforo, equipamiento, rehabilitacion, videograbacion, mantenimiento, otro
    description TEXT,
    base_price DECIMAL(15,2) DEFAULT 0,
    unit VARCHAR(50) DEFAULT 'servicio', -- servicio, hora, metro, km, pieza
    variables JSONB DEFAULT '{}', -- Variables configurables: { "depth_factor": 1.2, "hp_factor": 0.8, ... }
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Cotizaciones (con versionado)
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_number VARCHAR(50) UNIQUE NOT NULL, -- COT-2026-0001
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES sales_opportunities(id) ON DELETE SET NULL,
    version INTEGER DEFAULT 1,
    parent_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL, -- Para versionado
    status VARCHAR(50) DEFAULT 'draft', -- draft, sent, negotiation, approved, rejected, converted
    title VARCHAR(255) NOT NULL,
    description TEXT,
    -- Variables de cálculo
    work_type VARCHAR(100), -- Tipo de trabajo principal
    well_depth DECIMAL(10,2), -- Profundidad del pozo (m)
    motor_hp DECIMAL(10,2), -- HP del motor
    distance_km DECIMAL(10,2), -- Distancia en km
    crew_size INTEGER DEFAULT 1, -- Número de personal
    risk_level VARCHAR(50) DEFAULT 'normal', -- low, normal, high, critical
    estimated_days INTEGER DEFAULT 1,
    -- Costos calculados
    subtotal DECIMAL(15,2) DEFAULT 0,
    margin_percent DECIMAL(5,2) DEFAULT 20, -- Margen de utilidad %
    margin_amount DECIMAL(15,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_percent DECIMAL(5,2) DEFAULT 16, -- IVA
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) DEFAULT 0,
    -- Configuración de costos operativos
    cost_per_km DECIMAL(10,2) DEFAULT 5.50,
    viaticos_per_person DECIMAL(10,2) DEFAULT 850,
    insurance_cost DECIMAL(10,2) DEFAULT 0,
    vehicle_wear DECIMAL(10,2) DEFAULT 0,
    maniobra_cost DECIMAL(10,2) DEFAULT 0,
    -- Meta
    valid_until DATE,
    notes TEXT,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE,
    converted_project_id UUID, -- Referencia al proyecto cuando se convierte
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Items de cotización (líneas de detalle)
CREATE TABLE quote_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
    service_id UUID REFERENCES service_catalog(id) ON DELETE SET NULL,
    description VARCHAR(500) NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit VARCHAR(50) DEFAULT 'servicio',
    unit_price DECIMAL(15,2) DEFAULT 0,
    subtotal DECIMAL(15,2) DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Triggers
CREATE TRIGGER update_service_catalog_modtime
    BEFORE UPDATE ON service_catalog
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_quotes_modtime
    BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- RLS Policies (permissive while no auth)
ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to service_catalog" ON service_catalog FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to quotes" ON quotes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to quote_items" ON quote_items FOR ALL USING (true) WITH CHECK (true);

-- Sequence for quote numbers
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;
