import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { WaTemplate, META_STATUS_LABELS } from '../../types/whatsapp';
import { Client, ClientStatus, STATUS_LABELS, STATUS_COLORS } from '../../types/crm';

type SendStep = 'template' | 'audience' | 'preview';

interface SendResult {
    client: Client;
    success: boolean;
    error?: string;
}

export default function DirectSend() {
    const navigate = useNavigate();

    // Steps
    const [step, setStep] = useState<SendStep>('template');

    // Template selection
    const [templates, setTemplates] = useState<WaTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(null);

    // Audience selection
    const [clients, setClients] = useState<Client[]>([]);
    const [loadingClients, setLoadingClients] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<ClientStatus | 'all'>('all');
    const [filterIndustry, setFilterIndustry] = useState<string>('all');

    // Sending
    const [sending, setSending] = useState(false);
    const [sendProgress, setSendProgress] = useState(0);
    const [sendResults, setSendResults] = useState<SendResult[]>([]);
    const [showResults, setShowResults] = useState(false);

    const tabs = [
        { label: 'Dashboard', icon: 'space_dashboard', path: '/whatsapp' },
        { label: 'Conversaciones', icon: 'chat', path: '/whatsapp/conversations' },
        { label: 'Envío Directo', icon: 'send', path: '/whatsapp/send' },
        { label: 'Campañas', icon: 'campaign', path: '/whatsapp/campaigns' },
        { label: 'Plantillas', icon: 'description', path: '/whatsapp/templates' },
        { label: 'Reportes', icon: 'analytics', path: '/whatsapp/reports' },
        { label: 'Reglas (Auto)', icon: 'bolt', path: '/whatsapp/rules' },

    ];

    // Fetch approved templates
    const fetchTemplates = useCallback(async () => {
        const { data } = await supabase
            .from('wa_templates')
            .select('*')
            .eq('meta_status', 'approved')
            .order('name');
        setTemplates((data as WaTemplate[]) || []);
    }, []);

    // Fetch clients
    const fetchClients = useCallback(async () => {
        setLoadingClients(true);
        let query = supabase.from('clients').select('*').order('company_name');
        if (filterStatus !== 'all') query = query.eq('status', filterStatus);
        if (searchTerm.trim()) {
            query = query.or(`company_name.ilike.%${searchTerm}%,contact_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
        }
        const { data } = await query;
        setClients((data as Client[]) || []);
        setLoadingClients(false);
    }, [filterStatus, searchTerm]);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
    useEffect(() => { if (step === 'audience') fetchClients(); }, [step, fetchClients]);

    // Derived
    const industries = [...new Set(clients.map(c => c.industry).filter(Boolean))] as string[];
    const filteredClients = filterIndustry === 'all'
        ? clients
        : clients.filter(c => c.industry === filterIndustry);
    const selectedClients = clients.filter(c => selectedIds.has(c.id));
    const clientsWithPhone = selectedClients.filter(c => c.phone);

    // Selection helpers
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const selectAll = () => {
        const allIds = filteredClients.map(c => c.id);
        setSelectedIds(prev => {
            const next = new Set(prev);
            allIds.forEach(id => next.add(id));
            return next;
        });
    };
    const deselectAll = () => {
        const allIds = filteredClients.map(c => c.id);
        setSelectedIds(prev => {
            const next = new Set(prev);
            allIds.forEach(id => next.delete(id));
            return next;
        });
    };
    const selectByStatus = (status: ClientStatus) => {
        const ids = clients.filter(c => c.status === status).map(c => c.id);
        setSelectedIds(prev => {
            const next = new Set(prev);
            ids.forEach(id => next.add(id));
            return next;
        });
    };

    // Preview body with variable highlights
    const renderBody = (body: string, varsArray?: string[]) => {
        let html = body;
        if (varsArray && varsArray.length > 0) {
            varsArray.forEach((v, i) => {
                const regex = new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g');
                html = html.replace(regex, `<span class="inline-block rounded bg-emerald-100 px-1 text-emerald-700 font-mono text-xs dark:bg-emerald-900/30 dark:text-emerald-400">{{${v}}}</span>`);
            });
        }
        return html.replace(/\{\{([^}]+)\}\}/g, '<span class="inline-block rounded bg-emerald-100 px-1 text-emerald-700 font-mono text-xs dark:bg-emerald-900/30 dark:text-emerald-400">{{$1}}</span>');
    };

    // Send messages
    const handleSend = async () => {
        if (!selectedTemplate || clientsWithPhone.length === 0) return;
        if (!confirm(`¿Enviar "${selectedTemplate.name}" a ${clientsWithPhone.length} cliente(s)?\n\nEsta acción enviará mensajes reales por WhatsApp.`)) return;

        setSending(true);
        setSendProgress(0);
        const results: SendResult[] = [];

        for (let i = 0; i < clientsWithPhone.length; i++) {
            const client = clientsWithPhone[i];
            try {
                // Build variables from client data
                const varValues = (selectedTemplate.variables || []).map(varName => {
                    const lower = varName.toLowerCase();
                    if (lower.includes('nombre') || lower.includes('name') || lower === 'client_name') return client.contact_name || client.company_name;
                    if (lower.includes('empresa') || lower.includes('company') || lower === 'company_name') return client.company_name;
                    if (lower.includes('industri') || lower === 'industry') return client.industry || 'N/A';
                    return varName; // fallback: use the variable name itself
                });

                const res = await fetch('/api/whatsapp-send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: client.phone,
                        type: 'template',
                        template_name: selectedTemplate.meta_name || selectedTemplate.name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                        language: selectedTemplate.language || 'es_MX',
                        variables: varValues.length > 0 ? varValues : undefined,
                    }),
                });
                const data = await res.json();
                results.push({ client, success: data.success, error: data.success ? undefined : data.message });
            } catch {
                results.push({ client, success: false, error: 'Error de red' });
            }
            setSendProgress(Math.round(((i + 1) / clientsWithPhone.length) * 100));
            // Small delay between messages to avoid rate-limiting
            if (i < clientsWithPhone.length - 1) await new Promise(r => setTimeout(r, 500));
        }

        setSendResults(results);
        setSending(false);
        setShowResults(true);
        // Insert a campaign record for reporting
        const successful = results.filter(r => r.success).length;
        if (successful > 0) {
            await supabase.from('wa_campaigns').insert({
                name: `Envío Directo: ${selectedTemplate?.name}`,
                description: `Envío masivo vía Envío Directo a ${successful} clientes`,
                campaign_type: 'custom',
                is_active: true,
                total_sent: successful,
                total_delivered: 0,
                total_read: 0,
                total_responded: 0,
                total_conversions: 0,
                revenue_generated: 0,
            });
        }

    const stepsConfig = [
        { key: 'template' as const, label: '1. Plantilla', icon: 'description' },
        { key: 'audience' as const, label: '2. Audiencia', icon: 'groups' },
        { key: 'preview' as const, label: '3. Enviar', icon: 'send' },
    ];

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
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Envío Directo</h1>
                                <p className="text-xs text-slate-500">Envía plantillas aprobadas a clientes seleccionados</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        {tabs.map(tab => (
                            <button key={tab.path} onClick={() => navigate(tab.path)}
                                className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-xs font-semibold transition-all ${tab.path === '/whatsapp/send'
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
                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-6">
                    {stepsConfig.map((s, i) => (
                        <div key={s.key} className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    if (s.key === 'template') setStep('template');
                                    else if (s.key === 'audience' && selectedTemplate) setStep('audience');
                                    else if (s.key === 'preview' && selectedTemplate && selectedIds.size > 0) setStep('preview');
                                }}
                                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${step === s.key
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                                    : s.key === 'template' || (s.key === 'audience' && selectedTemplate) || (s.key === 'preview' && selectedTemplate && selectedIds.size > 0)
                                        ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
                                    }`}>
                                <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                                {s.label}
                            </button>
                            {i < stepsConfig.length - 1 && (
                                <span className="material-symbols-outlined text-slate-300 text-[18px]">chevron_right</span>
                            )}
                        </div>
                    ))}
                </div>

                {/* STEP 1: Template Selection */}
                {step === 'template' && (
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">Selecciona una Plantilla Aprobada</h2>
                        <p className="text-sm text-slate-500 mb-4">Solo se muestran plantillas con estado "Aprobada" por Meta</p>

                        {templates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                <span className="material-symbols-outlined text-[56px] mb-3">description</span>
                                <p className="text-base font-semibold text-slate-600 dark:text-slate-300">No hay plantillas aprobadas</p>
                                <p className="text-sm mt-1">Ve a Plantillas y sincroniza el estado con Meta</p>
                                <button onClick={() => navigate('/whatsapp/templates')} className="mt-4 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white">
                                    Ir a Plantillas
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {templates.map(tpl => (
                                    <button
                                        key={tpl.id}
                                        onClick={() => { setSelectedTemplate(tpl); setStep('audience'); }}
                                        className={`text-left rounded-xl border-2 p-5 transition-all hover:shadow-md ${selectedTemplate?.id === tpl.id
                                            ? 'border-emerald-500 bg-emerald-50/50 shadow-md dark:bg-emerald-900/10'
                                            : 'border-slate-100 bg-white hover:border-emerald-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-emerald-700'
                                            }`}>
                                        <div className="flex items-start justify-between mb-2">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{tpl.name}</p>
                                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                {META_STATUS_LABELS[tpl.meta_status]}
                                            </span>
                                        </div>
                                        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800 border-l-4 border-emerald-500">
                                            {tpl.header_content && (
                                                <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">{tpl.header_content}</p>
                                            )}
                                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 whitespace-pre-wrap"
                                                dangerouslySetInnerHTML={{ __html: renderBody(tpl.body, tpl.variables) }} />
                                            {tpl.footer && <p className="text-[10px] text-slate-400 mt-1 italic">{tpl.footer}</p>}
                                        </div>
                                        {tpl.variables && tpl.variables.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {tpl.variables.map((v, i) => (
                                                    <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{v}</span>
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-[10px] text-slate-400 mt-2">{tpl.category} · {tpl.language}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 2: Audience Selection */}
                {step === 'audience' && (
                    <div>
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">Selecciona los Destinatarios</h2>
                                <p className="text-sm text-slate-500">
                                    Plantilla: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{selectedTemplate?.name}</span>
                                    {' · '}
                                    <span className="font-semibold text-emerald-600">{selectedIds.size}</span> seleccionados
                                </p>
                            </div>
                            <button
                                onClick={() => setStep('preview')}
                                disabled={selectedIds.size === 0}
                                className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Siguiente
                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </button>
                        </div>

                        {/* Quick segment buttons */}
                        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4 dark:bg-slate-900 dark:border-slate-800">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                <span className="material-symbols-outlined text-[14px] align-text-bottom mr-1">auto_awesome</span>
                                Segmentación Rápida
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={selectAll}
                                    className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-all dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
                                    <span className="material-symbols-outlined text-[14px]">select_all</span>Todos los visibles
                                </button>
                                <button onClick={deselectAll}
                                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                    <span className="material-symbols-outlined text-[14px]">deselect</span>Deseleccionar visibles
                                </button>
                                <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                                <button onClick={() => selectByStatus('active')}
                                    className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-all dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />Clientes Activos
                                </button>
                                <button onClick={() => selectByStatus('vip')}
                                    className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-all dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                                    <span className="h-2 w-2 rounded-full bg-purple-500" />Clientes VIP
                                </button>
                                <button onClick={() => selectByStatus('prospect')}
                                    className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-all dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                                    <span className="h-2 w-2 rounded-full bg-amber-500" />Prospectos
                                </button>
                                <button onClick={() => selectByStatus('overdue')}
                                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-all dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                                    <span className="h-2 w-2 rounded-full bg-red-500" />Morosos
                                </button>
                                <button onClick={() => { selectByStatus('active'); selectByStatus('vip'); }}
                                    className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition-all dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-400">
                                    <span className="material-symbols-outlined text-[14px]">star</span>Activos + VIP
                                </button>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="relative flex-1">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                                <input
                                    type="text"
                                    placeholder="Buscar por empresa, contacto o teléfono..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                />
                            </div>
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value as ClientStatus | 'all')}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                                <option value="all">Todos los estados</option>
                                {(['prospect', 'active', 'inactive', 'vip', 'overdue'] as ClientStatus[]).map(s => (
                                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                ))}
                            </select>
                            {industries.length > 0 && (
                                <select
                                    value={filterIndustry}
                                    onChange={e => setFilterIndustry(e.target.value)}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                >
                                    <option value="all">Todas las industrias</option>
                                    {industries.map(ind => (
                                        <option key={ind} value={ind}>{ind}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Client list */}
                        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                            {loadingClients ? (
                                <div className="flex justify-center py-12">
                                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                                </div>
                            ) : filteredClients.length === 0 ? (
                                <div className="flex flex-col items-center py-12 text-slate-400">
                                    <span className="material-symbols-outlined text-[48px] mb-2">person_off</span>
                                    <p className="text-sm">No hay clientes con estos filtros</p>
                                </div>
                            ) : (
                                <>
                                    {/* Header row */}
                                    <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={filteredClients.length > 0 && filteredClients.every(c => selectedIds.has(c.id))}
                                            onChange={e => e.target.checked ? selectAll() : deselectAll()}
                                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex-1">
                                            {filteredClients.length} clientes · {selectedIds.size} seleccionados
                                        </p>
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-28 text-center">Estado</p>
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-36 text-center">Teléfono</p>
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32 text-center">Industria</p>
                                    </div>
                                    <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-[450px] overflow-y-auto">
                                        {filteredClients.map(client => (
                                            <label
                                                key={client.id}
                                                className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-all hover:bg-slate-50/80 dark:hover:bg-slate-800/30 ${selectedIds.has(client.id) ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : ''}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(client.id)}
                                                    onChange={() => toggleSelect(client.id)}
                                                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-bold shrink-0">
                                                        {client.company_name.slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{client.company_name}</p>
                                                        <p className="text-[11px] text-slate-400 truncate">{client.contact_name || 'Sin contacto'}</p>
                                                    </div>
                                                </div>
                                                <div className="w-28 text-center">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[client.status]?.bg} ${STATUS_COLORS[client.status]?.text}`}>
                                                        {STATUS_LABELS[client.status]}
                                                    </span>
                                                </div>
                                                <div className="w-36 text-center">
                                                    {client.phone ? (
                                                        <span className="text-xs text-slate-600 dark:text-slate-300">{client.phone}</span>
                                                    ) : (
                                                        <span className="text-xs text-red-400 font-medium flex items-center justify-center gap-1">
                                                            <span className="material-symbols-outlined text-[12px]">warning</span>Sin teléfono
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="w-32 text-center">
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">{client.industry || '—'}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* STEP 3: Preview & Send */}
                {step === 'preview' && (
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">Confirmar y Enviar</h2>
                        <p className="text-sm text-slate-500 mb-6">Revisa los datos antes de enviar</p>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left: Summary */}
                            <div className="lg:col-span-2 space-y-4">
                                {/* Template summary */}
                                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:bg-slate-900 dark:border-slate-800">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Plantilla</h3>
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                                            <span className="material-symbols-outlined text-emerald-700 dark:text-emerald-400 text-[20px]">description</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedTemplate?.name}</p>
                                            <p className="text-[11px] text-slate-400">{selectedTemplate?.category} · {selectedTemplate?.language}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Recipients summary */}
                                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:bg-slate-900 dark:border-slate-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Destinatarios ({selectedClients.length})</h3>
                                        {selectedClients.length !== clientsWithPhone.length && (
                                            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                                <span className="material-symbols-outlined text-[14px]">warning</span>
                                                {selectedClients.length - clientsWithPhone.length} sin teléfono (se omitirán)
                                            </span>
                                        )}
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        <div className="rounded-lg bg-emerald-50 p-3 text-center dark:bg-emerald-900/10">
                                            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{clientsWithPhone.length}</p>
                                            <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium">Se enviarán</p>
                                        </div>
                                        <div className="rounded-lg bg-amber-50 p-3 text-center dark:bg-amber-900/10">
                                            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{selectedClients.length - clientsWithPhone.length}</p>
                                            <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium">Sin teléfono</p>
                                        </div>
                                        <div className="rounded-lg bg-sky-50 p-3 text-center dark:bg-sky-900/10">
                                            <p className="text-xl font-bold text-sky-700 dark:text-sky-400">{selectedClients.length}</p>
                                            <p className="text-[10px] text-sky-600 dark:text-sky-500 font-medium">Seleccionados</p>
                                        </div>
                                    </div>

                                    {/* Recipients list */}
                                    <div className="max-h-[250px] overflow-y-auto space-y-1">
                                        {selectedClients.map(client => (
                                            <div key={client.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-[10px] font-bold">
                                                    {client.company_name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{client.company_name}</p>
                                                    <p className="text-[10px] text-slate-400">{client.contact_name || ''}</p>
                                                </div>
                                                {client.phone ? (
                                                    <span className="text-xs text-slate-500">{client.phone}</span>
                                                ) : (
                                                    <span className="text-[10px] text-red-400 font-medium">Sin teléfono</span>
                                                )}
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[client.status]?.bg} ${STATUS_COLORS[client.status]?.text}`}>
                                                    {STATUS_LABELS[client.status]}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Preview + Send button */}
                            <div className="space-y-4">
                                {/* WhatsApp preview */}
                                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:bg-slate-900 dark:border-slate-800">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Vista Previa</h3>
                                    <div className="rounded-2xl bg-[#e5ddd5] p-4 dark:bg-slate-800">
                                        <div className="max-w-[260px] mx-auto">
                                            <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-slate-700">
                                                {selectedTemplate?.header_content && (
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{selectedTemplate.header_content}</p>
                                                )}
                                                <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap"
                                                    dangerouslySetInnerHTML={{ __html: renderBody(selectedTemplate?.body || '', selectedTemplate?.variables) }} />
                                                {selectedTemplate?.footer && (
                                                    <p className="text-[11px] text-slate-400 mt-2 italic">{selectedTemplate.footer}</p>
                                                )}
                                                <p className="text-[10px] text-slate-400 text-right mt-1">9:00 AM ✓✓</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Send button */}
                                {sending ? (
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:bg-emerald-900/10 dark:border-emerald-800">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Enviando mensajes...</p>
                                        </div>
                                        <div className="h-3 rounded-full bg-emerald-200 overflow-hidden dark:bg-emerald-800">
                                            <div className="h-3 rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${sendProgress}%` }} />
                                        </div>
                                        <p className="text-xs text-emerald-600 mt-2 text-center dark:text-emerald-400">{sendProgress}%</p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleSend}
                                        disabled={clientsWithPhone.length === 0}
                                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 text-sm font-bold text-white shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">send</span>
                                        Enviar a {clientsWithPhone.length} cliente{clientsWithPhone.length !== 1 ? 's' : ''}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Results Modal */}
            {showResults && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Resultados del Envío</h3>
                            <button onClick={() => { setShowResults(false); setSelectedIds(new Set()); setSelectedTemplate(null); setStep('template'); }}
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="rounded-lg bg-emerald-50 p-3 text-center dark:bg-emerald-900/10">
                                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{sendResults.filter(r => r.success).length}</p>
                                <p className="text-xs text-emerald-600 font-medium">Exitosos</p>
                            </div>
                            <div className="rounded-lg bg-red-50 p-3 text-center dark:bg-red-900/10">
                                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{sendResults.filter(r => !r.success).length}</p>
                                <p className="text-xs text-red-600 font-medium">Fallidos</p>
                            </div>
                        </div>

                        <div className="space-y-1">
                            {sendResults.map((result, i) => (
                                <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${result.success ? 'bg-emerald-50/50 dark:bg-emerald-900/5' : 'bg-red-50/50 dark:bg-red-900/5'}`}>
                                    <span className={`material-symbols-outlined text-[16px] ${result.success ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {result.success ? 'check_circle' : 'error'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{result.client.company_name}</p>
                                        <p className="text-[10px] text-slate-400">{result.client.phone}</p>
                                    </div>
                                    {result.error && <p className="text-[10px] text-red-500 max-w-[180px] truncate">{result.error}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
