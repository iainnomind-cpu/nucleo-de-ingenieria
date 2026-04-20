import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import {
    Client,
    ClientAsset,
    ClientActivity,
    SalesOpportunity,
    STATUS_LABELS,
    STATUS_COLORS,
    ASSET_TYPE_LABELS,
    ASSET_TYPE_ICONS,
    ACTIVITY_TYPE_LABELS,
    ACTIVITY_TYPE_ICONS,
    STAGE_LABELS,
    STAGE_COLORS,
    AssetType,
    AssetStatus,
    ActivityType,
    PipelineStage,
} from '../../../types/crm';

type Tab = 'info' | 'assets' | 'history' | 'opportunities' | 'finance' | 'equipment';

// Finance helpers
interface ClientInvoice { id: string; invoice_number: string; total: number; amount_paid: number; balance: number; status: string; due_date: string; issue_date: string; }
interface ClientPayment { id: string; amount: number; payment_date: string; payment_method: string; invoice_id: string; }

const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(v);
const statusColor: Record<string, string> = { draft: 'bg-slate-100 text-slate-600', sent: 'bg-sky-100 text-sky-700', partial: 'bg-amber-100 text-amber-700', paid: 'bg-emerald-100 text-emerald-700', overdue: 'bg-red-100 text-red-700', cancelled: 'bg-slate-100 text-slate-400' };
const statusLabel: Record<string, string> = { draft: 'Borrador', sent: 'Enviada', partial: 'Parcial', paid: 'Pagada', overdue: 'Vencida', cancelled: 'Cancelada' };

