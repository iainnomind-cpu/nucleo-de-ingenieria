-- ============================================================
-- Migración: Asignación individual de permisos a usuarios
-- 1. Agrega columna permissions a app_users
-- 2. Migra los permisos del rol actual (si lo tiene) al usuario
-- 3. Modifica los RPCs para manejar permissions directamente del usuario
-- ============================================================

-- 1. Agregar columna permissions a app_users
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Migrar permisos actuales desde los roles
UPDATE app_users
SET permissions = app_roles.permissions
FROM app_roles
WHERE app_users.role_id = app_roles.id;

-- (Opcional, pero seguro por ahora) Hacer que la columna role_id pueda ser nula sin afectar a los usuarios si se decide borrar la foreign key
-- No eliminamos app_roles todavía por si existen otras integraciones, pero el sistema base ya no dependerá de esta.

-- 3. Actualizar función RPC para login (authenticate_user)
CREATE OR REPLACE FUNCTION authenticate_user(p_email TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user app_users%ROWTYPE;
BEGIN
    -- Buscar usuario activo por email
    SELECT * INTO v_user FROM app_users
    WHERE email = LOWER(TRIM(p_email)) AND is_active = true;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Credenciales inválidas');
    END IF;

    -- Validar contraseña
    IF v_user.password_hash != crypt(p_password, v_user.password_hash) THEN
        RETURN json_build_object('success', false, 'message', 'Credenciales inválidas');
    END IF;

    -- Actualizar last_login
    UPDATE app_users SET last_login = NOW() WHERE id = v_user.id;

    RETURN json_build_object(
        'success', true,
        'user', json_build_object(
            'id', v_user.id,
            'full_name', v_user.full_name,
            'email', v_user.email,
            'permissions', COALESCE(v_user.permissions, '{}'::jsonb),
            'avatar_color', v_user.avatar_color,
            'is_active', v_user.is_active,
            'last_login', NOW()
        )
    );
END;
$$;

-- 4. Actualizar función para crear usuario (create_app_user)
-- Eliminamos el parámetro p_role_id de la capa obligatoria o lo ignoramos, usamos p_permissions
CREATE OR REPLACE FUNCTION create_app_user(
    p_full_name TEXT,
    p_email TEXT,
    p_password TEXT,
    p_permissions JSONB DEFAULT '{}'::jsonb,
    p_avatar_color TEXT DEFAULT '#6366f1',
    p_phone TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_id UUID;
    v_phone TEXT := p_phone;
BEGIN
    -- Verificar email único
    IF EXISTS (SELECT 1 FROM app_users WHERE email = LOWER(TRIM(p_email))) THEN
        RETURN json_build_object('success', false, 'message', 'El email ya está registrado');
    END IF;

    -- (Retrocompatibilidad en caso de que alguien haya llamado a la funcion modificada antes sin p_phone)
    -- Insertar
    INSERT INTO app_users (full_name, email, password_hash, permissions, avatar_color, phone)
    VALUES (
        TRIM(p_full_name),
        LOWER(TRIM(p_email)),
        crypt(p_password, gen_salt('bf')),
        p_permissions,
        p_avatar_color,
        v_phone
    )
    RETURNING id INTO v_new_id;

    RETURN json_build_object('success', true, 'user_id', v_new_id);
END;
$$;

-- Nota: Si se requiere el RPC anterior, se sobrescribe porque en PostgreSQL las funciones 
-- con el mismo nombre y diferentes tipos de parámetros son funciones sobrecargadas separadas.
-- Vamos a borrar las funciones anteriores que recibían UUID (como p_role_id) porque la app no las volverá a usar.
DROP FUNCTION IF EXISTS create_app_user(TEXT, TEXT, TEXT, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS create_app_user(TEXT, TEXT, TEXT, UUID, TEXT);
