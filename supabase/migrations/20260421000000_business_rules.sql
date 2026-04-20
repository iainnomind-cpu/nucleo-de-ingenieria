CREATE TABLE IF NOT EXISTS business_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  action TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the default rule
INSERT INTO business_rules (name, description, trigger_event, action, config)
VALUES (
  'Pago/Adelanto → Iniciar Proyecto',
  'Cuando se registra el primer pago en una factura vinculada a un proyecto en estado Pendiente, el proyecto pasa a estado En Preparación.',
  'invoice_first_payment',
  'activate_project',
  '{"target_status": "preparation"}'
);
