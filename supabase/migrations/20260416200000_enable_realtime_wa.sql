-- Habilitar Realtime para las tablas de WhatsApp
-- Esto es NECESARIO para que las suscripciones en el frontend funcionen
-- Ejecutar en Supabase SQL Editor

ALTER PUBLICATION supabase_realtime ADD TABLE wa_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE wa_conversations;
