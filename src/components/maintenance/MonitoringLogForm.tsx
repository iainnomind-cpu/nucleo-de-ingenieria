import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { MonitoringLog, MONITORING_FIELDS } from '../../types/maintenance';
import PhotoUploader from '../PhotoUploader';
import { PhotoAttachment } from '../../types/photos';

interface MonitoringLogFormProps {
    log?: MonitoringLog | null;
    equipmentId: string;
    onClose: () => void;
    onSaved: () => void;
    config: { max_voltage_unbalance: number; max_amperage_unbalance: number };
}

export default function MonitoringLogForm({ log, equipmentId, onClose, onSaved, config }: MonitoringLogFormProps) {
    const [saving, setSaving] = useState(false);
    const [monLogPhotos, setMonLogPhotos] = useState<PhotoAttachment[]>([]);
    
    const [logForm, setLogForm] = useState<Record<string, string>>({
        log_date: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0],
        recorded_by: '',
        static_level: '', dynamic_level: '', flow_rate: '', pressure: '',
        ppm: '', insulation_resistance: '', kw: '', motor_torque: '', temperature: '', frequency: '', observations: '',
        voltage: '', voltage_l1: '', voltage_l2: '', voltage_l3: '',
        amperage: '', amperage_a1: '', amperage_a2: '', amperage_a3: ''
    });

    useEffect(() => {
        if (log) {
            const formObj: Record<string, string> = {
                log_date: log.log_date,
                recorded_by: log.recorded_by || '',
                observations: log.observations || '',
                voltage_l1: log.voltage_l1?.toString() || '',
                voltage_l2: log.voltage_l2?.toString() || '',
                voltage_l3: log.voltage_l3?.toString() || '',
                amperage_a1: log.amperage_a1?.toString() || '',
                amperage_a2: log.amperage_a2?.toString() || '',
                amperage_a3: log.amperage_a3?.toString() || '',
            };
            
            MONITORING_FIELDS.forEach(f => {
                if (f.key !== 'voltage' && f.key !== 'amperage') {
                    formObj[f.key] = ((log as unknown as Record<string, number | null>)[f.key])?.toString() || '';
                }
            });
            
            setLogForm(formObj);
            setMonLogPhotos(log.photos || []);
        }
    }, [log]);

    const calculateUnbalance = (v1: string, v2: string, v3: string) => {
        const n1 = parseFloat(v1); const n2 = parseFloat(v2); const n3 = parseFloat(v3);
        if (isNaN(n1) || isNaN(n2) || isNaN(n3)) return null;
        const avg = (n1 + n2 + n3) / 3;
        if (avg === 0) return 0;
        const maxDev = Math.max(Math.abs(n1 - avg), Math.abs(n2 - avg), Math.abs(n3 - avg));
        return (maxDev / avg) * 100;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload: Record<string, unknown> = { 
                equipment_id: equipmentId, 
                log_date: logForm.log_date, 
                recorded_by: logForm.recorded_by || null, 
                observations: logForm.observations || null, 
                photos: monLogPhotos 
            };
            
            MONITORING_FIELDS.forEach(f => { 
                if (f.key !== 'voltage' && f.key !== 'amperage' && logForm[f.key]) {
                    payload[f.key] = parseFloat(logForm[f.key]); 
                } else if (f.key !== 'voltage' && f.key !== 'amperage') {
                    payload[f.key] = null; // Clear if empty
                }
            });

            const phaseFields = ['voltage_l1', 'voltage_l2', 'voltage_l3', 'amperage_a1', 'amperage_a2', 'amperage_a3'];
            phaseFields.forEach(k => {
                 if (logForm[k]) payload[k] = parseFloat(logForm[k]);
                 else payload[k] = null;
            });

            const vUnb = calculateUnbalance(logForm.voltage_l1, logForm.voltage_l2, logForm.voltage_l3);
            if (vUnb !== null) {
                payload.voltage_unbalance = vUnb;
                payload.voltage = (parseFloat(logForm.voltage_l1) + parseFloat(logForm.voltage_l2) + parseFloat(logForm.voltage_l3)) / 3;
            } else {
                payload.voltage_unbalance = null;
                payload.voltage = null;
            }
            
            const aUnb = calculateUnbalance(logForm.amperage_a1, logForm.amperage_a2, logForm.amperage_a3);
            if (aUnb !== null) {
                payload.amperage_unbalance = aUnb;
                payload.amperage = (parseFloat(logForm.amperage_a1) + parseFloat(logForm.amperage_a2) + parseFloat(logForm.amperage_a3)) / 3;
            } else {
                payload.amperage_unbalance = null;
                payload.amperage = null;
            }

            if (log) {
                const { error } = await supabase.from('monitoring_logs').update(payload).eq('id', log.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('monitoring_logs').insert(payload);
                if (error) throw error;
            }

            onSaved();
            onClose();
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!log || !confirm('¿Estás seguro de que deseas eliminar esta bitácora?')) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('monitoring_logs').delete().eq('id', log.id);
            if (error) throw error;
            onSaved();
            onClose();
        } catch (error: any) {
            alert('Error: ' + error.message);
            setSaving(false);
        }
    };

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl dark:bg-slate-900 my-8">
                <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {log ? 'Editar Bitácora de Monitoreo' : 'Nueva Lectura de Monitoreo'}
                    </h2>
                    <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        <div><label className={labelClass}>Fecha</label><input type="date" value={logForm.log_date} onChange={e => setLogForm({ ...logForm, log_date: e.target.value })} className={inputClass} required /></div>
                        <div><label className={labelClass}>Registrado por</label><input value={logForm.recorded_by} onChange={e => setLogForm({ ...logForm, recorded_by: e.target.value })} className={inputClass} placeholder="Nombre" /></div>
                        
                        {MONITORING_FIELDS.filter(f => f.key !== 'voltage' && f.key !== 'amperage').map(f => (
                            <div key={f.key}><label className={labelClass}>{f.label} ({f.unit})</label><input type="number" step="0.01" value={logForm[f.key]} onChange={e => setLogForm({ ...logForm, [f.key]: e.target.value })} className={inputClass} placeholder={f.unit} /></div>
                        ))}
                        
                        {/* Tensión (Voltaje) Trifásico */}
                        <div className="col-span-full border-t border-slate-200 dark:border-slate-700 mt-2 pt-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className={labelClass + " !mb-0"}>Tensión Fases L1, L2, L3 (V)</label>
                                {calculateUnbalance(logForm.voltage_l1, logForm.voltage_l2, logForm.voltage_l3) !== null && (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${calculateUnbalance(logForm.voltage_l1, logForm.voltage_l2, logForm.voltage_l3)! <= config.max_voltage_unbalance ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30'}`}>
                                        Desbalance: {calculateUnbalance(logForm.voltage_l1, logForm.voltage_l2, logForm.voltage_l3)?.toFixed(1)}% (Max {config.max_voltage_unbalance}%)
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <input type="number" step="0.1" value={logForm.voltage_l1} onChange={e => setLogForm({ ...logForm, voltage_l1: e.target.value })} className={inputClass} placeholder="V1" />
                                <input type="number" step="0.1" value={logForm.voltage_l2} onChange={e => setLogForm({ ...logForm, voltage_l2: e.target.value })} className={inputClass} placeholder="V2" />
                                <input type="number" step="0.1" value={logForm.voltage_l3} onChange={e => setLogForm({ ...logForm, voltage_l3: e.target.value })} className={inputClass} placeholder="V3" />
                            </div>
                        </div>

                        {/* Corriente (Amperaje) Trifásico */}
                        <div className="col-span-full border-b border-slate-200 dark:border-slate-700 mb-2 pb-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className={labelClass + " !mb-0"}>Corriente Fases L1, L2, L3 (A)</label>
                                {calculateUnbalance(logForm.amperage_a1, logForm.amperage_a2, logForm.amperage_a3) !== null && (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${calculateUnbalance(logForm.amperage_a1, logForm.amperage_a2, logForm.amperage_a3)! <= config.max_amperage_unbalance ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30'}`}>
                                        Desbalance: {calculateUnbalance(logForm.amperage_a1, logForm.amperage_a2, logForm.amperage_a3)?.toFixed(1)}% (Max {config.max_amperage_unbalance}%)
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <input type="number" step="0.1" value={logForm.amperage_a1} onChange={e => setLogForm({ ...logForm, amperage_a1: e.target.value })} className={inputClass} placeholder="A1" />
                                <input type="number" step="0.1" value={logForm.amperage_a2} onChange={e => setLogForm({ ...logForm, amperage_a2: e.target.value })} className={inputClass} placeholder="A2" />
                                <input type="number" step="0.1" value={logForm.amperage_a3} onChange={e => setLogForm({ ...logForm, amperage_a3: e.target.value })} className={inputClass} placeholder="A3" />
                            </div>
                        </div>
                        
                        <div className="col-span-full"><label className={labelClass}>Observaciones</label><textarea value={logForm.observations} onChange={e => setLogForm({ ...logForm, observations: e.target.value })} rows={2} className={inputClass + ' resize-none'} placeholder="Notas de campo..." /></div>
                        
                        <div className="col-span-full">
                            <label className={labelClass}>Evidencia Fotográfica</label>
                            <PhotoUploader
                                photos={monLogPhotos}
                                onPhotosChange={setMonLogPhotos}
                                folder={`monitoring/${equipmentId}`}
                                uploaderName={logForm.recorded_by || 'Técnico'}
                                compact
                            />
                        </div>
                    </div>
                    
                    <div className="mt-6 flex justify-between border-t border-slate-100 pt-5 dark:border-slate-800">
                        {log ? (
                            <button type="button" onClick={handleDelete} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">
                                Eliminar
                            </button>
                        ) : (
                            <div></div>
                        )}
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                            <button type="submit" disabled={saving} className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-primary-dark">
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
