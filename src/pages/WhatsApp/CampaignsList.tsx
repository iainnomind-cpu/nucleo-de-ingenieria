import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    WaCampaign, WaCampaignStep, WaTemplate,
    CampaignType,
    CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPE_ICONS, CAMPAIGN_TYPE_COLORS,
    formatWaCurrency, getDeliveryRate, getReadRate,
} from '../../types/whatsapp';

export default function CampaignsList() {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
    const [templates, setTemplates] = useState<WaTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showSteps, setShowSteps] = useState<string | null>(null);
    const [steps, setSteps] = useState<WaCampaignStep[]>([]);
    const [form, setForm] = useState({
        name: '', description: '', campaign_type: 'maintenance_reminder' as CampaignType, is_active: true,
    });
    const [stepForm, setStepForm] = useState({
        template_id: '', step_order: 1, trigger_days: -30, send_time: '09:00', is_active: true,
    });

    const fetchCampaigns = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('wa_campaigns').select('*').order('created_at', { ascending: false });
        setCampaigns((data as WaCampaign[]) || []);
        setLoading(false);
    }, []);

    const fetchTemplates = useCallback(async () => {
        const { data } = await supabase.from('wa_templates').select('*').eq('meta_status', 'approved').order('name');
        setTemplates((data as WaTemplate[]) || []);
    }, []);

    const fetchSteps = useCallback(async (campaignId: string) => {
        const { data } = await supabase.from('wa_campaign_steps').select('*, template:wa_templates(id, name, body)').eq('campaign_id', campaignId).order('step_order');
        setSteps((data as WaCampaignStep[]) || []);
    }, []);

    useEffect(() => { fetchCampaigns(); fetchTemplates(); }, [fetchCampaigns, fetchTemplates]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            await supabase.from('wa_campaigns').update(form).eq('id', editingId);
        } else {
            await supabase.from('wa_campaigns').insert(form);
        }
        setShowForm(false); setEditingId(null);
        setForm({ name: '', description: '', campaign_type: 'maintenance_reminder', is_active: true });
        fetchCampaigns();
    };

    const editCampaign = (c: WaCampaign) => {
        setForm({ name: c.name, description: c.description || '', campaign_type: c.campaign_type, is_active: c.is_active });
        setEditingId(c.id);
        setShowForm(true);
    };

    const toggleActive = async (c: WaCampaign) => {
        await supabase.from('wa_campaigns').update({ is_active: !c.is_active }).eq('id', c.id);
        fetchCampaigns();
    };

    const deleteCampaign = async (id: string) => {
        if (!confirm('¿Eliminar esta campaña y todos sus pasos?')) return;
        await supabase.from('wa_campaigns').delete().eq('id', id);
        fetchCampaigns();
    };

    const openSteps = (campId: string) => {
        setShowSteps(campId);
        fetchSteps(campId);
    };

    const addStep = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showSteps) return;
        await supabase.from('wa_campaign_steps').insert({
            campaign_id: showSteps,
            template_id: stepForm.template_id || null,
            step_order: stepForm.step_order,
            trigger_days: stepForm.trigger_days,
            send_time: stepForm.send_time,
            is_active: stepForm.is_active,
        });
        setStepForm({ template_id: '', step_order: steps.length + 2, trigger_days: -30, send_time: '09:00', is_active: true });
        fetchSteps(showSteps);
    };

    const deleteStep = async (stepId: string) => {
        if (!showSteps) return;
        await supabase.from('wa_campaign_steps').delete().eq('id', stepId);
        fetchSteps(showSteps);
    };

    const tabs = [
        { label: 'Dashboard', icon: 'space_dashboard', path: '/whatsapp' },
        { label: 'Conversaciones', icon: 'chat', path: '/whatsapp/conversations' },
        { label: 'Envío Directo', icon: 'send', path: '/whatsapp/send' },
        { label: 'Campañas', icon: 'campaign', path: '/whatsapp/campaigns' },
        { label: 'Plantillas', icon: 'description', path: '/whatsapp/templates' },
        { label: 'Reportes', icon: 'analytics', path: '/whatsapp/reports' },
    ];

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    return (
        <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <div className="border-b border-slate-200 bg-white/80 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/80">
                <div className="px-6 pt-6 pb-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                                <span className="material-symbols-outlined text-white text-[22px]">chat</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white">WhatsApp Marketing</h1>
                                <p className="text-xs text-slate-500">Campañas automatizadas</p>
                            </div>
                        </div>
                        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', description: '', campaign_type: 'maintenance_reminder', is_active: true }); }}
                            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 transition-all">
                            <span className="material-symbols-outlined text-[18px]">add</span>Nueva Campaña
                        </button>
                    </div>
                    <div className="flex gap-1">
                        {tabs.map(tab => (
                            <button key={tab.path} onClick={() => navigate(tab.path)}
                                className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-xs font-semibold transition-all ${tab.path === '/whatsapp/campaigns'
                                        ? 'bg-white text-emerald-700 border-b-2 border-emerald-500 dark:bg-slate-800 dark:text-emerald-400'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}>
                                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-6">
                {loading ? (
                    <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" /></div>
                ) : campaigns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <span className="material-symbols-outlined text-[64px] mb-4">campaign</span>
                        <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">No hay campañas creadas</p>
                        <p className="text-sm mt-1">Crea tu primera campaña de recordatorio automático</p>
                        <button onClick={() => setShowForm(true)} className="mt-4 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white">Crear Campaña</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {campaigns.map(camp => {
                            const ct = camp.campaign_type;
                            return (
                                <div key={camp.id} className="rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                                    <div className="p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${CAMPAIGN_TYPE_COLORS[ct]?.bg || 'bg-slate-100'}`}>
                                                    <span className={`material-symbols-outlined text-[20px] ${CAMPAIGN_TYPE_COLORS[ct]?.text || 'text-slate-500'}`}>{CAMPAIGN_TYPE_ICONS[ct] || 'campaign'}</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{camp.name}</p>
                                                    <p className="text-[11px] text-slate-400">{CAMPAIGN_TYPE_LABELS[ct]}</p>
                                                </div>
                                            </div>
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${camp.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${camp.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                {camp.is_active ? 'Activa' : 'Pausada'}
                                            </span>
                                        </div>
                                        {camp.description && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{camp.description}</p>}

                                        {/* Stats */}
                                        <div className="grid grid-cols-3 gap-2 mb-3">
                                            <div className="rounded-lg bg-slate-50 p-2 text-center dark:bg-slate-800">
                                                <p className="text-lg font-bold text-slate-900 dark:text-white">{camp.total_sent}</p>
                                                <p className="text-[10px] text-slate-400">Enviados</p>
                                            </div>
                                            <div className="rounded-lg bg-slate-50 p-2 text-center dark:bg-slate-800">
                                                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{getDeliveryRate(camp.total_sent, camp.total_delivered)}%</p>
                                                <p className="text-[10px] text-slate-400">Entrega</p>
                                            </div>
                                            <div className="rounded-lg bg-slate-50 p-2 text-center dark:bg-slate-800">
                                                <p className="text-lg font-bold text-sky-600 dark:text-sky-400">{getReadRate(camp.total_delivered, camp.total_read)}%</p>
                                                <p className="text-[10px] text-slate-400">Lectura</p>
                                            </div>
                                        </div>

                                        {camp.revenue_generated > 0 && (
                                            <div className="flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 mb-3 dark:bg-amber-900/20">
                                                <span className="material-symbols-outlined text-amber-600 text-[14px]">trending_up</span>
                                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{formatWaCurrency(camp.revenue_generated)} generados</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center border-t border-slate-100 dark:border-slate-800">
                                        <button onClick={() => openSteps(camp.id)} className="flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                                            <span className="material-symbols-outlined text-[14px]">list</span>Pasos
                                        </button>
                                        <button onClick={() => editCampaign(camp)} className="flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                                            <span className="material-symbols-outlined text-[14px]">edit</span>Editar
                                        </button>
                                        <button onClick={() => toggleActive(camp)} className="flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                                            <span className="material-symbols-outlined text-[14px]">{camp.is_active ? 'pause' : 'play_arrow'}</span>{camp.is_active ? 'Pausar' : 'Activar'}
                                        </button>
                                        <button onClick={() => deleteCampaign(camp.id)} className="flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all">
                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Campaign Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">{editingId ? 'Editar Campaña' : 'Nueva Campaña'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Nombre *</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputClass} placeholder="Ej: Recordatorio Mantenimiento Trimestral" />
                            </div>
                            <div>
                                <label className={labelClass}>Tipo de Campaña</label>
                                <select value={form.campaign_type} onChange={e => setForm({ ...form, campaign_type: e.target.value as CampaignType })} className={inputClass}>
                                    {(Object.keys(CAMPAIGN_TYPE_LABELS) as CampaignType[]).map(t => (
                                        <option key={t} value={t}>{CAMPAIGN_TYPE_LABELS[t]}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Descripción</label>
                                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={inputClass} placeholder="Describe el propósito de esta campaña..." />
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} id="isActive" className="rounded" />
                                <label htmlFor="isActive" className="text-sm text-slate-600 dark:text-slate-400">Activar inmediatamente</label>
                            </div>
                        </div>
                        <div className="mt-5 flex gap-2">
                            <button type="submit" className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25">{editingId ? 'Guardar' : 'Crear'}</button>
                            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500 dark:border-slate-700">Cancelar</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Steps Modal */}
            {showSteps && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Pasos de la Secuencia</h3>
                            <button onClick={() => setShowSteps(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Existing steps */}
                        <div className="space-y-2 mb-4">
                            {steps.map((step, idx) => (
                                <div key={step.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{idx + 1}</div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {step.trigger_days < 0 ? `${Math.abs(step.trigger_days)} días antes` : step.trigger_days === 0 ? 'Día del evento' : `${step.trigger_days} días después`}
                                        </p>
                                        <p className="text-[11px] text-slate-400">
                                            {(step.template as unknown as { name: string } | undefined)?.name || 'Sin plantilla'} · {step.send_time}
                                        </p>
                                    </div>
                                    <span className={`h-2 w-2 rounded-full ${step.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    <button onClick={() => deleteStep(step.id)} className="text-slate-400 hover:text-red-500">
                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </button>
                                </div>
                            ))}
                            {steps.length === 0 && <p className="text-center text-sm text-slate-400 py-4">Sin pasos — agrega el primero</p>}
                        </div>

                        {/* Add step form */}
                        <form onSubmit={addStep} className="rounded-lg border border-dashed border-emerald-300 p-4 dark:border-emerald-700">
                            <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-3">Agregar Paso</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Días Trigger</label>
                                    <input type="number" value={stepForm.trigger_days} onChange={e => setStepForm({ ...stepForm, trigger_days: parseInt(e.target.value) })} className={inputClass} />
                                    <p className="text-[10px] text-slate-400 mt-0.5">Negativo = antes del evento</p>
                                </div>
                                <div>
                                    <label className={labelClass}>Hora de Envío</label>
                                    <input type="time" value={stepForm.send_time} onChange={e => setStepForm({ ...stepForm, send_time: e.target.value })} className={inputClass} />
                                </div>
                                <div className="col-span-2">
                                    <label className={labelClass}>Plantilla</label>
                                    <select value={stepForm.template_id} onChange={e => setStepForm({ ...stepForm, template_id: e.target.value })} className={inputClass}>
                                        <option value="">Seleccionar plantilla...</option>
                                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="mt-3 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white">Agregar Paso</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
