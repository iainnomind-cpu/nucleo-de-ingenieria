import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
    Vehicle, VehicleType, VehicleStatus,
    VEHICLE_TYPE_LABELS, VEHICLE_TYPE_ICONS,
    VEHICLE_STATUS_LABELS, VEHICLE_STATUS_COLORS
} from '../../types/fleet';

export default function VehiclesList() {
    const navigate = useNavigate();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<VehicleStatus | 'all'>('all');
    const [filterType, setFilterType] = useState<VehicleType | 'all'>('all');
    
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Vehicle | null>(null);
    const [form, setForm] = useState({
        plates: '', brand: '', model: '', year: new Date().getFullYear().toString(),
        vehicle_type: 'pickup' as VehicleType, status: 'active' as VehicleStatus,
        assigned_to: '', cost_per_km: '5', current_mileage: '0', notes: ''
    });

    const [teamMembers, setTeamMembers] = useState<string[]>([]);

    const fetchVehicles = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('vehicles').select('*').order('brand');
        if (filterStatus !== 'all') q = q.eq('status', filterStatus);
        if (filterType !== 'all') q = q.eq('vehicle_type', filterType);
        
        const { data } = await q;
        let filtered = (data as Vehicle[]) || [];
        if (search.trim()) {
            const s = search.toLowerCase();
            filtered = filtered.filter(v => v.plates.toLowerCase().includes(s) || v.brand.toLowerCase().includes(s) || v.model.toLowerCase().includes(s));
        }
        setVehicles(filtered);

        // Fetch team members dynamically
        const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'team_directory').single();
        if (settings?.value && Array.isArray(settings.value)) {
            setTeamMembers(settings.value);
        }

        setLoading(false);
    }, [filterStatus, filterType, search]);

    useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

    const openCreate = () => {
        setEditing(null);
        setForm({ plates: '', brand: '', model: '', year: new Date().getFullYear().toString(), vehicle_type: 'pickup', status: 'active', assigned_to: '', cost_per_km: '5', current_mileage: '0', notes: '' });
        setShowForm(true);
    }

    const openEdit = (v: Vehicle) => {
        setEditing(v);
        setForm({ plates: v.plates, brand: v.brand, model: v.model, year: v.year.toString(), vehicle_type: v.vehicle_type, status: v.status, assigned_to: v.assigned_to || '', cost_per_km: v.cost_per_km.toString(), current_mileage: v.current_mileage.toString(), notes: v.notes || '' });
        setShowForm(true);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            plates: form.plates.toUpperCase(), brand: form.brand, model: form.model, year: parseInt(form.year) || 2020,
            vehicle_type: form.vehicle_type, status: form.status, assigned_to: form.assigned_to || null,
            cost_per_km: parseFloat(form.cost_per_km) || 0,
            current_mileage: parseFloat(form.current_mileage) || 0,
            notes: form.notes || null,
        };
        
        if (editing) {
            await supabase.from('vehicles').update(payload).eq('id', editing.id);
        } else {
            // @ts-ignore
            await supabase.from('vehicles').insert(payload);
        }
        setShowForm(false);
        fetchVehicles();
    };

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Flotilla & Vehículos</h2>
                    <p className="text-sm text-slate-500">Gestión de unidades, mantenimientos y traslados.</p>
                </div>
                <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-primary-dark">
                    <span className="material-symbols-outlined text-[18px]">add</span>Nuevo Vehículo
                </button>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-200/60 bg-white/50 p-4 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                <div className="relative w-full md:w-96">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input type="text" placeholder="Buscar placas, marca, modelo..." value={search} onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-lg border-0 bg-slate-100 py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:text-white" />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="rounded-lg border-0 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                        <option value="all">Tipos (Todos)</option>
                        {Object.entries(VEHICLE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="rounded-lg border-0 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                        <option value="all">Estatus (Todos)</option>
                        {Object.entries(VEHICLE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-1 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {vehicles.map(v => (
                        <div key={v.id} onClick={() => navigate(`/fleet/${v.id}`)} className="group cursor-pointer rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-primary/50 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                            <div className="relative h-32 w-full overflow-hidden rounded-t-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-500 text-[64px]">{VEHICLE_TYPE_ICONS[v.vehicle_type] || 'directions_car'}</span>
                                <div className={`absolute top-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${VEHICLE_STATUS_COLORS[v.status].bg} ${VEHICLE_STATUS_COLORS[v.status].text}`}>
                                    {VEHICLE_STATUS_LABELS[v.status]}
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">{v.brand} {v.model}</h3>
                                        <div className="mt-1 inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                            {v.plates}
                                        </div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); openEdit(v); }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-700">
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                </div>
                                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                                    <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">speed</span>{v.current_mileage.toLocaleString()} km</div>
                                    <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">person</span>{v.assigned_to || 'Sin asignar'}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {vehicles.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-500">No se encontraron vehículos.</div>
                    )}
                </div>
            )}

            {/* Modal de Vehículo */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{editing ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h3>
                            <button onClick={() => setShowForm(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"><span className="material-symbols-outlined text-[20px]">close</span></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Marca</label>
                                    <input required type="text" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className="w-full rounded-lg border-0 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900/50" />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Modelo</label>
                                    <input required type="text" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="w-full rounded-lg border-0 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900/50" />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Placas</label>
                                    <input required type="text" value={form.plates} onChange={e => setForm({ ...form, plates: e.target.value })} className="w-full rounded-lg border-0 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900/50 uppercase" />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Año</label>
                                    <input required type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} className="w-full rounded-lg border-0 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900/50" />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Tipo</label>
                                    <select value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value as any })} className="w-full rounded-lg border-0 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900/50">
                                        {Object.entries(VEHICLE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Estatus</label>
                                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })} className="w-full rounded-lg border-0 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900/50">
                                        {Object.entries(VEHICLE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Asignado A (Responsable)</label>
                                    <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} className="w-full rounded-lg border-0 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900/50">
                                        <option value="">Sin Asignar</option>
                                        {teamMembers.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Costo por KM ($ MXN)</label>
                                    <input required type="number" step="0.01" value={form.cost_per_km} onChange={e => setForm({ ...form, cost_per_km: e.target.value })} className="w-full rounded-lg border-0 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900/50" />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Kilometraje {editing ? 'Actual' : 'Inicial'}</label>
                                    <input required type="number" step="1" value={form.current_mileage} onChange={e => setForm({ ...form, current_mileage: e.target.value })} className="w-full rounded-lg border-0 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900/50" />
                                </div>
                                <div className="col-span-2">
                                    <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">Notas</label>
                                    <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full rounded-lg border-0 bg-slate-50 p-3 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900/50" />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Cancelar</button>
                                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">Guardar Vehículo</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
