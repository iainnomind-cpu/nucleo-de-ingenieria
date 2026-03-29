import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    Invoice, ProjectExpense,
    AGING_LABELS, AGING_COLORS,
    getAgingBucket, formatCurrencyFin, AgingBucket,
    EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_ICONS, ExpenseCategory,
} from '../../types/finance';

import { FieldExpense } from '../../types/projects';

export default function FinanceDashboard() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
    const [fieldExpenses, setFieldExpenses] = useState<FieldExpense[]>([]);
    const [fleetCostTotal, setFleetCostTotal] = useState(0);
    const [fleetExpensesRaw, setFleetExpensesRaw] = useState<{ projectId: string | null, cost: number }[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [invRes, expRes, fExpRes, vMilRes, vMntRes] = await Promise.all([
            supabase.from('invoices').select('*, client:clients(id, company_name), project:projects(id, project_number, title)').order('issue_date', { ascending: false }),
            supabase.from('project_expenses').select('*').order('expense_date', { ascending: false }),
            supabase.from('field_expenses').select('*').order('expense_date', { ascending: false }),
            supabase.from('vehicle_mileage').select('project_id, calculated_trip_cost'),
            supabase.from('vehicle_maintenance').select('project_id, cost')
        ]);
        setInvoices((invRes.data as Invoice[]) || []);
        setExpenses((expRes.data as ProjectExpense[]) || []);
        setFieldExpenses((fExpRes.data as FieldExpense[]) || []);

        const milCost = (vMilRes.data || []).reduce((sum, m) => sum + Number((m as any).calculated_trip_cost || 0), 0);
        const mntCost = (vMntRes.data || []).reduce((sum, m) => sum + Number((m as any).cost || 0), 0);
        setFleetCostTotal(milCost + mntCost);

        const rawFleet = [
            ...(vMilRes.data || []).map(m => ({ projectId: m.project_id, cost: Number((m as any).calculated_trip_cost || 0) })),
            ...(vMntRes.data || []).map(m => ({ projectId: m.project_id, cost: Number((m as any).cost || 0) }))
        ];
        setFleetExpensesRaw(rawFleet);

        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // KPIs
    const totalBilled = invoices.filter(i => i.status !== 'cancelled' && i.status !== 'draft').reduce((s, i) => s + i.total, 0);
    const totalCollected = invoices.reduce((s, i) => s + i.amount_paid, 0);
    const totalAR = invoices.filter(i => i.status !== 'cancelled' && i.status !== 'paid' && i.status !== 'draft').reduce((s, i) => s + i.balance, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalFieldExpenses = fieldExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const allExpensesTotal = totalExpenses + totalFieldExpenses + fleetCostTotal;
    const overdue = invoices.filter(i => i.status === 'overdue' || (i.balance > 0 && i.due_date < new Date().toISOString().split('T')[0] && i.status !== 'cancelled' && i.status !== 'paid'));

    // Aging report
    const arInvoices = invoices.filter(i => i.balance > 0 && i.status !== 'cancelled' && i.status !== 'draft');
    const aging: Record<AgingBucket, { count: number; total: number }> = {
        '0-30': { count: 0, total: 0 }, '30-60': { count: 0, total: 0 },
        '60-90': { count: 0, total: 0 }, '90+': { count: 0, total: 0 },
    };
    arInvoices.forEach(inv => {
        const bucket = getAgingBucket(inv.due_date);
        aging[bucket].count++;
        aging[bucket].total += inv.balance;
    });

    // Profitability by project
    const projectProfitability = invoices
        .filter(i => i.project_id && i.status !== 'cancelled')
        .reduce((acc, inv) => {
            if (!inv.project) return acc;
            const key = inv.project_id!;
            if (!acc[key]) acc[key] = { number: inv.project.project_number, title: inv.project.title, billed: 0, collected: 0, cost: 0 };
            acc[key].billed += inv.total;
            acc[key].collected += inv.amount_paid;
            return acc;
        }, {} as Record<string, { number: string; title: string; billed: number; collected: number; cost: number }>);
    // Add expenses
    expenses.forEach(exp => {
        if (projectProfitability[exp.project_id]) projectProfitability[exp.project_id].cost += exp.amount;
    });
    fieldExpenses.forEach(exp => {
        if (projectProfitability[exp.project_id]) projectProfitability[exp.project_id].cost += Number(exp.amount);
    });
    fleetExpensesRaw.forEach(exp => {
        if (exp.projectId && projectProfitability[exp.projectId]) projectProfitability[exp.projectId].cost += exp.cost;
    });

    const expByCategory = expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
    }, {} as Record<string, number>);

    // Field expense by employee
    const fieldExpByEmployee = fieldExpenses.reduce((acc, e) => {
        const name = e.employee_name || 'Sin asignar';
        acc[name] = (acc[name] || 0) + Number(e.amount);
        return acc;
    }, {} as Record<string, number>);

    const sectionClass = 'rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50';

    if (loading) return <div className="flex flex-1 items-center justify-center p-8"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Finanzas & Facturación</h2>
                    <p className="mt-1 text-sm text-slate-500">Visibilidad financiera en tiempo real.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => navigate('/finance/viaticos')} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                        <span className="material-symbols-outlined text-[18px]">receipt_long</span>Viáticos
                    </button>
                    <button onClick={() => navigate('/finance/invoices')} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                        <span className="material-symbols-outlined text-[18px]">receipt_long</span>Facturas
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {[
                    { label: 'Facturado Total', value: formatCurrencyFin(totalBilled), icon: 'receipt_long', color: 'from-sky-500 to-cyan-500' },
                    { label: 'Cobrado', value: formatCurrencyFin(totalCollected), icon: 'payments', color: 'from-emerald-500 to-teal-500' },
                    { label: 'Por Cobrar', value: formatCurrencyFin(totalAR), icon: 'account_balance_wallet', color: 'from-amber-500 to-orange-500' },
                    { label: 'Gastos Reales', value: formatCurrencyFin(allExpensesTotal), icon: 'trending_down', color: 'from-red-500 to-rose-500' },
                    { label: 'Facturas Vencidas', value: overdue.length.toString(), icon: 'warning', color: 'from-red-600 to-red-800' },
                ].map(k => (
                    <div key={k.label} className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between">
                            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k.label}</p><p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{k.value}</p></div>
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${k.color} shadow-lg`}><span className="material-symbols-outlined text-white text-[20px]">{k.icon}</span></div>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${k.color} opacity-60`} />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Aging Report */}
                <div className={sectionClass}>
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                        <span className="material-symbols-outlined text-amber-500 text-[20px]">schedule</span>
                        Cuentas por Cobrar — Aging Report
                    </h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {(Object.keys(aging) as AgingBucket[]).map(bucket => (
                            <div key={bucket} className="relative overflow-hidden rounded-lg border border-slate-200/60 p-4 dark:border-slate-700/60">
                                <p className="text-xs font-semibold text-slate-500">{AGING_LABELS[bucket]}</p>
                                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{formatCurrencyFin(aging[bucket].total)}</p>
                                <p className="mt-0.5 text-xs text-slate-400">{aging[bucket].count} factura(s)</p>
                                <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${AGING_COLORS[bucket]} opacity-60`} />
                            </div>
                        ))}
                    </div>
                    {arInvoices.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {arInvoices.slice(0, 5).map(inv => (
                                <div key={inv.id} onClick={() => navigate(`/finance/invoices/${inv.id}`)} className="flex items-center justify-between rounded-lg border border-slate-200/60 p-3 cursor-pointer hover:bg-slate-50/50 dark:border-slate-700/60">
                                    <div>
                                        <p className="font-mono text-xs font-bold text-primary">{inv.invoice_number}</p>
                                        <p className="text-xs text-slate-400">{inv.client?.company_name || '—'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-sm text-red-500">{formatCurrencyFin(inv.balance)}</p>
                                        <p className="text-xs text-slate-400">Vence: {new Date(inv.due_date).toLocaleDateString('es-MX')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Profitability by project */}
                <div className={sectionClass}>
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                        <span className="material-symbols-outlined text-emerald-500 text-[20px]">trending_up</span>
                        Rentabilidad por Proyecto
                    </h3>
                    {Object.keys(projectProfitability).length === 0 ? (
                        <div className="py-6 text-center text-sm text-slate-500">Sin datos de proyectos facturados.</div>
                    ) : (
                        <div className="space-y-3">
                            {Object.values(projectProfitability).map(p => {
                                const margin = p.billed > 0 ? ((p.billed - p.cost) / p.billed) * 100 : 0;
                                return (
                                    <div key={p.number} className="rounded-lg border border-slate-200/60 p-3 dark:border-slate-700/60">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-mono text-xs font-bold text-primary">{p.number}</p>
                                                <p className="text-xs text-slate-500 truncate max-w-[200px]">{p.title}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-lg font-bold ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{margin.toFixed(1)}%</p>
                                                <p className="text-xs text-slate-400">margen</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex gap-4 text-xs">
                                            <span className="text-slate-500">Facturado: <strong className="text-slate-900 dark:text-white">{formatCurrencyFin(p.billed)}</strong></span>
                                            <span className="text-slate-500">Costo: <strong className="text-red-500">{formatCurrencyFin(p.cost)}</strong></span>
                                            <span className="text-slate-500">Utilidad: <strong className={margin >= 0 ? 'text-emerald-600' : 'text-red-500'}>{formatCurrencyFin(p.billed - p.cost)}</strong></span>
                                        </div>
                                        <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${margin >= 30 ? 'bg-emerald-500' : margin >= 15 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(Math.max(margin, 0), 100)}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Expense breakdown */}
                <div className={sectionClass}>
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                        <span className="material-symbols-outlined text-red-500 text-[20px]">pie_chart</span>
                        Desglose de Gastos
                    </h3>
                    {Object.keys(expByCategory).length === 0 ? (
                        <div className="py-6 text-center text-sm text-slate-500">Sin gastos registrados.</div>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(expByCategory).sort(([, a], [, b]) => b - a).map(([cat, amount]) => {
                                const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                                return (
                                    <div key={cat} className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/20">
                                            <span className="material-symbols-outlined text-red-500 text-[16px]">{EXPENSE_CATEGORY_ICONS[cat as ExpenseCategory] || 'receipt'}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-xs"><span className="font-medium text-slate-700 dark:text-slate-300">{EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory] || cat}</span><span className="font-bold text-slate-900 dark:text-white">{formatCurrencyFin(amount)}</span></div>
                                            <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                <div className="h-full rounded-full bg-red-400" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                        <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Field Expenses by Employee */}
                <div className={sectionClass}>
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                        <span className="material-symbols-outlined text-orange-500 text-[20px]">badge</span>
                        Viáticos por Empleado
                    </h3>
                    {Object.keys(fieldExpByEmployee).length === 0 ? (
                        <div className="py-6 text-center text-sm text-slate-500">Sin viáticos registrados.</div>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(fieldExpByEmployee).sort(([, a], [, b]) => b - a).map(([emp, amount]) => {
                                const pct = totalFieldExpenses > 0 ? (amount / totalFieldExpenses) * 100 : 0;
                                return (
                                    <div key={emp} className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/20">
                                            <span className="material-symbols-outlined text-orange-500 text-[16px]">person</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-xs"><span className="font-medium text-slate-700 dark:text-slate-300">{emp}</span><span className="font-bold text-slate-900 dark:text-white">{formatCurrencyFin(amount)}</span></div>
                                            <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                <div className="h-full rounded-full bg-orange-400" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                        <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Cash flow summary */}
                <div className={sectionClass}>
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                        <span className="material-symbols-outlined text-sky-500 text-[20px]">account_balance</span>
                        Flujo de Caja
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/10">
                            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500 text-[20px]">arrow_downward</span><span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Ingresos (Cobrado)</span></div>
                            <span className="text-lg font-bold text-emerald-600">{formatCurrencyFin(totalCollected)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-red-50 p-4 dark:bg-red-900/10">
                            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-red-500 text-[20px]">arrow_upward</span><span className="text-sm font-medium text-red-700 dark:text-red-400">Egresos (Gastos)</span></div>
                            <span className="text-lg font-bold text-red-600">{formatCurrencyFin(allExpensesTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-primary/5 p-4 border border-primary/20">
                            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[20px]">account_balance</span><span className="text-sm font-bold text-primary">Flujo Neto</span></div>
                            <span className={`text-xl font-bold ${totalCollected - allExpensesTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrencyFin(totalCollected - allExpensesTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-amber-50/50 p-4 dark:bg-amber-900/10">
                            <div className="flex items-center gap-2"><span className="material-symbols-outlined text-amber-500 text-[20px]">pending</span><span className="text-sm font-medium text-amber-700 dark:text-amber-400">Pendiente de Cobro</span></div>
                            <span className="text-lg font-bold text-amber-600">{formatCurrencyFin(totalAR)}</span>
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-400 italic">* No incluye valor de inventario en utilidad operativa</p>
                </div>
            </div>
        </div>
    );
}
