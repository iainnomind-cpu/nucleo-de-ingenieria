import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    WaTemplate,
    TemplateCategory, MetaStatus, TemplateHeaderType,
    TEMPLATE_CATEGORY_LABELS, TEMPLATE_CATEGORY_ICONS,
    META_STATUS_LABELS, META_STATUS_COLORS,
} from '../../types/whatsapp';

export default function TemplatesList() {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<WaTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [previewTemplate, setPreviewTemplate] = useState<WaTemplate | null>(null);
    const [filterStatus, setFilterStatus] = useState<MetaStatus | 'all'>('all');
    const [form, setForm] = useState({
        name: '', category: 'utility' as TemplateCategory, language: 'es_MX',
        header_type: 'none' as TemplateHeaderType, header_content: '',
        body: '', footer: '', variables: '', meta_status: 'draft' as MetaStatus,
    });

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        let query = supabase.from('wa_templates').select('*').order('created_at', { ascending: false });
        if (filterStatus !== 'all') query = query.eq('meta_status', filterStatus);
        const { data } = await query;
        setTemplates((data as WaTemplate[]) || []);
        setLoading(false);
    }, [filterStatus]);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            name: form.name,
            category: form.category,
            language: form.language,
            header_type: form.header_type !== 'none' ? form.header_type : null,
            header_content: form.header_content || null,
            body: form.body,
            footer: form.footer || null,
            variables: form.variables ? form.variables.split(',').map(v => v.trim()) : [],
            meta_status: form.meta_status,
        };
        if (editingId) {
            await supabase.from('wa_templates').update(payload).eq('id', editingId);
        } else {
            await supabase.from('wa_templates').insert(payload);
        }
        setShowForm(false); setEditingId(null);
        resetForm();
        fetchTemplates();
    };

    const resetForm = () => setForm({ name: '', category: 'utility', language: 'es_MX', header_type: 'none', header_content: '', body: '', footer: '', variables: '', meta_status: 'draft' });

    const editTemplate = (t: WaTemplate) => {
        setForm({
            name: t.name, category: t.category, language: t.language,
            header_type: t.header_type || 'none', header_content: t.header_content || '',
            body: t.body, footer: t.footer || '',
            variables: (t.variables || []).join(', '), meta_status: t.meta_status,
        });
        setEditingId(t.id);
        setShowForm(true);
    };

    const deleteTemplate = async (t: WaTemplate) => {
        if (t.meta_status !== 'draft' && t.meta_status !== 'rejected') {
            alert('Solo se pueden eliminar plantillas en borrador o rechazadas.');
            return;
        }
        if (!confirm('¿Eliminar esta plantilla?')) return;
        await supabase.from('wa_templates').delete().eq('id', t.id);
        fetchTemplates();
    };

    const submitToMeta = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de enviar la plantilla "${name}" a Meta? \nUna vez en revisión, no podrás editarla temporalmente.`)) return;
        
        setSubmitting(true);
        try {
            const res = await fetch('/api/whatsapp-template-submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template_id: id })
            });
            const data = await res.json();
            
            if (data.success) {
                alert('¡Plantilla enviada exitosamente a revisión!');
                fetchTemplates();
            } else {
                alert(`Error al enviar a Meta: ${data.message || 'Error desconocido'}`);
            }
        } catch (error) {
            console.error(error);
            alert('Error de red al intentar enviar.');
        } finally {
            setSubmitting(false);
        }
    };

    // Parse body to highlight variables
    const renderBody = (body: string) => {
        return body.replace(/\{\{(\d+)\}\}/g, '<span class="inline-block rounded bg-emerald-100 px-1 text-emerald-700 font-mono text-xs dark:bg-emerald-900/30 dark:text-emerald-400">{{$1}}</span>');
    };

    const tabs = [
        { label: 'Dashboard', icon: 'space_dashboard', path: '/whatsapp' },
        { label: 'Conversaciones', icon: 'chat', path: '/whatsapp/conversations' },
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
                                <p className="text-xs text-slate-500">Plantillas de mensaje</p>
                            </div>
                        </div>
                        <button onClick={() => { setShowForm(true); setEditingId(null); resetForm(); }}
                            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 transition-all">
                            <span className="material-symbols-outlined text-[18px]">add</span>Nueva Plantilla
                        </button>
                    </div>
                    <div className="flex gap-1">
                        {tabs.map(tab => (
                            <button key={tab.path} onClick={() => navigate(tab.path)}
                                className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-xs font-semibold transition-all ${tab.path === '/whatsapp/templates'
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
                {/* Filters */}
                <div className="flex items-center gap-2 mb-4">
                    {(['all', 'draft', 'pending', 'approved', 'rejected'] as const).map(st => (
                        <button key={st} onClick={() => setFilterStatus(st)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${filterStatus === st ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {st === 'all' ? 'Todas' : META_STATUS_LABELS[st]}
                        </button>
                    ))}
                </div>

                {submitting && (
                    <div className="mb-4 rounded-lg bg-sky-50 p-4 border border-sky-200">
                        <div className="flex items-center gap-3">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                            <p className="text-sm font-medium text-sky-800">Enviando plantilla a Meta para su revisión...</p>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" /></div>
                ) : templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <span className="material-symbols-outlined text-[64px] mb-4">description</span>
                        <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">No hay plantillas</p>
                        <p className="text-sm mt-1">Crea plantillas de mensaje para usar en campañas</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {templates.map(tpl => (
                            <div key={tpl.id} className="rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800 group">
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                                                <span className="material-symbols-outlined text-slate-500 text-[16px]">{TEMPLATE_CATEGORY_ICONS[tpl.category]}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{tpl.name}</p>
                                                <p className="text-[10px] text-slate-400">{TEMPLATE_CATEGORY_LABELS[tpl.category]} · {tpl.language}</p>
                                            </div>
                                        </div>
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${META_STATUS_COLORS[tpl.meta_status]?.bg} ${META_STATUS_COLORS[tpl.meta_status]?.text}`}>
                                            {META_STATUS_LABELS[tpl.meta_status]}
                                        </span>
                                    </div>

                                    {/* Message preview (WhatsApp style) */}
                                    <div className="mt-3 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/10">
                                        <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-slate-800 border-l-4 border-emerald-500">
                                            {tpl.header_content && (
                                                <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">{tpl.header_content}</p>
                                            )}
                                            <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderBody(tpl.body) }} />
                                            {tpl.footer && <p className="text-[10px] text-slate-400 mt-1 italic">{tpl.footer}</p>}
                                        </div>
                                    </div>

                                    {tpl.variables && tpl.variables.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {tpl.variables.map((v, i) => (
                                                <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{v}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center border-t border-slate-100 dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-all">
                                    {(tpl.meta_status === 'draft' || tpl.meta_status === 'rejected') && (
                                        <button onClick={() => submitToMeta(tpl.id, tpl.name)} disabled={submitting} className="flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-bold text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 disabled:opacity-50">
                                            <span className="material-symbols-outlined text-[14px]">send</span>Enviar a Revisión
                                        </button>
                                    )}
                                    <button onClick={() => setPreviewTemplate(tpl)} className="flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800">
                                        <span className="material-symbols-outlined text-[14px]">visibility</span>Vista
                                    </button>
                                    {(tpl.meta_status === 'draft' || tpl.meta_status === 'rejected') && (
                                        <button onClick={() => editTemplate(tpl)} disabled={submitting} className="flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10">
                                            <span className="material-symbols-outlined text-[14px]">edit</span>Editar
                                        </button>
                                    )}
                                    <button onClick={() => deleteTemplate(tpl)} disabled={submitting} className="flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10">
                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Template Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <form onSubmit={handleSubmit} className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
                        <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">{editingId ? 'Editar Plantilla' : 'Nueva Plantilla'}</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className={labelClass}>Nombre *</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputClass} placeholder="recordatorio_mantenimiento_30d" />
                            </div>
                            <div>
                                <label className={labelClass}>Categoría</label>
                                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as TemplateCategory })} className={inputClass}>
                                    {(Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[]).map(c => (
                                        <option key={c} value={c}>{TEMPLATE_CATEGORY_LABELS[c]}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Idioma</label>
                                <select value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} className={inputClass}>
                                    <option value="es_MX">Español (MX)</option>
                                    <option value="es">Español</option>
                                    <option value="en_US">English (US)</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Tipo de Header</label>
                                <select value={form.header_type} onChange={e => setForm({ ...form, header_type: e.target.value as TemplateHeaderType })} className={inputClass}>
                                    <option value="none">Sin Header</option>
                                    <option value="text">Texto</option>
                                    <option value="image">Imagen</option>
                                    <option value="document">Documento</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Estado Interno</label>
                                <select value={form.meta_status} disabled onChange={e => setForm({ ...form, meta_status: e.target.value as MetaStatus })} className={`${inputClass} bg-slate-50 opacity-70`}>
                                    {(Object.keys(META_STATUS_LABELS) as MetaStatus[]).map(s => (
                                        <option key={s} value={s}>{META_STATUS_LABELS[s]}</option>
                                    ))}
                                </select>
                            </div>
                            {form.header_type !== 'none' && (
                                <div className="col-span-2">
                                    <label className={labelClass}>Contenido del Header</label>
                                    <input value={form.header_content} onChange={e => setForm({ ...form, header_content: e.target.value })} className={inputClass} placeholder="Título o URL del media" />
                                </div>
                            )}
                            <div className="col-span-2">
                                <label className={labelClass}>Cuerpo del Mensaje *</label>
                                <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} required rows={5} className={inputClass}
                                    placeholder="Hola {{1}}, le recordamos que su servicio de {{2}} está programado para el {{3}}. ¿Confirma la visita?" />
                                <p className="text-[10px] text-slate-400 mt-1">Usa {"{{1}}"}, {"{{2}}"}, etc. para variables dinámicas</p>
                            </div>
                            <div>
                                <label className={labelClass}>Footer (opcional)</label>
                                <input value={form.footer} onChange={e => setForm({ ...form, footer: e.target.value })} className={inputClass} placeholder="Núcleo de Ingeniería" />
                            </div>
                            <div>
                                <label className={labelClass}>Variables (separadas por coma)</label>
                                <input value={form.variables} onChange={e => setForm({ ...form, variables: e.target.value })} className={inputClass} placeholder="client_name, service_type, date" />
                            </div>
                        </div>
                        <div className="mt-5 flex gap-2">
                            <button type="submit" className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25">{editingId ? 'Guardar' : 'Crear'}</button>
                            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500 dark:border-slate-700">Cancelar</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Preview Modal */}
            {previewTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Vista Previa</h3>
                            <button onClick={() => setPreviewTemplate(null)} className="text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                        {/* WhatsApp phone mockup */}
                        <div className="rounded-2xl bg-[#e5ddd5] p-4 dark:bg-slate-800">
                            <div className="max-w-[280px] mx-auto">
                                <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-slate-700">
                                    {previewTemplate.header_content && (
                                        <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{previewTemplate.header_content}</p>
                                    )}
                                    <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderBody(previewTemplate.body) }} />
                                    {previewTemplate.footer && (
                                        <p className="text-[11px] text-slate-400 mt-2 italic">{previewTemplate.footer}</p>
                                    )}
                                    <p className="text-[10px] text-slate-400 text-right mt-1">9:00 AM ✓✓</p>
                                </div>
                                {previewTemplate.buttons && previewTemplate.buttons.length > 0 && (
                                    <div className="mt-1 space-y-1">
                                        {previewTemplate.buttons.map((btn, i) => (
                                            <div key={i} className="rounded-lg bg-white p-2 text-center shadow-sm dark:bg-slate-700">
                                                <p className="text-xs font-medium text-sky-600">{btn.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
