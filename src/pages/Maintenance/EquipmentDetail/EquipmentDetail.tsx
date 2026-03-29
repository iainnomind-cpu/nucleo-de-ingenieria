import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import {
    InstalledEquipment, MonitoringLog, EquipmentWarranty, MaintenanceSchedule, VideoRecording,
    EQUIPMENT_TYPE_LABELS, EQUIPMENT_TYPE_ICONS, EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_COLORS,
    WARRANTY_TYPE_LABELS, WARRANTY_STATUS_LABELS, WARRANTY_STATUS_COLORS,
    SCHEDULE_STATUS_LABELS, SCHEDULE_STATUS_COLORS,
    SERVICE_TYPE_LABELS,
    MONITORING_FIELDS, getDaysUntil, getUrgencyColor, formatCurrencyMaint,
    EquipmentStatus, WarrantyType,
} from '../../../types/maintenance';
import { PhotoAttachment } from '../../../types/photos';
import PhotoUploader, { PhotoGallery } from '../../../components/PhotoUploader';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

type Tab = 'monitoring' | 'trends' | 'video' | 'history' | 'warranties';

export default function EquipmentDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [equip, setEquip] = useState<InstalledEquipment | null>(null);
    const [logs, setLogs] = useState<MonitoringLog[]>([]);
    const [warranties, setWarranties] = useState<EquipmentWarranty[]>([]);
    const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
    const [videos, setVideos] = useState<VideoRecording[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('monitoring');
    const [showLogForm, setShowLogForm] = useState(false);
    const [showWarrantyForm, setShowWarrantyForm] = useState(false);
    const [showVideoForm, setShowVideoForm] = useState(false);

    const [config, setConfig] = useState({ max_voltage_unbalance: 3, max_amperage_unbalance: 10 });

    const [logForm, setLogForm] = useState<Record<string, string>>({
        log_date: new Date().toISOString().split('T')[0], recorded_by: '',
        static_level: '', dynamic_level: '', flow_rate: '', pressure: '',
        ppm: '', insulation_resistance: '', kw: '', motor_torque: '', temperature: '', frequency: '', observations: '',
        // Extended electrical parameters
        voltage: '', voltage_l1: '', voltage_l2: '', voltage_l3: '',
        amperage: '', amperage_a1: '', amperage_a2: '', amperage_a3: ''
    });
    const [warForm, setWarForm] = useState({ warranty_type: 'supplier' as WarrantyType, provider: '', start_date: '', end_date: '', coverage: '' });
    const [videoForm, setVideoForm] = useState({
        recording_date: new Date().toISOString().split('T')[0], recorded_by: '',
        grid_depth: '', static_level: '', bottom_depth: '', casing_observations: '', video_url: ''
    });

    const fetchAll = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        const [eRes, lRes, wRes, sRes, vRes, cRes] = await Promise.all([
            supabase.from('installed_equipment').select('*, client:clients(id, company_name)').eq('id', id).single(),
            supabase.from('monitoring_logs').select('*').eq('equipment_id', id).order('log_date', { ascending: false }),
            supabase.from('equipment_warranties').select('*').eq('equipment_id', id).order('end_date', { ascending: false }),
            supabase.from('maintenance_schedules').select('*').eq('equipment_id', id).order('next_service_date', { ascending: false }).limit(10),
            supabase.from('video_recordings').select('*').eq('equipment_id', id).order('recording_date', { ascending: false }),
            supabase.from('system_settings').select('*').eq('key', 'operational_defaults').single()
        ]);
        if (!eRes.data) { navigate('/maintenance'); return; }
        setEquip(eRes.data as InstalledEquipment);
        setLogs((lRes.data as MonitoringLog[]) || []);
        setWarranties((wRes.data as EquipmentWarranty[]) || []);
        setSchedules((sRes.data as MaintenanceSchedule[]) || []);
        setVideos((vRes.data as VideoRecording[]) || []);
        
        if (cRes.data && cRes.data.value) {
            setConfig({
                max_voltage_unbalance: Number(cRes.data.value.max_voltage_unbalance) || 3,
                max_amperage_unbalance: Number(cRes.data.value.max_amperage_unbalance) || 10
            });
        }
        
        setLoading(false);
    }, [id, navigate]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const [monLogPhotos, setMonLogPhotos] = useState<PhotoAttachment[]>([]);

    const calculateUnbalance = (v1: string, v2: string, v3: string) => {
        const n1 = parseFloat(v1); const n2 = parseFloat(v2); const n3 = parseFloat(v3);
        if (isNaN(n1) || isNaN(n2) || isNaN(n3)) return null;
        const avg = (n1 + n2 + n3) / 3;
        if (avg === 0) return 0;
        const maxDev = Math.max(Math.abs(n1 - avg), Math.abs(n2 - avg), Math.abs(n3 - avg));
        return (maxDev / avg) * 100;
    };

    const handleAddLog = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload: Record<string, unknown> = { equipment_id: id, log_date: logForm.log_date, recorded_by: logForm.recorded_by || null, observations: logForm.observations || null, photos: monLogPhotos };
        
        // Single-phase parameters (excluding voltage and amperage, mapped separately below)
        MONITORING_FIELDS.forEach(f => { 
            if (f.key !== 'voltage' && f.key !== 'amperage' && logForm[f.key]) {
                payload[f.key] = parseFloat(logForm[f.key]); 
            }
        });

        // 3-Phase Parameters
        const phaseFields = ['voltage', 'voltage_l1', 'voltage_l2', 'voltage_l3', 'amperage', 'amperage_a1', 'amperage_a2', 'amperage_a3'];
        phaseFields.forEach(k => {
             if (logForm[k]) payload[k] = parseFloat(logForm[k]);
        });

        const vUnb = calculateUnbalance(logForm.voltage_l1, logForm.voltage_l2, logForm.voltage_l3);
        if (vUnb !== null) {
            payload.voltage_unbalance = vUnb;
            payload.voltage = (parseFloat(logForm.voltage_l1) + parseFloat(logForm.voltage_l2) + parseFloat(logForm.voltage_l3)) / 3;
        }
        
        const aUnb = calculateUnbalance(logForm.amperage_a1, logForm.amperage_a2, logForm.amperage_a3);
        if (aUnb !== null) {
            payload.amperage_unbalance = aUnb;
            payload.amperage = (parseFloat(logForm.amperage_a1) + parseFloat(logForm.amperage_a2) + parseFloat(logForm.amperage_a3)) / 3;
        }

        await supabase.from('monitoring_logs').insert(payload);
        setShowLogForm(false);
        setMonLogPhotos([]);
        
        const reset: Record<string, string> = { log_date: new Date().toISOString().split('T')[0], recorded_by: '', observations: '', voltage: '', voltage_l1: '', voltage_l2: '', voltage_l3: '', amperage: '', amperage_a1: '', amperage_a2: '', amperage_a3: '' };
        MONITORING_FIELDS.forEach(f => { if(f.key !== 'voltage' && f.key !== 'amperage') reset[f.key] = ''; });
        setLogForm(reset);
        fetchAll();
    };

    const handleAddWarranty = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from('equipment_warranties').insert({
            equipment_id: id, warranty_type: warForm.warranty_type, provider: warForm.provider || null,
            start_date: warForm.start_date, end_date: warForm.end_date, coverage: warForm.coverage || null,
        });
        setShowWarrantyForm(false);
        setWarForm({ warranty_type: 'supplier', provider: '', start_date: '', end_date: '', coverage: '' });
        fetchAll();
    };

    const handleAddVideo = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from('video_recordings').insert({
            equipment_id: id,
            recording_date: videoForm.recording_date,
            recorded_by: videoForm.recorded_by || null,
            grid_depth: videoForm.grid_depth ? parseFloat(videoForm.grid_depth) : null,
            static_level: videoForm.static_level ? parseFloat(videoForm.static_level) : null,
            bottom_depth: videoForm.bottom_depth ? parseFloat(videoForm.bottom_depth) : null,
            casing_observations: videoForm.casing_observations || null,
            video_url: videoForm.video_url || null,
        });
        setShowVideoForm(false);
        setVideoForm({ recording_date: new Date().toISOString().split('T')[0], recorded_by: '', grid_depth: '', static_level: '', bottom_depth: '', casing_observations: '', video_url: '' });
        fetchAll();
    };

    const changeStatus = async (status: EquipmentStatus) => {
        if (!equip) return;
        await supabase.from('installed_equipment').update({ status }).eq('id', equip.id);
        fetchAll();
    };

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';
    const sectionClass = 'rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50';

    if (loading || !equip) return <div className="flex flex-1 items-center justify-center p-8"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

    // Compute trends from last 2 logs
    const getTrend = (field: string): 'up' | 'down' | 'stable' | null => {
        if (logs.length < 2) return null;
        const a = (logs[0] as unknown as Record<string, number | null>)[field];
        const b = (logs[1] as unknown as Record<string, number | null>)[field];
        if (a == null || b == null) return null;
        if (a > b * 1.05) return 'up';
        if (a < b * 0.95) return 'down';
        return 'stable';
    };

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/maintenance')} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </button>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <span className="material-symbols-outlined text-primary text-[24px]">{EQUIPMENT_TYPE_ICONS[equip.equipment_type]}</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{equip.name}</h2>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${EQUIPMENT_STATUS_COLORS[equip.status].bg} ${EQUIPMENT_STATUS_COLORS[equip.status].text}`}>{EQUIPMENT_STATUS_LABELS[equip.status]}</span>
                        </div>
                        <p className="text-sm text-slate-500">{equip.well_name && `${equip.well_name} · `}{EQUIPMENT_TYPE_LABELS[equip.equipment_type]}{equip.client?.company_name ? ` · ${equip.client.company_name}` : ''}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {equip.status === 'active' && <button onClick={() => changeStatus('maintenance')} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">En Mantenimiento</button>}
                    {equip.status === 'maintenance' && <button onClick={() => changeStatus('active')} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Activar</button>}
                </div>
            </div>

            {/* Equipment Info Strip */}
            <div className="flex flex-wrap gap-6 rounded-xl border border-slate-200/60 bg-white/50 px-6 py-4 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50 text-sm">
                {equip.brand && <div><span className="text-xs text-slate-400 block">Marca</span><span className="font-medium text-slate-900 dark:text-white">{equip.brand}</span></div>}
                {equip.model && <div><span className="text-xs text-slate-400 block">Modelo</span><span className="font-medium text-slate-900 dark:text-white">{equip.model}</span></div>}
                {equip.serial_number && <div><span className="text-xs text-slate-400 block">No. Serie</span><span className="font-mono font-medium text-slate-900 dark:text-white">{equip.serial_number}</span></div>}
                {equip.installation_date && <div><span className="text-xs text-slate-400 block">Instalación</span><span className="font-medium text-slate-900 dark:text-white">{new Date(equip.installation_date).toLocaleDateString('es-MX')}</span></div>}
                {equip.location && <div><span className="text-xs text-slate-400 block">Ubicación</span><span className="font-medium text-slate-900 dark:text-white">{equip.location}</span></div>}
                <div><span className="text-xs text-slate-400 block">Lecturas</span><span className="font-bold text-primary">{logs.length}</span></div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {[
                    { key: 'monitoring', icon: 'monitor_heart', label: `Monitoreo (${logs.length})` },
                    { key: 'trends', icon: 'monitoring', label: `Tendencias` },
                    { key: 'video', icon: 'videocam', label: `Videograbación (${videos.length})` },
                    { key: 'history', icon: 'history', label: `Historial Mant. (${schedules.length})` },
                    { key: 'warranties', icon: 'verified_user', label: `Garantías (${warranties.length})` },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as Tab)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                        <span className="material-symbols-outlined text-[18px]">{t.icon}</span>{t.label}
                    </button>
                ))}
            </div>

            {/* TAB: Monitoring */}
            {tab === 'monitoring' && (
                <div className="space-y-6">
                    {/* Latest readings as gauge cards */}
                    {logs.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                            {MONITORING_FIELDS.map(f => {
                                const val = (logs[0] as unknown as Record<string, number | null>)[f.key];
                                if (val == null) return null;
                                const trend = getTrend(f.key);
                                return (
                                    <div key={f.key} className="rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                                        <div className="flex items-center justify-between">
                                            <span className="material-symbols-outlined text-primary/60 text-[16px]">{f.icon}</span>
                                            {trend && (
                                                <span className={`material-symbols-outlined text-[14px] ${trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                    {trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'trending_flat'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{val}</p>
                                        <p className="text-xs text-slate-400">{f.label} <span className="text-slate-300">{f.unit}</span></p>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Add log */}
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bitácora de Monitoreo</h3>
                        <button onClick={() => setShowLogForm(!showLogForm)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">
                            <span className="material-symbols-outlined text-[16px]">add</span>Nueva Lectura
                        </button>
                    </div>

                    {showLogForm && (
                        <form onSubmit={handleAddLog} className="rounded-xl border border-primary/20 bg-primary/5 p-6">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                <div><label className={labelClass}>Fecha</label><input type="date" value={logForm.log_date} onChange={e => setLogForm({ ...logForm, log_date: e.target.value })} className={inputClass} required /></div>
                                <div><label className={labelClass}>Registrado por</label><input value={logForm.recorded_by} onChange={e => setLogForm({ ...logForm, recorded_by: e.target.value })} className={inputClass} placeholder="Nombre" /></div>
                                {MONITORING_FIELDS.filter(f => f.key !== 'voltage' && f.key !== 'amperage').map(f => (
                                    <div key={f.key}><label className={labelClass}>{f.label} ({f.unit})</label><input type="number" step="0.01" value={logForm[f.key]} onChange={e => setLogForm({ ...logForm, [f.key]: e.target.value })} className={inputClass} placeholder={f.unit} /></div>
                                ))}
                                
                                {/* Tensión (Voltaje) Trifásico */}
                                <div className="col-span-full border-t border-slate-200 dark:border-slate-700 mt-2 pt-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className={labelClass + " !mb-0"}>Tensión Fases L1, L2, L3 (V)</label>
                                        {calculateUnbalance(logForm.voltage_l1, logForm.voltage_l2, logForm.voltage_l3) !== null && (
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${calculateUnbalance(logForm.voltage_l1, logForm.voltage_l2, logForm.voltage_l3)! <= config.max_voltage_unbalance ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30'}`}>
                                                Desbalance: {calculateUnbalance(logForm.voltage_l1, logForm.voltage_l2, logForm.voltage_l3)?.toFixed(1)}% (Max {config.max_voltage_unbalance}%)
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <input type="number" step="0.1" value={logForm.voltage_l1} onChange={e => setLogForm({ ...logForm, voltage_l1: e.target.value })} className={inputClass} placeholder="V1" />
                                        <input type="number" step="0.1" value={logForm.voltage_l2} onChange={e => setLogForm({ ...logForm, voltage_l2: e.target.value })} className={inputClass} placeholder="V2" />
                                        <input type="number" step="0.1" value={logForm.voltage_l3} onChange={e => setLogForm({ ...logForm, voltage_l3: e.target.value })} className={inputClass} placeholder="V3" />
                                    </div>
                                </div>

                                {/* Corriente (Amperaje) Trifásico */}
                                <div className="col-span-full border-b border-slate-200 dark:border-slate-700 mb-2 pb-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className={labelClass + " !mb-0"}>Corriente Fases L1, L2, L3 (A)</label>
                                        {calculateUnbalance(logForm.amperage_a1, logForm.amperage_a2, logForm.amperage_a3) !== null && (
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${calculateUnbalance(logForm.amperage_a1, logForm.amperage_a2, logForm.amperage_a3)! <= config.max_amperage_unbalance ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30'}`}>
                                                Desbalance: {calculateUnbalance(logForm.amperage_a1, logForm.amperage_a2, logForm.amperage_a3)?.toFixed(1)}% (Max {config.max_amperage_unbalance}%)
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <input type="number" step="0.1" value={logForm.amperage_a1} onChange={e => setLogForm({ ...logForm, amperage_a1: e.target.value })} className={inputClass} placeholder="A1" />
                                        <input type="number" step="0.1" value={logForm.amperage_a2} onChange={e => setLogForm({ ...logForm, amperage_a2: e.target.value })} className={inputClass} placeholder="A2" />
                                        <input type="number" step="0.1" value={logForm.amperage_a3} onChange={e => setLogForm({ ...logForm, amperage_a3: e.target.value })} className={inputClass} placeholder="A3" />
                                    </div>
                                </div>
                                <div className="col-span-full"><label className={labelClass}>Observaciones</label><textarea value={logForm.observations} onChange={e => setLogForm({ ...logForm, observations: e.target.value })} rows={2} className={inputClass + ' resize-none'} placeholder="Notas de campo..." /></div>
                                <div className="col-span-full">
                                    <label className={labelClass}>Evidencia Fotográfica</label>
                                    <PhotoUploader
                                        photos={monLogPhotos}
                                        onPhotosChange={setMonLogPhotos}
                                        folder={`monitoring/${id}`}
                                        uploaderName={logForm.recorded_by || 'Técnico'}
                                        compact
                                    />
                                </div>
                            </div>
                            <div className="mt-4 flex gap-2"><button type="submit" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">Guardar Lectura</button><button type="button" onClick={() => { setShowLogForm(false); setMonLogPhotos([]); }} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500 dark:border-slate-700">Cancelar</button></div>
                        </form>
                    )}

                    {/* Log history table */}
                    {logs.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500">No hay lecturas registradas.</div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white/50 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Fecha</th>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Por</th>
                                        <th className="px-2 py-2 text-center font-semibold text-slate-500" title="Fotos">📷</th>
                                        {MONITORING_FIELDS.map(f => <th key={f.key} className="px-2 py-2 text-right font-semibold text-slate-500" title={f.label}>{f.label.substring(0, 8)}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {logs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{new Date(log.log_date).toLocaleDateString('es-MX')}</td>
                                            <td className="px-3 py-2 text-slate-500">{log.recorded_by || '—'}</td>
                                            <td className="px-2 py-2 text-center">
                                                {log.photos && log.photos.length > 0 && (
                                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
                                                        <span className="material-symbols-outlined text-[10px]">photo</span>
                                                        {log.photos.length}
                                                    </span>
                                                )}
                                            </td>
                                            {MONITORING_FIELDS.map(f => {
                                                const val = (log as unknown as Record<string, number | null>)[f.key];
                                                return <td key={f.key} className="px-2 py-2 text-right text-slate-600 dark:text-slate-300">{val != null ? val : '—'}</td>;
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Photo gallery for logs with photos */}
                    {logs.filter(l => l.photos && l.photos.length > 0).length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Fotos de Lecturas Recientes</h4>
                            {logs.filter(l => l.photos && l.photos.length > 0).slice(0, 5).map(log => (
                                <div key={log.id} className="rounded-lg border border-slate-200/60 p-3 dark:border-slate-700/60">
                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                                        {new Date(log.log_date).toLocaleDateString('es-MX')} — {log.recorded_by || 'Sin autor'}
                                    </p>
                                    <PhotoGallery photos={log.photos} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Trends */}
            {tab === 'trends' && (
                <div className="space-y-6">
                    {logs.length < 2 ? (
                        <div className="py-12 text-center text-sm text-slate-500">
                            <span className="material-symbols-outlined mb-2 text-[48px] text-slate-300">monitoring</span>
                            <p>Se requieren al menos 2 lecturas para graficar tendencias.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            {MONITORING_FIELDS.map(f => {
                                // Filter logs that actually have this value recorded
                                const chartData = [...logs].reverse().filter(l => {
                                    const record = (l as unknown as Record<string, number | null>);
                                    return record[f.key] != null || (f.key === 'voltage' && record['voltage_l1'] != null) || (f.key === 'amperage' && record['amperage_a1'] != null);
                                }).map(l => {
                                    const record = (l as unknown as Record<string, number | null>);
                                    const base: Record<string, string | number> = {
                                        date: new Date(l.log_date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
                                        value: record[f.key] || 0
                                    };
                                    
                                    if (f.key === 'voltage') {
                                        if (record['voltage_l1'] != null) base.L1 = record['voltage_l1'];
                                        if (record['voltage_l2'] != null) base.L2 = record['voltage_l2'];
                                        if (record['voltage_l3'] != null) base.L3 = record['voltage_l3'];
                                    }
                                    if (f.key === 'amperage') {
                                        if (record['amperage_a1'] != null) base.A1 = record['amperage_a1'];
                                        if (record['amperage_a2'] != null) base.A2 = record['amperage_a2'];
                                        if (record['amperage_a3'] != null) base.A3 = record['amperage_a3'];
                                    }
                                    return base;
                                });

                                if (chartData.length < 2) return null;

                                return (
                                    <div key={f.key} className={sectionClass}>
                                        <div className="mb-4 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-primary text-[20px]">{f.icon}</span>
                                                <h3 className="font-bold text-slate-900 dark:text-white">{f.label}</h3>
                                                <span className="text-xs text-slate-400">({f.unit})</span>
                                            </div>
                                            <div className="flex gap-2 text-[9px] uppercase tracking-wide font-bold">
                                                <span className="text-[#0ea5e9]">O</span>
                                                {(f.key === 'voltage' || f.key === 'amperage') && (
                                                    <>
                                                        <span className="text-[#ef4444]">{f.key === 'voltage' ? 'L1' : 'A1'}</span>
                                                        <span className="text-[#eab308]">{f.key === 'voltage' ? 'L2' : 'A2'}</span>
                                                        <span className="text-[#22c55e]">{f.key === 'voltage' ? 'L3' : 'A3'}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="h-64 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
                                                    <RechartsTooltip
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                        labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                                                    />
                                                    <Line type="monotone" dataKey="value" name={(f.key === 'voltage' || f.key === 'amperage') ? 'Promedio Histórico' : f.label} stroke="#0ea5e9" strokeWidth={(f.key === 'voltage' || f.key === 'amperage') ? 2 : 3} strokeDasharray={(f.key === 'voltage' || f.key === 'amperage') ? "4 4" : ""} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                                    {f.key === 'voltage' && (
                                                        <>
                                                            <Line type="monotone" dataKey="L1" name="Voltaje L1" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                                            <Line type="monotone" dataKey="L2" name="Voltaje L2" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                                            <Line type="monotone" dataKey="L3" name="Voltaje L3" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                                        </>
                                                    )}
                                                    {f.key === 'amperage' && (
                                                        <>
                                                            <Line type="monotone" dataKey="A1" name="Amperaje A1" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                                            <Line type="monotone" dataKey="A2" name="Amperaje A2" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                                            <Line type="monotone" dataKey="A3" name="Amperaje A3" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                                        </>
                                                    )}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Video Recordings */}
            {tab === 'video' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Registros de Videograbación</h3>
                        <button onClick={() => setShowVideoForm(!showVideoForm)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">
                            <span className="material-symbols-outlined text-[16px]">add</span>Nuevo Registro
                        </button>
                    </div>

                    {showVideoForm && (
                        <form onSubmit={handleAddVideo} className="rounded-xl border border-primary/20 bg-primary/5 p-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                <div><label className={labelClass}>Fecha</label><input type="date" value={videoForm.recording_date} onChange={e => setVideoForm({ ...videoForm, recording_date: e.target.value })} className={inputClass} required /></div>
                                <div><label className={labelClass}>Registrado por</label><input value={videoForm.recorded_by} onChange={e => setVideoForm({ ...videoForm, recorded_by: e.target.value })} className={inputClass} placeholder="Nombre del operador" /></div>
                                <div><label className={labelClass}>Prof. Inicial Rejillas (m)</label><input type="number" step="0.01" value={videoForm.grid_depth} onChange={e => setVideoForm({ ...videoForm, grid_depth: e.target.value })} className={inputClass} /></div>
                                <div><label className={labelClass}>Nivel Estático (m)</label><input type="number" step="0.01" value={videoForm.static_level} onChange={e => setVideoForm({ ...videoForm, static_level: e.target.value })} className={inputClass} /></div>
                                <div><label className={labelClass}>Prof. Fondo Grabado (m)</label><input type="number" step="0.01" value={videoForm.bottom_depth} onChange={e => setVideoForm({ ...videoForm, bottom_depth: e.target.value })} className={inputClass} /></div>
                                <div className="md:col-span-3"><label className={labelClass}>URL del Video</label><input type="url" value={videoForm.video_url} onChange={e => setVideoForm({ ...videoForm, video_url: e.target.value })} className={inputClass} placeholder="https://youtube.com/..." /></div>
                                <div className="md:col-span-4"><label className={labelClass}>Observaciones Estructurales (Ademe)</label><textarea value={videoForm.casing_observations} onChange={e => setVideoForm({ ...videoForm, casing_observations: e.target.value })} rows={3} className={inputClass + " resize-none"} placeholder="Estado de las rejillas, corrosión, incrustaciones..." /></div>
                            </div>
                            <div className="mt-4 flex gap-2"><button type="submit" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">Guardar</button><button type="button" onClick={() => setShowVideoForm(false)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500 dark:border-slate-700">Cancelar</button></div>
                        </form>
                    )}

                    <div className={sectionClass}>
                        {videos.length === 0 ? (
                            <div className="py-8 text-center text-sm text-slate-500">Sin registros de videograbación.</div>
                        ) : (
                            <div className="space-y-4">
                                {videos.map(v => (
                                    <div key={v.id} className="flex flex-col gap-3 rounded-lg border border-slate-200/60 p-4 dark:border-slate-700/60 md:flex-row md:items-start">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/30">
                                            <span className="material-symbols-outlined text-sky-600 text-[20px]">videocam</span>
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <p className="font-bold text-sm text-slate-900 dark:text-white">{new Date(v.recording_date).toLocaleDateString('es-MX')} — {v.recorded_by || 'Operador n/a'}</p>
                                                {v.video_url && (
                                                    <a href={v.video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-600 hover:bg-sky-100 dark:bg-sky-900/20 dark:hover:bg-sky-900/40">
                                                        <span className="material-symbols-outlined text-[14px]">play_circle</span> Ver Video
                                                    </a>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 rounded bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
                                                <div><span className="block text-slate-400">Rejillas</span><span className="font-semibold text-slate-900 dark:text-white">{v.grid_depth != null ? `${v.grid_depth}m` : '—'}</span></div>
                                                <div><span className="block text-slate-400">NE</span><span className="font-semibold text-slate-900 dark:text-white">{v.static_level != null ? `${v.static_level}m` : '—'}</span></div>
                                                <div><span className="block text-slate-400">Fondo</span><span className="font-semibold text-slate-900 dark:text-white">{v.bottom_depth != null ? `${v.bottom_depth}m` : '—'}</span></div>
                                            </div>

                                            {v.casing_observations && (
                                                <div className="rounded border border-amber-200/50 bg-amber-50/50 p-3 text-xs dark:border-amber-900/30 dark:bg-amber-900/10">
                                                    <span className="font-semibold text-amber-700 block mb-1">Ademe</span>
                                                    <p className="text-amber-900/80 dark:text-amber-200/80">{v.casing_observations}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: History */}
            {tab === 'history' && (
                <div className={sectionClass}>
                    {schedules.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500">Sin historial de mantenimiento.</div>
                    ) : (
                        <div className="space-y-3">
                            {schedules.map(s => (
                                <div key={s.id} className="flex items-center gap-4 rounded-lg border border-slate-200/60 p-4 dark:border-slate-700/60">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                        <span className="material-symbols-outlined text-primary text-[18px]">build</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-sm text-slate-900 dark:text-white">{s.title}</p>
                                        <p className="text-xs text-slate-400">{SERVICE_TYPE_LABELS[s.service_type]} · {s.assigned_to || 'Sin asignar'}</p>
                                    </div>
                                    <div className="text-right text-xs text-slate-400">{new Date(s.next_service_date).toLocaleDateString('es-MX')}</div>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SCHEDULE_STATUS_COLORS[s.status].bg} ${SCHEDULE_STATUS_COLORS[s.status].text}`}>{SCHEDULE_STATUS_LABELS[s.status]}</span>
                                    {s.cost && <span className="text-xs font-bold text-slate-600">{formatCurrencyMaint(s.cost)}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Warranties */}
            {tab === 'warranties' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => setShowWarrantyForm(!showWarrantyForm)} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white">
                            <span className="material-symbols-outlined text-[16px]">add</span>Agregar Garantía
                        </button>
                    </div>
                    {showWarrantyForm && (
                        <form onSubmit={handleAddWarranty} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 dark:border-emerald-900 dark:bg-emerald-900/10">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                <div><label className={labelClass}>Tipo</label><select value={warForm.warranty_type} onChange={e => setWarForm({ ...warForm, warranty_type: e.target.value as WarrantyType })} className={inputClass}><option value="supplier">Proveedor (1 año)</option><option value="nucleo">Núcleo (2 años)</option></select></div>
                                <div><label className={labelClass}>Proveedor</label><input value={warForm.provider} onChange={e => setWarForm({ ...warForm, provider: e.target.value })} className={inputClass} /></div>
                                <div><label className={labelClass}>Inicio *</label><input type="date" value={warForm.start_date} onChange={e => setWarForm({ ...warForm, start_date: e.target.value })} required className={inputClass} /></div>
                                <div><label className={labelClass}>Fin *</label><input type="date" value={warForm.end_date} onChange={e => setWarForm({ ...warForm, end_date: e.target.value })} required className={inputClass} /></div>
                                <div className="md:col-span-4"><label className={labelClass}>Cobertura</label><input value={warForm.coverage} onChange={e => setWarForm({ ...warForm, coverage: e.target.value })} placeholder="Motor, bomba, variador..." className={inputClass} /></div>
                            </div>
                            <div className="mt-4 flex gap-2"><button type="submit" className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white">Guardar</button><button type="button" onClick={() => setShowWarrantyForm(false)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500 dark:border-slate-700">Cancelar</button></div>
                        </form>
                    )}

                    <div className={sectionClass}>
                        {warranties.length === 0 ? (
                            <div className="py-8 text-center text-sm text-slate-500">Sin garantías registradas.</div>
                        ) : (
                            <div className="space-y-3">
                                {warranties.map(w => {
                                    const days = getDaysUntil(w.end_date);
                                    return (
                                        <div key={w.id} className="flex items-center gap-4 rounded-lg border border-slate-200/60 p-4 dark:border-slate-700/60">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                                                <span className="material-symbols-outlined text-emerald-600 text-[20px]">verified_user</span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-sm text-slate-900 dark:text-white">{WARRANTY_TYPE_LABELS[w.warranty_type]}</p>
                                                <p className="text-xs text-slate-400">{w.provider || '—'}{w.coverage ? ` · ${w.coverage}` : ''}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-sm font-bold ${getUrgencyColor(days)}`}>{days > 0 ? `${days} días` : 'Expirada'}</span>
                                                <p className="text-xs text-slate-400">{new Date(w.start_date).toLocaleDateString('es-MX')} — {new Date(w.end_date).toLocaleDateString('es-MX')}</p>
                                            </div>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${WARRANTY_STATUS_COLORS[w.status].bg} ${WARRANTY_STATUS_COLORS[w.status].text}`}>{WARRANTY_STATUS_LABELS[w.status]}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
