import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { FieldExpense, EXPENSE_TYPE_LABELS, EXPENSE_TYPE_ICONS } from '../../types/projects';
import { formatCurrencyMXN } from '../../types/projects';

type ExpenseType = keyof typeof EXPENSE_TYPE_LABELS;

interface Advance {
    id: string;
    employee_name: string;
    amount: number;
    date: string;
    notes: string;
}

const defaultForm = { employee_name: '', expense_type: 'viaticos' as ExpenseType, amount: '', expense_date: new Date().toISOString().split('T')[0], project_id: '', area_destination: '', payment_method: 'transfer' as 'transfer' | 'card' | 'cash', folio_fiscal: '', description: '', receipt_url: '' };
const defaultAdvanceForm = { employee_name: '', amount: '', date: new Date().toISOString().split('T')[0], notes: '' };

export default function FieldExpenses() {
    const navigate = useNavigate();
    
    const [expenses, setExpenses] = useState<FieldExpense[]>([]);
    const [advances, setAdvances] = useState<Advance[]>([]);
    const [allTimeExpenses, setAllTimeExpenses] = useState<FieldExpense[]>([]);
    const [allTimeAdvances, setAllTimeAdvances] = useState<Advance[]>([]);
    
    const [projects, setProjects] = useState<{ id: string; project_number: string; title: string }[]>([]);
    const [weeklyBudget, setWeeklyBudget] = useState<{ id: string; amount: number } | null>(null);
    
    const [loading, setLoading] = useState(true);
    const [weekOffset, setWeekOffset] = useState(0);
    
    const [showForm, setShowForm] = useState(false);
    const [showAdvanceForm, setShowAdvanceForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(defaultForm);
    const [advanceForm, setAdvanceForm] = useState(defaultAdvanceForm);

    const getWeekRange = useCallback((offset: number) => {
        const now = new Date();
        const day = now.getDay();
        const diffToFriday = (day < 5 ? 7 : 0) + day - 5;
        const start = new Date(now);
        start.setDate(now.getDate() - diffToFriday + (offset * 7));
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        
        return { 
            start, 
            end, 
            startStr: start.toISOString().split('T')[0], 
            endStr: end.toISOString().split('T')[0] 
        };
    }, []);

    const fetchExpenses = useCallback(async () => {
        setLoading(true);
        const { startStr, endStr } = getWeekRange(weekOffset);

        const [expRes, advRes, allExpRes, allAdvRes, projRes, budgetRes] = await Promise.all([
            supabase.from('field_expenses').select('*, project:projects(project_number, title)')
                .gte('expense_date', startStr)
                .lte('expense_date', endStr)
                .order('expense_date', { ascending: false }),
            supabase.from('field_advances').select('*')
                .gte('date', startStr)
                .lte('date', endStr)
                .order('date', { ascending: false }),
            supabase.from('field_expenses').select('employee_name, amount'),
            supabase.from('field_advances').select('employee_name, amount'),
            supabase.from('projects').select('id, project_number, title').order('project_number', { ascending: false }),
            supabase.from('field_weekly_budgets').select('*').eq('week_start', startStr).maybeSingle()
        ]);

        setExpenses((expRes.data as unknown as FieldExpense[]) || []);
        setAdvances(advRes.data || []);
        setAllTimeExpenses(allExpRes.data as unknown as FieldExpense[] || []);
        setAllTimeAdvances(allAdvRes.data || []);
        setProjects(projRes.data || []);
        setWeeklyBudget(budgetRes.data || null);
        setLoading(false);
    }, [weekOffset, getWeekRange]);

    useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            employee_name: form.employee_name,
            expense_type: form.expense_type,
            amount: parseFloat(form.amount) || 0,
            expense_date: form.expense_date,
            project_id: form.project_id || null,
            area_destination: !form.project_id ? (form.area_destination || null) : null,
            payment_method: form.payment_method,
            folio_fiscal: form.folio_fiscal || null,
            notes: form.description || null,
            receipt_url: form.receipt_url || null,
        };
        try {
            if (editingId) {
                const { error } = await supabase.from('field_expenses').update(payload).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('field_expenses').insert(payload);
                if (error) throw error;
            }
            setShowForm(false);
            setEditingId(null);
            setForm(defaultForm);
            fetchExpenses();
        } catch (error: any) {
            alert('Error al guardar el viático: ' + error.message);
        }
    };

    const handleSaveAdvance = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            employee_name: advanceForm.employee_name,
            amount: parseFloat(advanceForm.amount) || 0,
            date: advanceForm.date,
            notes: advanceForm.notes || null
        };
        try {
            const { error } = await supabase.from('field_advances').insert(payload);
            if (error) throw error;
            setShowAdvanceForm(false);
            setAdvanceForm(defaultAdvanceForm);
            fetchExpenses();
        } catch (error: any) {
            alert('Error al guardar asignación: ' + error.message);
        }
    };

    const handleUpdateBudget = async () => {
        const amt = prompt('Presupuesto global de caja para la semana (Monto Final):', String(weeklyBudget?.amount || '0'));
        if (amt === null) return;
        const val = parseFloat(amt) || 0;
        const { startStr } = getWeekRange(weekOffset);
        
        try {
            if (weeklyBudget) {
                await supabase.from('field_weekly_budgets').update({ amount: val }).eq('id', weeklyBudget.id);
            } else {
                await supabase.from('field_weekly_budgets').insert({ week_start: startStr, amount: val });
            }
            fetchExpenses();
        } catch (err: any) {
            alert('Error al actualizar presupuesto: ' + err.message);
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (!window.confirm('¿Eliminar este registro de viático?')) return;
        await supabase.from('field_expenses').delete().eq('id', id);
        fetchExpenses();
    };

    const handleDeleteAdvance = async (id: string) => {
        if (!window.confirm('¿Eliminar esta asignación?')) return;
        await supabase.from('field_advances').delete().eq('id', id);
        fetchExpenses();
    };

    // Calculations
    const weekTotalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const weekTotalAdvances = advances.reduce((s, e) => s + Number(e.amount), 0);
    const cajaAmount = weeklyBudget ? Number(weeklyBudget.amount) : 0;
    const cajaRemaining = cajaAmount - weekTotalAdvances;

    // Employee Balances (All Time)
    const empBalances: Record<string, { assigned: number, spent: number, balance: number }> = {};
    allTimeAdvances.forEach(a => {
        if (!empBalances[a.employee_name]) empBalances[a.employee_name] = { assigned: 0, spent: 0, balance: 0 };
        empBalances[a.employee_name].assigned += Number(a.amount);
    });
    allTimeExpenses.forEach(e => {
        if (!empBalances[e.employee_name]) empBalances[e.employee_name] = { assigned: 0, spent: 0, balance: 0 };
        empBalances[e.employee_name].spent += Number(e.amount);
    });
    Object.keys(empBalances).forEach(k => {
        empBalances[k].balance = empBalances[k].assigned - empBalances[k].spent;
    });

    const { start, end } = getWeekRange(weekOffset);
    const weekLabel = `Semana del ${start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} al ${end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

    // Helper for safe dates (avoid timezone shift)
    const renderDate = (dStr: string) => {
        const parts = dStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dStr;
    };

    if (loading) return <div className="flex flex-1 items-center justify-center p-8"><div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" /></div>;

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/finance')}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                        title="Volver a Finanzas"
                    >
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Gastos de Campo y Viáticos</h2>
                        <p className="text-sm text-slate-500">Cortes semanales (Viernes a Jueves)</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <button onClick={() => setShowAdvanceForm(true)} className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-600 hover:bg-orange-100 transition-colors dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400">
                        <span className="material-symbols-outlined text-[18px]">payments</span>Asignar a Empleado
                    </button>
                    <button onClick={() => { setEditingId(null); setForm(defaultForm); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">add</span>Registrar Gasto
                    </button>
                    <div className="flex items-center gap-2 rounded-lg bg-white p-1 shadow-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800">
                        <button onClick={() => setWeekOffset(prev => prev - 1)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700">
                            <span className="material-symbols-outlined text-slate-500 text-[20px]">chevron_left</span>
                        </button>
                        <span className="min-w-[180px] text-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {weekLabel}
                        </span>
                        <button onClick={() => setWeekOffset(prev => prev + 1)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700">
                            <span className="material-symbols-outlined text-slate-500 text-[20px]">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid gap-6 md:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase">Fondo de Caja (Presupuesto)</h3>
                        <button onClick={handleUpdateBudget} className="text-orange-500 hover:text-orange-600"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrencyMXN(cajaAmount)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Asignado a Empleados (Semanal)</h3>
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatCurrencyMXN(weekTotalAdvances)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Restante en Caja Físico</h3>
                    <p className={`text-2xl font-black ${cajaRemaining < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{formatCurrencyMXN(cajaRemaining)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Gastos Comprobados (Semanal)</h3>
                    <p className="text-2xl font-black text-orange-500">{formatCurrencyMXN(weekTotalExpenses)}</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Employee Balances List */}
                <div className="lg:col-span-1 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col">
                    <div className="border-b border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-orange-500">group</span>
                            Saldos por Empleado (Acumulado)
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
                        {Object.entries(empBalances).length === 0 ? (
                            <div className="p-8 text-center text-sm text-slate-500">No hay registros para calcular.</div>
                        ) : (
                            Object.entries(empBalances).sort((a, b) => b[1].balance - a[1].balance).map(([emp, data]) => (
                                <div key={emp} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-2">{emp}</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                                            <span className="block text-slate-400 mb-1">Total Asignado</span>
                                            <span className="font-semibold text-blue-600">{formatCurrencyMXN(data.assigned)}</span>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded p-2">
                                            <span className="block text-slate-400 mb-1">Total Comprobado</span>
                                            <span className="font-semibold text-orange-600">{formatCurrencyMXN(data.spent)}</span>
                                        </div>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                        <span className="text-xs font-semibold text-slate-500 uppercase">Saldo {data.balance >= 0 ? '(A su favor)' : '(Debe)'}</span>
                                        <span className={`font-black ${data.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {formatCurrencyMXN(Math.abs(data.balance))}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Tables */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Advances Table */}
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col">
                        <div className="border-b border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-500">download</span>
                                Entregas a Empleados (Semana Actual)
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Empleado</th>
                                        <th className="px-4 py-3">Motivo / Notas</th>
                                        <th className="px-4 py-3 text-right">Monto</th>
                                        <th className="px-4 py-3 text-center w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {advances.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-500">No se ha entregado presupuesto esta semana.</td></tr>
                                    ) : advances.map(a => (
                                        <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">{renderDate(a.date)}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{a.employee_name}</td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">{a.notes || '—'}</td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-600">{formatCurrencyMXN(a.amount)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => handleDeleteAdvance(a.id)} className="text-slate-400 hover:text-rose-500"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Expenses Table */}
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col">
                        <div className="border-b border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-orange-500">upload</span>
                                Gastos Comprobados (Semana Actual)
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Responsable</th>
                                        <th className="px-4 py-3">Concepto</th>
                                        <th className="px-4 py-3 text-right">Monto</th>
                                        <th className="px-4 py-3 text-center w-20">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {expenses.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-500">No se registraron viáticos en esta semana.</td></tr>
                                    ) : expenses.map(e => (
                                        <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">{renderDate(e.expense_date)}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{e.employee_name}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-semibold text-orange-600">{EXPENSE_TYPE_LABELS[e.expense_type] || e.expense_type}</span>
                                                    <span className="text-xs text-slate-500">{e.notes || e.area_destination || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{formatCurrencyMXN(e.amount)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {e.receipt_url && <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:text-sky-600"><span className="material-symbols-outlined text-[18px]">receipt</span></a>}
                                                    <button onClick={() => handleDeleteExpense(e.id)} className="text-slate-400 hover:text-rose-500"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Advance Form */}
            {showAdvanceForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Asignar Presupuesto</h3>
                            <button onClick={() => { setShowAdvanceForm(false); setAdvanceForm(defaultAdvanceForm); }} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <form onSubmit={handleSaveAdvance} className="space-y-4">
                            <div><label className={labelClass}>Empleado *</label><input required value={advanceForm.employee_name} onChange={e => setAdvanceForm({ ...advanceForm, employee_name: e.target.value })} className={inputClass} placeholder="Nombre del empleado" /></div>
                            <div><label className={labelClass}>Monto Entregado *</label><input required type="number" step="0.01" value={advanceForm.amount} onChange={e => setAdvanceForm({ ...advanceForm, amount: e.target.value })} className={inputClass} placeholder="0.00" /></div>
                            <div><label className={labelClass}>Fecha *</label><input required type="date" value={advanceForm.date} onChange={e => setAdvanceForm({ ...advanceForm, date: e.target.value })} className={inputClass} /></div>
                            <div><label className={labelClass}>Notas / Motivo</label><input value={advanceForm.notes} onChange={e => setAdvanceForm({ ...advanceForm, notes: e.target.value })} className={inputClass} placeholder="Opcional..." /></div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowAdvanceForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Cancelar</button>
                                <button type="submit" className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700">Guardar Asignación</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Expense Form */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Registrar Gasto (Comprobación)</h3>
                            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(defaultForm); }} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <form onSubmit={handleSaveExpense} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2"><label className={labelClass}>Empleado Responsable *</label><input required value={form.employee_name} onChange={e => setForm({ ...form, employee_name: e.target.value })} className={inputClass} placeholder="Nombre del empleado" /></div>
                                <div><label className={labelClass}>Tipo de Gasto *</label>
                                    <select value={form.expense_type} onChange={e => setForm({ ...form, expense_type: e.target.value as ExpenseType })} className={inputClass}>
                                        {Object.entries(EXPENSE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                                <div><label className={labelClass}>Monto Gastado *</label><input required type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={inputClass} placeholder="0.00" /></div>
                                <div><label className={labelClass}>Fecha *</label><input required type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} className={inputClass} /></div>
                                <div><label className={labelClass}>Forma de Pago *</label>
                                    <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value as any })} className={inputClass}>
                                        <option value="transfer">Transferencia</option>
                                        <option value="card">Tarjeta</option>
                                        <option value="cash">Efectivo</option>
                                    </select>
                                </div>
                                <div><label className={labelClass}>Proyecto (Opcional)</label>
                                    <select value={form.project_id} onChange={e => {
                                        setForm({ ...form, project_id: e.target.value, area_destination: e.target.value ? '' : form.area_destination });
                                    }} className={inputClass}>
                                        <option value="">Seleccionar Proyecto...</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} - {p.title}</option>)}
                                    </select>
                                </div>
                                <div><label className={labelClass}>Área (Si no es proyecto)</label><input disabled={!!form.project_id} value={form.area_destination} onChange={e => setForm({ ...form, area_destination: e.target.value })} className={`${inputClass} ${!!form.project_id ? 'opacity-50' : ''}`} placeholder="Ej. Oficina, Bodega" /></div>
                                <div className="col-span-2"><label className={labelClass}>Concepto / Descripción</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="Detalles del gasto..." /></div>
                                <div><label className={labelClass}>Folio Fiscal / Factura</label><input value={form.folio_fiscal} onChange={e => setForm({ ...form, folio_fiscal: e.target.value })} className={inputClass} placeholder="Opcional" /></div>
                                <div><label className={labelClass}>URL Ticket / Recibo</label><input type="url" value={form.receipt_url} onChange={e => setForm({ ...form, receipt_url: e.target.value })} className={inputClass} placeholder="Enlace a la foto del ticket" /></div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Cancelar</button>
                                <button type="submit" className="rounded-lg bg-orange-500 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-orange-600 transition-colors">Guardar Gasto</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
