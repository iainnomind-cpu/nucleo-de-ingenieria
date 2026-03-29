import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    Invoice, InvoiceStatus, InvoiceType,
    INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS,
    INVOICE_TYPE_LABELS, formatCurrencyFin,
} from '../../types/finance';

export default function InvoicesList() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
    const [projects, setProjects] = useState<{ id: string; project_number: string; title: string }[]>([]);

    const [form, setForm] = useState({
        invoice_number: '', client_id: '', project_id: '', invoice_type: 'project' as InvoiceType,
        subtotal: '', tax_rate: '16', due_date: '', payment_terms: '30 días', notes: '',
        client_rfc: '', client_fiscal_name: '',
    });

    const fetchAll = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('invoices').select('*, client:clients(id, company_name), project:projects(id, project_number, title)').order('issue_date', { ascending: false });
        if (filter !== 'all') q = q.eq('status', filter);
        if (search.trim()) q = q.or(`invoice_number.ilike.%${search}%`);
        const [invRes, clRes, prRes] = await Promise.all([q, supabase.from('clients').select('id, company_name').order('company_name'), supabase.from('projects').select('id, project_number, title').order('project_number', { ascending: false })]);
        setInvoices((invRes.data as Invoice[]) || []);
        setClients(clRes.data || []);
        setProjects(prRes.data || []);
        setLoading(false);
    }, [filter, search]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const subtotal = parseFloat(form.subtotal) || 0;
        const taxRate = parseFloat(form.tax_rate) || 16;
        const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
        const total = subtotal + taxAmount;
        await supabase.from('invoices').insert({
            invoice_number: form.invoice_number, client_id: form.client_id || null, project_id: form.project_id || null,
            invoice_type: form.invoice_type, subtotal, tax_rate: taxRate, tax_amount: taxAmount,
            total, balance: total, due_date: form.due_date, payment_terms: form.payment_terms || null,
            notes: form.notes || null, client_rfc: form.client_rfc || null, client_fiscal_name: form.client_fiscal_name || null,
        });
        setShowForm(false);
        setForm({ invoice_number: '', client_id: '', project_id: '', invoice_type: 'project', subtotal: '', tax_rate: '16', due_date: '', payment_terms: '30 días', notes: '', client_rfc: '', client_fiscal_name: '' });
        fetchAll();
    };

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    const totalBilled = invoices.filter(i => i.status !== 'cancelled' && i.status !== 'draft').reduce((s, i) => s + i.total, 0);
    const totalPending = invoices.filter(i => i.balance > 0 && i.status !== 'cancelled').reduce((s, i) => s + i.balance, 0);

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/finance')} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Facturas</h2>
                        <p className="text-sm text-slate-500">Total: <strong>{formatCurrencyFin(totalBilled)}</strong> · Pendiente: <strong className="text-amber-500">{formatCurrencyFin(totalPending)}</strong></p>
                    </div>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md">
                    <span className="material-symbols-outlined text-[18px]">add</span>Nueva Factura
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input type="text" placeholder="Buscar por número de factura..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
                <div className="flex flex-wrap gap-2">
                    {(['all', 'draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'] as const).map(s => (
                        <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === s ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {s === 'all' ? 'Todas' : INVOICE_STATUS_LABELS[s]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="rounded-xl border border-primary/20 bg-primary/5 p-6">
                    <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Nueva Factura</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div><label className={labelClass}>No. Factura *</label><input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} required placeholder="FAC-2026-0001" className={inputClass} /></div>
                        <div><label className={labelClass}>Cliente</label><select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className={inputClass}><option value="">Sin cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select></div>
                        <div><label className={labelClass}>Proyecto</label><select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className={inputClass}><option value="">Sin proyecto</option>{projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>)}</select></div>
                        <div><label className={labelClass}>Tipo</label><select value={form.invoice_type} onChange={e => setForm({ ...form, invoice_type: e.target.value as InvoiceType })} className={inputClass}>{(Object.keys(INVOICE_TYPE_LABELS) as InvoiceType[]).map(t => <option key={t} value={t}>{INVOICE_TYPE_LABELS[t]}</option>)}</select></div>
                        <div><label className={labelClass}>Subtotal *</label><input type="number" step="0.01" value={form.subtotal} onChange={e => setForm({ ...form, subtotal: e.target.value })} required className={inputClass} placeholder="50000" /></div>
                        <div><label className={labelClass}>IVA %</label><input type="number" step="0.01" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>Fecha Vencimiento *</label><input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} required className={inputClass} /></div>
                        <div><label className={labelClass}>Condiciones Pago</label><input value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>RFC Cliente</label><input value={form.client_rfc} onChange={e => setForm({ ...form, client_rfc: e.target.value })} placeholder="XAXX010101000" className={inputClass} /></div>
                        <div><label className={labelClass}>Razón Social</label><input value={form.client_fiscal_name} onChange={e => setForm({ ...form, client_fiscal_name: e.target.value })} className={inputClass} /></div>
                    </div>
                    <div className="mt-4 flex gap-2"><button type="submit" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">Crear Factura</button><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500">Cancelar</button></div>
                </form>
            )}

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : invoices.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12"><span className="material-symbols-outlined text-[48px] text-slate-300">receipt_long</span><p className="text-sm text-slate-500">No hay facturas.</p></div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white/50 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500">Factura</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500">Cliente</th>
                                <th className="px-4 py-3 text-center font-semibold text-slate-500">Tipo</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500">Total</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500">Pagado</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500">Saldo</th>
                                <th className="px-4 py-3 text-center font-semibold text-slate-500">Vence</th>
                                <th className="px-4 py-3 text-center font-semibold text-slate-500">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {invoices.map(inv => (
                                <tr key={inv.id} onClick={() => navigate(`/finance/invoices/${inv.id}`)} className="cursor-pointer transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                                    <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{inv.invoice_number}</td>
                                    <td className="px-4 py-3 text-slate-900 dark:text-white">{inv.client?.company_name || '—'}</td>
                                    <td className="px-4 py-3 text-center text-xs text-slate-500">{INVOICE_TYPE_LABELS[inv.invoice_type]}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{formatCurrencyFin(inv.total)}</td>
                                    <td className="px-4 py-3 text-right text-emerald-600">{formatCurrencyFin(inv.amount_paid)}</td>
                                    <td className={`px-4 py-3 text-right font-bold ${inv.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{formatCurrencyFin(inv.balance)}</td>
                                    <td className="px-4 py-3 text-center text-xs text-slate-400">{new Date(inv.due_date).toLocaleDateString('es-MX')}</td>
                                    <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${(INVOICE_STATUS_COLORS[inv.status] || { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500' }).bg} ${(INVOICE_STATUS_COLORS[inv.status] || { bg: '', text: 'text-slate-500' }).text}`}>{INVOICE_STATUS_LABELS[inv.status] || inv.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
