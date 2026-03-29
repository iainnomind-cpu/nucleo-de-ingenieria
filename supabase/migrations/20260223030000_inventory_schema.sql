-- MÓDULO: M4 · GESTIÓN DE INVENTARIO

-- Drop if re-running
DROP TABLE IF EXISTS purchase_list_items CASCADE;
DROP TABLE IF EXISTS inventory_movements CASCADE;
DROP TABLE IF EXISTS inventory_products CASCADE;

-- 1. Catálogo de Productos
CREATE TABLE inventory_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- INV-0001
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- ferreteria, hidraulica, electrica, herramienta, consumible, otro
    subcategory VARCHAR(100),
    unit VARCHAR(30) DEFAULT 'pieza', -- pieza, metro, litro, kg, rollo, tramo, caja
    current_stock DECIMAL(12,2) DEFAULT 0,
    min_stock DECIMAL(12,2) DEFAULT 0,
    max_stock DECIMAL(12,2),
    unit_cost DECIMAL(12,2) DEFAULT 0,
    last_purchase_price DECIMAL(12,2),
    supplier VARCHAR(255),
    location VARCHAR(100), -- estante/ubicación en almacén
    criticality VARCHAR(20) DEFAULT 'normal', -- normal, high_rotation, critical_path
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Movimientos de inventario (entradas y salidas)
CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES inventory_products(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL, -- entry, exit, adjustment
    quantity DECIMAL(12,2) NOT NULL,
    unit_cost DECIMAL(12,2),
    total_cost DECIMAL(15,2),
    reason VARCHAR(100), -- purchase, project_consumption, return, adjustment, damaged, initial
    reference_id UUID, -- project_id or quote_id
    reference_type VARCHAR(50), -- project, quote, manual
    reference_number VARCHAR(100), -- PRY-2026-0001
    notes TEXT,
    performed_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Lista de compras inteligente
CREATE TABLE purchase_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES inventory_products(id) ON DELETE CASCADE,
    quantity_needed DECIMAL(12,2) NOT NULL,
    quantity_to_buy DECIMAL(12,2),
    estimated_cost DECIMAL(15,2),
    supplier VARCHAR(255),
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    status VARCHAR(20) DEFAULT 'pending', -- pending, ordered, received, cancelled
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Triggers
CREATE TRIGGER update_inventory_products_modtime
    BEFORE UPDATE ON inventory_products
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_purchase_list_modtime
    BEFORE UPDATE ON purchase_list_items
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- RLS
ALTER TABLE inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to inventory_products" ON inventory_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to inventory_movements" ON inventory_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to purchase_list_items" ON purchase_list_items FOR ALL USING (true) WITH CHECK (true);

-- Sequence
CREATE SEQUENCE IF NOT EXISTS inventory_code_seq START 1;
