import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { FieldExpense, EXPENSE_TYPE_LABELS, EXPENSE_TYPE_ICONS } from '../../types/projects';
import { formatCurrencyMXN } from '../../types/projects';

type ExpenseType = keyof typeof EXPENSE_TYPE_LABELS;

const defaultForm = { employee_name: '', expense_type: 'viaticos' as ExpenseType, amount: '', expense_date: new Date().toISOString().split('T')[0], project_id: '', description: '', receipt_url: '' };

export default function FieldExpenses() {
    const [expenses, setExpenses] = useState<FieldExpense[]>([]);
    const [projects, setProjects] = useState<{ id: string; project_number: string; title: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [monthOffset, setMonthOffset] = useState(0);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(defaultForm);

    const fetchExpenses = useCallback(async () => {
        setLoading(true);
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);

        const [expRes, projRes] = await Promise.all([
            supabase.from('field_expenses').select('*, project:projects(project_number, title)')
                .gte('expense_date', start.toISOString().split('T')[0])
                .lte('expense_date', end.toISOString().split('T')[0])
                .order('expense_date', { ascending: false }),
            supabase.from('projects').select('id, project_number, title').order('project_number', { ascending: false }),
        ]);

        setExpenses((expRes.data as unknown as FieldExpense[]) || []);
        setProjects(projRes.data || []);
        setLoading(false);
    }, [monthOffset]);

    useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            employee_name: form.employee_name,
            expense_type: form.expense_type,
            amount: parseFloat(form.amount) || 0,
            expense_date: form.expense_date,
            project_id: form.project_id || null,
            description: form.description || null,
            receipt_url: form.receipt_url || null,
        };
        if (editingId) {
            await supabase.from('field_expenses').update(payload).eq('id', editingId);
        } else {
            await supabase.from('field_expenses').insert(payload);
        }
        setShowForm(false);
        setEditingId(null);
        setForm(defaultForm);
        fetchExpenses();
    };

    const handleEdit = (exp: FieldExpense) => {
        setForm({
            employee_name: exp.employee_name,
            expense_type: exp.expense_type as ExpenseType,
            amount: String(exp.amount),
            expense_date: exp.expense_date,
            project_id: exp.project_id || '',
            description: exp.description || '',
            receipt_url: exp.receipt_url || '',
        });
        setEditingId(exp.id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar este registro de viático?')) return;
        await supabase.from('field_expenses').delete().eq('id', id);
        fetchExpenses();
    };

    const totalPeriod = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const byEmployee = expenses.reduce((acc, e) => {
        acc[e.employee_name] = (acc[e.employee_name] || 0) + Number(e.amount);
        return acc;
    }, {} as Record<string, number>);
    const currentMonthLabel = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1)
        .toLocaleString('es-MX', { month: 'long', year: 'numeric' });

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

    if (loading) return <div className="flex flex-1 items-center justify-center p-8"><div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" /></div>;

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Gastos de Campo y Viáticos</h2>
                    <p className="text-sm text-slate-500">Control maestro de erogaciones operativas</p>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => { setEditingId(null); setForm(defaultForm); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">add</span>Nuevo Viático
                    </button>
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

            {/* Add / Edit form modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{editingId ? 'Editar Viático' : 'Nuevo Viático'}</h3>
                            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(defaultForm); }} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2"><label className={labelClass}>Responsable *</label><input required value={form.employee_name} onChange={e => setForm({ ...form, employee_name: e.target.value })} className={inputClass} placeholder="Nombre del empleado" /></div>
                                <div><label className={labelClass}>Tipo de Gasto *</label>
                                    <select value={form.expense_type} onChange={e => setForm({ ...form, expense_type: e.target.value as ExpenseType })} className={inputClass}>
                                        {Object.entries(EXPENSE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                                <div><label className={labelClass}>Monto *</label><input required type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={inputClass} placeholder="0.00" /></div>
                                <div><label className={labelClass}>Fecha *</label><input required type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} className={inputClass} /></div>
                                <div><label className={labelClass}>Proyecto</label>
                                    <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className={inputClass}>
                                        <option value="">— Sin proyecto —</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} - {p.title}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2"><label className={labelClass}>Descripción</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="Detalle del gasto..." /></div>
                                <div className="col-span-2"><label className={labelClass}>URL Ticket / Recibo</label><input value={form.receipt_url} onChange={e => setForm({ ...form, receipt_url: e.target.value })} className={inputClass} placeholder="https://..." /></div>
                            </div>
                            <button type="submit" className="w-full rounded-lg bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600">{editingId ? 'Actualizar Viático' : 'Guardar Viático'}</button>
                        </form>
                    </div>
                </div>
            )}

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
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-center w-20">Acciones</th>
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
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => handleEdit(e)} className="rounded p-1 text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors" title="Editar">
                                                        <span className="material-symbols-outlined text-[16px]">edit</span>
                                                    </button>
                                                    <button onClick={() => handleDelete(e.id)} className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Eliminar">
                                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                                    </button>
                                                </div>
                                            </td>
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
