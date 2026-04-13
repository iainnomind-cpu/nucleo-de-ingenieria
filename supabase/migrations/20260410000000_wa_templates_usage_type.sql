-- ============================================================
-- Migración: Separación de Plantillas de WhatsApp
-- Agrega columna usage_type para distinguir entre marketing y equipo
-- ============================================================

ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS usage_type TEXT NOT NULL DEFAULT 'marketing';

-- Actualizar la plantilla de equipo existente para que use el tipo correcto
UPDATE wa_templates SET usage_type = 'team' WHERE name = 'proyecto_ganado_aviso';
