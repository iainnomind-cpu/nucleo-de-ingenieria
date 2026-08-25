import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';

interface AforoRecord {
    id: string;
    folio?: string;
    client_id?: string;
    location?: string;
    duration_hours: 24 | 48;
    pump_brand?: string;
    pump_model?: string;
    pump_diameter?: string;
    impeller_model?: string;
    suction_pipe?: string;
    total_column_length?: string;
    motor_info?: string;
    flow_method?: string;
    well_total_depth?: string;
    well_pipe_diameter?: string;
    well_pipe_use_length?: string;
    well_ademe_length?: string;
    well_annular_length?: string;
    well_gravel_filter_length?: string;
    well_cement_diameter?: string;
    hydrostatic_level?: string;
    drilled_by?: string;
    start_datetime?: string;
    aforo_formula?: string;
    observations?: string;
    client?: { id: string; company_name: string };
    measurements?: AforoMeasurement[];
    created_at?: string;
}

interface AforoMeasurement {
    id?: string;
    aforo_id?: string;
    row_index: number;
    day_label?: string;
    hour_label?: string;
    dynamic_level?: string;
    pump_rpm?: string;
    amp_reading?: string;
    flow_lps?: string;
    nozzle?: string;
    observations?: string;
}

const EMPTY_FORM: Omit<AforoRecord, 'id'> = {
    folio: '',
    client_id: '',
    location: '',
    duration_hours: 24,
    pump_brand: '',
    pump_model: '',
    pump_diameter: '',
    impeller_model: '',
    suction_pipe: '',
    total_column_length: '',
    motor_info: '',
    flow_method: '',
    well_total_depth: '',
    well_pipe_diameter: '',
    well_pipe_use_length: '',
    well_ademe_length: '',
    well_annular_length: '',
    well_gravel_filter_length: '',
    well_cement_diameter: '',
    hydrostatic_level: '',
    drilled_by: '',
    start_datetime: '',
    aforo_formula: '',
    observations: '',
};

function makeEmptyMeasurements(count: number): AforoMeasurement[] {
    return Array.from({ length: count }, (_, i) => ({
        row_index: i,
        day_label: '', hour_label: '', dynamic_level: '',
        pump_rpm: '', amp_reading: '', flow_lps: '', nozzle: '', observations: '',
    }));
}

