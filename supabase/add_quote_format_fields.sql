-- Agregar campos de formato de cotización que coincidan con el Excel
-- Estos campos son necesarios para generar PDFs con el formato correcto

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_address TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS property_name TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT '70% AL CONTRATAR 30% AL FINALIZAR';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS delivery_days TEXT DEFAULT '10 DIAS HABILES';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,2) DEFAULT 20.00;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS warranty_text TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS intro_text TEXT;

COMMENT ON COLUMN quotes.client_address IS 'Domicilio del cliente para la cotización';
COMMENT ON COLUMN quotes.property_name IS 'Nombre del predio o sitio del trabajo';
COMMENT ON COLUMN quotes.payment_terms IS 'Forma de pago ej: 70% AL CONTRATAR 30% AL FINALIZAR';
COMMENT ON COLUMN quotes.delivery_days IS 'Tiempo de entrega del sistema';
COMMENT ON COLUMN quotes.exchange_rate IS 'Tipo de cambio USD/MXN para la cotización';
COMMENT ON COLUMN quotes.warranty_text IS 'Texto personalizado de garantía (si difiere del default)';
COMMENT ON COLUMN quotes.intro_text IS 'Texto introductorio personalizado para la cotización';
