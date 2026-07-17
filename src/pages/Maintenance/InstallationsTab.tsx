import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { WellInstallation, InstalledEquipment, EquipmentType, EQUIPMENT_TYPE_LABELS } from '../../types/maintenance';
import { useAuth } from '../../lib/AuthContext';

export default function InstallationsTab() {
    const { user } = useAuth();
    const [installations, setInstallations] = useState<WellInstallation[]>([]);
    const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    
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
        bottom_depth: 0
    });

    // Associated equipment state for the new installation
    const [formEquipment, setFormEquipment] = useState<Partial<InstalledEquipment>[]>([
        { name: 'Bomba Principal', equipment_type: 'bomba', brand: '', model: '' }
    ]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [instRes, cliRes] = await Promise.all([
            supabase.from('well_installations').select('*, client:clients(id, company_name), equipment:installed_equipment(*)').order('created_at', { ascending: false }),
            supabase.from('clients').select('id, company_name').order('company_name')
        ]);
        setInstallations(instRes.data || []);
        setClients(cliRes.data || []);
        
        // Auto-generate folio if none exists
        if (!form.folio && instRes.data) {
            const num = (instRes.data.length + 1).toString().padStart(4, '0');
            setForm(prev => ({ ...prev, folio: `No. ${num}` }));
        }
        
        setLoading(false);
    }, [form.folio]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Insert installation
            const { data: newInst, error: instErr } = await supabase.from('well_installations').insert([{
                ...form,
                created_by: user?.id
            }]).select().single();
            
            if (instErr) throw instErr;

            // Insert associated equipment
            if (newInst && formEquipment.length > 0) {
                const equipmentToInsert = formEquipment.map(eq => ({
                    client_id: form.client_id || null,
                    name: eq.name || 'Equipo',
                    equipment_type: eq.equipment_type || 'otro',
                    brand: eq.brand || null,
                    model: eq.model || null,
                    serial_number: eq.serial_number || null,
                    well_name: form.location || null, // Assuming location is well name
                    installation_date: form.installation_date,
                    location: form.location || null,
                    status: 'active',
                    installation_id: newInst.id
                }));
                const { error: eqErr } = await supabase.from('installed_equipment').insert(equipmentToInsert);
                if (eqErr) throw eqErr;
            }

            setShowForm(false);
            fetchData();
        } catch (error: any) {
            alert('Error al guardar maniobra: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const addEquipmentField = () => {
        setFormEquipment([...formEquipment, { name: '', equipment_type: 'motor', brand: '', model: '' }]);
    };
    
    const updateEquipmentField = (index: number, field: string, value: string) => {
        const updated = [...formEquipment];
        updated[index] = { ...updated[index], [field]: value };
        setFormEquipment(updated);
    };
    
    const removeEquipmentField = (index: number) => {
        setFormEquipment(formEquipment.filter((_, i) => i !== index));
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
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
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
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {inst.installation_date}
                                </span>
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
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Formulario */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl dark:bg-slate-900 my-8">
                        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Formato de Maniobras</h2>
                            <button onClick={() => setShowForm(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
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
                            
                            {/* Equipos Section */}
                            <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="font-bold text-primary">Equipos Vinculados (+EQUIPO)</h3>
                                        <p className="text-xs text-slate-500">Agrega los equipos (motor, bomba, arrancador) que pertenecen a esta instalación para que queden registrados en el inventario general.</p>
                                    </div>
                                    <button type="button" onClick={addEquipmentField} className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-primary shadow-sm border border-primary/20 hover:bg-primary hover:text-white transition-colors">
                                        + Agregar Equipo
                                    </button>
                                </div>
                                
                                <div className="space-y-3">
                                    {formEquipment.map((eq, i) => (
                                        <div key={i} className="flex flex-col sm:flex-row gap-3 items-center bg-white p-3 rounded-lg border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                                            <div className="flex-1 min-w-[150px]">
                                                <input type="text" placeholder="Nombre (ej. Motor Principal)" value={eq.name} onChange={e => updateEquipmentField(i, 'name', e.target.value)} className={inputClass} required />
                                            </div>
                                            <div className="flex-1 min-w-[150px]">
                                                <select value={eq.equipment_type} onChange={e => updateEquipmentField(i, 'equipment_type', e.target.value)} className={inputClass}>
                                                    {Object.entries(EQUIPMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex-1 min-w-[100px]">
                                                <input type="text" placeholder="Marca" value={eq.brand || ''} onChange={e => updateEquipmentField(i, 'brand', e.target.value)} className={inputClass} />
                                            </div>
                                            <button type="button" onClick={() => removeEquipmentField(i)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg">
                                                <span className="material-symbols-outlined text-[20px]">delete</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-primary-dark">
                                    {saving ? 'Guardando...' : 'Guardar Maniobra e Inventario'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
