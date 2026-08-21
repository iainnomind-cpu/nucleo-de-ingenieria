import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import PhotoUploader, { PhotoGallery } from '../../components/PhotoUploader';
import { PhotoAttachment } from '../../types/photos';

export interface StartupFormatRecord {
    id: string;
    folio?: string;
    client_id?: string;
    location?: string;
    technician?: string;
    equipment?: string;
    record_date?: string;
    
    // Main Table
    time_logged?: string;
    volts_l1?: string;
    volts_l2?: string;
    volts_l3?: string;
    amp_l1?: string;
    amp_l2?: string;
    amp_l3?: string;
    flow_rate?: string;
    dynamic_level?: string;
    discharge_pressure?: string;
    observations_table?: string;
    avg_volts?: string;
    avg_amps?: string;
    unbalance_percentage?: string;

    time_logged_2?: string;
    volts_l1_2?: string;
    volts_l2_2?: string;
    volts_l3_2?: string;
    amp_l1_2?: string;
    amp_l2_2?: string;
    amp_l3_2?: string;
    flow_rate_2?: string;
    dynamic_level_2?: string;
    discharge_pressure_2?: string;
    observations_table_2?: string;
    avg_volts_2?: string;
    avg_amps_2?: string;
    unbalance_percentage_2?: string;

    time_logged_3?: string;
    volts_l1_3?: string;
    volts_l2_3?: string;
    volts_l3_3?: string;
    amp_l1_3?: string;
    amp_l2_3?: string;
    amp_l3_3?: string;
    flow_rate_3?: string;
    dynamic_level_3?: string;
    discharge_pressure_3?: string;
    observations_table_3?: string;
    avg_volts_3?: string;
    avg_amps_3?: string;
    unbalance_percentage_3?: string;
    
    // Parámetros Eléctricos
    low_voltage?: string;
    high_voltage?: string;
    overload_amps?: string;
    underload_amps?: string;
    phase_unbalance?: string;
    
    // Datos Motor
    motor_power_hp?: string;
    motor_feed_volts?: string;
    motor_frequency_hz?: string;
    motor_nom_amps?: string;
    motor_protection_type?: string;
    
    // Footer
    recommendations?: string;
    received_by?: string;
    reviewed_by?: string;
    authorized_by?: string;

    client?: { id: string; company_name: string };
    created_at?: string;
    photos?: any[];
}

const EMPTY_FORM: Omit<StartupFormatRecord, 'id'> = {
    folio: '', client_id: '', location: '', technician: '', equipment: '',
    record_date: new Date().toISOString().split('T')[0],
    time_logged: '', volts_l1: '', volts_l2: '', volts_l3: '', amp_l1: '', amp_l2: '', amp_l3: '',
    flow_rate: '', dynamic_level: '', discharge_pressure: '', observations_table: '',
    avg_volts: '', avg_amps: '', unbalance_percentage: '',
    time_logged_2: '', volts_l1_2: '', volts_l2_2: '', volts_l3_2: '', amp_l1_2: '', amp_l2_2: '', amp_l3_2: '',
    flow_rate_2: '', dynamic_level_2: '', discharge_pressure_2: '', observations_table_2: '',
    avg_volts_2: '', avg_amps_2: '', unbalance_percentage_2: '',
    time_logged_3: '', volts_l1_3: '', volts_l2_3: '', volts_l3_3: '', amp_l1_3: '', amp_l2_3: '', amp_l3_3: '',
    flow_rate_3: '', dynamic_level_3: '', discharge_pressure_3: '', observations_table_3: '',
    avg_volts_3: '', avg_amps_3: '', unbalance_percentage_3: '',
    low_voltage: '', high_voltage: '', overload_amps: '', underload_amps: '', phase_unbalance: '',
    motor_power_hp: '', motor_feed_volts: '', motor_frequency_hz: '', motor_nom_amps: '', motor_protection_type: '',
    recommendations: '', received_by: '', reviewed_by: '', authorized_by: '',
    photos: [],
};

