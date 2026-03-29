-- MÓDULO: M1 · CRM & GESTIÓN DE CLIENTES

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Clients Table (Ficha de cliente)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    rfc VARCHAR(20),
    address TEXT,
    industry VARCHAR(100),
    status VARCHAR(50) DEFAULT 'prospect', -- prospect, active, inactive, vip, overdue
    payment_score DECIMAL(3,2), -- Scoring de pago (ej. 4.5/5.0)
    growth_potential VARCHAR(50), -- low, medium, high
    credit_days INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Client Assets (Inventario de activos del cliente)
CREATE TABLE client_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    asset_type VARCHAR(50) NOT NULL, -- well, motor, pump, variator
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    horsepower DECIMAL(10,2), -- HP
    depth DECIMAL(10,2), -- Profundidad
    specifications JSONB, -- Otros detalles técnicos
    installation_date DATE,
    status VARCHAR(50) DEFAULT 'active', -- active, maintenance, inactive
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Sales Pipeline (Pipeline de ventas)
CREATE TABLE sales_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    estimated_value DECIMAL(15,2),
    probability INTEGER DEFAULT 0, -- 0-100%
    stage VARCHAR(50) DEFAULT 'prospecting', -- prospecting, quoting, negotiation, closed_won, closed_lost
    closing_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Activity/History (Historial y bitácoras)
CREATE TABLE client_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES client_assets(id) ON DELETE SET NULL, -- Opcional, si está relacionado a un activo/pozo
    opportunity_id UUID REFERENCES sales_opportunities(id) ON DELETE SET NULL,
    activity_type VARCHAR(50) NOT NULL, -- call, email, meeting, monitoring, quote, project
    title VARCHAR(255) NOT NULL,
    description TEXT,
    activity_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID, -- Referencia al auth.users si lo hay
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_modtime
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_assets_modtime
    BEFORE UPDATE ON client_assets
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_opportunities_modtime
    BEFORE UPDATE ON sales_opportunities
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Row Level Security (RLS) - Permissive (sin autenticación implementada aún)
-- NOTA: Cuando se implemente auth, cambiar (true) por (auth.role() = 'authenticated')
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to client_assets" ON client_assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to sales_opportunities" ON sales_opportunities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to client_activities" ON client_activities FOR ALL USING (true) WITH CHECK (true);
