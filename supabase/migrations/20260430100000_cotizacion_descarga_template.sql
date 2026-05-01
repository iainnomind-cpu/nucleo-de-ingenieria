-- ═══════════════════════════════════════════════════════════════
-- PLANTILLA: cotizacion_descarga_pdf
-- Plantilla de utilidad con URL de descarga del PDF de la cotización
-- ═══════════════════════════════════════════════════════════════

INSERT INTO wa_templates (
    name,
    category,
    language,
    header_type,
    header_content,
    body,
    footer,
    variables,
    example_values,
    usage_type,
    meta_status
) VALUES (
    'cotizacion_descarga_pdf',
    'utility',
    'es_MX',
    'text',
    'Cotizacion Lista',
    'Hola {{1}}, su cotizacion *{{2}}* por *{{3}}* ya esta lista.

📋 Concepto: {{4}}
📅 Tiempo estimado: {{5}} dias

📥 *Descargue su cotizacion en PDF:*
{{6}}

Para descargar, toque el enlace de arriba. Se abrira en su navegador y la descarga comenzara automaticamente.

Si tiene alguna duda, responda este mensaje y con gusto le atendemos.',
    'Nucleo de Ingenieria',
    '["client_name", "quote_number", "total", "description", "estimated_days", "pdf_url"]',
    '["Juan Perez", "COT-2026-0001", "$18,500.00", "Instalacion de bomba sumergible", "10", "https://ejemplo.com/cotizacion.pdf"]',
    'marketing',
    'draft'
)
ON CONFLICT DO NOTHING;
