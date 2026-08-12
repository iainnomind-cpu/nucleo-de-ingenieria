import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    InstalledEquipment, MonitoringLog, EquipmentWarranty, MaintenanceSchedule, VideoRecording,
    ClientWellLog, FunctionalityStatus,
    EQUIPMENT_TYPE_LABELS, EQUIPMENT_TYPE_ICONS, EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_COLORS,
    FUNCTIONALITY_STATUS_LABELS, FUNCTIONALITY_STATUS_COLORS,
    MONITORING_FIELDS, getDaysUntil, getUrgencyColor,
} from '../../types/maintenance';
import { PhotoAttachment } from '../../types/photos';
import PhotoUploader, { PhotoGallery } from '../../components/PhotoUploader';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

type Tab = 'monitoring' | 'trends' | 'video' | 'history' | 'warranties' | 'client_log';

export default function ClientWellLogPublic() {
    const { token } = useParams<{ token: string }>();
    
    const [equip, setEquip] = useState<InstalledEquipment | null>(null);
    const [logs, setLogs] = useState<MonitoringLog[]>([]);
    const [warranties, setWarranties] = useState<EquipmentWarranty[]>([]);
    const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
    const [videos, setVideos] = useState<VideoRecording[]>([]);
    const [clientLogs, setClientLogs] = useState<ClientWellLog[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [tab, setTab] = useState<Tab>('monitoring');

    // Client log form state
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        log_date: new Date().toISOString().split('T')[0],
        recorded_by: '',
        static_level: '',
        dynamic_level: '',
        flow_rate: '',
        pressure: '',
        hours_operation: '',
        observations: '',
        functionality_status: 'normal' as FunctionalityStatus,
    });
    const [photos, setPhotos] = useState<PhotoAttachment[]>([]);

    const fetchData = useCallback(async () => {
        if (!token) return;
        setLoading(true);

        // Find equipment by access_token
        const { data: eqData } = await supabase
            .from('installed_equipment')
            .select('*, client:clients(id, company_name)')
            .eq('access_token', token)
            .single();

        if (!eqData) {
            setNotFound(true);
            setLoading(false);
            return;
        }

        const equip = eqData as InstalledEquipment;
        setEquip(equip);

        // Fetch related data
        const [lRes, wRes, sRes, vRes, clRes] = await Promise.all([
            supabase.from('monitoring_logs').select('*').eq('equipment_id', equip.id).order('log_date', { ascending: false }),
            supabase.from('equipment_warranties').select('*').eq('equipment_id', equip.id).order('end_date', { ascending: false }),
            supabase.from('maintenance_schedules').select('*').eq('equipment_id', equip.id).order('next_service_date', { ascending: false }).limit(10),
            supabase.from('video_recordings').select('*').eq('equipment_id', equip.id).order('recording_date', { ascending: false }),
            supabase.from('client_well_logs').select('*').eq('equipment_id', equip.id).order('log_date', { ascending: false }),
        ]);

        setLogs((lRes.data as MonitoringLog[]) || []);
        setWarranties((wRes.data as EquipmentWarranty[]) || []);
        setSchedules((sRes.data as MaintenanceSchedule[]) || []);
        setVideos((vRes.data as VideoRecording[]) || []);
        setClientLogs((clRes.data as ClientWellLog[]) || []);
        
        setLoading(false);
    }, [token]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSubmitClientLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!equip) return;
        setSubmitting(true);

        const payload: Record<string, unknown> = {
            equipment_id: equip.id,
            client_id: equip.client_id || null,
            log_date: form.log_date,
            recorded_by: form.recorded_by || null,
            observations: form.observations || null,
            functionality_status: form.functionality_status,
            photos: photos,
        };

        if (form.static_level) payload.static_level = parseFloat(form.static_level);
        if (form.dynamic_level) payload.dynamic_level = parseFloat(form.dynamic_level);
        if (form.flow_rate) payload.flow_rate = parseFloat(form.flow_rate);
        if (form.pressure) payload.pressure = parseFloat(form.pressure);
        if (form.hours_operation) payload.hours_operation = parseFloat(form.hours_operation);

        await supabase.from('client_well_logs').insert(payload);

        setSubmitting(false);
        setSubmitted(true);
        setPhotos([]);
        setForm({
            log_date: new Date().toISOString().split('T')[0],
            recorded_by: '', static_level: '', dynamic_level: '',
            flow_rate: '', pressure: '', hours_operation: '',
            observations: '', functionality_status: 'normal',
        });

        fetchData();
    };

    // Calculate trends
    const getTrend = (field: string): 'up' | 'down' | 'stable' | null => {
        if (logs.length < 2) return null;
        const a = (logs[0] as unknown as Record<string, number | null>)[field];
        const b = (logs[1] as unknown as Record<string, number | null>)[field];
        if (a == null || b == null) return null;
        if (a > b * 1.05) return 'up';
        if (a < b * 0.95) return 'down';
        return 'stable';
    };

    // UI Helpers
    const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20';
    const labelClass = 'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5';
    const sectionClass = 'rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm';

    if (notFound) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50 p-4">
                <div className="max-w-md text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                        <span className="material-symbols-outlined text-red-500 text-[40px]">link_off</span>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900">Enlace no válido</h1>
                    <p className="mt-2 text-sm text-slate-500">Este enlace de bitácora no es válido o ha sido desactivado. Contacta a Núcleo de Ingeniería para obtener un enlace actualizado.</p>
                </div>
            </div>
        );
    }

    if (loading || !equip) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
                    <p className="text-sm text-slate-500">Cargando información del pozo...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-white">
            {/* Header */}
            <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-lg sticky top-0 z-10">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-200">
                            <span className="material-symbols-outlined text-white text-[22px]">water_drop</span>
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-slate-900">Núcleo de Ingeniería</h1>
                            <p className="text-[11px] text-slate-400">Portal del Cliente</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-5xl px-4 py-8">
                {/* Equipment Info Header */}
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100">
                            <span className="material-symbols-outlined text-sky-600 text-[24px]">{EQUIPMENT_TYPE_ICONS[equip.equipment_type]}</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-slate-900">{equip.name}</h2>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${EQUIPMENT_STATUS_COLORS[equip.status].bg} ${EQUIPMENT_STATUS_COLORS[equip.status].text}`}>
                                    {EQUIPMENT_STATUS_LABELS[equip.status]}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500">
                                {equip.well_name && `${equip.well_name} · `}
                                {EQUIPMENT_TYPE_LABELS[equip.equipment_type]}
                                {equip.client?.company_name ? ` · ${equip.client.company_name}` : ''}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Equipment Metrics Strip */}
                <div className="mb-6 flex flex-wrap gap-6 rounded-xl border border-slate-200/60 bg-white px-6 py-4 shadow-sm text-sm">
                    {equip.brand && <div><span className="text-xs text-slate-400 block">Marca</span><span className="font-medium text-slate-900">{equip.brand}</span></div>}
                    {equip.installation_date && <div><span className="text-xs text-slate-400 block">Instalación</span><span className="font-medium text-slate-900">{new Date(equip.installation_date).toLocaleDateString('es-MX')}</span></div>}
                    {equip.location && <div><span className="text-xs text-slate-400 block">Ubicación</span><span className="font-medium text-slate-900">{equip.location}</span></div>}
                    <div><span className="text-xs text-slate-400 block">Lecturas Técnicas</span><span className="font-bold text-sky-600">{logs.length}</span></div>
                </div>

                {/* Tabs */}
                <div className="mb-6 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
                    {[
                        { key: 'monitoring', icon: 'monitor_heart', label: `Monitoreo (${logs.length})` },
                        { key: 'trends', icon: 'monitoring', label: `Tendencias` },
                        { key: 'video', icon: 'videocam', label: `Videograbación (${videos.length})` },
                        { key: 'client_log', icon: 'person_book', label: `Mi Bitácora (${clientLogs.length})` },
                        { key: 'history', icon: 'history', label: `Historial Mant. (${schedules.length})` },
                        { key: 'warranties', icon: 'verified_user', label: `Garantías (${warranties.length})` },
                    ].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key as Tab)}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
                                tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}>
                            <span className="material-symbols-outlined text-[18px]">{t.icon}</span>{t.label}
                        </button>
                    ))}
                </div>

                {/* TAB CONTENT: Monitoring */}
                {tab === 'monitoring' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Gauge Cards */}
                        {logs.length > 0 && (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                                {MONITORING_FIELDS.map(f => {
                                    const val = (logs[0] as unknown as Record<string, number | null>)[f.key];
                                    if (val == null) return null;
                                    const trend = getTrend(f.key);
                                    return (
                                        <div key={f.key} className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="material-symbols-outlined text-sky-500/60 text-[16px]">{f.icon}</span>
                                                {trend && (
                                                    <span className={`material-symbols-outlined text-[14px] ${trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                        {trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'trending_flat'}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-2 text-2xl font-bold text-slate-900">{val}</p>
                                            <p className="text-xs text-slate-400">{f.label} <span className="text-slate-300">{f.unit}</span></p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900">Bitácora Técnica (Solo Lectura)</h3>
                        </div>

                        {logs.length === 0 ? (
                            <div className="py-8 text-center text-sm text-slate-500">No hay lecturas registradas.</div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white shadow-sm">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold text-slate-500">Fecha</th>
                                            <th className="px-4 py-3 text-left font-semibold text-slate-500">Técnico</th>
                                            <th className="px-2 py-3 text-center font-semibold text-slate-500">📷</th>
                                            {MONITORING_FIELDS.map(f => <th key={f.key} className="px-2 py-3 text-right font-semibold text-slate-500" title={f.label}>{f.label.substring(0, 8)}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-slate-900">{new Date(log.log_date + 'T00:00:00').toLocaleDateString('es-MX')}</td>
                                                <td className="px-4 py-3 text-slate-500">{log.recorded_by || '—'}</td>
                                                <td className="px-2 py-3 text-center">
                                                    {log.photos && log.photos.length > 0 && (
                                                        <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-600">
                                                            <span className="material-symbols-outlined text-[10px]">photo</span>
                                                            {log.photos.length}
                                                        </span>
                                                    )}
                                                </td>
                                                {MONITORING_FIELDS.map(f => {
                                                    const val = (log as unknown as Record<string, number | null>)[f.key];
                                                    return <td key={f.key} className="px-2 py-3 text-right text-slate-600">{val != null ? val : '—'}</td>;
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Photo gallery */}
                        {logs.filter(l => l.photos && l.photos.length > 0).length > 0 && (
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Fotos de Lecturas</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {logs.filter(l => l.photos && l.photos.length > 0).slice(0, 4).map(log => (
                                        <div key={log.id} className="rounded-xl border border-slate-200/60 bg-white p-4">
                                            <p className="text-xs font-semibold text-slate-600 mb-3">
                                                {new Date(log.log_date + 'T00:00:00').toLocaleDateString('es-MX')} — {log.recorded_by}
                                            </p>
                                            <PhotoGallery photos={log.photos} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB CONTENT: Trends */}
                {tab === 'trends' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {logs.length < 2 ? (
                            <div className="py-12 text-center text-sm text-slate-500">
                                <span className="material-symbols-outlined mb-2 text-[48px] text-slate-300">monitoring</span>
                                <p>Se requieren al menos 2 lecturas para graficar tendencias.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                {MONITORING_FIELDS.map(f => {
                                    const chartData = [...logs].reverse().filter(l => {
                                        const record = (l as unknown as Record<string, number | null>);
                                        return record[f.key] != null || (f.key === 'voltage' && record['voltage_l1'] != null) || (f.key === 'amperage' && record['amperage_a1'] != null);
                                    }).map(l => {
                                        const record = (l as unknown as Record<string, number | null>);
                                        const base: Record<string, string | number> = {
                                            date: new Date(l.log_date + 'T00:00:00').toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
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
                                                    <span className="material-symbols-outlined text-sky-500 text-[20px]">{f.icon}</span>
                                                    <h3 className="font-bold text-slate-900">{f.label}</h3>
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

                {/* TAB CONTENT: Videos */}
                {tab === 'video' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-sm font-bold text-slate-900">Registros de Videograbación</h3>
                        {videos.length === 0 ? (
                            <div className="py-8 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200/60">Sin registros de videograbación.</div>
                        ) : (
                            <div className="space-y-4">
                                {videos.map(v => (
                                    <div key={v.id} className="flex flex-col gap-3 rounded-xl border border-slate-200/60 bg-white p-5 md:flex-row md:items-start shadow-sm">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100">
                                            <span className="material-symbols-outlined text-sky-600 text-[24px]">videocam</span>
                                        </div>
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="font-bold text-sm text-slate-900">{new Date(v.recording_date + 'T00:00:00').toLocaleDateString('es-MX')} — {v.recorded_by || 'Operador'}</p>
                                                {v.video_url && (
                                                    <a href={v.video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-100">
                                                        <span className="material-symbols-outlined text-[16px]">play_circle</span> Ver Video
                                                    </a>
                                                )}
                                            </div>
                                            
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-slate-50 p-4 text-xs">
                                                <div><span className="block text-slate-400 mb-0.5">Material Ademe</span><span className="font-semibold text-slate-900">{v.ademe_material || '—'}</span></div>
                                                <div><span className="block text-slate-400 mb-0.5">Diám. Ademe</span><span className="font-semibold text-slate-900">{v.ademe_diameter || '—'}</span></div>
                                                <div><span className="block text-slate-400 mb-0.5">Tipo Ranuras</span><span className="font-semibold text-slate-900">{v.slot_type || '—'}</span></div>
                                                <div><span className="block text-slate-400 mb-0.5">Rejillas</span><span className="font-semibold text-slate-900">{v.grid_depth != null ? `${v.grid_depth}m` : '—'}</span></div>
                                                <div><span className="block text-slate-400 mb-0.5">NE</span><span className="font-semibold text-slate-900">{v.static_level != null ? `${v.static_level}m` : '—'}</span></div>
                                                <div><span className="block text-slate-400 mb-0.5">Fondo</span><span className="font-semibold text-slate-900">{v.bottom_depth != null ? `${v.bottom_depth}m` : '—'}</span></div>
                                            </div>

                                            {v.casing_observations && (
                                                <div className="rounded-lg border border-amber-200/50 bg-amber-50 p-4 text-sm">
                                                    <span className="font-bold text-amber-800 block mb-1 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[16px]">warning</span>
                                                        Observaciones (Ademe)
                                                    </span>
                                                    <p className="text-amber-900">{v.casing_observations}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB CONTENT: Client Well Log (Editable for the client) */}
                {tab === 'client_log' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {submitted && (
                            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                                    <span className="material-symbols-outlined text-emerald-600 text-[22px]">check_circle</span>
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-emerald-800">¡Bitácora registrada exitosamente!</p>
                                    <p className="text-xs text-emerald-600 mt-0.5">Gracias por mantener tu bitácora al día.</p>
                                </div>
                                <button onClick={() => setSubmitted(false)} className="ml-auto text-emerald-400 hover:text-emerald-600">
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>
                        )}

                        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
                            <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-slate-900">
                                <span className="material-symbols-outlined text-sky-500 text-[22px]">edit_note</span>
                                Nueva Entrada de Bitácora
                            </h3>
                            <form onSubmit={handleSubmitClientLog}>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className={labelClass}>Fecha *</label>
                                        <input type="date" value={form.log_date} onChange={e => setForm({ ...form, log_date: e.target.value })} required className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Tu nombre</label>
                                        <input value={form.recorded_by} onChange={e => setForm({ ...form, recorded_by: e.target.value })} placeholder="¿Quién registra?" className={inputClass} />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>Estado del equipo *</label>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                            {(Object.keys(FUNCTIONALITY_STATUS_LABELS) as FunctionalityStatus[]).map(s => (
                                                <button
                                                    key={s} type="button"
                                                    onClick={() => setForm({ ...form, functionality_status: s })}
                                                    className={`flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-xs font-semibold transition-all ${
                                                        form.functionality_status === s
                                                            ? `border-sky-500 ${FUNCTIONALITY_STATUS_COLORS[s].bg} ${FUNCTIONALITY_STATUS_COLORS[s].text} ring-2 ring-sky-200`
                                                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">{FUNCTIONALITY_STATUS_COLORS[s].icon}</span>
                                                    {FUNCTIONALITY_STATUS_LABELS[s]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="sm:col-span-2">
                                        <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                                            <span className="material-symbols-outlined text-[14px]">monitoring</span>
                                            Lecturas (llena las que puedas)
                                        </p>
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Nivel Estático (m)</label>
                                                <input type="number" step="0.01" value={form.static_level} onChange={e => setForm({ ...form, static_level: e.target.value })} placeholder="m" className={inputClass} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Nivel Dinámico (m)</label>
                                                <input type="number" step="0.01" value={form.dynamic_level} onChange={e => setForm({ ...form, dynamic_level: e.target.value })} placeholder="m" className={inputClass} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Caudal (L/s)</label>
                                                <input type="number" step="0.01" value={form.flow_rate} onChange={e => setForm({ ...form, flow_rate: e.target.value })} placeholder="L/s" className={inputClass} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Presión (PSI)</label>
                                                <input type="number" step="0.01" value={form.pressure} onChange={e => setForm({ ...form, pressure: e.target.value })} placeholder="PSI" className={inputClass} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Horas Operación</label>
                                                <input type="number" step="0.1" value={form.hours_operation} onChange={e => setForm({ ...form, hours_operation: e.target.value })} placeholder="hrs" className={inputClass} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>Observaciones</label>
                                        <textarea value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} rows={3} placeholder="Describe cómo está funcionando..." className={inputClass + ' resize-none'} />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>Fotos (opcional)</label>
                                        <PhotoUploader photos={photos} onPhotosChange={setPhotos} folder={`client-logs/${equip.id}`} uploaderName={form.recorded_by || 'Cliente'} compact />
                                    </div>
                                </div>
                                <button type="submit" disabled={submitting} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-200 hover:bg-sky-600 disabled:opacity-50 transition-colors">
                                    {submitting ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Guardando...</> : <><span className="material-symbols-outlined text-[18px]">save</span>Registrar Bitácora</>}
                                </button>
                            </form>
                        </div>

                        {clientLogs.length > 0 && (
                            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
                                <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                                    <span className="material-symbols-outlined text-sky-500 text-[22px]">history</span> Historial de Mi Bitácora
                                </h3>
                                <div className="space-y-4">
                                    {clientLogs.map(log => {
                                        const statusColor = FUNCTIONALITY_STATUS_COLORS[log.functionality_status] || FUNCTIONALITY_STATUS_COLORS.normal;
                                        return (
                                            <div key={log.id} className="rounded-xl border border-slate-100 p-4 hover:bg-slate-50/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${statusColor.bg}`}>
                                                        <span className={`material-symbols-outlined text-[20px] ${statusColor.text}`}>{statusColor.icon}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-slate-900">{new Date(log.log_date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                                            {log.recorded_by && <span>Por: {log.recorded_by}</span>}
                                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor.bg} ${statusColor.text}`}>
                                                                {FUNCTIONALITY_STATUS_LABELS[log.functionality_status]}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {(log.static_level || log.dynamic_level || log.flow_rate || log.pressure || log.hours_operation) && (
                                                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                                        {log.static_level != null && <span className="rounded-md bg-sky-50 px-2 py-1 font-semibold text-sky-700">NE: {log.static_level}m</span>}
                                                        {log.dynamic_level != null && <span className="rounded-md bg-sky-50 px-2 py-1 font-semibold text-sky-700">ND: {log.dynamic_level}m</span>}
                                                        {log.flow_rate != null && <span className="rounded-md bg-sky-50 px-2 py-1 font-semibold text-sky-700">Q: {log.flow_rate} L/s</span>}
                                                        {log.pressure != null && <span className="rounded-md bg-sky-50 px-2 py-1 font-semibold text-sky-700">P: {log.pressure} PSI</span>}
                                                        {log.hours_operation != null && <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-600">{log.hours_operation} hrs</span>}
                                                    </div>
                                                )}
                                                {log.observations && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 italic">{log.observations}</p>}
                                                {log.photos && (log.photos as unknown[]).length > 0 && <div className="mt-3"><PhotoGallery photos={log.photos as PhotoAttachment[]} /></div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB CONTENT: History */}
                {tab === 'history' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-sm font-bold text-slate-900">Historial de Mantenimiento</h3>
                        {schedules.length === 0 ? (
                            <div className="py-8 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200/60">No hay mantenimientos registrados.</div>
                        ) : (
                            <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-8 py-4">
                                {schedules.map(s => {
                                    const days = getDaysUntil(s.next_service_date);
                                    const urgency = getUrgencyColor(days);
                                    return (
                                        <div key={s.id} className="relative">
                                            <div className={`absolute -left-[35px] flex h-6 w-6 items-center justify-center rounded-full border-4 border-white ${s.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                                <span className="material-symbols-outlined text-[12px] text-white">{s.status === 'completed' ? 'check' : 'schedule'}</span>
                                            </div>
                                            <div className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm">
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <h4 className="font-bold text-slate-900">{s.service_title}</h4>
                                                        <p className="text-xs text-slate-500 mt-0.5">{s.provider || 'Proveedor Interno'}</p>
                                                    </div>
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${s.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : s.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : s.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                                                        {s.status === 'completed' ? 'Completado' : s.status === 'scheduled' ? 'Programado' : s.status === 'overdue' ? 'Vencido' : 'Cancelado'}
                                                    </span>
                                                </div>
                                                <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                                                    {s.last_service_date && (
                                                        <div>
                                                            <span className="block text-slate-400 font-semibold mb-0.5">Último Servicio</span>
                                                            <span className="font-medium text-slate-900">{new Date(s.last_service_date).toLocaleDateString('es-MX')}</span>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="block text-slate-400 font-semibold mb-0.5">Próximo Servicio</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-medium text-slate-900">{new Date(s.next_service_date).toLocaleDateString('es-MX')}</span>
                                                            {s.status !== 'completed' && s.status !== 'cancelled' && (
                                                                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${urgency.bg} ${urgency.text}`}>
                                                                    {days < 0 ? `Hace ${Math.abs(days)}d` : `En ${days}d`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {s.notes && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{s.notes}</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB CONTENT: Warranties */}
                {tab === 'warranties' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-sm font-bold text-slate-900">Garantías y Pólizas</h3>
                        {warranties.length === 0 ? (
                            <div className="py-8 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200/60">No hay garantías registradas.</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {warranties.map(w => {
                                    const days = getDaysUntil(w.end_date);
                                    const isActive = days >= 0;
                                    return (
                                        <div key={w.id} className={`rounded-xl border p-5 shadow-sm ${isActive ? 'border-emerald-200/60 bg-white' : 'border-slate-200/60 bg-slate-50'}`}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isActive ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                                                        <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-emerald-600' : 'text-slate-500'}`}>verified</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900">Póliza / Garantía</h4>
                                                        <p className="text-xs text-slate-500 mt-0.5">{w.provider || 'Proveedor Principal'}</p>
                                                    </div>
                                                </div>
                                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                                    {isActive ? 'Activa' : 'Vencida'}
                                                </span>
                                            </div>
                                            <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs border border-slate-100">
                                                <div><span className="block text-slate-400 mb-0.5">Inicio</span><span className="font-semibold text-slate-900">{new Date(w.start_date).toLocaleDateString('es-MX')}</span></div>
                                                <div>
                                                    <span className="block text-slate-400 mb-0.5">Vencimiento</span>
                                                    <span className="font-semibold text-slate-900 flex items-center gap-1">
                                                        {new Date(w.end_date).toLocaleDateString('es-MX')}
                                                        {isActive && <span className="text-emerald-500 text-[10px] ml-1">({days}d)</span>}
                                                    </span>
                                                </div>
                                            </div>
                                            {w.coverage && <p className="mt-3 text-xs text-slate-600 italic">" {w.coverage} "</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
                
                {/* Footer */}
                <footer className="mt-12 text-center text-xs text-slate-400 pb-6">
                    <p>Información gestionada por <strong className="text-slate-500">Núcleo de Ingeniería</strong></p>
                    <p className="mt-1">Perforación y mantenimiento de pozos de agua</p>
                </footer>
            </div>
        </div>
    );
}
