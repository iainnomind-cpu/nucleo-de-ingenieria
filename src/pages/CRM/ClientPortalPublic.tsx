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
                    <div className="space-y-4 animate-in fade-in duration-500">
                        {startups.map(s => (
                            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-emerald-500">power</span> 
                                    Servicio de Arranque {s.folio && <span className="text-sm font-normal text-slate-500 ml-2">Folio: {s.folio}</span>}
                                </h3>
                                <p className="text-sm text-slate-500 mb-4">{s.record_date} {s.location ? ` · ${s.location}` : ''}</p>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4 bg-slate-50 p-3 rounded-lg">
                                    <div><span className="block text-xs text-slate-400">Voltaje Prom.</span><span className="font-medium">{s.avg_volts || '-'} V</span></div>
                                    <div><span className="block text-xs text-slate-400">Amperaje Prom.</span><span className="font-medium">{s.avg_amps || '-'} A</span></div>
                                    <div><span className="block text-xs text-slate-400">Desbalance</span><span className="font-medium">{s.unbalance_percentage || '-'} %</span></div>
                                    <div><span className="block text-xs text-slate-400">Caudal</span><span className="font-medium">{s.flow_rate || '-'}</span></div>
                                </div>
                                {s.recommendations && (
                                    <div className="text-sm text-slate-700 mb-4"><strong>Recomendaciones:</strong> {s.recommendations}</div>
                                )}
                                {s.photos && s.photos.length > 0 && (
                                    <div className="mt-4"><PhotoGallery photos={s.photos} /></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Instalaciones */}
                {tab === 'instalaciones' && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        {installations.map(i => (
                            <div key={i.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-sky-500">build</span> 
                                    Instalación de Equipo {i.folio && <span className="text-sm font-normal text-slate-500 ml-2">Folio: {i.folio}</span>}
                                </h3>
                                <p className="text-sm text-slate-500 mb-4">{i.installation_date} {i.location ? ` · ${i.location}` : ''}</p>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4 bg-slate-50 p-3 rounded-lg">
                                    <div><span className="block text-xs text-slate-400">Diám. Ademe</span><span className="font-medium">{i.ademe_diameter || '-'}</span></div>
                                    <div><span className="block text-xs text-slate-400">Tubería</span><span className="font-medium">{i.pipe_diameter || '-'}</span></div>
                                    <div><span className="block text-xs text-slate-400">Nivel Estático</span><span className="font-medium">{i.static_level || '-'} m</span></div>
                                    <div><span className="block text-xs text-slate-400">Profundidad</span><span className="font-medium">{i.installation_depth || '-'} m</span></div>
                                </div>
                                {i.observations && (
                                    <div className="text-sm text-slate-700 mb-4"><strong>Observaciones:</strong> {i.observations}</div>
                                )}
                                {i.photos && i.photos.length > 0 && (
                                    <div className="mt-4"><PhotoGallery photos={i.photos} /></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Desinstalaciones */}
                {tab === 'desinstalaciones' && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        {uninstallations.map(u => (
                            <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-orange-500">settings_backup_restore</span> 
                                    Desinstalación {u.folio && <span className="text-sm font-normal text-slate-500 ml-2">Folio: {u.folio}</span>}
                                </h3>
                                <p className="text-sm text-slate-500 mb-4">{u.uninstallation_date} {u.location ? ` · ${u.location}` : ''}</p>
                                
                                <div className="text-sm text-slate-700 bg-orange-50 p-3 rounded-lg border border-orange-100 mb-4">
                                    <strong>Motivo de extracción:</strong> {u.reason || 'No especificado'}
                                </div>
                                {u.photos && u.photos.length > 0 && (
                                    <div className="mt-4"><PhotoGallery photos={u.photos} /></div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB CONTENT: Cuadros */}
                {tab === 'cuadros' && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        {panels.map(p => (
                            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-amber-500">electrical_services</span> 
                                    Cuadro Eléctrico {p.folio && <span className="text-sm font-normal text-slate-500 ml-2">Folio: {p.folio}</span>}
                                </h3>
                                <p className="text-sm text-slate-500 mb-4">{p.record_date} {p.well_name ? ` · Pozo: ${p.well_name}` : ''}</p>
                                
                                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                    <div className="bg-slate-50 p-3 rounded-lg">
                                        <h4 className="font-bold text-xs text-slate-500 mb-2 uppercase tracking-wide border-b border-slate-200 pb-1">Transformador</h4>
                                        <p><span className="text-slate-400">Capacidad:</span> {p.trans_capacity || '-'}</p>
                                        <p><span className="text-slate-400">Marca:</span> {p.trans_brand || '-'}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg">
                                        <h4 className="font-bold text-xs text-slate-500 mb-2 uppercase tracking-wide border-b border-slate-200 pb-1">Arrancador</h4>
                                        <p><span className="text-slate-400">Voltaje:</span> {p.arr_voltage || '-'}</p>
                                        <p><span className="text-slate-400">Gabinete:</span> {p.arr_cabinet_type || '-'}</p>
                                    </div>
                                </div>
                                {p.photos && p.photos.length > 0 && (
                                    <div className="mt-4"><PhotoGallery photos={p.photos} /></div>
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
