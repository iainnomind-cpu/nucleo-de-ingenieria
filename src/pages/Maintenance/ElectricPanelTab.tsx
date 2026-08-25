import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import PhotoUploader, { PhotoGallery } from '../../components/PhotoUploader';
import { PhotoAttachment } from '../../types/photos';

interface ElectricPanelRecord {
    id: string;
    folio?: string;
    client_id?: string;
    location?: string;
    well_name?: string;
    record_date?: string;
    // Transformador
    trans_brand?: string;
    trans_capacity?: string;
    trans_lightning_rods?: string;
    trans_switches?: string;
    trans_insulators?: string;
    trans_fuses?: string;
    trans_dielectric?: string;
    trans_cable_gauge?: string;
    // Arrancador
    starter_model?: string;
    starter_capacity?: string;
    starter_protection?: string;
    starter_channeled?: string;
    // Motor
    motor_brand?: string;
    motor_power?: string;
    motor_amperage?: string;
    motor_frequency?: string;
    motor_meggeo?: string;
    motor_feed?: string;
    motor_ground_system?: string;
    motor_ground_location?: string;
    motor_cable_gauge?: string;
    // Bomba
    pump_brand?: string;
    pump_power?: string;
    pump_model?: string;
    pump_material?: string;
    pump_repaired?: string;
    // Firmas
    responsible?: string;
    reviewed_by?: string;
    authorized_by?: string;
    notes?: string;
    client?: { id: string; company_name: string };
    created_at?: string;
}

const EMPTY_FORM: Omit<ElectricPanelRecord, 'id'> = {
    folio: '', client_id: '', location: '', well_name: '',
    record_date: new Date().toISOString().split('T')[0],
    trans_brand: '', trans_capacity: '', trans_lightning_rods: '', trans_switches: '',
    trans_insulators: '', trans_fuses: '', trans_dielectric: '', trans_cable_gauge: '',
    starter_model: '', starter_capacity: '', starter_protection: '', starter_channeled: 'NO',
    motor_brand: '', motor_power: '', motor_amperage: '', motor_frequency: '', motor_meggeo: '',
    motor_feed: '', motor_ground_system: 'NO', motor_ground_location: '', motor_cable_gauge: '',
    pump_brand: '', pump_power: '', pump_model: '', pump_material: '', pump_repaired: 'NO',
    responsible: '', reviewed_by: '', authorized_by: '', notes: '',
};

