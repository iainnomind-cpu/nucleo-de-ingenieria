// ============================================================
// Helper para disparar automatizaciones WhatsApp
// Se llama desde los módulos cuando ocurre un evento
// ============================================================

import { supabase } from './supabase';

interface TriggerPayload {
    module: string;       // 'projects', 'repairs', 'maintenance', etc.
    event: string;        // 'status_change', 'created', 'completed', etc.
    condition?: Record<string, string>;  // { new_status: 'approved' }
    record: Record<string, unknown>;     // Datos del registro para mapear variables
    referenceId?: string; // ID del registro que disparó el evento
}

/**
 * Busca reglas activas que coincidan con el módulo+evento+condición
 * y envía WhatsApp a los destinatarios configurados.
 * 
 * Ejemplo de uso:
 * ```ts
 * await triggerWaAutomation({
 *   module: 'projects',
 *   event: 'status_change',
 *   condition: { new_status: 'completed' },
 *   record: { title: 'Pozo Alfa', project_number: 'P-001', client_name: 'Pemex' },
 *   referenceId: project.id,
 * });
 * ```
 */
export async function triggerWaAutomation(payload: TriggerPayload): Promise<void> {
    try {
        // 1. Buscar reglas activas para este módulo + evento
        const { data: rules } = await supabase
            .from('wa_automation_rules')
            .select('*, template:wa_templates(*)')
            .eq('trigger_module', payload.module)
            .eq('trigger_event', payload.event)
            .eq('is_active', true);

        if (!rules || rules.length === 0) return;

        // 2. Filtrar por condición
        const matchingRules = rules.filter((rule: any) => {
            if (!rule.trigger_condition || Object.keys(rule.trigger_condition).length === 0) return true;
            return Object.entries(rule.trigger_condition as Record<string, string>).every(
                ([key, value]) => !value || (payload.condition && payload.condition[key] === value)
            );
        });

        if (matchingRules.length === 0) return;

        // 3. Para cada regla, obtener destinatarios y enviar
        for (const rule of matchingRules) {
            const phones: { phone: string; name: string }[] = [];

            // Obtener teléfonos de users
            if (rule.recipient_user_ids?.length > 0) {
                const { data: users } = await supabase
                    .from('app_users')
                    .select('full_name, phone')
                    .in('id', rule.recipient_user_ids);
                if (users) {
                    users.forEach((u: any) => {
                        if (u.phone) phones.push({ phone: u.phone, name: u.full_name });
                    });
                }
            }

            // Agregar teléfonos fijos
            if (rule.custom_phones?.length > 0) {
                rule.custom_phones.forEach((p: string) => {
                    phones.push({ phone: p, name: 'Teléfono adicional' });
                });
            }

            // Agregar cliente si la regla lo requiere
            if (rule.send_to_client) {
                let clientPhone = '';
                let clientName = 'Cliente';

                if (payload.record.client_phone) {
                    clientPhone = String(payload.record.client_phone);
                    clientName = String(payload.record.client_name || 'Cliente');
                } else if (payload.referenceId) {
                    const moduleTableMap: Record<string, string> = {
                        projects: 'projects',
                        quotes: 'quotes',
                        repairs: 'repairs',
                        invoices: 'invoices',
                        maintenance: 'maintenance_schedules',
                    };
                    const tableName = moduleTableMap[payload.module];
                    if (tableName) {
                        try {
                            const { data: refData } = await supabase
                                .from(tableName)
                                .select('client:clients(id, phone, company_name)')
                                .eq('id', payload.referenceId)
                                .single();
                            if ((refData?.client as any)?.phone) {
                                clientPhone = (refData.client as any).phone;
                                clientName = (refData.client as any).company_name || 'Cliente';
                            }
                        } catch (e) {
                            console.error('Error fetching client phone for automation', e);
                        }
                    }
                }

                if (clientPhone) {
                    phones.push({ phone: clientPhone, name: clientName });
                }
            }

            if (phones.length === 0) continue;

            // 4. Construir variables de la plantilla
            const template = rule.template;
            if (!template) continue;

            const templateName = template.meta_name || template.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            const varValues = (template.variables || []).map((_: string, idx: number) => {
                const mapping = rule.variable_mapping?.[String(idx + 1)];
                if (!mapping) return '';
                // Resolver mapping: "record.title" → payload.record.title
                if (mapping.startsWith('record.')) {
                    const key = mapping.replace('record.', '');
                    return String(payload.record[key] || '') ;
                }
                return mapping; // Texto fijo
            });

            // 5. Enviar a cada destinatario
            for (const recipient of phones) {
                try {
                    const res = await fetch('/api/whatsapp-send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: recipient.phone,
                            type: 'template',
                            template_name: templateName,
                            language: template.language || 'es_MX',
                            variables: varValues.length > 0 ? varValues : undefined,
                        }),
                    });
                    const data = await res.json();

                    // Log
                    await supabase.from('wa_automation_log').insert({
                        rule_id: rule.id,
                        recipient_phone: recipient.phone,
                        recipient_name: recipient.name,
                        template_name: templateName,
                        variables_sent: varValues,
                        reference_type: payload.module,
                        reference_id: payload.referenceId || null,
                        status: data.success ? 'sent' : 'failed',
                        error_message: data.success ? null : (data.message || 'Error desconocido'),
                    });

                    // Update counters
                    if (data.success) {
                        await supabase.from('wa_automation_rules').update({ 
                            total_sent: (rule.total_sent || 0) + 1,
                            last_triggered_at: new Date().toISOString(),
                        }).eq('id', rule.id);
                    } else {
                        await supabase.from('wa_automation_rules').update({ 
                            total_failed: (rule.total_failed || 0) + 1,
                            last_triggered_at: new Date().toISOString(),
                        }).eq('id', rule.id);
                    }
                } catch (err) {
                    console.error('[WA Automation] Error sending to', recipient.phone, err);
                    await supabase.from('wa_automation_log').insert({
                        rule_id: rule.id,
                        recipient_phone: recipient.phone,
                        recipient_name: recipient.name,
                        template_name: templateName,
                        variables_sent: varValues,
                        reference_type: payload.module,
                        reference_id: payload.referenceId || null,
                        status: 'failed',
                        error_message: 'Error de red',
                    });
                }

                // Small delay between sends
                await new Promise(r => setTimeout(r, 300));
            }
        }
    } catch (err) {
        console.error('[WA Automation] triggerWaAutomation error:', err);
    }
}
