import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    MaintenanceContract, ContractStatus, BillingType,
    CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS,
    BILLING_TYPE_LABELS,
    formatCurrencyMaint, getDaysUntil, getUrgencyColor,
} from '../../types/maintenance';

export default function ContractsList() {
    const navigate = useNavigate();
    const [contracts, setContracts] = useState<MaintenanceContract[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);

    const [form, setForm] = useState({
        client_id: '', title: '', contract_number: '', billing_type: 'monthly' as BillingType,
        monthly_amount: '', annual_amount: '', start_date: '', end_date: '', auto_renew: false, description: '',
    });

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [cRes, clRes] = await Promise.all([
            supabase.from('maintenance_contracts').select('*, client:clients(id, company_name)').order('start_date', { ascending: false }),
            supabase.from('clients').select('id, company_name').order('company_name'),
        ]);
        setContracts((cRes.data as MaintenanceContract[]) || []);
        setClients(clRes.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from('maintenance_contracts').insert({
            client_id: form.client_id || null, title: form.title, contract_number: form.contract_number || null,
            billing_type: form.billing_type, monthly_amount: parseFloat(form.monthly_amount) || 0,
            annual_amount: parseFloat(form.annual_amount) || 0, start_date: form.start_date,
            end_date: form.end_date || null, auto_renew: form.auto_renew, description: form.description || null,
        });
        setShowForm(false);
        setForm({ client_id: '', title: '', contract_number: '', billing_type: 'monthly', monthly_amount: '', annual_amount: '', start_date: '', end_date: '', auto_renew: false, description: '' });
        fetchAll();
    };

    const updateStatus = async (id: string, status: ContractStatus) => {
        await supabase.from('maintenance_contracts').update({ status }).eq('id', id);
        fetchAll();
    };

    // → M6: Generate recurring monthly invoice from contract
    const handleGenerateMonthlyInvoice = async (contract: MaintenanceContract) => {
        if (!contract.client_id || contract.monthly_amount <= 0) {
            alert('Este contrato no tiene cliente o monto mensual configurado.');
            return;
        }

        const now = new Date();
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const monthLabel = monthNames[now.getMonth()];
        const year = now.getFullYear();

        const { count: totalInvoices } = await supabase.from('invoices').select('*', { count: 'exact', head: true });
        const invNumber = `CMT-${year}-${String((totalInvoices || 0) + 1).padStart(4, '0')}`;

        const amount = contract.monthly_amount;
        const { data: invData, error } = await supabase.from('invoices').insert({
            client_id: contract.client_id,
            invoice_number: invNumber,
            issue_date: now.toISOString().split('T')[0],
            due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            subtotal: amount / 1.16,
            tax_amount: amount - (amount / 1.16),
            total: amount,
            amount_paid: 0,
            balance: amount,
            status: 'pending',
            currency: 'MXN',
            notes: `Factura recurrente (M5→M6): ${contract.title} — ${monthLabel} ${year}. Contrato: ${contract.contract_number || 'S/N'}`,
        }).select().single();

        if (error) {
            alert('Error al generar factura: ' + error.message);
        } else if (invData) {
            alert(`✅ Factura ${invNumber} generada por ${formatCurrencyMaint(amount)} para ${monthLabel} ${year} (M6).`);
        }
    };

    const activeContracts = contracts.filter(c => c.status === 'active');
    const totalMRR = activeContracts.reduce((s, c) => s + c.monthly_amount, 0);

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/maintenance')} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Contratos de Mantenimiento</h2>
                        <p className="text-sm text-slate-500">{activeContracts.length} activos · MRR: <strong className="text-primary">{formatCurrencyMaint(totalMRR)}</strong>/mes</p>
                    </div>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md">
                    <span className="material-symbols-outlined text-[18px]">add</span>Nuevo Contrato
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                    { label: 'Contratos Activos', value: activeContracts.length.toString(), icon: 'description', color: 'from-emerald-500 to-teal-500' },
                    { label: 'Ingreso Recurrente Mensual', value: formatCurrencyMaint(totalMRR), icon: 'trending_up', color: 'from-primary to-primary-dark' },
                    { label: 'Ingreso Recurrente Anual', value: formatCurrencyMaint(totalMRR * 12), icon: 'account_balance', color: 'from-violet-500 to-purple-500' },
                ].map(k => (
                    <div key={k.label} className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white/70 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between">
                            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k.label}</p><p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{k.value}</p></div>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${k.color} shadow-lg`}><span className="material-symbols-outlined text-white text-[24px]">{k.icon}</span></div>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${k.color} opacity-60`} />
                    </div>
                ))}
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="rounded-xl border border-primary/20 bg-primary/5 p-6">
                    <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Nuevo Contrato</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="md:col-span-2"><label className={labelClass}>Título *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Contrato Mant. Preventivo — Rancho El Mirador" className={inputClass} /></div>
                        <div><label className={labelClass}>No. Contrato</label><input value={form.contract_number} onChange={e => setForm({ ...form, contract_number: e.target.value })} placeholder="CMT-2026-001" className={inputClass} /></div>
                        <div><label className={labelClass}>Cliente</label><select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className={inputClass}><option value="">Sin cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select></div>
                        <div><label className={labelClass}>Tipo Facturación</label><select value={form.billing_type} onChange={e => setForm({ ...form, billing_type: e.target.value as BillingType })} className={inputClass}>{(Object.keys(BILLING_TYPE_LABELS) as BillingType[]).map(b => <option key={b} value={b}>{BILLING_TYPE_LABELS[b]}</option>)}</select></div>
                        <div><label className={labelClass}>Monto Mensual</label><input type="number" step="0.01" value={form.monthly_amount} onChange={e => setForm({ ...form, monthly_amount: e.target.value })} className={inputClass} placeholder="15000" /></div>
                        <div><label className={labelClass}>Inicio *</label><input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required className={inputClass} /></div>
                        <div><label className={labelClass}>Fin</label><input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className={inputClass} /></div>
                        <div className="flex items-end gap-2"><label className="flex items-center gap-2 cursor-pointer py-2"><input type="checkbox" checked={form.auto_renew} onChange={e => setForm({ ...form, auto_renew: e.target.checked })} className="rounded" /><span className="text-sm text-slate-600 dark:text-slate-400">Auto-renovar</span></label></div>
                    </div>
                    <div className="mt-4 flex gap-2"><button type="submit" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">Crear Contrato</button><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500">Cancelar</button></div>
                </form>
            )}

            {loading ? (
                <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : contracts.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12"><span className="material-symbols-outlined text-[48px] text-slate-300">description</span><p className="text-sm text-slate-500">No hay contratos.</p></div>
            ) : (
                <div className="space-y-4">
                    {contracts.map(c => {
                        const endDays = c.end_date ? getDaysUntil(c.end_date) : null;
                        return (
                            <div key={c.id} className="rounded-xl border border-slate-200/60 bg-white/70 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                            <span className="material-symbols-outlined text-primary text-[20px]">description</span>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-slate-900 dark:text-white">{c.title}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                                {c.contract_number && <span className="font-mono">{c.contract_number}</span>}
                                                {c.client?.company_name && <span>· {c.client.company_name}</span>}
                                                <span>· {BILLING_TYPE_LABELS[c.billing_type]}</span>
                                                {c.auto_renew && <span className="text-primary">🔄 Auto-renovación</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-primary">{formatCurrencyMaint(c.monthly_amount)}<span className="text-xs text-slate-400 font-normal">/mes</span></p>
                                            {endDays !== null && <p className={`text-xs font-bold ${getUrgencyColor(endDays)}`}>{endDays > 0 ? `${endDays}d restantes` : 'Expirado'}</p>}
                                        </div>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CONTRACT_STATUS_COLORS[c.status].bg} ${CONTRACT_STATUS_COLORS[c.status].text}`}>{CONTRACT_STATUS_LABELS[c.status]}</span>
                                        <div className="flex gap-1">
                                            {c.status === 'draft' && <button onClick={() => updateStatus(c.id, 'active')} className="rounded p-1 text-emerald-500 hover:bg-emerald-50" title="Activar"><span className="material-symbols-outlined text-[18px]">check_circle</span></button>}
                                            {c.status === 'active' && <button onClick={() => handleGenerateMonthlyInvoice(c)} className="rounded p-1 text-primary hover:bg-primary/10" title="Facturar Mes (M6)"><span className="material-symbols-outlined text-[18px]">receipt_long</span></button>}
                                            {c.status === 'active' && <button onClick={() => updateStatus(c.id, 'paused')} className="rounded p-1 text-amber-500 hover:bg-amber-50" title="Pausar"><span className="material-symbols-outlined text-[18px]">pause_circle</span></button>}
                                            {c.status === 'paused' && <button onClick={() => updateStatus(c.id, 'active')} className="rounded p-1 text-emerald-500 hover:bg-emerald-50" title="Reactivar"><span className="material-symbols-outlined text-[18px]">play_circle</span></button>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
