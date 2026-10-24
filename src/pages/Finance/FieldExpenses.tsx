import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { FieldExpense, EXPENSE_TYPE_LABELS } from '../../types/projects';
import { formatCurrencyMXN } from '../../types/projects';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from 'recharts';
import PhotoUploader, { PhotoGallery } from '../../components/PhotoUploader';
import type { PhotoAttachment } from '../../types/photos';

type ExpenseType = keyof typeof EXPENSE_TYPE_LABELS;

interface Advance {
    id: string;
    employee_name: string;
    amount: number;
    date: string;
    notes: string;
}

const getLocalDateString = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

const defaultForm = { employee_name: '', expense_type: 'viaticos' as ExpenseType, amount: '', expense_date: getLocalDateString(), project_id: '', area_destination: '', payment_method: 'transfer' as 'transfer' | 'card' | 'cash', folio_fiscal: '', description: '', receipt_url: '' };
const defaultAdvanceForm = { employee_name: '', amount: '', date: getLocalDateString(), notes: '' };

export default function FieldExpenses() {
    const navigate = useNavigate();
    
    const [expenses, setExpenses] = useState<FieldExpense[]>([]);
    const [advances, setAdvances] = useState<Advance[]>([]);
    const [allTimeExpenses, setAllTimeExpenses] = useState<FieldExpense[]>([]);
    const [allTimeAdvances, setAllTimeAdvances] = useState<Advance[]>([]);
    const [allTimeBudgets, setAllTimeBudgets] = useState<{ week_start: string; amount: number }[]>([]);
    
    const [projects, setProjects] = useState<{ id: string; project_number: string; title: string }[]>([]);
    const [weeklyBudget, setWeeklyBudget] = useState<{ id: string; amount: number } | null>(null);
    
    const [loading, setLoading] = useState(true);
    const [weekOffset, setWeekOffset] = useState(0);
    
    const [showForm, setShowForm] = useState(false);
    const [showAdvanceForm, setShowAdvanceForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(defaultForm);
    const [advanceForm, setAdvanceForm] = useState(defaultAdvanceForm);
    const [expensePhotos, setExpensePhotos] = useState<PhotoAttachment[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [reportMonth, setReportMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

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

        const [expRes, advRes, allExpRes, allAdvRes, projRes, budgetRes, allBudgetsRes] = await Promise.all([
            supabase.from('field_expenses').select('*, project:projects(project_number, title)')
                .gte('expense_date', startStr)
                .lte('expense_date', endStr)
                .order('expense_date', { ascending: false }),
            supabase.from('field_advances').select('*')
                .gte('date', startStr)
                .lte('date', endStr)
                .order('date', { ascending: false }),
            supabase.from('field_expenses').select('*, project:projects(project_number, title)').order('expense_date', { ascending: false }),
            supabase.from('field_advances').select('employee_name, amount, date'),
            supabase.from('projects').select('id, project_number, title').order('project_number', { ascending: false }),
            supabase.from('field_weekly_budgets').select('*').eq('week_start', startStr).maybeSingle(),
            supabase.from('field_weekly_budgets').select('week_start, amount')
        ]);

        setExpenses((expRes.data as unknown as FieldExpense[]) || []);
        setAdvances(advRes.data || []);
        setAllTimeExpenses(allExpRes.data as unknown as FieldExpense[] || []);
        setAllTimeAdvances((allAdvRes.data as unknown as Advance[]) || []);
        setProjects(projRes.data || []);
        setWeeklyBudget(budgetRes.data || null);
        setAllTimeBudgets(allBudgetsRes.data || []);
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
            receipt_url: expensePhotos.length > 0 ? expensePhotos[0].url : (form.receipt_url || null),
            photos: expensePhotos.length > 0 ? JSON.parse(JSON.stringify(expensePhotos)) : null,
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
            setExpensePhotos([]);
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
        const amt = prompt('Reposición / Monto Manual agregado a Caja para esta semana:', String(weeklyBudget?.amount || '0'));
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
    const { start, end, startStr } = getWeekRange(weekOffset);
    const weekTotalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const weekTotalAdvances = advances.reduce((s, e) => s + Number(e.amount), 0);
    
    const manualReplenish = weeklyBudget ? Number(weeklyBudget.amount) : 0;
    
    // Calculate carried over amount: Sum of all budgets before startStr - Sum of all advances before startStr
    const pastBudgets = allTimeBudgets.filter(b => b.week_start < startStr).reduce((s, b) => s + Number(b.amount), 0);
    const pastAdvances = allTimeAdvances.filter(a => a.date < startStr).reduce((s, a) => s + Number(a.amount), 0);
    const carriedOver = pastBudgets - pastAdvances;
    
    const cajaAmount = carriedOver + manualReplenish;
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

    const weekLabel = `Semana del ${start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} al ${end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    // --- Chart data ---
    const PIE_COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];

    // 1) Gastos de la semana por empleado (bar chart)
    const weekExpByEmployee = expenses.reduce((acc, e) => {
        const name = e.employee_name || 'Sin asignar';
        acc[name] = (acc[name] || 0) + Number(e.amount);
        return acc;
    }, {} as Record<string, number>);
    const barChartData = Object.entries(weekExpByEmployee)
        .sort(([, a], [, b]) => b - a)
        .map(([name, amount]) => ({ name: name.split(' ')[0], fullName: name, amount }));

    // 2) Distribución por tipo de gasto (pie/donut) — semana actual
    const weekExpByType = expenses.reduce((acc, e) => {
        const label = EXPENSE_TYPE_LABELS[e.expense_type] || e.expense_type;
        acc[label] = (acc[label] || 0) + Number(e.amount);
        return acc;
    }, {} as Record<string, number>);
    const pieChartData = Object.entries(weekExpByType)
        .sort(([, a], [, b]) => b - a)
        .map(([name, value]) => ({ name, value }));

    // 3) Asignado vs Comprobado por empleado — acumulado
    const assignedVsSpentData = Object.entries(empBalances)
        .sort(([, a], [, b]) => b.assigned - a.assigned)
        .slice(0, 8)
        .map(([emp, data]) => ({
            name: emp.split(' ')[0],
            fullName: emp,
            asignado: data.assigned,
            comprobado: data.spent,
        }));


    const handleDownloadMonthReport = () => {
        const [yr, mo] = reportMonth.split('-').map(Number);
        const monthExpenses = allTimeExpenses.filter(e => {
            const d = new Date((e.expense_date || '') + 'T12:00:00');
            return d.getFullYear() === yr && d.getMonth() + 1 === mo;
        });
        const monthAdvances = allTimeAdvances.filter(a => {
            const d = new Date((a.date || '') + 'T12:00:00');
            return d.getFullYear() === yr && d.getMonth() + 1 === mo;
        });
        const total = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
        const totalAdvances = monthAdvances.reduce((s, a) => s + Number(a.amount), 0);
        const monthName = new Date(yr, mo - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

        const rows = monthExpenses.map(e => `
            <tr>
                <td>${(e.expense_date || '').split('-').reverse().join('/')}</td>
                <td>${e.employee_name || ''}</td>
                <td><strong>${EXPENSE_TYPE_LABELS[e.expense_type] || e.expense_type}</strong><br/><small>${e.notes || e.area_destination || ''}</small></td>
                <td>${e.payment_method === 'transfer' ? 'Transferencia' : e.payment_method === 'card' ? 'Tarjeta' : 'Efectivo'}</td>
                <td style="text-align:right;font-weight:700">$${Number(e.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            </tr>`).join('');

        const advRows = monthAdvances.map(a => `
            <tr>
                <td>${(a.date || '').split('-').reverse().join('/')}</td>
                <td>${a.employee_name || ''}</td>
                <td colspan="2">${a.notes || 'Asignación de viáticos'}</td>
                <td style="text-align:right;font-weight:700;color:#3b82f6">$${Number(a.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            </tr>`).join('');

        const pw = window.open('', '_blank');
        if (!pw) { alert('Permite ventanas emergentes para generar el reporte.'); return; }
        pw.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte de Viáticos — ${monthName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #1e293b; background: #fff; padding: 32px; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #f97316; padding-bottom: 16px; margin-bottom: 24px; }
  .logo-area { display: flex; align-items: center; gap: 12px; }
  .logo-area img { height: 60px; }
  .company-name { font-size: 22px; font-weight: 900; color: #1e293b; }
  .company-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  .report-title { text-align: right; }
  .report-title h1 { font-size: 18px; font-weight: 800; color: #f97316; }
  .report-title p { font-size: 12px; color: #64748b; margin-top: 4px; }
  h2 { font-size: 14px; font-weight: 700; color: #475569; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 8px 10px; text-align: left; font-weight: 700; color: #64748b; text-transform: uppercase; font-size: 10px; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tbody tr:hover { background: #fafafa; }
  .total-row td { font-weight: 900; font-size: 13px; background: #fff7ed; border-top: 2px solid #f97316; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
  .summary-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; text-align: center; }
  .summary-card .label { font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; }
  .summary-card .value { font-size: 20px; font-weight: 900; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo-area">
    <img src="https://nucleo-de-ingenieria.vercel.app/logo.png" alt="Logo" onerror="this.style.display='none'" />
    <div>
      <div class="company-name">Núcleo de Ingeniería</div>
      <div class="company-sub">Soluciones Técnicas Integrales</div>
    </div>
  </div>
  <div class="report-title">
    <h1>Reporte de Viáticos</h1>
    <p>${monthName}</p>
    <p style="margin-top:2px;font-size:10px;color:#94a3b8">Generado: ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </div>
</div>

<div class="summary">
  <div class="summary-card">
    <div class="label">Total Asignado</div>
    <div class="value" style="color:#3b82f6">$${totalAdvances.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
  </div>
  <div class="summary-card">
    <div class="label">Total Comprobado</div>
    <div class="value" style="color:#f97316">$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
  </div>
  <div class="summary-card">
    <div class="label">Diferencia</div>
    <div class="value" style="color:${totalAdvances - total >= 0 ? '#10b981' : '#ef4444'}">$${Math.abs(totalAdvances - total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
  </div>
</div>

<h2>Gastos Comprobados</h2>
<table>
<thead><tr><th>Fecha</th><th>Empleado</th><th>Concepto</th><th>Forma de Pago</th><th style="text-align:right">Monto</th></tr></thead>
<tbody>
${rows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px">Sin gastos registrados en este mes.</td></tr>'}
<tr class="total-row">
  <td colspan="4">TOTAL COMPROBADO</td>
  <td style="text-align:right">$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
</tr>
</tbody>
</table>

<h2 style="margin-top:24px">Asignaciones a Empleados</h2>
<table>
<thead><tr><th>Fecha</th><th>Empleado</th><th colspan="2">Notas</th><th style="text-align:right">Monto</th></tr></thead>
<tbody>
${advRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px">Sin asignaciones en este mes.</td></tr>'}
<tr class="total-row" style="color:#3b82f6">
  <td colspan="4">TOTAL ASIGNADO</td>
  <td style="text-align:right">$${totalAdvances.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
</tr>
</tbody>
</table>

<div class="footer">Núcleo de Ingeniería — Reporte generado por el sistema de gestión interno.</div>
</body>
</html>`);
        pw.document.close();
        pw.focus();
        setTimeout(() => pw.print(), 600);
    };

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
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        <span className="material-symbols-outlined text-slate-400 text-[18px]">calendar_month</span>
                        <input
                            type="month"
                            value={reportMonth}
                            onChange={e => setReportMonth(e.target.value)}
                            className="text-sm text-slate-700 outline-none bg-transparent dark:text-slate-300"
                        />
                    </div>
                    <button onClick={handleDownloadMonthReport} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <span className="material-symbols-outlined text-[18px]">download</span>Reporte Mensual
                    </button>
                    <button onClick={() => { setEditingId(null); setForm(defaultForm); setExpensePhotos([]); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition-colors">
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

            {/* ── Charts Section ── */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Bar: Gastos por empleado (semana) */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                        <span className="material-symbols-outlined text-orange-500 text-[20px]">bar_chart</span>
                        Gastos por Empleado — Semana Actual
                    </h3>
                    {barChartData.length === 0 ? (
                        <div className="flex h-48 items-center justify-center text-sm text-slate-400">Sin gastos registrados esta semana.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={barChartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const d = payload[0];
                                        return (
                                            <div style={{ borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', padding: '8px 12px', fontSize: 12 }}>
                                                <p style={{ fontWeight: 600, marginBottom: 2 }}>{d.payload?.fullName}</p>
                                                <p style={{ color: '#f97316' }}>{formatCurrencyMXN(d.value as number)}</p>
                                            </div>
                                        );
                                    }}
                                    cursor={{ fill: '#f97316', opacity: 0.08 }}
                                />
                                <Bar dataKey="amount" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={48} name="Gasto" />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Pie: Distribución por tipo de gasto */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                        <span className="material-symbols-outlined text-purple-500 text-[20px]">donut_large</span>
                        Distribución por Tipo de Gasto — Semana
                    </h3>
                    {pieChartData.length === 0 ? (
                        <div className="flex h-48 items-center justify-center text-sm text-slate-400">Sin gastos registrados esta semana.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={pieChartData}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={3}
                                    dataKey="value"
                                    nameKey="name"
                                >
                                    {pieChartData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const d = payload[0];
                                        return (
                                            <div style={{ borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', padding: '8px 12px', fontSize: 12 }}>
                                                <p style={{ fontWeight: 600, marginBottom: 2 }}>{d.name}</p>
                                                <p style={{ color: d.payload?.fill }}>{formatCurrencyMXN(d.value as number)}</p>
                                            </div>
                                        );
                                    }}
                                />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Grouped Bar: Asignado vs Comprobado por empleado (acumulado) */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                        <span className="material-symbols-outlined text-blue-500 text-[20px]">compare_arrows</span>
                        Asignado vs. Comprobado — Acumulado
                    </h3>
                    {assignedVsSpentData.length === 0 ? (
                        <div className="flex h-48 items-center justify-center text-sm text-slate-400">Sin datos de empleados.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={assignedVsSpentData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (!active || !payload?.length) return null;
                                        const fullName = payload[0]?.payload?.fullName || label;
                                        return (
                                            <div style={{ borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', padding: '8px 12px', fontSize: 12 }}>
                                                <p style={{ fontWeight: 600, marginBottom: 4 }}>{fullName}</p>
                                                {payload.map((p) => (
                                                    <p key={p.dataKey as string} style={{ color: p.fill, marginBottom: 2 }}>
                                                        {p.dataKey === 'asignado' ? 'Asignado' : 'Comprobado'}: {formatCurrencyMXN(p.value as number)}
                                                    </p>
                                                ))}
                                            </div>
                                        );
                                    }}
                                    cursor={{ fill: '#64748b', opacity: 0.06 }}
                                />
                                <Legend
                                    formatter={(value) => value === 'asignado' ? 'Asignado' : 'Comprobado'}
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                                />
                                <Bar dataKey="asignado" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} name="asignado" />
                                <Bar dataKey="comprobado" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={28} name="comprobado" />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
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
                                <div key={emp} onClick={() => setSelectedEmployee(selectedEmployee === emp ? null : emp)} className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selectedEmployee === emp ? 'bg-orange-50 dark:bg-orange-900/10 border-l-2 border-orange-500' : ''}`}>
                                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
                                        <span>{emp}</span>
                                        <span className="text-[10px] text-slate-400">{selectedEmployee === emp ? '▲ Ocultar' : '▼ Ver detalle'}</span>
                                    </div>
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

                {/* Employee Detail Panel */}
                {selectedEmployee && (
                    <div className="lg:col-span-2 rounded-xl border border-orange-200 bg-white overflow-hidden shadow-sm dark:border-orange-800/30 dark:bg-slate-900">
                        <div className="border-b border-orange-100 bg-orange-50/50 p-4 dark:border-orange-800/30 dark:bg-orange-900/10 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-orange-500">person</span>
                                    Detalle de Gastos: {selectedEmployee}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">Gastos comprobados del empleado por mes</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={e => setSelectedMonth(e.target.value)}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                />
                                <button onClick={() => setSelectedEmployee(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Concepto</th>
                                        <th className="px-4 py-3">Proyecto / Área</th>
                                        <th className="px-4 py-3">Forma Pago</th>
                                        <th className="px-4 py-3 text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {(() => {
                                        const empMonthExpenses = allTimeExpenses.filter(e =>
                                            e.employee_name === selectedEmployee &&
                                            (e.expense_date || '').startsWith(selectedMonth)
                                        );
                                        const empTotal = empMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
                                        if (empMonthExpenses.length === 0) return (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Sin gastos registrados en este mes.</td></tr>
                                        );
                                        return (<>
                                            {empMonthExpenses.map(e => (
                                                <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{(e.expense_date || '').split('-').reverse().join('/')}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-semibold text-orange-600">{EXPENSE_TYPE_LABELS[e.expense_type] || e.expense_type}</span>
                                                            <span className="text-xs text-slate-500">{e.notes || '—'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-slate-500">{(e as any).project?.title || e.area_destination || '—'}</td>
                                                    <td className="px-4 py-3 text-xs text-slate-500 capitalize">{e.payment_method === 'transfer' ? 'Transferencia' : e.payment_method === 'card' ? 'Tarjeta' : e.payment_method === 'cash' ? 'Efectivo' : e.payment_method || '—'}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{formatCurrencyMXN(e.amount)}</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-orange-50 dark:bg-orange-900/10">
                                                <td colSpan={4} className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-right uppercase text-xs">Total del Mes</td>
                                                <td className="px-4 py-3 text-right font-black text-orange-600">{formatCurrencyMXN(empTotal)}</td>
                                            </tr>
                                        </>);
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

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
                                                    {(e as any).photos && Array.isArray((e as any).photos) && (e as any).photos.length > 0 && (
                                                        <div className="mt-1">
                                                            <PhotoGallery photos={(e as any).photos} />
                                                        </div>
                                                    )}
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
                                <div className="col-span-2">
                                    <label className={labelClass}>Evidencia Fotográfica (Ticket / Recibo)</label>
                                    <PhotoUploader
                                        photos={expensePhotos}
                                        onPhotosChange={setExpensePhotos}
                                        folder={`finanzas/viaticos/${editingId || 'nuevo'}`}
                                        uploaderName="Evidencia"
                                        compact
                                        maxFiles={5}
                                    />
                                </div>
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
