import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { WellInstallation, InstalledEquipment, EquipmentType, EQUIPMENT_TYPE_LABELS } from '../../types/maintenance';
import { useAuth } from '../../lib/AuthContext';
import PhotoUploader, { PhotoGallery } from '../../components/PhotoUploader';
import { PhotoAttachment } from '../../types/photos';

export default function InstallationsTab() {
    const { user } = useAuth();
    const [installations, setInstallations] = useState<WellInstallation[]>([]);
    const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
    
    // Form state
    const [form, setForm] = useState<Partial<WellInstallation>>({
        folio: '',
        installation_date: new Date().toISOString().split('T')[0],
        client_id: '',
        location: '',
        ademe_diameter: '',
        ademe_material: '',
        pipe_diameter: '',
        pipe_length: '',
        pipe_segments: 0,
        valv_check: 0,
        cable_gauge: '',
        motor_hp: '',
        pump_model: '',
        starter_system: '',
        protection_type: '',
        has_ground: false,
        ground_location: '',
        static_level: 0,
        dynamic_level: 0,
        flow_rate: 0,
        bottom_depth: 0,
        observations: ''
    });

    const EMPTY_FORM: Partial<WellInstallation> = {
        folio: '',
        installation_date: new Date().toISOString().split('T')[0],
        client_id: '',
        location: '',
        ademe_diameter: '',
        ademe_material: '',
        pipe_diameter: '',
        pipe_length: '',
        pipe_segments: 0,
        valv_check: 0,
        cable_gauge: '',
        motor_hp: '',
        pump_model: '',
        starter_system: '',
        protection_type: '',
        has_ground: false,
        ground_location: '',
        static_level: 0,
        dynamic_level: 0,
        flow_rate: 0,
        bottom_depth: 0,
        observations: ''
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [instRes, cliRes] = await Promise.all([
            supabase.from('well_installations').select('*, client:clients(id, company_name), equipment:installed_equipment(*)').order('created_at', { ascending: false }),
            supabase.from('clients').select('id, company_name').order('company_name')
        ]);
        setInstallations(instRes.data || []);
        setClients(cliRes.data || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { client: _cl, equipment: _eq, ...cleanForm } = form as any;
            if (editingId) {
                const { error: instErr } = await supabase.from('well_installations').update({ ...cleanForm, photos }).eq('id', editingId);
                if (instErr) throw instErr;
            } else {
                const { error: instErr } = await supabase.from('well_installations').insert([{ ...cleanForm, photos, created_by: user?.id }]).select().single();
                if (instErr) throw instErr;
            }

            setShowForm(false);
            setEditingId(null);
            setForm(EMPTY_FORM);
            setPhotos([]);
            fetchData();
        } catch (error: any) {
            alert('Error al guardar maniobra: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar este registro de instalación?')) return;
        await supabase.from('well_installations').delete().eq('id', id);
        fetchData();
    };

    const handleEditClick = (inst: WellInstallation) => {
        setEditingId(inst.id);
        setForm({
            folio: inst.folio,
            installation_date: inst.installation_date,
            client_id: inst.client_id || '',
            location: inst.location || '',
            ademe_diameter: inst.ademe_diameter || '',
            ademe_material: inst.ademe_material || '',
            pipe_diameter: inst.pipe_diameter || '',
            pipe_length: inst.pipe_length || '',
            pipe_segments: inst.pipe_segments || 0,
            valv_check: inst.valv_check || 0,
            cable_gauge: inst.cable_gauge || '',
            motor_hp: inst.motor_hp || '',
            pump_model: inst.pump_model || '',
            starter_system: inst.starter_system || '',
            protection_type: inst.protection_type || '',
            has_ground: inst.has_ground || false,
            ground_location: inst.ground_location || '',
            static_level: inst.static_level || 0,
            dynamic_level: inst.dynamic_level || 0,
            flow_rate: inst.flow_rate || 0,
            bottom_depth: inst.bottom_depth || 0,
            observations: inst.observations || '',
        });

        setPhotos((inst as any).photos || []);
        setShowForm(true);
    };

    const handlePrint = (inst: WellInstallation) => {
        const clientName = inst.client?.company_name || 'Sin Cliente';
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const content = `<!DOCTYPE html><html><head><title>Instalación ${inst.folio || ''}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
                h1 { font-size: 20px; border-bottom: 2px solid #0066cc; padding-bottom: 8px; color: #0066cc; }
                .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                .header .folio { font-size: 24px; font-weight: bold; color: #0066cc; }
                .grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
                .field { background: #f8f9fa; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #0066cc; }
                .field .label { font-size: 10px; text-transform: uppercase; color: #888; font-weight: bold; letter-spacing: 0.5px; }
                .field .value { font-size: 14px; font-weight: 600; margin-top: 2px; }
                .obs { background: #fffbeb; padding: 12px; border-radius: 6px; border-left: 3px solid #f59e0b; margin-top: 12px; }
                .photos { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
                .photos img { width: 120px; height: 90px; object-fit: cover; border-radius: 6px; border: 1px solid #ddd; }
                @media print { body { padding: 15px; } }
            </style></head><body>
            <div class="header">
                <div><div class="folio">${inst.folio || 'S/F'}</div><div style="font-size:12px;color:#666">Formato de Maniobra / Instalación</div></div>
                <div style="text-align:right"><div style="font-weight:bold">${clientName}</div><div style="font-size:12px;color:#666">${inst.installation_date || ''}</div></div>
            </div>
            <h1>Datos Generales</h1>
            <div class="grid">
                <div class="field"><div class="label">Ubicación</div><div class="value">${inst.location || '-'}</div></div>
                <div class="field"><div class="label">Ademe Diámetro</div><div class="value">${inst.ademe_diameter || '-'}</div></div>
                <div class="field"><div class="label">Ademe Material</div><div class="value">${inst.ademe_material || '-'}</div></div>
                <div class="field"><div class="label">Motor / HP</div><div class="value">${inst.motor_hp || '-'}</div></div>
            </div>
            <h1>Tubería y Equipos</h1>
            <div class="grid">
                <div class="field"><div class="label">Diámetro Tubería</div><div class="value">${inst.pipe_diameter || '-'}</div></div>
                <div class="field"><div class="label">Longitud</div><div class="value">${inst.pipe_length || '-'}</div></div>
                <div class="field"><div class="label">Tramos</div><div class="value">${inst.pipe_segments || '-'}</div></div>
                <div class="field"><div class="label">Válvula Check</div><div class="value">${inst.valv_check || '-'}</div></div>
                <div class="field"><div class="label">Calibre Cable</div><div class="value">${inst.cable_gauge || '-'}</div></div>
                <div class="field"><div class="label">Modelo Bomba</div><div class="value">${inst.pump_model || '-'}</div></div>
                <div class="field"><div class="label">Sist. Arranque</div><div class="value">${inst.starter_system || '-'}</div></div>
                <div class="field"><div class="label">Protección</div><div class="value">${inst.protection_type || '-'}</div></div>
            </div>
            <h1>Niveles y Mediciones</h1>
            <div class="grid">
                <div class="field"><div class="label">Nivel Estático</div><div class="value">${inst.static_level ? inst.static_level + ' m' : '-'}</div></div>
                <div class="field"><div class="label">Nivel Dinámico</div><div class="value">${inst.dynamic_level ? inst.dynamic_level + ' m' : '-'}</div></div>
                <div class="field"><div class="label">Gasto</div><div class="value">${inst.flow_rate ? inst.flow_rate + ' lps' : '-'}</div></div>
                <div class="field"><div class="label">Prof. Fondo</div><div class="value">${inst.bottom_depth ? inst.bottom_depth + ' m' : '-'}</div></div>
                <div class="field"><div class="label">Tierra Física</div><div class="value">${inst.has_ground ? 'Sí' : 'No'} ${inst.ground_location ? '(' + inst.ground_location + ')' : ''}</div></div>
            </div>
            ${inst.observations ? `<div class="obs"><strong>Observaciones:</strong> ${inst.observations}</div>` : ''}
            ${(inst as any).photos && (inst as any).photos.length > 0 ? `<h1>Fotografías</h1><div class="photos">${(inst as any).photos.map((p: any) => `<img src="${p.url}" />`).join('')}</div>` : ''}
        </body></html>`;
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    };

    const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white";
    const labelClass = "mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registro de Maniobras / Instalaciones</h2>
                    <p className="text-sm text-slate-500">Historial de formatos de maniobras y equipos vinculados.</p>
                </div>
                <button onClick={() => { 
                    const num = (installations.length + 1).toString().padStart(4, '0');
                    setForm({ ...EMPTY_FORM, folio: `INS-${num}` }); 
                    setPhotos([]); 
                    setEditingId(null); 
                    setShowForm(true); 
                }} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Nueva Instalación
                </button>
            </div>

            {loading ? (
                <div className="py-12 text-center text-slate-500">Cargando instalaciones...</div>
            ) : installations.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="material-symbols-outlined mb-3 text-4xl text-slate-300">plumbing</span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sin Maniobras</h3>
                    <p className="mt-1 text-sm text-slate-500">No hay formatos de maniobras registrados aún.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {installations.map(inst => (
                        <div key={inst.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="text-primary">{inst.folio}</span>
                                        <span>- {inst.client?.company_name || 'Sin Cliente'}</span>
                                    </h3>
                                    <p className="text-sm text-slate-500">{inst.location}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        {inst.installation_date}
                                    </span>
                                    <button onClick={() => handlePrint(inst)} className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-500" title="Imprimir">
                                        <span className="material-symbols-outlined text-[18px]">print</span>
                                    </button>
                                    <button onClick={() => handleEditClick(inst)} className="rounded-lg p-1.5 text-slate-400 hover:bg-primary/10 hover:text-primary" title="Editar instalación">
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button onClick={() => handleDelete(inst.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Eliminar">
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                                <div>
                                    <p className="text-xs text-slate-400">Motor / HP</p>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{inst.motor_hp || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">Tubería</p>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{inst.pipe_diameter || '-'} ({inst.pipe_segments}x)</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">Nivel Estático</p>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{inst.static_level ? `${inst.static_level} m` : '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">Gasto</p>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{inst.flow_rate ? `${inst.flow_rate} lps` : '-'}</p>
                                </div>
                            </div>
                            
                            {inst.observations && (
                                <div className="mt-3 rounded bg-amber-50 p-2 dark:bg-amber-900/10">
                                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-500">Observaciones</p>
                                    <p className="text-sm text-slate-700 dark:text-slate-300">{inst.observations}</p>
                                </div>
                            )}
                            
                            {inst.equipment && inst.equipment.length > 0 && (
                                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                                    <p className="mb-2 text-xs font-semibold text-slate-500">Equipos Instalados:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {inst.equipment.map(eq => (
                                            <span key={eq.id} className="flex items-center gap-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                <span className="font-medium text-primary">{EQUIPMENT_TYPE_LABELS[eq.equipment_type]}</span>
                                                {eq.brand ? ` - ${eq.brand}` : ''}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {(inst as any).photos && (inst as any).photos.length > 0 && (
                                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                                    <PhotoGallery photos={(inst as any).photos} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Formulario */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl dark:bg-slate-900 my-8">
                        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {editingId ? 'Editar Maniobra / Instalación' : 'Formato de Maniobras'}
                            </h2>
                            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div>
                                    <label className={labelClass}>Folio</label>
                                    <input type="text" value={form.folio} onChange={e => setForm({ ...form, folio: e.target.value })} className={inputClass} required />
                                </div>
                                <div>
                                    <label className={labelClass}>Fecha</label>
                                    <input type="date" value={form.installation_date} onChange={e => setForm({ ...form, installation_date: e.target.value })} className={inputClass} required />
                                </div>
                                <div>
                                    <label className={labelClass}>Cliente</label>
                                    <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className={inputClass}>
                                        <option value="">Seleccionar Cliente...</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                                    </select>
                                </div>
                                <div className="sm:col-span-3">
                                    <label className={labelClass}>Lugar / Nombre del Pozo</label>
                                    <input type="text" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} className={inputClass} placeholder="Ej. Agricola El Fresnito" required />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 pt-6 dark:border-slate-800">
                                {/* Columna Izquierda */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 pb-2">Pozo y Tubería</h3>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Diámetro Ademe</label><input type="text" value={form.ademe_diameter || ''} onChange={e => setForm({ ...form, ademe_diameter: e.target.value })} className={inputClass} placeholder='Ej. 10"'/></div>
                                        <div><label className={labelClass}>Material Ademe</label><input type="text" value={form.ademe_material || ''} onChange={e => setForm({ ...form, ademe_material: e.target.value })} className={inputClass} placeholder='Ej. Metal'/></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Diámetro Tubería</label><input type="text" value={form.pipe_diameter || ''} onChange={e => setForm({ ...form, pipe_diameter: e.target.value })} className={inputClass} placeholder='Ej. 4"'/></div>
                                        <div><label className={labelClass}>Long. Tubería</label><input type="text" value={form.pipe_length || ''} onChange={e => setForm({ ...form, pipe_length: e.target.value })} className={inputClass} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelClass}>No. Tramos</label><input type="number" value={form.pipe_segments || ''} onChange={e => setForm({ ...form, pipe_segments: parseInt(e.target.value) || 0 })} className={inputClass} /></div>
                                        <div><label className={labelClass}>No. Valv. Check</label><input type="number" value={form.valv_check || ''} onChange={e => setForm({ ...form, valv_check: parseInt(e.target.value) || 0 })} className={inputClass} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Fondo (m)</label><input type="number" step="0.1" value={form.bottom_depth || ''} onChange={e => setForm({ ...form, bottom_depth: parseFloat(e.target.value) || 0 })} className={inputClass} /></div>
                                        <div><label className={labelClass}>Gasto (LPS/GPM)</label><input type="number" step="0.1" value={form.flow_rate || ''} onChange={e => setForm({ ...form, flow_rate: parseFloat(e.target.value) || 0 })} className={inputClass} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Nivel Estático</label><input type="number" step="0.1" value={form.static_level || ''} onChange={e => setForm({ ...form, static_level: parseFloat(e.target.value) || 0 })} className={inputClass} /></div>
                                        <div><label className={labelClass}>Nivel Dinámico</label><input type="number" step="0.1" value={form.dynamic_level || ''} onChange={e => setForm({ ...form, dynamic_level: parseFloat(e.target.value) || 0 })} className={inputClass} /></div>
                                    </div>
                                </div>

                                {/* Columna Derecha */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 pb-2">Datos Eléctricos y Motor</h3>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Pot. Motor (HP)</label><input type="text" value={form.motor_hp || ''} onChange={e => setForm({ ...form, motor_hp: e.target.value })} className={inputClass} placeholder='Ej. 100 HP'/></div>
                                        <div><label className={labelClass}>Calibre Cable</label><input type="text" value={form.cable_gauge || ''} onChange={e => setForm({ ...form, cable_gauge: e.target.value })} className={inputClass} /></div>
                                    </div>
                                    <div><label className={labelClass}>Modelo de Bomba</label><input type="text" value={form.pump_model || ''} onChange={e => setForm({ ...form, pump_model: e.target.value })} className={inputClass} /></div>
                                    
                                    <div>
                                        <label className={labelClass}>Sistema de Arranque</label>
                                        <input type="text" value={form.starter_system || ''} onChange={e => setForm({ ...form, starter_system: e.target.value })} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Protección</label>
                                        <input type="text" value={form.protection_type || ''} onChange={e => setForm({ ...form, protection_type: e.target.value })} className={inputClass} />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>Tierra Física</label>
                                            <select value={form.has_ground ? 'yes' : 'no'} onChange={e => setForm({ ...form, has_ground: e.target.value === 'yes' })} className={inputClass}>
                                                <option value="yes">SÍ</option>
                                                <option value="no">NO</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Lugar de Aterrizaje</label>
                                            <input type="text" value={form.ground_location || ''} onChange={e => setForm({ ...form, ground_location: e.target.value })} className={inputClass} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Observaciones Generales */}
                            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                                <label className={labelClass}>Observaciones Generales</label>
                                <textarea 
                                    value={form.observations || ''} 
                                    onChange={e => setForm({ ...form, observations: e.target.value })} 
                                    className={inputClass} 
                                    rows={2} 
                                    placeholder="Detalles o notas adicionales sobre la instalación o maniobra..." 
                                />
                            </div>
                            
                            {/* Tramo Extra (Manual) */}
                            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
                                <h3 className="font-bold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">straighten</span>
                                    Tramo Extra Manual
                                </h3>
                                <p className="text-xs text-slate-500 mb-3">Para tramos especiales como cabezal u otros que miden menos que un tramo estándar.</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Descripción del Tramo Extra</label>
                                        <input type="text" value={(form as any).extra_pipe_desc || ''} onChange={e => setForm({ ...form, extra_pipe_desc: e.target.value } as any)} className={inputClass} placeholder="Ej. Cabezal, tramo reducido..." />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Longitud Extra (m)</label>
                                        <input type="number" step="0.01" value={(form as any).extra_pipe_length || ''} onChange={e => setForm({ ...form, extra_pipe_length: e.target.value } as any)} className={inputClass} placeholder="Ej. 0.60" />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                                <label className={labelClass}>Fotografías de la Instalación</label>
                                <PhotoUploader photos={photos} onPhotosChange={setPhotos} folder={`installations/${editingId || 'new-' + Date.now()}`} uploaderName={user?.full_name || 'Técnico'} />
                            </div>

                            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setPhotos([]); }} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-primary-dark">
                                    {saving ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Guardar Maniobra')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
