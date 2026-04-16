-- ============================================================
-- MÓDULO: SISTEMA DE NOTIFICACIONES INTERNAS
-- ============================================================

-- Tabla centralizada de notificaciones por usuario
CREATE TABLE IF NOT EXISTS app_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_name VARCHAR(255) NOT NULL,       -- nombre de usuario destino (Joel, Samara, etc.)
    title VARCHAR(500) NOT NULL,
    message TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'info',  -- task, project, payment, mention, system, alert
    icon VARCHAR(50) DEFAULT 'notifications',
    link VARCHAR(500),                     -- ruta para navegar al hacer clic (ej: /tasks, /projects/123)
    is_read BOOLEAN DEFAULT false,
    source VARCHAR(100),                   -- origen: pipeline, finance, team, system
    reference_id UUID,                     -- ID del recurso relacionado (task_id, project_id, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_app_notifications_user ON app_notifications(user_name, is_read);
CREATE INDEX idx_app_notifications_created ON app_notifications(created_at DESC);

-- RLS
ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to app_notifications" ON app_notifications FOR ALL USING (true) WITH CHECK (true);
