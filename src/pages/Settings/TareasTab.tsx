import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { WaTemplate, META_STATUS_LABELS,
    TemplateCategory, MetaStatus, TemplateHeaderType,
    TEMPLATE_CATEGORY_LABELS, META_STATUS_COLORS, TEMPLATE_CATEGORY_ICONS,
} from '../../types/whatsapp';

// ─── Types ───
interface AppUser { id: string; full_name: string; email: string; phone: string | null; avatar_color: string | null; }

interface AutoRule {
    id: string; name: string; description: string | null;
    trigger_module: string; trigger_event: string; trigger_condition: Record<string, unknown>;
    template_id: string; recipient_user_ids: string[]; custom_phones: string[];
    variable_mapping: Record<string, string>;
    is_active: boolean; total_sent: number; total_failed: number;
    last_triggered_at: string | null; created_at: string;
    template?: WaTemplate;
}

interface AutoLog {
    id: string; rule_id: string; recipient_phone: string; recipient_name: string | null;
    template_name: string | null; variables_sent: unknown[]; reference_type: string | null;
    reference_id: string | null; status: string; error_message: string | null; created_at: string;
}

// ─── Constants ───
const TRIGGER_MODULES: { key: string; label: string; icon: string; events: { key: string; label: string; conditionOptions?: { key: string; label: string; values: { value: string; label: string }[] }[] }[] }[] = [
    { key: 'projects', label: 'Proyectos', icon: 'engineering', events: [
        { key: 'status_change', label: 'Cambio de Estado', conditionOptions: [{ key: 'new_status', label: 'Nuevo Estado', values: [
            { value: 'preparation', label: 'Preparación' }, { value: 'in_field', label: 'En Campo' },
            { value: 'completed', label: 'Completado' }, { value: 'invoiced', label: 'Facturado' },
        ]}]},
        { key: 'created', label: 'Proyecto Creado' },
    ]},
    { key: 'repairs', label: 'Reparaciones', icon: 'construction', events: [
        { key: 'status_change', label: 'Cambio de Estado', conditionOptions: [{ key: 'new_status', label: 'Nuevo Estado', values: [
            { value: 'picked_up', label: 'Recogido' }, { value: 'sent_to_provider', label: 'Enviado a Proveedor' },
            { value: 'diagnosis_received', label: 'Diagnóstico Recibido' }, { value: 'quoted', label: 'Cotizado' },
            { value: 'authorized', label: 'Autorizado' }, { value: 'in_repair', label: 'En Reparación' },
            { value: 'return_shipped', label: 'Regreso Enviado' }, { value: 'delivered', label: 'Entregado' },
            { value: 'invoiced', label: 'Facturado' }, { value: 'completed', label: 'Completado' },
        ]}]},
        { key: 'created', label: 'Reparación Reportada' },
    ]},
    { key: 'maintenance', label: 'Mantenimiento', icon: 'build', events: [
        { key: 'upcoming', label: 'Mantenimiento Próximo' },
        { key: 'completed', label: 'Mantenimiento Completado' },
    ]},
    { key: 'quotes', label: 'Cotizaciones', icon: 'request_quote', events: [
        { key: 'approved', label: 'Cotización Aprobada' },
        { key: 'created', label: 'Cotización Creada' },
    ]},
    { key: 'invoices', label: 'Facturas', icon: 'receipt_long', events: [
        { key: 'created', label: 'Factura Generada' },
        { key: 'overdue', label: 'Factura Vencida' },
    ]},
    { key: 'fleet', label: 'Flotilla', icon: 'local_shipping', events: [
        { key: 'created', label: 'Viaje Registrado' },
    ]},
];

