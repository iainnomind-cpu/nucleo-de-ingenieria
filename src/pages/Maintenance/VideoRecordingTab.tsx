import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { VideoRecording, InstalledEquipment } from '../../types/maintenance';
import PhotoUploader, { PhotoGallery } from '../../components/PhotoUploader';
import { PhotoAttachment } from '../../types/photos';

const emptyForm = {
    id: '',
    equipment_id: '',
    recording_date: new Date().toISOString().split('T')[0],
    recorded_by: '',
    grid_depth: '',
    static_level: '',
    bottom_depth: '',
    casing_observations: '',
    video_url: '',
    ademe_material: '',
    ademe_diameter: '',
    slot_type: '',
    photos: [] as any[],
};

type VideoForm = typeof emptyForm;

export default function VideoRecordingTab() {
    const [videos, setVideos] = useState<(VideoRecording & { equipment?: InstalledEquipment })[]>([]);
    const [equipment, setEquipment] = useState<InstalledEquipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [filterEquip, setFilterEquip] = useState('');
    const [form, setForm] = useState<VideoForm>(emptyForm);
    const [photos, setPhotos] = useState<PhotoAttachment[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [vRes, eRes] = await Promise.all([
            supabase
                .from('video_recordings')
                .select('*, equipment:installed_equipment(id, name, well_name, equipment_type, client:clients(company_name))')
                .order('recording_date', { ascending: false }),
            supabase
                .from('installed_equipment')
                .select('id, name, well_name, equipment_type, client:clients(company_name)')
                .order('name'),
        ]);
        setVideos((vRes.data as any[]) || []);
        setEquipment((eRes.data as InstalledEquipment[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                equipment_id: form.equipment_id || null,
                recording_date: form.recording_date,
                recorded_by: form.recorded_by || null,
                grid_depth: form.grid_depth ? parseFloat(form.grid_depth) : null,
                static_level: form.static_level ? parseFloat(form.static_level) : null,
                bottom_depth: form.bottom_depth ? parseFloat(form.bottom_depth) : null,
                casing_observations: form.casing_observations || null,
                video_url: form.video_url || null,
                ademe_material: form.ademe_material || null,
                ademe_diameter: form.ademe_diameter || null,
                slot_type: form.slot_type || null,
                photos,
            };

            if (form.id) {
                const { error } = await supabase.from('video_recordings').update(payload).eq('id', form.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('video_recordings').insert(payload);
                if (error) throw error;
            }

            setShowForm(false);
            setForm(emptyForm);
            setPhotos([]);
            fetchData();
        } catch (err: any) {
            alert('Error al guardar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (v: VideoRecording) => {
        setForm({
            id: v.id,
            equipment_id: v.equipment_id || '',
            recording_date: v.recording_date,
            recorded_by: v.recorded_by || '',
            grid_depth: v.grid_depth?.toString() || '',
            static_level: v.static_level?.toString() || '',
            bottom_depth: v.bottom_depth?.toString() || '',
            casing_observations: v.casing_observations || '',
            video_url: v.video_url || '',
            ademe_material: v.ademe_material || '',
            ademe_diameter: v.ademe_diameter || '',
            slot_type: v.slot_type || '',
        });
        setPhotos((v as any).photos || []);
        setShowForm(true);
    };

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    const filteredVideos = filterEquip ? videos.filter(v => v.equipment_id === filterEquip) : videos;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Videograbación</h2>
                    <p className="text-sm text-slate-500">Registros de videograbación de pozos y equipos.</p>
                </div>
                <div className="flex gap-2">
                    <select
                        value={filterEquip}
                        onChange={e => setFilterEquip(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                        <option value="">Todos los equipos</option>
                        {equipment.map(eq => (
                            <option key={eq.id} value={eq.id}>
                                {eq.well_name ? `${eq.well_name} — ` : ''}{eq.name}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => { setForm(emptyForm); setShowForm(true); }}
                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-sm font-semibold text-white shadow-md"
                    >
                        <span className="material-symbols-outlined text-[18px]">videocam</span>
                        Nuevo Registro
                    </button>
                </div>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-primary text-[22px]">videocam</span>
                                {form.id ? 'Editar Videograbación' : 'Nuevo Registro de Videograbación'}
                            </h3>
                            <button onClick={() => setShowForm(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Equipo / Pozo</label>
                                    <select value={form.equipment_id} onChange={e => setForm({ ...form, equipment_id: e.target.value })} className={inputClass}>
                                        <option value="">Sin equipo / General</option>
                                        {equipment.map(eq => (
                                            <option key={eq.id} value={eq.id}>
                                                {eq.well_name ? `${eq.well_name} — ` : ''}{eq.name} {(eq as any).client?.company_name ? `(${(eq as any).client.company_name})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Fecha de Grabación *</label>
                                    <input type="date" value={form.recording_date} onChange={e => setForm({ ...form, recording_date: e.target.value })} required className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Registrado por</label>
                                    <input value={form.recorded_by} onChange={e => setForm({ ...form, recorded_by: e.target.value })} placeholder="Nombre del operador" className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Material Ademe</label>
                                    <input value={form.ademe_material} onChange={e => setForm({ ...form, ademe_material: e.target.value })} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Diámetro Ademe</label>
                                    <input value={form.ademe_diameter} onChange={e => setForm({ ...form, ademe_diameter: e.target.value })} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Tipo de Ranuras</label>
                                    <input value={form.slot_type} onChange={e => setForm({ ...form, slot_type: e.target.value })} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Prof. Inicial Rejillas (m)</label>
                                    <input type="number" step="0.01" value={form.grid_depth} onChange={e => setForm({ ...form, grid_depth: e.target.value })} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Nivel Estático (m)</label>
                                    <input type="number" step="0.01" value={form.static_level} onChange={e => setForm({ ...form, static_level: e.target.value })} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Prof. Fondo Grabado (m)</label>
                                    <input type="number" step="0.01" value={form.bottom_depth} onChange={e => setForm({ ...form, bottom_depth: e.target.value })} className={inputClass} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelClass}>URL del Video</label>
                                    <input type="url" value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} placeholder="https://youtube.com/..." className={inputClass} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Observaciones Estructurales (Ademe)</label>
                                    <textarea value={form.casing_observations} onChange={e => setForm({ ...form, casing_observations: e.target.value })} rows={3} className={inputClass + ' resize-none'} placeholder="Estado de las rejillas, corrosión, incrustaciones..." />
                                </div>
                            </div>

                            <div className="md:col-span-2 mt-4">
                                <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Fotografías / Imágenes del Videoregistro</label>
                                <PhotoUploader photos={photos} onPhotosChange={setPhotos} folder={`video-recordings/${form.equipment_id || 'new'}`} uploaderName={form.recorded_by || 'Técnico'} />
                            </div>

                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Cancelar</button>
                                <button type="submit" disabled={saving} className="rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-90">
                                    {saving ? 'Guardando...' : (form.id ? 'Guardar Cambios' : 'Guardar Registro')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="py-12 text-center text-slate-500">Cargando registros...</div>
            ) : filteredVideos.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="material-symbols-outlined mb-3 text-4xl text-slate-300">videocam_off</span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sin Registros</h3>
                    <p className="mt-1 text-sm text-slate-500">No hay videograbaciones registradas aún.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredVideos.map(v => {
                        const eq = v.equipment as any;
                        return (
                            <div key={v.id} className="rounded-xl border border-slate-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/30">
                                        <span className="material-symbols-outlined text-sky-600 text-[24px]">videocam</span>
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="font-bold text-sm text-slate-900 dark:text-white">
                                                    {new Date(v.recording_date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                                                    {eq?.well_name && <span>{eq.well_name}</span>}
                                                    {eq?.name && <><span>·</span><span className="font-medium text-slate-600 dark:text-slate-300">{eq.name}</span></>}
                                                    {eq?.client?.company_name && <><span>·</span><span>{eq.client.company_name}</span></>}
                                                    {v.recorded_by && <><span>·</span><span>Operador: {v.recorded_by}</span></>}
                                                </div>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleEdit(v)}
                                                    className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">edit</span>Editar
                                                </button>
                                                {v.video_url && (
                                                    <a href={v.video_url} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-600 hover:bg-sky-100 dark:bg-sky-900/20 dark:text-sky-400">
                                                        <span className="material-symbols-outlined text-[14px]">play_circle</span>Ver Video
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
                                            <div><span className="block text-slate-400">Material Ademe</span><span className="font-semibold text-slate-900 dark:text-white">{v.ademe_material || '—'}</span></div>
                                            <div><span className="block text-slate-400">Diám. Ademe</span><span className="font-semibold text-slate-900 dark:text-white">{v.ademe_diameter || '—'}</span></div>
                                            <div><span className="block text-slate-400">Tipo Ranuras</span><span className="font-semibold text-slate-900 dark:text-white">{v.slot_type || '—'}</span></div>
                                            <div><span className="block text-slate-400">Prof. Rejillas</span><span className="font-semibold text-slate-900 dark:text-white">{v.grid_depth != null ? `${v.grid_depth}m` : '—'}</span></div>
                                            <div><span className="block text-slate-400">Nivel Estático</span><span className="font-semibold text-slate-900 dark:text-white">{v.static_level != null ? `${v.static_level}m` : '—'}</span></div>
                                            <div><span className="block text-slate-400">Prof. Fondo</span><span className="font-semibold text-slate-900 dark:text-white">{v.bottom_depth != null ? `${v.bottom_depth}m` : '—'}</span></div>
                                        </div>

                                        {v.casing_observations && (
                                            <div className="rounded-lg border border-amber-200/50 bg-amber-50/50 p-3 text-xs dark:border-amber-900/30 dark:bg-amber-900/10">
                                                <span className="font-semibold text-amber-700 block mb-1">Observaciones del Ademe</span>
                                                <p className="text-amber-900/80 dark:text-amber-200/80">{v.casing_observations}</p>
                                            </div>
                                        )}

                                        {(v as any).photos && (v as any).photos.length > 0 && (
                                            <div className="mt-3">
                                                <PhotoGallery photos={(v as any).photos} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
