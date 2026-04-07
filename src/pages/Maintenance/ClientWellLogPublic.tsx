import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    InstalledEquipment, ClientWellLog, FunctionalityStatus,
    EQUIPMENT_TYPE_LABELS, EQUIPMENT_TYPE_ICONS,
    FUNCTIONALITY_STATUS_LABELS, FUNCTIONALITY_STATUS_COLORS,
} from '../../types/maintenance';
import { PhotoAttachment } from '../../types/photos';
import PhotoUploader, { PhotoGallery } from '../../components/PhotoUploader';

export default function ClientWellLogPublic() {
    const { token } = useParams<{ token: string }>();
    const [equipment, setEquipment] = useState<InstalledEquipment | null>(null);
    const [logs, setLogs] = useState<ClientWellLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
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
        const { data: eq } = await supabase
            .from('installed_equipment')
            .select('*, client:clients(id, company_name)')
            .eq('access_token', token)
            .single();

        if (!eq) {
            setNotFound(true);
            setLoading(false);
            return;
        }

        setEquipment(eq as InstalledEquipment);

        // Fetch recent logs
        const { data: logsData } = await supabase
            .from('client_well_logs')
            .select('*')
            .eq('equipment_id', eq.id)
            .order('log_date', { ascending: false })
            .limit(20);

        setLogs((logsData as ClientWellLog[]) || []);
        setLoading(false);
    }, [token]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!equipment) return;
        setSubmitting(true);

        const payload: Record<string, unknown> = {
            equipment_id: equipment.id,
            client_id: equipment.client_id || null,
            log_date: form.log_date,
            recorded_by: form.recorded_by || null,
            observations: form.observations || null,
            functionality_status: form.functionality_status,
            photos: photos,
        };

        // Only include numeric fields if filled
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

        // Refresh logs
        fetchData();
    };

    // Not found
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

    // Loading
    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
                    <p className="text-sm text-slate-500">Cargando bitácora...</p>
                </div>
            </div>
        );
    }

    if (!equipment) return null;

    const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20';
    const labelClass = 'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5';

    // Activity status
    const lastLog = logs[0];
    const daysSinceLastLog = lastLog
        ? Math.floor((Date.now() - new Date(lastLog.log_date).getTime()) / (1000 * 60 * 60 * 24))
        : null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-white">
            {/* Header */}
            <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-lg">
                <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-200">
                            <span className="material-symbols-outlined text-white text-[22px]">water_drop</span>
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-slate-900">Núcleo de Ingeniería</h1>
                            <p className="text-[11px] text-slate-400">Bitácora de Pozo</p>
                        </div>
                    </div>
                    {daysSinceLastLog !== null && (
                        <div className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${
                            daysSinceLastLog <= 30 ? 'bg-emerald-100 text-emerald-700' :
                            daysSinceLastLog <= 60 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                        }`}>
                            {daysSinceLastLog <= 30 ? '✓ Al día' :
                             daysSinceLastLog <= 60 ? `⚠ ${daysSinceLastLog}d sin actualizar` :
                             `⚠ ${daysSinceLastLog}d sin bitácora`}
                        </div>
                    )}
                </div>
            </header>

            <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
                {/* Equipment Info Card */}
                <div className="mb-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100">
                            <span className="material-symbols-outlined text-sky-600 text-[28px]">{EQUIPMENT_TYPE_ICONS[equipment.equipment_type]}</span>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-slate-900">{equipment.well_name || equipment.name}</h2>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                                <span>{EQUIPMENT_TYPE_LABELS[equipment.equipment_type]}</span>
                                {equipment.brand && <><span>·</span><span>{equipment.brand} {equipment.model || ''}</span></>}
                                {equipment.location && <><span>·</span><span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-[12px]">location_on</span>{equipment.location}</span></>}
                            </div>
                        </div>
                    </div>
                    {equipment.client?.company_name && (
                        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                            <span className="material-symbols-outlined text-[14px]">business</span>
                            <span className="font-semibold text-slate-700">{equipment.client.company_name}</span>
                        </div>
                    )}
                </div>

                {/* Success Message */}
                {submitted && (
                    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                            <span className="material-symbols-outlined text-emerald-600 text-[22px]">check_circle</span>
                        </div>
                        <div>
                            <p className="font-bold text-sm text-emerald-800">¡Bitácora registrada exitosamente!</p>
                            <p className="text-xs text-emerald-600 mt-0.5">Gracias por mantener tu bitácora al día. Núcleo puede consultar esta información en sus visitas.</p>
                        </div>
                        <button onClick={() => setSubmitted(false)} className="ml-auto text-emerald-400 hover:text-emerald-600">
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>
                )}

                {/* Form */}
                <div className="mb-8 rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
                    <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-slate-900">
                        <span className="material-symbols-outlined text-sky-500 text-[22px]">edit_note</span>
                        Nueva Entrada de Bitácora
                    </h3>

                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className={labelClass}>Fecha *</label>
                                <input type="date" value={form.log_date} onChange={e => setForm({ ...form, log_date: e.target.value })} required className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Tu nombre</label>
                                <input value={form.recorded_by} onChange={e => setForm({ ...form, recorded_by: e.target.value })} placeholder="¿Quién registra?" className={inputClass} />
                            </div>

                            {/* Status */}
                            <div className="sm:col-span-2">
                                <label className={labelClass}>Estado del equipo *</label>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {(Object.keys(FUNCTIONALITY_STATUS_LABELS) as FunctionalityStatus[]).map(s => (
                                        <button
                                            key={s}
                                            type="button"
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

                            {/* Readings */}
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

                            {/* Observations */}
                            <div className="sm:col-span-2">
                                <label className={labelClass}>Observaciones</label>
                                <textarea
                                    value={form.observations}
                                    onChange={e => setForm({ ...form, observations: e.target.value })}
                                    rows={3}
                                    placeholder="Describe cómo está funcionando el pozo, si hay ruidos, vibraciones, cambios en el agua..."
                                    className={inputClass + ' resize-none'}
                                />
                            </div>

                            {/* Photos */}
                            <div className="sm:col-span-2">
                                <label className={labelClass}>Fotos (opcional)</label>
                                <PhotoUploader
                                    photos={photos}
                                    onPhotosChange={setPhotos}
                                    folder={`client-logs/${equipment.id}`}
                                    uploaderName={form.recorded_by || 'Cliente'}
                                    compact
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-200 transition-all hover:from-sky-600 hover:to-blue-700 disabled:opacity-50"
                        >
                            {submitting ? (
                                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Guardando...</>
                            ) : (
                                <><span className="material-symbols-outlined text-[18px]">save</span>Registrar Bitácora</>
                            )}
                        </button>
                    </form>
                </div>

                {/* Recent Logs (History) */}
                {logs.length > 0 && (
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                            <span className="material-symbols-outlined text-sky-500 text-[22px]">history</span>
                            Historial de Bitácora
                        </h3>
                        <div className="space-y-4">
                            {logs.map(log => {
                                const statusColor = FUNCTIONALITY_STATUS_COLORS[log.functionality_status] || FUNCTIONALITY_STATUS_COLORS.normal;
                                return (
                                    <div key={log.id} className="rounded-xl border border-slate-100 p-4 transition-all hover:bg-slate-50/50">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${statusColor.bg}`}>
                                                    <span className={`material-symbols-outlined text-[20px] ${statusColor.text}`}>{statusColor.icon}</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900">
                                                        {new Date(log.log_date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                                        {log.recorded_by && <span>Por: {log.recorded_by}</span>}
                                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor.bg} ${statusColor.text}`}>
                                                            {FUNCTIONALITY_STATUS_LABELS[log.functionality_status]}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Readings */}
                                        {(log.static_level || log.dynamic_level || log.flow_rate || log.pressure || log.hours_operation) && (
                                            <div className="mt-3 flex flex-wrap gap-3 text-xs">
                                                {log.static_level != null && <span className="rounded-lg bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">NE: {log.static_level}m</span>}
                                                {log.dynamic_level != null && <span className="rounded-lg bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">ND: {log.dynamic_level}m</span>}
                                                {log.flow_rate != null && <span className="rounded-lg bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">Q: {log.flow_rate} L/s</span>}
                                                {log.pressure != null && <span className="rounded-lg bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">P: {log.pressure} PSI</span>}
                                                {log.hours_operation != null && <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{log.hours_operation} hrs</span>}
                                            </div>
                                        )}

                                        {log.observations && (
                                            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 italic">{log.observations}</p>
                                        )}

                                        {log.photos && (log.photos as unknown[]).length > 0 && (
                                            <div className="mt-3">
                                                <PhotoGallery photos={log.photos as PhotoAttachment[]} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <footer className="mt-8 text-center text-xs text-slate-400 pb-6">
                    <p>Bitácora gestionada por <strong className="text-slate-500">Núcleo de Ingeniería</strong></p>
                    <p className="mt-1">Perforación y mantenimiento de pozos de agua</p>
                </footer>
            </div>
        </div>
    );
}