const VARIABLE_SUGGESTIONS: Record<string, { label: string; path: string }[]> = {
    projects: [
        { label: 'Título del Proyecto', path: 'record.title' },
        { label: 'No. Proyecto', path: 'record.project_number' },
        { label: 'Cliente', path: 'record.client_name' },
        { label: 'Estado', path: 'record.status_label' },
        { label: 'Responsable', path: 'record.project_manager' },
    ],
    repairs: [
        { label: 'Equipo', path: 'record.equipment_name' },
        { label: 'Cliente', path: 'record.client_name' },
        { label: 'Falla', path: 'record.failure_description' },
        { label: 'Estado', path: 'record.status_label' },
        { label: 'Proveedor', path: 'record.external_provider' },
        { label: 'Guía Envío', path: 'record.tracking_number_to' },
    ],
    maintenance: [
        { label: 'Equipo', path: 'record.equipment_name' },
        { label: 'Tipo Servicio', path: 'record.service_type' },
        { label: 'Fecha', path: 'record.scheduled_date' },
    ],
    quotes: [
        { label: 'No. Cotización', path: 'record.quote_number' },
        { label: 'Cliente', path: 'record.client_name' },
        { label: 'Monto', path: 'record.total_amount' },
    ],
    invoices: [
        { label: 'No. Factura', path: 'record.invoice_number' },
        { label: 'Cliente', path: 'record.client_name' },
        { label: 'Monto', path: 'record.amount' },
        { label: 'Vencimiento', path: 'record.due_date' },
    ],
    fleet: [
        { label: 'Vehículo', path: 'record.vehicle_name' },
        { label: 'Conductor', path: 'record.driver_name' },
        { label: 'Destino', path: 'record.destination' },
    ],
};


const AVAILABLE_VARIABLES = [
    { id: 'client_name', label: 'Nombre Cliente' },
    { id: 'company_name', label: 'Empresa' },
    { id: 'service_date', label: 'Fecha Servicio' },
    { id: 'service_time', label: 'Hora Servicio' },
    { id: 'service_type', label: 'Tipo Servicio' },
    { id: 'invoice_amount', label: 'Monto' },
    { id: 'invoice_due', label: 'Vencimiento' },
    { id: 'technician_name', label: 'Técnico' },
];

