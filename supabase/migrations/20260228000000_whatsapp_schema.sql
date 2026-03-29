-- MÓDULO: M9 · MARKETING WHATSAPP & NOTIFICACIONES AUTOMATIZADAS

DROP TABLE IF EXISTS wa_surveys CASCADE;
DROP TABLE IF EXISTS wa_notifications CASCADE;
DROP TABLE IF EXISTS wa_messages CASCADE;
DROP TABLE IF EXISTS wa_conversations CASCADE;
DROP TABLE IF EXISTS wa_campaign_steps CASCADE;
DROP TABLE IF EXISTS wa_campaigns CASCADE;
DROP TABLE IF EXISTS wa_templates CASCADE;

-- 1. Plantillas de WhatsApp (aprobadas por Meta)
CREATE TABLE wa_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'utility', -- utility, marketing, authentication
    language VARCHAR(10) DEFAULT 'es_MX',
    header_type VARCHAR(50), -- none, text, image, document, video
    header_content TEXT,
    body TEXT NOT NULL, -- Cuerpo del mensaje con variables {{1}}, {{2}}, etc.
    footer TEXT,
    buttons JSONB DEFAULT '[]', -- [{type: "QUICK_REPLY", text: "Confirmar"}, ...]
    variables JSONB DEFAULT '[]', -- ["client_name", "next_service_date", "amount"]
    meta_status VARCHAR(50) DEFAULT 'draft', -- draft, pending, approved, rejected
    meta_template_id VARCHAR(255), -- ID de Meta después de aprobación
    example_values JSONB DEFAULT '[]', -- Valores de ejemplo para la revisión de Meta
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Campañas automatizadas
CREATE TABLE wa_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(50) NOT NULL, -- maintenance_reminder, payment_reminder, reactivation, operational, custom
    is_active BOOLEAN DEFAULT true,
    target_filter JSONB DEFAULT '{}', -- Filtros para seleccionar clientes objetivo
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_read INTEGER DEFAULT 0,
    total_responded INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    revenue_generated DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Pasos de campaña (secuencia de mensajes)
CREATE TABLE wa_campaign_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES wa_campaigns(id) ON DELETE CASCADE,
    template_id UUID REFERENCES wa_templates(id) ON DELETE SET NULL,
    step_order INTEGER NOT NULL DEFAULT 1,
    trigger_days INTEGER NOT NULL DEFAULT 0, -- días antes/después del evento (negativo = antes, positivo = después)
    trigger_reference VARCHAR(50) DEFAULT 'event_date', -- event_date, due_date, last_visit
    delay_hours INTEGER DEFAULT 0, -- horas de espera adicionales
    send_time TIME DEFAULT '09:00', -- hora preferida de envío
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Conversaciones (una por cliente)
CREATE TABLE wa_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    client_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active', -- active, archived, blocked
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_message_preview TEXT,
    unread_count INTEGER DEFAULT 0,
    assigned_to VARCHAR(255), -- miembro del equipo asignado
    tags JSONB DEFAULT '[]', -- etiquetas de clasificación
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Mensajes WhatsApp
CREATE TABLE wa_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES wa_conversations(id) ON DELETE CASCADE,
    template_id UUID REFERENCES wa_templates(id) ON DELETE SET NULL,
    direction VARCHAR(10) NOT NULL DEFAULT 'outbound', -- inbound, outbound
    message_type VARCHAR(50) DEFAULT 'text', -- text, template, image, document, location, quick_reply
    content TEXT,
    media_url TEXT,
    media_type VARCHAR(50),
    template_variables JSONB DEFAULT '[]', -- valores de las variables usadas
    wa_message_id VARCHAR(255), -- ID del mensaje en WhatsApp API
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, read, failed
    error_message TEXT,
    sent_by VARCHAR(255), -- sistema o miembro del equipo
    campaign_id UUID REFERENCES wa_campaigns(id) ON DELETE SET NULL,
    schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    location_lat DECIMAL(10,7),
    location_lng DECIMAL(10,7),
    location_label VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Notificaciones operativas disparadas
CREATE TABLE wa_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    template_id UUID REFERENCES wa_templates(id) ON DELETE SET NULL,
    notification_type VARCHAR(50) NOT NULL, -- quote_sent, project_start, project_complete, fault_alert, visit_confirmation, payment_reminder, maintenance_reminder
    reference_type VARCHAR(50), -- project, invoice, maintenance_schedule, quote
    reference_id UUID, -- ID del registro relacionado
    variables_used JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, read, failed
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Encuestas post-servicio
CREATE TABLE wa_surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES wa_conversations(id) ON DELETE SET NULL,
    question TEXT NOT NULL DEFAULT '¿Cómo calificaría el servicio recibido? (1-5)',
    rating INTEGER, -- 1 a 5
    comment TEXT,
    status VARCHAR(50) DEFAULT 'sent', -- sent, answered, expired
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Triggers
CREATE TRIGGER update_wa_templates_modtime
    BEFORE UPDATE ON wa_templates
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_wa_campaigns_modtime
    BEFORE UPDATE ON wa_campaigns
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_wa_conversations_modtime
    BEFORE UPDATE ON wa_conversations
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- RLS
ALTER TABLE wa_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to wa_templates" ON wa_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to wa_campaigns" ON wa_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to wa_campaign_steps" ON wa_campaign_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to wa_conversations" ON wa_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to wa_messages" ON wa_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to wa_notifications" ON wa_notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to wa_surveys" ON wa_surveys FOR ALL USING (true) WITH CHECK (true);