export default function ClientDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [client, setClient] = useState<Client | null>(null);
    const [assets, setAssets] = useState<ClientAsset[]>([]);
    const [activities, setActivities] = useState<ClientActivity[]>([]);
    const [opportunities, setOpportunities] = useState<SalesOpportunity[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>('info');
    const [loading, setLoading] = useState(true);

    // M6: Finance data
    const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
    const [payments, setPayments] = useState<ClientPayment[]>([]);

    // M5: Maintenance equipment & schedules
    const [clientEquipment, setClientEquipment] = useState<{ id: string; name: string; equipment_type: string; well_name: string | null; brand: string | null; model: string | null; status: string; installation_date: string | null }[]>([]);
    const [clientSchedules, setClientSchedules] = useState<{ id: string; title: string; service_type: string; next_service_date: string; status: string; assigned_to: string | null; equipment?: { name: string; well_name: string | null } }[]>([]);

    // Asset form state
    const [showAssetForm, setShowAssetForm] = useState(false);
    const [assetForm, setAssetForm] = useState({
        asset_type: 'well' as AssetType,
        name: '',
        brand: '',
        model: '',
        horsepower: '',
        depth: '',
        installation_date: '',
        status: 'active' as AssetStatus,
    });

    // Activity form state
    const [showActivityForm, setShowActivityForm] = useState(false);
    const [activityForm, setActivityForm] = useState({
        activity_type: 'call' as ActivityType,
        title: '',
        description: '',
    });

    const fetchClient = useCallback(async () => {
        if (!id) return;
        const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
        if (error) { navigate('/crm'); } else { setClient(data); }
    }, [id, navigate]);

    const fetchAssets = useCallback(async () => {
        if (!id) return;
        const { data } = await supabase.from('client_assets').select('*').eq('client_id', id).order('created_at', { ascending: false });
        setAssets(data || []);
    }, [id]);

    const fetchActivities = useCallback(async () => {
        if (!id) return;
        const { data } = await supabase.from('client_activities').select('*').eq('client_id', id).order('activity_date', { ascending: false });
        setActivities(data || []);
    }, [id]);

    const fetchOpportunities = useCallback(async () => {
        if (!id) return;
        const { data } = await supabase.from('sales_opportunities').select('*').eq('client_id', id).order('created_at', { ascending: false });
        setOpportunities(data || []);
    }, [id]);

    // M6: Fetch invoices & payments for this client
    const fetchFinance = useCallback(async () => {
        if (!id) return;
        const [invR, payR] = await Promise.all([
            supabase.from('invoices').select('id, invoice_number, total, amount_paid, balance, status, due_date, issue_date').eq('client_id', id).order('issue_date', { ascending: false }),
            supabase.from('payments').select('id, amount, payment_date, payment_method, invoice_id').in('invoice_id', (await supabase.from('invoices').select('id').eq('client_id', id)).data?.map((i: { id: string }) => i.id) || []).order('payment_date', { ascending: false }),
        ]);
        setInvoices((invR.data as ClientInvoice[]) || []);
        setPayments((payR.data as ClientPayment[]) || []);
    }, [id]);

    // M5: Fetch installed equipment & schedules for this client
    const fetchMaintenance = useCallback(async () => {
        if (!id) return;
        const [eqR, schR] = await Promise.all([
            supabase.from('installed_equipment').select('id, name, equipment_type, well_name, brand, model, status, installation_date').eq('client_id', id).order('name'),
            supabase.from('maintenance_schedules').select('id, title, service_type, next_service_date, status, assigned_to, equipment:installed_equipment(name, well_name)').eq('client_id', id).order('next_service_date'),
        ]);
        setClientEquipment(eqR.data || []);
        setClientSchedules((schR.data as unknown as typeof clientSchedules) || []);
    }, [id]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchClient(), fetchAssets(), fetchActivities(), fetchOpportunities(), fetchFinance(), fetchMaintenance()]);
            setLoading(false);
        };
        load();
    }, [fetchClient, fetchAssets, fetchActivities, fetchOpportunities, fetchFinance, fetchMaintenance]);

    // M5: When adding asset, also register in installed_equipment + create maintenance schedule
    const handleAddAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const { error } = await supabase.from('client_assets').insert({
            client_id: id,
            asset_type: assetForm.asset_type,
            name: assetForm.name,
            brand: assetForm.brand || null,
            model: assetForm.model || null,
            horsepower: assetForm.horsepower ? parseFloat(assetForm.horsepower) : null,
            depth: assetForm.depth ? parseFloat(assetForm.depth) : null,
            installation_date: assetForm.installation_date || null,
            status: assetForm.status,
        }).select().single();
        if (error) {
            alert('Error al agregar activo: ' + error.message);
        } else {
            // → M5: Register installed equipment automatically
            const eqType = assetForm.asset_type === 'well' ? 'pozo' :
                assetForm.asset_type === 'motor' ? 'motor' :
                    assetForm.asset_type === 'pump' ? 'bomba' : 'variador';
            const { data: eqData } = await supabase.from('installed_equipment').insert({
                client_id: id,
                name: assetForm.name,
                equipment_type: eqType,
                brand: assetForm.brand || null,
                model: assetForm.model || null,
                serial_number: null,
                installation_date: assetForm.installation_date || new Date().toISOString().split('T')[0],
                status: 'active',
                location: assetForm.name,
            }).select().single();

            // → M5: Auto-create first maintenance schedule (revision general in 90 days)
            if (eqData) {
                const nextDate = new Date();
                nextDate.setDate(nextDate.getDate() + 90);
                const eqLabel = ASSET_TYPE_LABELS[assetForm.asset_type] || eqType;
                await supabase.from('maintenance_schedules').insert({
                    equipment_id: eqData.id,
                    client_id: id,
                    title: `Revisión General — ${eqLabel} (${client?.company_name || 'Cliente'})`,
                    description: `Mantenimiento preventivo programado al registrar activo: ${assetForm.name}`,
                    service_type: 'revision_general',
                    frequency_months: 3,
                    last_service_date: new Date().toISOString().split('T')[0],
                    next_service_date: nextDate.toISOString().split('T')[0],
                    assigned_to: 'Joel',
                    status: 'scheduled',
                });
            }

            // Log activity
            await supabase.from('client_activities').insert({
                client_id: id,
                activity_type: 'monitoring',
                title: 'Equipo registrado: ' + assetForm.name,
                description: 'Se registro ' + assetForm.name + ' (' + ASSET_TYPE_LABELS[assetForm.asset_type] + ') y se activo agenda de mantenimiento automatica.',
            });

            setShowAssetForm(false);
            setAssetForm({ asset_type: 'well', name: '', brand: '', model: '', horsepower: '', depth: '', installation_date: '', status: 'active' });
            fetchAssets();
            fetchActivities();
            // Navigate to equipment detail if user wants
            if (eqData && confirm('Equipo registrado y mantenimiento activado. ¿Ir a detalle del equipo?')) {
                navigate('/maintenance/equipment/' + eqData.id);
            }
        }
    };

    const handleAddActivity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const { error } = await supabase.from('client_activities').insert({
            client_id: id,
            activity_type: activityForm.activity_type,
            title: activityForm.title,
            description: activityForm.description || null,
        });
        if (error) {
            alert('Error al agregar actividad: ' + error.message);
        } else {
            setShowActivityForm(false);
            setActivityForm({ activity_type: 'call', title: '', description: '' });
            fetchActivities();
        }
    };

    const handleDeleteAsset = async (assetId: string) => {
        if (!confirm('¿Eliminar este activo?')) return;
        await supabase.from('client_assets').delete().eq('id', assetId);
        fetchAssets();
    };

    // M8: When opportunity moves to 'won', auto-create contextual Space
    const handleStageChange = async (oppId: string, newStage: PipelineStage) => {
        await supabase.from('sales_opportunities').update({ stage: newStage }).eq('id', oppId);

        if (newStage === 'closed_won' && client) {
            // Auto-create Space contextual for this client
            const spaceName = 'Cliente: ' + client.company_name;
            const { data: existing } = await supabase.from('spaces').select('id').eq('name', spaceName).single();
            if (!existing) {
                await supabase.from('spaces').insert({
                    name: spaceName,
                    description: 'Espacio contextual para ' + client.company_name + ' - creado automaticamente al cerrar venta',
                    space_type: 'project',
                    icon: 'handshake',
                    created_by: 'Sistema',
                });
                // Log activity
                await supabase.from('client_activities').insert({
                    client_id: id,
                    activity_type: 'project',
                    title: 'Venta cerrada - Space creado',
                    description: 'Se creo automaticamente el espacio de comunicacion para este cliente en M8.',
                });
            }
            alert('Venta ganada - Se creo un Space de equipo para "' + client.company_name + '"');
        }
        fetchOpportunities();
        fetchActivities();
    };

    // M2: Navigate to quote builder pre-filled with client
    const handleCreateQuote = () => {
        navigate('/quotes/new?client_id=' + id + '&client_name=' + encodeURIComponent(client?.company_name || ''));
    };

    if (loading || !client) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <span className="text-sm text-slate-500">Cargando cliente...</span>
                </div>
            </div>
        );
    }

    // M6: Finance KPIs
    const totalBilled = invoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.total, 0);
    const totalPaid = invoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.amount_paid, 0);
    const totalPending = invoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.balance, 0);
    const today = new Date().toISOString().split('T')[0];
    const overdueCount = invoices.filter(i => i.balance > 0 && i.due_date < today && i.status !== 'cancelled').length;

    // M6→M1: Payment Behavior Score
    const activeInvoices = invoices.filter(i => i.status !== 'cancelled' && i.status !== 'draft');
    const paidInvoices = activeInvoices.filter(i => i.status === 'paid');
    const overdueInvoices = activeInvoices.filter(i => i.balance > 0 && i.due_date < today);
    const paymentScore = (() => {
        if (activeInvoices.length === 0) return { score: 100, label: 'Sin Historial', color: 'text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700' };
        const paidRatio = paidInvoices.length / activeInvoices.length;
        const overdueRatio = overdueInvoices.length / activeInvoices.length;
        const score = Math.round((paidRatio * 70) + ((1 - overdueRatio) * 30));
        if (score >= 80) return { score, label: 'Excelente', color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' };
        if (score >= 60) return { score, label: 'Bueno', color: 'text-sky-600', bg: 'bg-sky-100 dark:bg-sky-900/30' };
        if (score >= 40) return { score, label: 'Regular', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' };
        return { score, label: 'Riesgo', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' };
    })();

    const tabs: { key: Tab; label: string; icon: string; count?: number }[] = [
        { key: 'info', label: 'Informacion', icon: 'info' },
        { key: 'assets', label: 'Activos', icon: 'precision_manufacturing', count: assets.length },
        { key: 'equipment', label: 'Equipos (M5)', icon: 'engineering', count: clientEquipment.length },
        { key: 'history', label: 'Historial', icon: 'history', count: activities.length },
        { key: 'opportunities', label: 'Oportunidades', icon: 'trending_up', count: opportunities.length },
        { key: 'finance', label: 'Finanzas', icon: 'account_balance', count: invoices.length },
    ];

    const inputClass =
        'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Back button & header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/crm')}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    Volver
                </button>
            </div>

            {/* Client header card */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
                <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-2xl font-bold text-white shadow-lg shadow-primary/20">
                            {client.company_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {client.company_name}
                            </h2>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                                {client.contact_name && (
                                    <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[16px]">person</span>
                                        {client.contact_name}
                                    </span>
                                )}
                                {client.industry && (
                                    <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[16px]">factory</span>
                                        {client.industry}
                                    </span>
                                )}
                                <span
                                    className={'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ' + STATUS_COLORS[client.status].bg + ' ' + STATUS_COLORS[client.status].text}
                                >
                                    {STATUS_LABELS[client.status]}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* M2: Quick action - Generate Quote */}
                        <button onClick={handleCreateQuote}
                            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition-all hover:shadow-lg">
                            <span className="material-symbols-outlined text-[18px]">request_quote</span>
                            Cotizar
                        </button>
                        <div className="flex items-center gap-6">
                            <div className="text-center">
                                <p className="text-xs font-semibold uppercase text-slate-400">Score</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {client.payment_score ? client.payment_score.toFixed(1) : '\u2014'}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-semibold uppercase text-slate-400">Credito</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{client.credit_days}d</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-semibold uppercase text-slate-400">Activos</p>
                                <p className="text-2xl font-bold text-primary">{assets.length}</p>
                            </div>
                            {totalPending > 0 && (
                                <div className="text-center">
                                    <p className="text-xs font-semibold uppercase text-slate-400">Por Cobrar</p>
                                    <p className={'text-xl font-bold ' + (overdueCount > 0 ? 'text-red-500' : 'text-amber-500')}>{fmt(totalPending)}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200/60 bg-white/50 p-1.5 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ' + (activeTab === tab.key
                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                        )}
                    >
                        <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span
                                className={'ml-1 rounded-full px-2 py-0.5 text-xs font-bold ' + (activeTab === tab.key
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                )}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="rounded-xl border border-slate-200/60 bg-white/50 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                {/* INFO TAB */}
                {activeTab === 'info' && (
                    <div className="p-6">
                        <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Datos Generales</h3>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {[
                                { label: 'Empresa', value: client.company_name, icon: 'business' },
                                { label: 'Contacto', value: client.contact_name, icon: 'person' },
                                { label: 'Email', value: client.email, icon: 'mail' },
                                { label: 'Telefono', value: client.phone, icon: 'phone' },
                                { label: 'RFC', value: client.rfc, icon: 'badge' },
                                { label: 'Industria', value: client.industry, icon: 'factory' },
                                { label: 'Direccion', value: client.address, icon: 'location_on' },
                                { label: 'Potencial de Crecimiento', value: client.growth_potential === 'high' ? 'Alto' : client.growth_potential === 'medium' ? 'Medio' : client.growth_potential === 'low' ? 'Bajo' : null, icon: 'trending_up' },
                                { label: 'Dias de Credito', value: client.credit_days?.toString(), icon: 'schedule' },
                            ].map((field) => (
                                <div key={field.label} className="flex items-start gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                                        <span className="material-symbols-outlined text-[18px] text-slate-500">{field.icon}</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-slate-400">{field.label}</p>
                                        <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">
                                            {field.value || '\u2014'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ASSETS TAB */}
                {activeTab === 'assets' && (
                    <div className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                Inventario de Activos
                            </h3>
                            <button
                                onClick={() => setShowAssetForm(!showAssetForm)}
                                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20"
                            >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                Agregar Activo
                            </button>
                        </div>

                        {/* M5 integration notice */}
                        <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50/50 p-3 text-xs text-sky-700 dark:border-sky-900 dark:bg-sky-900/10 dark:text-sky-400">
                            <span className="material-symbols-outlined text-[14px] mr-1 align-middle">info</span>
                            Al agregar un activo, se registra automaticamente en el modulo de Mantenimiento (M5) y se activa la agenda de revision general cada 90 dias.
                        </div>

                        {showAssetForm && (
                            <form onSubmit={handleAddAsset} className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-5">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <div>
                                        <label className={labelClass}>Tipo *</label>
                                        <select value={assetForm.asset_type} onChange={(e) => setAssetForm({ ...assetForm, asset_type: e.target.value as AssetType })} className={inputClass}>
                                            <option value="well">Pozo</option>
                                            <option value="motor">Motor</option>
                                            <option value="pump">Bomba</option>
                                            <option value="variator">Variador</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Nombre *</label>
                                        <input value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} required placeholder="Ej: Pozo #1" className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Marca</label>
                                        <input value={assetForm.brand} onChange={(e) => setAssetForm({ ...assetForm, brand: e.target.value })} placeholder="Ej: Franklin" className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Modelo</label>
                                        <input value={assetForm.model} onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })} placeholder="Ej: 10FA" className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>HP</label>
                                        <input type="number" step="0.1" value={assetForm.horsepower} onChange={(e) => setAssetForm({ ...assetForm, horsepower: e.target.value })} placeholder="Ej: 50" className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Profundidad (m)</label>
                                        <input type="number" step="0.1" value={assetForm.depth} onChange={(e) => setAssetForm({ ...assetForm, depth: e.target.value })} placeholder="Ej: 120" className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Fecha Instalacion</label>
                                        <input type="date" value={assetForm.installation_date} onChange={(e) => setAssetForm({ ...assetForm, installation_date: e.target.value })} className={inputClass} />
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
                                        Guardar Activo + Activar Mantenimiento
                                    </button>
                                    <button type="button" onClick={() => setShowAssetForm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-400">
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        )}

                        {assets.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-12 text-center">
                                <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600">precision_manufacturing</span>
                                <p className="text-sm text-slate-500">No hay activos registrados aun.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {assets.map((asset) => (
                                    <div key={asset.id} className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800/60 dark:bg-slate-800/50">
                                        <button onClick={() => handleDeleteAsset(asset.id)} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20">
                                            <span className="material-symbols-outlined text-[18px]">close</span>
                                        </button>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                                                <span className="material-symbols-outlined text-primary text-[22px]">{ASSET_TYPE_ICONS[asset.asset_type]}</span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900 dark:text-white">{asset.name}</p>
                                                <p className="text-xs text-slate-400">{ASSET_TYPE_LABELS[asset.asset_type]}</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                            {asset.brand && <div><span className="text-slate-400">Marca:</span>{' '}<span className="font-medium text-slate-700 dark:text-slate-300">{asset.brand}</span></div>}
                                            {asset.model && <div><span className="text-slate-400">Modelo:</span>{' '}<span className="font-medium text-slate-700 dark:text-slate-300">{asset.model}</span></div>}
                                            {asset.horsepower && <div><span className="text-slate-400">HP:</span>{' '}<span className="font-medium text-slate-700 dark:text-slate-300">{asset.horsepower}</span></div>}
                                            {asset.depth && <div><span className="text-slate-400">Prof.:</span>{' '}<span className="font-medium text-slate-700 dark:text-slate-300">{asset.depth}m</span></div>}
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className={'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ' + (asset.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : asset.status === 'maintenance' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400')}>
                                                {asset.status === 'active' ? 'Activo' : asset.status === 'maintenance' ? 'Mantenimiento' : 'Inactivo'}
                                            </span>
                                            {asset.installation_date && (
                                                <span className="text-xs text-slate-400">Inst: {new Date(asset.installation_date).toLocaleDateString('es-MX')}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* HISTORY TAB */}
                {activeTab === 'history' && (
                    <div className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Historial de Actividades</h3>
                            <button onClick={() => setShowActivityForm(!showActivityForm)} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20">
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                Nueva Actividad
                            </button>
                        </div>

                        {showActivityForm && (
                            <form onSubmit={handleAddActivity} className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-5">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <div>
                                        <label className={labelClass}>Tipo *</label>
                                        <select value={activityForm.activity_type} onChange={(e) => setActivityForm({ ...activityForm, activity_type: e.target.value as ActivityType })} className={inputClass}>
                                            <option value="call">Llamada</option>
                                            <option value="email">Correo</option>
                                            <option value="meeting">Reunion</option>
                                            <option value="monitoring">Monitoreo</option>
                                            <option value="quote">Cotizacion</option>
                                            <option value="project">Proyecto</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={labelClass}>Titulo *</label>
                                        <input value={activityForm.title} onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })} required placeholder="Ej: Llamada de seguimiento" className={inputClass} />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className={labelClass}>Descripcion</label>
                                        <textarea value={activityForm.description} onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })} rows={2} placeholder="Notas..." className={inputClass + ' resize-none'} />
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Guardar Actividad</button>
                                    <button type="button" onClick={() => setShowActivityForm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-400">Cancelar</button>
                                </div>
                            </form>
                        )}

                        {activities.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-12 text-center">
                                <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600">history</span>
                                <p className="text-sm text-slate-500">No hay actividades registradas aun.</p>
                            </div>
                        ) : (
                            <div className="relative ml-4 border-l-2 border-slate-200 pl-6 dark:border-slate-700">
                                {activities.map((act, i) => (
                                    <div key={act.id} className={'relative pb-6 ' + (i === activities.length - 1 ? 'pb-0' : '')}>
                                        <div className="absolute -left-[34px] flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary/10 dark:border-slate-900">
                                            <span className="material-symbols-outlined text-[16px] text-primary">{ACTIVITY_TYPE_ICONS[act.activity_type]}</span>
                                        </div>
                                        <div className="rounded-lg border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-800/60 dark:bg-slate-800/50">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{ACTIVITY_TYPE_LABELS[act.activity_type]}</span>
                                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{act.title}</h4>
                                                </div>
                                                <span className="text-xs text-slate-400">{new Date(act.activity_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            {act.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{act.description}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* OPPORTUNITIES TAB - with M8 integration */}
                {activeTab === 'opportunities' && (
                    <div className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Oportunidades de Venta</h3>
                        </div>

                        {/* M8 integration notice */}
                        <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/50 p-3 text-xs text-violet-700 dark:border-violet-900 dark:bg-violet-900/10 dark:text-violet-400">
                            <span className="material-symbols-outlined text-[14px] mr-1 align-middle">forum</span>
                            Al marcar una oportunidad como "Ganada", se crea automaticamente un Space de comunicacion para este cliente (M8).
                        </div>

                        {opportunities.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-12 text-center">
                                <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600">trending_up</span>
                                <p className="text-sm text-slate-500">No hay oportunidades registradas. Crealas desde el Pipeline.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {opportunities.map((opp) => (
                                    <div key={opp.id} className={'rounded-xl border p-4 ' + STAGE_COLORS[opp.stage].border + ' ' + STAGE_COLORS[opp.stage].bg}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-semibold text-slate-900 dark:text-white">{opp.title}</h4>
                                                {opp.description && <p className="mt-1 text-sm text-slate-500">{opp.description}</p>}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-slate-900 dark:text-white">
                                                    {opp.estimated_value ? fmt(opp.estimated_value) : '\u2014'}
                                                </p>
                                                <span className={'text-xs font-semibold ' + STAGE_COLORS[opp.stage].text}>{STAGE_LABELS[opp.stage]}</span>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <div className="flex items-center gap-4 text-xs text-slate-400">
                                                <span>Probabilidad: {opp.probability}%</span>
                                                {opp.closing_date && <span>Cierre: {new Date(opp.closing_date).toLocaleDateString('es-MX')}</span>}
                                            </div>
                                            {/* M8: Stage change buttons */}
                                            {opp.stage !== 'closed_won' && opp.stage !== 'closed_lost' && (
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleStageChange(opp.id, 'closed_won')} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1 text-[10px] font-semibold text-white hover:bg-emerald-600">
                                                        <span className="material-symbols-outlined text-[12px]">check_circle</span>Ganada
                                                    </button>
                                                    <button onClick={() => handleStageChange(opp.id, 'closed_lost')} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-[10px] font-medium text-slate-500 hover:bg-red-50 hover:text-red-500 dark:border-slate-700">
                                                        <span className="material-symbols-outlined text-[12px]">cancel</span>Perdida
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* FINANCE TAB - M6 Integration */}
                {activeTab === 'finance' && (
                    <div className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Estado de Cuenta</h3>
                            <button onClick={() => navigate('/finance/invoices')} className="text-xs text-primary font-semibold">Ir a Finanzas &rarr;</button>
                        </div>

                        {/* KPIs */}
                        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
                            <div className="rounded-lg border border-slate-200/60 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/50">
                                <p className="text-xs text-slate-400">Total Facturado</p>
                                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{fmt(totalBilled)}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200/60 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/50">
                                <p className="text-xs text-slate-400">Total Cobrado</p>
                                <p className="mt-1 text-xl font-bold text-emerald-500">{fmt(totalPaid)}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200/60 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/50">
                                <p className="text-xs text-slate-400">Por Cobrar</p>
                                <p className={'mt-1 text-xl font-bold ' + (totalPending > 0 ? 'text-amber-500' : 'text-slate-900 dark:text-white')}>{fmt(totalPending)}</p>
                            </div>
                            <div className="rounded-lg border border-slate-200/60 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-slate-900/50">
                                <p className="text-xs text-slate-400">Facturas Vencidas</p>
                                <p className={'mt-1 text-xl font-bold ' + (overdueCount > 0 ? 'text-red-500' : 'text-emerald-500')}>{overdueCount}</p>
                            </div>
                            <div className={`rounded-lg border border-slate-200/60 p-4 ${paymentScore.bg}`}>
                                <p className="text-xs text-slate-400">Score de Pago (M6→M1)</p>
                                <p className={`mt-1 text-xl font-bold ${paymentScore.color}`}>{paymentScore.score}%</p>
                                <span className={`text-[10px] font-semibold ${paymentScore.color}`}>{paymentScore.label}</span>
                            </div>
                        </div>

                        {/* Invoice list */}
                        <h4 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-300">Facturas</h4>
                        {invoices.length === 0 ? (
                            <p className="py-8 text-center text-sm text-slate-400">Sin facturas para este cliente.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-semibold text-slate-500">Factura</th>
                                            <th className="px-4 py-2 text-center font-semibold text-slate-500">Fecha</th>
                                            <th className="px-4 py-2 text-center font-semibold text-slate-500">Total</th>
                                            <th className="px-4 py-2 text-center font-semibold text-slate-500">Pagado</th>
                                            <th className="px-4 py-2 text-center font-semibold text-slate-500">Saldo</th>
                                            <th className="px-4 py-2 text-center font-semibold text-slate-500">Estado</th>
                                            <th className="px-4 py-2 text-center font-semibold text-slate-500">Vence</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {invoices.map(inv => {
                                            const overdue = inv.balance > 0 && inv.due_date < today && inv.status !== 'cancelled';
                                            return (
                                                <tr key={inv.id} onClick={() => navigate('/finance/invoices/' + inv.id)} className={'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 ' + (overdue ? 'bg-red-50/30 dark:bg-red-900/5' : '')}>
                                                    <td className="px-4 py-3"><span className="font-mono text-xs font-bold text-primary">{inv.invoice_number}</span></td>
                                                    <td className="px-4 py-3 text-center text-xs text-slate-400">{new Date(inv.issue_date).toLocaleDateString('es-MX')}</td>
                                                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-900 dark:text-white">{fmt(inv.total)}</td>
                                                    <td className="px-4 py-3 text-center text-xs text-emerald-500">{fmt(inv.amount_paid)}</td>
                                                    <td className={'px-4 py-3 text-center text-xs font-bold ' + (inv.balance > 0 ? 'text-amber-500' : 'text-slate-400')}>{fmt(inv.balance)}</td>
                                                    <td className="px-4 py-3 text-center"><span className={'rounded-full px-2 py-0.5 text-[10px] font-semibold ' + (statusColor[inv.status] || '')}>{statusLabel[inv.status] || inv.status}</span></td>
                                                    <td className={'px-4 py-3 text-center text-xs ' + (overdue ? 'text-red-500 font-bold' : 'text-slate-400')}>{new Date(inv.due_date).toLocaleDateString('es-MX')}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Recent payments */}
                        {payments.length > 0 && (
                            <div className="mt-6">
                                <h4 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-300">Pagos Recientes</h4>
                                <div className="space-y-2">
                                    {payments.slice(0, 5).map(p => (
                                        <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200/60 p-3 dark:border-slate-700/60">
                                            <div>
                                                <p className="text-sm font-bold text-emerald-500">{fmt(p.amount)}</p>
                                                <p className="text-[10px] text-slate-400">{p.payment_method}</p>
                                            </div>
                                            <span className="text-xs text-slate-400">{new Date(p.payment_date).toLocaleDateString('es-MX')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: Equipment (M5) */}
                {activeTab === 'equipment' && (
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Equipos Instalados</h3>
                        {clientEquipment.length === 0 ? (
                            <p className="py-8 text-center text-sm text-slate-400">No hay equipos registrados para este cliente en M5.</p>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {clientEquipment.map(eq => (
                                    <div key={eq.id} onClick={() => navigate(`/maintenance/equipment/${eq.id}`)} className="group cursor-pointer rounded-xl border border-slate-200/60 bg-white/70 p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30 dark:border-slate-800/60 dark:bg-slate-900/50">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                                    <span className="material-symbols-outlined text-primary text-[20px]">engineering</span>
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm text-slate-900 dark:text-white">{eq.name}</p>
                                                    <p className="text-xs text-slate-400">{eq.equipment_type}{eq.brand ? ` · ${eq.brand}` : ''}{eq.model ? ` ${eq.model}` : ''}</p>
                                                </div>
                                            </div>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${eq.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400'}`}>{eq.status === 'active' ? 'Activo' : eq.status}</span>
                                        </div>
                                        {eq.well_name && <p className="mt-2 text-xs text-slate-500 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">water</span>{eq.well_name}</p>}
                                        {eq.installation_date && <p className="mt-1 text-[10px] text-slate-400">Instalado: {new Date(eq.installation_date).toLocaleDateString('es-MX')}</p>}
                                    </div>
                                ))}
                            </div>
                        )}

                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-6">Agenda de Mantenimiento</h3>
                        {clientSchedules.length === 0 ? (
                            <p className="py-4 text-center text-sm text-slate-400">Sin mantenimientos programados.</p>
                        ) : (
                            <div className="space-y-2">
                                {clientSchedules.map(sch => {
                                    const today = new Date().toISOString().split('T')[0];
                                    const isOverdue = sch.next_service_date < today && sch.status !== 'completed' && sch.status !== 'cancelled';
                                    return (
                                        <div key={sch.id} className={`flex items-center gap-4 rounded-lg border p-4 ${isOverdue ? 'border-red-200 bg-red-50/30 dark:border-red-900/30' : 'border-slate-200/60 dark:border-slate-700/60'}`}>
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                                                <span className="material-symbols-outlined text-violet-600 text-[20px]">build</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm text-slate-900 dark:text-white">{sch.title}</p>
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <span>{sch.service_type}</span>
                                                    {sch.equipment?.well_name && <><span>·</span><span>{sch.equipment.well_name}</span></>}
                                                    {sch.assigned_to && <><span>·</span><span>{sch.assigned_to}</span></>}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className={`text-sm font-bold ${isOverdue ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>{new Date(sch.next_service_date).toLocaleDateString('es-MX')}</p>
                                            </div>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${sch.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : sch.status === 'in_progress' ? 'bg-sky-100 text-sky-700' : isOverdue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{sch.status === 'completed' ? 'Completado' : sch.status === 'in_progress' ? 'En Progreso' : isOverdue ? 'Vencido' : 'Programado'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
