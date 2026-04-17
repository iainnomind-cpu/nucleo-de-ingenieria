-- Migración para soportar automatizaciones hacia el cliente directamente y crons de pago
ALTER TABLE wa_automation_rules
ADD COLUMN IF NOT EXISTS send_to_client BOOLEAN DEFAULT false;

INSERT INTO system_settings (key, value, description)
VALUES ('last_payment_reminders', '"2026-04-01"', 'Fecha de la última ejecución del recordatorio diario de pagos')
ON CONFLICT (key) DO NOTHING;
