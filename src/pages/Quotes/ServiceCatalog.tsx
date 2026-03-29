import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
    ServiceCatalogItem,
    formatCurrency,
} from '../../types/quotes';

export default function ServiceCatalog() {
    const [services, setServices] = useState<ServiceCatalogItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<ServiceCatalogItem | null>(null);
    const [filterCat, setFilterCat] = useState<string | 'all'>('all');
    const [form, setForm] = useState({
        name: '',
        category: '',
        description: '',
        base_price: '',
        unit: 'servicio',
    });

    const fetchServices = useCallback(async () => {
        setLoading(true);
        const [settingsRes, servicesRes] = await Promise.all([
            supabase.from('system_settings').select('value').eq('key', 'service_categories').single(),
            supabase.from('service_catalog').select('*').order('category').order('name')
        ]);
        
        const catData = settingsRes.data?.value;
        const fetchedCats = Array.isArray(catData) ? catData : ['Otro'];
        setCategories(fetchedCats);

        let srvData = (servicesRes.data || []) as ServiceCatalogItem[];
        if (filterCat !== 'all') srvData = srvData.filter(s => s.category === filterCat);
        setServices(srvData);

        setLoading(false);
    }, [filterCat]);

    useEffect(() => { fetchServices(); }, [fetchServices]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            name: form.name,
            category: form.category,
            description: form.description || null,
            base_price: parseFloat(form.base_price) || 0,
            unit: form.unit,
        };
        if (editing) {
            await supabase.from('service_catalog').update(payload).eq('id', editing.id);
        } else {
            await supabase.from('service_catalog').insert(payload);
        }
        setShowForm(false);
        setEditing(null);
        setForm({ name: '', category: categories[0] || 'Otro', description: '', base_price: '', unit: 'servicio' });
        fetchServices();
    };

    const handleEdit = (s: ServiceCatalogItem) => {
        setEditing(s);
        setForm({
            name: s.name,
            category: s.category,
            description: s.description || '',
            base_price: s.base_price.toString(),
            unit: s.unit,
        });
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este servicio del catálogo?')) return;
        await supabase.from('service_catalog').delete().eq('id', id);
        fetchServices();
    };

    const handleToggleActive = async (s: ServiceCatalogItem) => {
        await supabase.from('service_catalog').update({ is_active: !s.is_active }).eq('id', s.id);
        fetchServices();
    };

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                        Catálogo de Servicios
                    </h2>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        Configura los servicios y precios base para las cotizaciones.
                    </p>
                </div>
                <button onClick={() => { setEditing(null); setForm({ name: '', category: categories[0] || 'Otro', description: '', base_price: '', unit: 'servicio' }); setShowForm(true); }}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Nuevo Servicio
                </button>
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-2">
                <button onClick={() => setFilterCat('all')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${filterCat === 'all' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'}`}>
                    Todos
                </button>
                {categories.map(c => (
                    <button key={c} onClick={() => setFilterCat(c)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${filterCat === c ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {c}
                    </button>
                ))}
            </div>

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="rounded-xl border border-primary/20 bg-primary/5 p-6 dark:bg-primary/5">
                    <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">{editing ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="md:col-span-2">
                            <label className={labelClass}>Nombre *</label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Ej: Aforo de pozo profundo" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Categoría</label>
                            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputClass}>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Precio Base</label>
                            <input type="number" step="0.01" value={form.base_price} onChange={e => setForm({ ...form, base_price: e.target.value })} placeholder="15000" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Unidad</label>
                            <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className={inputClass}>
                                <option value="servicio">Servicio</option>
                                <option value="hora">Hora</option>
                                <option value="metro">Metro</option>
                                <option value="km">Kilómetro</option>
                                <option value="pieza">Pieza</option>
                                <option value="dia">Día</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Descripción</label>
                            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descripción breve..." className={inputClass} />
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button type="submit" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">{editing ? 'Guardar' : 'Crear'}</button>
                        <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-400">Cancelar</button>
                    </div>
                </form>
            )}

            {/* Table */}
            <div className="rounded-xl border border-slate-200/60 bg-white/50 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-3.5 font-semibold text-slate-500">Servicio</th>
                                <th className="px-6 py-3.5 font-semibold text-slate-500">Categoría</th>
                                <th className="px-6 py-3.5 font-semibold text-slate-500">Precio Base</th>
                                <th className="px-6 py-3.5 font-semibold text-slate-500">Unidad</th>
                                <th className="px-6 py-3.5 font-semibold text-slate-500">Estado</th>
                                <th className="px-6 py-3.5 text-right font-semibold text-slate-500">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center">
                                    <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                </td></tr>
                            ) : services.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">No hay servicios en el catálogo.</td></tr>
                            ) : services.map(s => (
                                <tr key={s.id} className="group transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-slate-900 dark:text-white">{s.name}</p>
                                        {s.description && <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>}
                                    </td>
                                    <td className="px-6 py-4"><span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{s.category}</span></td>
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{formatCurrency(s.base_price)}</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 capitalize">{s.unit}</td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => handleToggleActive(s)} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                            {s.is_active ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(s)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-700"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                                            <button onClick={() => handleDelete(s.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"><span className="material-symbols-outlined text-[20px]">delete</span></button>
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
