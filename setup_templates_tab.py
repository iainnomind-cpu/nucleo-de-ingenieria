import re

# Read original
with open('src/pages/Settings/TareasTab.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Imports
# We need to add TemplateCategory, MetaStatus, TemplateHeaderType, TEMPLATE_CATEGORY_LABELS, META_STATUS_COLORS, TEMPLATE_CATEGORY_ICONS
imports_to_add = "    TemplateCategory, MetaStatus, TemplateHeaderType,\n    TEMPLATE_CATEGORY_LABELS, META_STATUS_COLORS, TEMPLATE_CATEGORY_ICONS,\n"
# Find `WaTemplate, META_STATUS_LABELS } from '../../types/whatsapp';` and replace
if 'META_STATUS_LABELS' in text:
    text = text.replace(
        "WaTemplate, META_STATUS_LABELS } from", 
        "WaTemplate, META_STATUS_LABELS,\n" + imports_to_add + "} from"
    )

# 2. Add AVAILABLE_VARIABLES constant above TareasTab
available_vars_str = """
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
"""
text = text.replace("export default function TareasTab() {", available_vars_str + "\nexport default function TareasTab() {")

# 3. Add states inside TareasTab
states_str = """
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
"""
text = text.replace("const [customPhoneInput, setCustomPhoneInput] = useState('');", "const [customPhoneInput, setCustomPhoneInput] = useState('');" + states_str)

# 4. Modify fetchAll to NOT filter by approved templates.
# In fetchAll, `supabase.from('wa_templates').select('*').eq('meta_status', 'approved').order('name')`
# Change to `supabase.from('wa_templates').select('*').order('name')`
text = text.replace(".eq('meta_status', 'approved').order('name')", ".order('name')")

# 5. Add Template Functions
template_functions = """
    // --- TEMPLATE FUNCTIONS ---
    const resetTemplateForm = () => setFormTemplate({ name: '', category: 'utility', language: 'es_MX', header_type: 'none', header_content: '', body: '', footer: '', variables: '', meta_status: 'draft' });

    const processBodyForSave = (bodyText: string) => {
        let finalBody = bodyText;
        const matches = bodyText.match(/\\{\\{([^}]+)\\}\\}/g);
        const uniqueVars: string[] = [];
        if (matches) {
            matches.forEach(m => {
                const varName = m.replace(/\\{\\{|\\}\\}/g, '').trim();
                if (!uniqueVars.includes(varName)) uniqueVars.push(varName);
            });
            uniqueVars.forEach((varName, idx) => {
                const escaped = varName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
                const regex = new RegExp(`\\{\\{${escaped}\\}\\}`, 'g');
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
            body: finalBody, footer: formTemplate.footer || null, variables: finalVariables, meta_status: formTemplate.meta_status,
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
"""
text = text.replace("const resetForm = () => {", template_functions + "\n    const resetForm = () => {")

# 6. Update the main Header with Template Buttons
old_header_inner = """                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40"
                >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Nueva Regla
                </button>"""
new_header_inner = """                <div className="flex items-center gap-2">
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
                </div>"""
text = text.replace(old_header_inner, new_header_inner)

# 7. Modify Templates Map in Form Step 1
# Current:
# {templates.map(tpl => (
#    <button key={tpl.id} type="button" onClick={() => setForm({ ...form, template_id: tpl.id })}
#        className={`text-left rounded-xl border-2 p-4 transition-all ${form.template_id === tpl.id ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-100 bg-white dark:bg-slate-800 dark:border-slate-700 hover:border-emerald-300'}`}>
old_tpl_map_start = """                                        {templates.map(tpl => (
                                            <button key={tpl.id} type="button" onClick={() => setForm({ ...form, template_id: tpl.id })}
                                                className={`text-left rounded-xl border-2 p-4 transition-all ${form.template_id === tpl.id ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-100 bg-white dark:bg-slate-800 dark:border-slate-700 hover:border-emerald-300'}`}>"""
new_tpl_map_start = """                                        {templates.map(tpl => {
                                            const isSelectable = tpl.meta_status === 'approved';
                                            return (
                                            <div key={tpl.id}
                                                onClick={() => isSelectable && setForm({ ...form, template_id: tpl.id })}
                                                className={`text-left rounded-xl border-2 p-4 transition-all flex flex-col justify-between ${form.template_id === tpl.id ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-100 bg-white dark:bg-slate-800 dark:border-slate-700'} ${isSelectable ? 'cursor-pointer hover:border-emerald-300' : 'opacity-80 cursor-not-allowed'}`}>"""
text = text.replace(old_tpl_map_start, new_tpl_map_start)

# Bottom part of the map currently ends with:
#                                                 {tpl.variables?.length > 0 && <div className="mt-2 flex gap-1 flex-wrap">{tpl.variables.map((v, i) => <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">{v}</span>)}</div>}
#                                             </button>
#                                         ))}
old_tpl_map_end = """                                                {tpl.variables?.length > 0 && <div className="mt-2 flex gap-1 flex-wrap">{tpl.variables.map((v, i) => <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">{v}</span>)}</div>}
                                            </button>
                                        ))}"""
new_tpl_map_end = """                                                {tpl.variables?.length > 0 && <div className="mt-2 flex gap-1 flex-wrap">{tpl.variables.map((v, i) => <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">{v}</span>)}</div>}
                                                {(tpl.meta_status === 'draft' || tpl.meta_status === 'rejected') && (
                                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); submitToMeta(tpl.id, tpl.name); }} disabled={submittingId === tpl.id} className="flex items-center gap-1 rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-400 transition-all">
                                                            {submittingId === tpl.id ? 'Enviando...' : 'Enviar a Revisión Meta'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                        })}"""
text = text.replace(old_tpl_map_end, new_tpl_map_end)


# 8. Render the Template Form Modal at the bottom, just inside the main <div>
template_form_str = """
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
"""

# Insert right before the last closing </div> of the component.
text = text.replace("        </div>\n    );\n}", template_form_str + "        </div>\n    );\n}")

with open('src/pages/Settings/TareasTab.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
