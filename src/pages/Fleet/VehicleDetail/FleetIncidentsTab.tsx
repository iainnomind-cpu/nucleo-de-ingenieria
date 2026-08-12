import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/AuthContext';
import PhotoUploader, { PhotoGallery } from '../../../components/PhotoUploader';

interface FleetIncident {
    id: string;
    vehicle_id: string;
    incident_date: string;
    driver_name: string | null;
    location: string | null;
    description: string;
    severity: 'minor' | 'major' | 'total_loss';
    reported_to_insurance: boolean;
    insurance_claim_number: string | null;
    photos: any[];
    status: 'open' | 'resolved';
    resolution_notes: string | null;
}

const SEVERITY_LABELS = {
    minor: 'Leve',
    major: 'Grave',
    total_loss: 'Pérdida Total'
};

const SEVERITY_COLORS = {
    minor: 'bg-amber-100 text-amber-700',
    major: 'bg-orange-100 text-orange-700',
    total_loss: 'bg-red-100 text-red-700'
};

export default function FleetIncidentsTab({ vehicleId }: { vehicleId: string }) {
    const { hasPermission } = useAuth();
    const canEdit = hasPermission('fleet', 'edit');
    const canCreate = hasPermission('fleet', 'create');
    const canDelete = hasPermission('fleet', 'delete');

    const [incidents, setIncidents] = useState<FleetIncident[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<FleetIncident>>({
        incident_date: new Date().toISOString().split('T')[0],
        status: 'open',
        severity: 'minor',
        reported_to_insurance: false,
    });
    const [photos, setPhotos] = useState<any[]>([]);

    const fetchIncidents = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('fleet_incidents')
            .select('*')
            .eq('vehicle_id', vehicleId)
            .order('incident_date', { ascending: false });
        
        if (!error && data) {
            setIncidents(data as FleetIncident[]);
        }
        setLoading(false);
    }, [vehicleId]);

    useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...form,
            vehicle_id: vehicleId,
            photos: photos
        };

        if (editingId) {
            await supabase.from('fleet_incidents').update(payload).eq('id', editingId);
        } else {
            await supabase.from('fleet_incidents').insert(payload);
        }
        
        setShowForm(false);
        setForm({ incident_date: new Date().toISOString().split('T')[0], status: 'open', severity: 'minor', reported_to_insurance: false });
        setPhotos([]);
        setEditingId(null);
        fetchIncidents();
    };

    const handleEdit = (inc: FleetIncident) => {
        setForm({
            incident_date: inc.incident_date,
            driver_name: inc.driver_name,
            location: inc.location,
            description: inc.description,
            severity: inc.severity,
            reported_to_insurance: inc.reported_to_insurance,
            insurance_claim_number: inc.insurance_claim_number,
            status: inc.status,
            resolution_notes: inc.resolution_notes,
        });
        setPhotos(inc.photos || []);
        setEditingId(inc.id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar este incidente?')) return;
        await supabase.from('fleet_incidents').delete().eq('id', id);
        fetchIncidents();
    };

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';

    if (loading) return <div className="p-4 text-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" /></div>;

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2"><span className="material-symbols-outlined text-red-500">warning</span>Registro de Incidentes</h3>
                {canCreate && <button onClick={() => { setEditingId(null); setForm({ incident_date: new Date().toISOString().split('T')[0], status: 'open', severity: 'minor', reported_to_insurance: false }); setPhotos([]); setShowForm(true); }} className="flex items-center gap-2 rounded bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-3 py-1.5 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">add</span>Registrar Incidente
                </button>}
            </div>

            {showForm && (
                <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900/30 dark:bg-red-900/10">
                    <h4 className="mb-4 font-bold text-slate-900 dark:text-white">{editingId ? 'Editar Incidente' : 'Nuevo Incidente'}</h4>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className={labelClass}>Fecha del Incidente *</label><input type="date" required value={form.incident_date} onChange={e => setForm({...form, incident_date: e.target.value})} className={inputClass} /></div>
                            <div><label className={labelClass}>Estado *</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value as any})} className={inputClass}><option value="open">Abierto (En proceso)</option><option value="resolved">Resuelto</option></select></div>
                            <div><label className={labelClass}>Conductor</label><input type="text" value={form.driver_name || ''} onChange={e => setForm({...form, driver_name: e.target.value})} className={inputClass} placeholder="Nombre del conductor..." /></div>
                            <div><label className={labelClass}>Ubicación</label><input type="text" value={form.location || ''} onChange={e => setForm({...form, location: e.target.value})} className={inputClass} placeholder="Carretera, predio, etc..." /></div>
                            <div className="md:col-span-2"><label className={labelClass}>Descripción del Incidente *</label><textarea required value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} rows={3} className={inputClass + ' resize-none'} placeholder="Describe qué ocurrió..." /></div>
                            <div><label className={labelClass}>Severidad *</label><select value={form.severity} onChange={e => setForm({...form, severity: e.target.value as any})} className={inputClass}><option value="minor">Leve</option><option value="major">Grave</option><option value="total_loss">Pérdida Total</option></select></div>
                            <div className="flex items-center gap-2 self-end pb-2">
                                <input type="checkbox" id="rep_ins" checked={form.reported_to_insurance || false} onChange={e => setForm({...form, reported_to_insurance: e.target.checked})} className="rounded text-red-600 focus:ring-red-500" />
                                <label htmlFor="rep_ins" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Reportado al Seguro</label>
                            </div>
                            {form.reported_to_insurance && (
                                <div><label className={labelClass}>Número de Siniestro / Reporte</label><input type="text" value={form.insurance_claim_number || ''} onChange={e => setForm({...form, insurance_claim_number: e.target.value})} className={inputClass} placeholder="No. de siniestro..." /></div>
                            )}
                            {form.status === 'resolved' && (
                                <div className="md:col-span-2"><label className={labelClass}>Notas de Resolución</label><textarea value={form.resolution_notes || ''} onChange={e => setForm({...form, resolution_notes: e.target.value})} rows={2} className={inputClass + ' resize-none'} placeholder="Cómo se resolvió..." /></div>
                            )}
                            <div className="md:col-span-2">
                                <label className={labelClass}>Evidencia Fotográfica</label>
                                <PhotoUploader photos={photos} onChange={setPhotos} bucket="repairs" folder={`fleet_incidents/${vehicleId}`} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                            <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-700">Guardar Incidente</button>
                        </div>
                    </form>
                </div>
            )}

            {incidents.length === 0 ? <p className="text-sm text-slate-500">No hay incidentes reportados.</p> : (
                <div className="space-y-4">
                    {incidents.map(inc => (
                        <div key={inc.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <span className="font-bold text-slate-900 dark:text-white">{new Date(inc.incident_date + 'T12:00:00').toLocaleDateString('es-MX')}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${SEVERITY_COLORS[inc.severity]}`}>{SEVERITY_LABELS[inc.severity]}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inc.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{inc.status === 'resolved' ? 'Resuelto' : 'Abierto'}</span>
                                    </div>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">{inc.description}</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                        {inc.driver_name && <div><span className="text-slate-400 block mb-0.5">Conductor:</span><span className="font-medium text-slate-700 dark:text-slate-300">{inc.driver_name}</span></div>}
                                        {inc.location && <div><span className="text-slate-400 block mb-0.5">Lugar:</span><span className="font-medium text-slate-700 dark:text-slate-300">{inc.location}</span></div>}
                                        {inc.reported_to_insurance && <div><span className="text-slate-400 block mb-0.5">Seguro:</span><span className="font-medium text-indigo-600 font-mono">{inc.insurance_claim_number || 'Sin no. asignado'}</span></div>}
                                    </div>
                                    {inc.resolution_notes && (
                                        <div className="mt-3 bg-emerald-50 border border-emerald-100 p-3 rounded-lg dark:bg-emerald-900/10 dark:border-emerald-800/30">
                                            <span className="text-emerald-800 dark:text-emerald-400 font-bold text-xs block mb-1">Resolución:</span>
                                            <p className="text-sm text-emerald-700 dark:text-emerald-300">{inc.resolution_notes}</p>
                                        </div>
                                    )}
                                    {inc.photos?.length > 0 && (
                                        <div className="mt-4">
                                            <PhotoGallery photos={inc.photos} />
                                        </div>
                                    )}
                                </div>
                                {(canEdit || canDelete) && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        {canEdit && <button onClick={() => handleEdit(inc)} className="rounded p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Editar"><span className="material-symbols-outlined text-[18px]">edit</span></button>}
                                        {canDelete && <button onClick={() => handleDelete(inc.id)} className="rounded p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Eliminar"><span className="material-symbols-outlined text-[18px]">delete</span></button>}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
