-- =============================================
-- NOTIFICACIONES AUTOMÁTICAS POR WHATSAPP (equipo interno)
-- =============================================

CREATE TABLE IF NOT EXISTS wa_automation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,

    -- ACTIVADOR
    trigger_module TEXT NOT NULL
        CHECK (trigger_module IN ('projects','repairs','maintenance','quotes','invoices','fleet','inventory')),
    trigger_event TEXT NOT NULL
        CHECK (trigger_event IN ('status_change','created','completed','approved','cancelled','overdue','upcoming')),
    trigger_condition JSONB DEFAULT '{}',  -- {"new_status": "approved"} o {"urgency": "critical"}

    -- PLANTILLA (solo aprobadas)
    template_id UUID NOT NULL REFERENCES wa_templates(id) ON DELETE CASCADE,

    -- DESTINATARIOS (equipo interno)
    recipient_user_ids UUID[] DEFAULT '{}', -- IDs de app_users
    custom_phones TEXT[] DEFAULT '{}',       -- Teléfonos adicionales fijos

    -- MAPEO DE VARIABLES
    variable_mapping JSONB DEFAULT '{}',  -- {"1":"record.title", "2":"record.project_number"}

    -- CONFIG
    is_active BOOLEAN DEFAULT true,
    total_sent INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_wa_automation_module_event ON wa_automation_rules(trigger_module, trigger_event);
CREATE INDEX idx_wa_automation_active ON wa_automation_rules(is_active);

-- Log de envíos automáticos
CREATE TABLE IF NOT EXISTS wa_automation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES wa_automation_rules(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    recipient_name TEXT,
    template_name TEXT,
    variables_sent JSONB DEFAULT '[]',
    reference_type TEXT,  -- 'project', 'repair', etc.
    reference_id UUID,     -- ID del registro que disparó
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent','failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_wa_auto_log_rule ON wa_automation_log(rule_id);
CREATE INDEX idx_wa_auto_log_date ON wa_automation_log(created_at DESC);

-- RLS
ALTER TABLE wa_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_automation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on wa_automation_rules" ON wa_automation_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on wa_automation_log" ON wa_automation_log FOR ALL USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_wa_automation_rules_modtime
    BEFORE UPDATE ON wa_automation_rules
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