export default function AforoTab() {
    const { user } = useAuth();
    const [records, setRecords] = useState<AforoRecord[]>([]);
    const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<Omit<AforoRecord, 'id'>>(EMPTY_FORM);
    const [measurements, setMeasurements] = useState<AforoMeasurement[]>(makeEmptyMeasurements(24));

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [recRes, cliRes] = await Promise.all([
            supabase.from('aforo_records').select('*, client:clients(id, company_name), measurements:aforo_measurements(*)').order('created_at', { ascending: false }),
            supabase.from('clients').select('id, company_name').order('company_name'),
        ]);
        setRecords((recRes.data as AforoRecord[]) || []);
        setClients(cliRes.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDurationChange = (hours: 24 | 48) => {
        const rowCount = hours === 24 ? 24 : 48;
        setForm(f => ({ ...f, duration_hours: hours }));
        setMeasurements(prev => {
            const next = makeEmptyMeasurements(rowCount);
            prev.slice(0, rowCount).forEach((m, i) => { next[i] = { ...next[i], ...m }; });
            return next;
        });
    };

    const updateMeasurement = (index: number, field: keyof AforoMeasurement, value: string) => {
        setMeasurements(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            let recordId = editingId;
            const { created_by: _cb, ...formWithoutCreatedBy } = form as any;
            const payload = { ...formWithoutCreatedBy, client_id: form.client_id || null };

            if (editingId) {
                const { error } = await supabase.from('aforo_records').update(payload).eq('id', editingId);
                if (error) throw error;
                await supabase.from('aforo_measurements').delete().eq('aforo_id', editingId);
            } else {
                const { data, error } = await supabase.from('aforo_records').insert([{ ...payload, ...(user?.id ? { created_by: user.id } : {}) }]).select().single();
                if (error) throw error;
                recordId = data.id;
            }

            const measToInsert = measurements
                .filter(m => m.day_label || m.hour_label || m.dynamic_level || m.flow_lps)
                .map(m => {
                    const { id, ...rest } = m;
                    return { ...rest, aforo_id: recordId };
                });
            if (measToInsert.length > 0) {
                const { error: measErr } = await supabase.from('aforo_measurements').insert(measToInsert);
                if (measErr) throw measErr;
            }

            setShowForm(false);
            setEditingId(null);
            setForm(EMPTY_FORM);
            setMeasurements(makeEmptyMeasurements(24));
            fetchData();
        } catch (err: any) {
            alert('Error al guardar aforo: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEditClick = (rec: AforoRecord) => {
        setEditingId(rec.id);
        setForm({ ...EMPTY_FORM, ...rec, client_id: rec.client_id || '' });
        const rowCount = rec.duration_hours === 24 ? 24 : 48;
        const base = makeEmptyMeasurements(rowCount);
        if (rec.measurements) {
            rec.measurements.sort((a, b) => a.row_index - b.row_index).forEach(m => {
                if (m.row_index < rowCount) base[m.row_index] = { ...base[m.row_index], ...m };
            });
        }
        setMeasurements(base);
        setShowForm(true);
    };

    const handlePrint = (rec: AforoRecord) => {
        const client = clients.find(c => c.id === rec.client_id);
        const meas = rec.measurements || [];
        meas.sort((a, b) => a.row_index - b.row_index);

        const rows = meas.map(m => `
            <tr>
                <td>${m.day_label || ''}</td>
                <td>${m.hour_label || ''}</td>
                <td>${m.dynamic_level || ''}</td>
                <td>${m.pump_rpm || ''}</td>
                <td>${m.amp_reading || ''}</td>
                <td>${m.flow_lps || ''}</td>
                <td>${m.nozzle || ''}</td>
                <td>${m.observations || ''}</td>
            </tr>`).join('');

        const pw = window.open('', '_blank');
        if (!pw) return;
        pw.document.write(`<!DOCTYPE html><html><head>
<meta charset="UTF-8"/>
<title>Aforo ${rec.folio || rec.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; padding: 15px; }
  h1 { font-size: 14px; text-align: center; margin-bottom: 2px; }
  h2 { font-size: 11px; background: #1e40af; color: #fff; padding: 3px 8px; margin: 10px 0 5px; text-transform: uppercase; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 2px solid #1e40af; padding-bottom: 8px; }
  .company { font-weight: bold; font-size: 12px; color: #1e40af; }
  .folio { font-size: 16px; font-weight: bold; color: #1e40af; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 16px; }
  .field { margin-bottom: 3px; }
  .field label { font-weight: bold; font-size: 8px; text-transform: uppercase; color: #555; display: block; }
  .field span { border-bottom: 1px solid #aaa; display: block; min-height: 16px; padding: 1px 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #1e40af; color: #fff; padding: 4px 6px; font-size: 9px; text-align: center; }
  td { border: 1px solid #ccc; padding: 3px 5px; text-align: center; min-height: 18px; font-size: 9px; }
  tr:nth-child(even) td { background: #f0f4ff; }
  .sign-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 30px; text-align: center; }
  .sign-row div { border-top: 1px solid #000; padding-top: 3px; }
  @media print { button { display: none; } }
</style>
</head><body>
<div class="header">
  <div>
    <div class="company">NÚCLEO DE INGENIERÍA APLICADA</div>
    <div style="font-size:8px;color:#555;">Instalación, Mantenimiento Eléctrico, Asesoría Hidráulica<br/>Aforos, Equipos, Pozos Profundos — 341.137.8262</div>
  </div>
  <div style="text-align:right">
    <div class="folio">${rec.folio || ''}</div>
    <div style="font-size:9px;font-weight:bold;color:#555;">FORMATO DE AFORO — ${rec.duration_hours}H</div>
  </div>
</div>

<div class="grid3" style="margin-bottom:8px;">
  <div class="field"><label>Cliente</label><span>${client?.company_name || ''}</span></div>
  <div class="field"><label>Lugar / Pozo</label><span>${rec.location || ''}</span></div>
  <div class="field"><label>Perforó</label><span>${rec.drilled_by || ''}</span></div>
</div>
<div class="grid3" style="margin-bottom:10px;">
  <div class="field"><label>Fecha y Hora de Inicio</label><span>${rec.start_datetime ? new Date(rec.start_datetime).toLocaleString('es-MX') : ''}</span></div>
  <div class="field"><label>Fórmula de Gasto</label><span>${rec.aforo_formula || ''}</span></div>
  <div class="field" style="grid-column: span 2;"><label>Observaciones (Aforo)</label><span>${rec.observations || ''}</span></div>
</div>

<div class="grid2">
  <div>
    <h2>Características del Equipo</h2>
    <div class="grid2">
      <div class="field"><label>Bomba</label><span>${rec.pump_brand || ''}</span></div>
      <div class="field"><label>Marca</label><span>${rec.pump_brand || ''}</span></div>
      <div class="field"><label>Diámetro</label><span>${rec.pump_diameter || ''}</span></div>
      <div class="field"><label>Modelo Impulsores</label><span>${rec.impeller_model || ''}</span></div>
      <div class="field"><label>Tubo Succión</label><span>${rec.suction_pipe || ''}</span></div>
      <div class="field"><label>Long. Total Columna</label><span>${rec.total_column_length || ''}</span></div>
      <div class="field"><label>Motor</label><span>${rec.motor_info || ''}</span></div>
      <div class="field"><label>Método de Aforo</label><span>${rec.flow_method || ''}</span></div>
    </div>
  </div>
  <div>
    <h2>Características del PC</h2>
    <div class="grid2">
      <div class="field"><label>Profundidad Total</label><span>${rec.well_total_depth || ''}</span></div>
      <div class="field"><label>Diámetro del Tubo</label><span>${rec.well_pipe_diameter || ''}</span></div>
      <div class="field"><label>Long. Tubo Liso</label><span>${rec.well_pipe_use_length || ''}</span></div>
      <div class="field"><label>Long. de Ademe</label><span>${rec.well_ademe_length || ''}</span></div>
      <div class="field"><label>Long. Tubo Ranurado</label><span>${rec.well_annular_length || ''}</span></div>
      <div class="field"><label>Long. Filtro de Grava</label><span>${rec.well_gravel_filter_length || ''}</span></div>
      <div class="field"><label>Diám. Filtro Cementación</label><span>${rec.well_cement_diameter || ''}</span></div>
      <div class="field"><label>Nivel Hidrostático</label><span>${rec.hydrostatic_level || ''}</span></div>
    </div>
  </div>
</div>

<h2>Inicia Aforo — Tabla de Mediciones (${rec.duration_hours} horas)</h2>
<table>
  <thead>
    <tr>
      <th>Día</th><th>Hora</th><th>Dinámico</th><th>Velocidad Bomba<br/>R.P.M.</th>
      <th>Lectura<br/>Amp.</th><th>Gasto<br/>L.P.S.</th><th>Boquilla</th><th>Observaciones</th>
    </tr>
  </thead>
  <tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:#aaa;">Sin mediciones</td></tr>'}</tbody>
</table>

<div class="sign-row">
  <div>Encargado</div><div>Revisó</div><div>Autorizó / Cliente</div>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`);
        pw.document.close();
    };

    const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white";
    const labelClass = "mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider";
    const tdInput = "w-full border-0 bg-transparent text-center text-xs py-1 px-1 focus:outline-none focus:ring-1 focus:ring-primary/40 rounded dark:text-white";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Formato de Aforo</h2>
                    <p className="text-sm text-slate-500">Registro de aforos de pozos — 24 y 48 horas.</p>
                </div>
                <button onClick={() => { 
                    setForm({ ...EMPTY_FORM, folio: `No. ${(records.length + 1).toString().padStart(4, '0')}` }); 
                    setMeasurements(makeEmptyMeasurements(24)); 
                    setEditingId(null); 
                    setShowForm(true); 
                }}
                    className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Nuevo Aforo
                </button>
            </div>

            {loading ? (
                <div className="py-12 text-center text-slate-500">Cargando aforos...</div>
            ) : records.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="material-symbols-outlined mb-3 text-4xl text-slate-300">water_pump</span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sin Aforos</h3>
                    <p className="mt-1 text-sm text-slate-500">No hay registros de aforo aún.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {records.map(rec => (
                        <div key={rec.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="text-cyan-600">{rec.folio || 'Sin folio'}</span>
                                        <span>- {rec.client?.company_name || 'Sin Cliente'}</span>
                                    </h3>
                                    <p className="text-sm text-slate-500">{rec.location}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${rec.duration_hours === 48 ? 'bg-violet-100 text-violet-700' : 'bg-cyan-100 text-cyan-700'}`}>
                                        {rec.duration_hours}h
                                    </span>
                                    <button onClick={() => handlePrint(rec)} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Imprimir">
                                        <span className="material-symbols-outlined text-[18px]">print</span>
                                    </button>
                                    <button onClick={() => handleEditClick(rec)} className="rounded-lg p-1.5 text-slate-400 hover:bg-primary/10 hover:text-primary" title="Editar">
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                                <div><p className="text-slate-400">Perforó</p><p className="font-medium text-slate-700 dark:text-slate-300">{rec.drilled_by || '-'}</p></div>
                                <div><p className="text-slate-400">Mediciones</p><p className="font-medium text-slate-700 dark:text-slate-300">{rec.measurements?.length || 0} filas</p></div>
                                <div><p className="text-slate-400">Inicio</p><p className="font-medium text-slate-700 dark:text-slate-300">{rec.start_datetime ? new Date(rec.start_datetime).toLocaleDateString('es-MX') : '-'}</p></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="w-full max-w-6xl rounded-xl bg-white shadow-2xl dark:bg-slate-900 my-4">
                        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-cyan-600">water_pump</span>
                                {editingId ? 'Editar Aforo' : 'Nuevo Formato de Aforo'}
                            </h2>
                            <div className="flex items-center gap-3">
                                {/* Selector 24h / 48h */}
                                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                                    {([24, 48] as const).map(h => (
                                        <button key={h} type="button" onClick={() => handleDurationChange(h)}
                                            className={`rounded-md px-4 py-1.5 text-sm font-bold transition-all ${form.duration_hours === h ? 'bg-cyan-600 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}>
                                            {h}h
                                        </button>
                                    ))}
                                </div>
                                <button onClick={() => setShowForm(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSave} className="p-5">
                            {/* Header */}
                            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-4">
                                <div><label className={labelClass}>Folio</label><input type="text" value={form.folio || ''} onChange={e => setForm(f => ({ ...f, folio: e.target.value }))} className={inputClass} /></div>
                                <div className="sm:col-span-2"><label className={labelClass}>Lugar / Nombre del Pozo</label><input type="text" value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputClass} required /></div>
                                <div><label className={labelClass}>Cliente</label>
                                    <select value={form.client_id || ''} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className={inputClass}>
                                        <option value="">— Cliente —</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                                    </select>
                                </div>
                                <div><label className={labelClass}>Perforó</label><input type="text" value={form.drilled_by || ''} onChange={e => setForm(f => ({ ...f, drilled_by: e.target.value }))} className={inputClass} /></div>
                                <div><label className={labelClass}>Fecha y Hora de Inicio</label><input type="datetime-local" value={form.start_datetime || ''} onChange={e => setForm(f => ({ ...f, start_datetime: e.target.value }))} className={inputClass} /></div>
                                <div><label className={labelClass}>Fórmula de Gasto</label><input type="text" value={form.aforo_formula || ''} onChange={e => setForm(f => ({ ...f, aforo_formula: e.target.value }))} className={inputClass} placeholder="Q = A x V" /></div>
                                <div className="sm:col-span-4 mt-2">
                                    <label className={labelClass}>Observaciones (Generales del Aforo)</label>
                                    <textarea value={form.observations || ''} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} className={inputClass} rows={2}></textarea>
                                </div>
                            </div>

                            {/* Two column: Equipo / PC */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                                <div>
                                    <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-cyan-600 text-[18px]">settings</span>
                                        Características del Equipo
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            ['pump_brand', 'Bomba (Marca)'],
                                            ['pump_model', 'Modelo'],
                                            ['pump_diameter', 'Diámetro'],
                                            ['impeller_model', 'Modelo Impulsores'],
                                            ['suction_pipe', 'Tubo de Succión'],
                                            ['total_column_length', 'Long. Total Columna'],
                                            ['motor_info', 'Motor'],
                                            ['flow_method', 'Método de Aforo'],
                                        ].map(([field, label]) => (
                                            <div key={field}>
                                                <label className={labelClass}>{label}</label>
                                                <input type="text" value={(form as any)[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} className={inputClass} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-cyan-600 text-[18px]">water</span>
                                        Características del PC (Pozo)
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            ['well_total_depth', 'Profundidad Total'],
                                            ['well_pipe_diameter', 'Diámetro del Tubo'],
                                            ['well_pipe_use_length', 'Long. Tubo Liso'],
                                            ['well_ademe_length', 'Long. de Ademe'],
                                            ['well_annular_length', 'Long. Tubo Ranurado'],
                                            ['well_gravel_filter_length', 'Long. Filtro de Grava'],
                                            ['well_cement_diameter', 'Diám. Filtro Cementación'],
                                            ['hydrostatic_level', 'Nivel Hidrostático'],
                                        ].map(([field, label]) => (
                                            <div key={field}>
                                                <label className={labelClass}>{label}</label>
                                                <input type="text" value={(form as any)[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} className={inputClass} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Tabla de mediciones */}
                            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                                <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-cyan-600 text-[18px]">table_chart</span>
                                    Tabla de Mediciones — {form.duration_hours}h ({measurements.length} filas)
                                </h3>
                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                    <table className="w-full min-w-[900px]">
                                        <thead>
                                            <tr className="bg-cyan-700 text-white text-[11px]">
                                                <th className="px-2 py-2 text-center w-8">#</th>
                                                <th className="px-2 py-2">Día</th>
                                                <th className="px-2 py-2">Hora</th>
                                                <th className="px-2 py-2">Dinámico</th>
                                                <th className="px-2 py-2">Vel. Bomba R.P.M.</th>
                                                <th className="px-2 py-2">Lectura Amp.</th>
                                                <th className="px-2 py-2">Gasto L.P.S.</th>
                                                <th className="px-2 py-2">Boquilla</th>
                                                <th className="px-2 py-2">Observaciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {measurements.map((m, i) => (
                                                <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-cyan-50/40 dark:bg-cyan-900/10'}>
                                                    <td className="px-2 py-1 text-center text-xs text-slate-400">{i + 1}</td>
                                                    {(['day_label', 'hour_label', 'dynamic_level', 'pump_rpm', 'amp_reading', 'flow_lps', 'nozzle', 'observations'] as const).map(field => (
                                                        <td key={field} className="border-l border-slate-100 dark:border-slate-800 px-1 py-0.5">
                                                            <input type="text" value={m[field] || ''} onChange={e => updateMeasurement(i, field, e.target.value)} className={tdInput} />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                                <button type="submit" disabled={saving} className="rounded-lg bg-cyan-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-cyan-700">
                                    {saving ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Guardar Aforo')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
