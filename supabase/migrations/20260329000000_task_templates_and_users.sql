-- MÓDULO: ACTUALIZACIÓN DE USUARIOS y PLANTILLAS DE TAREAS

-- 1. Añadir teléfono a usuarios
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- 2. Actualizar función de creación de usuarios
CREATE OR REPLACE FUNCTION create_app_user(
    p_full_name TEXT,
    p_email TEXT,
    p_password TEXT,
    p_role_id UUID,
    p_avatar_color TEXT DEFAULT '#6366f1',
    p_phone TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_id UUID;
BEGIN
    -- Verificar email único
    IF EXISTS (SELECT 1 FROM app_users WHERE email = LOWER(TRIM(p_email))) THEN
        RETURN json_build_object('success', false, 'message', 'El email ya está registrado');
    END IF;

    INSERT INTO app_users (full_name, email, password_hash, role_id, avatar_color, phone)
    VALUES (
        TRIM(p_full_name),
        LOWER(TRIM(p_email)),
        crypt(p_password, gen_salt('bf')),
        p_role_id,
        p_avatar_color,
        p_phone
    )
    RETURNING id INTO v_new_id;

    RETURN json_build_object('success', true, 'user_id', v_new_id);
END;
$$;

-- 3. Crear templates iniciales en system_settings si no existen
INSERT INTO system_settings (key, value, description) 
VALUES (
    'task_templates', 
    '[]'::jsonb, 
    'Plantillas de tareas generadas automáticamente por tipo de servicio'
) ON CONFLICT (key) DO NOTHING;
