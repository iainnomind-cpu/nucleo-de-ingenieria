import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { WellInstallation, InstalledEquipment, EquipmentType, EQUIPMENT_TYPE_LABELS } from '../../types/maintenance';
import { useAuth } from '../../lib/AuthContext';

interface WellUninstallation extends Omit<WellInstallation, 'equipment'> {
    reason?: string;
    notes?: string;
    equipment?: InstalledEquipment[];
}

export default function UninstallationsTab() {
    const { user } = useAuth();
    const [records, setRecords] = useState<WellUninstallation[]>([]);
    const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [printId, setPrintId] = useState<string | null>(null);

    const [form, setForm] = useState<Partial<WellUninstallation>>({
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
        reason: '',
        notes: '',
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [res, cliRes] = await Promise.all([
            supabase.from('well_uninstallations')
                .select('*, client:clients(id, company_name)')
                .order('created_at', { ascending: false }),
            supabase.from('clients').select('id, company_name').order('company_name'),
        ]);
        setRecords((res.data as WellUninstallation[]) || []);
        setClients(cliRes.data || []);

        if (!form.folio && res.data) {
            const num = (res.data.length + 1).toString().padStart(4, '0');
            setForm(prev => ({ ...prev, folio: `D-${num}` }));
        }
        setLoading(false);
    }, [form.folio]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                folio: form.folio,
                uninstallation_date: form.installation_date,
                client_id: form.client_id || null,
                location: form.location,
                ademe_diameter: form.ademe_diameter,
                ademe_material: form.ademe_material,
                pipe_diameter: form.pipe_diameter,
                pipe_length: form.pipe_length,
                pipe_segments: form.pipe_segments,
                valv_check: form.valv_check,
                cable_gauge: form.cable_gauge,
                motor_hp: form.motor_hp,
                pump_model: form.pump_model,
                starter_system: form.starter_system,
                protection_type: form.protection_type,
                has_ground: form.has_ground,
                ground_location: form.ground_location,
                static_level: form.static_level,
                dynamic_level: form.dynamic_level,
                flow_rate: form.flow_rate,
                bottom_depth: form.bottom_depth,
                reason: form.reason,
                notes: form.notes,
            };

            if (editingId) {
                const { error } = await supabase.from('well_uninstallations').update(payload).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('well_uninstallations').insert([{ ...payload, created_by: user?.id }]);
                if (error) throw error;
            }
            setShowForm(false);
            setEditingId(null);
            resetForm();
            fetchData();
        } catch (error: any) {
            alert('Error al guardar desinstalación: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setForm({
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
            reason: '',
            notes: '',
        });
    };

    const handleEditClick = (rec: WellUninstallation) => {
        setEditingId(rec.id);
        setForm({
            folio: rec.folio,
            installation_date: rec.installation_date,
            client_id: rec.client_id || '',
            location: rec.location || '',
            ademe_diameter: rec.ademe_diameter || '',
            ademe_material: rec.ademe_material || '',
            pipe_diameter: rec.pipe_diameter || '',
            pipe_length: rec.pipe_length || '',
            pipe_segments: rec.pipe_segments || 0,
            valv_check: rec.valv_check || 0,
            cable_gauge: rec.cable_gauge || '',
            motor_hp: rec.motor_hp || '',
            pump_model: rec.pump_model || '',
            starter_system: rec.starter_system || '',
            protection_type: rec.protection_type || '',
            has_ground: rec.has_ground || false,
            ground_location: rec.ground_location || '',
            static_level: rec.static_level || 0,
            dynamic_level: rec.dynamic_level || 0,
            flow_rate: rec.flow_rate || 0,
            bottom_depth: rec.bottom_depth || 0,
            reason: rec.reason || '',
            notes: rec.notes || '',
        });
        setShowForm(true);
    };

    const handlePrint = (rec: WellUninstallation) => {
        setPrintId(rec.id);
        const client = clients.find(c => c.id === rec.client_id);
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Desinstalación ${rec.folio}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px; }
    h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
    h2 { font-size: 13px; background: #1e40af; color: #fff; padding: 4px 8px; margin: 12px 0 6px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
    .company { font-weight: bold; font-size: 13px; color: #1e40af; }
    .folio { font-size: 18px; font-weight: bold; color: #1e40af; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
    .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 16px; }
    .field { margin-bottom: 4px; }
    .field label { font-weight: bold; font-size: 9px; text-transform: uppercase; color: #555; display: block; }
    .field span { border-bottom: 1px solid #aaa; display: block; min-height: 18px; padding: 1px 2px; }
    @media print { body { padding: 10px; } button { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">NÚCLEO DE INGENIERÍA APLICADA</div>
      <div style="font-size:9px;color:#555;">Instalación, Mantenimiento Eléctrico, Asesoría de Proyectos<br/>Hidráulicos, Aforos, Pozos Profundos</div>
    </div>
    <div style="text-align:right">
      <div class="folio">${rec.folio || ''}</div>
      <div style="font-size:10px;color:#555;">FORMATO DE DESINSTALACIÓN</div>
    </div>
  </div>

  <div class="grid3" style="margin-bottom:10px;">
    <div class="field"><label>Fecha</label><span>${rec.installation_date || ''}</span></div>
    <div class="field"><label>Cliente</label><span>${client?.company_name || ''}</span></div>
    <div class="field"><label>Lugar / Pozo</label><span>${rec.location || ''}</span></div>
  </div>

  <div class="field" style="margin-bottom:10px;">
    <label>Motivo de Desinstalación</label><span>${rec.reason || ''}</span>
  </div>

  <h2>Pozo y Tubería</h2>
  <div class="grid3">
    <div class="field"><label>Diámetro Ademe</label><span>${rec.ademe_diameter || ''}</span></div>
    <div class="field"><label>Material Ademe</label><span>${rec.ademe_material || ''}</span></div>
    <div class="field"><label>Diámetro Tubería</label><span>${rec.pipe_diameter || ''}</span></div>
    <div class="field"><label>Long. Tubería</label><span>${rec.pipe_length || ''}</span></div>
    <div class="field"><label>No. Tramos</label><span>${rec.pipe_segments || ''}</span></div>
    <div class="field"><label>No. Valv. Check</label><span>${rec.valv_check || ''}</span></div>
    <div class="field"><label>Fondo (m)</label><span>${rec.bottom_depth || ''}</span></div>
    <div class="field"><label>Nivel Estático</label><span>${rec.static_level || ''}</span></div>
    <div class="field"><label>Nivel Dinámico</label><span>${rec.dynamic_level || ''}</span></div>
  </div>

  <h2>Datos Eléctricos y Motor</h2>
  <div class="grid3">
    <div class="field"><label>Pot. Motor (HP)</label><span>${rec.motor_hp || ''}</span></div>
    <div class="field"><label>Calibre Cable</label><span>${rec.cable_gauge || ''}</span></div>
    <div class="field"><label>Modelo Bomba</label><span>${rec.pump_model || ''}</span></div>
    <div class="field"><label>Sistema Arranque</label><span>${rec.starter_system || ''}</span></div>
    <div class="field"><label>Protección</label><span>${rec.protection_type || ''}</span></div>
    <div class="field"><label>Tierra Física</label><span>${rec.has_ground ? 'SÍ' : 'NO'}</span></div>
    <div class="field"><label>Lugar Aterrizaje</label><span>${rec.ground_location || ''}</span></div>
    <div class="field"><label>Gasto (LPS)</label><span>${rec.flow_rate || ''}</span></div>
  </div>

  ${rec.notes ? `<h2>Observaciones</h2><div class="field"><span>${rec.notes}</span></div>` : ''}

  <div style="margin-top: 40px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; text-align:center;">
    <div style="border-top:1px solid #000; padding-top:4px;">Encargado</div>
    <div style="border-top:1px solid #000; padding-top:4px;">Revisó</div>
    <div style="border-top:1px solid #000; padding-top:4px;">Autorizó / Cliente</div>
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`);
        printWindow.document.close();
        setPrintId(null);
    };

    const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white";
    const labelClass = "mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registro de Desinstalaciones</h2>
                    <p className="text-sm text-slate-500">Historial de formatos de desinstalación de equipos.</p>
                </div>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Nueva Desinstalación
                </button>
            </div>

            {loading ? (
                <div className="py-12 text-center text-slate-500">Cargando desinstalaciones...</div>
            ) : records.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="material-symbols-outlined mb-3 text-4xl text-slate-300">settings_backup_restore</span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sin Desinstalaciones</h3>
                    <p className="mt-1 text-sm text-slate-500">No hay formatos de desinstalación registrados aún.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {records.map(rec => (
                        <div key={rec.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="text-rose-500">{rec.folio}</span>
                                        <span>- {(rec as any).client?.company_name || 'Sin Cliente'}</span>
                                    </h3>
                                    <p className="text-sm text-slate-500">{rec.location}</p>
                                    {rec.reason && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Motivo: {rec.reason}</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
                                        {rec.installation_date}
                                    </span>
                                    <button onClick={() => handlePrint(rec)} disabled={printId === rec.id} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Imprimir">
                                        <span className="material-symbols-outlined text-[18px]">print</span>
                                    </button>
                                    <button onClick={() => handleEditClick(rec)} className="rounded-lg p-1.5 text-slate-400 hover:bg-primary/10 hover:text-primary" title="Editar">
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                                <div>
                                    <p className="text-xs text-slate-400">Motor / HP</p>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{rec.motor_hp || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">Tubería</p>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{rec.pipe_diameter || '-'} ({rec.pipe_segments}x)</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">Nivel Estático</p>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{rec.static_level ? `${rec.static_level} m` : '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">Gasto</p>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{rec.flow_rate ? `${rec.flow_rate} lps` : '-'}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Formulario */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl dark:bg-slate-900 my-8">
                        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-rose-500">settings_backup_restore</span>
                                {editingId ? 'Editar Desinstalación' : 'Nueva Desinstalación'}
                            </h2>
                            <button onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
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
                                <div className="sm:col-span-2">
                                    <label className={labelClass}>Lugar / Nombre del Pozo</label>
                                    <input type="text" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} className={inputClass} placeholder="Ej. Pozo La Llave 2" required />
                                </div>
                                <div>
                                    <label className={labelClass}>Motivo de Desinstalación</label>
                                    <input type="text" value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} className={inputClass} placeholder="Ej. Cambio de equipo" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 pt-6 dark:border-slate-800">
                                {/* Columna Izquierda */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 pb-2">Pozo y Tubería</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Diámetro Ademe</label><input type="text" value={form.ademe_diameter || ''} onChange={e => setForm({ ...form, ademe_diameter: e.target.value })} className={inputClass} placeholder='Ej. 10"'/></div>
                                        <div><label className={labelClass}>Material Ademe</label><input type="text" value={form.ademe_material || ''} onChange={e => setForm({ ...form, ademe_material: e.target.value })} className={inputClass} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Diámetro Tubería</label><input type="text" value={form.pipe_diameter || ''} onChange={e => setForm({ ...form, pipe_diameter: e.target.value })} className={inputClass} /></div>
                                        <div><label className={labelClass}>Long. Tubería</label><input type="text" value={form.pipe_length || ''} onChange={e => setForm({ ...form, pipe_length: e.target.value })} className={inputClass} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelClass}>No. Tramos</label><input type="number" value={form.pipe_segments || ''} onChange={e => setForm({ ...form, pipe_segments: parseInt(e.target.value) || 0 })} className={inputClass} /></div>
                                        <div><label className={labelClass}>No. Valv. Check</label><input type="number" value={form.valv_check || ''} onChange={e => setForm({ ...form, valv_check: parseInt(e.target.value) || 0 })} className={inputClass} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className={labelClass}>Fondo (m)</label><input type="number" step="0.1" value={form.bottom_depth || ''} onChange={e => setForm({ ...form, bottom_depth: parseFloat(e.target.value) || 0 })} className={inputClass} /></div>
                                        <div><label className={labelClass}>Gasto (LPS)</label><input type="number" step="0.1" value={form.flow_rate || ''} onChange={e => setForm({ ...form, flow_rate: parseFloat(e.target.value) || 0 })} className={inputClass} /></div>
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
                                        <div><label className={labelClass}>Pot. Motor (HP)</label><input type="text" value={form.motor_hp || ''} onChange={e => setForm({ ...form, motor_hp: e.target.value })} className={inputClass} /></div>
                                        <div><label className={labelClass}>Calibre Cable</label><input type="text" value={form.cable_gauge || ''} onChange={e => setForm({ ...form, cable_gauge: e.target.value })} className={inputClass} /></div>
                                    </div>
                                    <div><label className={labelClass}>Modelo de Bomba</label><input type="text" value={form.pump_model || ''} onChange={e => setForm({ ...form, pump_model: e.target.value })} className={inputClass} /></div>
                                    <div><label className={labelClass}>Sistema de Arranque</label><input type="text" value={form.starter_system || ''} onChange={e => setForm({ ...form, starter_system: e.target.value })} className={inputClass} /></div>
                                    <div><label className={labelClass}>Protección</label><input type="text" value={form.protection_type || ''} onChange={e => setForm({ ...form, protection_type: e.target.value })} className={inputClass} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>Tierra Física</label>
                                            <select value={form.has_ground ? 'yes' : 'no'} onChange={e => setForm({ ...form, has_ground: e.target.value === 'yes' })} className={inputClass}>
                                                <option value="yes">SÍ</option>
                                                <option value="no">NO</option>
                                            </select>
                                        </div>
                                        <div><label className={labelClass}>Lugar de Aterrizaje</label><input type="text" value={form.ground_location || ''} onChange={e => setForm({ ...form, ground_location: e.target.value })} className={inputClass} /></div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Observaciones / Notas</label>
                                        <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className={inputClass} />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                                <button type="submit" disabled={saving} className="rounded-lg bg-rose-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-rose-700">
                                    {saving ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Guardar Desinstalación')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
