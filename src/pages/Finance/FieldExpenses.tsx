import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { FieldExpense, EXPENSE_TYPE_LABELS, EXPENSE_TYPE_ICONS } from '../../types/projects';
import { formatCurrencyMXN } from '../../types/projects';

export default function FieldExpenses() {
    const [expenses, setExpenses] = useState<FieldExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [monthOffset, setMonthOffset] = useState(0);

    const fetchExpenses = useCallback(async () => {
        setLoading(true);
        // Calculate date range for the selected month
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);

        const { data } = await supabase
            .from('field_expenses')
            .select('*, project:projects(project_number, title)')
            .gte('expense_date', start.toISOString().split('T')[0])
            .lte('expense_date', end.toISOString().split('T')[0])
            .order('expense_date', { ascending: false });

        setExpenses((data as unknown as FieldExpense[]) || []);
        setLoading(false);
    }, [monthOffset]);

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

    const totalPeriod = expenses.reduce((s, e) => s + Number(e.amount), 0);

    const byEmployee = expenses.reduce((acc, e) => {
        acc[e.employee_name] = (acc[e.employee_name] || 0) + Number(e.amount);
        return acc;
    }, {} as Record<string, number>);

    const currentMonthLabel = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1)
        .toLocaleString('es-MX', { month: 'long', year: 'numeric' });

    if (loading) return <div className="flex flex-1 items-center justify-center p-8"><div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" /></div>;

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Gastos de Campo y Viáticos</h2>
                    <p className="text-sm text-slate-500">Control maestro de erogaciones operativas</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 rounded-lg bg-white p-1 shadow-sm dark:bg-slate-800">
                        <button onClick={() => setMonthOffset(prev => prev - 1)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700">
                            <span className="material-symbols-outlined text-slate-500 text-[20px]">chevron_left</span>
                        </button>
                        <span className="min-w-[120px] text-center text-sm font-semibold capitalize text-slate-700 dark:text-slate-300">
                            {currentMonthLabel}
                        </span>
                        <button onClick={() => setMonthOffset(prev => prev + 1)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700">
                            <span className="material-symbols-outlined text-slate-500 text-[20px]">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                {/* Resumen */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800/60 dark:bg-slate-900">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total del Período</p>
                        <p className="mt-1 text-3xl font-bold text-orange-500">{formatCurrencyMXN(totalPeriod)}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800/60 dark:bg-slate-900">
                        <h3 className="mb-4 text-sm font-bold flex items-center gap-2"><span className="material-symbols-outlined text-orange-500 text-[18px]">group</span>Desglose por Empleado</h3>
                        {Object.keys(byEmployee).length === 0 ? (
                            <p className="text-sm text-slate-500">Ninguno.</p>
                        ) : (
                            <div className="space-y-3">
                                {Object.entries(byEmployee).sort(([, a], [, b]) => b - a).map(([emp, amount]) => (
                                    <div key={emp} className="flex justify-between items-center text-sm">
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{emp}</span>
                                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrencyMXN(amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Lista Completa */}
                <div className="lg:col-span-3">
                    <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800/60 dark:bg-slate-900 overflow-hidden">
                        {expenses.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">No se registraron viáticos en este período.</div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-slate-500">Fecha</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500">Responsable</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500">Concepto</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500">Proyecto</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-center">Tkt</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 flex-1">
                                    {expenses.map(e => (
                                        <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">{new Date(e.expense_date).toLocaleDateString('es-MX')}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{e.employee_name}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                                                    <span className="material-symbols-outlined text-[16px]">{EXPENSE_TYPE_ICONS[e.expense_type] || 'payments'}</span>
                                                    <span className="text-xs font-semibold">{EXPENSE_TYPE_LABELS[e.expense_type] || e.expense_type}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                {/* @ts-ignore : mapped relation */}
                                                {e.project ? <span className="font-mono">{e.project.project_number}</span> : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {e.receipt_url && (
                                                    <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:text-sky-600"><span className="material-symbols-outlined text-[18px]">receipt</span></a>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{formatCurrencyMXN(e.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
