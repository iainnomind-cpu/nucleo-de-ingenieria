import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    WaCampaign, WaNotification, WaSurvey,
    CampaignType,
    CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPE_COLORS,
    NOTIFICATION_TYPE_LABELS,
    WA_MESSAGE_STATUS_LABELS,
    WaMessageStatus,
    formatWaCurrency, getDeliveryRate, getReadRate, getResponseRate, getConversionRate,
} from '../../types/whatsapp';

export default function WhatsAppReports() {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
    const [notifications, setNotifications] = useState<WaNotification[]>([]);
    const [surveys, setSurveys] = useState<WaSurvey[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

    const fetchData = useCallback(async () => {
        setLoading(true);
        // Compute start date based on selected range
        let startDate: string | null = null;
        if (dateRange !== 'all') {
            const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
            const d = new Date();
            d.setDate(d.getDate() - days);
            startDate = d.toISOString();
        }
        // Build queries with optional date filter
        const campaignQuery = supabase.from('wa_campaigns').select('*').order('created_at', { ascending: false });
        const notifQuery = supabase.from('wa_notifications').select('*, client:clients(id, company_name)').order('created_at', { ascending: false });
        const survQuery = supabase.from('wa_surveys').select('*, client:clients(id, company_name)').order('created_at', { ascending: false });
        if (startDate) {
            campaignQuery.gte('created_at', startDate);
            notifQuery.gte('created_at', startDate);
            survQuery.gte('created_at', startDate);
        }
        const [campRes, notifRes, survRes] = await Promise.all([
            campaignQuery,
            notifQuery,
            survQuery,
        ]);
        setCampaigns((campRes.data as WaCampaign[]) || []);
        setNotifications((notifRes.data as WaNotification[]) || []);
        setSurveys((survRes.data as WaSurvey[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Aggregate totals
    const totalSent = campaigns.reduce((s, c) => s + c.total_sent, 0);
    const totalDelivered = campaigns.reduce((s, c) => s + c.total_delivered, 0);
    const totalRead = campaigns.reduce((s, c) => s + c.total_read, 0);
    const totalResponded = campaigns.reduce((s, c) => s + c.total_responded, 0);
    const totalConversions = campaigns.reduce((s, c) => s + c.total_conversions, 0);
    const totalRevenue = campaigns.reduce((s, c) => s + c.revenue_generated, 0);

    // Funnel data
    const funnel = [
        { label: 'Enviados', value: totalSent, color: 'bg-slate-400', pct: 100 },
        { label: 'Entregados', value: totalDelivered, color: 'bg-sky-500', pct: getDeliveryRate(totalSent, totalDelivered) },
        { label: 'Leídos', value: totalRead, color: 'bg-indigo-500', pct: getReadRate(totalDelivered, totalRead) },
        { label: 'Respondidos', value: totalResponded, color: 'bg-violet-500', pct: getResponseRate(totalRead, totalResponded) },
        { label: 'Conversiones', value: totalConversions, color: 'bg-emerald-500', pct: getConversionRate(totalResponded, totalConversions) },
    ];

    // Notification breakdown
    const notifByType = notifications.reduce<Record<string, { total: number; delivered: number; read: number }>>((acc, n) => {
        if (!acc[n.notification_type]) acc[n.notification_type] = { total: 0, delivered: 0, read: 0 };
        acc[n.notification_type].total++;
        if (n.status === 'delivered' || n.status === 'read') acc[n.notification_type].delivered++;
        if (n.status === 'read') acc[n.notification_type].read++;
        return acc;
    }, {});

    // Status distribution of notifications
    const notifByStatus = notifications.reduce<Record<string, number>>((acc, n) => {
        acc[n.status] = (acc[n.status] || 0) + 1;
        return acc;
    }, {});

    const tabs = [
        { label: 'Dashboard', icon: 'space_dashboard', path: '/whatsapp' },
        { label: 'Conversaciones', icon: 'chat', path: '/whatsapp/conversations' },
        { label: 'Envío Directo', icon: 'send', path: '/whatsapp/send' },
        { label: 'Campañas', icon: 'campaign', path: '/whatsapp/campaigns' },
        { label: 'Plantillas', icon: 'description', path: '/whatsapp/templates' },
        { label: 'Reportes', icon: 'analytics', path: '/whatsapp/reports' },
        { label: 'Reglas (Auto)', icon: 'bolt', path: '/whatsapp/rules' },

    ];

    if (loading) return (
        <div className="flex flex-1 items-center justify-center p-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <div className="border-b border-slate-200 bg-white/80 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/80">
                <div className="px-6 pt-6 pb-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                                <span className="material-symbols-outlined text-white text-[22px]">chat</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white">WhatsApp Marketing</h1>
                                <p className="text-xs text-slate-500">Reportes de conversión</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                            {(['7d', '30d', '90d', 'all'] as const).map(r => (
                                <button key={r} onClick={() => setDateRange(r)}
                                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${dateRange === r ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'
                                        }`}>
                                    {r === '7d' ? '7 días' : r === '30d' ? '30 días' : r === '90d' ? '90 días' : 'Todo'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-1">
                        {tabs.map(tab => (
                            <button key={tab.path} onClick={() => navigate(tab.path)}
                                className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-xs font-semibold transition-all ${tab.path === '/whatsapp/reports'
                                        ? 'bg-white text-emerald-700 border-b-2 border-emerald-500 dark:bg-slate-800 dark:text-emerald-400'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}>
                                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Revenue highlight */}
                <div className="rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-6 text-white shadow-xl shadow-emerald-500/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-emerald-100">Ingresos Generados por WhatsApp</p>
                            <p className="text-4xl font-bold mt-1">{formatWaCurrency(totalRevenue)}</p>
                            <p className="text-sm text-emerald-100 mt-2">
                                {totalSent.toLocaleString()} mensajes → {totalConversions} conversiones
                            </p>
                        </div>
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                            <span className="material-symbols-outlined text-[36px]">trending_up</span>
                        </div>
                    </div>
                </div>

                {/* Conversion Funnel */}
                <div className="rounded-xl bg-white border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Embudo de Conversión</h3>
                        <p className="text-[11px] text-slate-400">Mensajes enviados → Visitas agendadas → Ingresos</p>
                    </div>
                    <div className="p-5">
                        <div className="space-y-3">
                            {funnel.map((step, i) => (
                                <div key={step.label} className="flex items-center gap-4">
                                    <div className="w-24 text-right">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{step.value.toLocaleString()}</p>
                                        <p className="text-[10px] text-slate-400">{step.label}</p>
                                    </div>
                                    <div className="flex-1 relative">
                                        <div className="h-8 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                            <div className={`h-8 rounded-lg ${step.color} transition-all duration-500 flex items-center justify-end pr-3`}
                                                style={{ width: `${Math.max(step.pct, 3)}%` }}>
                                                <span className="text-xs font-bold text-white">{step.pct}%</span>
                                            </div>
                                        </div>
                                        {i < funnel.length - 1 && (
                                            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                                                <span className="material-symbols-outlined text-slate-300 text-[14px]">arrow_downward</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Campaign Performance Table */}
                    <div className="rounded-xl bg-white border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Rendimiento por Campaña</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Campaña</th>
                                        <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Envíos</th>
                                        <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Entrega</th>
                                        <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Lectura</th>
                                        <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Ingreso</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {campaigns.map(camp => (
                                        <tr key={camp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-block h-2 w-2 rounded-full ${CAMPAIGN_TYPE_COLORS[camp.campaign_type as CampaignType]?.text?.replace('text-', 'bg-').split(' ')[0] || 'bg-slate-400'}`} />
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">{camp.name}</p>
                                                        <p className="text-[10px] text-slate-400">{CAMPAIGN_TYPE_LABELS[camp.campaign_type as CampaignType]}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-center text-xs font-medium text-slate-600 dark:text-slate-400">{camp.total_sent}</td>
                                            <td className="px-3 py-3 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400">{getDeliveryRate(camp.total_sent, camp.total_delivered)}%</td>
                                            <td className="px-3 py-3 text-center text-xs font-bold text-sky-600 dark:text-sky-400">{getReadRate(camp.total_delivered, camp.total_read)}%</td>
                                            <td className="px-3 py-3 text-right text-xs font-bold text-slate-900 dark:text-white">{formatWaCurrency(camp.revenue_generated)}</td>
                                        </tr>
                                    ))}
                                    {campaigns.length === 0 && (
                                        <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">Sin datos de campañas</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Notifications Breakdown */}
                    <div className="rounded-xl bg-white border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notificaciones por Tipo</h3>
                        </div>
                        <div className="p-5 space-y-3">
                            {Object.entries(notifByType).map(([type, data]) => (
                                <div key={type} className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/30">
                                        <span className="material-symbols-outlined text-sky-600 dark:text-sky-400 text-[16px]">notifications</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-xs font-semibold text-slate-900 dark:text-white">{NOTIFICATION_TYPE_LABELS[type as keyof typeof NOTIFICATION_TYPE_LABELS] || type}</p>
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{data.total}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                            <div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${data.total > 0 ? (data.delivered / data.total) * 100 : 0}%` }} />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{data.delivered} entregadas · {data.read} leídas</p>
                                    </div>
                                </div>
                            ))}
                            {Object.keys(notifByType).length === 0 && (
                                <div className="text-center py-6 text-slate-400">
                                    <span className="material-symbols-outlined text-[36px] mb-2">notifications_none</span>
                                    <p className="text-sm">Sin notificaciones registradas</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Notification Status + Survey Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Status Distribution */}
                    <div className="rounded-xl bg-white border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Estado de Entregas</h3>
                        </div>
                        <div className="p-5">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {(['pending', 'sent', 'delivered', 'read', 'failed'] as WaMessageStatus[]).map(status => (
                                    <div key={status} className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800">
                                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{notifByStatus[status] || 0}</p>
                                        <p className="text-[10px] text-slate-400 mt-1">{WA_MESSAGE_STATUS_LABELS[status]}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Survey Results */}
                    <div className="rounded-xl bg-white border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Encuestas Post-Servicio</h3>
                        </div>
                        <div className="p-5">
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="rounded-lg bg-sky-50 p-3 text-center dark:bg-sky-900/20">
                                    <p className="text-xl font-bold text-sky-700 dark:text-sky-400">{surveys.length}</p>
                                    <p className="text-[10px] text-slate-400">Enviadas</p>
                                </div>
                                <div className="rounded-lg bg-emerald-50 p-3 text-center dark:bg-emerald-900/20">
                                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{surveys.filter(s => s.status === 'answered').length}</p>
                                    <p className="text-[10px] text-slate-400">Respondidas</p>
                                </div>
                                <div className="rounded-lg bg-amber-50 p-3 text-center dark:bg-amber-900/20">
                                    <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
                                        {surveys.filter(s => s.rating).length > 0
                                            ? (surveys.filter(s => s.rating).reduce((s, sv) => s + (sv.rating || 0), 0) / surveys.filter(s => s.rating).length).toFixed(1)
                                            : '—'}
                                    </p>
                                    <p className="text-[10px] text-slate-400">Promedio</p>
                                </div>
                            </div>
                            {surveys.filter(s => s.comment).slice(0, 3).map(sv => (
                                <div key={sv.id} className="mb-2 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800">
                                    <div className="flex items-center gap-1 mb-1">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <span key={star} className={`material-symbols-outlined text-[12px] ${(sv.rating || 0) >= star ? 'text-amber-400' : 'text-slate-300'}`}>star</span>
                                        ))}
                                        <span className="text-[10px] text-slate-400 ml-1">{(sv.client as { company_name: string } | undefined)?.company_name}</span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 italic">"{sv.comment}"</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
