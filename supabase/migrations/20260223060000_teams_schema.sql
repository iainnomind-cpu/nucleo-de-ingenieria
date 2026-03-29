-- MÓDULO: M8 · EQUIPOS & COMUNICACIÓN

DROP TABLE IF EXISTS message_mentions CASCADE;
DROP TABLE IF EXISTS message_tasks CASCADE;
DROP TABLE IF EXISTS checkin_responses CASCADE;
DROP TABLE IF EXISTS checkin_prompts CASCADE;
DROP TABLE IF EXISTS space_files CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS space_members CASCADE;
DROP TABLE IF EXISTS spaces CASCADE;
DROP TABLE IF EXISTS team_tasks CASCADE;

-- 1. Spaces (Canales)
CREATE TABLE spaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    space_type VARCHAR(50) NOT NULL DEFAULT 'area', -- general, area, project, maintenance, dm, group_dm
    icon VARCHAR(50) DEFAULT 'forum',
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES maintenance_contracts(id) ON DELETE SET NULL,
    is_archived BOOLEAN DEFAULT false,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Miembros de Space
CREATE TABLE space_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
    user_name VARCHAR(255) NOT NULL, -- Samara, Paulina, Joel, Alejandro, Director
    role VARCHAR(50) DEFAULT 'member', -- admin, member, observer
    notifications VARCHAR(50) DEFAULT 'normal', -- urgent, normal, summary, muted
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(space_id, user_name)
);

-- 3. Mensajes
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES messages(id) ON DELETE SET NULL, -- for threads
    sender VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text', -- text, image, file, system, checkin_summary, task_created
    file_url TEXT,
    file_name VARCHAR(255),
    is_pinned BOOLEAN DEFAULT false,
    is_edited BOOLEAN DEFAULT false,
    task_id UUID, -- link to team_task if message was converted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Menciones
CREATE TABLE message_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
    mentioned_user VARCHAR(255) NOT NULL, -- @Joel, @operaciones
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Team Tasks (Tareas del equipo — desde chat o manuales)
CREATE TABLE team_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    assigned_to VARCHAR(255) NOT NULL,
    created_by VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, blocked, completed
    priority VARCHAR(50) DEFAULT 'normal', -- low, normal, high, urgent
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    source_space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
    checklist JSONB DEFAULT '[]', -- [{text, done}]
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Check-in prompts & responses
CREATE TABLE checkin_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_user VARCHAR(255) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(prompt_date, target_user)
);

CREATE TABLE checkin_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id UUID REFERENCES checkin_prompts(id) ON DELETE CASCADE,
    user_name VARCHAR(255) NOT NULL,
    completed_yesterday TEXT,
    working_today TEXT,
    blockers TEXT,
    responded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Space Files (pinned knowledge base)
CREATE TABLE space_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER,
    uploaded_by VARCHAR(255),
    description TEXT,
    is_pinned BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Triggers
CREATE TRIGGER update_spaces_modtime BEFORE UPDATE ON spaces FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_messages_modtime BEFORE UPDATE ON messages FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_team_tasks_modtime BEFORE UPDATE ON team_tasks FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- RLS
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to spaces" ON spaces FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to space_members" ON space_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to message_mentions" ON message_mentions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to team_tasks" ON team_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to checkin_prompts" ON checkin_prompts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to checkin_responses" ON checkin_responses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to space_files" ON space_files FOR ALL USING (true) WITH CHECK (true);

-- Seed default spaces
INSERT INTO spaces (name, description, space_type, icon) VALUES
  ('General', 'Anuncios de empresa, cultura, temas administrativos', 'general', 'campaign'),
  ('Operaciones', 'Coordinación de campo — Joel, Alejandro', 'area', 'engineering'),
  ('Administración', 'Facturación, contabilidad — Samara, Paulina', 'area', 'business_center'),
  ('Dirección', 'Estrategia y decisiones ejecutivas', 'area', 'shield_person'),
  ('Mantenimiento', 'Seguimiento de contratos de mantenimiento predictivo', 'maintenance', 'build');
