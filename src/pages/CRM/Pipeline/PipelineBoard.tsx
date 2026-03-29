import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import {
    SalesOpportunity,
    Client,
    PipelineStage,
    STAGE_LABELS,
    STAGE_COLORS,
} from '../../../types/crm';

const PIPELINE_STAGES: PipelineStage[] = [
    'prospecting',
    'quoting',
    'negotiation',
    'closed_won',
    'closed_lost',
];

const STAGE_ICONS: Record<PipelineStage, string> = {
    prospecting: 'person_search',
    quoting: 'request_quote',
    negotiation: 'handshake',
    closed_won: 'check_circle',
    closed_lost: 'cancel',
};

interface OpportunityWithClient extends SalesOpportunity {
    client?: Client;
}

export default function PipelineBoard() {
    const navigate = useNavigate();
    const [opportunities, setOpportunities] = useState<OpportunityWithClient[]>([]);
    const [clients, setClients] = useState<Pick<Client, 'id' | 'company_name'>[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        client_id: '',
        title: '',
        description: '',
        estimated_value: '',
        probability: '50',
        stage: 'prospecting' as PipelineStage,
        closing_date: '',
    });

    const fetchOpportunities = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('sales_opportunities')
            .select('*, client:clients(*)')
            .order('updated_at', { ascending: false });
        setOpportunities((data as OpportunityWithClient[]) || []);
        setLoading(false);
    }, []);

    const fetchClients = useCallback(async () => {
        const { data } = await supabase.from('clients').select('id, company_name').order('company_name');
        setClients(data || []);
    }, []);

    useEffect(() => {
        fetchOpportunities();
        fetchClients();
    }, [fetchOpportunities, fetchClients]);

    const handleStageChange = async (oppId: string, newStage: PipelineStage) => {
        await supabase.from('sales_opportunities').update({ stage: newStage }).eq('id', oppId);

        // → M1→M8: Deal closed notification
        if (newStage === 'closed_won') {
            const opp = opportunities.find(o => o.id === oppId);
            if (opp) {
                const spaceName = `Cliente — ${opp.client?.company_name || 'N/A'}`;
                const { data: existingSpace } = await supabase.from('spaces').select('id').ilike('name', `%${opp.client?.company_name}%`).limit(1);
                let spaceId = existingSpace?.[0]?.id;

                if (!spaceId) {
                    const { data: newSpace } = await supabase.from('spaces').insert({
                        name: spaceName,
                        space_type: 'client',
                        description: `Space del cliente ${opp.client?.company_name}`,
                        members: ['Alejandro', 'Director', 'Samara'],
                        is_archived: false
                    }).select().single();
                    spaceId = newSpace?.id;
                }

                if (spaceId) {
                    await supabase.from('messages').insert({
                        space_id: spaceId,
                        sender_id: '12345678-1234-1234-1234-123456789012',
                        content: `🎉 **¡VENTA CERRADA (M1→M8)!**\n\nSe ha ganado la oportunidad: **${opp.title}**\n💰 Valor Total: **${formatCurrency(opp.estimated_value || 0)}**\n📅 Fecha de cierre: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n*A prepararse para el arranque del proyecto.*`,
                        message_type: 'text'
                    });
                }
            }
        }

        fetchOpportunities();
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('sales_opportunities').insert({
            client_id: form.client_id,
            title: form.title,
            description: form.description || null,
            estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
            probability: parseInt(form.probability),
            stage: form.stage,
            closing_date: form.closing_date || null,
        });
        if (error) {
            alert('Error: ' + error.message);
        } else {
            setShowForm(false);
            setForm({ client_id: '', title: '', description: '', estimated_value: '', probability: '50', stage: 'prospecting', closing_date: '' });
            fetchOpportunities();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta oportunidad?')) return;
        await supabase.from('sales_opportunities').delete().eq('id', id);
        fetchOpportunities();
    };

    const groupedByStage = PIPELINE_STAGES.reduce((acc, stage) => {
        acc[stage] = opportunities.filter((o) => o.stage === stage);
        return acc;
    }, {} as Record<PipelineStage, OpportunityWithClient[]>);

    const totalValue = opportunities
        .filter((o) => o.stage !== 'closed_lost')
        .reduce((sum, o) => sum + (o.estimated_value || 0), 0);

    const wonValue = opportunities
        .filter((o) => o.stage === 'closed_won')
        .reduce((sum, o) => sum + (o.estimated_value || 0), 0);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);

    const inputClass =
        'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                        Pipeline de Ventas
                    </h2>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        Gestiona el embudo de ventas desde la prospección hasta el cierre.
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:shadow-lg"
                >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Nueva Oportunidad
                </button>
            </div>

            {/* Pipeline KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                    <p className="text-xs font-semibold uppercase text-slate-400">Oportunidades Activas</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                        {opportunities.filter((o) => !['closed_won', 'closed_lost'].includes(o.stage)).length}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                    <p className="text-xs font-semibold uppercase text-slate-400">Valor Total Pipeline</p>
                    <p className="mt-1 text-2xl font-bold text-primary">{formatCurrency(totalValue)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                    <p className="text-xs font-semibold uppercase text-slate-400">Cerrados Ganados</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-500">{formatCurrency(wonValue)}</p>
                </div>
            </div>

            {/* New Opportunity Form */}
            {showForm && (
                <form onSubmit={handleCreate} className="rounded-xl border border-primary/20 bg-primary/5 p-6 dark:bg-primary/5">
                    <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Nueva Oportunidad</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                            <label className={labelClass}>Cliente *</label>
                            <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required className={inputClass}>
                                <option value="">Seleccionar cliente...</option>
                                {clients.map((c) => (
                                    <option key={c.id} value={c.id}>{c.company_name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Título *</label>
                            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Ej: Cotización bombeo" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Valor Estimado</label>
                            <input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} placeholder="150000" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Probabilidad (%)</label>
                            <input type="number" min="0" max="100" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Etapa</label>
                            <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as PipelineStage })} className={inputClass}>
                                {PIPELINE_STAGES.filter((s) => s !== 'closed_lost').map((s) => (
                                    <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Fecha de Cierre</label>
                            <input type="date" value={form.closing_date} onChange={(e) => setForm({ ...form, closing_date: e.target.value })} className={inputClass} />
                        </div>
                        <div className="md:col-span-3">
                            <label className={labelClass}>Descripción</label>
                            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Detalles de la oportunidad..." className={inputClass + ' resize-none'} />
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button type="submit" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">Crear</button>
                        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-400">Cancelar</button>
                    </div>
                </form>
            )}

            {/* Kanban Board */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
                    {PIPELINE_STAGES.map((stage) => {
                        const stageTotal = groupedByStage[stage].reduce((s, o) => s + (o.estimated_value || 0), 0);
                        return (
                            <div
                                key={stage}
                                className={`flex flex-col rounded-xl border ${STAGE_COLORS[stage].border} ${STAGE_COLORS[stage].bg} min-h-[300px]`}
                            >
                                {/* Column Header */}
                                <div className="flex items-center justify-between border-b border-slate-200/40 px-4 py-3 dark:border-slate-700/40">
                                    <div className="flex items-center gap-2">
                                        <span className={`material-symbols-outlined text-[20px] ${STAGE_COLORS[stage].text}`}>
                                            {STAGE_ICONS[stage]}
                                        </span>
                                        <h3 className={`text-sm font-bold ${STAGE_COLORS[stage].text}`}>
                                            {STAGE_LABELS[stage]}
                                        </h3>
                                    </div>
                                    <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                                        {groupedByStage[stage].length}
                                    </span>
                                </div>

                                {/* Stage Value */}
                                {stageTotal > 0 && (
                                    <div className="px-4 py-2">
                                        <p className="text-xs font-semibold text-slate-500">{formatCurrency(stageTotal)}</p>
                                    </div>
                                )}

                                {/* Cards */}
                                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                                    {groupedByStage[stage].length === 0 ? (
                                        <div className="flex flex-1 items-center justify-center">
                                            <p className="text-xs text-slate-400">Sin oportunidades</p>
                                        </div>
                                    ) : (
                                        groupedByStage[stage].map((opp) => (
                                            <div
                                                key={opp.id}
                                                className="group cursor-pointer rounded-lg border border-slate-200/60 bg-white p-3 shadow-sm transition-all hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800/80"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{opp.title}</p>
                                                        <p
                                                            className="mt-0.5 cursor-pointer text-xs text-primary hover:underline"
                                                            onClick={() => navigate(`/crm/${opp.client_id}`)}
                                                        >
                                                            {opp.client?.company_name || 'Cliente'}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDelete(opp.id)}
                                                        className="rounded p-1 text-slate-400 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                                    </button>
                                                </div>

                                                {opp.estimated_value && (
                                                    <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                                                        {formatCurrency(opp.estimated_value)}
                                                    </p>
                                                )}

                                                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                                                    <span>{opp.probability}%</span>
                                                    {opp.closing_date && (
                                                        <span>{new Date(opp.closing_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</span>
                                                    )}
                                                </div>

                                                {/* Quick Stage Move */}
                                                <div className="mt-3 flex gap-1 border-t border-slate-100 pt-2 dark:border-slate-700">
                                                    {PIPELINE_STAGES.filter((s) => s !== stage).map((s) => (
                                                        <button
                                                            key={s}
                                                            onClick={() => handleStageChange(opp.id, s)}
                                                            title={STAGE_LABELS[s]}
                                                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${STAGE_COLORS[s].text} hover:${STAGE_COLORS[s].bg}`}
                                                        >
                                                            {STAGE_LABELS[s].substring(0, 3)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