export default function StartupFormatTab() {
    const { user } = useAuth();
    const [records, setRecords] = useState<StartupFormatRecord[]>([]);
    const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
    const [form, setForm] = useState<Omit<StartupFormatRecord, 'id'>>(EMPTY_FORM);

    const f = (field: keyof Omit<StartupFormatRecord, 'id'>) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
            setForm(prev => ({ ...prev, [field]: e.target.value }));

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [recRes, cliRes] = await Promise.all([
            supabase.from('startup_formats').select('*, client:clients(id, company_name)').order('created_at', { ascending: false }),
            supabase.from('clients').select('id, company_name').order('company_name'),
        ]);
        setRecords((recRes.data as StartupFormatRecord[]) || []);
        setClients(cliRes.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...form, client_id: form.client_id || null, photos };
            if (editingId) {
                const { error } = await supabase.from('startup_formats').update(payload).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('startup_formats').insert([{ ...payload, ...(user?.id ? { created_by: user.id } : {}) }]);
                if (error) throw error;
            }
            setShowForm(false);
            setEditingId(null);
            setForm(EMPTY_FORM);
            setPhotos([]);
            fetchData();
        } catch (err: any) {
            alert('Error al guardar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEditClick = (rec: StartupFormatRecord) => {
        setEditingId(rec.id);
        setForm({ ...EMPTY_FORM, ...rec, client_id: rec.client_id || '' });
        setPhotos((rec as any).photos || []);
        setShowForm(true);
    };

    const handlePrint = (rec: StartupFormatRecord) => {
        const client = clients.find(c => c.id === rec.client_id);
        const pw = window.open('', '_blank');
        if (!pw) return;
        pw.document.write(`<!DOCTYPE html><html><head>
<meta charset="UTF-8"/>
<title>Formato de Arranque ${rec.folio || ''}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; padding: 18px; }
  .page-title { text-align: center; font-size: 14px; font-weight: bold; margin: 6px 0; text-transform: uppercase; letter-spacing: 1px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e40af; padding-bottom: 8px; margin-bottom: 12px; }
  .company-name { font-weight: bold; font-size: 12px; color: #1e40af; }
  .company-sub { font-size: 8px; color: #555; max-width: 280px; }
  .logo-area { font-size: 9px; text-align: right; color: #555; }
  .meta-row { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 10px; }
  .meta-field { display: flex; align-items: baseline; gap: 4px; }
  .meta-label { font-weight: bold; font-size: 9px; white-space: nowrap; }
  .meta-value { border-bottom: 1px solid #888; flex: 1; min-height: 14px; padding: 0 2px; }
  .section-title { background: #1e40af; color: #fff; font-size: 11px; font-weight: bold; text-align: center; padding: 4px; margin: 10px 0 6px; text-transform: uppercase; letter-spacing: 1px; }
  
  table.main-data { width: 100%; border-collapse: collapse; margin-bottom: 10px; text-align: center; font-size: 9px; }
  table.main-data th, table.main-data td { border: 1px solid #000; padding: 4px; }
  table.main-data th { background-color: #eee; font-weight: bold; }
  
  .side-tables { display: flex; gap: 20px; margin-top: 10px; }
  .side-table { border-collapse: collapse; width: 250px; font-size: 9px; }
  .side-table th, .side-table td { border: 1px solid #000; padding: 4px; text-align: left; }
  .side-table th { background-color: #eee; font-weight: normal; }
  .side-table td { text-align: center; }

  .sign-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 50px; text-align: center; }
  .sign-row div { border-top: 1px solid #000; padding-top: 4px; font-weight: bold; font-size: 9px; }
  .footer { margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 8px; color: #555; border-top: 1px solid #ccc; padding-top: 6px; }
  @media print { button { display:none; } }
</style>
</head><body>
<div class="header">
  <div>
    <div class="company-name">NÚCLEO DE INGENIERÍA APLICADA</div>
    <div class="company-sub">Instalación, Mantenimiento Eléctrico, Asesoría acerca de Proyectos Hidráulicos, Aforos, Equipos, Rehabilitación y Pozos Profundos</div>
  </div>
  <div class="logo-area">341.137.8262<br/>341.137.3268</div>
</div>

<div class="page-title">FORMATO DE ARRANQUE</div>

<div class="meta-row" style="margin-bottom:12px;">
  <div class="meta-field"><span class="meta-label">CLIENTE:</span><span class="meta-value">${client?.company_name || ''}</span></div>
  <div class="meta-field"><span class="meta-label">LUGAR:</span><span class="meta-value">${rec.location || ''}</span></div>
  <div class="meta-field"><span class="meta-label">TÉCNICO:</span><span class="meta-value">${rec.technician || ''}</span></div>
  <div class="meta-field"><span class="meta-label">EQUIPO:</span><span class="meta-value">${rec.equipment || ''}</span></div>
  <div class="meta-field" style="grid-column: span 2;"><span class="meta-label">FECHA:</span><span class="meta-value">${rec.record_date || ''}</span></div>
</div>

<table class="main-data">
  <thead>
    <tr>
      <th rowspan="2">FECHA</th>
      <th rowspan="2">HORA</th>
      <th colspan="3">VOLTS</th>
      <th colspan="3">AMP.</th>
      <th rowspan="2">CAUDAL</th>
      <th rowspan="2">N. D.</th>
      <th rowspan="2">P. D.</th>
      <th rowspan="2">OBSERVACIONES</th>
      <th rowspan="2">PROM.</th>
      <th rowspan="2">% DESB.</th>
    </tr>
    <tr>
      <th>L1-L2</th>
      <th>L2-L3</th>
      <th>L1-L3</th>
      <th>L1</th>
      <th>L2</th>
      <th>L3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>${rec.record_date || ''}</td>
      <td>${rec.time_logged || ''}</td>
      <td>${rec.volts_l1 || ''}</td>
      <td>${rec.volts_l2 || ''}</td>
      <td>${rec.volts_l3 || ''}</td>
      <td>${rec.amp_l1 || ''}</td>
      <td>${rec.amp_l2 || ''}</td>
      <td>${rec.amp_l3 || ''}</td>
      <td>${rec.flow_rate || ''}</td>
      <td>${rec.dynamic_level || ''}</td>
      <td>${rec.discharge_pressure || ''}</td>
      <td>${rec.observations_table || ''}</td>
      <td>V: ${rec.avg_volts || ''}<br/>A: ${rec.avg_amps || ''}</td>
      <td>${rec.unbalance_percentage || ''}</td>
    </tr>
    <tr>
      <td>${rec.record_date || ''}</td>
      <td>${rec.time_logged_2 || ''}</td>
      <td>${rec.volts_l1_2 || ''}</td>
      <td>${rec.volts_l2_2 || ''}</td>
      <td>${rec.volts_l3_2 || ''}</td>
      <td>${rec.amp_l1_2 || ''}</td>
      <td>${rec.amp_l2_2 || ''}</td>
      <td>${rec.amp_l3_2 || ''}</td>
      <td>${rec.flow_rate_2 || ''}</td>
      <td>${rec.dynamic_level_2 || ''}</td>
      <td>${rec.discharge_pressure_2 || ''}</td>
      <td>${rec.observations_table_2 || ''}</td>
      <td>V: ${rec.avg_volts_2 || ''}<br/>A: ${rec.avg_amps_2 || ''}</td>
      <td>${rec.unbalance_percentage_2 || ''}</td>
    </tr>
    <tr>
      <td>${rec.record_date || ''}</td>
      <td>${rec.time_logged_3 || ''}</td>
      <td>${rec.volts_l1_3 || ''}</td>
      <td>${rec.volts_l2_3 || ''}</td>
      <td>${rec.volts_l3_3 || ''}</td>
      <td>${rec.amp_l1_3 || ''}</td>
      <td>${rec.amp_l2_3 || ''}</td>
      <td>${rec.amp_l3_3 || ''}</td>
      <td>${rec.flow_rate_3 || ''}</td>
      <td>${rec.dynamic_level_3 || ''}</td>
      <td>${rec.discharge_pressure_3 || ''}</td>
      <td>${rec.observations_table_3 || ''}</td>
      <td>V: ${rec.avg_volts_3 || ''}<br/>A: ${rec.avg_amps_3 || ''}</td>
      <td>${rec.unbalance_percentage_3 || ''}</td>
    </tr>
  </tbody>
</table>

<div class="side-tables">
  <div>
    <div style="font-weight:bold;text-align:center;margin-bottom:4px;font-size:10px;">Parámetros Eléctricos</div>
    <table class="side-table">
      <tr><th>Bajo voltaje:</th><td>${rec.low_voltage || ''} volts</td></tr>
      <tr><th>Alto voltaje:</th><td>${rec.high_voltage || ''} volts</td></tr>
      <tr><th>Sobre carga:</th><td>${rec.overload_amps || ''} amperes</td></tr>
      <tr><th>Baja carga:</th><td>${rec.underload_amps || ''} amperes</td></tr>
      <tr><th>Desbalance de fases:</th><td>${rec.phase_unbalance || ''} %</td></tr>
    </table>
  </div>
  <div>
    <div style="font-weight:bold;text-align:center;margin-bottom:4px;font-size:10px;">Datos Motor</div>
    <table class="side-table">
      <tr><th>Potencia:</th><td>${rec.motor_power_hp || ''} Hp</td></tr>
      <tr><th>Alimentación:</th><td>${rec.motor_feed_volts || ''} volts</td></tr>
      <tr><th>Frecuencia:</th><td>${rec.motor_frequency_hz || ''} hertz</td></tr>
      <tr><th>Amp. Nominal:</th><td>${rec.motor_nom_amps || ''} amperes</td></tr>
      <tr><th>Tipo de Protección:</th><td>${rec.motor_protection_type || ''}</td></tr>
    </table>
  </div>
</div>

<div style="margin-top:16px;">
  <strong style="font-size:10px;">Observaciones y recomendaciones:</strong>
  <div style="border:1px solid #ccc;padding:6px;min-height:50px;font-size:9px;margin-top:4px;">${rec.recommendations || ''}</div>
</div>

<div style="margin-top:20px; font-size:8px; font-weight:bold;">
  MANIFIESTO QUE ESTOY CONFORME CON LOS TRABAJOS Y QUE HE RECIBIDO LA CAPACITACIÓN NECESARIA PARA OPERAR LOS EQUIPOS INSTALADOS.
</div>

<div class="sign-row">
  <div>RECIBIÓ CLIENTE<br/><span style="font-weight:normal;font-size:10px;display:block;margin-top:4px;">${rec.received_by || ''}</span></div>
  <div>REVISÓ<br/><span style="font-weight:normal;font-size:10px;display:block;margin-top:4px;">${rec.reviewed_by || ''}</span></div>
  <div>AUTORIZÓ ENCARGADO<br/><span style="font-weight:normal;font-size:10px;display:block;margin-top:4px;">${rec.authorized_by || ''}</span></div>
</div>

<div class="footer">
  <div><strong>10 AÑOS DE EXPERIENCIA AL SERVICIO DE SUS PROYECTOS</strong></div>
  <div>Periférico Sur No. 336 Col. A.C.F.E. Cd. Guzmán, Zapotlán el Grande, Jalisco</div>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`);
        pw.document.close();
    };

    const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white";
    const labelClass = "mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider";
    const sectionHeader = "mb-3 mt-6 flex items-center gap-2 text-sm font-bold text-white bg-emerald-600 rounded-lg px-3 py-2 uppercase tracking-wide";

    const renderField = (label: string, field: keyof Omit<StartupFormatRecord, 'id'>, placeholder?: string, inputType = 'text') => (
        <div>
            <label className={labelClass}>{label}</label>
            <input type={inputType} value={(form as any)[field] || ''} onChange={f(field)} className={inputClass} placeholder={placeholder} />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Formato de Arranque</h2>
                    <p className="text-sm text-slate-500">Servicio de arranque, voltajes, amperajes y datos del motor.</p>
                </div>
                <button onClick={() => { 
                    setForm({ ...EMPTY_FORM, folio: `No. ${(records.length + 1).toString().padStart(4, '0')}` }); 
                    setEditingId(null); 
                    setShowForm(true); 
                }}
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Nuevo Registro
                </button>
            </div>

            {loading ? (
                <div className="py-12 text-center text-slate-500">Cargando...</div>
            ) : records.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="material-symbols-outlined mb-3 text-4xl text-slate-300">power_settings_new</span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sin Registros</h3>
                    <p className="mt-1 text-sm text-slate-500">No hay formatos de arranque registrados aún.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {records.map(rec => (
                        <div key={rec.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-emerald-600 text-[18px]">power_settings_new</span>
                                        <span className="text-emerald-600">{rec.folio || 'Sin folio'}</span>
                                        <span>— {rec.client?.company_name || 'Sin cliente'}</span>
                                    </h3>
                                    <p className="text-sm text-slate-500">{rec.equipment} {rec.location ? `· ${rec.location}` : ''}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">{rec.record_date}</span>
                                    <button onClick={() => handlePrint(rec)} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Imprimir">
                                        <span className="material-symbols-outlined text-[18px]">print</span>
                                    </button>
                                    <button onClick={() => handleEditClick(rec)} className="rounded-lg p-1.5 text-slate-400 hover:bg-primary/10 hover:text-primary" title="Editar">
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                                <div><p className="text-slate-400">Técnico</p><p className="font-medium text-slate-700 dark:text-slate-300">{rec.technician || '-'}</p></div>
                                <div><p className="text-slate-400">Volts Prom.</p><p className="font-medium text-slate-700 dark:text-slate-300">{rec.avg_volts || '-'}</p></div>
                                <div><p className="text-slate-400">Amps Prom.</p><p className="font-medium text-slate-700 dark:text-slate-300">{rec.avg_amps || '-'}</p></div>
                                <div><p className="text-slate-400">Desbalance</p><p className="font-medium text-slate-700 dark:text-slate-300">{rec.unbalance_percentage || '-'}</p></div>
                            </div>
                            {rec.photos && rec.photos.length > 0 && (
                                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                                    <PhotoGallery photos={rec.photos} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="w-full max-w-5xl rounded-xl bg-white shadow-2xl dark:bg-slate-900 my-4">
                        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-600">power_settings_new</span>
                                {editingId ? 'Editar Formato de Arranque' : 'Nuevo Formato de Arranque'}
                            </h2>
                            <button onClick={() => setShowForm(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-5">
                            {/* Encabezado */}
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                                {renderField('Folio', 'folio')}
                                <div>
                                    <label className={labelClass}>Cliente</label>
                                    <select value={form.client_id || ''} onChange={f('client_id')} className={inputClass}>
                                        <option value="">— Cliente —</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                                    </select>
                                </div>
                                {renderField('Lugar', 'location')}
                                {renderField('Técnico', 'technician')}
                                {renderField('Equipo', 'equipment')}
                            </div>

                            <p className={sectionHeader}><span className="material-symbols-outlined text-[18px]">table</span>Tabla Principal</p>
                            
                            {[
                                { title: '① Medición 1', suffix: '' },
                                { title: '② Medición 2', suffix: '_2' },
                                { title: '③ Medición 3', suffix: '_3' },
                            ].map((row, idx) => (
                                <div key={idx} className="mb-8 border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-900/50">
                                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-500 mb-3 uppercase tracking-wide">{row.title}</p>
                                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                                        {idx === 0 && renderField('Fecha', 'record_date', '', 'date')}
                                        {renderField('Hora', `time_logged${row.suffix}` as any, '', 'time')}
                                        {renderField('Volts (L1-L2)', `volts_l1${row.suffix}` as any)}
                                        {renderField('Volts (L2-L3)', `volts_l2${row.suffix}` as any)}
                                        {renderField('Volts (L1-L3)', `volts_l3${row.suffix}` as any)}
                                        {renderField('Amp (L1)', `amp_l1${row.suffix}` as any)}
                                        {renderField('Amp (L2)', `amp_l2${row.suffix}` as any)}
                                        {renderField('Amp (L3)', `amp_l3${row.suffix}` as any)}
                                        {renderField('Caudal', `flow_rate${row.suffix}` as any)}
                                        {renderField('N.D.', `dynamic_level${row.suffix}` as any)}
                                        {renderField('P.D.', `discharge_pressure${row.suffix}` as any)}
                                        {renderField('Promedio Volts', `avg_volts${row.suffix}` as any)}
                                        {renderField('Promedio Amps', `avg_amps${row.suffix}` as any)}
                                        {renderField('% Desbalance', `unbalance_percentage${row.suffix}` as any)}
                                        <div className="sm:col-span-2">
                                            {renderField('Observaciones (Tabla)', `observations_table${row.suffix}` as any)}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <p className={sectionHeader}><span className="material-symbols-outlined text-[18px]">bolt</span>Parámetros Eléctricos</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        {renderField('Bajo voltaje (V)', 'low_voltage')}
                                        {renderField('Alto voltaje (V)', 'high_voltage')}
                                        {renderField('Sobre carga (A)', 'overload_amps')}
                                        {renderField('Baja carga (A)', 'underload_amps')}
                                        <div className="col-span-2">
                                            {renderField('Desbalance de fases (%)', 'phase_unbalance')}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <p className={sectionHeader}><span className="material-symbols-outlined text-[18px]">settings</span>Datos Motor</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        {renderField('Potencia (Hp)', 'motor_power_hp')}
                                        {renderField('Alimentación (V)', 'motor_feed_volts')}
                                        {renderField('Frecuencia (Hz)', 'motor_frequency_hz')}
                                        {renderField('Amp. Nominal', 'motor_nom_amps')}
                                        <div className="col-span-2">
                                            {renderField('Tipo de Protección', 'motor_protection_type')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className={sectionHeader}><span className="material-symbols-outlined text-[18px]">draw</span>Recomendaciones y Firmas</p>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div className="sm:col-span-3">
                                    <label className={labelClass}>Observaciones y recomendaciones</label>
                                    <textarea value={form.recommendations || ''} onChange={f('recommendations')} rows={3} className={inputClass} />
                                </div>
                                {renderField('Recibió Cliente', 'received_by')}
                                {renderField('Revisó', 'reviewed_by')}
                                {renderField('Autorizó Encargado', 'authorized_by')}
                            </div>

                            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                                <label className={labelClass}>Fotografías del Formato de Arranque</label>
                                <PhotoUploader photos={photos} onPhotosChange={setPhotos} folder={`startup-formats/${editingId || 'new'}`} uploaderName={user?.full_name || 'Técnico'} />
                            </div>

                            <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                                <button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-700">
                                    {saving ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Guardar Formato de Arranque')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
