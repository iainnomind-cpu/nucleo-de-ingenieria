-- Activar la extensión pg_cron (Generalmente requerida para rutinas automáticas en Supabase Database)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Crear una función centralizada que revise mantenimientos
CREATE OR REPLACE FUNCTION check_upcoming_maintenance() 
RETURNS void AS $$
DECLARE
    rec RECORD;
    days_left INT;
BEGIN
    -- Recorrer todos los mantenimientos preventivos que estén en estado "Programado"
    FOR rec IN 
        SELECT id, next_service_date, equipment_id, assigned_to 
        FROM maintenance_schedules 
        WHERE status = 'scheduled'
    LOOP
        -- Calcular la diferencia en días
        days_left := (rec.next_service_date::date - CURRENT_DATE);
        
        -- Condición principal fijada en el requerimiento: 30 días y 7 días previos
        IF days_left = 30 OR days_left = 7 THEN
            
            -- Actualizar registro temporalmente (evita dobles envíos en un mismo día)
            UPDATE maintenance_schedules 
            SET 
                status = 'notified',
                alert_days_before = days_left -- Aquí guardaremos si fue a los 30 o a los 7
            WHERE id = rec.id AND alert_days_before IS DISTINCT FROM days_left;
            
            -- ! -- CAJA NEGRA DE WHATSAPP PENDIENTE -- ! --
            -- En un futuro, este bloque de condicional IF insertará una fila 
            -- hacia una tabla como `whatsapp_outbox` que disparará el Edge Function:
            -- INSERT INTO whatsapp_outbox (phone_number, message, status) VALUES ...
            
            RAISE NOTICE 'Alerta inminente: Equipo % a % días de mantenimiento. WhatsApp pendiente de integrar.', rec.equipment_id, days_left;
        END IF;
        
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Programar el Job mediante pg_cron para que ejecute la función todos los días a la medianoche (Hora Servidor: UTC)
SELECT cron.schedule('check_maintenance_daily_midnight', '0 0 * * *', 'SELECT check_upcoming_maintenance()');
