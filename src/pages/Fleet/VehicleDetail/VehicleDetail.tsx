import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { 
    Vehicle, VehicleInsurance, VehicleMileage, VehicleMaintenance,
    VEHICLE_STATUS_LABELS, VEHICLE_STATUS_COLORS, VEHICLE_TYPE_ICONS, VEHICLE_TYPE_LABELS,
    isInsuranceExpiringSoon
} from '../../../types/fleet';
import { Project } from '../../../types/projects';

type Tab = 'overview' | 'insurances' | 'mileage' | 'maintenance';

export default function VehicleDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [insurances, setInsurances] = useState<VehicleInsurance[]>([]);
    const [mileage, setMileage] = useState<VehicleMileage[]>([]);
    const [maintenance, setMaintenance] = useState<VehicleMaintenance[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('overview');

    // Modals
    const [showInsForm, setShowInsForm] = useState(false);
    const [showMilForm, setShowMilForm] = useState(false);
    const [showMntForm, setShowMntForm] = useState(false);

    // Form states
    const [insForm, setInsForm] = useState<Partial<VehicleInsurance>>({});
    const [milForm, setMilForm] = useState<Partial<VehicleMileage>>({ 
        date: new Date().toISOString().split('T')[0], odometer_start: 0, odometer_end: 0 
    });
    const [mntForm, setMntForm] = useState<Partial<VehicleMaintenance>>({ 
        service_date: new Date().toISOString().split('T')[0], cost: 0 
    });

    const fetchAll = useCallback(async () => {
        if (!id) return;
        setLoading(true);

        const [vRes, iRes, mRes, mtRes, pRes] = await Promise.all([
            supabase.from('vehicles').select('*').eq('id', id).single(),
            supabase.from('vehicle_insurances').select('*').eq('vehicle_id', id).order('start_date', { ascending: false }),
            supabase.from('vehicle_mileage').select('*, project:projects(project_number, title)').eq('vehicle_id', id).order('date', { ascending: false }),
            supabase.from('vehicle_maintenance').select('*, project:projects(project_number, title)').eq('vehicle_id', id).order('service_date', { ascending: false }),
            supabase.from('projects').select('id, project_number, title, location')
        ]);

        setVehicle(vRes.data as Vehicle);
        setInsurances(iRes.data as VehicleInsurance[] || []);
        setMileage(mRes.data as VehicleMileage[] || []);
        setMaintenance(mtRes.data as VehicleMaintenance[] || []);
        setProjects(pRes.data as unknown as Project[] || []);
        
        if (vRes.data) {
            setMilForm(prev => ({ ...prev, odometer_start: vRes.data.current_mileage, odometer_end: vRes.data.current_mileage }));
            setMntForm(prev => ({ ...prev, odometer_reading: vRes.data.current_mileage }));
        }

        setLoading(false);
    }, [id]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Formatters
    const formatCurrency = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    
    const handleAddIns = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from('vehicle_insurances').insert({ ...insForm, vehicle_id: id });
        setShowInsForm(false);
        setInsForm({});
        fetchAll();
    };

    const handleAddMil = async (e: React.FormEvent) => {
        e.preventDefault();
        const dist = (milForm.odometer_end || 0) - (milForm.odometer_start || 0);
        const tripCost = dist * (vehicle?.cost_per_km || 0);

        await supabase.from('vehicle_mileage').insert({ 
            ...milForm, 
            vehicle_id: id, 
            calculated_trip_cost: tripCost,
            // odometer_start and end will calculate 'distance' via POSTGRES STORED generated column
        });
        setShowMilForm(false);
        setMilForm({ date: new Date().toISOString().split('T')[0] });
        fetchAll();
    };

    const handleAddMnt = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from('vehicle_maintenance').insert({ ...mntForm, vehicle_id: id });
        setShowMntForm(false);
        setMntForm({ service_date: new Date().toISOString().split('T')[0], cost: 0 });
        fetchAll();
    };

    if (loading) return <div className="flex flex-1 justify-center items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
    if (!vehicle) return <div className="p-8">Vehículo no encontrado</div>;

    const sectionClass = "rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900";

    return (
        <div className="flex flex-1 flex-col overflow-y-auto bg-slate-50 dark:bg-slate-950 p-8 gap-6">
            
            {/* Nav Row */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/fleet')} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800">
                    <span className="material-symbols-outlined text-[24px] text-slate-500">{VEHICLE_TYPE_ICONS[vehicle.vehicle_type] || 'directions_car'}</span>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{vehicle.brand} {vehicle.model} ({vehicle.year})</h1>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span className="font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 font-bold">{vehicle.plates}</span>
                        <span>•</span>
                        <span className="uppercase text-xs font-bold tracking-wider">{VEHICLE_TYPE_LABELS[vehicle.vehicle_type]}</span>
                        <span>•</span>
                        <span>Odom: <strong className="text-slate-900 dark:text-white">{vehicle.current_mileage.toLocaleString()} km</strong></span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${VEHICLE_STATUS_COLORS[vehicle.status].bg} ${VEHICLE_STATUS_COLORS[vehicle.status].text}`}>
                            {VEHICLE_STATUS_LABELS[vehicle.status]}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg flex-wrap bg-slate-100 p-1 dark:bg-slate-800">
                {[
                    { key: 'overview', icon: 'dashboard', label: 'General' },
                    { key: 'insurances', icon: 'verified_user', label: `Seguros (${insurances.length})` },
                    { key: 'mileage', icon: 'speed', label: `Kilometraje (${mileage.length})` },
                    { key: 'maintenance', icon: 'build', label: `Mantenimiento (${maintenance.length})` },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as Tab)}
                        className={`flex flex-1 items-center justify-center min-w-[120px] gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                        <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={sectionClass}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-slate-400">info</span>Detalles Operativos</h3>
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                <span className="text-slate-500">Responsable Asignado</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{vehicle.assigned_to || 'Sin asignación'}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                <span className="text-slate-500">Costo Operativo Base</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(vehicle.cost_per_km)} / km</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                <span className="text-slate-500">Recorrido Total Histórico</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{vehicle.current_mileage.toLocaleString()} km</span>
                            </div>
                            {vehicle.notes && (
                                <div className="pt-2">
                                    <span className="text-slate-500 block mb-1">Notas Internas:</span>
                                    <p className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-slate-700 dark:text-slate-300 text-xs italic">{vehicle.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {tab === 'insurances' && (
                <div className={sectionClass}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2"><span className="material-symbols-outlined text-indigo-500">verified_user</span>Pólizas de Seguro</h3>
                        <button onClick={() => setShowInsForm(true)} className="flex items-center gap-2 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-3 py-1.5 text-sm font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">add</span>Nueva Póliza
                        </button>
                    </div>
                    {insurances.length === 0 ? <p className="text-sm text-slate-500">No hay seguros registrados.</p> : (
                        <div className="space-y-3">
                            {insurances.map(ins => {
                                const exp = isInsuranceExpiringSoon(ins.end_date);
                                return (
                                    <div key={ins.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white text-base">{ins.provider} <span className="text-xs font-mono font-normal text-slate-500 ml-2">#{ins.policy_number}</span></p>
                                            <p className="text-xs text-slate-500 mt-1">Vigencia: {new Date(ins.start_date).toLocaleDateString('es-MX')} al {new Date(ins.end_date).toLocaleDateString('es-MX')}</p>
                                            {ins.coverage_details && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{ins.coverage_details}</p>}
                                        </div>
                                        <div className="mt-3 sm:mt-0 text-right flex flex-col sm:items-end gap-1">
                                            <p className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(ins.cost)}</p>
                                            {exp.status === 'expired' && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Vencida hace {Math.abs(exp.days)} días</span>}
                                            {exp.status === 'warning' && <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Vence en {exp.days} días</span>}
                                            {exp.status === 'ok' && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Vigente ({exp.days} días más)</span>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {tab === 'mileage' && (
                <div className={sectionClass}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500">speed</span>Bitácora de Kilometraje / Viajes</h3>
                        <button onClick={() => setShowMilForm(true)} className="flex items-center gap-2 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">add</span>Registrar Viaje
                        </button>
                    </div>
                    {mileage.length === 0 ? <p className="text-sm text-slate-500">No hay registros de kilometraje.</p> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-slate-500">Fecha</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500">Conductor</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500">Destino</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500">Proyecto</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500">Recorrido</th>
                                        <th className="px-3 py-3 font-semibold text-slate-500 text-center">Tanque</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-right">Costo Combustible</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-right">Costo Operativo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {mileage.map(m => (
                                        <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">{new Date(m.date).toLocaleDateString('es-MX')}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{m.driver_name}</td>
                                            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                                {m.destination ? <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px] text-slate-400">location_on</span>{m.destination}</span> : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                {/* @ts-ignore */}
                                                {m.project ? <span className="font-mono">{m.project.project_number}</span> : '—'}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs">
                                                <div className="text-slate-500">{m.odometer_start} - {m.odometer_end}</div>
                                                <div className="font-bold text-emerald-500 mt-0.5">+{m.distance} km</div>
                                            </td>
                                            <td className="px-3 py-3 text-center text-xs">
                                                {(m.fuel_level_start != null || m.fuel_level_end != null) ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span className="text-slate-500">{m.fuel_level_start ?? '?'}%</span>
                                                        <span className="material-symbols-outlined text-[12px] text-slate-400">arrow_forward</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-semibold">{m.fuel_level_end ?? '?'}%</span>
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-500">{m.fuel_cost > 0 ? formatCurrency(m.fuel_cost) : '—'}</td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">{formatCurrency(m.calculated_trip_cost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {tab === 'maintenance' && (
                <div className={sectionClass}>
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2"><span className="material-symbols-outlined text-amber-500">build</span>Historial de Mantenimientos</h3>
                        <button onClick={() => setShowMntForm(true)} className="flex items-center gap-2 rounded bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1.5 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">add</span>Registrar Servicio
                        </button>
                    </div>
                    {maintenance.length === 0 ? <p className="text-sm text-slate-500">No hay mantenimientos registrados.</p> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-slate-500">Fecha</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500">Tipo de Servicio</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500">Taller / Proveedor</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500">Proyecto Ref.</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-right">Costo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {maintenance.map(m => (
                                        <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">{new Date(m.service_date).toLocaleDateString('es-MX')}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{m.service_type}</td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{m.provider || '—'}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                {/* @ts-ignore */}
                                                {m.project ? <span className="font-mono text-red-500 font-bold">{m.project.project_number}</span> : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-amber-600">{formatCurrency(m.cost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}


            {/* Seguros Modal */}
            {showInsForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Registrar Póliza</h3>
                            <button onClick={() => setShowInsForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <form onSubmit={handleAddIns} className="space-y-4">
                            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Aseguradora</label><input required type="text" value={insForm.provider || ''} onChange={e => setInsForm({...insForm, provider: e.target.value})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-slate-500">No. Póliza</label><input required type="text" value={insForm.policy_number || ''} onChange={e => setInsForm({...insForm, policy_number: e.target.value})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Vigencia Inicio</label><input required type="date" value={insForm.start_date || ''} onChange={e => setInsForm({...insForm, start_date: e.target.value})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Vigencia Fin</label><input required type="date" value={insForm.end_date || ''} onChange={e => setInsForm({...insForm, end_date: e.target.value})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            </div>
                            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Costo Póliza</label><input required type="number" step="0.01" value={insForm.cost || 0} onChange={e => setInsForm({...insForm, cost: parseFloat(e.target.value)})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Detalles de Cobertura</label><textarea value={insForm.coverage_details || ''} onChange={e => setInsForm({...insForm, coverage_details: e.target.value})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900"></textarea></div>
                            <button type="submit" className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700">Guardar Póliza</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Mileage Modal */}
            {showMilForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Registrar Viaje</h3>
                            <button onClick={() => setShowMilForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <form onSubmit={handleAddMil} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Conductor *</label><input required type="text" value={milForm.driver_name || ''} onChange={e => setMilForm({...milForm, driver_name: e.target.value})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Fecha *</label><input required type="date" value={milForm.date || ''} onChange={e => setMilForm({...milForm, date: e.target.value})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">Proyecto Asociado (Opcional)</label>
                                <select value={milForm.project_id || ''} onChange={e => {
                                    const pid = e.target.value || undefined;
                                    const proj = projects.find(p => p.id === pid);
                                    setMilForm({...milForm, project_id: pid, destination: proj?.location || milForm.destination || ''});
                                }} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900">
                                    <option value="">-- Sin Proyecto (Operativo Gral) --</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} - {p.title}{p.location ? ` (${p.location})` : ''}</option>)}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">Si seleccionas un proyecto, el destino se llena automáticamente con la ubicación del proyecto.</p>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">Destino</label>
                                <input type="text" value={(milForm as any).destination || ''} onChange={e => setMilForm({...milForm, destination: e.target.value} as any)} placeholder="Ciudad, ubicación del pozo, etc." className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Fecha/Hora Salida</label><input type="datetime-local" value={(milForm as any).departure_date || ''} onChange={e => setMilForm({...milForm, departure_date: e.target.value} as any)} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Fecha/Hora Regreso</label><input type="datetime-local" value={(milForm as any).return_date || ''} onChange={e => setMilForm({...milForm, return_date: e.target.value} as any)} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Odom. Inicial *</label><input required type="number" step="0.1" value={milForm.odometer_start || 0} onChange={e => setMilForm({...milForm, odometer_start: parseFloat(e.target.value)})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Odom. Final *</label><input required type="number" step="0.1" value={milForm.odometer_end || 0} onChange={e => setMilForm({...milForm, odometer_end: parseFloat(e.target.value)})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            </div>
                            <div className="flex justify-between items-center bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-sm border border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800/50">
                                <span>Distancia: <strong>{((milForm.odometer_end || 0) - (milForm.odometer_start || 0)).toFixed(1)} km</strong></span>
                                <span>Costo op: <strong>{formatCurrency(((milForm.odometer_end || 0) - (milForm.odometer_start || 0)) * vehicle.cost_per_km)}</strong></span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">% Tanque Salida</label>
                                    <div className="flex items-center gap-2">
                                        <input type="range" min="0" max="100" step="5" value={(milForm as any).fuel_level_start || 0} onChange={e => setMilForm({...milForm, fuel_level_start: parseInt(e.target.value)} as any)} className="flex-1 accent-emerald-500" />
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-10 text-right">{(milForm as any).fuel_level_start || 0}%</span>
                                    </div>
                                </div>
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">% Tanque Regreso</label>
                                    <div className="flex items-center gap-2">
                                        <input type="range" min="0" max="100" step="5" value={(milForm as any).fuel_level_end || 0} onChange={e => setMilForm({...milForm, fuel_level_end: parseInt(e.target.value)} as any)} className="flex-1 accent-emerald-500" />
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-10 text-right">{(milForm as any).fuel_level_end || 0}%</span>
                                    </div>
                                </div>
                            </div>
                            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Costo Carga Combustible ($ opcional)</label><input type="number" step="0.01" value={milForm.fuel_cost || 0} onChange={e => setMilForm({...milForm, fuel_cost: parseFloat(e.target.value)})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Observaciones</label><textarea value={milForm.notes || ''} onChange={e => setMilForm({...milForm, notes: e.target.value})} rows={2} placeholder="Notas del viaje..." className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900 resize-none" /></div>
                            <button type="submit" className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700">Guardar Viaje</button>
                        </form>
                    </div>
                </div>
            )}


            {/* Maintenance Modal */}
            {showMntForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Registrar Mantenimiento/Falla</h3>
                            <button onClick={() => setShowMntForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <form onSubmit={handleAddMnt} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Fecha Servicio</label><input required type="date" value={mntForm.service_date || ''} onChange={e => setMntForm({...mntForm, service_date: e.target.value})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Tipo (Ej. Cambio Llanta)</label><input required type="text" value={mntForm.service_type || ''} onChange={e => setMntForm({...mntForm, service_type: e.target.value})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">Pegar a Proyecto? (Desgaste en campo)</label>
                                <select value={mntForm.project_id || ''} onChange={e => setMntForm({...mntForm, project_id: e.target.value || undefined})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900">
                                    <option value="">-- Sin Proyecto --</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} - {p.title}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Costo Total ($)</label><input required type="number" step="0.01" value={mntForm.cost || 0} onChange={e => setMntForm({...mntForm, cost: parseFloat(e.target.value)})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Proveedor/Taller</label><input type="text" value={mntForm.provider || ''} onChange={e => setMntForm({...mntForm, provider: e.target.value})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            </div>
                            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Odómetro al servicio</label><input type="number" step="1" value={mntForm.odometer_reading || 0} onChange={e => setMntForm({...mntForm, odometer_reading: parseFloat(e.target.value)})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Siguiente Servicio (KM estim.)</label><input type="number" step="1" value={mntForm.next_service_mileage || ''} onChange={e => setMntForm({...mntForm, next_service_mileage: parseFloat(e.target.value)})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            <button type="submit" className="w-full rounded-lg bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700">Guardar Mantenimiento</button>
                        </form>
                    </div>
                </div>
            )}
            
        </div>
    );
}
