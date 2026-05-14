import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/AuthContext';
import { 
    Vehicle, VehicleInsurance, VehicleMileage, VehicleMaintenance, VehicleServiceSchedule,
    SchedulePriority, ScheduleStatus,
    VEHICLE_STATUS_LABELS, VEHICLE_STATUS_COLORS, VEHICLE_TYPE_ICONS, VEHICLE_TYPE_LABELS,
    VERIFICATION_STATUS_LABELS, VERIFICATION_STATUS_COLORS,
    SCHEDULE_PRIORITY_LABELS, SCHEDULE_PRIORITY_COLORS,
    isInsuranceExpiringSoon, getServiceScheduleStatus, calculateEfficiency
} from '../../../types/fleet';
import { Project } from '../../../types/projects';

type Tab = 'overview' | 'insurances' | 'mileage' | 'maintenance' | 'services' | 'performance';

export default function VehicleDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const canEdit = hasPermission('fleet', 'edit');
    const canCreate = hasPermission('fleet', 'create');
    const canDelete = hasPermission('fleet', 'delete');
    
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [insurances, setInsurances] = useState<VehicleInsurance[]>([]);
    const [mileage, setMileage] = useState<VehicleMileage[]>([]);
    const [maintenance, setMaintenance] = useState<VehicleMaintenance[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('overview');

    const [schedules, setSchedules] = useState<VehicleServiceSchedule[]>([]);

    // Modals
    const [showInsForm, setShowInsForm] = useState(false);
    const [showMilForm, setShowMilForm] = useState(false);
    const [showMntForm, setShowMntForm] = useState(false);
    const [showSchedForm, setShowSchedForm] = useState(false);

    // Form states
    const [insForm, setInsForm] = useState<Partial<VehicleInsurance>>({});
    const [editingInsId, setEditingInsId] = useState<string | null>(null);
    const [milForm, setMilForm] = useState<Partial<VehicleMileage & { fuel_liters: number }>>({ 
        date: new Date().toISOString().split('T')[0], odometer_start: 0, odometer_end: 0, fuel_liters: 0 
    });
    const [mntForm, setMntForm] = useState<Partial<VehicleMaintenance>>({ 
        service_date: new Date().toISOString().split('T')[0], cost: 0 
    });
    const [schedForm, setSchedForm] = useState<Partial<VehicleServiceSchedule>>({
        service_name: '', interval_km: null, interval_months: null,
        last_service_date: null, last_service_mileage: null,
        status: 'active', priority: 'normal', notes: ''
    });

    const fetchAll = useCallback(async () => {
        if (!id) return;
        setLoading(true);

        const [vRes, iRes, mRes, mtRes, pRes, sRes] = await Promise.all([
            supabase.from('vehicles').select('*').eq('id', id).single(),
            supabase.from('vehicle_insurances').select('*').eq('vehicle_id', id).order('start_date', { ascending: false }),
            supabase.from('vehicle_mileage').select('*, project:projects(project_number, title)').eq('vehicle_id', id).order('date', { ascending: false }),
            supabase.from('vehicle_maintenance').select('*, project:projects(project_number, title)').eq('vehicle_id', id).order('service_date', { ascending: false }),
            supabase.from('projects').select('id, project_number, title, location'),
            supabase.from('vehicle_service_schedules').select('*').eq('vehicle_id', id).order('created_at', { ascending: false })
        ]);

        setVehicle(vRes.data as Vehicle);
        setInsurances(iRes.data as VehicleInsurance[] || []);
        setMileage(mRes.data as VehicleMileage[] || []);
        setMaintenance(mtRes.data as VehicleMaintenance[] || []);
        setProjects(pRes.data as unknown as Project[] || []);
        setSchedules(sRes.data as VehicleServiceSchedule[] || []);
        
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
        if (editingInsId) {
            const { vehicle_id, id: _id, created_at, ...updateData } = insForm as any;
            await supabase.from('vehicle_insurances').update(updateData).eq('id', editingInsId);
        } else {
            await supabase.from('vehicle_insurances').insert({ ...insForm, vehicle_id: id });
        }
        setShowInsForm(false);
        setInsForm({});
        setEditingInsId(null);
        fetchAll();
    };

    const handleEditIns = (ins: VehicleInsurance) => {
        setInsForm({
            provider: ins.provider,
            policy_number: ins.policy_number,
            start_date: ins.start_date,
            end_date: ins.end_date,
            cost: ins.cost,
            coverage_details: ins.coverage_details || '',
        });
        setEditingInsId(ins.id);
        setShowInsForm(true);
    };

    const handleDeleteIns = async (insId: string) => {
        if (!window.confirm('¿Eliminar esta póliza de seguro? Esta acción no se puede deshacer.')) return;
        await supabase.from('vehicle_insurances').delete().eq('id', insId);
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
        });
        setShowMilForm(false);
        setMilForm({ date: new Date().toISOString().split('T')[0], fuel_liters: 0 });
        fetchAll();
    };

    const handleAddMnt = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from('vehicle_maintenance').insert({ ...mntForm, vehicle_id: id });
        setShowMntForm(false);
        setMntForm({ service_date: new Date().toISOString().split('T')[0], cost: 0 });
        fetchAll();
    };

    const handleAddSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from('vehicle_service_schedules').insert({ ...schedForm, vehicle_id: id });
        setShowSchedForm(false);
        setSchedForm({ service_name: '', interval_km: null, interval_months: null, last_service_date: null, last_service_mileage: null, status: 'active', priority: 'normal', notes: '' });
        fetchAll();
    };

    const handleMarkServiceDone = async (sched: VehicleServiceSchedule) => {
        await supabase.from('vehicle_service_schedules').update({
            last_service_date: new Date().toISOString().split('T')[0],
            last_service_mileage: vehicle?.current_mileage || 0,
        }).eq('id', sched.id);
        fetchAll();
    };

    const efficiency = useMemo(() => calculateEfficiency(mileage), [mileage]);

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
                    { key: 'services', icon: 'event', label: `Agenda (${schedules.length})` },
                    { key: 'performance', icon: 'analytics', label: 'Rendimiento' },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as Tab)}
                        className={`flex flex-1 items-center justify-center min-w-[120px] gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                        <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {/* Datos Vehiculares */}
                    <div className={sectionClass}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-slate-400">directions_car</span>Datos Vehiculares</h3>
                        <div className="space-y-3 text-sm">
                            {[
                                ['No. de Serie', vehicle.serial_number || 'No registrado'],
                                ['Agencia', vehicle.dealer || 'No registrada'],
                                ['Placas', vehicle.plates],
                                ['Tipo', VEHICLE_TYPE_LABELS[vehicle.vehicle_type]],
                                ['Año/Modelo', vehicle.year.toString()],
                            ].map(([label, val]) => (
                                <div key={label} className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <span className="text-slate-500">{label}</span>
                                    <span className="font-semibold text-slate-900 dark:text-white font-mono text-xs">{val}</span>
                                </div>
                            ))}
                            {/* Verification */}
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-slate-500">Verificación Vehicular</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${VERIFICATION_STATUS_COLORS[vehicle.verification_status || 'pending'].bg} ${VERIFICATION_STATUS_COLORS[vehicle.verification_status || 'pending'].text}`}>
                                    {VERIFICATION_STATUS_LABELS[vehicle.verification_status || 'pending']}
                                    {vehicle.verification_date && <span className="ml-1 opacity-70">({new Date(vehicle.verification_date).toLocaleDateString('es-MX')})</span>}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Operativos */}
                    <div className={sectionClass}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-slate-400">settings</span>Detalles Operativos</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                <span className="text-slate-500">Responsable Asignado</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{vehicle.assigned_to || 'Sin asignación'}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                <span className="text-slate-500">Costo Operativo Base</span>
                                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(vehicle.cost_per_km)} / km</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                <span className="text-slate-500">Odómetro Actual</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-lg">{vehicle.current_mileage.toLocaleString()} km</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                <span className="text-slate-500">Rendimiento Promedio</span>
                                <span className="font-semibold text-blue-600 dark:text-blue-400">{efficiency.avgKmPerLiter > 0 ? `${efficiency.avgKmPerLiter.toFixed(1)} km/l` : 'Sin datos'}</span>
                            </div>
                            {vehicle.notes && (
                                <div className="pt-2">
                                    <span className="text-slate-500 block mb-1">Notas Internas:</span>
                                    <p className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-slate-700 dark:text-slate-300 text-xs italic">{vehicle.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Seguro Vigente */}
                    <div className={sectionClass}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-indigo-500">verified_user</span>Seguro Vigente</h3>
                        {insurances.length > 0 ? (() => {
                            const ins = insurances[0];
                            const exp = isInsuranceExpiringSoon(ins.end_date);
                            return (
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                        <span className="text-slate-500">Aseguradora</span>
                                        <span className="font-bold text-slate-900 dark:text-white">{ins.provider}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                        <span className="text-slate-500">No. Póliza</span>
                                        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{ins.policy_number}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                        <span className="text-slate-500">Vigencia</span>
                                        <span className="text-xs text-slate-600 dark:text-slate-400">{new Date(ins.start_date).toLocaleDateString('es-MX')} — {new Date(ins.end_date).toLocaleDateString('es-MX')}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                        <span className="text-slate-500">Costo Póliza</span>
                                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(ins.cost)}</span>
                                    </div>
                                    <div className="flex justify-center pt-2">
                                        {exp.status === 'expired' && <span className="text-xs font-bold text-red-600 bg-red-100 px-3 py-1 rounded-full">⚠ Vencida hace {Math.abs(exp.days)} días</span>}
                                        {exp.status === 'warning' && <span className="text-xs font-bold text-amber-600 bg-amber-100 px-3 py-1 rounded-full">⏰ Vence en {exp.days} días</span>}
                                        {exp.status === 'ok' && <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">✓ Vigente ({exp.days} días restantes)</span>}
                                    </div>
                                </div>
                            );
                        })() : (
                            <p className="text-sm text-slate-400 italic">Sin seguros registrados. <button onClick={() => { setTab('insurances'); setShowInsForm(true); }} className="text-indigo-500 underline">Agregar póliza</button></p>
                        )}
                    </div>

                    {/* Próximos Servicios Agendados */}
                    <div className={`${sectionClass} md:col-span-2 xl:col-span-3`}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-amber-500">event</span>Servicios Agendados Próximos</h3>
                        {schedules.filter(s => s.status === 'active').length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Sin servicios agendados. <button onClick={() => setTab('services')} className="text-amber-500 underline">Crear agenda</button></p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {schedules.filter(s => s.status === 'active').slice(0, 6).map(s => {
                                    const st = getServiceScheduleStatus(s, vehicle.current_mileage);
                                    const borderColor = st.status === 'overdue' ? 'border-red-300 dark:border-red-800' : st.status === 'upcoming' ? 'border-amber-300 dark:border-amber-800' : 'border-slate-200 dark:border-slate-700';
                                    return (
                                        <div key={s.id} className={`p-3 rounded-lg border ${borderColor} bg-white dark:bg-slate-800/50`}>
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-sm text-slate-900 dark:text-white">{s.service_name}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SCHEDULE_PRIORITY_COLORS[s.priority].bg} ${SCHEDULE_PRIORITY_COLORS[s.priority].text}`}>{SCHEDULE_PRIORITY_LABELS[s.priority]}</span>
                                            </div>
                                            <div className="mt-2 flex flex-col gap-1 text-xs text-slate-500">
                                                {st.daysUntilDue !== null && <span>{st.daysUntilDue <= 0 ? <strong className="text-red-500">Vencido hace {Math.abs(st.daysUntilDue)} días</strong> : `En ${st.daysUntilDue} días`}</span>}
                                                {st.kmUntilDue !== null && <span>{st.kmUntilDue <= 0 ? <strong className="text-red-500">Excedido por {Math.abs(Math.round(st.kmUntilDue))} km</strong> : `Faltan ${Math.round(st.kmUntilDue).toLocaleString()} km`}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === 'insurances' && (
                <div className={sectionClass}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2"><span className="material-symbols-outlined text-indigo-500">verified_user</span>Pólizas de Seguro</h3>
                        {canCreate && <button onClick={() => { setEditingInsId(null); setInsForm({}); setShowInsForm(true); }} className="flex items-center gap-2 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-3 py-1.5 text-sm font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">add</span>Nueva Póliza
                        </button>}
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
                                        <div className="mt-3 sm:mt-0 text-right flex flex-col sm:items-end gap-2">
                                            <p className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(ins.cost)}</p>
                                            {exp.status === 'expired' && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Vencida hace {Math.abs(exp.days)} días</span>}
                                            {exp.status === 'warning' && <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Vence en {exp.days} días</span>}
                                            {exp.status === 'ok' && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Vigente ({exp.days} días más)</span>}
                                            {(canEdit || canDelete) && <div className="flex items-center gap-1">
                                                {canEdit && <button onClick={() => handleEditIns(ins)} className="rounded p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors" title="Editar">
                                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                                </button>}
                                                {canDelete && <button onClick={() => handleDeleteIns(ins.id)} className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Eliminar">
                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                </button>}
                                            </div>}
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
                        {canCreate && <button onClick={() => setShowMilForm(true)} className="flex items-center gap-2 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">add</span>Registrar Viaje
                        </button>}
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
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-center">Litros</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-center">Rendimiento</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-right">Costo Combustible</th>
                                        <th className="px-4 py-3 font-semibold text-slate-500 text-right">Costo Operativo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {mileage.map(m => {
                                        const rendimiento = m.fuel_liters > 0 && m.distance > 0 ? (m.distance / m.fuel_liters) : null;
                                        return (
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
                                            <td className="px-4 py-3 text-center text-xs font-mono text-slate-600 dark:text-slate-400">
                                                {m.fuel_liters > 0 ? `${m.fuel_liters.toFixed(1)} L` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {rendimiento ? (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${rendimiento >= 10 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : rendimiento >= 5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                        <span className="material-symbols-outlined text-[12px]">local_gas_station</span>
                                                        {rendimiento.toFixed(1)} km/l
                                                    </span>
                                                ) : <span className="text-xs text-slate-400">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-500">{m.fuel_cost > 0 ? formatCurrency(m.fuel_cost) : '—'}</td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">{formatCurrency(m.calculated_trip_cost)}</td>
                                        </tr>
                                        );
                                    })}
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
                        {canCreate && <button onClick={() => setShowMntForm(true)} className="flex items-center gap-2 rounded bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1.5 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">add</span>Registrar Servicio
                        </button>}
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
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{editingInsId ? 'Editar Póliza' : 'Registrar Póliza'}</h3>
                            <button onClick={() => { setShowInsForm(false); setEditingInsId(null); setInsForm({}); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><span className="material-symbols-outlined">close</span></button>
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
                            <button type="submit" className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700">{editingInsId ? 'Actualizar Póliza' : 'Guardar Póliza'}</button>
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
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Litros Cargados</label><input type="number" step="0.01" value={(milForm as any).fuel_liters || 0} onChange={e => setMilForm({...milForm, fuel_liters: parseFloat(e.target.value)} as any)} placeholder="Ej: 65.5" className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Costo Combustible ($)</label><input type="number" step="0.01" value={milForm.fuel_cost || 0} onChange={e => setMilForm({...milForm, fuel_cost: parseFloat(e.target.value)})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            </div>
                            {(milForm as any).fuel_liters > 0 && ((milForm.odometer_end || 0) - (milForm.odometer_start || 0)) > 0 && (
                                <div className="flex items-center justify-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm border border-blue-100 dark:bg-blue-900/30 dark:border-blue-800/50">
                                    <span className="material-symbols-outlined text-[16px]">local_gas_station</span>
                                    <span>Rendimiento: <strong>{(((milForm.odometer_end || 0) - (milForm.odometer_start || 0)) / (milForm as any).fuel_liters).toFixed(1)} km/l</strong></span>
                                </div>
                            )}
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
            
            {/* ===== SERVICES TAB ===== */}
            {tab === 'services' && (
                <div className={sectionClass}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2"><span className="material-symbols-outlined text-violet-500">event</span>Agenda de Servicios</h3>
                        {canCreate && <button onClick={() => setShowSchedForm(true)} className="flex items-center gap-2 rounded bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 px-3 py-1.5 text-sm font-semibold hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">add</span>Agendar Servicio
                        </button>}
                    </div>
                    <p className="text-xs text-slate-400 mb-4">Agenda servicios recurrentes por kilometraje o por tiempo. El sistema te alertará cuando estén próximos o vencidos.</p>
                    {schedules.length === 0 ? <p className="text-sm text-slate-500">No hay servicios agendados.</p> : (
                        <div className="space-y-3">
                            {schedules.map(s => {
                                const st = getServiceScheduleStatus(s, vehicle.current_mileage);
                                const bgColor = st.status === 'overdue' ? 'border-l-red-500 bg-red-50/50 dark:bg-red-900/10' : st.status === 'upcoming' ? 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10' : 'border-l-emerald-500 bg-white dark:bg-slate-800/50';
                                return (
                                    <div key={s.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 border-l-4 ${bgColor}`}>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-slate-900 dark:text-white">{s.service_name}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SCHEDULE_PRIORITY_COLORS[s.priority].bg} ${SCHEDULE_PRIORITY_COLORS[s.priority].text}`}>{SCHEDULE_PRIORITY_LABELS[s.priority]}</span>
                                                {s.status !== 'active' && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">{s.status === 'paused' ? 'Pausado' : 'Completado'}</span>}
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                                                {s.interval_km && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">speed</span>Cada {s.interval_km.toLocaleString()} km</span>}
                                                {s.interval_months && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">calendar_month</span>Cada {s.interval_months} meses</span>}
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-3 text-xs">
                                                {st.daysUntilDue !== null && <span className={st.daysUntilDue <= 0 ? 'text-red-600 font-bold' : 'text-slate-500'}>{st.daysUntilDue <= 0 ? `⚠ Vencido hace ${Math.abs(st.daysUntilDue)} días` : `📅 En ${st.daysUntilDue} días (${s.next_due_date ? new Date(s.next_due_date).toLocaleDateString('es-MX') : ''})`}</span>}
                                                {st.kmUntilDue !== null && <span className={st.kmUntilDue <= 0 ? 'text-red-600 font-bold' : 'text-slate-500'}>{st.kmUntilDue <= 0 ? `⚠ Excedido por ${Math.abs(Math.round(st.kmUntilDue)).toLocaleString()} km` : `🛣️ Faltan ${Math.round(st.kmUntilDue).toLocaleString()} km`}</span>}
                                            </div>
                                            {s.last_service_date && <p className="text-[10px] text-slate-400 mt-1">Último servicio: {new Date(s.last_service_date).toLocaleDateString('es-MX')} @ {s.last_service_mileage?.toLocaleString()} km</p>}
                                        </div>
                                        <div className="mt-3 sm:mt-0 sm:ml-4 flex gap-2">
                                            {s.status === 'active' && (st.status === 'overdue' || st.status === 'upcoming') && (
                                                <button onClick={() => handleMarkServiceDone(s)} className="flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700 transition-colors">
                                                    <span className="material-symbols-outlined text-[14px]">check</span>Realizado
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ===== PERFORMANCE TAB ===== */}
            {tab === 'performance' && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Rendimiento Prom.', value: efficiency.avgKmPerLiter > 0 ? `${efficiency.avgKmPerLiter.toFixed(1)} km/l` : 'N/A', icon: 'local_gas_station', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                            { label: 'KM Totales', value: `${efficiency.totalKm.toLocaleString()} km`, icon: 'route', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                            { label: 'Litros Totales', value: `${efficiency.totalLiters.toLocaleString()} L`, icon: 'water_drop', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
                            { label: 'Gasto Combustible', value: formatCurrency(efficiency.totalFuelCost), icon: 'payments', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                        ].map(k => (
                            <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`material-symbols-outlined text-[20px] ${k.color}`}>{k.icon}</span>
                                    <span className="text-xs text-slate-500 font-medium">{k.label}</span>
                                </div>
                                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                            </div>
                        ))}
                    </div>
                    {/* Rendimiento por viaje */}
                    <div className={sectionClass}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-blue-500">analytics</span>Rendimiento por Viaje</h3>
                        {(() => {
                            const validTrips = mileage.filter(m => m.fuel_liters > 0 && m.distance > 0);
                            if (validTrips.length === 0) return <p className="text-sm text-slate-400 italic">Sin datos de rendimiento. Registra viajes con litros para ver el análisis.</p>;
                            return (
                                <div className="space-y-2">
                                    {validTrips.slice(0, 20).map(m => {
                                        const r = m.distance / m.fuel_liters;
                                        const maxR = Math.max(...validTrips.map(v => v.distance / v.fuel_liters));
                                        const pct = maxR > 0 ? (r / maxR) * 100 : 0;
                                        return (
                                            <div key={m.id} className="flex items-center gap-3">
                                                <span className="text-xs text-slate-500 w-20 shrink-0">{new Date(m.date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}</span>
                                                <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                                                    <div className={`h-full rounded-full transition-all ${r >= 10 ? 'bg-emerald-500' : r >= 5 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300">{r.toFixed(1)} km/l • {m.distance} km • {m.fuel_liters}L</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                    {/* Costo operativo total */}
                    <div className={sectionClass}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-amber-500">account_balance_wallet</span>Resumen Costos Operativos</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                <span className="text-slate-500 block text-xs mb-1">Costo Viajes (Km)</span>
                                <span className="font-bold text-lg text-slate-900 dark:text-white">{formatCurrency(mileage.reduce((s, m) => s + (m.calculated_trip_cost || 0), 0))}</span>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                <span className="text-slate-500 block text-xs mb-1">Costo Mantenimientos</span>
                                <span className="font-bold text-lg text-amber-600">{formatCurrency(maintenance.reduce((s, m) => s + (m.cost || 0), 0))}</span>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                <span className="text-slate-500 block text-xs mb-1">Costo Total Vehículo</span>
                                <span className="font-bold text-lg text-red-600">{formatCurrency(mileage.reduce((s, m) => s + (m.calculated_trip_cost || 0), 0) + maintenance.reduce((s, m) => s + (m.cost || 0), 0) + efficiency.totalFuelCost)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== SCHEDULE MODAL ===== */}
            {showSchedForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Agendar Servicio Recurrente</h3>
                            <button onClick={() => setShowSchedForm(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <form onSubmit={handleAddSchedule} className="space-y-4">
                            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Nombre del Servicio *</label><input required type="text" value={schedForm.service_name || ''} onChange={e => setSchedForm({...schedForm, service_name: e.target.value})} placeholder="Ej: Cambio de aceite, Verificación, Afinación..." className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
                                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">Criterios de Agendamiento (al menos uno)</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="mb-1 block text-[10px] font-semibold text-slate-500">Cada X Kilómetros</label><input type="number" step="1" value={schedForm.interval_km || ''} onChange={e => setSchedForm({...schedForm, interval_km: e.target.value ? parseFloat(e.target.value) : null})} placeholder="Ej: 5000" className="w-full rounded-lg border-0 bg-white p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                                    <div><label className="mb-1 block text-[10px] font-semibold text-slate-500">Cada X Meses</label><input type="number" step="1" value={schedForm.interval_months || ''} onChange={e => setSchedForm({...schedForm, interval_months: e.target.value ? parseInt(e.target.value) : null})} placeholder="Ej: 6" className="w-full rounded-lg border-0 bg-white p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Último Servicio (Fecha)</label><input type="date" value={schedForm.last_service_date || ''} onChange={e => setSchedForm({...schedForm, last_service_date: e.target.value || null})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                                <div><label className="mb-1 block text-xs font-semibold text-slate-500">Último Servicio (KM)</label><input type="number" step="1" value={schedForm.last_service_mileage || ''} onChange={e => setSchedForm({...schedForm, last_service_mileage: e.target.value ? parseFloat(e.target.value) : null})} placeholder={vehicle.current_mileage.toString()} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900" /></div>
                            </div>
                            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Prioridad</label>
                                <select value={schedForm.priority || 'normal'} onChange={e => setSchedForm({...schedForm, priority: e.target.value as SchedulePriority})} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900">
                                    {Object.entries(SCHEDULE_PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Notas</label><textarea value={schedForm.notes || ''} onChange={e => setSchedForm({...schedForm, notes: e.target.value})} rows={2} className="w-full rounded-lg border-0 bg-slate-50 p-2 text-sm focus:ring-2 focus:ring-primary dark:bg-slate-900 resize-none" /></div>
                            <button type="submit" className="w-full rounded-lg bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700">Guardar Agenda</button>
                        </form>
                    </div>
                </div>
            )}
            
        </div>
    );
}

