-- MÓDULO: COTIZADOR - CATEGORÍAS DINÁMICAS
-- Inserta la nueva llave en system_settings para gestionar las categorías de los servicios del catálogo.

INSERT INTO system_settings (key, value, description)
VALUES (
    'service_categories',
    '["Aforo", "Equipamiento", "Rehabilitación", "Videograbación", "Mantenimiento", "Electricidad", "Media Tensión", "Paneles Solares", "Electrificación Comercial", "Electrificación Industrial", "Otro"]'::jsonb,
    'Lista oficial de categorías para el catálogo de servicios permitidas en la plataforma.'
) ON CONFLICT (key) DO NOTHING;