export default function TareasTab() {
    const navigate = useNavigate();
    const [rules, setRules] = useState<AutoRule[]>([]);
    const [templates, setTemplates] = useState<WaTemplate[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [logs, setLogs] = useState<AutoLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showLogs, setShowLogs] = useState<string | null>(null);

    // Form wizard state
    const [formStep, setFormStep] = useState(0);
    const [form, setForm] = useState({
        name: '', description: '',
        trigger_module: '', trigger_event: '', trigger_condition: {} as Record<string, string>,
        template_id: '',
        recipient_user_ids: [] as string[], custom_phones: [] as string[],
        variable_mapping: {} as Record<string, string>,
    });
    const [customPhoneInput, setCustomPhoneInput] = useState('');
    // Template creation internal state
    const [showTemplateForm, setShowTemplateForm] = useState(false);
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [syncingStatus, setSyncingStatus] = useState(false);
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
    const [formTemplate, setFormTemplate] = useState({
        name: '', category: 'utility' as TemplateCategory, language: 'es_MX',
        header_type: 'none' as TemplateHeaderType, header_content: '',
        body: '', footer: '', variables: '', meta_status: 'draft' as MetaStatus,
    });


    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [rRes, tRes, uRes] = await Promise.all([
            supabase.from('wa_automation_rules').select('*, template:wa_templates(*)').order('created_at', { ascending: false }),
            supabase.from('wa_templates').select('*').eq('usage_type', 'team').order('name'),
            supabase.from('app_users').select('id, full_name, email, phone, avatar_color').not('phone', 'is', null).order('full_name'),
        ]);
        setRules((rRes.data as AutoRule[]) || []);
        setTemplates((tRes.data as WaTemplate[]) || []);
        setUsers((uRes.data as AppUser[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const fetchLogs = async (ruleId: string) => {
        const { data } = await supabase.from('wa_automation_log').select('*').eq('rule_id', ruleId).order('created_at', { ascending: false }).limit(50);
        setLogs((data as AutoLog[]) || []);
        setShowLogs(ruleId);
    };

    
    // --- TEMPLATE FUNCTIONS ---
    const resetTemplateForm = () => setFormTemplate({ name: '', category: 'utility', language: 'es_MX', header_type: 'none', header_content: '', body: '', footer: '', variables: '', meta_status: 'draft' });

    const processBodyForSave = (bodyText: string) => {
        let finalBody = bodyText;
        const matches = bodyText.match(/\{\{([^}]+)\}\}/g);
        const uniqueVars: string[] = [];
        if (matches) {
            matches.forEach(m => {
                const varName = m.replace(/\{\{|\}\}/g, '').trim();
                if (!uniqueVars.includes(varName)) uniqueVars.push(varName);
            });
            uniqueVars.forEach((varName, idx) => {
                const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\{\{${escaped}\}\}`, 'g');
                finalBody = finalBody.replace(regex, `{{${idx + 1}}}`);
            });
        }
        return { finalBody, finalVariables: uniqueVars };
    };

    const handleSaveTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        const { finalBody, finalVariables } = processBodyForSave(formTemplate.body);
        const payload = {
            name: formTemplate.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'), category: formTemplate.category, language: formTemplate.language,
            header_type: formTemplate.header_type !== 'none' ? formTemplate.header_type : null, header_content: formTemplate.header_content || null,
            body: finalBody, footer: formTemplate.footer || null, variables: finalVariables, usage_type: 'team', meta_status: formTemplate.meta_status,
        };
        if (editingTemplateId) {
            await supabase.from('wa_templates').update(payload).eq('id', editingTemplateId);
        } else {
            await supabase.from('wa_templates').insert(payload);
        }
        setShowTemplateForm(false); setEditingTemplateId(null); resetTemplateForm(); fetchAll();
    };

    const submitToMeta = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de enviar la plantilla "${name}" a Meta?`)) return;
        setSubmittingId(id);
        try {
            const res = await fetch('/api/whatsapp-template-submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: id }) });
            const data = await res.json();
            if (data.success) { alert('¡Plantilla enviada exitosamente a revisión!'); fetchAll(); } 
            else { alert(`Meta API Error: ${data.message}`); }
        } catch (error) { alert('Error de red al intentar enviar.'); } finally { setSubmittingId(null); }
    };

    const syncStatusFromMeta = async () => {
        setSyncingStatus(true);
        try {
            const res = await fetch('/api/whatsapp-template-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            const data = await res.json();
            if (data.success) { alert(`✅ ${data.message}`); fetchAll(); } else { alert(`❌ Error: ${data.message}`); }
        } catch (error) { alert('Error de red al sincronizar.'); } finally { setSyncingStatus(false); }
    };
    // -------------------------

    const resetForm = () => {
        setForm({ name: '', description: '', trigger_module: '', trigger_event: '', trigger_condition: {}, template_id: '', recipient_user_ids: [], custom_phones: [], variable_mapping: {} });
        setCustomPhoneInput('');
        setFormStep(0);
        setEditingId(null);
    };

    const handleSave = async () => {
        const payload = {
            name: form.name, description: form.description || null,
            trigger_module: form.trigger_module, trigger_event: form.trigger_event,
            trigger_condition: form.trigger_condition, template_id: form.template_id,
            recipient_user_ids: form.recipient_user_ids, custom_phones: form.custom_phones,
            variable_mapping: form.variable_mapping,
        };
        if (editingId) {
            await supabase.from('wa_automation_rules').update(payload).eq('id', editingId);
        } else {
            await supabase.from('wa_automation_rules').insert(payload);
        }
        setShowForm(false);
        resetForm();
        fetchAll();
    };

    const toggleActive = async (id: string, active: boolean) => {
        await supabase.from('wa_automation_rules').update({ is_active: !active }).eq('id', id);
        fetchAll();
    };

    const deleteRule = async (id: string) => {
        if (!confirm('¿Eliminar esta regla de automatización?')) return;
        await supabase.from('wa_automation_rules').delete().eq('id', id);
        fetchAll();
    };

    const editRule = (r: AutoRule) => {
        setForm({
            name: r.name, description: r.description || '',
            trigger_module: r.trigger_module, trigger_event: r.trigger_event,
            trigger_condition: r.trigger_condition as Record<string, string>,
            template_id: r.template_id, recipient_user_ids: r.recipient_user_ids || [],
            custom_phones: r.custom_phones || [], variable_mapping: r.variable_mapping,
        });
        setEditingId(r.id);
        setFormStep(0);
        setShowForm(true);
    };

    // Helpers
    const selectedModule = TRIGGER_MODULES.find(m => m.key === form.trigger_module);
    const selectedEvent = selectedModule?.events.find(e => e.key === form.trigger_event);
    const selectedTemplate = templates.find(t => t.id === form.template_id);
    const suggestions = VARIABLE_SUGGESTIONS[form.trigger_module] || [];

    const toggleUser = (uid: string) => {
        setForm(prev => ({
            ...prev,
            recipient_user_ids: prev.recipient_user_ids.includes(uid)
                ? prev.recipient_user_ids.filter(id => id !== uid)
                : [...prev.recipient_user_ids, uid],
        }));
    };

    const addCustomPhone = () => {
        const phone = customPhoneInput.replace(/\D/g, '');
        if (phone.length >= 10 && !form.custom_phones.includes(phone)) {
            setForm(prev => ({ ...prev, custom_phones: [...prev.custom_phones, phone] }));
            setCustomPhoneInput('');
        }
    };

    const removeCustomPhone = (phone: string) => {
        setForm(prev => ({ ...prev, custom_phones: prev.custom_phones.filter(p => p !== phone) }));
    };

    const renderBody = (body: string, vars?: string[]) => {
        let html = body;
        if (vars?.length) {
            vars.forEach((v, i) => {
                html = html.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), `<span class="inline-block rounded bg-emerald-100 px-1 text-emerald-700 font-mono text-xs dark:bg-emerald-900/30 dark:text-emerald-400">{{${v}}}</span>`);
            });
        }
        return html;
    };

    
    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5';

    const stepLabels = ['Activador', 'Plantilla', 'Destinatarios', 'Variables'];

    if (loading) return <div className="flex flex-1 items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" /></div>;

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                         <span className="material-symbols-outlined text-emerald-500">bolt</span>
                         Automatizaciones Internas
                    </h3>
                    <p className="text-sm text-slate-500">Notificaciones de equipo vía WhatsApp cuando ocurren eventos en los módulos</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={syncStatusFromMeta} disabled={syncingStatus}
                        className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 hover:bg-sky-100 transition-all disabled:opacity-50 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-400 dark:hover:bg-sky-900/40">
                        {syncingStatus ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
                        ) : (
                            <span className="material-symbols-outlined text-[18px]">sync</span>
                        )}
                        {syncingStatus ? 'Sincronizando...' : 'Refrescar Estados'}
                    </button>
                    <button onClick={() => { setShowTemplateForm(true); setEditingTemplateId(null); resetTemplateForm(); }}
                        className="flex items-center gap-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 px-4 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 transition-all">
                        <span className="material-symbols-outlined text-[18px]">post_add</span>Nueva Plantilla
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        Nueva Regla
                    </button>
                </div>
            </div>

            <div className="p-6">
                {/* Rules List */}
                {rules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <span className="material-symbols-outlined text-[64px] mb-4">bolt</span>
                        <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">Sin automatizaciones</p>
                        <p className="text-sm mt-1">Crea reglas para notificar al equipo por WhatsApp cuando sucedan eventos</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {rules.map(rule => {
                            const mod = TRIGGER_MODULES.find(m => m.key === rule.trigger_module);
                            const evt = mod?.events.find(e => e.key === rule.trigger_event);
                            const conditionLabel = rule.trigger_condition?.new_status ? ` → ${rule.trigger_condition.new_status}` : '';
                            return (
                                <div key={rule.id} className={`rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-slate-900 group transition-all ${rule.is_active ? 'border-slate-200 dark:border-slate-800' : 'border-slate-100 dark:border-slate-800 opacity-60'}`}>
                                    <div className="p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${rule.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                    <span className={`material-symbols-outlined text-[16px] ${rule.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>{mod?.icon || 'bolt'}</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{rule.name}</p>
                                                    {rule.description && <p className="text-[10px] text-slate-400 line-clamp-1">{rule.description}</p>}
                                                </div>
                                            </div>
                                            <button onClick={() => toggleActive(rule.id, rule.is_active)}
                                                className={`relative h-6 w-11 rounded-full transition-all ${rule.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${rule.is_active ? 'left-[22px]' : 'left-0.5'}`} />
                                            </button>
                                        </div>

                                        {/* Trigger */}
                                        <div className="flex items-center gap-2 mb-2 text-xs">
                                            <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">{mod?.label}</span>
                                            <span className="text-slate-400">→</span>
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{evt?.label}{conditionLabel}</span>
                                        </div>

                                        {/* Template preview */}
                                        {rule.template && (
                                            <div className="rounded-lg bg-slate-50 p-2.5 border-l-4 border-emerald-500 dark:bg-slate-800 mb-2">
                                                <p className="text-[10px] font-bold text-emerald-600 mb-0.5">{rule.template.name}</p>
                                                <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderBody(rule.template.body, rule.template.variables) }} />
                                            </div>
                                        )}

                                        {/* Recipients count */}
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">group</span>{(rule.recipient_user_ids?.length || 0) + (rule.custom_phones?.length || 0)} destinatarios</span>
                                            <span>·</span>
                                            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">send</span>{rule.total_sent} enviados</span>
                                            {rule.total_failed > 0 && <><span>·</span><span className="text-red-400">{rule.total_failed} fallidos</span></>}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center border-t border-slate-100 dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-all">
                                        <button onClick={() => editRule(rule)} className="flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10">
                                            <span className="material-symbols-outlined text-[14px]">edit</span>Editar
                                        </button>
                                        <button onClick={() => fetchLogs(rule.id)} className="flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/10">
                                            <span className="material-symbols-outlined text-[14px]">history</span>Historial
                                        </button>
                                        <button onClick={() => deleteRule(rule.id)} className="flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10">
                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500">bolt</span>
                                {editingId ? 'Editar Regla' : 'Nueva Automatización'}
                            </h3>
                            <button onClick={() => { setShowForm(false); resetForm(); }} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        {/* Step indicator */}
                        <div className="flex items-center gap-2 mb-6">
                            {stepLabels.map((label, i) => (
                                <button key={i} onClick={() => setFormStep(i)}
                                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${formStep === i
                                        ? 'bg-emerald-500 text-white shadow-md'
                                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">{i + 1}</span>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Step 0: Trigger */}
                        {formStep === 0 && (
                            <div className="space-y-4">
                                <div><label className={labelClass}>Nombre de la Regla *</label>
                                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Notificar Finanzas al aprobar proyecto" className={inputClass} />
                                </div>
                                <div><label className={labelClass}>Descripción</label>
                                    <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descripción breve..." className={inputClass} />
                                </div>
                                <div><label className={labelClass}>Módulo (¿Dónde sucede el evento?)</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {TRIGGER_MODULES.map(m => (
                                            <button key={m.key} type="button"
                                                onClick={() => setForm({ ...form, trigger_module: m.key, trigger_event: '', trigger_condition: {} })}
                                                className={`flex items-center gap-2 rounded-lg border-2 p-3 text-xs font-semibold transition-all ${form.trigger_module === m.key ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-400' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}>
                                                <span className="material-symbols-outlined text-[18px]">{m.icon}</span>{m.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {selectedModule && (
                                    <div><label className={labelClass}>Evento (¿Qué debe pasar?)</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {selectedModule.events.map(ev => (
                                                <button key={ev.key} type="button"
                                                    onClick={() => setForm({ ...form, trigger_event: ev.key, trigger_condition: {} })}
                                                    className={`rounded-lg border-2 p-3 text-xs font-semibold transition-all text-left ${form.trigger_event === ev.key ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/10 dark:text-amber-400' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}>
                                                    {ev.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {selectedEvent?.conditionOptions && selectedEvent.conditionOptions.map(opt => (
                                    <div key={opt.key}><label className={labelClass}>{opt.label}</label>
                                        <select value={(form.trigger_condition as Record<string, string>)[opt.key] || ''} onChange={e => setForm({ ...form, trigger_condition: { ...form.trigger_condition, [opt.key]: e.target.value } })} className={inputClass}>
                                            <option value="">-- Cualquier valor --</option>
                                            {opt.values.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                                        </select>
                                    </div>
                                ))}
                                <div className="flex justify-end">
                                    <button onClick={() => setFormStep(1)} disabled={!form.name || !form.trigger_module || !form.trigger_event}
                                        className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Siguiente →</button>
                                </div>
                            </div>
                        )}

                        {/* Step 1: Template */}
                        {formStep === 1 && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-500">Solo se muestran plantillas <strong>aprobadas</strong> por Meta</p>
                                {templates.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400">
                                        <p className="font-semibold">No hay plantillas aprobadas</p>
                                        <button onClick={() => navigate('/whatsapp/templates')} className="mt-2 text-emerald-500 text-sm font-semibold">Ir a Plantillas</button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto">
                                        {templates.map(tpl => {
                                            const isSelectable = tpl.meta_status === 'approved';
                                            return (
                                            <div key={tpl.id}
                                                onClick={() => isSelectable && setForm({ ...form, template_id: tpl.id })}
                                                className={`text-left rounded-xl border-2 p-4 transition-all flex flex-col justify-between ${form.template_id === tpl.id ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-100 bg-white dark:bg-slate-800 dark:border-slate-700'} ${isSelectable ? 'cursor-pointer hover:border-emerald-300' : 'opacity-80 cursor-not-allowed'}`}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{tpl.name}</p>
                                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{META_STATUS_LABELS[tpl.meta_status]}</span>
                                                </div>
                                                <div className="rounded-lg bg-slate-50 p-2 border-l-4 border-emerald-500 dark:bg-slate-700/50">
                                                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderBody(tpl.body, tpl.variables) }} />
                                                </div>
                                                {tpl.variables?.length > 0 && <div className="mt-2 flex gap-1 flex-wrap">{tpl.variables.map((v, i) => <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">{v}</span>)}</div>}
                                                {(tpl.meta_status === 'draft' || tpl.meta_status === 'rejected') && (
                                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); submitToMeta(tpl.id, tpl.name); }} disabled={submittingId === tpl.id} className="flex items-center gap-1 rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-400 transition-all">
                                                            {submittingId === tpl.id ? 'Enviando...' : 'Enviar a Revisión Meta'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                        })}
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <button onClick={() => setFormStep(0)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 dark:border-slate-700">← Atrás</button>
                                    <button onClick={() => setFormStep(2)} disabled={!form.template_id} className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Siguiente →</button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Recipients */}
                        {formStep === 2 && (
                            <div className="space-y-4">
                                <div>
                                    <label className={labelClass}>Miembros del Equipo (con teléfono registrado)</label>
                                    <div className="space-y-1 max-h-[250px] overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                                        {users.length === 0 ? <p className="py-4 text-center text-xs text-slate-400">Ningún usuario tiene teléfono registrado</p> : users.map(u => (
                                            <label key={u.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/30 ${form.recipient_user_ids.includes(u.id) ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                                                <input type="checkbox" checked={form.recipient_user_ids.includes(u.id)} onChange={() => toggleUser(u.id)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full text-white text-[10px] font-bold" style={{ background: u.avatar_color || '#6366f1' }}>
                                                    {u.full_name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{u.full_name}</p>
                                                    <p className="text-[10px] text-slate-400">{u.phone}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>Teléfonos Adicionales</label>
                                    <div className="flex gap-2">
                                        <input value={customPhoneInput} onChange={e => setCustomPhoneInput(e.target.value)} placeholder="52 1234567890" className={inputClass} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomPhone())} />
                                        <button type="button" onClick={addCustomPhone} className="rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">+</button>
                                    </div>
                                    {form.custom_phones.length > 0 && (
                                        <div className="mt-2 flex gap-1 flex-wrap">
                                            {form.custom_phones.map(p => (
                                                <span key={p} className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                                                    {p}<button onClick={() => removeCustomPhone(p)} className="ml-1 text-sky-400 hover:text-sky-700">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-between">
                                    <button onClick={() => setFormStep(1)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 dark:border-slate-700">← Atrás</button>
                                    <button onClick={() => setFormStep(3)} disabled={form.recipient_user_ids.length === 0 && form.custom_phones.length === 0}
                                        className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Siguiente →</button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Variable Mapping */}
                        {formStep === 3 && (
                            <div className="space-y-4">
                                {selectedTemplate?.variables && selectedTemplate.variables.length > 0 ? (
                                    <>
                                        <p className="text-sm text-slate-500">Mapea cada variable de la plantilla con un dato del evento</p>
                                        <div className="space-y-3">
                                            {selectedTemplate.variables.map((v, i) => (
                                                <div key={i} className="flex items-center gap-3">
                                                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 whitespace-nowrap">{`{{${v}}}`}</span>
                                                    <span className="material-symbols-outlined text-slate-300 text-[16px]">arrow_forward</span>
                                                    <select value={form.variable_mapping[String(i + 1)] || ''} onChange={e => setForm({ ...form, variable_mapping: { ...form.variable_mapping, [String(i + 1)]: e.target.value } })} className={inputClass}>
                                                        <option value="">-- Seleccionar dato --</option>
                                                        {suggestions.map(s => <option key={s.path} value={s.path}>{s.label}</option>)}
                                                        <option value="custom">Texto fijo...</option>
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-8 text-center text-slate-400">
                                        <span className="material-symbols-outlined text-[40px] mb-2">check_circle</span>
                                        <p className="text-sm font-semibold">Esta plantilla no usa variables</p>
                                        <p className="text-xs mt-1">Se enviará el mensaje tal cual</p>
                                    </div>
                                )}

                                {/* Summary */}
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800/40 dark:bg-emerald-900/10">
                                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2">Resumen de la Regla</p>
                                    <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                                        <p>📌 <strong>{form.name}</strong></p>
                                        <p>⚡ Cuando: <strong>{selectedModule?.label}</strong> → <strong>{selectedEvent?.label}</strong>{form.trigger_condition?.new_status ? ` = ${form.trigger_condition.new_status}` : ''}</p>
                                        <p>📝 Plantilla: <strong>{selectedTemplate?.name}</strong></p>
                                        <p>👥 Destinatarios: <strong>{form.recipient_user_ids.length}</strong> usuarios + <strong>{form.custom_phones.length}</strong> teléfonos</p>
                                    </div>
                                </div>

                                <div className="flex justify-between">
                                    <button onClick={() => setFormStep(2)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 dark:border-slate-700">← Atrás</button>
                                    <button onClick={handleSave} className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25">
                                        {editingId ? 'Guardar Cambios' : 'Crear Automatización'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Logs Modal */}
            {showLogs && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Historial de Envíos</h3>
                            <button onClick={() => setShowLogs(null)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        {logs.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">Sin envíos registrados</p> : (
                            <div className="space-y-2">
                                {logs.map(log => (
                                    <div key={log.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${log.status === 'sent' ? 'bg-emerald-50/50 dark:bg-emerald-900/5' : 'bg-red-50/50 dark:bg-red-900/5'}`}>
                                        <span className={`material-symbols-outlined text-[16px] ${log.status === 'sent' ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {log.status === 'sent' ? 'check_circle' : 'error'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-slate-900 dark:text-white">{log.recipient_name || log.recipient_phone}</p>
                                            <p className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleString('es-MX')}</p>
                                        </div>
                                        {log.error_message && <p className="text-[10px] text-red-500 max-w-[160px] truncate">{log.error_message}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Template Form Modal */}
            {showTemplateForm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
                    <form onSubmit={handleSaveTemplate} className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
                        <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500">description</span> {editingTemplateId ? 'Editar Plantilla' : 'Nueva Plantilla Rápida'}</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className={labelClass}>Nombre (minúsculas, sin espacios) *</label>
                                <input value={formTemplate.name} onChange={e => setFormTemplate({ ...formTemplate, name: e.target.value })} required className={inputClass} placeholder="notificacion_demo_1" />
                            </div>
                            <div>
                                <label className={labelClass}>Categoría</label>
                                <select value={formTemplate.category} onChange={e => setFormTemplate({ ...formTemplate, category: e.target.value as TemplateCategory })} className={inputClass}>
                                    {(Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[]).map(c => (
                                        <option key={c} value={c}>{TEMPLATE_CATEGORY_LABELS[c]}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Idioma</label>
                                <select value={formTemplate.language} onChange={e => setFormTemplate({ ...formTemplate, language: e.target.value })} className={inputClass}>
                                    <option value="es_MX">Español (MX)</option>
                                    <option value="es">Español</option>
                                    <option value="en_US">English (US)</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Header</label>
                                <select value={formTemplate.header_type} onChange={e => setFormTemplate({ ...formTemplate, header_type: e.target.value as TemplateHeaderType })} className={inputClass}>
                                    <option value="none">Sin Header</option>
                                    <option value="text">Texto</option>
                                    <option value="image">Imagen URL</option>
                                    <option value="document">Documento URL</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Estado</label>
                                <input value={formTemplate.meta_status} disabled className={`${inputClass} bg-slate-50 opacity-50`} />
                            </div>
                            {formTemplate.header_type !== 'none' && (
                                <div className="col-span-2">
                                    <label className={labelClass}>Contenido del Header</label>
                                    <input value={formTemplate.header_content} onChange={e => setFormTemplate({ ...formTemplate, header_content: e.target.value })} className={inputClass} placeholder="Título o enlace..." />
                                </div>
                            )}
                            <div className="col-span-2">
                                <label className={labelClass}>Cuerpo del Mensaje * (Usa {'{{Variables}}'} dando click abajo)</label>
                                <textarea value={formTemplate.body} onChange={e => setFormTemplate({ ...formTemplate, body: e.target.value })} required rows={4} className={inputClass} placeholder="Escribe el mensaje aquí..." />
                                <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50 p-2 dark:border-emerald-900/30 dark:bg-emerald-900/10">
                                    <p className="mb-1 text-[10px] font-bold text-emerald-700">Variables Frecuentes:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {AVAILABLE_VARIABLES.map(v => (
                                            <button key={v.id} type="button" onClick={() => setFormTemplate({ ...formTemplate, body: formTemplate.body + `{{${v.label}}}` })}
                                                className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-600 shadow-sm hover:bg-emerald-500 hover:text-white transition">
                                                {v.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className={labelClass}>Footer (opcional)</label>
                                <input value={formTemplate.footer} onChange={e => setFormTemplate({ ...formTemplate, footer: e.target.value })} className={inputClass} placeholder="Pie de página gris..." />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowTemplateForm(false)} className="rounded-lg border px-4 py-2 text-sm text-slate-500">Cancelar</button>
                            <button type="submit" className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600">Guardar Plantilla</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
