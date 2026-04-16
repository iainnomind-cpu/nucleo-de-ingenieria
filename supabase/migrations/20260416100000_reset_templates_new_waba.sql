-- ============================================================
-- RESET: Plantillas para Nueva Cuenta WABA
-- ============================================================
-- Las plantillas marcadas como approved/pending pertenecían a la cuenta WABA anterior.
-- Al cambiar de app/credenciales, hay que resetearlas a draft para poder
-- re-enviarlas a revisión con la nueva cuenta.

UPDATE wa_templates
SET 
    meta_status = 'draft',
    meta_template_id = NULL,
    meta_name = NULL
WHERE meta_status IN ('approved', 'pending');
