import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    Quote,
    QuoteStatus,
    QUOTE_STATUS_LABELS,
    QUOTE_STATUS_COLORS,
    formatCurrency,
} from '../../types/quotes';

const STATUS_OPTIONS: QuoteStatus[] = ['draft', 'sent', 'negotiation', 'approved', 'rejected', 'converted'];

export default function QuotesList() {
    const navigate = useNavigate();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<QuoteStatus | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchQuotes = useCallback(async () => {
        setLoading(true);
        let q = supabase
            .from('quotes')
            .select('*, client:clients(id, company_name, contact_name)')
            .order('created_at', { ascending: false });

        if (filterStatus !== 'all') q = q.eq('status', filterStatus);
        if (searchTerm.trim()) q = q.or(`title.ilike.%${searchTerm}%,quote_number.ilike.%${searchTerm}%`);

        const { data } = await q;
        setQuotes((data as Quote[]) || []);
        setLoading(false);
    }, [filterStatus, searchTerm]);

    useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta cotización?')) return;
        await supabase.from('quote_items').delete().eq('quote_id', id);
        await supabase.from('quotes').delete().eq('id', id);
        fetchQuotes();
    };

    // KPIs
    const totalQuotes = quotes.length;
    const totalValue = quotes.filter(q => q.status !== 'rejected').reduce((s, q) => s + q.total, 0);
    const approvedValue = quotes.filter(q => q.status === 'approved' || q.status === 'converted').reduce((s, q) => s + q.total, 0);
    const pendingCount = quotes.filter(q => ['draft', 'sent', 'negotiation'].includes(q.status)).length;

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                        Cotizaciones
                    </h2>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        Historial y gestión de cotizaciones generadas.
                    </p>
                </div>
                <button onClick={() => navigate('/quotes/new')}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Nueva Cotización
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: 'Total Cotizaciones', value: totalQuotes.toString(), icon: 'description', color: 'from-sky-500 to-cyan-500' },
                    { label: 'Valor Total', value: formatCurrency(totalValue), icon: 'payments', color: 'from-emerald-500 to-teal-500' },
                    { label: 'Aprobadas', value: formatCurrency(approvedValue), icon: 'verified', color: 'from-violet-500 to-purple-500' },
                    { label: 'Pendientes', value: pendingCount.toString(), icon: 'pending', color: 'from-amber-500 to-orange-500' },
                ].map(k => (
                    <div key={k.label} className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{k.label}</p>
                                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{k.value}</p>
                            </div>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${k.color} shadow-lg`}>
                                <span className="material-symbols-outlined text-white text-[24px]">{k.icon}</span>
                            </div>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${k.color} opacity-60`} />
                    </div>
                ))}
            </div>

            {/* Search & Filters */}
            <div className="rounded-xl border border-slate-200/60 bg-white/50 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full md:max-w-md">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input type="text" placeholder="Buscar por número o título..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setFilterStatus('all')}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${filterStatus === 'all' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>Todas</button>
                        {STATUS_OPTIONS.map(s => (
                            <button key={s} onClick={() => setFilterStatus(s)}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${filterStatus === s ? `${QUOTE_STATUS_COLORS[s].bg} ${QUOTE_STATUS_COLORS[s].text}` : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                {QUOTE_STATUS_LABELS[s]}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-t border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-3.5 font-semibold text-slate-500">N° Cotización</th>
                                <th className="px-6 py-3.5 font-semibold text-slate-500">Título</th>
                                <th className="px-6 py-3.5 font-semibold text-slate-500">Cliente</th>
                                <th className="px-6 py-3.5 font-semibold text-slate-500">Estado</th>
                                <th className="px-6 py-3.5 font-semibold text-slate-500">Versión</th>
                                <th className="px-6 py-3.5 font-semibold text-slate-500">Total</th>
                                <th className="px-6 py-3.5 font-semibold text-slate-500">Fecha</th>
                                <th className="px-6 py-3.5 text-right font-semibold text-slate-500">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={8} className="px-6 py-12 text-center"><div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" /></td></tr>
                            ) : quotes.length === 0 ? (
                                <tr><td colSpan={8} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600">request_quote</span>
                                        <p className="text-sm text-slate-500">No hay cotizaciones aún.</p>
                                        <button onClick={() => navigate('/quotes/new')} className="text-sm font-semibold text-primary hover:underline">Crear primera cotización</button>
                                    </div>
                                </td></tr>
                            ) : quotes.map(q => (
                                <tr key={q.id} className="group cursor-pointer transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50" onClick={() => navigate(`/quotes/${q.id}`)}>
                                    <td className="px-6 py-4 font-mono text-xs font-bold text-primary">{q.quote_number}</td>
                                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{q.title}</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{q.client?.company_name || '—'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${QUOTE_STATUS_COLORS[q.status].bg} ${QUOTE_STATUS_COLORS[q.status].text}`}>
                                            {QUOTE_STATUS_LABELS[q.status]}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">v{q.version}</td>
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{formatCurrency(q.total)}</td>
                                    <td className="px-6 py-4 text-xs text-slate-400">{new Date(q.created_at).toLocaleDateString('es-MX')}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={e => { e.stopPropagation(); navigate(`/quotes/${q.id}`); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-700" title="Ver">
                                                <span className="material-symbols-outlined text-[20px]">visibility</span>
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); handleDelete(q.id); }} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20" title="Eliminar">
                                                <span className="material-symbols-outlined text-[20px]">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
