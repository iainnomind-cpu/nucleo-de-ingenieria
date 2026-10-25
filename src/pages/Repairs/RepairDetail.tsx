import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { triggerWaAutomation } from '../../lib/waAutomation';
import {
    EquipmentRepair, RepairPart, RepairTimelineEvent, RepairStatus, PartSource,
    ShippingCarrier, ExternalWorkshop,
    REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS, NEXT_STATUS_MAP,
    FAILURE_TYPE_LABELS, FAILURE_TYPE_ICONS,
    URGENCY_LABELS, URGENCY_COLORS,
    PICKUP_METHOD_LABELS, PART_SOURCE_LABELS,
    formatCurrencyRepair, getRepairTotalCost, getRepairDaysElapsed,
} from '../../types/repairs';
import { PhotoAttachment } from '../../types/photos';
import PhotoUploader, { PhotoGallery } from '../../components/PhotoUploader';

type Tab = 'workflow' | 'timeline' | 'parts' | 'photos';

export default function RepairDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [repair, setRepair] = useState<EquipmentRepair | null>(null);
    const [parts, setParts] = useState<RepairPart[]>([]);
    const [timeline, setTimeline] = useState<RepairTimelineEvent[]>([]);
    const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
    const [workshops, setWorkshops] = useState<ExternalWorkshop[]>([]);
    const [equipment, setEquipment] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('workflow');

    const [showPartForm, setShowPartForm] = useState(false);
    const [partForm, setPartForm] = useState({ part_name: '', part_number: '', quantity: '1', unit_cost: '0', source: 'purchased' as PartSource, notes: '' });
    const [showNoteForm, setShowNoteForm] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [editSection, setEditSection] = useState<string | null>(null);
    const [editData, setEditData] = useState<Record<string, any>>({});
    const [beforePhotos, setBeforePhotos] = useState<PhotoAttachment[]>([]);
    const [afterPhotos, setAfterPhotos] = useState<PhotoAttachment[]>([]);
    const [deliveryPhotos, setDeliveryPhotos] = useState<PhotoAttachment[]>([]);
    const [shippingPhotos, setShippingPhotos] = useState<PhotoAttachment[]>([]);
    const [editingWorkshopContact, setEditingWorkshopContact] = useState(false);
    const [wsPhoneInput, setWsPhoneInput] = useState('');
    const [wsEmailInput, setWsEmailInput] = useState('');

    const saveWorkshopContact = async (name: string, phone: string, email: string) => {
        if (!name.trim()) return;
        const existingWs = workshops.find(w => w.name.toLowerCase() === name.trim().toLowerCase());
        if (existingWs) {
            await supabase.from('external_workshops').update({
                contact_phone: phone.trim() || null,
                contact_email: email.trim() || null,
            }).eq('id', existingWs.id);
            setWorkshops(prev => prev.map(w => w.id === existingWs.id ? { ...w, contact_phone: phone.trim() || null, contact_email: email.trim() || null } : w));
        } else {
            const { data } = await supabase.from('external_workshops').insert({
                name: name.trim(),
                contact_phone: phone.trim() || null,
                contact_email: email.trim() || null,
            }).select().single();
            if (data) {
                setWorkshops(prev => [...prev, data as ExternalWorkshop]);
            }
        }
        setEditingWorkshopContact(false);
    };

    const fetchAll = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        const [rRes, pRes, tRes, cRes, wRes, eqRes, cliRes] = await Promise.all([
            supabase.from('equipment_repairs').select('*, equipment:installed_equipment(id, name, well_name, equipment_type, brand, model, serial_number), client:clients(id, company_name, phone, email)').eq('id', id).single(),
            supabase.from('repair_parts').select('*').eq('repair_id', id).order('created_at'),
            supabase.from('repair_timeline').select('*').eq('repair_id', id).order('created_at', { ascending: false }),
            supabase.from('shipping_carriers').select('*').order('name'),
            supabase.from('external_workshops').select('*').order('name'),
            supabase.from('installed_equipment').select('id, name, well_name, equipment_type, client_id, client:clients(id, company_name, phone, email)'),
            supabase.from('clients').select('id, company_name').order('company_name'),
        ]);
        if (!rRes.data) { navigate('/repairs'); return; }
        const repairData = rRes.data as EquipmentRepair;
        setRepair(repairData);
        setBeforePhotos((repairData.photos_before as PhotoAttachment[]) || []);
        setAfterPhotos((repairData.photos_after as PhotoAttachment[]) || []);
        setDeliveryPhotos((repairData.delivery_photos as PhotoAttachment[]) || []);
        setShippingPhotos((repairData.shipping_guide_photos as PhotoAttachment[]) || []);
        setParts((pRes.data as RepairPart[]) || []);
        setTimeline((tRes.data as RepairTimelineEvent[]) || []);
        setCarriers((cRes.data as ShippingCarrier[]) || []);
        setWorkshops((wRes.data as ExternalWorkshop[]) || []);
        setEquipment(eqRes.data || []);
        setClients(cliRes.data || []);
        setLoading(false);
    }, [id, navigate]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const changeStatus = async (newStatus: RepairStatus) => {
        if (!repair) return;
        const updates: Record<string, unknown> = { status: newStatus };
        if (newStatus === 'completed') updates.completion_date = new Date().toISOString().split('T')[0];
        await supabase.from('equipment_repairs').update(updates).eq('id', repair.id);
        await supabase.from('repair_timeline').insert({ repair_id: repair.id, event_type: 'status_change', old_status: repair.status, new_status: newStatus, description: `${REPAIR_STATUS_LABELS[repair.status]} → ${REPAIR_STATUS_LABELS[newStatus]}` });

        // → M9: WA automation
        triggerWaAutomation({
            module: 'repairs',
            event: 'status_change',
            condition: { new_status: newStatus },
            record: {
                equipment_name: repair.external_equipment_name || repair.equipment?.well_name || repair.equipment?.name || '',
                client_name: repair.external_client_name || repair.client?.company_name || '',
                failure_description: repair.failure_description || '',
                status_label: REPAIR_STATUS_LABELS[newStatus],
                external_provider: repair.external_provider || '',
                tracking_number_to: repair.tracking_number_to || '',
            },
            referenceId: repair.id,
        });

        fetchAll();
    };

    const saveSection = async (section: string) => {
        if (!repair) return;
        
        let finalData = { ...editData };
        if (section === 'shipping_to') {
            const wsName = (finalData.external_provider || '').trim();
            const wsPhone = typeof finalData.ws_phone === 'string' ? finalData.ws_phone.trim() : null;
            const wsEmail = typeof finalData.ws_email === 'string' ? finalData.ws_email.trim() : null;
            delete finalData.ws_phone;
            delete finalData.ws_email;

            if (wsName) {
                const existingWs = workshops.find(w => w.name.toLowerCase() === wsName.toLowerCase());
                if (existingWs) {
                    await supabase.from('external_workshops').update({
                        contact_phone: wsPhone || existingWs.contact_phone || null,
                        contact_email: wsEmail || existingWs.contact_email || null,
                    }).eq('id', existingWs.id);
                } else {
                    await supabase.from('external_workshops').insert({
                        name: wsName,
                        contact_phone: wsPhone || null,
                        contact_email: wsEmail || null,
                    });
                }
            }
        }

        if (section === 'report') {
            if (finalData.is_external) {
                finalData.equipment_id = null;
                const matchedClient = clients.find(c => c.company_name === finalData.client_name_input);
                if (matchedClient) {
                    finalData.client_id = matchedClient.id;
                    finalData.external_client_name = null;
                } else if (finalData.client_name_input?.trim()) {
                    finalData.client_id = null;
                    finalData.external_client_name = finalData.client_name_input.trim();
                } else {
                    finalData.client_id = null;
                    finalData.external_client_name = null;
                }
            } else {
                finalData.external_equipment_name = null;
                finalData.external_client_name = null;
                const eq = equipment.find(e => e.id === finalData.equipment_id);
                finalData.client_id = eq?.client_id || null;
            }
            delete finalData.is_external;
            delete finalData.client_name_input;
        }

        await supabase.from('equipment_repairs').update(finalData).eq('id', repair.id);
        const desc = section === 'report' ? 'Datos del reporte actualizados' :
            section === 'pickup' ? 'Datos de recolección actualizados' :
            section === 'shipping_to' ? 'Datos de envío actualizados' :
            section === 'diagnosis' ? 'Diagnóstico actualizado' :
            section === 'quote' ? 'Cotización actualizada' :
            section === 'authorization' ? 'Autorización / OC actualizada' :
            section === 'return' ? 'Datos de regreso actualizados' :
            section === 'delivery' ? 'Entrega actualizada' :
            section === 'invoice' ? 'Facturación actualizada' :
            section === 'costs' ? 'Costos actualizados' : 'Datos actualizados';
        await supabase.from('repair_timeline').insert({ repair_id: repair.id, event_type: 'note', description: desc });
        setEditSection(null);
        setEditData({});
        fetchAll();
    };

    const startEdit = (section: string, defaults: Record<string, any>) => {
        setEditSection(section);
        setEditData(defaults);
    };

    const addPart = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!repair) return;
        const qty = parseFloat(partForm.quantity) || 1;
        const cost = parseFloat(partForm.unit_cost) || 0;
        await supabase.from('repair_parts').insert({ repair_id: repair.id, part_name: partForm.part_name, part_number: partForm.part_number || null, quantity: qty, unit_cost: cost, source: partForm.source, notes: partForm.notes || null });
        const newPartsCost = (repair.parts_cost || 0) + (qty * cost);
        await supabase.from('equipment_repairs').update({ parts_cost: newPartsCost }).eq('id', repair.id);
        await supabase.from('repair_timeline').insert({ repair_id: repair.id, event_type: 'part_added', description: `Refacción: ${partForm.part_name} x${qty} — ${formatCurrencyRepair(qty * cost)}` });
        setShowPartForm(false);
        setPartForm({ part_name: '', part_number: '', quantity: '1', unit_cost: '0', source: 'purchased', notes: '' });
        fetchAll();
    };

    const addNote = async () => {
        if (!repair || !noteText.trim()) return;
        await supabase.from('repair_timeline').insert({ repair_id: repair.id, event_type: 'note', description: noteText });
        setNoteText('');
        setShowNoteForm(false);
        fetchAll();
    };

    const copyClientLink = () => {
        if (!repair?.access_token) return;
        const url = `${window.location.origin}/repair-tracking/${repair.access_token}`;
        navigator.clipboard.writeText(url);
        alert('Enlace copiado al portapapeles');
    };

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1';
    const sectionClass = 'rounded-xl border border-slate-200/60 bg-white/50 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50';
    const stepClass = (active: boolean, done: boolean) => `rounded-xl border p-4 transition-all ${done ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-900/10' : active ? 'border-primary/40 bg-primary/5 ring-2 ring-primary/20' : 'border-slate-200/60 bg-white/50 dark:border-slate-800/60 dark:bg-slate-900/50'}`;

    if (loading || !repair) return <div className="flex flex-1 items-center justify-center p-8"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

    const days = getRepairDaysElapsed(repair.report_date);
    const total = getRepairTotalCost(repair);
    const statusColor = REPAIR_STATUS_COLORS[repair.status];
    const urgencyColor = URGENCY_COLORS[repair.urgency];
    const isActive = !['completed', 'cancelled'].includes(repair.status);
    const nextOptions = NEXT_STATUS_MAP[repair.status] || [];

    // Step progress helpers
    const statusIndex = (s: RepairStatus) => {
        const order: RepairStatus[] = ['reported','pickup_pending','picked_up','sent_to_provider','received_by_provider','diagnosis_received','quoted','authorized','po_sent','in_repair','return_shipped','return_received','delivered','invoiced','completed'];
        return order.indexOf(s);
    };
    const currentIdx = statusIndex(repair.status);
    const isDone = (s: RepairStatus) => statusIndex(s) < currentIdx;
    const isCurrent = (s: RepairStatus) => s === repair.status;

    return (
        <div className="flex flex-1 flex-col gap-6 p-8 overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/repairs')} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </button>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
                        <span className="material-symbols-outlined text-red-600 text-[24px]">construction</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{repair.external_equipment_name || repair.equipment?.well_name || repair.equipment?.name}</h2>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusColor.bg} ${statusColor.text}`}>{REPAIR_STATUS_LABELS[repair.status]}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${urgencyColor.bg} ${urgencyColor.text}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${urgencyColor.dot}`} />{URGENCY_LABELS[repair.urgency]}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">{FAILURE_TYPE_ICONS[repair.failure_type]}</span>{FAILURE_TYPE_LABELS[repair.failure_type]}</span>
                            {(repair.external_client_name || repair.client?.company_name) && <><span>·</span><span>{repair.external_client_name || repair.client?.company_name}</span></>}
                            {repair.external_provider && <><span>·</span><span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">warehouse</span>{repair.external_provider}</span></>}
                        </p>
                    </div>
                </div>
                {isActive && (
                    <div className="flex gap-2 flex-wrap">
                        {nextOptions.map(ns => (
                            <button key={ns} onClick={() => changeStatus(ns)} className={`rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90`}>
                                → {REPAIR_STATUS_LABELS[ns]}
                            </button>
                        ))}
                        {repair.access_token && (
                            <button onClick={copyClientLink} className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition-all dark:border-sky-800/40 dark:bg-sky-900/20 dark:text-sky-400">
                                <span className="material-symbols-outlined text-[16px]">share</span>
                                Enlace para Cliente
                            </button>
                        )}
                        <button onClick={() => changeStatus('cancelled')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 dark:border-slate-700 hover:bg-slate-50 transition-all">Cancelar</button>
                    </div>
                )}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                    { label: 'Días', value: `${days}`, warn: days > 15 },
                    { label: 'Cotización', value: repair.quote_amount > 0 ? formatCurrencyRepair(repair.quote_amount) : '—' },
                    { label: 'Factura', value: repair.invoice_amount > 0 ? formatCurrencyRepair(repair.invoice_amount) : '—' },
                    { label: 'Costo Interno', value: formatCurrencyRepair(total) },
                    { label: 'Refacciones', value: `${parts.length}` },
                ].map(k => (
                    <div key={k.label} className="rounded-xl border border-slate-200/60 bg-white/70 p-4 dark:border-slate-800/60 dark:bg-slate-900/50">
                        <p className="text-[10px] font-bold uppercase text-slate-400">{k.label}</p>
                        <p className={`text-xl font-bold ${k.warn ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>{k.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {[
                    { key: 'workflow', icon: 'route', label: 'Flujo de Trabajo' },
                    { key: 'timeline', icon: 'timeline', label: `Timeline (${timeline.length})` },
                    { key: 'parts', icon: 'inventory_2', label: `Refacciones (${parts.length})` },
                    { key: 'photos', icon: 'photo_library', label: 'Fotos' },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as Tab)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                        <span className="material-symbols-outlined text-[18px]">{t.icon}</span>{t.label}
                    </button>
                ))}
            </div>

            {/* TAB: Workflow — visual step-by-step */}
            {tab === 'workflow' && (
                <div className="space-y-4">
                    {/* Step 1: Reporte */}
                    <div className={stepClass(isCurrent('reported'), isDone('reported'))}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600 text-[12px] font-bold dark:bg-red-900/30">1</span>
                                Reporte de Falla
                                {isDone('reported') && <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>}
                            </h4>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-400">{new Date(repair.report_date).toLocaleDateString('es-MX')}</span>
                                {editSection !== 'report' && <button onClick={() => startEdit('report', { is_external: !repair.equipment_id, equipment_id: repair.equipment_id || '', external_equipment_name: repair.external_equipment_name || '', client_name_input: repair.external_client_name || repair.client?.company_name || '', failure_description: repair.failure_description || '', failure_type: repair.failure_type || 'other', urgency: repair.urgency || 'normal', reported_by: repair.reported_by || '', assigned_to: repair.assigned_to || '', report_date: repair.report_date || '', client_phone: repair.client_phone || '', client_email: repair.client_email || '', pickup_deadline_date: repair.pickup_deadline_date || '' })} className="text-xs text-primary font-semibold">Editar</button>}
                            </div>
                        </div>
                        {editSection === 'report' ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="md:col-span-2">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className={labelClass + ' mb-0'}>Equipo *</label>
                                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                <input type="checkbox" checked={editData.is_external} onChange={e => setEditData({ ...editData, is_external: e.target.checked })} className="rounded border-slate-300 text-primary focus:ring-primary" />
                                                Equipo externo (del cliente)
                                            </label>
                                        </div>
                                        {!editData.is_external ? (
                                            <select value={editData.equipment_id} onChange={e => setEditData({ ...editData, equipment_id: e.target.value })} required className={inputClass}>
                                                <option value="">Seleccionar equipo...</option>
                                                {equipment.map((eq: any) => <option key={eq.id} value={eq.id}>{eq.well_name ? `${eq.well_name} — ` : ''}{eq.name} {eq.client?.company_name ? `(${eq.client.company_name})` : ''}</option>)}
                                            </select>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <input value={editData.external_equipment_name} onChange={e => setEditData({ ...editData, external_equipment_name: e.target.value })} required placeholder="Nombre o descripción del equipo..." className={inputClass} />
                                                <div>
                                                    <input list="clients-ext-list-edit" value={editData.client_name_input} onChange={e => setEditData({ ...editData, client_name_input: e.target.value })} placeholder="Seleccionar o escribir cliente (opcional)..." className={inputClass} />
                                                    <datalist id="clients-ext-list-edit">
                                                        {clients.map(c => <option key={c.id} value={c.company_name} />)}
                                                    </datalist>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="md:col-span-2"><label className={labelClass}>Descripción de la Falla</label><textarea value={editData.failure_description} onChange={e => setEditData({...editData, failure_description: e.target.value})} rows={3} className={inputClass + ' resize-none'} /></div>
                                    <div><label className={labelClass}>Tipo de Falla</label><select value={editData.failure_type} onChange={e => setEditData({...editData, failure_type: e.target.value})} className={inputClass}>{Object.entries(FAILURE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                                    <div><label className={labelClass}>Urgencia</label><select value={editData.urgency} onChange={e => setEditData({...editData, urgency: e.target.value})} className={inputClass}>{Object.entries(URGENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                                    <div><label className={labelClass}>Reportó</label><input value={editData.reported_by} onChange={e => setEditData({...editData, reported_by: e.target.value})} className={inputClass} /></div>
                                    <div><label className={labelClass}>Asignado a</label><input value={editData.assigned_to} onChange={e => setEditData({...editData, assigned_to: e.target.value})} className={inputClass} /></div>
                                    <div><label className={labelClass}>Fecha Reporte</label><input type="date" value={editData.report_date} onChange={e => setEditData({...editData, report_date: e.target.value})} className={inputClass} /></div>
                                    <>
                                        <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-700 pt-3 mt-1">
                                            <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">contact_phone</span>
                                                Contacto del Cliente para Avisos
                                            </p>
                                        </div>
                                        <div><label className={labelClass}>Celular del Cliente</label><input value={editData.client_phone} onChange={e => setEditData({...editData, client_phone: e.target.value})} placeholder="Ej. 3411234567" className={inputClass} /></div>
                                        <div><label className={labelClass}>Correo del Cliente</label><input type="email" value={editData.client_email} onChange={e => setEditData({...editData, client_email: e.target.value})} placeholder="correo@ejemplo.com" className={inputClass} /></div>
                                        <div><label className={labelClass}>Fecha Límite para Recoger</label>
                                            <input type="date" value={editData.pickup_deadline_date} onChange={e => setEditData({...editData, pickup_deadline_date: e.target.value})} className={inputClass} />
                                            <p className="text-[10px] text-slate-400 mt-1">Si no recoge antes de esta fecha, se desechará.</p>
                                        </div>
                                    </>
                                </div>
                                <div className="flex gap-2"><button onClick={() => saveSection('report')} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">Guardar</button><button onClick={() => setEditSection(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">Cancelar</button></div>
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{repair.failure_description}</p>
                                <div className="mt-2 flex gap-4 text-xs text-slate-500">
                                    {repair.reported_by && <span>Reportó: <strong>{repair.reported_by}</strong></span>}
                                    {repair.assigned_to && <span>Asignado: <strong>{repair.assigned_to}</strong></span>}
                                </div>
                                {/* Contacto del cliente para avisos */}
                                {(repair.client_phone || repair.client_email || repair.pickup_deadline_date) && (
                                    <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-800/40 dark:bg-sky-900/10">
                                        <p className="text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400 mb-2 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[12px]">contact_phone</span>
                                            Contacto para Avisos de Recogida
                                        </p>
                                        <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300">
                                            {repair.client_phone && (
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px] text-green-500">phone</span>
                                                    <a href={`https://wa.me/${repair.client_phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="font-semibold text-green-600 hover:underline dark:text-green-400">{repair.client_phone}</a>
                                                </span>
                                            )}
                                            {repair.client_email && (
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px] text-sky-500">mail</span>
                                                    <a href={`mailto:${repair.client_email}`} className="font-semibold text-sky-600 hover:underline dark:text-sky-400">{repair.client_email}</a>
                                                </span>
                                            )}
                                            {repair.pickup_deadline_date && (
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px] text-red-500">event_busy</span>
                                                    <span>Recoger antes del: <strong className="text-red-600 dark:text-red-400">{new Date(repair.pickup_deadline_date + 'T12:00:00').toLocaleDateString('es-MX')}</strong></span>
                                                </span>
                                            )}
                                        </div>
                                        {/* Botones de aviso rápido */}
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {repair.client_phone && (
                                                <a href={`https://wa.me/${repair.client_phone.replace(/\D/g,'')}?text=${encodeURIComponent(
                                                    `Hola ${repair.external_client_name || repair.client?.company_name || 'Cliente'}, le recordamos que su equipo "${repair.external_equipment_name || repair.equipment?.well_name || repair.equipment?.name || 'en reparación'}" se encuentra en nuestro taller Núcleo de Ingeniería.${repair.pickup_deadline_date ? ` Tiene hasta el ${new Date(repair.pickup_deadline_date + 'T12:00:00').toLocaleDateString('es-MX')} para recogerlo, de lo contrario será desechado.` : ' Le pedimos que pase a recogerlo a la brevedad.'}`
                                                )}`} target="_blank" rel="noreferrer"
                                                    className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-[11px] font-bold text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">
                                                    <span className="material-symbols-outlined text-[14px]">chat</span>
                                                    Recordatorio WA
                                                </a>
                                            )}
                                            {repair.client_phone && (
                                                <a href={`https://wa.me/${repair.client_phone.replace(/\D/g,'')}?text=${encodeURIComponent(
                                                    `Hola ${repair.external_client_name || repair.client?.company_name || 'Cliente'}, su equipo "${repair.external_equipment_name || repair.equipment?.well_name || repair.equipment?.name || 'en espera'}" lleva tiempo con nosotros esperando confirmación. ¿Desea que procedamos con la reparación o pasará a recogerlo?`
                                                )}`} target="_blank" rel="noreferrer"
                                                    className="flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
                                                    <span className="material-symbols-outlined text-[14px]">help</span>
                                                    ¿Se repara? (15 días)
                                                </a>
                                            )}
                                            {repair.client_email && (
                                                <a href={`mailto:${repair.client_email}?subject=${encodeURIComponent(`Equipo en taller: ${repair.external_equipment_name || repair.equipment?.well_name || repair.equipment?.name || ''}`)}&body=${encodeURIComponent(
                                                    `Estimado(a) ${repair.external_client_name || repair.client?.company_name || 'Cliente'},

Le recordamos que su equipo se encuentra en nuestro taller Núcleo de Ingeniería.${repair.pickup_deadline_date ? `

Tiene hasta el ${new Date(repair.pickup_deadline_date + 'T12:00:00').toLocaleDateString('es-MX')} para recogerlo; de no hacerlo, el equipo será desechado.` : ''}

Cualquier duda, contáctenos.

Núcleo de Ingeniería`
                                                )}`}
                                                    className="flex items-center gap-1 rounded-lg bg-sky-100 px-3 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-400">
                                                    <span className="material-symbols-outlined text-[14px]">mail</span>
                                                    Enviar Correo
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Step 2: Recolección */}
                    <div className={stepClass(isCurrent('pickup_pending') || isCurrent('picked_up'), isDone('picked_up'))}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-600 text-[12px] font-bold dark:bg-orange-900/30">2</span>
                                Recolección del Equipo
                                {isDone('picked_up') && <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>}
                            </h4>
                            {editSection !== 'pickup' && <button onClick={() => startEdit('pickup', { pickup_method: repair.pickup_method || 'pickup', pickup_location: repair.pickup_location || '', pickup_date: repair.pickup_date || '' })} className="text-xs text-primary font-semibold">Editar</button>}
                        </div>
                        {editSection === 'pickup' ? (
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={labelClass}>Método</label><select value={editData.pickup_method} onChange={e => setEditData({...editData, pickup_method: e.target.value})} className={inputClass}>{Object.entries(PICKUP_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                                <div><label className={labelClass}>Lugar</label><input value={editData.pickup_location} onChange={e => setEditData({...editData, pickup_location: e.target.value})} className={inputClass} placeholder="Ubicación del equipo..." /></div>
                                <div><label className={labelClass}>Fecha</label><input type="date" value={editData.pickup_date} onChange={e => setEditData({...editData, pickup_date: e.target.value})} className={inputClass} /></div>
                                <div className="flex items-end gap-2"><button onClick={() => saveSection('pickup')} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">Guardar</button><button onClick={() => setEditSection(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">Cancelar</button></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <InfoField label="Método" value={PICKUP_METHOD_LABELS[repair.pickup_method] || '—'} />
                                <InfoField label="Lugar" value={repair.pickup_location} />
                                <InfoField label="Fecha" value={repair.pickup_date ? new Date(repair.pickup_date).toLocaleDateString('es-MX') : null} />
                            </div>
                        )}
                    </div>

                    {/* Step 3: Envío al Proveedor */}
                    <div className={stepClass(isCurrent('sent_to_provider') || isCurrent('received_by_provider'), isDone('received_by_provider'))}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-600 text-[12px] font-bold dark:bg-sky-900/30">3</span>
                                Envío al Proveedor / Taller Externo
                                {isDone('received_by_provider') && <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>}
                            </h4>
                            {editSection !== 'shipping_to' && (
                                <button onClick={() => {
                                    const curWs = workshops.find(w => w.name.toLowerCase() === (repair.external_provider || '').toLowerCase());
                                    startEdit('shipping_to', {
                                        external_provider: repair.external_provider || '',
                                        ws_phone: curWs?.contact_phone || '',
                                        ws_email: curWs?.contact_email || '',
                                        shipping_carrier_to: repair.shipping_carrier_to || '',
                                        tracking_number_to: repair.tracking_number_to || '',
                                        sent_to_provider_date: repair.sent_to_provider_date || '',
                                        provider_received_date: repair.provider_received_date || ''
                                    });
                                }} className="text-xs text-primary font-semibold">Editar</button>
                            )}
                        </div>
                        {editSection === 'shipping_to' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Proveedor / Taller</label>
                                    <input
                                        list="ws-list"
                                        value={editData.external_provider}
                                        onChange={e => {
                                            const pName = e.target.value;
                                            const matchedWs = workshops.find(w => w.name.toLowerCase() === pName.trim().toLowerCase());
                                            setEditData({
                                                ...editData,
                                                external_provider: pName,
                                                ws_phone: matchedWs ? (matchedWs.contact_phone || '') : editData.ws_phone || '',
                                                ws_email: matchedWs ? (matchedWs.contact_email || '') : editData.ws_email || '',
                                            });
                                        }}
                                        placeholder="Nombre del taller..."
                                        className={inputClass}
                                    />
                                    <datalist id="ws-list">{workshops.map(w => <option key={w.id} value={w.name}/>)}</datalist>
                                </div>
                                <div>
                                    <label className={labelClass}>Paquetería</label>
                                    <input list="cr-list" value={editData.shipping_carrier_to} onChange={e => setEditData({...editData, shipping_carrier_to: e.target.value})} placeholder="Paquetexpress, Tres Guerras..." className={inputClass} />
                                    <datalist id="cr-list">{carriers.map(c => <option key={c.id} value={c.name}/>)}</datalist>
                                </div>
                                <div>
                                    <label className={labelClass}>Celular / WhatsApp Taller</label>
                                    <input value={editData.ws_phone ?? ''} onChange={e => setEditData({...editData, ws_phone: e.target.value})} placeholder="Ej. 3411234567" className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Correo del Taller</label>
                                    <input type="email" value={editData.ws_email ?? ''} onChange={e => setEditData({...editData, ws_email: e.target.value})} placeholder="taller@ejemplo.com" className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>No. Guía</label>
                                    <input value={editData.tracking_number_to} onChange={e => setEditData({...editData, tracking_number_to: e.target.value})} placeholder="Número de guía..." className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Fecha Envío</label>
                                    <input type="date" value={editData.sent_to_provider_date} onChange={e => setEditData({...editData, sent_to_provider_date: e.target.value})} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Fecha Recepción Proveedor</label>
                                    <input type="date" value={editData.provider_received_date} onChange={e => setEditData({...editData, provider_received_date: e.target.value})} className={inputClass} />
                                </div>
                                <div className="md:col-span-2 flex items-center gap-2 pt-2">
                                    <button onClick={() => saveSection('shipping_to')} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">Guardar</button>
                                    <button onClick={() => setEditSection(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">Cancelar</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                                    <InfoField label="Proveedor" value={repair.external_provider} />
                                    <InfoField label="Paquetería" value={repair.shipping_carrier_to} />
                                    <InfoField label="Guía" value={repair.tracking_number_to} mono />
                                    <InfoField label="Enviado" value={repair.sent_to_provider_date ? new Date(repair.sent_to_provider_date).toLocaleDateString('es-MX') : null} />
                                    <InfoField label="Recibido" value={repair.provider_received_date ? new Date(repair.provider_received_date).toLocaleDateString('es-MX') : null} />
                                </div>
                                {(() => {
                                    const ws = workshops.find(w => w.name.toLowerCase() === (repair.external_provider || '').toLowerCase());
                                    const phone = ws?.contact_phone;
                                    const email = ws?.contact_email;
                                    const hasPhotos = shippingPhotos.length > 0;
                                    if (!repair.external_provider && !hasPhotos) return null;
                                    return (
                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {phone && (
                                                    <a href={`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                                        `Hola ${repair.external_provider}, le informamos que su guía de paquetería para el equipo "${repair.external_equipment_name || repair.equipment?.well_name || repair.equipment?.name || ''}" ya está disponible. Folio: ${repair.id.slice(0,8).toUpperCase()}.${repair.shipping_carrier_to ? ` Paquetería: ${repair.shipping_carrier_to}.` : ''}${repair.tracking_number_to ? ` No. Guía: ${repair.tracking_number_to}.` : ''}`
                                                    )}`} target="_blank" rel="noreferrer"
                                                        className="flex items-center gap-1 rounded-lg bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">
                                                        <span className="material-symbols-outlined text-[13px]">chat</span>
                                                        WhatsApp Taller ({phone})
                                                    </a>
                                                )}
                                                {email && (
                                                    <a href={`mailto:${email}?subject=${encodeURIComponent(`Guía de paquetería - ${repair.external_equipment_name || repair.equipment?.name || ''}`)}&body=${encodeURIComponent(
                                                        `Hola ${repair.external_provider},\n\nLe informamos que la guía de paquetería para el equipo "${repair.external_equipment_name || repair.equipment?.well_name || repair.equipment?.name || ''}" ya está disponible.\n\nFolio: ${repair.id.slice(0,8).toUpperCase()}\nPaquetería: ${repair.shipping_carrier_to || 'N/A'}\nNo. Guía: ${repair.tracking_number_to || 'N/A'}\n\nNúcleo de Ingeniería`
                                                    )}`}
                                                        className="flex items-center gap-1 rounded-lg bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-700 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-400">
                                                        <span className="material-symbols-outlined text-[13px]">mail</span>
                                                        Correo Taller
                                                    </a>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setTab('photos')}
                                                className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                                                <span className="material-symbols-outlined text-[14px]">local_shipping</span>
                                                {hasPhotos ? `Ver Fotos de Guía (${shippingPhotos.length})` : 'Subir Fotos de Guía'} →
                                            </button>
                                        </div>
                                    );
                                })()}
                            </>
                        )}
                    </div>

                    {/* Step 4: Diagnóstico */}
                    <div className={stepClass(isCurrent('diagnosis_received'), isDone('diagnosis_received'))}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-[12px] font-bold dark:bg-indigo-900/30">4</span>
                                Diagnóstico del Proveedor
                                {isDone('diagnosis_received') && <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>}
                            </h4>
                            {editSection !== 'diagnosis' && <button onClick={() => startEdit('diagnosis', { diagnosis: repair.diagnosis || '', diagnosis_date: repair.diagnosis_date || '' })} className="text-xs text-primary font-semibold">Editar</button>}
                        </div>
                        {editSection === 'diagnosis' ? (
                            <div className="space-y-3">
                                <div><label className={labelClass}>Diagnóstico</label><textarea value={editData.diagnosis} onChange={e => setEditData({...editData, diagnosis: e.target.value})} rows={3} className={inputClass + ' resize-none'} /></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className={labelClass}>Fecha Diagnóstico</label><input type="date" value={editData.diagnosis_date} onChange={e => setEditData({...editData, diagnosis_date: e.target.value})} className={inputClass} /></div>
                                    <div className="flex items-end gap-2"><button onClick={() => saveSection('diagnosis')} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">Guardar</button><button onClick={() => setEditSection(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">Cancelar</button></div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{repair.diagnosis || <span className="text-slate-400 italic">Pendiente de diagnóstico</span>}</p>
                                {repair.diagnosis_date && <p className="text-xs text-slate-400 mt-1">Recibido: {new Date(repair.diagnosis_date).toLocaleDateString('es-MX')}</p>}
                            </div>
                        )}
                    </div>

                    {/* Step 5: Cotización */}
                    <div className={stepClass(isCurrent('quoted'), isDone('quoted'))}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-600 text-[12px] font-bold dark:bg-purple-900/30">5</span>
                                Cotización al Cliente
                                {isDone('quoted') && <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>}
                            </h4>
                            {editSection !== 'quote' && <button onClick={() => startEdit('quote', { quote_amount: repair.quote_amount || 0, quote_date: repair.quote_date || '', quote_notes: repair.quote_notes || '' })} className="text-xs text-primary font-semibold">Editar</button>}
                        </div>
                        {editSection === 'quote' ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelClass}>Monto Cotización</label><input type="number" step="0.01" value={editData.quote_amount} onChange={e => setEditData({...editData, quote_amount: parseFloat(e.target.value) || 0})} className={inputClass} /></div>
                                <div><label className={labelClass}>Fecha</label><input type="date" value={editData.quote_date} onChange={e => setEditData({...editData, quote_date: e.target.value})} className={inputClass} /></div>
                                <div className="col-span-2"><label className={labelClass}>Notas</label><textarea value={editData.quote_notes} onChange={e => setEditData({...editData, quote_notes: e.target.value})} rows={2} className={inputClass + ' resize-none'} /></div>
                                <div className="flex gap-2"><button onClick={() => saveSection('quote')} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">Guardar</button><button onClick={() => setEditSection(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">Cancelar</button></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <InfoField label="Monto" value={repair.quote_amount > 0 ? formatCurrencyRepair(repair.quote_amount) : null} highlight />
                                <InfoField label="Fecha" value={repair.quote_date ? new Date(repair.quote_date).toLocaleDateString('es-MX') : null} />
                                <InfoField label="Notas" value={repair.quote_notes} />
                            </div>
                        )}
                    </div>

                    {/* Step 6: Autorización + OC */}
                    <div className={stepClass(isCurrent('authorized') || isCurrent('po_sent'), isDone('po_sent'))}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-600 text-[12px] font-bold dark:bg-fuchsia-900/30">6</span>
                                Autorización y Orden de Compra
                                {isDone('po_sent') && <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>}
                            </h4>
                            {editSection !== 'authorization' && <button onClick={() => startEdit('authorization', { authorization_date: repair.authorization_date || '', authorized_by: repair.authorized_by || '', purchase_order_number: repair.purchase_order_number || '', purchase_order_date: repair.purchase_order_date || '' })} className="text-xs text-primary font-semibold">Editar</button>}
                        </div>
                        {editSection === 'authorization' ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelClass}>Autorizado por</label><input value={editData.authorized_by} onChange={e => setEditData({...editData, authorized_by: e.target.value})} className={inputClass} /></div>
                                <div><label className={labelClass}>Fecha Autorización</label><input type="date" value={editData.authorization_date} onChange={e => setEditData({...editData, authorization_date: e.target.value})} className={inputClass} /></div>
                                <div><label className={labelClass}>No. Orden de Compra</label><input value={editData.purchase_order_number} onChange={e => setEditData({...editData, purchase_order_number: e.target.value})} className={inputClass} /></div>
                                <div><label className={labelClass}>Fecha OC</label><input type="date" value={editData.purchase_order_date} onChange={e => setEditData({...editData, purchase_order_date: e.target.value})} className={inputClass} /></div>
                                <div className="flex gap-2"><button onClick={() => saveSection('authorization')} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">Guardar</button><button onClick={() => setEditSection(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">Cancelar</button></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                <InfoField label="Autorizado por" value={repair.authorized_by} />
                                <InfoField label="Fecha Auth." value={repair.authorization_date ? new Date(repair.authorization_date).toLocaleDateString('es-MX') : null} />
                                <InfoField label="OC #" value={repair.purchase_order_number} mono />
                                <InfoField label="Fecha OC" value={repair.purchase_order_date ? new Date(repair.purchase_order_date).toLocaleDateString('es-MX') : null} />
                            </div>
                        )}
                    </div>

                    {/* Step 7: Reparación */}
                    <div className={stepClass(isCurrent('in_repair'), isDone('in_repair'))}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-[12px] font-bold dark:bg-amber-900/30">7</span>
                                En Reparación
                                {isDone('in_repair') && <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>}
                            </h4>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <InfoField label="Inicio" value={repair.repair_start_date ? new Date(repair.repair_start_date).toLocaleDateString('es-MX') : null} />
                            <InfoField label="Días Estimados" value={repair.estimated_days ? `${repair.estimated_days} días` : null} />
                        </div>
                    </div>

                    {/* Step 8: Regreso */}
                    <div className={stepClass(isCurrent('return_shipped') || isCurrent('return_received'), isDone('return_received'))}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-600 text-[12px] font-bold dark:bg-teal-900/30">8</span>
                                Regreso del Equipo
                                {isDone('return_received') && <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>}
                            </h4>
                            {editSection !== 'return' && <button onClick={() => startEdit('return', { shipping_carrier_return: repair.shipping_carrier_return || '', tracking_number_return: repair.tracking_number_return || '', return_shipped_date: repair.return_shipped_date || '', return_received_date: repair.return_received_date || '' })} className="text-xs text-primary font-semibold">Editar</button>}
                        </div>
                        {editSection === 'return' ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelClass}>Paquetería</label><input list="cr-ret" value={editData.shipping_carrier_return} onChange={e => setEditData({...editData, shipping_carrier_return: e.target.value})} className={inputClass} /><datalist id="cr-ret">{carriers.map(c => <option key={c.id} value={c.name}/>)}</datalist></div>
                                <div><label className={labelClass}>No. Guía Regreso</label><input value={editData.tracking_number_return} onChange={e => setEditData({...editData, tracking_number_return: e.target.value})} className={inputClass} /></div>
                                <div><label className={labelClass}>Fecha Envío Regreso</label><input type="date" value={editData.return_shipped_date} onChange={e => setEditData({...editData, return_shipped_date: e.target.value})} className={inputClass} /></div>
                                <div><label className={labelClass}>Fecha Recepción</label><input type="date" value={editData.return_received_date} onChange={e => setEditData({...editData, return_received_date: e.target.value})} className={inputClass} /></div>
                                <div className="flex gap-2"><button onClick={() => saveSection('return')} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">Guardar</button><button onClick={() => setEditSection(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">Cancelar</button></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                <InfoField label="Paquetería" value={repair.shipping_carrier_return} />
                                <InfoField label="Guía" value={repair.tracking_number_return} mono />
                                <InfoField label="Enviado" value={repair.return_shipped_date ? new Date(repair.return_shipped_date).toLocaleDateString('es-MX') : null} />
                                <InfoField label="Recibido" value={repair.return_received_date ? new Date(repair.return_received_date).toLocaleDateString('es-MX') : null} />
                            </div>
                        )}
                    </div>

                    {/* Step 9: Entrega */}
                    <div className={stepClass(isCurrent('delivered'), isDone('delivered'))}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-100 text-lime-600 text-[12px] font-bold dark:bg-lime-900/30">9</span>
                                Entrega al Cliente
                                {isDone('delivered') && <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>}
                            </h4>
                            {editSection !== 'delivery' && <button onClick={() => startEdit('delivery', { delivery_date: repair.delivery_date || '', delivery_notes: repair.delivery_notes || '' })} className="text-xs text-primary font-semibold">Editar</button>}
                        </div>
                        {editSection === 'delivery' ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelClass}>Fecha Entrega</label><input type="date" value={editData.delivery_date} onChange={e => setEditData({...editData, delivery_date: e.target.value})} className={inputClass} /></div>
                                <div><label className={labelClass}>Notas</label><input value={editData.delivery_notes} onChange={e => setEditData({...editData, delivery_notes: e.target.value})} className={inputClass} /></div>
                                <div className="flex gap-2"><button onClick={() => saveSection('delivery')} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">Guardar</button><button onClick={() => setEditSection(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">Cancelar</button></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <InfoField label="Fecha" value={repair.delivery_date ? new Date(repair.delivery_date).toLocaleDateString('es-MX') : null} />
                                <InfoField label="Notas" value={repair.delivery_notes} />
                            </div>
                        )}

                        {/* Fotos de Entrega — siempre visibles desde que se marca 'delivered' */}
                        {(repair.status === 'delivered' || repair.status === 'invoiced' || repair.status === 'completed') && (
                            <div className="mt-4 border-t border-slate-200/60 pt-4 dark:border-slate-700/60">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lime-600 text-[16px]">photo_camera</span>
                                    Evidencia fotográfica de entrega
                                </p>
                                {deliveryPhotos.length > 0
                                    ? <PhotoGallery photos={deliveryPhotos} />
                                    : null}
                                <div className="mt-2">
                                    <PhotoUploader
                                        photos={deliveryPhotos}
                                        onPhotosChange={async (photos) => {
                                            setDeliveryPhotos(photos);
                                            await supabase.from('equipment_repairs').update({ delivery_photos: photos }).eq('id', repair.id);
                                        }}
                                        folder={`repairs/delivery/${id}`}
                                        uploaderName="Evidencia Entrega"
                                        compact
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Step 10: Facturación */}
                    <div className={stepClass(isCurrent('invoiced'), isDone('invoiced'))}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-[12px] font-bold dark:bg-emerald-900/30">10</span>
                                Facturación
                                {isDone('invoiced') && <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>}
                            </h4>
                            {editSection !== 'invoice' && <button onClick={() => startEdit('invoice', { invoice_number: repair.invoice_number || '', invoice_date: repair.invoice_date || '', invoice_amount: repair.invoice_amount || 0 })} className="text-xs text-primary font-semibold">Editar</button>}
                        </div>
                        {editSection === 'invoice' ? (
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={labelClass}>No. Factura</label><input value={editData.invoice_number} onChange={e => setEditData({...editData, invoice_number: e.target.value})} className={inputClass} /></div>
                                <div><label className={labelClass}>Fecha</label><input type="date" value={editData.invoice_date} onChange={e => setEditData({...editData, invoice_date: e.target.value})} className={inputClass} /></div>
                                <div><label className={labelClass}>Monto</label><input type="number" step="0.01" value={editData.invoice_amount} onChange={e => setEditData({...editData, invoice_amount: parseFloat(e.target.value) || 0})} className={inputClass} /></div>
                                <div className="flex gap-2"><button onClick={() => saveSection('invoice')} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">Guardar</button><button onClick={() => setEditSection(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">Cancelar</button></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <InfoField label="Factura #" value={repair.invoice_number} mono />
                                <InfoField label="Fecha" value={repair.invoice_date ? new Date(repair.invoice_date).toLocaleDateString('es-MX') : null} />
                                <InfoField label="Monto" value={repair.invoice_amount > 0 ? formatCurrencyRepair(repair.invoice_amount) : null} highlight />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: Timeline */}
            {tab === 'timeline' && (
                <div className="space-y-4">
                    {isActive && <div className="flex gap-2">
                        <button onClick={() => setShowNoteForm(!showNoteForm)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white"><span className="material-symbols-outlined text-[16px]">add</span>Agregar Nota</button>
                    </div>}
                    {showNoteForm && (
                        <div className={sectionClass}>
                            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} placeholder="Escribe una nota o actualización..." className={inputClass + ' resize-none'} />
                            <div className="mt-3 flex gap-2"><button onClick={addNote} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">Guardar</button><button onClick={() => setShowNoteForm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">Cancelar</button></div>
                        </div>
                    )}
                    <div className="relative">
                        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
                        <div className="space-y-4">
                            {timeline.map(ev => {
                                const iconMap: Record<string, { icon: string; color: string }> = {
                                    status_change: { icon: 'swap_horiz', color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30' },
                                    note: { icon: 'sticky_note_2', color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' },
                                    photo: { icon: 'photo_camera', color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30' },
                                    cost_update: { icon: 'payments', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' },
                                    part_added: { icon: 'inventory_2', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' },
                                    shipping: { icon: 'local_shipping', color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30' },
                                    document: { icon: 'description', color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30' },
                                };
                                const ic = iconMap[ev.event_type] || iconMap.note;
                                return (
                                    <div key={ev.id} className="relative flex gap-4 pl-3">
                                        <div className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ic.color}`}>
                                            <span className="material-symbols-outlined text-[18px]">{ic.icon}</span>
                                        </div>
                                        <div className="flex-1 rounded-xl border border-slate-200/60 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800/80">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{ev.description}</p>
                                                <span className="text-[10px] text-slate-400">{new Date(ev.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {timeline.length === 0 && <p className="pl-14 text-sm text-slate-500">Sin eventos registrados.</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Parts */}
            {tab === 'parts' && (
                <div className="space-y-4">
                    {isActive && <button onClick={() => setShowPartForm(!showPartForm)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white"><span className="material-symbols-outlined text-[16px]">add</span>Agregar Refacción</button>}
                    {showPartForm && (
                        <form onSubmit={addPart} className={sectionClass}>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div className="md:col-span-2"><label className={labelClass}>Nombre de la Pieza *</label><input value={partForm.part_name} onChange={e => setPartForm({ ...partForm, part_name: e.target.value })} required className={inputClass} /></div>
                                <div><label className={labelClass}>No. Parte</label><input value={partForm.part_number} onChange={e => setPartForm({ ...partForm, part_number: e.target.value })} className={inputClass} /></div>
                                <div><label className={labelClass}>Cantidad</label><input type="number" step="0.01" value={partForm.quantity} onChange={e => setPartForm({ ...partForm, quantity: e.target.value })} className={inputClass} /></div>
                                <div><label className={labelClass}>Costo Unitario</label><input type="number" step="0.01" value={partForm.unit_cost} onChange={e => setPartForm({ ...partForm, unit_cost: e.target.value })} className={inputClass} /></div>
                                <div><label className={labelClass}>Origen</label><select value={partForm.source} onChange={e => setPartForm({ ...partForm, source: e.target.value as PartSource })} className={inputClass}>{(Object.keys(PART_SOURCE_LABELS) as PartSource[]).map(s => <option key={s} value={s}>{PART_SOURCE_LABELS[s]}</option>)}</select></div>
                            </div>
                            <div className="mt-3 flex gap-2"><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">Agregar</button><button type="button" onClick={() => setShowPartForm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">Cancelar</button></div>
                        </form>
                    )}
                    <div className={sectionClass}>
                        {parts.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Sin refacciones registradas.</p> : (
                            <table className="w-full text-sm">
                                <thead><tr className="border-b border-slate-200 dark:border-slate-700"><th className="pb-2 text-left text-xs text-slate-400">Pieza</th><th className="pb-2 text-center text-xs text-slate-400">Cant.</th><th className="pb-2 text-right text-xs text-slate-400">$ Unit.</th><th className="pb-2 text-right text-xs text-slate-400">Total</th><th className="pb-2 text-center text-xs text-slate-400">Origen</th></tr></thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {parts.map(p => (
                                        <tr key={p.id}>
                                            <td className="py-2 font-semibold text-slate-900 dark:text-white">{p.part_name}{p.part_number && <span className="ml-2 text-xs text-slate-400 font-mono">#{p.part_number}</span>}</td>
                                            <td className="py-2 text-center text-slate-600 dark:text-slate-300">{p.quantity}</td>
                                            <td className="py-2 text-right text-slate-600 dark:text-slate-300">{formatCurrencyRepair(p.unit_cost)}</td>
                                            <td className="py-2 text-right font-bold text-emerald-600">{formatCurrencyRepair(p.quantity * p.unit_cost)}</td>
                                            <td className="py-2 text-center"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{PART_SOURCE_LABELS[p.source]}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: Photos */}
            {tab === 'photos' && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Antes (Problema) */}
                    <div className={sectionClass}>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-red-500 text-[18px]">photo_camera</span>
                            Antes (Problema)
                            {beforePhotos.length > 0 && <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-700">{beforePhotos.length} foto{beforePhotos.length !== 1 ? 's' : ''}</span>}
                        </h4>
                        {beforePhotos.length > 0 && (
                            <div className="mb-3">
                                <PhotoGallery photos={beforePhotos} />
                            </div>
                        )}
                        <div className={beforePhotos.length > 0 ? 'border-t border-slate-200/60 pt-3 dark:border-slate-700/60' : ''}>
                            <PhotoUploader
                                photos={beforePhotos}
                                onPhotosChange={async (photos) => {
                                    setBeforePhotos(photos);
                                    await supabase.from('equipment_repairs').update({ photos_before: photos }).eq('id', repair.id);
                                }}
                                folder={`repairs/before/${id}`}
                                uploaderName="Recepción"
                                compact
                            />
                        </div>
                    </div>

                    {/* Guía de Paquetería */}
                    <div className={sectionClass}>
                        <h4 className="text-sm font-bold text-sky-700 dark:text-sky-400 mb-1 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sky-600 text-[18px]">local_shipping</span>
                            Guía de Paquetería
                            {shippingPhotos.length > 0 && <span className="ml-auto rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:bg-sky-900/30">{shippingPhotos.length} foto{shippingPhotos.length !== 1 ? 's' : ''}</span>}
                        </h4>
                        <p className="text-[10px] text-slate-400 mb-3">Paquetexpress, Tres Guerras, Castores, etc. Al subir foto se notifica al taller.</p>
                        
                        {shippingPhotos.length > 0 && (
                            <div className="mb-3">
                                <PhotoGallery photos={shippingPhotos} />
                            </div>
                        )}

                        {/* Info del taller para notificación y configuración de teléfono/correo */}
                        {repair.external_provider ? (
                            <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-800/40 dark:bg-sky-900/10">
                                {(() => {
                                    const ws = workshops.find(w => w.name.toLowerCase() === (repair.external_provider || '').toLowerCase());
                                    const phone = ws?.contact_phone;
                                    const email = ws?.contact_email;
                                    const hasContact = phone || email;

                                    if (editingWorkshopContact || !hasContact) {
                                        return (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-300 flex items-center justify-between">
                                                    <span>{hasContact ? 'Editar Contacto del Taller' : 'Registrar Contacto del Taller'}: {repair.external_provider}</span>
                                                    {hasContact && (
                                                        <button type="button" onClick={() => setEditingWorkshopContact(false)} className="text-[10px] text-slate-400 underline">
                                                            Cancelar
                                                        </button>
                                                    )}
                                                </p>
                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                    <div>
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase">Teléfono / WhatsApp</label>
                                                        <input
                                                            value={wsPhoneInput}
                                                            onChange={e => setWsPhoneInput(e.target.value)}
                                                            placeholder="Ej. 3411234567"
                                                            className={inputClass}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase">Correo Electrónico</label>
                                                        <input
                                                            type="email"
                                                            value={wsEmailInput}
                                                            onChange={e => setWsEmailInput(e.target.value)}
                                                            placeholder="taller@ejemplo.com"
                                                            className={inputClass}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => saveWorkshopContact(repair.external_provider!, wsPhoneInput, wsEmailInput)}
                                                        className="rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-sky-700 shadow-sm">
                                                        Guardar Datos del Taller
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400">
                                                    Notificar al Taller: <strong className="text-slate-800 dark:text-slate-100">{repair.external_provider}</strong>
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setWsPhoneInput(phone || '');
                                                        setWsEmailInput(email || '');
                                                        setEditingWorkshopContact(true);
                                                    }}
                                                    className="text-[10px] font-semibold text-sky-600 hover:underline flex items-center gap-0.5">
                                                    <span className="material-symbols-outlined text-[12px]">edit</span>
                                                    Editar contacto
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {phone && (
                                                    <a href={`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                                        `Hola ${repair.external_provider}, le informamos que su guía de paquetería para el equipo "${repair.external_equipment_name || repair.equipment?.well_name || repair.equipment?.name || ''}" ya está disponible. Folio de reparación: ${repair.id.slice(0,8).toUpperCase()}.${repair.shipping_carrier_to ? ` Paquetería: ${repair.shipping_carrier_to}.` : ''}${repair.tracking_number_to ? ` No. Guía: ${repair.tracking_number_to}.` : ''}`
                                                    )}`} target="_blank" rel="noreferrer"
                                                        className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-[11px] font-bold text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">
                                                        <span className="material-symbols-outlined text-[14px]">chat</span>
                                                        WhatsApp ({phone})
                                                    </a>
                                                )}
                                                {email && (
                                                    <a href={`mailto:${email}?subject=${encodeURIComponent(`Guía de paquetería - ${repair.external_equipment_name || repair.equipment?.name || ''}`)}&body=${encodeURIComponent(
                                                        `Hola ${repair.external_provider},\n\nLe informamos que la guía de paquetería para el equipo "${repair.external_equipment_name || repair.equipment?.well_name || repair.equipment?.name || ''}" ya está disponible.\n\nFolio: ${repair.id.slice(0,8).toUpperCase()}\nPaquetería: ${repair.shipping_carrier_to || 'N/A'}\nNo. Guía: ${repair.tracking_number_to || 'N/A'}\n\nNúcleo de Ingeniería`
                                                    )}`}
                                                        className="flex items-center gap-1 rounded-lg bg-sky-100 px-3 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-400">
                                                        <span className="material-symbols-outlined text-[14px]">mail</span>
                                                        Enviar Correo
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 dark:border-amber-800/40 dark:bg-amber-900/10 text-[11px] text-amber-700 dark:text-amber-400">
                                ℹ️ Asigna un proveedor/taller en el <strong>Paso 3 (Envío al Proveedor)</strong> para habilitar las notificaciones por WhatsApp y correo.
                            </div>
                        )}

                        <div className={shippingPhotos.length > 0 ? 'border-t border-slate-200/60 pt-3 dark:border-slate-700/60' : ''}>
                            <PhotoUploader
                                photos={shippingPhotos}
                                onPhotosChange={async (photos) => {
                                    const isNewUpload = photos.length > shippingPhotos.length;
                                    setShippingPhotos(photos);
                                    await supabase.from('equipment_repairs').update({ shipping_guide_photos: photos }).eq('id', repair.id);
                                    // Si subió foto y hay taller con teléfono, abrir WhatsApp automáticamente
                                    if (isNewUpload && repair.external_provider) {
                                        const ws = workshops.find(w => w.name.toLowerCase() === repair.external_provider?.toLowerCase());
                                        if (ws?.contact_phone) {
                                            const msg = encodeURIComponent(
                                                `Hola ${repair.external_provider}, le informamos que su guía de paquetería para el equipo "${repair.external_equipment_name || repair.equipment?.well_name || repair.equipment?.name || ''}" ya está disponible. Paquetería: ${repair.shipping_carrier_to || 'N/A'}, No. Guía: ${repair.tracking_number_to || 'N/A'}. Folio: ${repair.id.slice(0,8).toUpperCase()}.`
                                            );
                                            window.open(`https://wa.me/${ws.contact_phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
                                        }
                                    }
                                }}
                                folder={`repairs/shipping/${id}`}
                                uploaderName="Paquetería"
                                compact
                            />
                        </div>
                    </div>

                    {/* Después (Reparado) */}
                    <div className={sectionClass}>
                        <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            Después (Reparado)
                            {afterPhotos.length > 0 && <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-900/30">{afterPhotos.length} foto{afterPhotos.length !== 1 ? 's' : ''}</span>}
                        </h4>
                        {afterPhotos.length > 0 && (
                            <div className="mb-3">
                                <PhotoGallery photos={afterPhotos} />
                            </div>
                        )}
                        <div className={afterPhotos.length > 0 ? 'border-t border-slate-200/60 pt-3 dark:border-slate-700/60' : ''}>
                            <PhotoUploader
                                photos={afterPhotos}
                                onPhotosChange={async (photos) => {
                                    setAfterPhotos(photos);
                                    await supabase.from('equipment_repairs').update({ photos_after: photos }).eq('id', repair.id);
                                }}
                                folder={`repairs/after/${id}`}
                                uploaderName="Técnico"
                                compact
                            />
                        </div>
                    </div>

                    {/* Entrega al Cliente */}
                    <div className={sectionClass}>
                        <h4 className="text-sm font-bold text-lime-700 dark:text-lime-400 mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-lime-600 text-[18px]">assignment_turned_in</span>
                            Evidencia de Entrega al Cliente
                            {deliveryPhotos.length > 0 && <span className="ml-auto rounded-full bg-lime-100 px-2 py-0.5 text-[10px] font-bold text-lime-600 dark:bg-lime-900/30">{deliveryPhotos.length} foto{deliveryPhotos.length !== 1 ? 's' : ''}</span>}
                        </h4>
                        {deliveryPhotos.length > 0 && (
                            <div className="mb-3">
                                <PhotoGallery photos={deliveryPhotos} />
                            </div>
                        )}
                        <div className={deliveryPhotos.length > 0 ? 'border-t border-slate-200/60 pt-3 dark:border-slate-700/60' : ''}>
                            <PhotoUploader
                                photos={deliveryPhotos}
                                onPhotosChange={async (photos) => {
                                    setDeliveryPhotos(photos);
                                    await supabase.from('equipment_repairs').update({ delivery_photos: photos }).eq('id', repair.id);
                                }}
                                folder={`repairs/delivery/${id}`}
                                uploaderName="Entrega"
                                compact
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* Reusable Info Field */
function InfoField({ label, value, mono, highlight }: { label: string; value: string | null | undefined; mono?: boolean; highlight?: boolean }) {
    return (
        <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
            <p className={`text-sm ${!value ? 'text-slate-300 italic dark:text-slate-600' : highlight ? 'font-bold text-emerald-600' : mono ? 'font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded inline-block' : 'text-slate-700 dark:text-slate-300'}`}>
                {value || 'Pendiente'}
            </p>
        </div>
    );
}
