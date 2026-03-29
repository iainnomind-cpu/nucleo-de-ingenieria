-- MÓDULO: M6 · FINANZAS & FACTURACIÓN

DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS project_expenses CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;

-- 1. Facturas
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL, -- FAC-2026-0001
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES maintenance_contracts(id) ON DELETE SET NULL,
    invoice_type VARCHAR(50) DEFAULT 'project', -- project, maintenance, service, other
    status VARCHAR(50) DEFAULT 'draft', -- draft, sent, partial, paid, overdue, cancelled
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 16,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) DEFAULT 0,
    amount_paid DECIMAL(15,2) DEFAULT 0,
    balance DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'MXN',
    payment_terms VARCHAR(100), -- 15 días, 30 días, contado
    client_rfc VARCHAR(20),
    client_fiscal_name VARCHAR(255),
    client_fiscal_address TEXT,
    cfdi_use VARCHAR(50), -- G01, G03, P01, etc.
    notes TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Pagos
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'transfer', -- transfer, cash, check, card, other
    reference VARCHAR(255), -- número de transferencia, cheque, etc.
    notes TEXT,
    received_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Gastos de proyecto (costos reales)
CREATE TABLE project_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- materials, labor, machinery, transport, subcontract, other
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    expense_date DATE DEFAULT CURRENT_DATE,
    supplier VARCHAR(255),
    receipt_number VARCHAR(100),
    notes TEXT,
    recorded_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Triggers
CREATE TRIGGER update_invoices_modtime
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to project_expenses" ON project_expenses FOR ALL USING (true) WITH CHECK (true);

-- Sequence
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;
