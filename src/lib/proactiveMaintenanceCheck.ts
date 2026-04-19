/**
 * Proactive Maintenance Detection Engine
 * 
 * Detects active equipment that hasn't received service in longer than
 * the recommended interval, and creates internal notifications for
 * configurable admin users.
 * 
 * Runs as part of the simulated daily cron in Dashboard.tsx.
 */

import { supabase } from './supabase';
import { EQUIPMENT_MAINTENANCE_RULES } from '../types/maintenance';

// Grace period: extra days beyond the recommended interval before alerting
const GRACE_DAYS = 30;

interface EquipmentRow {
    id: string;
    client_id: string | null;
    name: string;
    equipment_type: string;
    status: string;
    client?: { company_name: string; phone: string | null } | null;
}

interface ScheduleRow {
    equipment_id: string;
    status: string;
    last_service_date: string | null;
    next_service_date: string;
    completed_at: string | null;
}

/**
 * Main detection function — call once per day.
 * 
 * 1. Fetches all active equipment with client info
 * 2. For each, finds the most recent completed maintenance or last_service_date
 * 3. Compares against EQUIPMENT_MAINTENANCE_RULES
 * 4. If overdue (beyond grace) and no future schedule exists → creates alert
 * 5. Sends internal notification to configured recipients
 */
export async function checkProactiveMaintenance(): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    try {
        // 1. Fetch active equipment with client data
        const { data: equipment, error: eqErr } = await supabase
            .from('installed_equipment')
            .select('id, client_id, name, equipment_type, status, client:clients(company_name, phone)')
            .eq('status', 'active')
            .not('client_id', 'is', null);

        if (eqErr || !equipment || equipment.length === 0) {
            console.log('[ProactiveMaint] No active equipment found or error:', eqErr?.message);
            return { created, skipped };
        }

        // 2. Fetch ALL schedules for these equipment (to avoid N+1 queries)
        const equipmentIds = equipment.map((e: EquipmentRow) => e.id);
        const { data: allSchedules } = await supabase
            .from('maintenance_schedules')
            .select('equipment_id, status, last_service_date, next_service_date, completed_at')
            .in('equipment_id', equipmentIds);

        const schedulesByEquipment: Record<string, ScheduleRow[]> = {};
        (allSchedules || []).forEach((s: ScheduleRow) => {
            if (!schedulesByEquipment[s.equipment_id]) schedulesByEquipment[s.equipment_id] = [];
            schedulesByEquipment[s.equipment_id].push(s);
        });

        // 3. Fetch existing active proactive alerts (to avoid duplicates)
        const { data: existingAlerts } = await supabase
            .from('proactive_maintenance_alerts')
            .select('equipment_id')
            .in('alert_status', ['pending', 'notified', 'wa_sent']);

        const alertedEquipmentIds = new Set((existingAlerts || []).map((a: { equipment_id: string }) => a.equipment_id));

        // 4. Get notification recipients from settings
        const { data: recipientsSetting } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'proactive_maint_recipients')
            .single();
        
        const recipientNames: string[] = Array.isArray(recipientsSetting?.value) 
            ? recipientsSetting.value as string[]
            : [];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // 5. Evaluate each equipment
        for (const eq of equipment as EquipmentRow[]) {
            // Skip if already has active alert
            if (alertedEquipmentIds.has(eq.id)) {
                skipped++;
                continue;
            }

            // Find maintenance rule for this equipment type
            const rule = EQUIPMENT_MAINTENANCE_RULES[eq.equipment_type as keyof typeof EQUIPMENT_MAINTENANCE_RULES];
            if (!rule) continue; // No rule for this type

            const recommendedMonths = rule.frequency_months;
            const schedules = schedulesByEquipment[eq.id] || [];

            // Find the last completed service date
            let lastServiceDate: Date | null = null;

            // Check completed schedules
            const completedSchedules = schedules
                .filter(s => s.status === 'completed' && s.completed_at)
                .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());

            if (completedSchedules.length > 0) {
                lastServiceDate = new Date(completedSchedules[0].completed_at!);
            }

            // Also check last_service_date on any schedule (may be more recent)
            const withLastService = schedules
                .filter(s => s.last_service_date)
                .sort((a, b) => new Date(b.last_service_date!).getTime() - new Date(a.last_service_date!).getTime());

            if (withLastService.length > 0) {
                const lsd = new Date(withLastService[0].last_service_date!);
                if (!lastServiceDate || lsd > lastServiceDate) {
                    lastServiceDate = lsd;
                }
            }

            // If no maintenance history at all, skip (we can't determine overdue)
            if (!lastServiceDate) continue;

            // Calculate expected next service date
            const expectedNext = new Date(lastServiceDate);
            expectedNext.setMonth(expectedNext.getMonth() + recommendedMonths);
            expectedNext.setDate(expectedNext.getDate() + GRACE_DAYS);

            // If not overdue yet, skip
            if (expectedNext > today) continue;

            // Check if there's a future pending schedule (already has something planned)
            const hasFutureSchedule = schedules.some(s => 
                !['completed', 'cancelled'].includes(s.status) && 
                s.next_service_date >= todayStr
            );

            if (hasFutureSchedule) {
                skipped++;
                continue;
            }

            // Calculate days overdue (from when it should have been done)
            const expectedWithoutGrace = new Date(lastServiceDate);
            expectedWithoutGrace.setMonth(expectedWithoutGrace.getMonth() + recommendedMonths);
            const daysOverdue = Math.floor((today.getTime() - expectedWithoutGrace.getTime()) / (1000 * 60 * 60 * 24));

            const clientData = eq.client as { company_name: string; phone: string | null } | null;

            // 6. Create proactive alert
            const { error: insertErr } = await supabase.from('proactive_maintenance_alerts').insert({
                equipment_id: eq.id,
                client_id: eq.client_id,
                equipment_name: eq.name,
                client_name: clientData?.company_name || 'Cliente sin nombre',
                client_phone: clientData?.phone || null,
                equipment_type: eq.equipment_type,
                last_service_date: lastServiceDate.toISOString().split('T')[0],
                days_overdue: daysOverdue,
                recommended_months: recommendedMonths,
                alert_status: 'pending',
            });

            if (insertErr) {
                console.error(`[ProactiveMaint] Error creating alert for ${eq.name}:`, insertErr.message);
                continue;
            }

            created++;

            // 7. Send internal notification to configured recipients
            if (recipientNames.length > 0) {
                const notifications = recipientNames.map(userName => ({
                    user_name: userName,
                    title: `🔧 Mantenimiento pendiente: ${eq.name}`,
                    message: `El equipo "${eq.name}" de ${clientData?.company_name || 'N/A'} lleva ${daysOverdue} días sin mantenimiento (recomendado: cada ${recommendedMonths} meses). Revisa la pestaña Proactivo en Mantenimiento.`,
                    type: 'alert',
                    icon: 'build',
                    link: '/maintenance',
                    source: 'proactive_maintenance',
                    is_read: false,
                }));

                await supabase.from('app_notifications').insert(notifications);
            }
        }

        console.log(`[ProactiveMaint] Check complete: ${created} new alerts, ${skipped} skipped`);
    } catch (err) {
        console.error('[ProactiveMaint] Unexpected error:', err);
    }

    return { created, skipped };
}
