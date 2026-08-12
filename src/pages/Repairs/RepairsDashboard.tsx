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
type EquipSource = 'warehouse' | 'client';

const CATEGORY_LABELS: Record<string, string> = {
    bomba: 'Bomba', motor: 'Motor', soldadora: 'Soldadora',
    generador: 'Generador', compresor: 'Compresor', pulidora: 'Pulidora', otro: 'Otro',
};
const CATEGORY_COLORS: Record<string, string> = {
    bomba: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    motor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    soldadora: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    generador: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    compresor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    pulidora: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    otro: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};
const CATEGORY_ICONS: Record<string, string> = {
    bomba: 'water_pump', motor: 'settings', soldadora: 'electric_bolt',
    generador: 'power', compresor: 'compress', pulidora: 'circle', otro: 'build',
};

export default function RepairsDashboard() {
    const navigate = useNavigate();
    const [repairs, setRepairs] = useState<EquipmentRepair[]>([]);
    const [equipment, setEquipment] = useState<any[]>([]);
    const [warehouseEquipment, setWarehouseEquipment] = useState<any[]>([]);
    const [workshops, setWorkshops] = useState<ExternalWorkshop[]>([]);
    const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<ViewMode>('kanban');
    const [showForm, setShowForm] = useState(false);
    const [filterStatus, setFilterStatus] = useState<RepairStatus | 'all'>('all');
    const [equipSource, setEquipSource] = useState<EquipSource>('warehouse');

    // Observations state
    const [showObsForm, setShowObsForm] = useState(false);
    const [selectedWarehouseEq, setSelectedWarehouseEq] = useState<any | null>(null);
    const [obsText, setObsText] = useState('');
    const [obsBy, setObsBy] = useState('');
    const [obsStatus, setObsStatus] = useState<'pendiente' | 'revisado' | 'resuelto'>('pendiente');

    // Warehouse equipment management
    const [showWarehouseForm, setShowWarehouseForm] = useState(false);
    const [warehouseForm, setWarehouseForm] = useState({
        name: '', category: 'bomba', brand: '', model: '', serial_number: '', power_hp: '', status: 'available', location: 'Bodega Núcleo', notes: '',
    });
    const [filterCategory, setFilterCategory] = useState<string>('all');

    const [form, setForm] = useState({
        is_external: false, equipment_id: '', external_equipment_name: '', client_name_input: '', failure_description: '', failure_type: 'other' as FailureType,
        urgency: 'normal' as RepairUrgency, reported_by: '',
        pickup_method: 'pickup' as PickupMethod, pickup_location: '', pickup_date: '',
        external_provider: '', shipping_carrier_to: '', assigned_to: '',
    });

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [rRes, eRes, wRes, cRes, cliRes, weRes] = await Promise.all([
            supabase.from('equipment_repairs').select('*, equipment:installed_equipment(id, name, well_name, equipment_type, brand, model, serial_number), client:clients(id, company_name)').order('report_date', { ascending: false }),
            supabase.from('installed_equipment').select('id, name, well_name, equipment_type, client_id, client:clients(id, company_name)'),
            supabase.from('external_workshops').select('*').order('name'),
            supabase.from('shipping_carriers').select('*').order('name'),
            supabase.from('clients').select('id, company_name').order('company_name'),
            supabase.from('warehouse_equipment').select('*, observations:warehouse_equipment_observations(*)').order('category').order('name'),
        ]);
        setRepairs((rRes.data as EquipmentRepair[]) || []);
        setEquipment(eRes.data || []);
        setWorkshops((wRes.data as ExternalWorkshop[]) || []);
        setCarriers((cRes.data as ShippingCarrier[]) || []);
        setClients(cliRes.data || []);
        setWarehouseEquipment((weRes.data as any[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const eq = equipment.find((x: any) => x.id === form.equipment_id);

        let resolvedClientId = null;
        let resolvedExternalClientName = null;

        if (equipSource === 'client') {
            const matchedClient = clients.find(c => c.company_name === form.client_name_input);
            if (matchedClient) {
                resolvedClientId = matchedClient.id;
            } else if (form.client_name_input.trim()) {
                resolvedExternalClientName = form.client_name_input.trim();
            }
        } else if (equipSource === 'warehouse') {
            // No client for warehouse repairs
        }

        try {
            const { data: newRepair, error } = await supabase.from('equipment_repairs').insert({
                equipment_id: equipSource === 'client' && !form.is_external ? form.equipment_id || null : null,
                warehouse_equipment_id: equipSource === 'warehouse' ? form.equipment_id || null : null,
                repair_source: equipSource,
                external_equipment_name: (equipSource === 'client' && form.is_external) ? form.external_equipment_name : null,
                client_id: resolvedClientId,
                external_client_name: resolvedExternalClientName,
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

            // Update warehouse equipment status to in_repair
            if (equipSource === 'warehouse' && form.equipment_id) {
                await supabase.from('warehouse_equipment').update({ status: 'in_repair' }).eq('id', form.equipment_id);
            }

            // Auto-save new workshop
            if (form.external_provider && !workshops.find(w => w.name === form.external_provider)) {
                await supabase.from('external_workshops').insert({ name: form.external_provider });
            }

            const resetForm = { is_external: false, equipment_id: '', external_equipment_name: '', client_name_input: '', failure_description: '', failure_type: 'other' as FailureType, urgency: 'normal' as RepairUrgency, reported_by: '', pickup_method: 'pickup' as PickupMethod, pickup_location: '', pickup_date: '', external_provider: '', shipping_carrier_to: '', assigned_to: '' };
            setShowForm(false);
            setForm(resetForm);

            // → M9: WA automation
            if (newRepair) {
                const eqName = equipSource === 'warehouse'
                    ? warehouseEquipment.find(w => w.id === form.equipment_id)?.name || ''
                    : (form.is_external ? form.external_equipment_name : (eq?.well_name || eq?.name || ''));
                triggerWaAutomation({
                    module: 'repairs',
                    event: 'created',
                    record: {
                        equipment_name: eqName,
                        client_name: resolvedExternalClientName || (clients.find(c => c.id === resolvedClientId)?.company_name) || 'Bodega Núcleo',
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

        // If completed, restore warehouse equipment status
        if (newStatus === 'completed') {
            const r = repairs.find(x => x.id === id);
            if ((r as any)?.warehouse_equipment_id) {
                await supabase.from('warehouse_equipment').update({ status: 'available' }).eq('id', (r as any).warehouse_equipment_id);
            }
        }

        // → M9: WA automation
        const r = repairs.find(x => x.id === id);
        triggerWaAutomation({
            module: 'repairs',
            event: 'status_change',
            condition: { new_status: newStatus },
            record: {
                equipment_name: r?.external_equipment_name || r?.equipment?.well_name || r?.equipment?.name || '',
                client_name: r?.external_client_name || r?.client?.company_name || '',
                failure_description: r?.failure_description || '',
                status_label: REPAIR_STATUS_LABELS[newStatus],
                external_provider: r?.external_provider || '',
                tracking_number_to: r?.tracking_number_to || '',
            },
            referenceId: id,
        });

        fetchAll();
    };

    const handleSaveObs = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWarehouseEq || !obsText.trim()) return;
        await supabase.from('warehouse_equipment_observations').insert({
            equipment_id: selectedWarehouseEq.id,
            observation: obsText.trim(),
            reported_by: obsBy.trim() || null,
            observation_date: new Date().toISOString().split('T')[0],
            status: obsStatus,
        });
        setObsText('');
        setObsBy('');
        setObsStatus('pendiente');
        setShowObsForm(false);
        setSelectedWarehouseEq(null);
        fetchAll();
    };

    const handleResolveObs = async (obsId: string) => {
        await supabase.from('warehouse_equipment_observations').update({ status: 'resuelto' }).eq('id', obsId);
        fetchAll();
    };

    const handleSaveWarehouseEquip = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from('warehouse_equipment').insert([warehouseForm]);
        setShowWarehouseForm(false);
        setWarehouseForm({ name: '', category: 'bomba', brand: '', model: '', serial_number: '', power_hp: '', status: 'available', location: 'Bodega Núcleo', notes: '' });
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

    const filteredWarehouse = filterCategory === 'all'
        ? warehouseEquipment
        : warehouseEquipment.filter(eq => eq.category === filterCategory);

    const totalPendingObs = warehouseEquipment.reduce((sum, eq) =>
        sum + (eq.observations || []).filter((o: any) => o.status === 'pendiente').length, 0);

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

            {/* ═══════════════════════════════════════════════
                EQUIPOS DE BODEGA — Observaciones
            ═══════════════════════════════════════════════ */}
            <div className="rounded-xl border border-orange-200/60 bg-gradient-to-br from-orange-50/60 to-amber-50/30 p-5 shadow-sm dark:border-orange-800/40 dark:bg-orange-900/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 shadow-md">
                            <span className="material-symbols-outlined text-white text-[20px]">warehouse</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                Equipos de Bodega — Observaciones
                                {totalPendingObs > 0 && (
                                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{totalPendingObs}</span>
                                )}
                            </h3>
                            <p className="text-xs text-slate-500">{warehouseEquipment.length} equipos registrados en bodega Núcleo</p>
                        </div>
                    </div>
                    <button onClick={() => setShowWarehouseForm(true)}
                        className="flex items-center gap-1.5 rounded-lg border border-orange-300 bg-white px-3 py-2 text-xs font-semibold text-orange-700 shadow-sm hover:bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Agregar Equipo
                    </button>
                </div>

                {/* Filtro por categoría */}
                <div className="mb-4 flex flex-wrap gap-1.5">
                    <button onClick={() => setFilterCategory('all')}
                        className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${filterCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-orange-300'}`}>
                        Todos ({warehouseEquipment.length})
                    </button>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                        const count = warehouseEquipment.filter(e => e.category === key).length;
                        if (count === 0) return null;
                        return (
                            <button key={key} onClick={() => setFilterCategory(key)}
                                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${filterCategory === key ? 'bg-orange-500 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-orange-300'}`}>
                                {label} ({count})
                            </button>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredWarehouse.map((eq: any) => {
                        const pendingObs = (eq.observations || []).filter((o: any) => o.status === 'pendiente').length;
                        const catColor = CATEGORY_COLORS[eq.category] || CATEGORY_COLORS.otro;
                        const catIcon = CATEGORY_ICONS[eq.category] || 'build';
                        const sortedObs = [...(eq.observations || [])].sort((a: any, b: any) =>
                            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                        );
                        return (
                            <div key={eq.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${catColor}`}>
                                            <span className="material-symbols-outlined text-[14px]">{catIcon}</span>
                                        </div>
                                        <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight truncate">{eq.name}</p>
                                    </div>
                                    {pendingObs > 0 && (
                                        <span className="ml-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{pendingObs}</span>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${catColor}`}>{CATEGORY_LABELS[eq.category] || eq.category}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        eq.status === 'available' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                        eq.status === 'in_repair' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                        {eq.status === 'available' ? '✓ Disponible' : eq.status === 'in_repair' ? '⚙ En Reparación' : '✗ Fuera de Servicio'}
                                    </span>
                                    {eq.power_hp && <span className="text-[10px] text-slate-400">{eq.power_hp}</span>}
                                </div>

                                {/* Últimas observaciones */}
                                {sortedObs.slice(0, 2).map((obs: any) => (
                                    <div key={obs.id} className={`mb-1.5 rounded-lg p-2 text-xs ${
                                        obs.status === 'pendiente' ? 'bg-amber-50 border border-amber-200/80 dark:bg-amber-900/20 dark:border-amber-800/50' :
                                        obs.status === 'resuelto' ? 'bg-emerald-50 border border-emerald-200/80 dark:bg-emerald-900/20 dark:border-emerald-800/50' :
                                        'bg-slate-50 border border-slate-100 dark:bg-slate-700/30 dark:border-slate-700'
                                    }`}>
                                        <div className="flex items-start justify-between gap-1">
                                            <p className="text-slate-700 dark:text-slate-300 flex-1">{obs.observation}</p>
                                            {obs.status === 'pendiente' && (
                                                <button onClick={() => handleResolveObs(obs.id)}
                                                    className="flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 transition-all"
                                                    title="Marcar como resuelto">✓</button>
                                            )}
                                        </div>
                                        <p className="text-slate-400 mt-0.5">{obs.observation_date}{obs.reported_by ? ` · ${obs.reported_by}` : ''}</p>
                                    </div>
                                ))}
                                {sortedObs.length > 2 && (
                                    <p className="text-[10px] text-slate-400 mb-1.5">+{sortedObs.length - 2} más...</p>
                                )}

                                <button
                                    onClick={() => { setSelectedWarehouseEq(eq); setShowObsForm(true); }}
                                    className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 dark:border-orange-800/60 dark:bg-orange-900/20 dark:text-orange-400 transition-all">
                                    <span className="material-symbols-outlined text-[14px]">add_comment</span>
                                    Agregar Observación
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Kanban View */}
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
                                    <th className="px-4 py-3 text-left font-semibold text-slate-500">Cliente / Bodega</th>
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
                                    const isWarehouse = (r as any).repair_source === 'warehouse';
                                    return (
                                        <tr key={r.id} onClick={() => navigate(`/repairs/${r.id}`)} className="cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`material-symbols-outlined text-[16px] ${isWarehouse ? 'text-orange-500' : 'text-primary'}`}>
                                                        {r.equipment ? (EQUIPMENT_TYPE_ICONS[r.equipment.equipment_type as keyof typeof EQUIPMENT_TYPE_ICONS] || 'settings') : 'handyman'}
                                                    </span>
                                                    <div>
                                                        <p className="font-semibold text-slate-900 dark:text-white">{r.external_equipment_name || r.equipment?.well_name || r.equipment?.name}</p>
                                                        {r.equipment && <p className="text-[11px] text-slate-400">{r.equipment?.brand} {r.equipment?.model}</p>}
                                                        {isWarehouse && <span className="text-[10px] rounded-full bg-orange-100 text-orange-700 px-1.5 py-0.5 font-bold">Bodega</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                {isWarehouse ? <span className="text-orange-600 font-medium">Bodega Núcleo</span> : (r.external_client_name || r.client?.company_name || '—')}
                                            </td>
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

            {/* ═══ MODAL: Agregar Observación ═══ */}
            {showObsForm && selectedWarehouseEq && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-orange-500 mb-0.5">Observación de Equipo</p>
                                <h3 className="font-bold text-slate-900 dark:text-white">{selectedWarehouseEq.name}</h3>
                            </div>
                            <button onClick={() => { setShowObsForm(false); setSelectedWarehouseEq(null); }} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSaveObs} className="space-y-4">
                            <div>
                                <label className={labelClass}>Observación *</label>
                                <textarea value={obsText} onChange={e => setObsText(e.target.value)} required rows={3}
                                    placeholder="Describe el problema o condición del equipo..."
                                    className={inputClass + ' resize-none'} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Reportado por</label>
                                    <input value={obsBy} onChange={e => setObsBy(e.target.value)} placeholder="Nombre" className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Estado</label>
                                    <select value={obsStatus} onChange={e => setObsStatus(e.target.value as any)} className={inputClass}>
                                        <option value="pendiente">Pendiente</option>
                                        <option value="revisado">Revisado</option>
                                        <option value="resuelto">Resuelto</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-1">
                                <button type="button" onClick={() => { setShowObsForm(false); setSelectedWarehouseEq(null); }} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
                                <button type="submit" className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-orange-600">Guardar Observación</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ MODAL: Agregar Equipo de Bodega ═══ */}
            {showWarehouseForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
                        <div className="mb-5 flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-orange-500">add_box</span>
                                Agregar Equipo de Bodega
                            </h3>
                            <button onClick={() => setShowWarehouseForm(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSaveWarehouseEquip} className="space-y-4">
                            <div>
                                <label className={labelClass}>Nombre del Equipo *</label>
                                <input value={warehouseForm.name} onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })} required placeholder="Ej. Bomba Franklin 100HP" className={inputClass} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Categoría</label>
                                    <select value={warehouseForm.category} onChange={e => setWarehouseForm({ ...warehouseForm, category: e.target.value })} className={inputClass}>
                                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Marca</label>
                                    <input value={warehouseForm.brand} onChange={e => setWarehouseForm({ ...warehouseForm, brand: e.target.value })} placeholder="Ej. Franklin, Altamira" className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Modelo</label>
                                    <input value={warehouseForm.model} onChange={e => setWarehouseForm({ ...warehouseForm, model: e.target.value })} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Potencia</label>
                                    <input value={warehouseForm.power_hp} onChange={e => setWarehouseForm({ ...warehouseForm, power_hp: e.target.value })} placeholder="Ej. 100 HP, 1000W" className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>No. Serie</label>
                                    <input value={warehouseForm.serial_number} onChange={e => setWarehouseForm({ ...warehouseForm, serial_number: e.target.value })} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Estado</label>
                                    <select value={warehouseForm.status} onChange={e => setWarehouseForm({ ...warehouseForm, status: e.target.value })} className={inputClass}>
                                        <option value="available">Disponible</option>
                                        <option value="in_repair">En Reparación</option>
                                        <option value="out_of_service">Fuera de Servicio</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Notas</label>
                                <textarea value={warehouseForm.notes} onChange={e => setWarehouseForm({ ...warehouseForm, notes: e.target.value })} rows={2} className={inputClass + ' resize-none'} />
                            </div>
                            <div className="flex justify-end gap-3 pt-1">
                                <button type="button" onClick={() => setShowWarehouseForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
                                <button type="submit" className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-orange-600">Guardar Equipo</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ MODAL: Reportar Falla ═══ */}
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

                                {/* Selector de origen del equipo */}
                                <div className="md:col-span-2">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className={labelClass + ' mb-0'}>Equipo *</label>
                                        <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                                            <button type="button"
                                                onClick={() => { setEquipSource('warehouse'); setForm({ ...form, is_external: false, equipment_id: '' }); }}
                                                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${equipSource === 'warehouse' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                                <span className="material-symbols-outlined text-[14px]">warehouse</span>
                                                Bodega Núcleo
                                            </button>
                                            <button type="button"
                                                onClick={() => { setEquipSource('client'); setForm({ ...form, is_external: true, equipment_id: '' }); }}
                                                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${equipSource === 'client' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                                <span className="material-symbols-outlined text-[14px]">person</span>
                                                Equipo de Cliente
                                            </button>
                                        </div>
                                    </div>

                                    {equipSource === 'warehouse' ? (
                                        <select value={form.equipment_id} onChange={e => setForm({ ...form, equipment_id: e.target.value })} required className={inputClass}>
                                            <option value="">Seleccionar equipo de bodega...</option>
                                            {['bomba', 'motor', 'soldadora', 'generador', 'compresor', 'pulidora', 'otro'].map(cat => {
                                                const catEquip = warehouseEquipment.filter(eq => eq.category === cat);
                                                if (catEquip.length === 0) return null;
                                                return (
                                                    <optgroup key={cat} label={`── ${CATEGORY_LABELS[cat] || cat} ──`}>
                                                        {catEquip.map((eq: any) => (
                                                            <option key={eq.id} value={eq.id}>
                                                                {eq.name}{eq.status !== 'available' ? ` (${eq.status === 'in_repair' ? 'En Reparación' : 'Fuera de Servicio'})` : ''}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                );
                                            })}
                                        </select>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input value={form.external_equipment_name} onChange={e => setForm({ ...form, external_equipment_name: e.target.value })} required placeholder="Nombre o descripción del equipo del cliente..." className={inputClass} />
                                            <div>
                                                <input list="clients-ext-list" value={form.client_name_input} onChange={e => setForm({ ...form, client_name_input: e.target.value })} placeholder="Seleccionar o escribir cliente (opcional)..." className={inputClass} />
                                                <datalist id="clients-ext-list">
                                                    {clients.map(c => <option key={c.id} value={c.company_name} />)}
                                                </datalist>
                                            </div>
                                        </div>
                                    )}
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
    const isWarehouse = (r as any).repair_source === 'warehouse';

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
                <span className={`material-symbols-outlined text-[16px] ${isWarehouse ? 'text-orange-500' : 'text-primary'}`}>
                    {r.equipment ? (EQUIPMENT_TYPE_ICONS[r.equipment.equipment_type as keyof typeof EQUIPMENT_TYPE_ICONS] || 'settings') : 'handyman'}
                </span>
                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{r.external_equipment_name || r.equipment?.well_name || r.equipment?.name}</p>
            </div>
            {isWarehouse && <span className="text-[10px] rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 font-bold mb-1 inline-block">🏭 Bodega</span>}

            {/* Failure + urgency */}
            <p className="text-xs text-slate-500 truncate mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">{FAILURE_TYPE_ICONS[r.failure_type]}</span>
                {r.failure_description}
            </p>

            {/* Client + provider */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span className="truncate">
                    {isWarehouse ? <span className="text-orange-500 font-medium">Bodega Núcleo</span> : (r.external_client_name || r.client?.company_name || '—')}
                </span>
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
