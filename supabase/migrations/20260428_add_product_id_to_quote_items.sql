-- Add product_id column to quote_items to link inventory products to quotation line items
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES inventory_products(id);

-- Add an index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_quote_items_product_id ON quote_items(product_id);

-- Comment for documentation
COMMENT ON COLUMN quote_items.product_id IS 'FK to inventory_products. When set, this line item comes from inventory and enables automatic stock consumption (M4) when converted to project.';
