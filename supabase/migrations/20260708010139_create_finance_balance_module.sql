-- Finance Balance General Module

CREATE TABLE IF NOT EXISTS finance_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    initial_balance DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed basic accounts based on user Excel
INSERT INTO finance_accounts (name, type, initial_balance) VALUES
('Pyme', 'bank', 136095.52),
('Crédito', 'credit', 0.00),
('Efectivo', 'cash', 0.00)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS finance_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'bg-slate-100 text-slate-800',
    is_deductible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed basic categories from Excel
INSERT INTO finance_categories (name, color, is_deductible) VALUES
('Nómina', 'bg-emerald-100 text-emerald-800', true),
('Pago de Impuestos', 'bg-rose-100 text-rose-800', true),
('IMSS', 'bg-sky-100 text-sky-800', true),
('TDC', 'bg-purple-100 text-purple-800', false),
('Facturas Crédito', 'bg-indigo-100 text-indigo-800', true),
('Gastos Deducibles', 'bg-amber-100 text-amber-800', true),
('Otros', 'bg-slate-100 text-slate-800', false)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS finance_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES finance_categories(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(15,2) NOT NULL,
    invoice_number TEXT,
    rfc TEXT,
    is_invoiced BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Policies (assuming RLS is enabled)
ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to finance_accounts" 
ON finance_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to finance_categories" 
ON finance_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to finance_transactions" 
ON finance_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Functions and triggers
CREATE TRIGGER update_finance_accounts_modtime
    BEFORE UPDATE ON finance_accounts
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_finance_transactions_modtime
    BEFORE UPDATE ON finance_transactions
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();
