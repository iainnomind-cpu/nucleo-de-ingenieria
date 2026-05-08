import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
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
import {
    InventoryProduct,
    CATEGORY_LABELS,
    UNIT_LABELS,
    getStockStatus,
    STOCK_STATUS_CONFIG,
    formatCurrencyInv,
} from '../../types/inventory';

interface LineItem {
    tempId: string;
    service_id: string | null;
    product_id: string | null;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    maxStock?: number | null;
    source: 'catalog' | 'inventory' | 'manual';
}

export default function QuoteBuilder() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id: editId } = useParams<{ id: string }>();
    const isEditMode = Boolean(editId);

    // Parse query params for M1 prefill
    const queryParams = new URLSearchParams(location.search);
    const initialClientId = queryParams.get('client_id') || '';
    const initialTitle = queryParams.get('title') || '';
    const initialWorkType = queryParams.get('work_type') || '';
    const initialMotorHp = queryParams.get('hp') || '';
    const initialWellDepth = queryParams.get('depth') || '';

    const [editQuoteNumber, setEditQuoteNumber] = useState('');

    const [clients, setClients] = useState<Pick<Client, 'id' | 'company_name' | 'latitude' | 'longitude' | 'formatted_address'>[]>([]);
    const [services, setServices] = useState<ServiceCatalogItem[]>([]);
    const [invProducts, setInvProducts] = useState<InventoryProduct[]>([]);
    const [saving, setSaving] = useState(false);
    const [travelInfo, setTravelInfo] = useState<DistanceResult | null>(null);
    const [calculatingDistance, setCalculatingDistance] = useState(false);
    const [showInvPicker, setShowInvPicker] = useState(false);
    const [invSearch, setInvSearch] = useState('');

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
    // New fields for Excel-format cotización
    const [clientAddress, setClientAddress] = useState('');
    const [propertyName, setPropertyName] = useState('');
    const [paymentTerms, setPaymentTerms] = useState('70% AL CONTRATAR 30% AL FINALIZAR');
    const [deliveryDays, setDeliveryDays] = useState('10 DIAS HABILES');
    const [exchangeRate, setExchangeRate] = useState('20.00');
    const [introText, setIntroText] = useState('Atendiendo a su amable solicitud, ponemos a su consideración la siguiente propuesta económica para realizar los trabajos de');

    // Line items
    const [items, setItems] = useState<LineItem[]>([]);

    useEffect(() => {
        supabase.from('clients').select('id, company_name, latitude, longitude, formatted_address').order('company_name').then(({ data }) => setClients(data || []));
        supabase.from('service_catalog').select('*').eq('is_active', true).order('name').then(({ data }) => setServices(data || []));
        supabase.from('inventory_products').select('*').eq('is_active', true).order('name').then(({ data }) => setInvProducts((data as InventoryProduct[]) || []));

        if (!isEditMode) {
            // Only load defaults for NEW quotes
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
        }
    }, [isEditMode]);

    // Load existing quote data when editing
    useEffect(() => {
        if (!editId) return;
        const loadQuote = async () => {
            const { data: q } = await supabase.from('quotes').select('*').eq('id', editId).single();
            if (!q) { navigate('/quotes'); return; }
            setEditQuoteNumber(q.quote_number || '');
            setClientId(q.client_id || '');
            setTitle(q.title || '');
            setDescription(q.description || '');
            setWorkType(q.work_type || '');
            setWellDepth(q.well_depth?.toString() || '');
            setMotorHp(q.motor_hp?.toString() || '');
            setDistanceKm(q.distance_km?.toString() || '');
            setCrewSize(q.crew_size?.toString() || '2');
            setEstimatedDays(q.estimated_days?.toString() || '1');
            setRiskLevel(q.risk_level || 'normal');
            setMarginPercent(q.margin_percent?.toString() || '20');
            setDiscountPercent(q.discount_percent?.toString() || '0');
            setTaxPercent(q.tax_percent?.toString() || '16');
            setCostPerKm(q.cost_per_km?.toString() || '5.50');
            setViaticosPerPerson(q.viaticos_per_person?.toString() || '850');
            setInsuranceCost(q.insurance_cost?.toString() || '0');
            setVehicleWear(q.vehicle_wear?.toString() || '0');
            setManiobraCost(q.maniobra_cost?.toString() || '0');
            setValidUntil(q.valid_until || '');
            setNotes(q.notes || '');
            setClientAddress(q.client_address || '');
            setPropertyName(q.property_name || '');
            setPaymentTerms(q.payment_terms || '70% AL CONTRATAR 30% AL FINALIZAR');
            setDeliveryDays(q.delivery_days || '10 DIAS HABILES');
            setExchangeRate(q.exchange_rate?.toString() || '20.00');
            setIntroText(q.intro_text || '');

            // Load items
            const { data: existingItems } = await supabase.from('quote_items').select('*').eq('quote_id', editId).order('sort_order');
            if (existingItems) {
                setItems(existingItems.map(it => ({
                    tempId: crypto.randomUUID(),
                    service_id: it.service_id || null,
                    product_id: it.product_id || null,
                    description: it.description,
                    quantity: it.quantity,
                    unit: it.unit,
                    unit_price: it.unit_price,
                    source: it.product_id ? 'inventory' : it.service_id ? 'catalog' : 'manual',
                })));
            }
        };
        loadQuote();
    }, [editId, navigate]);

    // M-Maps: Auto-calculate distance when client is selected + auto-fill address
    useEffect(() => {
        if (!clientId) { setTravelInfo(null); return; }
        const client = clients.find(c => c.id === clientId);
        // Auto-fill address from CRM if available
        if (client?.formatted_address && !clientAddress) {
            setClientAddress(client.formatted_address);
        }
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
            product_id: null,
            description: service?.name || '',
            quantity: 1,
            unit: service?.unit || 'servicio',
            unit_price: service?.base_price || 0,
            maxStock: maxStock ?? undefined,
            source: service ? 'catalog' : 'manual',
        }]);
    };

    const addInventoryItem = (product: InventoryProduct) => {
        // Check if already added
        if (items.some(i => i.product_id === product.id)) {
            alert(`El producto "${product.name}" ya está en la cotización.`);
            return;
        }
        if (product.current_stock <= 0) {
            if (!confirm(`⚠️ "${product.name}" está SIN STOCK (0 ${UNIT_LABELS[product.unit]}). ¿Agregar de todas formas?`)) return;
        }
        setItems([...items, {
            tempId: crypto.randomUUID(),
            service_id: null,
            product_id: product.id,
            description: product.name,
            quantity: 1,
            unit: product.unit,
            unit_price: product.unit_cost,
            maxStock: product.current_stock,
            source: 'inventory',
        }]);
        setShowInvPicker(false);
        setInvSearch('');
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
        if (!clientId) return alert('Por favor, selecciona un cliente de la lista.');
        setSaving(true);

        const payload = {
            client_id: clientId || null,
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
            client_address: clientAddress || null,
            property_name: propertyName || null,
            payment_terms: paymentTerms || '70% AL CONTRATAR 30% AL FINALIZAR',
            delivery_days: deliveryDays || '10 DIAS HABILES',
            exchange_rate: parseFloat(exchangeRate) || 20,
            intro_text: introText || null,
        };

        let quoteId: string;

        if (isEditMode && editId) {
            // ── UPDATE existing quote ──
            const { error } = await supabase.from('quotes').update(payload).eq('id', editId);
            if (error) { alert('Error al guardar: ' + error.message); setSaving(false); return; }
            quoteId = editId;

            // Replace items: delete old then insert new
            await supabase.from('quote_items').delete().eq('quote_id', editId);
        } else {
            // ── INSERT new quote ──
            const year = new Date().getFullYear();
            const { count } = await supabase.from('quotes').select('*', { count: 'exact', head: true });
            const quoteNumber = `COT-${year}-${String((count || 0) + 1).padStart(4, '0')}`;

            const { data: quote, error } = await supabase.from('quotes').insert({
                ...payload,
                quote_number: quoteNumber,
                status: 'draft',
            }).select().single();

            if (error || !quote) { alert('Error al guardar: ' + (error?.message || 'unknown')); setSaving(false); return; }
            quoteId = quote.id;
        }

        // Save items
        if (items.length > 0) {
            await supabase.from('quote_items').insert(
                items.map((item, idx) => ({
                    quote_id: quoteId,
                    service_id: item.service_id || null,
                    product_id: item.product_id || null,
                    description: item.description,
                    quantity: item.quantity,
                    unit: item.unit,
                    unit_price: item.unit_price,
                    subtotal: item.quantity * item.unit_price,
                    sort_order: idx,
                }))
            );
        }

        // → Pipeline Sync (only for new quotes being sent)
        if (!isEditMode && status === 'sent' && clientId) {
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
                await supabase.from('quotes').update({ opportunity_id: existingOpp.id }).eq('id', quoteId);
            } else {
                const { data: newOpp } = await supabase.from('sales_opportunities').insert({
                    client_id: clientId,
                    title: title,
                    estimated_value: totals.total,
                    probability: 40,
                    stage: 'quoting',
                }).select().single();
                if (newOpp) {
                    await supabase.from('quotes').update({ opportunity_id: newOpp.id }).eq('id', quoteId);
                }
            }
        }

        setSaving(false);
        navigate(`/quotes/${quoteId}${status === 'sent' ? '?send=1' : ''}`);
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
                        {isEditMode ? `Editar ${editQuoteNumber}` : 'Nueva Cotización'}
                    </h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleSave('draft')} disabled={saving}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-50">
                        <span className="material-symbols-outlined text-[18px]">save</span>
                        {isEditMode ? 'Guardar Cambios' : 'Guardar Borrador'}
                    </button>
                    {!isEditMode && (
                        <button onClick={() => handleSave('sent')} disabled={saving}
                            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 disabled:opacity-50">
                            <span className="material-symbols-outlined text-[18px]">send</span>
                            Guardar y Enviar
                        </button>
                    )}
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
                            <div>
                                <label className={labelClass}>Domicilio del Cliente</label>
                                <input value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Ej: Conocido, El Veladero, Mun. Sayula Jalisco" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Nombre del Predio</label>
                                <input value={propertyName} onChange={e => setPropertyName(e.target.value)} placeholder="Ej: POZO EL PELILLO" className={inputClass} />
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelClass}>Texto Introductorio</label>
                                <textarea value={introText} onChange={e => setIntroText(e.target.value)} rows={2} placeholder="Atendiendo a su amable solicitud..." className={inputClass + ' resize-none'} />
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelClass}>Descripción (Notas internas)</label>
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

                    {/* Condiciones Comerciales */}
                    <div className={sectionClass}>
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                            <span className="material-symbols-outlined text-primary text-[20px]">handshake</span>
                            Condiciones Comerciales (Aparece en PDF al cliente)
                        </h3>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div>
                                <label className={labelClass}>Forma de Pago</label>
                                <input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="70% AL CONTRATAR 30% AL FINALIZAR" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Tiempo de Entrega</label>
                                <input value={deliveryDays} onChange={e => setDeliveryDays(e.target.value)} placeholder="10 DIAS HABILES" className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Tipo de Cambio (T.C.)</label>
                                <input type="number" step="0.01" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} placeholder="20.00" className={inputClass} />
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
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-primary text-[20px]">list_alt</span>
                                Conceptos / Servicios / Productos
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                <select onChange={e => { const svc = services.find(s => s.id === e.target.value); if (svc) addItem(svc); e.target.value = ''; }}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                                    <option value="">+ Del catálogo</option>
                                    {services.map(s => <option key={s.id} value={s.id}>{s.name} — {formatCurrency(s.base_price)}</option>)}
                                </select>
                                <button onClick={() => setShowInvPicker(true)}
                                    className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 transition-colors">
                                    <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                                    Del Inventario
                                </button>
                                <button onClick={() => addItem()}
                                    className="flex items-center gap-1 rounded-lg border border-dashed border-primary px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5">
                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                    Línea Manual
                                </button>
                            </div>
                        </div>

                        {/* Inventory Picker Modal */}
                        {showInvPicker && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { setShowInvPicker(false); setInvSearch(''); }}>
                                <div className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
                                    {/* Modal Header */}
                                    <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
                                                <span className="material-symbols-outlined text-white text-[22px]">inventory_2</span>
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-slate-900 dark:text-white">Agregar Producto del Inventario</h3>
                                                <p className="text-xs text-slate-500">{invProducts.length} productos disponibles</p>
                                            </div>
                                        </div>
                                        <button onClick={() => { setShowInvPicker(false); setInvSearch(''); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                                            <span className="material-symbols-outlined text-[20px]">close</span>
                                        </button>
                                    </div>
                                    {/* Search */}
                                    <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                                            <input type="text" placeholder="Buscar por código o nombre..." value={invSearch} onChange={e => setInvSearch(e.target.value)} autoFocus
                                                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                                        </div>
                                    </div>
                                    {/* Products List */}
                                    <div className="flex-1 overflow-y-auto p-3">
                                        {invProducts
                                            .filter(p => {
                                                if (!invSearch.trim()) return true;
                                                const q = invSearch.toLowerCase();
                                                return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || (p.supplier || '').toLowerCase().includes(q);
                                            })
                                            .map(p => {
                                                const status = getStockStatus(p);
                                                const conf = STOCK_STATUS_CONFIG[status];
                                                const alreadyAdded = items.some(i => i.product_id === p.id);
                                                return (
                                                    <button key={p.id} onClick={() => !alreadyAdded && addInventoryItem(p)} disabled={alreadyAdded}
                                                        className={`flex w-full items-center gap-3 rounded-xl p-3 mb-1 text-left transition-all ${alreadyAdded ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-800/30' : 'hover:bg-emerald-50/60 dark:hover:bg-emerald-900/10'}`}>
                                                        <span className="text-lg" title={conf.label}>{conf.icon}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">{p.code}</span>
                                                                <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{p.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                                                                <span>{CATEGORY_LABELS[p.category]}</span>
                                                                <span>•</span>
                                                                <span className={conf.color}>{p.current_stock} {UNIT_LABELS[p.unit]}</span>
                                                                <span>•</span>
                                                                <span>{formatCurrencyInv(p.unit_cost)}/u</span>
                                                            </div>
                                                        </div>
                                                        {alreadyAdded ? (
                                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400 dark:bg-slate-700">AGREGADO</span>
                                                        ) : (
                                                            <span className="material-symbols-outlined text-emerald-500 text-[20px]">add_circle</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        {invProducts.filter(p => {
                                            if (!invSearch.trim()) return true;
                                            const q = invSearch.toLowerCase();
                                            return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
                                        }).length === 0 && (
                                            <div className="py-8 text-center text-sm text-slate-400">
                                                <span className="material-symbols-outlined text-[40px] text-slate-300 block mb-2">search_off</span>
                                                No se encontraron productos con "{invSearch}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {items.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 py-8 text-center dark:border-slate-700 dark:bg-slate-800/30">
                                <span className="material-symbols-outlined text-[40px] text-slate-300">playlist_add</span>
                                <p className="mt-2 text-sm text-slate-500">Agrega conceptos del catálogo, productos del inventario o líneas manuales.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {items.map((item, idx) => (
                                    <div key={item.tempId} className={`rounded-lg border p-3 ${item.source === 'inventory' ? 'border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-800/40 dark:bg-emerald-900/10' : 'border-slate-200/60 bg-white dark:border-slate-700/60 dark:bg-slate-800/50'}`}>
                                        {/* Row 1: Number + Description + Delete */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className="text-xs font-bold text-slate-400 w-5 text-center">{idx + 1}</span>
                                                {item.source === 'inventory' && <span className="material-symbols-outlined text-emerald-500 text-[14px]" title="Del Inventario">inventory_2</span>}
                                                {item.source === 'catalog' && <span className="material-symbols-outlined text-sky-500 text-[14px]" title="Del Catálogo">menu_book</span>}
                                            </div>
                                            <input value={item.description} onChange={e => updateItem(item.tempId, 'description', e.target.value)}
                                                placeholder="Descripción del concepto" className="flex-1 min-w-0 rounded border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                                            <button onClick={() => removeItem(item.tempId)} className="shrink-0 rounded p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Eliminar">
                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                            </button>
                                        </div>
                                        {/* Row 2: Quantity + Unit + Price + Subtotal */}
                                        <div className="flex items-center gap-2 pl-7">
                                            <div className="flex flex-col w-20 shrink-0">
                                                <input type="number" value={item.quantity} onChange={e => updateItem(item.tempId, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className={`w-full rounded border px-2 py-1.5 text-sm text-center dark:bg-slate-800 dark:text-white ${item.maxStock !== null && item.maxStock !== undefined && item.quantity > item.maxStock ? 'border-red-500 text-red-600' : 'border-slate-200 dark:border-slate-700'}`} placeholder="Cant" />
                                                {item.maxStock !== null && item.maxStock !== undefined && (
                                                    <span className={`text-[10px] mt-0.5 text-center ${item.quantity > item.maxStock ? 'text-red-500 font-bold' : 'text-emerald-600'}`}>Stock: {item.maxStock}</span>
                                                )}
                                            </div>
                                            <select value={item.unit} onChange={e => updateItem(item.tempId, 'unit', e.target.value)}
                                                className="w-24 shrink-0 rounded border border-slate-200 px-1 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                                                <option value="servicio">Servicio</option>
                                                <option value="pieza">Pieza</option>
                                                <option value="metro">Metro</option>
                                                <option value="litro">Litro</option>
                                                <option value="kg">Kilogramo</option>
                                                <option value="rollo">Rollo</option>
                                                <option value="tramo">Tramo</option>
                                                <option value="caja">Caja</option>
                                                <option value="hora">Hora</option>
                                                <option value="km">Km</option>
                                                <option value="dia">Día</option>
                                                <option value="lote">Lote</option>
                                                <option value="juego">Juego</option>
                                            </select>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className="text-[10px] text-slate-400">$</span>
                                                <input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(item.tempId, 'unit_price', parseFloat(e.target.value) || 0)}
                                                    className="w-28 rounded border border-slate-200 px-2 py-1.5 text-sm text-right dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="P. Unit." />
                                            </div>
                                            <div className="flex-1 text-right">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(item.quantity * item.unit_price)}</span>
                                            </div>
                                        </div>
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
