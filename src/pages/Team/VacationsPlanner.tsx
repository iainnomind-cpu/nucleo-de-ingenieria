import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
    HREmployee, HRAbsence, AbsenceType, ABSENCE_TYPE_COLORS, calculateVacationDays
} from '../../types/hr';
import { useNavigate } from 'react-router-dom';

export default function VacationsPlanner() {
    const navigate = useNavigate();
    const [employees, setEmployees] = useState<HREmployee[]>([]);
    const [absences, setAbsences] = useState<HRAbsence[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const currentYear = new Date().getFullYear();
    const [filterYear, setFilterYear] = useState<number>(currentYear);
    const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
    const [filterDept, setFilterDept] = useState<string>('all');
    
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        employee_id: '',
        absence_type: 'VACACIONES' as AbsenceType,
        start_date: '',
        days_count: '1',
        is_compensated: false,
        notes: ''
    });

    const [showEmployeeForm, setShowEmployeeForm] = useState(false);
    const [employeeForm, setEmployeeForm] = useState({
        full_name: '',
        department: '',
        hire_date: new Date().toISOString().split('T')[0],
        base_vacation_days: '12'
    });

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [empRes, absRes] = await Promise.all([
            supabase.from('hr_employees').select('*').order('full_name'),
            supabase.from('hr_absences').select('*').order('start_date')
        ]);
        setEmployees(empRes.data || []);
        setAbsences(absRes.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Calculate end_date based on start_date and days
        const start = new Date(form.start_date);
        const days = parseFloat(form.days_count) || 1;
        // Simple calculation: just add days (in reality should skip weekends/holidays if needed)
        const end = new Date(start);
        end.setDate(start.getDate() + Math.ceil(days) - 1);
        
        const returnDate = new Date(end);
        returnDate.setDate(end.getDate() + 1); // Next day
        
        await supabase.from('hr_absences').insert({
            employee_id: form.employee_id,
            absence_type: form.absence_type,
            start_date: form.start_date,
            end_date: end.toISOString().split('T')[0],
            days_count: days,
            return_date: returnDate.toISOString().split('T')[0],
            is_compensated: form.is_compensated,
            notes: form.notes || null,
        });
        
        setShowForm(false);
        setForm({ employee_id: '', absence_type: 'VACACIONES', start_date: '', days_count: '1', is_compensated: false, notes: '' });
        fetchAll();
    };

    const handleSaveEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        
        await supabase.from('hr_employees').insert({
            full_name: employeeForm.full_name,
            department: employeeForm.department || null,
            hire_date: employeeForm.hire_date || null,
            base_vacation_days: parseInt(employeeForm.base_vacation_days) || 12,
            is_active: true
        });
        
        setShowEmployeeForm(false);
        setEmployeeForm({ full_name: '', department: '', hire_date: new Date().toISOString().split('T')[0], base_vacation_days: '12' });
        fetchAll();
    };

    const deleteAbsence = async (id: string) => {
        if (!window.confirm('¿Eliminar esta ausencia?')) return;
        await supabase.from('hr_absences').delete().eq('id', id);
        fetchAll();
    };

    // Calculate vacation balances — only VACACIONES affects vacation days
    const balances = useMemo(() => {
        const map = new Map<string, { total: number, used: number, remaining: number, unpaidLeave: number, otherAbsences: number }>();
        employees.forEach(emp => {
            const total = calculateVacationDays(emp.hire_date, emp.base_vacation_days);
            const yearAbsences = absences.filter(a =>
                a.employee_id === emp.id &&
                new Date(a.start_date).getFullYear() <= filterYear
            );
            // Only VACACIONES type counts against vacation balance
            const usedVacation = yearAbsences
                .filter(a => a.absence_type === 'VACACIONES')
                .reduce((sum, a) => sum + Number(a.days_count), 0);
            // Track unpaid leave separately
            const unpaidLeave = yearAbsences
                .filter(a => a.absence_type === 'PERMISO NO REMUNERADO')
                .reduce((sum, a) => sum + Number(a.days_count), 0);
            // Other absences (incapacidad, capacitación, etc.) — informational only
            const otherAbsences = yearAbsences
                .filter(a => a.absence_type !== 'VACACIONES' && a.absence_type !== 'PERMISO NO REMUNERADO')
                .reduce((sum, a) => sum + Number(a.days_count), 0);
            map.set(emp.id, { total, used: usedVacation, remaining: total - usedVacation, unpaidLeave, otherAbsences });
        });
        return map;
    }, [employees, absences, filterYear]);

    // Calendar generation
    const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
    const daysInMonth = getDaysInMonth(filterYear, filterMonth);
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));
    const filteredEmployees = employees.filter(e => filterDept === 'all' || e.department === filterDept);

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1';

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/team')} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600 dark:from-white dark:to-slate-400">
                            Vacaciones y Ausencias
                        </h2>
                        <p className="text-sm text-slate-500">Gestión de recursos humanos</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setShowEmployeeForm(!showEmployeeForm); setShowForm(false); }} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[18px]">person_add</span>
                        Nuevo Colaborador
                    </button>
                    <button onClick={() => { setShowForm(!showForm); setShowEmployeeForm(false); }} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20">
                        <span className="material-symbols-outlined text-[18px]">event_busy</span>
                        Registrar Ausencia
                    </button>
                </div>
            </div>

            {showEmployeeForm && (
                <form onSubmit={handleSaveEmployee} className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-6 shadow-inner dark:border-indigo-900/30 dark:bg-indigo-900/10">
                    <h3 className="mb-4 text-sm font-bold text-indigo-900 dark:text-indigo-300">Nuevo Colaborador</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div>
                            <label className={labelClass}>Nombre Completo *</label>
                            <input required value={employeeForm.full_name} onChange={e => setEmployeeForm({ ...employeeForm, full_name: e.target.value })} className={inputClass} placeholder="Nombre y Apellidos" />
                        </div>
                        <div>
                            <label className={labelClass}>Departamento</label>
                            <input value={employeeForm.department} onChange={e => setEmployeeForm({ ...employeeForm, department: e.target.value })} className={inputClass} placeholder="Ej. Operaciones, Limpieza..." />
                        </div>
                        <div>
                            <label className={labelClass}>Fecha de Ingreso</label>
                            <input type="date" required value={employeeForm.hire_date} onChange={e => setEmployeeForm({ ...employeeForm, hire_date: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Días Base Vacaciones</label>
                            <input type="number" required min="6" value={employeeForm.base_vacation_days} onChange={e => setEmployeeForm({ ...employeeForm, base_vacation_days: e.target.value })} className={inputClass} />
                            <p className="mt-1 text-[10px] text-slate-500">Por defecto: 12 días (LFT México)</p>
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button type="submit" className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">Guardar Colaborador</button>
                        <button type="button" onClick={() => setShowEmployeeForm(false)} className="rounded-lg border border-slate-200 px-5 py-2 text-sm text-slate-500">Cancelar</button>
                    </div>
                </form>
            )}

            {showForm && (
                <form onSubmit={handleSubmit} className="rounded-xl border border-primary/20 bg-primary/5 p-6 shadow-inner">
                    <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Nueva Ausencia</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                        <div className="md:col-span-2">
                            <label className={labelClass}>Colaborador</label>
                            <select required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className={inputClass}>
                                <option value="">Seleccionar...</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Tipo</label>
                            <select required value={form.absence_type} onChange={e => setForm({ ...form, absence_type: e.target.value as AbsenceType })} className={inputClass}>
                                {Object.keys(ABSENCE_TYPE_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Inicio</label>
                            <input type="date" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Días</label>
                            <input type="number" step="0.5" required min="0.5" value={form.days_count} onChange={e => setForm({ ...form, days_count: e.target.value })} className={inputClass} />
                        </div>
                        <div className="md:col-span-3">
                            <label className={labelClass}>Notas / Motivo</label>
                            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputClass} placeholder="Opcional..." />
                        </div>
                        <div className="md:col-span-2 flex items-center mt-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={form.is_compensated} onChange={e => setForm({ ...form, is_compensated: e.target.checked })} className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Compensado (No afecta saldo de vacaciones)</span>
                            </label>
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button type="submit" className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white">Guardar</button>
                        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-5 py-2 text-sm text-slate-500">Cancelar</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : (
                <div className="space-y-6">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200/60 bg-white/50 p-4 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase">Año</label>
                            <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="mt-1 bg-transparent text-sm font-bold outline-none dark:text-white">
                                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="w-px bg-slate-200 dark:bg-slate-700" />
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase">Mes</label>
                            <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="mt-1 bg-transparent text-sm font-bold outline-none dark:text-white">
                                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('es', { month: 'long' }).toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div className="w-px bg-slate-200 dark:bg-slate-700" />
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase">Departamento</label>
                            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="mt-1 bg-transparent text-sm font-bold outline-none dark:text-white">
                                <option value="all">TODOS</option>
                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Resumen Anual */}
                    <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800/60 dark:bg-slate-900 overflow-hidden">
                        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-white">Resumen de Vacaciones {filterYear}</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-500">Colaborador</th>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-500">Departamento</th>
                                        <th className="px-5 py-3 text-center font-semibold text-slate-500">Antigüedad</th>
                                        <th className="px-5 py-3 text-center font-semibold text-slate-500">Días {filterYear}</th>
                                        <th className="px-5 py-3 text-center font-semibold text-slate-500">Usados</th>
                                        <th className="px-5 py-3 text-center font-semibold text-slate-500">Restantes</th>
                                        <th className="px-5 py-3 text-center font-semibold text-slate-500">Permisos S/G</th>
                                        <th className="px-5 py-3 text-center font-semibold text-slate-500">Otros</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredEmployees.map(emp => {
                                        const bal = balances.get(emp.id);
                                        const hireYear = emp.hire_date ? new Date(emp.hire_date).getFullYear() : currentYear;
                                        const years = filterYear - hireYear;
                                        return (
                                            <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{emp.full_name}</td>
                                                <td className="px-5 py-3 text-slate-500">{emp.department || '—'}</td>
                                                <td className="px-5 py-3 text-center text-slate-500">{years >= 0 ? `${years} años` : '—'}</td>
                                                <td className="px-5 py-3 text-center font-bold text-slate-900 dark:text-white">{bal?.total || 0}</td>
                                                <td className="px-5 py-3 text-center font-bold text-amber-500">{bal?.used || 0}</td>
                                                <td className="px-5 py-3 text-center">
                                                    <span className={`inline-flex min-w-[30px] items-center justify-center rounded-full px-2 py-1 text-xs font-bold ${(bal?.remaining || 0) <= 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {bal?.remaining || 0}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    <span className={`inline-flex min-w-[30px] items-center justify-center rounded-full px-2 py-1 text-xs font-bold ${(bal?.unpaidLeave || 0) > 0 ? 'bg-amber-100 text-amber-700' : 'text-slate-400'}`}>
                                                        {bal?.unpaidLeave || 0}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    <span className={`inline-flex min-w-[30px] items-center justify-center rounded-full px-2 py-1 text-xs font-bold ${(bal?.otherAbsences || 0) > 0 ? 'bg-sky-100 text-sky-700' : 'text-slate-400'}`}>
                                                        {bal?.otherAbsences || 0}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Calendario Mensual */}
                    <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800/60 dark:bg-slate-900 overflow-hidden">
                        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 dark:text-white">Calendario de Ausencias</h3>
                            <div className="flex gap-2">
                                {Object.entries(ABSENCE_TYPE_COLORS).map(([type, color]) => (
                                    <div key={type} className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                                        <span className={`h-2.5 w-2.5 rounded-full ${color.bg.split(' ')[0]}`} />
                                        {type.substring(0, 3)}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr>
                                        <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-semibold text-slate-500 shadow-[1px_0_0_0_#f1f5f9] dark:bg-slate-900 dark:shadow-[1px_0_0_0_#1e293b]">
                                            Colaborador
                                        </th>
                                        {daysArray.map(day => {
                                            const d = new Date(filterYear, filterMonth - 1, day);
                                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                            return (
                                                <th key={day} className={`min-w-[32px] px-1 py-3 text-center font-semibold ${isWeekend ? 'bg-slate-50 text-slate-400 dark:bg-slate-800' : 'text-slate-600 dark:text-slate-300'}`}>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[9px] opacity-60">{d.toLocaleDateString('es', { weekday: 'narrow' })}</span>
                                                        <span>{day}</span>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredEmployees.map(emp => {
                                        // Find absences for this employee in this month
                                        const empAbs = absences.filter(a => a.employee_id === emp.id);
                                        
                                        return (
                                            <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium text-slate-900 shadow-[1px_0_0_0_#f1f5f9] dark:bg-slate-900 dark:text-white dark:shadow-[1px_0_0_0_#1e293b] truncate max-w-[200px]">
                                                    {emp.full_name}
                                                </td>
                                                {daysArray.map(day => {
                                                    const d = new Date(filterYear, filterMonth - 1, day);
                                                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                                    
                                                    // Check if day falls within any absence
                                                    const currentDateStr = d.toISOString().split('T')[0];
                                                    const activeAbs = empAbs.find(a => {
                                                        const start = a.start_date;
                                                        const end = a.end_date || a.start_date;
                                                        return currentDateStr >= start && currentDateStr <= end;
                                                    });
                                                    
                                                    if (activeAbs) {
                                                        const colors = ABSENCE_TYPE_COLORS[activeAbs.absence_type] || ABSENCE_TYPE_COLORS['OTRO'];
                                                        const isStart = currentDateStr === activeAbs.start_date;
                                                        const isEnd = currentDateStr === (activeAbs.end_date || activeAbs.start_date);
                                                        const isSingle = isStart && isEnd;
                                                        const borderRadius = isSingle
                                                            ? 'rounded-md'
                                                            : isStart
                                                                ? 'rounded-l-md rounded-r-none'
                                                                : isEnd
                                                                    ? 'rounded-r-md rounded-l-none'
                                                                    : 'rounded-none';
                                                        return (
                                                            <td key={day} className={`py-0.5 px-0 text-center ${isWeekend ? 'bg-slate-50 dark:bg-slate-800' : ''}`}>
                                                                <div 
                                                                    title={`${activeAbs.absence_type} (${activeAbs.days_count} días)${activeAbs.notes ? '\n' + activeAbs.notes : ''}`}
                                                                    onClick={() => deleteAbsence(activeAbs.id)}
                                                                    className={`flex h-6 w-full cursor-pointer items-center justify-center ${borderRadius} ${colors.bg} ${colors.text} hover:opacity-80`}
                                                                >
                                                                    {isStart ? (
                                                                        <span className="material-symbols-outlined text-[12px]">{colors.icon}</span>
                                                                    ) : (
                                                                        <span className="block h-0.5 w-3" style={{ backgroundColor: 'currentColor', opacity: 0.5 }} />
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                    
                                                    return <td key={day} className={`p-1 ${isWeekend ? 'bg-slate-50 dark:bg-slate-800' : ''}`} />;
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
