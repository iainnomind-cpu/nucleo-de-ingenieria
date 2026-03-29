import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    ServiceCatalogItem,
    RiskLevel,
    RISK_LABELS,
    calculateQuoteTotals,
    formatCurrency,
} from '../../types/quotes';
import { Client } from '../../types/crm';
import { OperationalDefaults, DEFAULT_OPERATIONAL_VALUES } from '../../types/settings';
import { calculateDistance, NUCLEO_HQ, DistanceResult } from '../../lib/maps';

interface LineItem {
    tempId: string;
    service_id: string | null;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    maxStock?: number | null;
}

export default function QuoteBuilder() {
    const navigate = useNavigate();
    const location = useLocation();

    // Parse query params for M1 prefill
    const queryParams = new URLSearchParams(location.search);
    const initialClientId = queryParams.get('client_id') || '';
    const initialTitle = queryParams.get('title') || '';
    const initialWorkType = queryParams.get('work_type') || '';
    const initialMotorHp = queryParams.get('hp') || '';
    const initialWellDepth = queryParams.get('depth') || '';

    const [clients, setClients] = useState<Pick<Client, 'id' | 'company_name' | 'latitude' | 'longitude' | 'formatted_address'>[]>([]);
    const [services, setServices] = useState<ServiceCatalogItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [travelInfo, setTravelInfo] = useState<DistanceResult | null>(null);
    const [calculatingDistance, setCalculatingDistance] = useState(false);

    // Quote header
    const [clientId, setClientId] = useState(initialClientId);
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState('');
    const [workType, setWorkType] = useState(initialWorkType);
    const [wellDepth, setWellDepth] = useState(initialWellDepth);
    const [motorHp, setMotorHp] = useState(initialMotorHp);
    const [distanceKm, setDistanceKm] = useState('');
    const [crewSize, setCrewSize] = useState('2');
    const [estimatedDays, setEstimatedDays] = useState('1');
    const [riskLevel, setRiskLevel] = useState<RiskLevel>('normal');
    const [marginPercent, setMarginPercent] = useState('20');
    const [discountPercent, setDiscountPercent] = useState('0');
    const [taxPercent, setTaxPercent] = useState('16');
    const [costPerKm, setCostPerKm] = useState('5.50');
    const [viaticosPerPerson, setViaticosPerPerson] = useState('850');
    const [insuranceCost, setInsuranceCost] = useState('0');
    const [vehicleWear, setVehicleWear] = useState('0');
    const [maniobraCost, setManiobraCost] = useState('0');
    const [validUntil, setValidUntil] = useState('');
    const [notes, setNotes] = useState('');

    // Line items
    const [items, setItems] = useState<LineItem[]>([]);

    useEffect(() => {
        supabase.from('clients').select('id, company_name, latitude, longitude, formatted_address').order('company_name').then(({ data }) => setClients(data || []));
        supabase.from('service_catalog').select('*').eq('is_active', true).order('name').then(({ data }) => setServices(data || []));

        // Cargar parámetros operativos por defecto desde configuración del sistema
        supabase.from('system_settings').select('value').eq('key', 'operational_defaults').single().then(({ data }) => {
            const d: OperationalDefaults = data?.value
                ? { ...DEFAULT_OPERATIONAL_VALUES, ...(data.value as Partial<OperationalDefaults>) }
                : DEFAULT_OPERATIONAL_VALUES;
            setCostPerKm(d.cost_per_km.toString());
            setViaticosPerPerson(d.viaticos_per_person.toString());
            setInsuranceCost(d.insurance_cost.toString());
            setVehicleWear(d.vehicle_wear.toString());
            setManiobraCost(d.maniobra_cost.toString());
            setMarginPercent(d.margin_percent.toString());
            setTaxPercent(d.tax_percent.toString());
            setCrewSize(d.crew_size.toString());
            setEstimatedDays(d.estimated_days.toString());
        });
    }, []);

    // M-Maps: Auto-calculate distance when client is selected
    useEffect(() => {
        if (!clientId) { setTravelInfo(null); return; }
        const client = clients.find(c => c.id === clientId);
        if (!client?.latitude || !client?.longitude) { setTravelInfo(null); return; }
        setCalculatingDistance(true);
        calculateDistance(NUCLEO_HQ, { lat: client.latitude, lng: client.longitude }).then(result => {
            if (result) {
                setDistanceKm(result.distance_km.toString());
                setTravelInfo(result);
            }
            setCalculatingDistance(false);
        });
    }, [clientId, clients]);

    const addItem = async (service?: ServiceCatalogItem) => {
        let maxStock: number | null = null;

        // → M4: Verify Availability
        if (service) {
            // Check if there is a matching product in inventory (M4)
            const { data: invProduct } = await supabase.from('inventory_products')
                .select('current_stock, unit')
                .eq('name', service.name)
                .single();

            if (invProduct) {
                maxStock = invProduct.current_stock;
                if (maxStock !== null && maxStock <= 0) {
                    alert(`⚠️ Advertencia (M4): El artículo "${service.name}" se encuentra sin stock en inventario.`);
                }
            }
        }

        setItems([...items, {
            tempId: crypto.randomUUID(),
            service_id: service?.id || null,
            description: service?.name || '',
            quantity: 1,
            unit: service?.unit || 'servicio',
            unit_price: service?.base_price || 0,
            maxStock: maxStock ?? undefined // Store for UI validation
        }]);
    };

    const updateItem = (tempId: string, field: keyof LineItem, value: string | number) => {
        setItems(items.map(i => i.tempId === tempId ? { ...i, [field]: value } : i));
    };

    const removeItem = (tempId: string) => {
        setItems(items.filter(i => i.tempId !== tempId));
    };

    // Calculate totals
    const totals = useMemo(() => calculateQuoteTotals({
        items: items.map(i => ({ quantity: i.quantity, unit_price: i.unit_price })),
        distance_km: parseFloat(distanceKm) || 0,
        crew_size: parseInt(crewSize) || 1,
        estimated_days: parseInt(estimatedDays) || 1,
        cost_per_km: parseFloat(costPerKm) || 0,
        viaticos_per_person: parseFloat(viaticosPerPerson) || 0,
        insurance_cost: parseFloat(insuranceCost) || 0,
        vehicle_wear: parseFloat(vehicleWear) || 0,
        maniobra_cost: parseFloat(maniobraCost) || 0,
        margin_percent: parseFloat(marginPercent) || 0,
        discount_percent: parseFloat(discountPercent) || 0,
        tax_percent: parseFloat(taxPercent) || 0,
        risk_level: riskLevel,
        well_depth: parseFloat(wellDepth) || undefined,
        motor_hp: parseFloat(motorHp) || undefined,
    }), [items, distanceKm, crewSize, estimatedDays, costPerKm, viaticosPerPerson, insuranceCost, vehicleWear, maniobraCost, marginPercent, discountPercent, taxPercent, riskLevel, wellDepth, motorHp]);

    const handleSave = async (status: 'draft' | 'sent' = 'draft') => {
        if (!title.trim()) return alert('El título es requerido');
        setSaving(true);

        // Generate quote number
        const year = new Date().getFullYear();
        const { count } = await supabase.from('quotes').select('*', { count: 'exact', head: true });
        const quoteNumber = `COT-${year}-${String((count || 0) + 1).padStart(4, '0')}`;

        const { data: quote, error } = await supabase.from('quotes').insert({
            quote_number: quoteNumber,
            client_id: clientId || null,
            status,
            title,
            description: description || null,
            work_type: workType || null,
            well_depth: parseFloat(wellDepth) || null,
            motor_hp: parseFloat(motorHp) || null,
            distance_km: parseFloat(distanceKm) || null,
            crew_size: parseInt(crewSize) || 1,
            risk_level: riskLevel,
            estimated_days: parseInt(estimatedDays) || 1,
            subtotal: totals.subtotal,
            margin_percent: parseFloat(marginPercent) || 0,
            margin_amount: totals.margin_amount,
            discount_percent: parseFloat(discountPercent) || 0,
            discount_amount: totals.discount_amount,
            tax_percent: parseFloat(taxPercent) || 0,
            tax_amount: totals.tax_amount,
            total: totals.total,
            cost_per_km: parseFloat(costPerKm) || 0,
            viaticos_per_person: parseFloat(viaticosPerPerson) || 0,
            insurance_cost: parseFloat(insuranceCost) || 0,
            vehicle_wear: parseFloat(vehicleWear) || 0,
            maniobra_cost: parseFloat(maniobraCost) || 0,
            valid_until: validUntil || null,
            notes: notes || null,
        }).select().single();

        if (error || !quote) {
            alert('Error al guardar: ' + (error?.message || 'unknown'));
            setSaving(false);
            return;
        }

        // Save items
        if (items.length > 0) {
            await supabase.from('quote_items').insert(
                items.map((item, idx) => ({
                    quote_id: quote.id,
                    service_id: item.service_id || null,
                    description: item.description,
                    quantity: item.quantity,
                    unit: item.unit,
                    unit_price: item.unit_price,
                    subtotal: item.quantity * item.unit_price,
                    sort_order: idx,
                }))
            );
        }

        // → Pipeline Sync: Al enviar cotización, mover oportunidad a "Cotización Enviada"
        if (status === 'sent' && clientId) {
            const { data: existingOpp } = await supabase.from('sales_opportunities')
                .select('id').eq('client_id', clientId)
                .in('stage', ['prospecting', 'quoting'])
                .order('created_at', { ascending: false }).limit(1).maybeSingle();

            if (existingOpp) {
                await supabase.from('sales_opportunities').update({
                    stage: 'quoting',
                    estimated_value: totals.total,
                    probability: 40,
                    title: title,
                }).eq('id', existingOpp.id);
                await supabase.from('quotes').update({ opportunity_id: existingOpp.id }).eq('id', quote.id);
            } else {
                const { data: newOpp } = await supabase.from('sales_opportunities').insert({
                    client_id: clientId,
                    title: title,
                    estimated_value: totals.total,
                    probability: 40,
                    stage: 'quoting',
                }).select().single();
                if (newOpp) {
                    await supabase.from('quotes').update({ opportunity_id: newOpp.id }).eq('id', quote.id);
                }
            }
        }

        setSaving(false);
        navigate(`/quotes/${quote.id}`);
    };

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';
    const sectionClass = 'rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50';

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/quotes')}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        Volver
                    </button>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                        Nueva Cotización
                    </h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleSave('draft')} disabled={saving}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-50">
                        <span className="material-symbols-outlined text-[18px]">save</span>
                        Guardar Borrador
                    </button>
                    <button onClick={() => handleSave('sent')} disabled={saving}
                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 disabled:opacity-50">
                        <span className="material-symbols-outlined text-[18px]">send</span>
                        Guardar y Enviar
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                {/* LEFT: Form */}
                <div className="flex flex-col gap-6 xl:col-span-2">
                    {/* General Info */}
                    <div className={sectionClass}>
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                            <span className="material-symbols-outlined text-primary text-[20px]">info</span>
                            Información General
                        </h3>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <label className={labelClass}>Título de la Cotización *</label>
                                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Aforo y equipamiento pozo #3" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Cliente</label>
                                <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputClass}>
                                    <option value="">Seleccionar cliente...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Tipo de Trabajo</label>
                                <input value={workType} onChange={e => setWorkType(e.target.value)} placeholder="Ej: Aforo, Equipamiento..." className={inputClass} />
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelClass}>Descripción</label>
                                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Detalles adicionales..." className={inputClass + ' resize-none'} />
                            </div>
                        </div>
                    </div>

                    {/* Technical Variables */}
                    <div className={sectionClass}>
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                            <span className="material-symbols-outlined text-primary text-[20px]">engineering</span>
                            Variables Técnicas
                        </h3>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div>
                                <label className={labelClass}>Profundidad (m)</label>
                                <input type="number" value={wellDepth} onChange={e => setWellDepth(e.target.value)} placeholder="120" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>HP Motor</label>
                                <input type="number" value={motorHp} onChange={e => setMotorHp(e.target.value)} placeholder="50" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Distancia (km) <span className="text-emerald-500 font-normal normal-case">{travelInfo ? (travelInfo.distance_text.startsWith('~') ? '✓ Estimado' : '✓ Maps') : ''}</span></label>
                                {calculatingDistance ? (
                                    <div className="flex items-center gap-2 h-[42px] text-sm text-slate-400">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                                        Calculando ruta...
                                    </div>
                                ) : (
                                    <input type="number" value={distanceKm} onChange={e => { setDistanceKm(e.target.value); setTravelInfo(null); }} placeholder="Ej: 85" className={inputClass} />
                                )}
                                {travelInfo && (
                                    <div className="mt-1 flex items-center gap-2 text-[10px] text-emerald-600 dark:text-emerald-400">
                                        <span className="material-symbols-outlined text-[12px]">route</span>
                                        {travelInfo.distance_text} · {travelInfo.duration_text}
                                    </div>
                                )}
                                {clientId && !calculatingDistance && !travelInfo && (() => {
                                    const cl = clients.find(c => c.id === clientId);
                                    return !cl?.latitude ? (
                                        <p className="mt-1 text-[10px] text-amber-500 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[12px]">warning</span>
                                            Cliente sin GPS — ingresa km manualmente o agrega dirección en CRM
                                        </p>
                                    ) : null;
                                })()}
                            </div>
                            <div>
                                <label className={labelClass}>Nivel de Riesgo</label>
                                <select value={riskLevel} onChange={e => setRiskLevel(e.target.value as RiskLevel)} className={inputClass}>
                                    {(Object.keys(RISK_LABELS) as RiskLevel[]).map(r => <option key={r} value={r}>{RISK_LABELS[r]}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Personal</label>
                                <input type="number" min="1" value={crewSize} onChange={e => setCrewSize(e.target.value)} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Días Estimados</label>
                                <input type="number" min="1" value={estimatedDays} onChange={e => setEstimatedDays(e.target.value)} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Vigencia</label>
                                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={inputClass} />
                            </div>
                        </div>
                    </div>

                    {/* Cost Variables */}
                    <div className={sectionClass}>
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                            <span className="material-symbols-outlined text-primary text-[20px]">calculate</span>
                            Costos Operativos
                        </h3>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                            <div>
                                <label className={labelClass}>Costo/km</label>
                                <input type="number" step="0.01" value={costPerKm} onChange={e => setCostPerKm(e.target.value)} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Viáticos/persona</label>
                                <input type="number" step="0.01" value={viaticosPerPerson} onChange={e => setViaticosPerPerson(e.target.value)} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Seguros</label>
                                <input type="number" step="0.01" value={insuranceCost} onChange={e => setInsuranceCost(e.target.value)} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Desgaste Vehículo</label>
                                <input type="number" step="0.01" value={vehicleWear} onChange={e => setVehicleWear(e.target.value)} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Maniobras</label>
                                <input type="number" step="0.01" value={maniobraCost} onChange={e => setManiobraCost(e.target.value)} className={inputClass} />
                            </div>
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className={sectionClass}>
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-primary text-[20px]">list_alt</span>
                                Conceptos / Servicios
                            </h3>
                            <div className="flex gap-2">
                                <select onChange={e => { const svc = services.find(s => s.id === e.target.value); if (svc) addItem(svc); e.target.value = ''; }}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                                    <option value="">+ Agregar del catálogo</option>
                                    {services.map(s => <option key={s.id} value={s.id}>{s.name} — {formatCurrency(s.base_price)}</option>)}
                                </select>
                                <button onClick={() => addItem()}
                                    className="flex items-center gap-1 rounded-lg border border-dashed border-primary px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5">
                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                    Línea Manual
                                </button>
                            </div>
                        </div>

                        {items.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 py-8 text-center dark:border-slate-700 dark:bg-slate-800/30">
                                <span className="material-symbols-outlined text-[40px] text-slate-300">playlist_add</span>
                                <p className="mt-2 text-sm text-slate-500">Agrega conceptos del catálogo o líneas manuales.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {items.map((item, idx) => (
                                    <div key={item.tempId} className="flex items-center gap-3 rounded-lg border border-slate-200/60 bg-white p-3 dark:border-slate-700/60 dark:bg-slate-800/50">
                                        <span className="text-xs font-bold text-slate-400 w-6">{idx + 1}</span>
                                        <input value={item.description} onChange={e => updateItem(item.tempId, 'description', e.target.value)}
                                            placeholder="Descripción" className="flex-1 rounded border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                                        <div className="flex flex-col w-20">
                                            <input type="number" value={item.quantity} onChange={e => updateItem(item.tempId, 'quantity', parseFloat(e.target.value) || 0)}
                                                className={`w-full rounded border px-3 py-1.5 text-sm text-center dark:bg-slate-800 dark:text-white ${item.maxStock !== null && item.maxStock !== undefined && item.quantity > item.maxStock ? 'border-red-500 text-red-600 focus:ring-red-200' : 'border-slate-200 dark:border-slate-700'}`} placeholder="Cant" />
                                            {item.maxStock !== null && item.maxStock !== undefined && (
                                                <span className={`text-[10px] mt-0.5 text-center ${item.quantity > item.maxStock ? 'text-red-500 font-bold' : 'text-slate-400'}`}>Stock: {item.maxStock}</span>
                                            )}
                                        </div>
                                        <select value={item.unit} onChange={e => updateItem(item.tempId, 'unit', e.target.value)}
                                            className="w-24 rounded border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                                            <option value="servicio">Servicio</option><option value="hora">Hora</option><option value="metro">Metro</option>
                                            <option value="km">Km</option><option value="pieza">Pieza</option><option value="dia">Día</option>
                                        </select>
                                        <input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(item.tempId, 'unit_price', parseFloat(e.target.value) || 0)}
                                            className="w-32 rounded border border-slate-200 px-3 py-1.5 text-sm text-right dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Precio" />
                                        <span className="w-28 text-right text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(item.quantity * item.unit_price)}</span>
                                        <button onClick={() => removeItem(item.tempId)} className="rounded p-1 text-slate-400 hover:text-red-500">
                                            <span className="material-symbols-outlined text-[18px]">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div className={sectionClass}>
                        <label className={labelClass}>Notas / Observaciones</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Condiciones, exclusiones, notas especiales..." className={inputClass + ' resize-none'} />
                    </div>
                </div>

                {/* RIGHT: Live Summary */}
                <div className="xl:col-span-1">
                    <div className="sticky top-8 rounded-xl border border-slate-200/60 bg-white/50 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-primary text-[20px]">receipt_long</span>
                                Resumen de Cotización
                            </h3>
                        </div>
                        <div className="p-5 space-y-3 text-sm">
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Servicios ({items.length} conceptos)</span>
                                <span className="font-medium">{formatCurrency(items.reduce((s, i) => s + i.quantity * i.unit_price, 0))}</span>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Costos Operativos</span>
                                <span className="font-medium">{formatCurrency(totals.operational_costs)}</span>
                            </div>
                            <div className="pl-4 space-y-1 text-xs text-slate-400">
                                <div className="flex justify-between"><span>Traslado ({distanceKm || '0'} km × 2)</span><span>{formatCurrency(totals.travel_cost)}</span></div>
                                <div className="flex justify-between"><span>Viáticos ({crewSize} pers × {estimatedDays} días)</span><span>{formatCurrency(totals.viaticos_cost)}</span></div>
                                {parseFloat(insuranceCost) > 0 && <div className="flex justify-between"><span>Seguros</span><span>{formatCurrency(parseFloat(insuranceCost))}</span></div>}
                                {parseFloat(vehicleWear) > 0 && <div className="flex justify-between"><span>Desgaste vehículo</span><span>{formatCurrency(parseFloat(vehicleWear))}</span></div>}
                                {parseFloat(maniobraCost) > 0 && <div className="flex justify-between"><span>Maniobras</span><span>{formatCurrency(parseFloat(maniobraCost))}</span></div>}
                            </div>

                            {totals.complexity_factor > 1 && (
                                <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400">
                                    <span>Factor complejidad</span>
                                    <span>×{totals.complexity_factor.toFixed(3)}</span>
                                </div>
                            )}

                            <div className="border-t border-slate-200 pt-2 dark:border-slate-700">
                                <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
                                    <span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span>
                                </div>
                            </div>

                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Margen ({totals.effective_margin.toFixed(1)}%)</span>
                                <span className="text-emerald-600">+{formatCurrency(totals.margin_amount)}</span>
                            </div>

                            {totals.discount_amount > 0 && (
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                    <span>Descuento ({discountPercent}%)</span>
                                    <span className="text-red-500">-{formatCurrency(totals.discount_amount)}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>IVA ({taxPercent}%)</span>
                                <span>{formatCurrency(totals.tax_amount)}</span>
                            </div>

                            <div className="border-t-2 border-primary/30 pt-3">
                                <div className="flex justify-between">
                                    <span className="text-lg font-bold text-slate-900 dark:text-white">Total</span>
                                    <span className="text-2xl font-bold text-primary">{formatCurrency(totals.total)}</span>
                                </div>
                            </div>

                            {/* Margin sliders */}
                            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-xs font-semibold text-slate-500">Margen de Utilidad</label>
                                        <span className="text-xs font-bold text-primary">{marginPercent}%</span>
                                    </div>
                                    <input type="range" min="0" max="50" step="1" value={marginPercent}
                                        onChange={e => setMarginPercent(e.target.value)} className="w-full accent-primary" />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-xs font-semibold text-slate-500">Descuento</label>
                                        <span className="text-xs font-bold text-red-500">{discountPercent}%</span>
                                    </div>
                                    <input type="range" min="0" max="30" step="1" value={discountPercent}
                                        onChange={e => setDiscountPercent(e.target.value)} className="w-full accent-red-500" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
