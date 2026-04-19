-- ============================================================
-- MÓDULO: SISTEMA PROACTIVO DE MANTENIMIENTO
-- Detecta equipos que llevan mucho tiempo sin mantenimiento
-- y permite enviar notificación WhatsApp con un clic.
-- ============================================================

-- 1. Tabla de alertas proactivas
CREATE TABLE IF NOT EXISTS proactive_maintenance_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_id UUID REFERENCES installed_equipment(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    equipment_name VARCHAR(255),
    client_name VARCHAR(255),
    client_phone VARCHAR(50),
    equipment_type VARCHAR(100),
    last_service_date DATE,
    days_overdue INTEGER DEFAULT 0,
    recommended_months INTEGER DEFAULT 12,
    -- Estados: pending → notified → wa_sent → scheduled → dismissed
    alert_status VARCHAR(50) DEFAULT 'pending',
    wa_sent_at TIMESTAMP WITH TIME ZONE,
    wa_message_id VARCHAR(255),
    notified_admin_at TIMESTAMP WITH TIME ZONE,
    scheduled_id UUID,  -- referencia a maintenance_schedules si se agendó
    dismissed_at TIMESTAMP WITH TIME ZONE,
    dismissed_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_proactive_alerts_status ON proactive_maintenance_alerts(alert_status);
CREATE INDEX idx_proactive_alerts_equipment ON proactive_maintenance_alerts(equipment_id, alert_status);
CREATE INDEX idx_proactive_alerts_client ON proactive_maintenance_alerts(client_id);

-- Trigger updated_at
CREATE TRIGGER update_proactive_alerts_modtime
    BEFORE UPDATE ON proactive_maintenance_alerts
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- RLS
ALTER TABLE proactive_maintenance_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to proactive_maintenance_alerts"
    ON proactive_maintenance_alerts FOR ALL USING (true) WITH CHECK (true);

-- 2. Configuración: destinatarios de alertas proactivas
-- Almacena array de user_names que recibirán las notificaciones internas
INSERT INTO system_settings (key, value, description) VALUES (
    'proactive_maint_recipients',
    '[]'::jsonb,
    'Lista de nombres de usuario (user_name) que recibirán notificaciones internas cuando se detecte un cliente sin mantenimiento reciente. Configurable desde Settings > Parámetros Operativos.'
) ON CONFLICT (key) DO NOTHING;

-- 3. Plantilla WhatsApp borrador para recordatorio proactivo de mantenimiento
INSERT INTO wa_templates (name, category, language, header_type, header_content, body, footer, variables, usage_type, meta_status)
VALUES (
    'recordatorio_mantenimiento_proactivo',
    'utility',
    'es_MX',
    'text',
    'Recordatorio de Mantenimiento',
    'Hola {{1}}, le saluda el equipo de Núcleo de Ingeniería. Notamos que su equipo {{2}} lleva más de {{3}} meses sin recibir servicio de mantenimiento. Le recomendamos programar una revisión para asegurar el óptimo funcionamiento y evitar fallas imprevistas. ¿Le gustaría agendar una visita? Estamos a sus órdenes.',
    'Núcleo de Ingeniería — Servicio Profesional',
    '["Nombre Cliente", "Nombre Equipo", "Meses sin servicio"]'::jsonb,
    'marketing',
    'draft'
) ON CONFLICT DO NOTHING;
