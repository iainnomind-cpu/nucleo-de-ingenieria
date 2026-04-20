-- Añadir 'payment_received' y 'reminder' a los eventos permitidos
ALTER TABLE wa_automation_rules DROP CONSTRAINT IF EXISTS wa_automation_rules_trigger_event_check;

ALTER TABLE wa_automation_rules ADD CONSTRAINT wa_automation_rules_trigger_event_check 
CHECK (trigger_event IN (
    'status_change',
    'created',
    'completed',
    'approved',
    'cancelled',
    'overdue',
    'upcoming',
    'payment_received',
    'reminder'
));
