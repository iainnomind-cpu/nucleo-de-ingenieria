-- ============================================================
-- Migración: Semilla de usuarios requeridos e inserción de plantilla
-- Fase 1 de la integración de procesos operativos
-- ============================================================

-- 1. Inserción de Usuarios con sus permisos
DO $$
DECLARE
    v_ops_perms JSONB := '{
        "crm": {"view": true, "create": true, "edit": true, "delete": false},
        "quotes": {"view": true, "create": true, "edit": true, "delete": false},
        "projects": {"view": true, "create": true, "edit": true, "delete": false},
        "maintenance": {"view": true, "create": true, "edit": true, "delete": false}
    }'::jsonb;
    
    v_fin_perms JSONB := '{
        "finance": {"view": true, "create": true, "edit": true, "delete": false},
        "inventory": {"view": true, "create": true, "edit": true, "delete": false}
    }'::jsonb;

    v_adm_perms JSONB := '{
        "finance": {"view": true, "create": true, "edit": true, "delete": false},
        "inventory": {"view": true, "create": true, "edit": true, "delete": false},
        "maintenance": {"view": true, "create": true, "edit": true, "delete": false},
        "fleet": {"view": true, "create": true, "edit": true, "delete": false},
        "team": {"view": true, "create": true, "edit": true, "delete": false}
    }'::jsonb;
BEGIN

    -- Grupo Operaciones / Ventas
    -- Joel Rincón Cuevas
    IF NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'joelrincon_nucleoing@hotmail.com') THEN
        INSERT INTO app_users (full_name, email, phone, password_hash, permissions, avatar_color, is_active)
        VALUES ('Joel Rincón Cuevas', 'joelrincon_nucleoing@hotmail.com', '523414201583', crypt('Nucleo2024!', gen_salt('bf')), v_ops_perms, '#3b82f6', true);
    END IF;

    -- Alejandro Bernal
    IF NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'alejandro@nucleoing.com') THEN
        INSERT INTO app_users (full_name, email, phone, password_hash, permissions, avatar_color, is_active)
        VALUES ('Alejandro Bernal', 'alejandro@nucleoing.com', NULL, crypt('Nucleo2024!', gen_salt('bf')), v_ops_perms, '#0ea5e9', true);
    END IF;

    -- Ricky
    IF NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'ricky@nucleoing.com') THEN
        INSERT INTO app_users (full_name, email, phone, password_hash, permissions, avatar_color, is_active)
        VALUES ('Ricky', 'ricky@nucleoing.com', NULL, crypt('Nucleo2024!', gen_salt('bf')), v_ops_perms, '#6366f1', true);
    END IF;

    -- Grupo Finanzas
    -- Samara
    IF NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'finanzas_samara@nucleoing.com') THEN
        INSERT INTO app_users (full_name, email, phone, password_hash, permissions, avatar_color, is_active)
        VALUES ('Samara', 'finanzas_samara@nucleoing.com', '523411475608', crypt('Nucleo2024!', gen_salt('bf')), v_fin_perms, '#10b981', true);
    END IF;

    -- Grupo Administrativo
    -- Paulina
    IF NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'paulinasanchez_nucleoing@hotmail.com') THEN
        INSERT INTO app_users (full_name, email, phone, password_hash, permissions, avatar_color, is_active)
        VALUES ('Paulina', 'paulinasanchez_nucleoing@hotmail.com', '523123186426', crypt('Nucleo2024!', gen_salt('bf')), v_adm_perms, '#ec4899', true);
    END IF;

    -- Alondra
    IF NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'alondra@nucleoing.com') THEN
        INSERT INTO app_users (full_name, email, phone, password_hash, permissions, avatar_color, is_active)
        VALUES ('Alondra', 'alondra@nucleoing.com', NULL, crypt('Nucleo2024!', gen_salt('bf')), v_adm_perms, '#d946ef', true);
    END IF;

END $$;

-- 2. Creación de la Plantilla de WhatsApp
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM wa_templates WHERE name = 'proyecto_ganado_aviso') THEN
        INSERT INTO wa_templates (
            name, 
            category, 
            language, 
            body, 
            variables, 
            meta_status
        ) VALUES (
            'proyecto_ganado_aviso',
            'utility',
            'es_MX',
            'Alerta equipo: Pasa a Operación. Cliente: {{1}}, Proyecto: {{2}}.',
            '["cliente", "proyecto"]'::jsonb,
            'draft'
        );
    END IF;
END $$;
