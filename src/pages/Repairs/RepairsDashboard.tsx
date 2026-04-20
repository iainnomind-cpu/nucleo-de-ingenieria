import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { triggerWaAutomation } from '../../lib/waAutomation';
import {
    EquipmentRepair, RepairStatus, FailureType, RepairUrgency, PickupMethod,
    ExternalWorkshop, ShippingCarrier,
    REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS, REPAIR_STATUS_ORDER,
    KANBAN_PHASES, NEXT_STATUS_MAP,
    FAILURE_TYPE_LABELS, FAILURE_TYPE_ICONS,
    URGENCY_LABELS, URGENCY_COLORS,
    PICKUP_METHOD_LABELS,
    formatCurrencyRepair, getRepairTotalCost, getRepairDaysElapsed,
} from '../../types/repairs';
import { EQUIPMENT_TYPE_ICONS } from '../../types/maintenance';

type ViewMode = 'kanban' | 'table';

export default function RepairsDashboard() {
    const navigate = useNavigate();
    const [repairs, setRepairs] = useState<EquipmentRepair[]>([]);
    const [equipment, setEquipment] = useState<any[]>([]);
    const [workshops, setWorkshops] = useState<ExternalWorkshop[]>([]);
    const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<ViewMode>('kanban');
    const [showForm, setShowForm] = useState(false);
    const [filterStatus, setFilterStatus] = useState<RepairStatus | 'all'>('all');

    const [form, setForm] = useState({
        equipment_id: '', failure_description: '', failure_type: 'other' as FailureType,
        urgency: 'normal' as RepairUrgency, reported_by: '',
        pickup_method: 'pickup' as PickupMethod, pickup_location: '', pickup_date: '',
        external_provider: '', shipping_carrier_to: '', assigned_to: '',
    });

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [rRes, eRes, wRes, cRes] = await Promise.all([
            supabase.from('equipment_repairs').select('*, equipment:installed_equipment(id, name, well_name, equipment_type, brand, model, serial_number), client:clients(id, company_name)').order('report_date', { ascending: false }),
            supabase.from('installed_equipment').select('id, name, well_name, equipment_type, client_id, client:clients(id, company_name)'),
            supabase.from('external_workshops').select('*').order('name'),
            supabase.from('shipping_carriers').select('*').order('name'),
        ]);
        setRepairs((rRes.data as EquipmentRepair[]) || []);
        setEquipment(eRes.data || []);
        setWorkshops((wRes.data as ExternalWorkshop[]) || []);
        setCarriers((cRes.data as ShippingCarrier[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const eq = equipment.find((x: any) => x.id === form.equipment_id);
        
        try {
            const { data: newRepair, error } = await supabase.from('equipment_repairs').insert({
                equipment_id: form.equipment_id,
                client_id: eq?.client_id || null,
                failure_description: form.failure_description,
                failure_type: form.failure_type,
                urgency: form.urgency,
                reported_by: form.reported_by || null,
                pickup_method: form.pickup_method,
                pickup_location: form.pickup_location || null,
                pickup_date: form.pickup_date || null,
                external_provider: form.external_provider || null,
                shipping_carrier_to: form.shipping_carrier_to || null,
                assigned_to: form.assigned_to || null,
                status: 'reported',
            }).select().single();

            if (error) throw error;

            // Auto-save new workshop
            if (form.external_provider && !workshops.find(w => w.name === form.external_provider)) {
                await supabase.from('external_workshops').insert({ name: form.external_provider });
            }

            setShowForm(false);
            setForm({ equipment_id: '', failure_description: '', failure_type: 'other', urgency: 'normal', reported_by: '', pickup_method: 'pickup', pickup_location: '', pickup_date: '', external_provider: '', shipping_carrier_to: '', assigned_to: '' });

            // → M9: WA automation
            if (newRepair) {
                triggerWaAutomation({
                    module: 'repairs',
                    event: 'created',
                    record: {
                        equipment_name: eq?.well_name || eq?.name || '',
                        client_name: eq?.client?.company_name || '',
                        failure_description: form.failure_description,
                        status_label: 'Reportado',
                    },
                    referenceId: newRepair.id,
                });
            }

            alert('Falla reportada exitosamente.');
            fetchAll();
        } catch (err: any) {
            console.error('Error creating repair:', err);
            alert('Error al guardar la falla: ' + (err.message || JSON.stringify(err)));
        }
    };

    const handleStatusChange = async (id: string, newStatus: RepairStatus) => {
        const updates: Record<string, unknown> = { status: newStatus };
        if (newStatus === 'completed') updates.completion_date = new Date().toISOString().split('T')[0];
        await supabase.from('equipment_repairs').update(updates).eq('id', id);
        await supabase.from('repair_timeline').insert({ repair_id: id, event_type: 'status_change', new_status: newStatus, description: `Estado → ${REPAIR_STATUS_LABELS[newStatus]}` });

        // → M9: WA automation
        const r = repairs.find(x => x.id === id);
        triggerWaAutomation({
            module: 'repairs',
            event: 'status_change',
            condition: { new_status: newStatus },
            record: {
                equipment_name: r?.equipment?.well_name || r?.equipment?.name || '',
                client_name: r?.client?.company_name || '',
                failure_description: r?.failure_description || '',
                status_label: REPAIR_STATUS_LABELS[newStatus],
                external_provider: r?.external_provider || '',
                tracking_number_to: r?.tracking_number_to || '',
            },
            referenceId: id,
        });

        fetchAll();
    };

    // KPIs
    const active = repairs.filter(r => !['completed', 'cancelled'].includes(r.status));
    const inLogistics = active.filter(r => ['pickup_pending', 'picked_up', 'sent_to_provider', 'return_shipped', 'return_received'].includes(r.status));
    const awaitingDiag = active.filter(r => ['received_by_provider', 'diagnosis_received'].includes(r.status));
    const pendingAuth = active.filter(r => r.status === 'quoted');
    const monthTotal = repairs
        .filter(r => { const d = new Date(r.report_date); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
        .reduce((sum, r) => sum + getRepairTotalCost(r), 0);

    const filtered = filterStatus === 'all' ? repairs : repairs.filter(r => r.status === filterStatus);

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    if (loading) return <div className="flex flex-1 items-center justify-center p-8"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Reparaciones</h2>
                    <p className="text-sm text-slate-500">Gestión completa de reparaciones externas e internas</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                        {(['kanban', 'table'] as ViewMode[]).map(v => (
                            <button key={v} onClick={() => setView(v)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${view === v ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                                <span className="material-symbols-outlined text-[16px]">{v === 'kanban' ? 'view_kanban' : 'table_rows'}</span>
                                {v === 'kanban' ? 'Kanban' : 'Tabla'}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-primary-dark">
                        <span className="material-symbols-outlined text-[18px]">add</span>Reportar Falla
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                    { label: 'Activas', value: active.length, icon: 'construction', color: 'text-amber-500', bgc: 'bg-amber-100 dark:bg-amber-900/30' },
                    { label: 'En Logística', value: inLogistics.length, icon: 'local_shipping', color: 'text-sky-500', bgc: 'bg-sky-100 dark:bg-sky-900/30' },
                    { label: 'Esperando Diag.', value: awaitingDiag.length, icon: 'troubleshoot', color: 'text-indigo-500', bgc: 'bg-indigo-100 dark:bg-indigo-900/30' },
                    { label: 'Pend. Autorizar', value: pendingAuth.length, icon: 'pending_actions', color: 'text-purple-500', bgc: 'bg-purple-100 dark:bg-purple-900/30' },
                    { label: 'Costo del Mes', value: formatCurrencyRepair(monthTotal), icon: 'payments', color: 'text-emerald-500', bgc: 'bg-emerald-100 dark:bg-emerald-900/30' },
                ].map(k => (
                    <div key={k.label} className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white/70 px-4 py-3 dark:border-slate-800/60 dark:bg-slate-900/50">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${k.bgc}`}>
                            <span className={`material-symbols-outlined ${k.color} text-[18px]`}>{k.icon}</span>
                        </div>
                        <div>
                            <p className="text-lg font-bold text-slate-900 dark:text-white">{k.value}</p>
                            <p className="text-[10px] font-semibold uppercase text-slate-400">{k.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Kanban View — 5 phase columns */}
            {view === 'kanban' && (
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {KANBAN_PHASES.map(phase => {
                        const items = repairs.filter(r => phase.statuses.includes(r.status));
                        return (
                            <div key={phase.key} className={`flex min-w-[300px] flex-1 flex-col rounded-xl border border-slate-200/60 bg-slate-50/50 dark:border-slate-800/60 dark:bg-slate-900/30`}>
                                <div className={`flex items-center justify-between border-b border-slate-200/60 px-4 py-3 dark:border-slate-800 border-t-4 rounded-t-xl ${phase.color}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] text-slate-600 dark:text-slate-300">{phase.icon}</span>
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">{phase.label}</span>
                                    </div>
                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{items.length}</span>
                                </div>
                                <div className="flex flex-1 flex-col gap-2 p-3 overflow-y-auto max-h-[60vh]">
                                    {items.length === 0 && <p className="text-center text-xs text-slate-400 py-6">Sin reparaciones</p>}
                                    {items.map(r => (
                                        <KanbanCard key={r.id} repair={r} onStatusChange={handleStatusChange} onClick={() => navigate(`/repairs/${r.id}`)} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Table View */}
            {view === 'table' && (
                <div className="space-y-3">
                    <div className="flex gap-1 flex-wrap">
                        <button onClick={() => setFilterStatus('all')} className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${filterStatus === 'all' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'}`}>Todas ({repairs.length})</button>
                        {REPAIR_STATUS_ORDER.filter(s => s !== 'cancelled').map(s => {
                            const count = repairs.filter(r => r.status === s).length;
                            if (count === 0 && !['reported'].includes(s)) return null;
                            return (
                                <button key={s} onClick={() => setFilterStatus(s)} className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${filterStatus === s ? `${REPAIR_STATUS_COLORS[s].bg} ${REPAIR_STATUS_COLORS[s].text}` : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'}`}>
                                    {REPAIR_STATUS_LABELS[s]} ({count})
                                </button>
                            );
                        })}
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white/50 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-500">Equipo</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-500">Cliente</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-500">Proveedor</th>
                                    <th className="px-3 py-3 text-center font-semibold text-slate-500">Estado</th>
                                    <th className="px-3 py-3 text-center font-semibold text-slate-500">Urgencia</th>
                                    <th className="px-3 py-3 text-center font-semibold text-slate-500">Guía</th>
                                    <th className="px-3 py-3 text-right font-semibold text-slate-500">Cotización</th>
                                    <th className="px-3 py-3 text-right font-semibold text-slate-500">Días</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filtered.map(r => {
                                    const days = getRepairDaysElapsed(r.report_date);
                                    return (
                                        <tr key={r.id} onClick={() => navigate(`/repairs/${r.id}`)} className="cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-primary text-[16px]">{EQUIPMENT_TYPE_ICONS[r.equipment?.equipment_type as keyof typeof EQUIPMENT_TYPE_ICONS] || 'settings'}</span>
                                                    <div>
                                                        <p className="font-semibold text-slate-900 dark:text-white">{r.equipment?.well_name || r.equipment?.name}</p>
                                                        <p className="text-[11px] text-slate-400">{r.equipment?.brand} {r.equipment?.model}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.client?.company_name || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.external_provider || '—'}</td>
                                            <td className="px-3 py-3 text-center">
                                                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${REPAIR_STATUS_COLORS[r.status].bg} ${REPAIR_STATUS_COLORS[r.status].text}`}>{REPAIR_STATUS_LABELS[r.status]}</span>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${URGENCY_COLORS[r.urgency].bg} ${URGENCY_COLORS[r.urgency].text}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${URGENCY_COLORS[r.urgency].dot}`} />{URGENCY_LABELS[r.urgency]}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-center text-xs font-mono text-slate-500">{r.tracking_number_to || '—'}</td>
                                            <td className="px-3 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">{r.quote_amount > 0 ? formatCurrencyRepair(r.quote_amount) : '—'}</td>
                                            <td className="px-3 py-3 text-right">
                                                <span className={`font-bold ${days > 15 ? 'text-red-500' : days > 7 ? 'text-amber-500' : 'text-slate-500'}`}>{days}d</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-sm text-slate-500">No hay reparaciones.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create Repair Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-red-500 text-[22px]">report</span>Reportar Falla
                            </h3>
                            <button onClick={() => setShowForm(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><span className="material-symbols-outlined text-[20px]">close</span></button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="md:col-span-2"><label className={labelClass}>Equipo *</label>
                                    <select value={form.equipment_id} onChange={e => setForm({ ...form, equipment_id: e.target.value })} required className={inputClass}>
                                        <option value="">Seleccionar equipo...</option>
                                        {equipment.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.well_name ? `${eq.well_name} — ` : ''}{eq.name} {eq.client?.company_name ? `(${eq.client.company_name})` : ''}</option>)}
                                    </select>
                                </div>
                                <div><label className={labelClass}>Tipo de Falla</label>
                                    <select value={form.failure_type} onChange={e => setForm({ ...form, failure_type: e.target.value as FailureType })} className={inputClass}>
                                        {(Object.keys(FAILURE_TYPE_LABELS) as FailureType[]).map(t => <option key={t} value={t}>{FAILURE_TYPE_LABELS[t]}</option>)}
                                    </select>
                                </div>
                                <div><label className={labelClass}>Urgencia</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(['low', 'normal', 'high', 'critical'] as RepairUrgency[]).map(u => (
                                            <button key={u} type="button" onClick={() => setForm({ ...form, urgency: u })}
                                                className={`rounded-lg border-2 px-2 py-2 text-xs font-semibold transition-all ${form.urgency === u ? `border-current ${URGENCY_COLORS[u].bg} ${URGENCY_COLORS[u].text}` : 'border-slate-200 text-slate-400 dark:border-slate-700'}`}>
                                                {URGENCY_LABELS[u]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="md:col-span-2"><label className={labelClass}>Descripción de la Falla *</label>
                                    <textarea value={form.failure_description} onChange={e => setForm({ ...form, failure_description: e.target.value })} required rows={3} placeholder="Describe detalladamente el problema..." className={inputClass + ' resize-none'} />
                                </div>

                                {/* Recolección */}
                                <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">local_shipping</span>Recolección del Equipo</p>
                                </div>
                                <div><label className={labelClass}>Método de Recolección</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(Object.keys(PICKUP_METHOD_LABELS) as PickupMethod[]).map(m => (
                                            <button key={m} type="button" onClick={() => setForm({ ...form, pickup_method: m })}
                                                className={`rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-all ${form.pickup_method === m ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}>
                                                {PICKUP_METHOD_LABELS[m]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div><label className={labelClass}>Lugar de Recolección</label><input value={form.pickup_location} onChange={e => setForm({ ...form, pickup_location: e.target.value })} placeholder="Dirección o sitio del cliente" className={inputClass} /></div>
                                <div><label className={labelClass}>Fecha Recolección</label><input type="date" value={form.pickup_date} onChange={e => setForm({ ...form, pickup_date: e.target.value })} className={inputClass} /></div>

                                {/* Proveedor */}
                                <div><label className={labelClass}>Proveedor / Taller</label>
                                    <input list="workshops-list" value={form.external_provider} onChange={e => setForm({ ...form, external_provider: e.target.value })} placeholder="Nombre del taller..." className={inputClass} />
                                    <datalist id="workshops-list">{workshops.map(w => <option key={w.id} value={w.name} />)}</datalist>
                                </div>
                                <div><label className={labelClass}>Paquetería Envío</label>
                                    <input list="carriers-list" value={form.shipping_carrier_to} onChange={e => setForm({ ...form, shipping_carrier_to: e.target.value })} placeholder="Fedex, DHL..." className={inputClass} />
                                    <datalist id="carriers-list">{carriers.map(c => <option key={c.id} value={c.name} />)}</datalist>
                                </div>

                                <div><label className={labelClass}>Reportado por</label><input value={form.reported_by} onChange={e => setForm({ ...form, reported_by: e.target.value })} placeholder="Nombre" className={inputClass} /></div>
                                <div><label className={labelClass}>Asignado a</label><input value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} placeholder="Responsable del seguimiento" className={inputClass} /></div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400">Cancelar</button>
                                <button type="submit" className="rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-90">Registrar Reparación</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

/* Kanban Card */
function KanbanCard({ repair: r, onStatusChange, onClick }: { repair: EquipmentRepair; onStatusChange: (id: string, status: RepairStatus) => void; onClick: () => void }) {
    const days = getRepairDaysElapsed(r.report_date);
    const urgencyColor = URGENCY_COLORS[r.urgency];
    const statusColor = REPAIR_STATUS_COLORS[r.status];
    const nextOptions = NEXT_STATUS_MAP[r.status] || [];

    return (
        <div onClick={onClick} className="cursor-pointer rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800/80">
            {/* Status + urgency + days */}
            <div className="mb-2 flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor.bg} ${statusColor.text}`}>
                    <span className="material-symbols-outlined text-[12px]">{statusColor.icon}</span>{REPAIR_STATUS_LABELS[r.status]}
                </span>
                <span className={`text-[10px] font-bold ${days > 15 ? 'text-red-500' : days > 7 ? 'text-amber-500' : 'text-slate-400'}`}>{days}d</span>
            </div>

            {/* Equipment */}
            <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary text-[16px]">{EQUIPMENT_TYPE_ICONS[r.equipment?.equipment_type as keyof typeof EQUIPMENT_TYPE_ICONS] || 'settings'}</span>
                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{r.equipment?.well_name || r.equipment?.name}</p>
            </div>

            {/* Failure + urgency */}
            <p className="text-xs text-slate-500 truncate mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">{FAILURE_TYPE_ICONS[r.failure_type]}</span>
                {r.failure_description}
            </p>

            {/* Client + provider */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span className="truncate">{r.client?.company_name || '—'}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${urgencyColor.bg} ${urgencyColor.text} font-bold`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${urgencyColor.dot}`} />{URGENCY_LABELS[r.urgency]}
                </span>
            </div>

            {/* Tracking / provider */}
            {(r.external_provider || r.tracking_number_to) && (
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-2">
                    {r.external_provider && <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-[10px]">warehouse</span>{r.external_provider}</span>}
                    {r.tracking_number_to && <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">{r.tracking_number_to}</span>}
                </div>
            )}

            {/* Quote amount */}
            {r.quote_amount > 0 && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-700/60 text-[10px]">
                    <span className="text-slate-400">Cotización:</span>
                    <span className="font-bold text-emerald-600">{formatCurrencyRepair(r.quote_amount)}</span>
                </div>
            )}

            {/* Quick actions */}
            {nextOptions.length > 0 && (
                <div className="mt-2 flex gap-1 border-t border-slate-100 pt-2 dark:border-slate-700/60" onClick={e => e.stopPropagation()}>
                    {nextOptions.map(ns => (
                        <button key={ns} onClick={() => onStatusChange(r.id, ns)}
                            className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition-all ${REPAIR_STATUS_COLORS[ns].bg} ${REPAIR_STATUS_COLORS[ns].text} hover:opacity-80`}>
                            → {REPAIR_STATUS_LABELS[ns]}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
