-- ============================================================
-- Corrección: Eliminar emojis de los encabezados de las plantillas
-- Meta API rechaza ('invalid parameter') cualquier encabezado de tipo TEXT que contenga emojis o parámetros no permitidos.
-- ============================================================

UPDATE wa_templates SET header_content = 'Pago Validado' WHERE name = 'finanzas_pago_validado';
UPDATE wa_templates SET header_content = 'Aprobacion Requerida' WHERE name = 'materiales_aprobacion_req';
UPDATE wa_templates SET header_content = 'Listo para Ejecucion' WHERE name = 'proyecto_listo_operacion';
