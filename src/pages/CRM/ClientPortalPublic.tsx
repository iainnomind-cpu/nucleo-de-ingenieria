import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PhotoGallery } from '../../components/PhotoUploader';
import { 
    EQUIPMENT_TYPE_ICONS, 
    EQUIPMENT_TYPE_LABELS 
} from '../../types/maintenance';

type PortalTab = 'equipos' | 'videos' | 'arranque' | 'instalaciones' | 'desinstalaciones' | 'cuadros' | 'aforos';

export default function ClientPortalPublic() {
    const { clientId } = useParams<{ clientId: string }>();
    
    const [client, setClient] = useState<any>(null);
    const [equipments, setEquipments] = useState<any[]>([]);
    const [videos, setVideos] = useState<any[]>([]);
    const [startups, setStartups] = useState<any[]>([]);
    const [installations, setInstallations] = useState<any[]>([]);
    const [uninstallations, setUninstallations] = useState<any[]>([]);
    const [panels, setPanels] = useState<any[]>([]);
    const [aforos, setAforos] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [tab, setTab] = useState<PortalTab>('equipos');

    const fetchData = useCallback(async () => {
        if (!clientId) return;
        setLoading(true);

        const { data: clientData } = await supabase
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();

        if (!clientData) {
            setNotFound(true);
            setLoading(false);
            return;
        }
        setClient(clientData);

        const [eqRes, vRes, sRes, iRes, uRes, pRes, aRes] = await Promise.all([
            supabase.from('installed_equipment').select('*').eq('client_id', clientId).order('installation_date', { ascending: false }),
            supabase.from('video_recordings').select('*').eq('client_id', clientId).order('recording_date', { ascending: false }),
            supabase.from('startup_formats').select('*').eq('client_id', clientId).order('record_date', { ascending: false }),
            supabase.from('well_installations').select('*').eq('client_id', clientId).order('installation_date', { ascending: false }),
            supabase.from('well_uninstallations').select('*').eq('client_id', clientId).order('uninstallation_date', { ascending: false }),
            supabase.from('electric_panel_records').select('*').eq('client_id', clientId).order('record_date', { ascending: false }),
            supabase.from('aforo_records').select('*, measurements:aforo_measurements(*)').eq('client_id', clientId).order('created_at', { ascending: false }),
        ]);

        setEquipments(eqRes.data || []);
        setVideos(vRes.data || []);
        setStartups(sRes.data || []);
        setInstallations(iRes.data || []);
        setUninstallations(uRes.data || []);
        setPanels(pRes.data || []);
        setAforos(aRes.data || []);
        
        if (eqRes.data?.length) setTab('equipos');
        else if (vRes.data?.length) setTab('videos');
        else if (sRes.data?.length) setTab('arranque');
        else if (iRes.data?.length) setTab('instalaciones');
        else if (uRes.data?.length) setTab('desinstalaciones');
        else if (pRes.data?.length) setTab('cuadros');
        else if (aRes.data?.length) setTab('aforos');

        setLoading(false);
    }, [clientId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (notFound) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50 p-4">
                <div className="max-w-md text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                        <span className="material-symbols-outlined text-red-500 text-[40px]">link_off</span>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900">Enlace no válido</h1>
                    <p className="mt-2 text-sm text-slate-500">Este portal de cliente no es válido o ha sido desactivado.</p>
                </div>
            </div>
        );
    }

    if (loading || !client) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
                    <p className="text-sm text-slate-500">Cargando portal del cliente...</p>
                </div>
            </div>
        );
    }

    const TABS: { key: PortalTab; icon: string; label: string; count: number }[] = [
        { key: 'equipos', icon: 'precision_manufacturing', label: 'Mis Equipos', count: equipments.length },
        { key: 'videos', icon: 'videocam', label: 'Videograbaciones', count: videos.length },
        { key: 'arranque', icon: 'power', label: 'Arranques', count: startups.length },
        { key: 'instalaciones', icon: 'build', label: 'Instalaciones', count: installations.length },
        { key: 'desinstalaciones', icon: 'settings_backup_restore', label: 'Desinstalaciones', count: uninstallations.length },
        { key: 'cuadros', icon: 'electrical_services', label: 'Cuadros Eléctricos', count: panels.length },
        { key: 'aforos', icon: 'water_drop', label: 'Aforos', count: aforos.length },
    ].filter(t => t.count > 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-white pb-20">
            {/* Header */}
            <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-lg sticky top-0 z-10 shadow-sm">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="Núcleo de Ingeniería" className="h-10 object-contain" />
                        <div className="hidden sm:block border-l border-slate-200 pl-3">
                            <h1 className="text-[13px] font-bold text-sky-800">NÚCLEO DE INGENIERÍA HIDRÁULICA Y ELÉCTRICA</h1>
                            <p className="text-[10px] text-slate-500">Portal del Cliente</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-sm font-bold text-slate-900">{client.company_name}</h2>
                        <p className="text-[11px] text-slate-400">Cliente de Núcleo</p>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-5xl px-4 py-8">
                {/* Tabs Selector */}
                {TABS.length > 0 ? (
                    <div className="mb-6 flex overflow-x-auto pb-2 scrollbar-hide gap-2">
                        {TABS.map(t => (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${
                                    tab === t.key ? 'bg-sky-500 text-white shadow-md shadow-sky-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}>
                                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                                {t.label}
                                <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] ${
                                    tab === t.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                }`}>{t.count}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <span className="material-symbols-outlined text-slate-300 text-[40px] mb-3">inbox</span>
                        <h3 className="text-sm font-bold text-slate-700">Sin registros</h3>
                        <p className="text-xs text-slate-500 mt-1">Aún no hay equipos ni formatos de mantenimiento registrados para este cliente.</p>
                    </div>
                )}

                {/* TAB CONTENT: Equipos */}
                {tab === 'equipos' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
                        {equipments.map(eq => (
                            <div key={eq.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                                    <span className="material-symbols-outlined text-[24px]">{EQUIPMENT_TYPE_ICONS[eq.equipment_type as keyof typeof EQUIPMENT_TYPE_ICONS] || 'precision_manufacturing'}</span>
                                </div>
                                <h3 className="font-bold text-slate-900">{eq.name}</h3>
                                <p className="text-xs font-semibold text-sky-600 mb-3">{EQUIPMENT_TYPE_LABELS[eq.equipment_type as keyof typeof EQUIPMENT_TYPE_LABELS]}</p>
                                <div className="space-y-2 text-xs text-slate-600">
                                    {eq.well_name && <p><span className="text-slate-400 w-16 inline-block">Pozo:</span> {eq.well_name}</p>}
                                    {eq.brand && <p><span className="text-slate-400 w-16 inline-block">Marca:</span> {eq.brand}</p>}
                                    {eq.location && <p><span className="text-slate-400 w-16 inline-block">Lugar:</span> {eq.location}</p>}
                                </div>
                                {eq.access_token && (
                                    <a href={`/well-log/${eq.access_token}`} target="_blank" rel="noreferrer" className="mt-4 block text-center rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-sky-600 hover:bg-sky-50">
                                        Ver Bitácora del Equipo
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Videograbaciones */}
                {tab === 'videos' && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        {videos.map(v => (
                            <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                            <span className="material-symbols-outlined text-purple-500">videocam</span> 
                                            Videograbación {v.folio && <span className="text-sm font-normal text-slate-500 ml-2">Folio: {v.folio}</span>}
                                        </h3>
                                        <p className="text-sm text-slate-500 mt-1">{v.recording_date} {v.well_name ? ` · ${v.well_name}` : ''}</p>
                                    </div>
                                    {v.video_url && (
                                        <a href={v.video_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-600 hover:bg-purple-100">
                                            <span className="material-symbols-outlined text-[16px]">play_circle</span> Ver Video
                                        </a>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4 bg-slate-50 p-3 rounded-lg">
                                    <div><span className="block text-xs text-slate-400">N. Estático</span><span className="font-medium">{v.static_level || '-'} m</span></div>
                                    <div><span className="block text-xs text-slate-400">Prof. Fondo</span><span className="font-medium">{v.bottom_depth || '-'} m</span></div>
                                    <div><span className="block text-xs text-slate-400">Ademe</span><span className="font-medium">{v.ademe_material || '-'}</span></div>
                                    <div><span className="block text-xs text-slate-400">Diám. Ademe</span><span className="font-medium">{v.ademe_diameter || '-'}</span></div>
                                </div>
                                {v.casing_observations && (
                                    <div className="text-sm text-slate-700 bg-yellow-50 p-3 rounded-lg border border-yellow-100 mb-4">
                                        <strong>Observaciones:</strong> {v.casing_observations}
                                    </div>
                                )}
                                {v.photos && v.photos.length > 0 && (
                                    <div className="mt-4"><PhotoGallery photos={v.photos} /></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Arranques */}
                {tab === 'arranque' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {startups.map(s => (
                            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                {/* Header */}
                                <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                            <span className="material-symbols-outlined text-emerald-500">power</span>
                                            Formato de Arranque
                                        </h3>
                                        {s.folio && <span className="inline-block mt-1 text-xs font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Folio: {s.folio}</span>}
                                    </div>
                                    <div className="text-right text-sm text-slate-500">
                                        <p>{s.record_date}</p>
                                        {s.location && <p>{s.location}</p>}
                                        {s.technician && <p className="text-xs text-slate-400">Técnico: {s.technician}</p>}
                                        {s.equipment && <p className="text-xs text-slate-400">Equipo: {s.equipment}</p>}
                                    </div>
                                </div>

                                {/* Tabla de mediciones */}
                                {(s.time_logged || s.time_logged_2 || s.time_logged_3) && (
                                    <div className="mb-4">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Tabla de Mediciones</h4>
                                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                                            <table className="w-full text-xs text-center">
                                                <thead className="bg-slate-50 text-slate-500">
                                                    <tr>
                                                        <th className="px-2 py-2 border-b border-slate-200">Hora</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">V L1-L2</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">V L2-L3</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">V L1-L3</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">A L1</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">A L2</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">A L3</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">Caudal</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">N.D.</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">P.D.</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">Prom.V</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">Prom.A</th>
                                                        <th className="px-2 py-2 border-b border-slate-200">% Desb.</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[
                                                        { h: s.time_logged, v1: s.volts_l1, v2: s.volts_l2, v3: s.volts_l3, a1: s.amp_l1, a2: s.amp_l2, a3: s.amp_l3, q: s.flow_rate, nd: s.dynamic_level, pd: s.discharge_pressure, pv: s.avg_volts, pa: s.avg_amps, d: s.unbalance_percentage },
                                                        { h: s.time_logged_2, v1: s.volts_l1_2, v2: s.volts_l2_2, v3: s.volts_l3_2, a1: s.amp_l1_2, a2: s.amp_l2_2, a3: s.amp_l3_2, q: s.flow_rate_2, nd: s.dynamic_level_2, pd: s.discharge_pressure_2, pv: s.avg_volts_2, pa: s.avg_amps_2, d: s.unbalance_percentage_2 },
                                                        { h: s.time_logged_3, v1: s.volts_l1_3, v2: s.volts_l2_3, v3: s.volts_l3_3, a1: s.amp_l1_3, a2: s.amp_l2_3, a3: s.amp_l3_3, q: s.flow_rate_3, nd: s.dynamic_level_3, pd: s.discharge_pressure_3, pv: s.avg_volts_3, pa: s.avg_amps_3, d: s.unbalance_percentage_3 },
                                                    ].filter(r => r.h).map((r, i) => (
                                                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                            <td className="px-2 py-2 font-medium">{r.h || '-'}</td>
                                                            <td className="px-2 py-2">{r.v1 || '-'}</td>
                                                            <td className="px-2 py-2">{r.v2 || '-'}</td>
                                                            <td className="px-2 py-2">{r.v3 || '-'}</td>
                                                            <td className="px-2 py-2">{r.a1 || '-'}</td>
                                                            <td className="px-2 py-2">{r.a2 || '-'}</td>
                                                            <td className="px-2 py-2">{r.a3 || '-'}</td>
                                                            <td className="px-2 py-2">{r.q || '-'}</td>
                                                            <td className="px-2 py-2">{r.nd || '-'}</td>
                                                            <td className="px-2 py-2">{r.pd || '-'}</td>
                                                            <td className="px-2 py-2 font-semibold text-sky-700">{r.pv || '-'}</td>
                                                            <td className="px-2 py-2 font-semibold text-sky-700">{r.pa || '-'}</td>
                                                            <td className="px-2 py-2 font-semibold text-amber-600">{r.d || '-'}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Parámetros eléctricos + Datos Motor */}
                                {(s.low_voltage || s.high_voltage || s.overload_amps || s.motor_power_hp || s.motor_feed_volts) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        {(s.low_voltage || s.high_voltage || s.overload_amps || s.underload_amps || s.phase_unbalance) && (
                                            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Parámetros Eléctricos</h4>
                                                <div className="space-y-1 text-sm">
                                                    {s.low_voltage && <p><span className="text-slate-400">Bajo voltaje:</span> <span className="font-medium">{s.low_voltage} V</span></p>}
                                                    {s.high_voltage && <p><span className="text-slate-400">Alto voltaje:</span> <span className="font-medium">{s.high_voltage} V</span></p>}
                                                    {s.overload_amps && <p><span className="text-slate-400">Sobre carga:</span> <span className="font-medium">{s.overload_amps} A</span></p>}
                                                    {s.underload_amps && <p><span className="text-slate-400">Baja carga:</span> <span className="font-medium">{s.underload_amps} A</span></p>}
                                                    {s.phase_unbalance && <p><span className="text-slate-400">Desbalance de fases:</span> <span className="font-medium">{s.phase_unbalance} %</span></p>}
                                                </div>
                                            </div>
                                        )}
                                        {(s.motor_power_hp || s.motor_feed_volts || s.motor_frequency_hz || s.motor_nom_amps || s.motor_protection_type) && (
                                            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Datos del Motor</h4>
                                                <div className="space-y-1 text-sm">
                                                    {s.motor_power_hp && <p><span className="text-slate-400">Potencia:</span> <span className="font-medium">{s.motor_power_hp} Hp</span></p>}
                                                    {s.motor_feed_volts && <p><span className="text-slate-400">Alimentación:</span> <span className="font-medium">{s.motor_feed_volts} V</span></p>}
                                                    {s.motor_frequency_hz && <p><span className="text-slate-400">Frecuencia:</span> <span className="font-medium">{s.motor_frequency_hz} Hz</span></p>}
                                                    {s.motor_nom_amps && <p><span className="text-slate-400">Amp. Nominal:</span> <span className="font-medium">{s.motor_nom_amps} A</span></p>}
                                                    {s.motor_protection_type && <p><span className="text-slate-400">Protección:</span> <span className="font-medium">{s.motor_protection_type}</span></p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Recomendaciones */}
                                {s.recommendations && (
                                    <div className="text-sm text-slate-700 mb-4 rounded-lg bg-amber-50 border border-amber-100 p-3">
                                        <strong className="text-amber-800">Observaciones y recomendaciones:</strong>
                                        <p className="mt-1 whitespace-pre-line">{s.recommendations}</p>
                                    </div>
                                )}

                                {/* Firmas */}
                                {(s.received_by || s.reviewed_by || s.authorized_by) && (
                                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
                                        <div><p className="font-semibold uppercase">Recibió</p><p className="mt-1 font-medium text-slate-700">{s.received_by || '—'}</p></div>
                                        <div><p className="font-semibold uppercase">Revisó</p><p className="mt-1 font-medium text-slate-700">{s.reviewed_by || '—'}</p></div>
                                        <div><p className="font-semibold uppercase">Autorizó</p><p className="mt-1 font-medium text-slate-700">{s.authorized_by || '—'}</p></div>
                                    </div>
                                )}

                                {s.photos && s.photos.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100"><PhotoGallery photos={s.photos} /></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Instalaciones */}
                {tab === 'instalaciones' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {installations.map(i => (
                            <div key={i.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                {/* Header */}
                                <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sky-500">build</span>
                                            Maniobra / Instalación de Equipo
                                        </h3>
                                        {i.folio && <span className="inline-block mt-1 text-xs font-semibold bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">Folio: {i.folio}</span>}
                                    </div>
                                    <div className="text-right text-sm text-slate-500">
                                        <p>{i.installation_date}</p>
                                        {i.location && <p>{i.location}</p>}
                                    </div>
                                </div>

                                {/* Pozo y Tubería */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                    {i.ademe_diameter && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Diám. Ademe</p><p className="font-semibold text-sm mt-0.5">{i.ademe_diameter}</p></div>}
                                    {i.ademe_material && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Material Ademe</p><p className="font-semibold text-sm mt-0.5">{i.ademe_material}</p></div>}
                                    {i.pipe_diameter && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Diám. Tubería</p><p className="font-semibold text-sm mt-0.5">{i.pipe_diameter}</p></div>}
                                    {i.pipe_length && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Long. Tubería</p><p className="font-semibold text-sm mt-0.5">{i.pipe_length}</p></div>}
                                    {i.pipe_segments ? <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Tramos</p><p className="font-semibold text-sm mt-0.5">{i.pipe_segments}</p></div> : null}
                                    {i.valv_check ? <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Válv. Check</p><p className="font-semibold text-sm mt-0.5">{i.valv_check}</p></div> : null}
                                    {i.cable_gauge && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Calibre Cable</p><p className="font-semibold text-sm mt-0.5">{i.cable_gauge}</p></div>}
                                    {i.motor_hp && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Motor / HP</p><p className="font-semibold text-sm mt-0.5">{i.motor_hp}</p></div>}
                                    {i.pump_model && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Modelo Bomba</p><p className="font-semibold text-sm mt-0.5">{i.pump_model}</p></div>}
                                    {i.starter_system && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Sist. Arranque</p><p className="font-semibold text-sm mt-0.5">{i.starter_system}</p></div>}
                                    {i.protection_type && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Protección</p><p className="font-semibold text-sm mt-0.5">{i.protection_type}</p></div>}
                                    {i.has_ground !== undefined && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Tierra Física</p><p className="font-semibold text-sm mt-0.5">{i.has_ground ? 'Sí' : 'No'}{i.ground_location ? ` (${i.ground_location})` : ''}</p></div>}
                                </div>

                                {/* Niveles */}
                                {(i.static_level || i.dynamic_level || i.flow_rate || i.bottom_depth) && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                        {i.static_level ? <div className="bg-sky-50 rounded-lg p-3 border border-sky-200"><p className="text-xs text-sky-400">Nivel Estático</p><p className="font-semibold text-sm mt-0.5 text-sky-700">{i.static_level} m</p></div> : null}
                                        {i.dynamic_level ? <div className="bg-sky-50 rounded-lg p-3 border border-sky-200"><p className="text-xs text-sky-400">Nivel Dinámico</p><p className="font-semibold text-sm mt-0.5 text-sky-700">{i.dynamic_level} m</p></div> : null}
                                        {i.flow_rate ? <div className="bg-sky-50 rounded-lg p-3 border border-sky-200"><p className="text-xs text-sky-400">Gasto</p><p className="font-semibold text-sm mt-0.5 text-sky-700">{i.flow_rate} lps</p></div> : null}
                                        {i.bottom_depth ? <div className="bg-sky-50 rounded-lg p-3 border border-sky-200"><p className="text-xs text-sky-400">Prof. Fondo</p><p className="font-semibold text-sm mt-0.5 text-sky-700">{i.bottom_depth} m</p></div> : null}
                                    </div>
                                )}

                                {/* Observaciones */}
                                {i.observations && (
                                    <div className="text-sm text-slate-700 mb-4 rounded-lg bg-amber-50 border border-amber-100 p-3">
                                        <strong className="text-amber-800">Observaciones:</strong>
                                        <p className="mt-1 whitespace-pre-line">{i.observations}</p>
                                    </div>
                                )}

                                {i.photos && i.photos.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100"><PhotoGallery photos={i.photos} /></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Desinstalaciones */}
                {tab === 'desinstalaciones' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {uninstallations.map(u => (
                            <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                {/* Header */}
                                <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                            <span className="material-symbols-outlined text-orange-500">settings_backup_restore</span>
                                            Desinstalación de Equipo
                                        </h3>
                                        {u.folio && <span className="inline-block mt-1 text-xs font-semibold bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">Folio: {u.folio}</span>}
                                    </div>
                                    <div className="text-right text-sm text-slate-500">
                                        <p>{u.uninstallation_date}</p>
                                        {u.location && <p>{u.location}</p>}
                                    </div>
                                </div>

                                {/* Datos del equipo extraído */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                                    {u.equipment_type && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Tipo de Equipo</p><p className="font-semibold text-sm mt-0.5">{u.equipment_type}</p></div>}
                                    {u.motor_hp && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Motor / HP</p><p className="font-semibold text-sm mt-0.5">{u.motor_hp}</p></div>}
                                    {u.pump_model && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Modelo Bomba</p><p className="font-semibold text-sm mt-0.5">{u.pump_model}</p></div>}
                                    {u.pipe_diameter && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Diám. Tubería</p><p className="font-semibold text-sm mt-0.5">{u.pipe_diameter}</p></div>}
                                    {u.pipe_segments ? <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Tramos Extraídos</p><p className="font-semibold text-sm mt-0.5">{u.pipe_segments}</p></div> : null}
                                    {u.cable_gauge && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Calibre Cable</p><p className="font-semibold text-sm mt-0.5">{u.cable_gauge}</p></div>}
                                    {u.static_level ? <div className="bg-sky-50 rounded-lg p-3 border border-sky-200"><p className="text-xs text-sky-400">Nivel Estático</p><p className="font-semibold text-sm mt-0.5 text-sky-700">{u.static_level} m</p></div> : null}
                                    {u.bottom_depth ? <div className="bg-sky-50 rounded-lg p-3 border border-sky-200"><p className="text-xs text-sky-400">Prof. Fondo</p><p className="font-semibold text-sm mt-0.5 text-sky-700">{u.bottom_depth} m</p></div> : null}
                                    {u.technician && <div className="bg-slate-50 rounded-lg p-3 border border-slate-200"><p className="text-xs text-slate-400">Técnico</p><p className="font-semibold text-sm mt-0.5">{u.technician}</p></div>}
                                </div>

                                {/* Motivo */}
                                <div className="text-sm text-slate-700 bg-orange-50 p-3 rounded-lg border border-orange-100 mb-4">
                                    <strong className="text-orange-800">Motivo de extracción:</strong>
                                    <p className="mt-1 whitespace-pre-line">{u.reason || 'No especificado'}</p>
                                </div>

                                {/* Observaciones */}
                                {u.observations && (
                                    <div className="text-sm text-slate-700 mb-4 rounded-lg bg-amber-50 border border-amber-100 p-3">
                                        <strong className="text-amber-800">Observaciones:</strong>
                                        <p className="mt-1 whitespace-pre-line">{u.observations}</p>
                                    </div>
                                )}

                                {u.photos && u.photos.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100"><PhotoGallery photos={u.photos} /></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Cuadros */}
                {tab === 'cuadros' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {panels.map(p => (
                            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                {/* Header */}
                                <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                            <span className="material-symbols-outlined text-amber-500">electrical_services</span>
                                            Cuadro Eléctrico
                                        </h3>
                                        {p.folio && <span className="inline-block mt-1 text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Folio: {p.folio}</span>}
                                    </div>
                                    <div className="text-right text-sm text-slate-500">
                                        <p>{p.record_date}</p>
                                        {p.well_name && <p>Pozo: {p.well_name}</p>}
                                        {p.location && <p>{p.location}</p>}
                                        {p.technician && <p className="text-xs text-slate-400">Técnico: {p.technician}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                                    {/* Transformador */}
                                    {(p.trans_capacity || p.trans_brand || p.trans_primary_voltage || p.trans_secondary_voltage) && (
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                            <h4 className="font-bold text-xs text-slate-500 mb-2 uppercase tracking-wide border-b border-slate-200 pb-1">Transformador</h4>
                                            <div className="space-y-1 text-sm">
                                                {p.trans_capacity && <p><span className="text-slate-400">Capacidad:</span> <span className="font-medium">{p.trans_capacity}</span></p>}
                                                {p.trans_brand && <p><span className="text-slate-400">Marca:</span> <span className="font-medium">{p.trans_brand}</span></p>}
                                                {p.trans_primary_voltage && <p><span className="text-slate-400">Voltaje Primario:</span> <span className="font-medium">{p.trans_primary_voltage} V</span></p>}
                                                {p.trans_secondary_voltage && <p><span className="text-slate-400">Voltaje Secundario:</span> <span className="font-medium">{p.trans_secondary_voltage} V</span></p>}
                                                {p.trans_phases && <p><span className="text-slate-400">Fases:</span> <span className="font-medium">{p.trans_phases}</span></p>}
                                            </div>
                                        </div>
                                    )}
                                    {/* Arrancador */}
                                    {(p.arr_voltage || p.arr_cabinet_type || p.arr_brand || p.arr_model) && (
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                            <h4 className="font-bold text-xs text-slate-500 mb-2 uppercase tracking-wide border-b border-slate-200 pb-1">Arrancador</h4>
                                            <div className="space-y-1 text-sm">
                                                {p.arr_voltage && <p><span className="text-slate-400">Voltaje:</span> <span className="font-medium">{p.arr_voltage} V</span></p>}
                                                {p.arr_cabinet_type && <p><span className="text-slate-400">Gabinete:</span> <span className="font-medium">{p.arr_cabinet_type}</span></p>}
                                                {p.arr_brand && <p><span className="text-slate-400">Marca:</span> <span className="font-medium">{p.arr_brand}</span></p>}
                                                {p.arr_model && <p><span className="text-slate-400">Modelo:</span> <span className="font-medium">{p.arr_model}</span></p>}
                                                {p.arr_hp && <p><span className="text-slate-400">HP:</span> <span className="font-medium">{p.arr_hp}</span></p>}
                                            </div>
                                        </div>
                                    )}
                                    {/* Motor */}
                                    {(p.motor_hp || p.motor_voltage || p.motor_brand || p.motor_model) && (
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                            <h4 className="font-bold text-xs text-slate-500 mb-2 uppercase tracking-wide border-b border-slate-200 pb-1">Motor</h4>
                                            <div className="space-y-1 text-sm">
                                                {p.motor_hp && <p><span className="text-slate-400">HP:</span> <span className="font-medium">{p.motor_hp}</span></p>}
                                                {p.motor_voltage && <p><span className="text-slate-400">Voltaje:</span> <span className="font-medium">{p.motor_voltage} V</span></p>}
                                                {p.motor_brand && <p><span className="text-slate-400">Marca:</span> <span className="font-medium">{p.motor_brand}</span></p>}
                                                {p.motor_model && <p><span className="text-slate-400">Modelo:</span> <span className="font-medium">{p.motor_model}</span></p>}
                                                {p.motor_nom_amps && <p><span className="text-slate-400">Amp. Nominal:</span> <span className="font-medium">{p.motor_nom_amps} A</span></p>}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Observaciones */}
                                {p.observations && (
                                    <div className="text-sm text-slate-700 mb-4 rounded-lg bg-amber-50 border border-amber-100 p-3">
                                        <strong className="text-amber-800">Observaciones:</strong>
                                        <p className="mt-1 whitespace-pre-line">{p.observations}</p>
                                    </div>
                                )}

                                {p.photos && p.photos.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100"><PhotoGallery photos={p.photos} /></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Aforos */}
                {tab === 'aforos' && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        {aforos.map(a => (
                            <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-blue-500">water_drop</span> 
                                    Aforo {a.duration_hours}H {a.folio && <span className="text-sm font-normal text-slate-500 ml-2">Folio: {a.folio}</span>}
                                </h3>
                                <p className="text-sm text-slate-500 mb-4">{new Date(a.created_at).toLocaleDateString()} {a.location ? ` · ${a.location}` : ''}</p>
                                
                                {a.measurements && a.measurements.length > 0 ? (
                                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                                        <table className="w-full text-left text-sm text-slate-600">
                                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                                <tr>
                                                    <th className="px-4 py-2 border-b border-slate-200">Día</th>
                                                    <th className="px-4 py-2 border-b border-slate-200">Hora</th>
                                                    <th className="px-4 py-2 border-b border-slate-200">N.D.</th>
                                                    <th className="px-4 py-2 border-b border-slate-200">Caudal (LPS)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(a.measurements as any[]).sort((x,y) => x.row_index - y.row_index).slice(0,5).map((m: any, i) => (
                                                    <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                        <td className="px-4 py-2 font-medium">{m.day_label || '-'}</td>
                                                        <td className="px-4 py-2">{m.hour_label || '-'}</td>
                                                        <td className="px-4 py-2">{m.dynamic_level || '-'}</td>
                                                        <td className="px-4 py-2">{m.flow_lps || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {a.measurements.length > 5 && (
                                            <div className="bg-slate-50 py-2 text-center text-xs text-slate-500 border-t border-slate-200">
                                                Y {a.measurements.length - 5} lecturas más...
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500">Sin lecturas registradas.</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
