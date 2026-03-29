-- MÓDULO: SISTEMA DE USUARIOS, ROLES Y AUTENTICACIÓN
-- Requiere extensión pgcrypto para hashing seguro de contraseñas

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. TABLA DE ROLES
-- ============================================================
CREATE TABLE app_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_system BOOLEAN DEFAULT false, -- Protege roles que no se pueden eliminar
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_app_roles_modtime
    BEFORE UPDATE ON app_roles
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ============================================================
-- 2. TABLA DE USUARIOS
-- ============================================================
CREATE TABLE app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_id UUID REFERENCES app_roles(id) ON DELETE SET NULL,
    avatar_color VARCHAR(7) DEFAULT '#6366f1',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_app_users_modtime
    BEFORE UPDATE ON app_users
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ============================================================
-- 3. RLS POLICIES (permisivas — coherente con el resto del sistema)
-- ============================================================
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access on app_roles" ON app_roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on app_users" ON app_users FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. FUNCIONES RPC
-- ============================================================

-- 4a. Autenticar usuario (login)
CREATE OR REPLACE FUNCTION authenticate_user(p_email TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user app_users%ROWTYPE;
    v_role app_roles%ROWTYPE;
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

    -- Obtener rol
    SELECT * INTO v_role FROM app_roles WHERE id = v_user.role_id;

    RETURN json_build_object(
        'success', true,
        'user', json_build_object(
            'id', v_user.id,
            'full_name', v_user.full_name,
            'email', v_user.email,
            'role_id', v_user.role_id,
            'role_name', COALESCE(v_role.name, 'Sin rol'),
            'permissions', COALESCE(v_role.permissions, '{}'::jsonb),
            'avatar_color', v_user.avatar_color,
            'is_active', v_user.is_active,
            'last_login', NOW()
        )
    );
END;
$$;

-- 4b. Crear usuario (con hashing de contraseña)
CREATE OR REPLACE FUNCTION create_app_user(
    p_full_name TEXT,
    p_email TEXT,
    p_password TEXT,
    p_role_id UUID,
    p_avatar_color TEXT DEFAULT '#6366f1'
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

    INSERT INTO app_users (full_name, email, password_hash, role_id, avatar_color)
    VALUES (
        TRIM(p_full_name),
        LOWER(TRIM(p_email)),
        crypt(p_password, gen_salt('bf')),
        p_role_id,
        p_avatar_color
    )
    RETURNING id INTO v_new_id;

    RETURN json_build_object('success', true, 'user_id', v_new_id);
END;
$$;

-- 4c. Cambiar contraseña
CREATE OR REPLACE FUNCTION update_user_password(p_user_id UUID, p_new_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE app_users
    SET password_hash = crypt(p_new_password, gen_salt('bf'))
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Usuario no encontrado');
    END IF;

    RETURN json_build_object('success', true);
END;
$$;

-- ============================================================
-- 5. DATOS SEMILLA
-- ============================================================

-- Rol Administrador (sistema, no eliminable)
INSERT INTO app_roles (name, description, permissions, is_system) VALUES (
    'Administrador',
    'Acceso completo a todos los módulos del sistema',
    '{
        "dashboard": {"view": true, "create": true, "edit": true, "delete": true},
        "crm": {"view": true, "create": true, "edit": true, "delete": true},
        "quotes": {"view": true, "create": true, "edit": true, "delete": true},
        "projects": {"view": true, "create": true, "edit": true, "delete": true},
        "inventory": {"view": true, "create": true, "edit": true, "delete": true},
        "maintenance": {"view": true, "create": true, "edit": true, "delete": true},
        "finance": {"view": true, "create": true, "edit": true, "delete": true},
        "fleet": {"view": true, "create": true, "edit": true, "delete": true},
        "whatsapp": {"view": true, "create": true, "edit": true, "delete": true},
        "team": {"view": true, "create": true, "edit": true, "delete": true},
        "settings": {"view": true, "create": true, "edit": true, "delete": true}
    }'::jsonb,
    true
);

-- Rol Visor (solo lectura)
INSERT INTO app_roles (name, description, permissions, is_system) VALUES (
    'Visor',
    'Solo puede visualizar información, sin permisos de edición',
    '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "crm": {"view": true, "create": false, "edit": false, "delete": false},
        "quotes": {"view": true, "create": false, "edit": false, "delete": false},
        "projects": {"view": true, "create": false, "edit": false, "delete": false},
        "inventory": {"view": true, "create": false, "edit": false, "delete": false},
        "maintenance": {"view": true, "create": false, "edit": false, "delete": false},
        "finance": {"view": true, "create": false, "edit": false, "delete": false},
        "fleet": {"view": true, "create": false, "edit": false, "delete": false},
        "whatsapp": {"view": true, "create": false, "edit": false, "delete": false},
        "team": {"view": true, "create": false, "edit": false, "delete": false},
        "settings": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb,
    false
);

-- Usuario Admin semilla (contraseña: Admin123!)
INSERT INTO app_users (full_name, email, password_hash, role_id, avatar_color) VALUES (
    'Administrador',
    'admin@nucleo.com',
    crypt('Admin123!', gen_salt('bf')),
    (SELECT id FROM app_roles WHERE name = 'Administrador'),
    '#6366f1'
);
