import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    WaCampaign, WaConversation, WaSurvey, WaNotification,
    CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPE_ICONS, CAMPAIGN_TYPE_COLORS,
    WA_MESSAGE_STATUS_COLORS, WA_MESSAGE_STATUS_LABELS,
    NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPE_ICONS,
    formatWaCurrency, getDeliveryRate, getReadRate, getResponseRate,
    timeAgoWa,
    CampaignType,
} from '../../types/whatsapp';

export default function WhatsAppDashboard() {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
    const [conversations, setConversations] = useState<WaConversation[]>([]);
    const [notifications, setNotifications] = useState<WaNotification[]>([]);
    const [surveys, setSurveys] = useState<WaSurvey[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [campRes, convRes, notifRes, survRes] = await Promise.all([
            supabase.from('wa_campaigns').select('*').order('created_at', { ascending: false }),
            supabase.from('wa_conversations').select('*, client:clients(id, company_name)').order('last_message_at', { ascending: false }).limit(10),
            supabase.from('wa_notifications').select('*, client:clients(id, company_name)').order('created_at', { ascending: false }).limit(10),
            supabase.from('wa_surveys').select('*, client:clients(id, company_name)').order('created_at', { ascending: false }),
        ]);
        setCampaigns((campRes.data as WaCampaign[]) || []);
        setConversations((convRes.data as WaConversation[]) || []);
        setNotifications((notifRes.data as WaNotification[]) || []);
        setSurveys((survRes.data as WaSurvey[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // KPI calculations
    const totalSent = campaigns.reduce((s, c) => s + c.total_sent, 0);
    const totalDelivered = campaigns.reduce((s, c) => s + c.total_delivered, 0);
    const totalRead = campaigns.reduce((s, c) => s + c.total_read, 0);
    const totalResponded = campaigns.reduce((s, c) => s + c.total_responded, 0);
    const totalRevenue = campaigns.reduce((s, c) => s + c.revenue_generated, 0);
    const activeCampaigns = campaigns.filter(c => c.is_active).length;
    const avgSurveyRating = surveys.filter(s => s.rating).length > 0
        ? (surveys.filter(s => s.rating).reduce((s, sv) => s + (sv.rating || 0), 0) / surveys.filter(s => s.rating).length).toFixed(1)
        : '—';

    const kpis = [
        { label: 'Mensajes Enviados', value: totalSent.toLocaleString(), icon: 'send', color: 'from-emerald-500 to-teal-600', sub: `${getDeliveryRate(totalSent, totalDelivered)}% entregados` },
        { label: 'Tasa de Lectura', value: `${getReadRate(totalDelivered, totalRead)}%`, icon: 'visibility', color: 'from-sky-500 to-blue-600', sub: `${totalRead.toLocaleString()} leídos` },
        { label: 'Tasa de Respuesta', value: `${getResponseRate(totalRead, totalResponded)}%`, icon: 'reply', color: 'from-violet-500 to-purple-600', sub: `${totalResponded.toLocaleString()} respuestas` },
        { label: 'Ingresos Generados', value: formatWaCurrency(totalRevenue), icon: 'trending_up', color: 'from-amber-500 to-orange-600', sub: `${activeCampaigns} campañas activas` },
    ];

    // Tab navigation
    const tabs = [
        { label: 'Dashboard', icon: 'space_dashboard', path: '/whatsapp' },
        { label: 'Conversaciones', icon: 'chat', path: '/whatsapp/conversations' },
        { label: 'Envío Directo', icon: 'send', path: '/whatsapp/send' },
        { label: 'Campañas', icon: 'campaign', path: '/whatsapp/campaigns' },
        { label: 'Plantillas', icon: 'description', path: '/whatsapp/templates' },
        { label: 'Reportes', icon: 'analytics', path: '/whatsapp/reports' },
        { label: 'Automatizaciones', icon: 'bolt', path: '/whatsapp/automations' },
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
                                <p className="text-xs text-slate-500">Notificaciones automatizadas & comunicación con clientes</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                API Conectada
                            </span>
                        </div>
                    </div>
                    {/* Tabs */}
                    <div className="flex gap-1">
                        {tabs.map(tab => (
                            <button key={tab.path} onClick={() => navigate(tab.path)}
                                className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-xs font-semibold transition-all ${tab.path === '/whatsapp'
                                    ? 'bg-white text-emerald-700 border-b-2 border-emerald-500 dark:bg-slate-800 dark:text-emerald-400'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:text-slate-300'
                                    }`}>
                                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {kpis.map(kpi => (
                        <div key={kpi.label} className="relative overflow-hidden rounded-xl bg-white p-5 shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                            <div className={`absolute -top-4 -right-4 h-20 w-20 rounded-full bg-gradient-to-br ${kpi.color} opacity-10`} />
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
                                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{kpi.value}</p>
                                    <p className="mt-1 text-[11px] text-slate-400">{kpi.sub}</p>
                                </div>
                                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${kpi.color} shadow-lg`}>
                                    <span className="material-symbols-outlined text-white text-[20px]">{kpi.icon}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Active Campaigns */}
                    <div className="lg:col-span-2 rounded-xl bg-white border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Campañas Activas</h3>
                            <button onClick={() => navigate('/whatsapp/campaigns')} className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">Ver todas →</button>
                        </div>
                        <div className="divide-y divide-slate-50 dark:divide-slate-800">
                            {campaigns.filter(c => c.is_active).slice(0, 5).map(camp => {
                                const ct = camp.campaign_type as CampaignType;
                                return (
                                    <div key={camp.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${CAMPAIGN_TYPE_COLORS[ct]?.bg || 'bg-slate-100'}`}>
                                            <span className={`material-symbols-outlined text-[18px] ${CAMPAIGN_TYPE_COLORS[ct]?.text || 'text-slate-500'}`}>{CAMPAIGN_TYPE_ICONS[ct] || 'campaign'}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{camp.name}</p>
                                            <p className="text-[11px] text-slate-400">{CAMPAIGN_TYPE_LABELS[ct] || ct} · {camp.total_sent} enviados</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{getDeliveryRate(camp.total_sent, camp.total_delivered)}%</p>
                                            <p className="text-[10px] text-slate-400">entrega</p>
                                        </div>
                                    </div>
                                );
                            })}
                            {campaigns.filter(c => c.is_active).length === 0 && (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                    <span className="material-symbols-outlined text-[40px] mb-2">campaign</span>
                                    <p className="text-sm">No hay campañas activas</p>
                                    <button onClick={() => navigate('/whatsapp/campaigns')} className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700">Crear campaña →</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Survey Satisfaction */}
                    <div className="rounded-xl bg-white border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Satisfacción Post-Servicio</h3>
                        </div>
                        <div className="p-5">
                            <div className="text-center mb-4">
                                <p className="text-4xl font-bold text-slate-900 dark:text-white">{avgSurveyRating}</p>
                                <div className="flex items-center justify-center gap-0.5 mt-1">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <span key={star} className={`material-symbols-outlined text-[20px] ${parseFloat(String(avgSurveyRating)) >= star ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'}`}>star</span>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">{surveys.filter(s => s.rating).length} respuestas</p>
                            </div>
                            <div className="space-y-2">
                                {[5, 4, 3, 2, 1].map(star => {
                                    const count = surveys.filter(s => s.rating === star).length;
                                    const total = surveys.filter(s => s.rating).length;
                                    const pct = total > 0 ? (count / total) * 100 : 0;
                                    return (
                                        <div key={star} className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 w-3">{star}</span>
                                            <span className="material-symbols-outlined text-amber-400 text-[14px]">star</span>
                                            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                                                <div className="h-2 rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="text-[10px] text-slate-400 w-8 text-right">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Conversations */}
                    <div className="rounded-xl bg-white border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Conversaciones Recientes</h3>
                            <button onClick={() => navigate('/whatsapp/conversations')} className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">Ver inbox →</button>
                        </div>
                        <div className="divide-y divide-slate-50 dark:divide-slate-800">
                            {conversations.slice(0, 6).map(conv => (
                                <button key={conv.id} onClick={() => navigate('/whatsapp/conversations')}
                                    className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-bold">
                                        {(conv.client_name || conv.phone_number).slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{conv.client_name || conv.phone_number}</p>
                                        <p className="text-[11px] text-slate-400 truncate">{conv.last_message_preview || 'Sin mensajes'}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {conv.last_message_at && <span className="text-[10px] text-slate-400">{timeAgoWa(conv.last_message_at)}</span>}
                                        {conv.unread_count > 0 && (
                                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">{conv.unread_count}</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                            {conversations.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                                    <span className="material-symbols-outlined text-[36px] mb-2">chat_bubble_outline</span>
                                    <p className="text-sm">Sin conversaciones aún</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Notifications */}
                    <div className="rounded-xl bg-white border border-slate-100 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notificaciones Recientes</h3>
                        </div>
                        <div className="divide-y divide-slate-50 dark:divide-slate-800">
                            {notifications.slice(0, 6).map(notif => (
                                <div key={notif.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/30">
                                        <span className="material-symbols-outlined text-sky-600 dark:text-sky-400 text-[16px]">{NOTIFICATION_TYPE_ICONS[notif.notification_type] || 'notifications'}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{NOTIFICATION_TYPE_LABELS[notif.notification_type]}</p>
                                        <p className="text-[11px] text-slate-400 truncate">{(notif.client as { company_name: string } | undefined)?.company_name || 'Cliente'}</p>
                                    </div>
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${WA_MESSAGE_STATUS_COLORS[notif.status]?.bg} ${WA_MESSAGE_STATUS_COLORS[notif.status]?.text}`}>
                                        {WA_MESSAGE_STATUS_LABELS[notif.status]}
                                    </span>
                                </div>
                            ))}
                            {notifications.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                                    <span className="material-symbols-outlined text-[36px] mb-2">notifications_none</span>
                                    <p className="text-sm">Sin notificaciones</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
