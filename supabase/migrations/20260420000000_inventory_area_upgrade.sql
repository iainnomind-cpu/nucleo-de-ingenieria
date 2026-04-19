-- INVENTARIO: Agregar campo 'area' (Bodega/Oficina) y nuevas categorías
-- Regla de negocio: Códigos MM*, MAQ*, MACO*, LIM*, HER* → Bodega, el resto → Oficina

-- 1. Agregar columna area
ALTER TABLE inventory_products ADD COLUMN IF NOT EXISTS area VARCHAR(50) DEFAULT 'oficina';

-- 2. Índice para filtros por area
CREATE INDEX IF NOT EXISTS idx_inventory_products_area ON inventory_products(area);

-- 3. Actualizar productos existentes basándose en prefijo de código
UPDATE inventory_products SET area = 'bodega'
WHERE code ~* '^(MM|MAQ|MACO|LIM|HER)-';

-- 4. Actualizar categoría 'otro' para los que no matchan
-- (se aplicará al migrar datos del Excel)
