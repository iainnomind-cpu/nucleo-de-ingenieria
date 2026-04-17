import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    InstalledEquipment, MaintenanceSchedule, EquipmentWarranty,
    EquipmentType, ScheduleStatus, ServiceType,
    EQUIPMENT_TYPE_LABELS, EQUIPMENT_TYPE_ICONS, EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_COLORS,
    SERVICE_TYPE_LABELS, SERVICE_TYPE_ICONS, SERVICE_FREQUENCY,
    SCHEDULE_STATUS_LABELS, SCHEDULE_STATUS_COLORS,
    WARRANTY_STATUS_LABELS, WARRANTY_STATUS_COLORS,
    getDaysUntil, getUrgencyColor, formatCurrencyMaint,
    EquipmentStatus,
} from '../../types/maintenance';
import GoogleMapView, { MapPin } from '../../components/GoogleMap';
import { NUCLEO_HQ, PinColor } from '../../lib/maps';
import MaintenanceCalendar from './MaintenanceCalendar';
import { triggerWaAutomation } from '../../lib/waAutomation';

export default function MaintenanceDashboard() {
    const navigate = useNavigate();
    const [equipment, setEquipment] = useState<InstalledEquipment[]>([]);
    const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
    const [warranties, setWarranties] = useState<(EquipmentWarranty & { equipment?: InstalledEquipment })[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'calendar' | 'equipment' | 'warranties' | 'map'>('calendar');
    const [showEquipForm, setShowEquipForm] = useState(false);
    const [showScheduleForm, setShowScheduleForm] = useState(false);

    // Equipment form
    const [eqForm, setEqForm] = useState({
        name: '', equipment_type: 'bomba' as EquipmentType, brand: '', model: '', serial_number: '',
        well_name: '', installation_date: '', location: '', client_id: '',
    });
    // Schedule form
    const [schForm, setSchForm] = useState({
        equipment_id: '', service_type: 'revision_general' as ServiceType, title: '', next_service_date: '',
        assigned_to: '', alert_days_before: '15',
    });

    const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [eqRes, schRes, warRes, clRes] = await Promise.all([
            supabase.from('installed_equipment').select('*, client:clients(id, company_name)').order('well_name').order('name'),
            supabase.from('maintenance_schedules').select('*, equipment:installed_equipment(id, name, well_name), client:clients(id, company_name)').order('next_service_date'),
            supabase.from('equipment_warranties').select('*, equipment:installed_equipment(id, name, well_name)').order('end_date'),
            supabase.from('clients').select('id, company_name').order('company_name'),
        ]);
        setEquipment((eqRes.data as InstalledEquipment[]) || []);
        setSchedules((schRes.data as MaintenanceSchedule[]) || []);
        setWarranties(warRes.data || []);
        setClients(clRes.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Derived data
    const today = new Date().toISOString().split('T')[0];
    const upcoming = schedules.filter(s => s.status !== 'completed' && s.status !== 'cancelled');
    const overdue = upcoming.filter(s => s.next_service_date < today);
    const thisWeek = upcoming.filter(s => { const d = getDaysUntil(s.next_service_date); return d >= 0 && d <= 7; });
    const thisMonth = upcoming.filter(s => { const d = getDaysUntil(s.next_service_date); return d > 7 && d <= 30; });

    const expiringWarranties = warranties.filter(w => {
        const d = getDaysUntil(w.end_date);
        return w.status === 'active' && d >= 0 && d <= 60;
    });

    const handleAddEquipment = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from('installed_equipment').insert({
            name: eqForm.name, equipment_type: eqForm.equipment_type, brand: eqForm.brand || null,
            model: eqForm.model || null, serial_number: eqForm.serial_number || null,
            well_name: eqForm.well_name || null, installation_date: eqForm.installation_date || null,
            location: eqForm.location || null, client_id: eqForm.client_id || null,
        });
        setShowEquipForm(false);
        setEqForm({ name: '', equipment_type: 'bomba', brand: '', model: '', serial_number: '', well_name: '', installation_date: '', location: '', client_id: '' });
        fetchAll();
    };

    const handleAddSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        const eq = equipment.find(e => e.id === schForm.equipment_id);
        await supabase.from('maintenance_schedules').insert({
            equipment_id: schForm.equipment_id, client_id: eq?.client_id || null,
            service_type: schForm.service_type, title: schForm.title || SERVICE_TYPE_LABELS[schForm.service_type],
            frequency_months: SERVICE_FREQUENCY[schForm.service_type],
            next_service_date: schForm.next_service_date, assigned_to: schForm.assigned_to || null,
            alert_days_before: parseInt(schForm.alert_days_before) || 15,
        }).select().single();

        if (res.data) {
            triggerWaAutomation({
                module: 'maintenance',
                event: 'upcoming', // Agendar mantenimiento
                record: {
                    title: res.data.title,
                    service_type: res.data.service_type,
                    assigned_to: res.data.assigned_to,
                    equipment_name: eq?.name || '',
                    next_service_date: res.data.next_service_date
                },
                referenceId: res.data.id
            });
        }

        setShowScheduleForm(false);
        setSchForm({ equipment_id: '', service_type: 'revision_general', title: '', next_service_date: '', assigned_to: '', alert_days_before: '15' });
        fetchAll();
    };

    const handleScheduleStatus = async (id: string, status: ScheduleStatus) => {
        const updates: Record<string, unknown> = { status };
        let costCreated = false;
        let msgCreated = false;
        let workOrderCreated = false;

        const sch = schedules.find(s => s.id === id);

        // → M8: Alert technician when maintenance is confirmed
        if (status === 'confirmed' && sch) {
            const { data: spaces } = await supabase.from('spaces')
                .select('id').ilike('name', '%admin%').limit(1);
            if (spaces && spaces.length > 0) {
                await supabase.from('messages').insert({
                    space_id: spaces[0].id,
                    sender_id: '12345678-1234-1234-1234-123456789012',
                    content: `🛠️ **ALERTA MANTENIMIENTO (M5)**: Se confirmó el servicio **${sch.title}** programado para el **${new Date(sch.next_service_date).toLocaleDateString('es-MX')}**.\n\n👤 Asignado a: **${sch.assigned_to || 'Joel'}**\n📍 Equipo: ${sch.equipment?.name || ''} ${sch.equipment?.well_name ? '(' + sch.equipment.well_name + ')' : ''}\n📅 Cliente: ${sch.client?.company_name || 'N/A'}`,
                    message_type: 'text'
                });
                msgCreated = true;
            }

            // → M3: Auto-create work order (project task) for upcoming maintenance
            const { data: existingTasks } = await supabase.from('team_tasks')
                .select('id').ilike('title', `%${sch.title}%`).eq('status', 'pending').limit(1);
            if (!existingTasks || existingTasks.length === 0) {
                await supabase.from('team_tasks').insert({
                    title: `🔧 OT M5: ${sch.title}`,
                    description: `Orden de trabajo automática generada desde Mantenimiento (M5).\nEquipo: ${sch.equipment?.name || 'N/A'}\nPozo: ${sch.equipment?.well_name || 'N/A'}\nCliente: ${sch.client?.company_name || 'N/A'}\nFecha programada: ${sch.next_service_date}`,
                    assigned_to: sch.assigned_to || 'Joel',
                    due_date: sch.next_service_date,
                    priority: 'high',
                    status: 'pending',
                });
                workOrderCreated = true;
            }
        }

        if (status === 'completed') {
            updates.completed_at = new Date().toISOString();
            // Auto-create next schedule
            if (sch) {
                const nextDate = new Date(sch.next_service_date);
                nextDate.setMonth(nextDate.getMonth() + sch.frequency_months);
                await supabase.from('maintenance_schedules').insert({
                    equipment_id: sch.equipment_id, client_id: sch.client_id, service_type: sch.service_type,
                    title: sch.title, frequency_months: sch.frequency_months,
                    last_service_date: sch.next_service_date,
                    next_service_date: nextDate.toISOString().split('T')[0],
                    assigned_to: sch.assigned_to, alert_days_before: sch.alert_days_before,
                }).select().single();

                if (autoRes.data) {
                    triggerWaAutomation({
                        module: 'maintenance',
                        event: 'upcoming', 
                        record: { title: autoRes.data.title, assigned_to: autoRes.data.assigned_to, equipment_name: sch.equipment?.name || '', next_service_date: autoRes.data.next_service_date },
                        referenceId: autoRes.data.id
                    });
                }

                // → M6: Auto-create invoice if maintenance has a cost
                if (sch.cost && sch.cost > 0 && sch.client_id) {
                    const { count: totalInvoices } = await supabase.from('invoices').select('*', { count: 'exact', head: true });
                    const invNumber = `M-F${new Date().getFullYear()}-${String((totalInvoices || 0) + 1).padStart(4, '0')}`;
                    await supabase.from('invoices').insert({
                        client_id: sch.client_id,
                        invoice_number: invNumber,
                        issue_date: new Date().toISOString().split('T')[0],
                        due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        subtotal: sch.cost / 1.16,
                        tax_amount: sch.cost - (sch.cost / 1.16),
                        total: sch.cost,
                        amount_paid: 0,
                        balance: sch.cost,
                        status: 'pending',
                        currency: 'MXN',
                        notes: `Mantenimiento completado: ${sch.title}`,
                    });
                    costCreated = true;
                }

                // → M8: Auto-notify Team Space
                if (sch.client) {
                    const { data: spaces } = await supabase.from('spaces').select('id')
                        .ilike('name', `%${sch.client.company_name}%`).limit(1);
                    if (spaces && spaces.length > 0) {
                        await supabase.from('messages').insert({
                            space_id: spaces[0].id,
                            sender_id: '12345678-1234-1234-1234-123456789012',
                            content: `🔧 **Mantenimiento Completado**: ${sch.title} (${sch.service_type})\nResponsable: ${sch.assigned_to}`,
                            message_type: 'text'
                        });
                        if (!msgCreated) msgCreated = true;
                    }
                }

                // Notificar al cliente Mantenimiento completado
                triggerWaAutomation({
                    module: 'maintenance',
                    event: 'completed',
                    record: {
                        title: sch.title,
                        service_type: sch.service_type,
                        assigned_to: sch.assigned_to,
                        equipment_name: sch.equipment?.name || '',
                    },
                    referenceId: sch.id
                });
            }
        }
        await supabase.from('maintenance_schedules').update(updates).eq('id', id);

        if (status === 'confirmed') {
            let notices = ['Mantenimiento confirmado.'];
            if (workOrderCreated) notices.push('Orden de trabajo generada (M3).');
            if (msgCreated) notices.push('Alerta enviada al técnico (M8).');
            alert(notices.join(' '));
        }
        if (status === 'completed') {
            let notices = ['Mantenimiento marcado como completado y reprogramado.'];
            if (costCreated) notices.push('Factura generada en M6.');
            if (msgCreated) notices.push('Notificación enviada en M8.');
            alert(notices.join(' '));
        }

        fetchAll();
    };

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';
    const sectionClass = 'rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50';

    if (loading) return <div className="flex flex-1 items-center justify-center p-8"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Mantenimiento Predictivo</h2>
                    <p className="mt-1 text-sm text-slate-500">Agenda, monitoreo y postventa de equipos instalados.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => navigate('/maintenance/contracts')} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[18px]">description</span>Contratos
                    </button>
                    <button onClick={() => setShowEquipForm(true)} className="flex items-center gap-2 rounded-lg border border-primary bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary">
                        <span className="material-symbols-outlined text-[18px]">add</span>Equipo
                    </button>
                    <button onClick={() => setShowScheduleForm(true)} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20">
                        <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>Programar
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {[
                    { label: 'Equipos', value: equipment.length.toString(), icon: 'precision_manufacturing', color: 'from-sky-500 to-cyan-500' },
                    { label: 'Vencidos', value: overdue.length.toString(), icon: 'error', color: 'from-red-500 to-rose-500' },
                    { label: 'Esta Semana', value: thisWeek.length.toString(), icon: 'event_upcoming', color: 'from-amber-500 to-orange-500' },
                    { label: 'Este Mes', value: thisMonth.length.toString(), icon: 'calendar_month', color: 'from-violet-500 to-purple-500' },
                    { label: 'Garantías x Vencer', value: expiringWarranties.length.toString(), icon: 'verified_user', color: 'from-emerald-500 to-teal-500' },
                ].map(k => (
                    <div key={k.label} className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between">
                            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k.label}</p><p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{k.value}</p></div>
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${k.color} shadow-lg`}><span className="material-symbols-outlined text-white text-[20px]">{k.icon}</span></div>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${k.color} opacity-60`} />
                    </div>
                ))}
            </div>

            {/* Forms */}
            {showEquipForm && (
                <form onSubmit={handleAddEquipment} className="rounded-xl border border-primary/20 bg-primary/5 p-6">
                    <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Registrar Equipo</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="md:col-span-2"><label className={labelClass}>Nombre *</label><input value={eqForm.name} onChange={e => setEqForm({ ...eqForm, name: e.target.value })} required placeholder="Bomba sumergible 50HP" className={inputClass} /></div>
                        <div><label className={labelClass}>Tipo</label><select value={eqForm.equipment_type} onChange={e => setEqForm({ ...eqForm, equipment_type: e.target.value as EquipmentType })} className={inputClass}>{(Object.keys(EQUIPMENT_TYPE_LABELS) as EquipmentType[]).map(t => <option key={t} value={t}>{EQUIPMENT_TYPE_LABELS[t]}</option>)}</select></div>
                        <div><label className={labelClass}>Cliente</label><select value={eqForm.client_id} onChange={e => setEqForm({ ...eqForm, client_id: e.target.value })} className={inputClass}><option value="">Sin cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select></div>
                        <div><label className={labelClass}>Pozo</label><input value={eqForm.well_name} onChange={e => setEqForm({ ...eqForm, well_name: e.target.value })} placeholder="Pozo #3" className={inputClass} /></div>
                        <div><label className={labelClass}>Marca</label><input value={eqForm.brand} onChange={e => setEqForm({ ...eqForm, brand: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>Modelo</label><input value={eqForm.model} onChange={e => setEqForm({ ...eqForm, model: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>No. Serie</label><input value={eqForm.serial_number} onChange={e => setEqForm({ ...eqForm, serial_number: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>Fecha Instalación</label><input type="date" value={eqForm.installation_date} onChange={e => setEqForm({ ...eqForm, installation_date: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>Ubicación</label><input value={eqForm.location} onChange={e => setEqForm({ ...eqForm, location: e.target.value })} placeholder="Rancho El Mirador" className={inputClass} /></div>
                    </div>
                    <div className="mt-4 flex gap-2"><button type="submit" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">Registrar</button><button type="button" onClick={() => setShowEquipForm(false)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500 dark:border-slate-700">Cancelar</button></div>
                </form>
            )}

            {showScheduleForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-primary text-[22px]">calendar_add_on</span>
                                Programar Mantenimiento
                            </h3>
                            <button onClick={() => setShowScheduleForm(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"><span className="material-symbols-outlined text-[20px]">close</span></button>
                        </div>
                        {schForm.next_service_date && (
                            <div className="mb-4 flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2.5 dark:bg-primary/20">
                                <span className="material-symbols-outlined text-primary text-[18px]">event</span>
                                <span className="text-sm font-semibold text-primary dark:text-sky-300">
                                    Fecha seleccionada: {new Date(schForm.next_service_date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                        )}
                        <form onSubmit={handleAddSchedule}>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="md:col-span-2"><label className={labelClass}>Equipo *</label><select value={schForm.equipment_id} onChange={e => setSchForm({ ...schForm, equipment_id: e.target.value })} required className={inputClass}><option value="">Seleccionar equipo...</option>{equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.well_name ? `${eq.well_name} — ` : ''}{eq.name} {eq.client?.company_name ? `(${eq.client.company_name})` : ''}</option>)}</select></div>
                                <div><label className={labelClass}>Tipo Servicio</label><select value={schForm.service_type} onChange={e => setSchForm({ ...schForm, service_type: e.target.value as ServiceType, title: SERVICE_TYPE_LABELS[e.target.value as ServiceType] })} className={inputClass}>{(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map(t => <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>)}</select></div>
                                <div><label className={labelClass}>Próxima Fecha *</label><input type="date" value={schForm.next_service_date} onChange={e => setSchForm({ ...schForm, next_service_date: e.target.value })} required className={inputClass} /></div>
                                <div><label className={labelClass}>Título (opcional)</label><input value={schForm.title} onChange={e => setSchForm({ ...schForm, title: e.target.value })} placeholder="Se auto-genera del tipo de servicio" className={inputClass} /></div>
                                <div><label className={labelClass}>Asignado a</label><input value={schForm.assigned_to} onChange={e => setSchForm({ ...schForm, assigned_to: e.target.value })} placeholder="Nombre del técnico" className={inputClass} /></div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowScheduleForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Cancelar</button>
                                <button type="submit" className="rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-90">Programar Servicio</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {[
                    { key: 'calendar', icon: 'calendar_month', label: `Agenda (${upcoming.length})` },
                    { key: 'map', icon: 'map', label: 'Mapa' },
                    { key: 'equipment', icon: 'precision_manufacturing', label: `Equipos (${equipment.length})` },
                    { key: 'warranties', icon: 'verified_user', label: `Garantías (${warranties.length})` },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                        <span className="material-symbols-outlined text-[18px]">{t.icon}</span>{t.label}
                    </button>
                ))}
            </div>

            {/* TAB: Map */}
            {tab === 'map' && (
                <div className={sectionClass}>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                        <span className="material-symbols-outlined text-primary text-[20px]">map</span>
                        Mapa de Mantenimientos Pendientes
                    </h3>
                    {(() => {
                        const pins: MapPin[] = [];
                        // Equipment with geo data from schedules
                        upcoming.forEach(s => {
                            const eq = equipment.find(e => e.id === s.equipment_id);
                            const eqAny = eq as unknown as { latitude?: number; longitude?: number };
                            if (eqAny?.latitude && eqAny?.longitude) {
                                const days = getDaysUntil(s.next_service_date);
                                let color: PinColor = 'green';
                                if (days < 0) color = 'red';
                                else if (days <= 15) color = 'yellow';
                                pins.push({
                                    id: s.id,
                                    lat: eqAny.latitude,
                                    lng: eqAny.longitude,
                                    title: s.title || 'Mantenimiento',
                                    color,
                                    info: `${s.equipment?.well_name || ''} · ${days < 0 ? Math.abs(days) + 'd vencido' : days + 'd restantes'} · ${s.assigned_to || ''}`,
                                });
                            }
                        });
                        pins.push({ id: 'hq', lat: NUCLEO_HQ.lat, lng: NUCLEO_HQ.lng, title: 'Núcleo — Cd. Guzmán', color: 'blue', label: 'N' });
                        return (
                            <div>
                                <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-500"></span>Vencido</span>
                                    <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-500"></span>&lt;15 días</span>
                                    <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-emerald-500"></span>&gt;30 días</span>
                                    <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-blue-500"></span>HQ</span>
                                </div>
                                <GoogleMapView pins={pins} center={NUCLEO_HQ} zoom={9} height="450px" />
                                {pins.length <= 1 && <p className="mt-3 text-center text-xs text-slate-400">Los equipos aún no tienen coordenadas GPS registradas. Se agregarán cuando se registren desde la pestaña de Equipos o desde el CRM del cliente.</p>}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* TAB: Calendar */}
            {tab === 'calendar' && (
                <MaintenanceCalendar
                    schedules={schedules.filter(s => s.status !== 'cancelled')}
                    onStatusChange={handleScheduleStatus}
                    onDayClick={(date) => {
                        setSchForm({ ...schForm, next_service_date: date });
                        setShowScheduleForm(true);
                    }}
                />
            )}

            {/* TAB: Equipment */}
            {tab === 'equipment' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {equipment.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-sm text-slate-500">No hay equipos registrados.</div>
                    ) : equipment.map(eq => (
                        <div key={eq.id} onClick={() => navigate(`/maintenance/equipment/${eq.id}`)}
                            className="group cursor-pointer rounded-xl border border-slate-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md hover:border-primary/30 dark:border-slate-800/60 dark:bg-slate-900/50">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                        <span className="material-symbols-outlined text-primary text-[20px]">{EQUIPMENT_TYPE_ICONS[eq.equipment_type]}</span>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm text-slate-900 dark:text-white">{eq.name}</p>
                                        <p className="text-xs text-slate-400">{EQUIPMENT_TYPE_LABELS[eq.equipment_type]}</p>
                                    </div>
                                </div>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${EQUIPMENT_STATUS_COLORS[eq.status].bg} ${EQUIPMENT_STATUS_COLORS[eq.status].text}`}>{EQUIPMENT_STATUS_LABELS[eq.status]}</span>
                            </div>
                            {eq.well_name && <p className="mt-2 text-xs text-slate-500 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">water</span>{eq.well_name}</p>}
                            <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                                {eq.brand && <span>{eq.brand} {eq.model || ''}</span>}
                                {eq.client?.company_name && <span>· {eq.client.company_name}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* TAB: Warranties */}
            {tab === 'warranties' && (
                <div className={sectionClass}>
                    {warranties.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500">No hay garantías registradas.</div>
                    ) : (
                        <div className="space-y-3">
                            {warranties.map(w => {
                                const days = getDaysUntil(w.end_date);
                                return (
                                    <div key={w.id} className="flex items-center gap-4 rounded-lg border border-slate-200/60 p-4 dark:border-slate-700/60">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                                            <span className="material-symbols-outlined text-emerald-600 text-[20px]">verified_user</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm text-slate-900 dark:text-white">{w.equipment?.name || '—'} <span className="text-xs text-slate-400">({w.equipment?.well_name})</span></p>
                                            <p className="text-xs text-slate-400">{WARRANTY_STATUS_LABELS[w.warranty_type === 'supplier' ? 'active' : 'active']} · {w.warranty_type === 'supplier' ? 'Proveedor' : 'Núcleo'}{w.provider ? ` — ${w.provider}` : ''}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-sm font-bold ${getUrgencyColor(days)}`}>{days > 0 ? `${days} días` : 'Expirada'}</span>
                                            <p className="text-xs text-slate-400">Vence: {new Date(w.end_date).toLocaleDateString('es-MX')}</p>
                                        </div>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${WARRANTY_STATUS_COLORS[w.status].bg} ${WARRANTY_STATUS_COLORS[w.status].text}`}>{WARRANTY_STATUS_LABELS[w.status]}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Schedule Card Component
function ScheduleCard({ schedule: s, onStatusChange }: { schedule: MaintenanceSchedule; onStatusChange: (id: string, status: ScheduleStatus) => void }) {
    const days = getDaysUntil(s.next_service_date);
    return (
        <div className="flex items-center gap-4 rounded-lg border border-slate-200/60 p-4 transition-colors hover:bg-slate-50/50 dark:border-slate-700/60 dark:hover:bg-slate-800/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <span className="material-symbols-outlined text-primary text-[20px]">{SERVICE_TYPE_ICONS[s.service_type]}</span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-slate-900 dark:text-white">{s.title}</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                    {s.equipment?.well_name && <span>{s.equipment.well_name}</span>}
                    <span>·</span>
                    <span>{s.equipment?.name}</span>
                    {s.assigned_to && <><span>·</span><span>{s.assigned_to}</span></>}
                    {s.client?.company_name && <><span>·</span><span>{s.client.company_name}</span></>}
                </div>
            </div>
            <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${getUrgencyColor(days)}`}>{days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `${days}d`}</p>
                <p className="text-xs text-slate-400">{new Date(s.next_service_date).toLocaleDateString('es-MX')}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${SCHEDULE_STATUS_COLORS[s.status].bg} ${SCHEDULE_STATUS_COLORS[s.status].text}`}>{SCHEDULE_STATUS_LABELS[s.status]}</span>
            <div className="flex gap-1 shrink-0">
                {s.status === 'scheduled' && <button onClick={() => onStatusChange(s.id, 'confirmed')} className="rounded p-1 text-indigo-500 hover:bg-indigo-50" title="Confirmar"><span className="material-symbols-outlined text-[18px]">check</span></button>}
                {(s.status === 'confirmed' || s.status === 'notified') && <button onClick={() => onStatusChange(s.id, 'in_progress')} className="rounded p-1 text-amber-500 hover:bg-amber-50" title="Iniciar"><span className="material-symbols-outlined text-[18px]">play_arrow</span></button>}
                {s.status === 'in_progress' && <button onClick={() => onStatusChange(s.id, 'completed')} className="rounded p-1 text-emerald-500 hover:bg-emerald-50" title="Completar (crea siguiente automático)"><span className="material-symbols-outlined text-[18px]">check_circle</span></button>}
                {s.status !== 'completed' && s.status !== 'cancelled' && <button onClick={() => onStatusChange(s.id, 'completed')} className="rounded p-1 text-slate-400 hover:text-emerald-500" title="Marcar completado"><span className="material-symbols-outlined text-[16px]">done_all</span></button>}
            </div>
        </div>
    );
}
