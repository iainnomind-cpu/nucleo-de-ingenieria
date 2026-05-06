import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { HREmployee } from '../../types/hr';

interface Uniform {
    id: string;
    name: string;
    category: 'uniforme' | 'epp';
    size: string | null;
    current_stock: number;
    unit_cost: number;
}

interface UniformAssignment {
    id: string;
    uniform_id: string;
    employee_id: string;
    quantity: number;
    assigned_date: string;
    notes: string | null;
    uniform?: Uniform;
    employee?: HREmployee;
}

export default function UniformsInventory() {
    const navigate = useNavigate();
    const [uniforms, setUniforms] = useState<Uniform[]>([]);
    const [assignments, setAssignments] = useState<UniformAssignment[]>([]);
    const [employees, setEmployees] = useState<HREmployee[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [activeTab, setActiveTab] = useState<'inventory' | 'assignments'>('inventory');
    const [filterCategory, setFilterCategory] = useState<'all' | 'uniforme' | 'epp'>('all');
    
    // Assignment Form
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        uniform_id: '',
        employee_id: '',
        quantity: '1',
        assigned_date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [uniRes, assigRes, empRes] = await Promise.all([
            supabase.from('inventory_uniforms').select('*').eq('is_active', true).order('category').order('name'),
            supabase.from('uniform_assignments').select('*, uniform:inventory_uniforms(*), employee:hr_employees(*)').order('assigned_date', { ascending: false }),
            supabase.from('hr_employees').select('*').eq('is_active', true).order('full_name')
        ]);
        setUniforms(uniRes.data || []);
        setAssignments(assigRes.data || []);
        setEmployees(empRes.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault();
        const qty = parseFloat(form.quantity) || 1;
        const uniform = uniforms.find(u => u.id === form.uniform_id);
        
        if (!uniform) return;
        
        if (uniform.current_stock < qty) {
            alert('No hay suficiente inventario disponible.');
            return;
        }

        // 1. Create assignment
        await supabase.from('uniform_assignments').insert({
            uniform_id: form.uniform_id,
            employee_id: form.employee_id,
            quantity: qty,
            assigned_date: form.assigned_date,
            notes: form.notes || null,
        });
        
        // 2. Reduce stock
        await supabase.from('inventory_uniforms').update({
            current_stock: uniform.current_stock - qty
        }).eq('id', uniform.id);
        
        setShowForm(false);
        setForm({ uniform_id: '', employee_id: '', quantity: '1', assigned_date: new Date().toISOString().split('T')[0], notes: '' });
        fetchData();
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    const filteredUniforms = uniforms.filter(u => filterCategory === 'all' || u.category === filterCategory);

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1';

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/inventory')} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                            Uniformes y EPP
                        </h2>
                        <p className="text-sm text-slate-500">Gestión de dotación para personal</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                        <button onClick={() => setActiveTab('inventory')} className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${activeTab === 'inventory' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>
                            Inventario
                        </button>
                        <button onClick={() => setActiveTab('assignments')} className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${activeTab === 'assignments' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>
                            Asignaciones
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : (
                <>
                    {activeTab === 'inventory' && (
                        <div className="space-y-4">
                            <div className="flex gap-2 mb-4">
                                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as any)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                                    <option value="all">Todas las Categorías</option>
                                    <option value="uniforme">Uniformes</option>
                                    <option value="epp">EPP (Equipo de Protección)</option>
                                </select>
                            </div>
                            
                            <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800/60 dark:bg-slate-900 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                                        <tr>
                                            <th className="px-5 py-3 text-left font-semibold text-slate-500">Artículo</th>
                                            <th className="px-5 py-3 text-center font-semibold text-slate-500">Categoría</th>
                                            <th className="px-5 py-3 text-center font-semibold text-slate-500">Talla</th>
                                            <th className="px-5 py-3 text-center font-semibold text-slate-500">Stock</th>
                                            <th className="px-5 py-3 text-right font-semibold text-slate-500">Valor Unitario</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredUniforms.map(u => (
                                            <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{u.name}</td>
                                                <td className="px-5 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${u.category === 'uniforme' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {u.category === 'uniforme' ? 'Uniforme' : 'EPP'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-center font-bold text-slate-700 dark:text-slate-300">{u.size || 'N/A'}</td>
                                                <td className="px-5 py-3 text-center font-bold text-slate-900 dark:text-white">
                                                    <span className={u.current_stock <= 2 ? 'text-red-500' : ''}>{u.current_stock}</span>
                                                </td>
                                                <td className="px-5 py-3 text-right text-slate-500">{formatCurrency(u.unit_cost)}</td>
                                            </tr>
                                        ))}
                                        {filteredUniforms.length === 0 && (
                                            <tr><td colSpan={5} className="py-8 text-center text-slate-400">No hay registros</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'assignments' && (
                        <div className="space-y-4">
                            <div className="flex justify-end mb-4">
                                <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-primary/20">
                                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                                    Asignar Uniforme/EPP
                                </button>
                            </div>
                            
                            {showForm && (
                                <form onSubmit={handleAssign} className="rounded-xl border border-primary/20 bg-primary/5 p-6 mb-6 shadow-inner">
                                    <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Nueva Asignación</h3>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                                        <div className="md:col-span-2">
                                            <label className={labelClass}>Colaborador</label>
                                            <select required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className={inputClass}>
                                                <option value="">Seleccionar...</option>
                                                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.department})</option>)}
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className={labelClass}>Artículo</label>
                                            <select required value={form.uniform_id} onChange={e => setForm({ ...form, uniform_id: e.target.value })} className={inputClass}>
                                                <option value="">Seleccionar...</option>
                                                {uniforms.filter(u => u.current_stock > 0).map(u => (
                                                    <option key={u.id} value={u.id}>{u.name} {u.size ? `[Talla: ${u.size}]` : ''} - Disp: {u.current_stock}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Cantidad</label>
                                            <input type="number" required min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className={inputClass} />
                                        </div>
                                        <div className="md:col-span-5">
                                            <label className={labelClass}>Notas</label>
                                            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputClass} placeholder="Ej. Reposición por desgaste..." />
                                        </div>
                                    </div>
                                    <div className="mt-4 flex gap-2">
                                        <button type="submit" className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white">Asignar y Descontar</button>
                                        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-5 py-2 text-sm text-slate-500">Cancelar</button>
                                    </div>
                                </form>
                            )}

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {assignments.map(a => (
                                    <div key={a.id} className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                    <span className="material-symbols-outlined text-[16px]">person</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{a.employee?.full_name}</p>
                                                    <p className="text-xs text-slate-500">{a.employee?.department}</p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {new Date(a.assigned_date).toLocaleDateString('es-MX')}
                                            </span>
                                        </div>
                                        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <div className="flex justify-between items-center">
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{a.uniform?.name}</p>
                                                <span className="text-sm font-bold text-primary">x{a.quantity}</span>
                                            </div>
                                            {a.uniform?.size && <p className="mt-1 text-xs font-bold text-indigo-500">Talla: {a.uniform.size}</p>}
                                        </div>
                                        {a.notes && <p className="mt-3 text-xs text-slate-500 italic">"{a.notes}"</p>}
                                    </div>
                                ))}
                                {assignments.length === 0 && (
                                    <p className="col-span-full py-8 text-center text-slate-400">Aún no hay asignaciones registradas.</p>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
