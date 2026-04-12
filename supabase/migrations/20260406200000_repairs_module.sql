-- =============================================
-- MÓDULO DE REPARACIONES (v2 — Flujo completo Núcleo)
-- Flujo: Recoger → Enviar → Diagnóstico → Cotizar → Autorizar → OC → Reparar → Regreso → Entregar → Facturar
-- =============================================

-- 1. Tabla principal de reparaciones
CREATE TABLE IF NOT EXISTS equipment_repairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID NOT NULL REFERENCES installed_equipment(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

    -- 1) REPORTE INICIAL
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reported_by TEXT,
    failure_description TEXT NOT NULL,
    failure_type TEXT DEFAULT 'other'
        CHECK (failure_type IN ('electrical','mechanical','hydraulic','electronic','structural','other')),
    urgency TEXT DEFAULT 'normal'
        CHECK (urgency IN ('critical','high','normal','low')),
    photos_before JSONB DEFAULT '[]'::jsonb,

    -- 2) RECOLECCIÓN DEL EQUIPO
    pickup_date DATE,
    pickup_location TEXT,
    pickup_method TEXT DEFAULT 'pickup'
        CHECK (pickup_method IN ('crane','pickup','client_delivers','other')),

    -- 3) ENVÍO AL PROVEEDOR
    external_provider TEXT,
    shipping_carrier_to TEXT,         -- Paquetería de envío (Fedex, DHL, etc.)
    tracking_number_to TEXT,          -- Guía de envío
    sent_to_provider_date DATE,
    provider_received_date DATE,

    -- 4) DIAGNÓSTICO DEL PROVEEDOR
    diagnosis TEXT,
    diagnosis_date DATE,
    diagnosis_documents JSONB DEFAULT '[]'::jsonb,

    -- 5) COTIZACIÓN AL CLIENTE
    quote_amount DECIMAL(12,2) DEFAULT 0,
    quote_date DATE,
    quote_notes TEXT,
    quote_document_url TEXT,

    -- 6) AUTORIZACIÓN Y ORDEN DE COMPRA
    authorization_date DATE,
    authorized_by TEXT,
    purchase_order_number TEXT,
    purchase_order_date DATE,
    purchase_order_url TEXT,

    -- 7) REPARACIÓN
    repair_start_date DATE,
    estimated_days INTEGER,
    repair_location TEXT DEFAULT 'external'
        CHECK (repair_location IN ('internal','external')),

    -- 8) REGRESO DEL EQUIPO
    shipping_carrier_return TEXT,      -- Paquetería de regreso
    tracking_number_return TEXT,       -- Guía de regreso
    return_shipped_date DATE,
    return_received_date DATE,

    -- 9) ENTREGA AL CLIENTE
    delivery_date DATE,
    delivery_notes TEXT,

    -- 10) FACTURACIÓN
    invoice_number TEXT,
    invoice_date DATE,
    invoice_amount DECIMAL(12,2) DEFAULT 0,
    invoice_url TEXT,

    -- COSTOS INTERNOS
    parts_cost DECIMAL(12,2) DEFAULT 0,
    labor_cost DECIMAL(12,2) DEFAULT 0,
    external_cost DECIMAL(12,2) DEFAULT 0,
    other_cost DECIMAL(12,2) DEFAULT 0,

    -- GARANTÍA
    is_warranty_claim BOOLEAN DEFAULT false,
    warranty_id UUID REFERENCES equipment_warranties(id) ON DELETE SET NULL,

    -- RESOLUCIÓN
    resolution_notes TEXT,
    photos_after JSONB DEFAULT '[]'::jsonb,
    completion_date DATE,

    -- ESTADO (flujo completo)
    status TEXT DEFAULT 'reported'
        CHECK (status IN (
            'reported',
            'pickup_pending', 'picked_up',
            'sent_to_provider', 'received_by_provider',
            'diagnosis_received',
            'quoted', 'authorized', 'po_sent',
            'in_repair',
            'return_shipped', 'return_received',
            'delivered',
            'invoiced',
            'completed', 'cancelled'
        )),
    assigned_to TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_repairs_equipment ON equipment_repairs(equipment_id);
CREATE INDEX idx_repairs_client ON equipment_repairs(client_id);
CREATE INDEX idx_repairs_status ON equipment_repairs(status);
CREATE INDEX idx_repairs_date ON equipment_repairs(report_date DESC);

-- 2. Refacciones / partes usadas
CREATE TABLE IF NOT EXISTS repair_parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repair_id UUID NOT NULL REFERENCES equipment_repairs(id) ON DELETE CASCADE,
    part_name TEXT NOT NULL,
    part_number TEXT,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_cost DECIMAL(12,2) DEFAULT 0,
    source TEXT DEFAULT 'purchased'
        CHECK (source IN ('inventory','purchased','client_provided')),
    inventory_item_id UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_repair_parts_repair ON repair_parts(repair_id);

-- 3. Timeline / bitácora
CREATE TABLE IF NOT EXISTS repair_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repair_id UUID NOT NULL REFERENCES equipment_repairs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL DEFAULT 'note'
        CHECK (event_type IN ('status_change','note','photo','cost_update','part_added','shipping','document')),
    description TEXT,
    old_status TEXT,
    new_status TEXT,
    created_by TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_repair_timeline_repair ON repair_timeline(repair_id);

-- 4. Talleres / proveedores externos guardados
CREATE TABLE IF NOT EXISTS external_workshops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    contact_phone TEXT,
    contact_email TEXT,
    address TEXT,
    specialty TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Paqueterías guardadas (autocompletado)
CREATE TABLE IF NOT EXISTS shipping_carriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    tracking_url_template TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Paqueterías comunes precargadas
INSERT INTO shipping_carriers (name, tracking_url_template) VALUES
    ('Fedex', 'https://www.fedex.com/fedextrack/?trknbr={tracking}'),
    ('DHL', 'https://www.dhl.com/mx-es/home/rastreo.html?tracking-id={tracking}'),
    ('Estafeta', 'https://rastreo3.estafeta.com/Tracking/searchByGet/?search={tracking}'),
    ('Paquetexpress', 'https://www.paquetexpress.com.mx/rastreo/{tracking}'),
    ('RedPack', 'https://www.redpack.com.mx/rastreo/?guia={tracking}'),
    ('Grúa propia', NULL),
    ('Entrega directa', NULL)
ON CONFLICT (name) DO NOTHING;

-- 6. RLS
ALTER TABLE equipment_repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_carriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on equipment_repairs" ON equipment_repairs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on repair_parts" ON repair_parts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on repair_timeline" ON repair_timeline FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on external_workshops" ON external_workshops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on shipping_carriers" ON shipping_carriers FOR ALL USING (true) WITH CHECK (true);

-- 7. Trigger updated_at
CREATE TRIGGER update_equipment_repairs_modtime
    BEFORE UPDATE ON equipment_repairs
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
