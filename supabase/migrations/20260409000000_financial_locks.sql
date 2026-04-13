-- ============================================================
-- Migración: Candados financieros para proyectos
-- Agrega flag de cliente comercial de confianza
-- ============================================================

-- 1. Flag de cliente comercial de confianza (bypass de pago)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_trusted_client BOOLEAN NOT NULL DEFAULT false;

-- 2. Marcar clientes VIP existentes como trusted automáticamente
UPDATE clients SET is_trusted_client = true WHERE status = 'vip';
