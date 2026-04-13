-- ============================================================
-- Migración: Plantillas de WhatsApp para Automatizaciones Internas
-- Base: Flujo Administrativo y Operativo
-- ============================================================

-- 1. Plantilla: Validación de Pago (Finanzas)
INSERT INTO wa_templates (
    name, category, language, header_type, header_content, 
    body, footer, buttons, variables, usage_type, meta_status, example_values
) VALUES (
    'finanzas_pago_validado', 'utility', 'es_MX', 'text', '💰 Pago Validado',
    'Hola Equipo 👋\nFinanzas (Samara) ha validado el pago/anticipo del proyecto *{{1}}* para el cliente *{{2}}*.\n\nEl candado financiero ha sido liberado 🔓.',
    'Núcleo de Ingeniería - Finanzas',
    '[]'::jsonb,
    '["proyecto", "cliente"]'::jsonb,
    'team',
    'draft',
    '["Mantenimiento Pozo Norte", "Agropecuaria Las Lomas"]'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 2. Plantilla: Solicitud de Aprobación de Materiales
INSERT INTO wa_templates (
    name, category, language, header_type, header_content, 
    body, footer, buttons, variables, usage_type, meta_status, example_values
) VALUES (
    'materiales_aprobacion_req', 'utility', 'es_MX', 'text', '⚠️ Aprobación Requerida',
    'El proyecto *{{1}}* no cuenta con el stock de materiales suficiente para iniciar.\n\nAdministración (Paulina) requiere autorización de dirección para generar las órdenes de compra correspondientes.',
    'Núcleo de Ingeniería - Inventarios',
    '[]'::jsonb,
    '["proyecto"]'::jsonb,
    'team',
    'draft',
    '["Reparación Motor 150HP"]'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 3. Plantilla: Proyecto Listo para Ejecución (Checklist Completo)
INSERT INTO wa_templates (
    name, category, language, header_type, header_content, 
    body, footer, buttons, variables, usage_type, meta_status, example_values
) VALUES (
    'proyecto_listo_operacion', 'utility', 'es_MX', 'text', '🚀 Listo para Ejecución',
    'El checklist pre-operativo del proyecto *{{1}}* ha sido completado en su totalidad:\n\n✅ Facturación y Cobranza (Samara)\n✅ Materiales Listos (Paulina)\n✅ Equipos Preparados (Joel)\n✅ Trabajo Programado (Joel/Alejandro)\n\nEl equipo puede iniciar maniobras en campo.',
    'Núcleo de Ingeniería - Operaciones',
    '[]'::jsonb,
    '["proyecto"]'::jsonb,
    'team',
    'draft',
    '["PRJ-2026-045"]'::jsonb
) ON CONFLICT (id) DO NOTHING;