export default function ElectricPanelTab() {
    const { user } = useAuth();
    const [records, setRecords] = useState<ElectricPanelRecord[]>([]);
    const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
    const [form, setForm] = useState<Omit<ElectricPanelRecord, 'id'>>(EMPTY_FORM);

    const renderYesNoSelect = (field: keyof Omit<ElectricPanelRecord, 'id'>) => (
        <select value={(form as any)[field] || 'NO'} onChange={f(field)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <option value="SI">SÍ</option>
            <option value="NO">NO</option>
        </select>
    );

    const renderField = (label: string, field: keyof Omit<ElectricPanelRecord, 'id'>, placeholder?: string) => (
        <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
            <input type="text" value={(form as any)[field] || ''} onChange={f(field)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white" placeholder={placeholder} />
        </div>
    );

    const f = (field: keyof Omit<ElectricPanelRecord, 'id'>) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
            setForm(prev => ({ ...prev, [field]: e.target.value }));

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [recRes, cliRes] = await Promise.all([
            supabase.from('electric_panel_records').select('*, client:clients(id, company_name)').order('created_at', { ascending: false }),
            supabase.from('clients').select('id, company_name').order('company_name'),
        ]);
        setRecords((recRes.data as ElectricPanelRecord[]) || []);
        setClients(cliRes.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { created_by: _cb, ...formWithoutCreatedBy } = form as any;
            const payload = { ...formWithoutCreatedBy, client_id: form.client_id || null, photos };
            if (editingId) {
                const { error } = await supabase.from('electric_panel_records').update(payload).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('electric_panel_records').insert([{ ...payload, ...(user?.id ? { created_by: user.id } : {}) }]);
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

    const handleEditClick = (rec: ElectricPanelRecord) => {
        setEditingId(rec.id);
        setForm({ ...EMPTY_FORM, ...rec, client_id: rec.client_id || '' });
        setPhotos((rec as any).photos || []);
        setShowForm(true);
    };

    const handlePrint = (rec: ElectricPanelRecord) => {
        const client = clients.find(c => c.id === rec.client_id);
        const pw = window.open('', '_blank');
        if (!pw) return;
        const yesNo = (v?: string) => v === 'SI' ? '<span style="font-weight:bold">✓ SÍ</span>' : '<span>NO</span>';
        pw.document.write(`<!DOCTYPE html><html><head>
<meta charset="UTF-8"/>
<title>Cuadro Eléctrico ${rec.folio || ''}</title>
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
  .section-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #bbb; }
  .col { padding: 5px 8px; }
  .col:first-child { border-right: 1px solid #bbb; }
  .field { margin-bottom: 4px; display: flex; align-items: baseline; gap: 4px; }
  .field label { font-weight: bold; font-size: 8.5px; white-space: nowrap; min-width: 90px; }
  .field span { border-bottom: 1px solid #aaa; flex: 1; min-height: 14px; padding: 0 2px; display: block; }
  .sign-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 30px; text-align: center; }
  .sign-row div { border-top: 1px solid #000; padding-top: 4px; font-weight: bold; font-size: 9px; }
  .footer { margin-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 8px; color: #555; border-top: 1px solid #ccc; padding-top: 6px; }
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

<div class="page-title">Formato de Cuadro Eléctrico</div>

<div class="meta-row" style="margin-bottom:8px;">
  <div class="meta-field"><span class="meta-label">LUGAR (localidad):</span><span class="meta-value">${client?.company_name || ''} — ${rec.location || ''}</span></div>
  <div class="meta-field"><span class="meta-label">NOMBRE DEL POZO:</span><span class="meta-value">${rec.well_name || ''}</span></div>
  <div class="meta-field"><span class="meta-label">CLIENTE:</span><span class="meta-value">${client?.company_name || ''}</span></div>
  <div class="meta-field"><span class="meta-label">FECHA:</span><span class="meta-value">${rec.record_date || ''}</span></div>
</div>

<div class="section-title">Transformador</div>
<div class="section-grid">
  <div class="col">
    <div class="field"><label>MARCA</label><span>${rec.trans_brand || ''}</span></div>
    <div class="field"><label>CAPACIDAD</label><span>${rec.trans_capacity || ''}</span></div>
    <div class="field"><label>PARARRAYOS</label><span>${rec.trans_lightning_rods || ''}</span></div>
    <div class="field"><label>CUCHILLAS</label><span>${rec.trans_switches || ''}</span></div>
  </div>
  <div class="col">
    <div class="field"><label>AISLADORES</label><span>${rec.trans_insulators || ''}</span></div>
    <div class="field"><label>FUSIBLES</label><span>${rec.trans_fuses || ''}</span></div>
    <div class="field"><label>DIELÉCTRICO</label><span>${rec.trans_dielectric || ''}</span></div>
    <div class="field"><label>CALIBRE DE CABLE</label><span>${rec.trans_cable_gauge || ''}</span></div>
  </div>
</div>

<div class="section-title">Arrancador</div>
<div class="section-grid">
  <div class="col">
    <div class="field"><label>MODELO</label><span>${rec.starter_model || ''}</span></div>
    <div class="field"><label>CAPACIDAD</label><span>${rec.starter_capacity || ''}</span></div>
    <div class="field"><label>PROTECCIÓN</label><span>${rec.starter_protection || ''}</span></div>
  </div>
  <div class="col">
    <div class="field"><label>CANALIZADO</label><span>${yesNo(rec.starter_channeled)}</span></div>
  </div>
</div>

<div class="section-title">Motor</div>
<div class="section-grid">
  <div class="col">
    <div class="field"><label>MARCA</label><span>${rec.motor_brand || ''}</span></div>
    <div class="field"><label>POTENCIA</label><span>${rec.motor_power || ''}</span></div>
    <div class="field"><label>AMPERAJE</label><span>${rec.motor_amperage || ''}</span></div>
    <div class="field"><label>FRECUENCIA</label><span>${rec.motor_frequency || ''}</span></div>
    <div class="field"><label>MEGGEO</label><span>${rec.motor_meggeo || ''}</span></div>
  </div>
  <div class="col">
    <div class="field"><label>ALIMENTACIÓN</label><span>${rec.motor_feed || ''}</span></div>
    <div class="field"><label>SISTEMA DE TIERRAS</label><span>${yesNo(rec.motor_ground_system)}</span></div>
    <div class="field"><label>LUGAR DE ATERRIZAJE</label><span>${rec.motor_ground_location || ''}</span></div>
    <div class="field"><label>CALIBRE DE CABLE</label><span>${rec.motor_cable_gauge || ''}</span></div>
  </div>
</div>

<div class="section-title">Bomba</div>
<div class="section-grid">
  <div class="col">
    <div class="field"><label>MARCA</label><span>${rec.pump_brand || ''}</span></div>
    <div class="field"><label>POTENCIA</label><span>${rec.pump_power || ''}</span></div>
    <div class="field"><label>MODELO</label><span>${rec.pump_model || ''}</span></div>
  </div>
  <div class="col">
    <div class="field"><label>MATERIAL</label><span>${rec.pump_material || ''}</span></div>
    <div class="field"><label>¿REPARADA?</label><span>${yesNo(rec.pump_repaired)}</span></div>
  </div>
</div>

${rec.notes ? `<div style="margin-top:8px;"><strong style="font-size:9px;">OBSERVACIONES:</strong><div style="border:1px solid #ccc;padding:5px;min-height:30px;font-size:9px;">${rec.notes}</div></div>` : ''}

<div class="sign-row">
  <div>ENCARGADO<br/><span style="font-weight:normal;font-size:10px;display:block;margin-top:4px;">${rec.responsible || ''}</span></div>
  <div>REVISÓ<br/><span style="font-weight:normal;font-size:10px;display:block;margin-top:4px;">${rec.reviewed_by || ''}</span></div>
  <div>AUTORIZÓ<br/>CLIENTE<br/><span style="font-weight:normal;font-size:10px;display:block;margin-top:4px;">${rec.authorized_by || ''}</span></div>
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
    const sectionHeader = "mb-3 flex items-center gap-2 text-sm font-bold text-white bg-blue-700 rounded-lg px-3 py-2 uppercase tracking-wide";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Formato de Cuadro Eléctrico</h2>
                    <p className="text-sm text-slate-500">Registro de transformador, arrancador, motor y bomba.</p>
                </div>
                <button onClick={() => { 
                    setForm({ ...EMPTY_FORM, folio: `No. ${(records.length + 1).toString().padStart(4, '0')}` }); 
                    setEditingId(null); 
                    setShowForm(true); 
                }}
                    className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Nuevo Registro
                </button>
            </div>

            {loading ? (
                <div className="py-12 text-center text-slate-500">Cargando...</div>
            ) : records.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="material-symbols-outlined mb-3 text-4xl text-slate-300">electrical_services</span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sin Registros</h3>
                    <p className="mt-1 text-sm text-slate-500">No hay cuadros eléctricos registrados aún.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {records.map(rec => (
                        <div key={rec.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-blue-700 text-[18px]">electrical_services</span>
                                        <span className="text-blue-700">{rec.folio || 'Sin folio'}</span>
                                        <span>— {rec.client?.company_name || 'Sin cliente'}</span>
                                    </h3>
                                    <p className="text-sm text-slate-500">{rec.well_name} {rec.location ? `· ${rec.location}` : ''}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">{rec.record_date}</span>
                                    <button onClick={() => handlePrint(rec)} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Imprimir">
                                        <span className="material-symbols-outlined text-[18px]">print</span>
                                    </button>
                                    <button onClick={() => handleEditClick(rec)} className="rounded-lg p-1.5 text-slate-400 hover:bg-primary/10 hover:text-primary" title="Editar">
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                                <div><p className="text-slate-400">Transformador</p><p className="font-medium text-slate-700 dark:text-slate-300">{rec.trans_brand || '-'} {rec.trans_capacity || ''}</p></div>
                                <div><p className="text-slate-400">Arrancador</p><p className="font-medium text-slate-700 dark:text-slate-300">{rec.starter_model || '-'} {rec.starter_capacity || ''}</p></div>
                                <div><p className="text-slate-400">Motor</p><p className="font-medium text-slate-700 dark:text-slate-300">{rec.motor_brand || '-'} {rec.motor_power || ''}</p></div>
                                <div><p className="text-slate-400">Bomba</p><p className="font-medium text-slate-700 dark:text-slate-300">{rec.pump_brand || '-'} {rec.pump_model || ''}</p></div>
                            </div>
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
                                <span className="material-symbols-outlined text-blue-700">electrical_services</span>
                                {editingId ? 'Editar Cuadro Eléctrico' : 'Nuevo Formato de Cuadro Eléctrico'}
                            </h2>
                            <button onClick={() => setShowForm(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-5 space-y-6">
                            {/* Encabezado */}
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                {renderField('Folio', 'folio')}
                                <div>
                                    <label className={labelClass}>Cliente</label>
                                    <select value={form.client_id || ''} onChange={f('client_id')} className={inputClass}>
                                        <option value="">— Cliente —</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                                    </select>
                                </div>
                                {renderField('Lugar (Localidad)', 'location', 'Ej. Cd. Guzmán')}
                                {renderField('Nombre del Pozo', 'well_name', 'Ej. La Llave 2')}
                                <div>
                                    <label className={labelClass}>Fecha</label>
                                    <input type="date" value={form.record_date || ''} onChange={f('record_date')} className={inputClass} />
                                </div>
                            </div>

                            {/* TRANSFORMADOR */}
                            <div>
                                <p className={sectionHeader}><span className="material-symbols-outlined text-[18px]">transform</span>Transformador</p>
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                    {renderField('Marca', 'trans_brand')}
                                    {renderField('Capacidad', 'trans_capacity', 'Ej. 112.5 KVA')}
                                    {renderField('Pararrayos', 'trans_lightning_rods', 'Ej. 5.5 GO')}
                                    {renderField('Cuchillas', 'trans_switches')}
                                    {renderField('Aisladores', 'trans_insulators', 'Ej. 5.5 GHS 7')}
                                    {renderField('Fusibles', 'trans_fuses', 'Ej. 7A, 4A, 4A')}
                                    {renderField('Dieléctrico', 'trans_dielectric', 'Ej. 1/4 de Vida')}
                                    {renderField('Calibre de Cable', 'trans_cable_gauge', 'Ej. 3x2/0')}
                                </div>
                            </div>

                            {/* ARRANCADOR */}
                            <div>
                                <p className={sectionHeader}><span className="material-symbols-outlined text-[18px]">power</span>Arrancador</p>
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                    {renderField('Modelo', 'starter_model', 'Ej. K981')}
                                    {renderField('Capacidad', 'starter_capacity', 'Ej. 100 HP')}
                                    {renderField('Protección', 'starter_protection', 'Ej. Bimetálico')}
                                    <div>
                                        <label className={labelClass}>Canalizado</label>
                                        {renderYesNoSelect('starter_channeled')}
                                    </div>
                                </div>
                            </div>

                            {/* MOTOR */}
                            <div>
                                <p className={sectionHeader}><span className="material-symbols-outlined text-[18px]">settings</span>Motor</p>
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                                    {renderField('Marca', 'motor_brand')}
                                    {renderField('Potencia', 'motor_power')}
                                    {renderField('Amperaje', 'motor_amperage')}
                                    {renderField('Frecuencia', 'motor_frequency', 'Ej. 60 Hz')}
                                    {renderField('Meggeo', 'motor_meggeo', 'Ej. ff, 19, 30 MΩ')}
                                    {renderField('Alimentación', 'motor_feed', 'Ej. 440V')}
                                    <div>
                                        <label className={labelClass}>Sistema de Tierras</label>
                                        {renderYesNoSelect('motor_ground_system')}
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>Lugar de Aterrizaje</label>
                                        <input type="text" value={form.motor_ground_location || ''} onChange={f('motor_ground_location')} className={inputClass} />
                                    </div>
                                    {renderField('Calibre de Cable', 'motor_cable_gauge', 'Ej. 3x4 AWG')}
                                </div>
                            </div>

                            {/* BOMBA */}
                            <div>
                                <p className={sectionHeader}><span className="material-symbols-outlined text-[18px]">water_pump</span>Bomba</p>
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                                    {renderField('Marca', 'pump_brand')}
                                    {renderField('Potencia', 'pump_power')}
                                    {renderField('Modelo', 'pump_model')}
                                    {renderField('Material', 'pump_material')}
                                    <div>
                                        <label className={labelClass}>¿Reparada?</label>
                                        {renderYesNoSelect('pump_repaired')}
                                    </div>
                                </div>
                            </div>

                            {/* Firmas + Notas */}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                                {renderField('Encargado', 'responsible')}
                                {renderField('Revisó', 'reviewed_by')}
                                {renderField('Autorizó / Cliente', 'authorized_by')}
                                <div>
                                    <label className={labelClass}>Observaciones</label>
                                    <textarea value={form.notes || ''} onChange={f('notes')} rows={2} className={inputClass} />
                                </div>
                            </div>

                            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                                <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Fotografías del Cuadro Eléctrico</label>
                                <PhotoUploader photos={photos} onPhotosChange={setPhotos} folder={`electric-panels/${editingId || 'new'}`} uploaderName={user?.full_name || 'Técnico'} />
                            </div>

                            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
                                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                                <button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-800">
                                    {saving ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Guardar Cuadro Eléctrico')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
