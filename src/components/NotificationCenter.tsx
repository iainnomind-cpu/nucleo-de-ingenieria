// ============================================================
// NotificationCenter — Sistema centralizado de notificaciones
// Incluye: campanita con badge, dropdown, toast emergente,
//           suscripciones realtime a tasks, mentions, y notifications
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { getInitials, getAvatarColor, timeAgo } from '../types/teams';

export interface AppNotification {
    id: string;
    user_name: string;
    title: string;
    message: string | null;
    type: 'task' | 'project' | 'payment' | 'mention' | 'system' | 'alert';
    icon: string;
    link: string | null;
    is_read: boolean;
    source: string | null;
    reference_id: string | null;
    created_at: string;
}

const TYPE_CONFIG: Record<string, { color: string; bgColor: string; defaultIcon: string }> = {
    task:    { color: 'text-primary',        bgColor: 'bg-primary/10',       defaultIcon: 'task_alt' },
    project: { color: 'text-emerald-500',    bgColor: 'bg-emerald-500/10',   defaultIcon: 'engineering' },
    payment: { color: 'text-amber-500',      bgColor: 'bg-amber-500/10',     defaultIcon: 'payments' },
    mention: { color: 'text-violet-500',     bgColor: 'bg-violet-500/10',    defaultIcon: 'alternate_email' },
    system:  { color: 'text-sky-500',        bgColor: 'bg-sky-500/10',       defaultIcon: 'info' },
    alert:   { color: 'text-red-500',        bgColor: 'bg-red-500/10',       defaultIcon: 'warning' },
};

// ── Toast queue for showing real-time popups ──
interface ToastItem {
    id: string;
    title: string;
    message: string;
    icon: string;
    type: string;
    link?: string | null;
}

export default function NotificationCenter() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const bellRef = useRef<HTMLButtonElement>(null);

    const NOTIF_SOUND = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

    // ── Helpers ──
    const getUserIdentifier = useCallback(() => {
        if (!user) return null;
        // Match by full_name since team_tasks uses string names
        return user.full_name;
    }, [user]);

    const playSound = useCallback(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio(NOTIF_SOUND);
            audioRef.current.volume = 0.4;
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => { /* browser may block autoplay */ });
    }, []);

    const showToast = useCallback((toast: ToastItem) => {
        playSound();
        // Animate bell
        bellRef.current?.classList.add('animate-bell-ring');
        setTimeout(() => bellRef.current?.classList.remove('animate-bell-ring'), 1000);

        setToasts(prev => [...prev, toast]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toast.id));
        }, 8000);
    }, [playSound]);

    // ── Fetch notifications from DB ──
    const fetchNotifications = useCallback(async () => {
        const userName = getUserIdentifier();
        if (!userName) return;

        const { data } = await supabase
            .from('app_notifications')
            .select('*')
            .eq('user_name', userName)
            .order('created_at', { ascending: false })
            .limit(50);

        const notifs = (data as AppNotification[]) || [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.is_read).length);
    }, [getUserIdentifier]);

    // ── Initial load ──
    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    // ── Realtime subscriptions ──
    useEffect(() => {
        const userName = getUserIdentifier();
        if (!userName) return;

        // 1. Listen for new rows in app_notifications for this user
        const notifChannel = supabase
            .channel('app_notifications_realtime')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'app_notifications',
            }, (payload) => {
                const n = payload.new as AppNotification;
                if (n.user_name === userName) {
                    setNotifications(prev => [n, ...prev].slice(0, 50));
                    setUnreadCount(prev => prev + 1);
                    const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
                    showToast({
                        id: n.id,
                        title: n.title,
                        message: n.message || '',
                        icon: n.icon || cfg.defaultIcon,
                        type: n.type,
                        link: n.link,
                    });
                }
            })
            .subscribe();

        // 2. Listen for new team_tasks assigned to this user (fallback / legacy)
        const taskChannel = supabase
            .channel('team_tasks_notif')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'team_tasks',
            }, (payload) => {
                const task = payload.new as { id: string; title: string; assigned_to: string; created_by: string; priority: string };
                if (task.assigned_to && userName && (
                    task.assigned_to === userName ||
                    task.assigned_to.includes(userName) ||
                    userName.includes(task.assigned_to)
                )) {
                    // Check if we already got an app_notification for this (avoid duplicates)
                    // We'll show a toast regardless since realtime is fast
                    showToast({
                        id: `task-${task.id}`,
                        title: '📋 Nueva Tarea Asignada',
                        message: task.title,
                        icon: 'task_alt',
                        type: 'task',
                        link: '/tasks',
                    });
                    // Also bump the unread count (it will reconcile on next fetch)
                    setUnreadCount(prev => prev + 1);
                }
            })
            .subscribe();

        // 3. Listen for new message_mentions for this user
        const mentionChannel = supabase
            .channel('mentions_notif')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'message_mentions',
            }, (payload) => {
                const mention = payload.new as { id: string; mentioned_user: string; space_id: string; message_id: string };
                if (mention.mentioned_user === userName) {
                    showToast({
                        id: `mention-${mention.id}`,
                        title: '💬 Te mencionaron',
                        message: 'Tienes una nueva mención en el chat del equipo',
                        icon: 'alternate_email',
                        type: 'mention',
                        link: `/team/space/${mention.space_id}`,
                    });
                    setUnreadCount(prev => prev + 1);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(notifChannel);
            supabase.removeChannel(taskChannel);
            supabase.removeChannel(mentionChannel);
        };
    }, [getUserIdentifier, showToast]);

    // ── Click outside to close dropdown ──
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ── Actions ──
    const markAsRead = async (notif: AppNotification) => {
        if (!notif.is_read) {
            await supabase.from('app_notifications').update({ is_read: true }).eq('id', notif.id);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
        if (notif.link) {
            navigate(notif.link);
            setIsOpen(false);
        }
    };

    const markAllRead = async () => {
        const userName = getUserIdentifier();
        if (!userName) return;
        await supabase.from('app_notifications').update({ is_read: true }).eq('user_name', userName).eq('is_read', false);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    const dismissToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const handleToastClick = (toast: ToastItem) => {
        if (toast.link) navigate(toast.link);
        dismissToast(toast.id);
    };

    return (
        <>
            {/* ═══ BELL BUTTON (for Header) ═══ */}
            <div ref={dropdownRef} className="relative">
                <button
                    ref={bellRef}
                    onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchNotifications(); }}
                    className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-light text-slate-600 shadow-sm transition-all hover:bg-slate-100 hover:scale-105 dark:bg-surface-dark dark:text-slate-300 dark:hover:bg-slate-700"
                    title="Notificaciones"
                >
                    <span className="material-symbols-outlined text-[20px]">notifications</span>
                    {unreadCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg shadow-red-500/30 animate-pulse">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>

                {/* ═══ DROPDOWN PANEL ═══ */}
                {isOpen && (
                    <div className="absolute right-0 top-12 z-50 w-96 origin-top-right animate-in fade-in zoom-in-95 duration-200">
                        <div className="rounded-2xl border border-slate-200/60 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-700/60 dark:bg-slate-900 dark:shadow-black/30">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-[20px]">notifications</span>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notificaciones</h3>
                                    {unreadCount > 0 && (
                                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                            {unreadCount} nueva{unreadCount !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                                {unreadCount > 0 && (
                                    <button onClick={markAllRead} className="text-[11px] font-semibold text-primary hover:underline">
                                        Marcar todas leídas
                                    </button>
                                )}
                            </div>

                            {/* Notifications List */}
                            <div className="max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                {notifications.length === 0 ? (
                                    <div className="flex flex-col items-center gap-3 py-12">
                                        <span className="material-symbols-outlined text-[48px] text-slate-200 dark:text-slate-700">notifications_off</span>
                                        <p className="text-sm text-slate-400">Sin notificaciones</p>
                                    </div>
                                ) : (
                                    notifications.map(n => {
                                        const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
                                        return (
                                            <div
                                                key={n.id}
                                                onClick={() => markAsRead(n)}
                                                className={`flex cursor-pointer items-start gap-3 border-b border-slate-50 px-5 py-3.5 transition-colors last:border-0 dark:border-slate-800/50 ${
                                                    n.is_read
                                                        ? 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/50'
                                                        : 'bg-primary/[0.03] hover:bg-primary/[0.06] dark:bg-primary/[0.05] dark:hover:bg-primary/[0.08]'
                                                }`}
                                            >
                                                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.bgColor}`}>
                                                    <span className={`material-symbols-outlined text-[18px] ${cfg.color}`}>
                                                        {n.icon || cfg.defaultIcon}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm leading-snug ${n.is_read ? 'text-slate-600 dark:text-slate-400' : 'font-semibold text-slate-900 dark:text-white'}`}>
                                                        {n.title}
                                                    </p>
                                                    {n.message && (
                                                        <p className="mt-0.5 text-xs text-slate-400 line-clamp-2 dark:text-slate-500">{n.message}</p>
                                                    )}
                                                    <p className="mt-1 text-[10px] text-slate-400">{timeAgo(n.created_at)}</p>
                                                </div>
                                                {!n.is_read && (
                                                    <div className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary shadow-sm shadow-primary/30" />
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Footer */}
                            {notifications.length > 0 && (
                                <div className="border-t border-slate-100 px-5 py-2.5 dark:border-slate-800">
                                    <button
                                        onClick={() => { navigate('/tasks'); setIsOpen(false); }}
                                        className="w-full text-center text-xs font-semibold text-primary hover:underline"
                                    >
                                        Ver Tablero de Tareas →
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ TOAST POPUPS (bottom-right) ═══ */}
            <div className="fixed bottom-6 right-6 z-[60] flex flex-col-reverse gap-3 pointer-events-none">
                {toasts.map(toast => {
                    const cfg = TYPE_CONFIG[toast.type] || TYPE_CONFIG.system;
                    return (
                        <div
                            key={toast.id}
                            className="pointer-events-auto w-[360px] animate-in slide-in-from-right-4 fade-in duration-300"
                        >
                            <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10 dark:shadow-black/30">
                                {/* Accent top bar */}
                                <div className={`absolute left-0 top-0 h-1 w-full ${cfg.bgColor.replace('/10', '/40')}`} />
                                <div className="flex items-start gap-3.5 p-4 pt-5">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.bgColor}`}>
                                        <span className={`material-symbols-outlined text-[20px] ${cfg.color}`}>{toast.icon}</span>
                                    </div>
                                    <div
                                        className="flex-1 min-w-0 cursor-pointer"
                                        onClick={() => handleToastClick(toast)}
                                    >
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{toast.title}</p>
                                        <p className="mt-0.5 text-[13px] text-slate-500 line-clamp-2 dark:text-slate-400">{toast.message}</p>
                                        {toast.link && (
                                            <p className="mt-1.5 text-[11px] font-semibold text-primary hover:underline">
                                                Ver detalle →
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => dismissToast(toast.id)}
                                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-400 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                </div>
                                {/* Progress bar for auto-dismiss */}
                                <div className="h-0.5 w-full bg-slate-100 dark:bg-slate-800">
                                    <div
                                        className={`h-full ${cfg.color.replace('text-', 'bg-')} transition-all`}
                                        style={{ animation: 'shrink 8s linear forwards' }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Inline keyframes for toast progress bar and bell ring */}
            <style>{`
                @keyframes shrink {
                    from { width: 100%; }
                    to { width: 0%; }
                }
                @keyframes bell-ring {
                    0% { transform: rotate(0deg); }
                    10% { transform: rotate(14deg); }
                    20% { transform: rotate(-14deg); }
                    30% { transform: rotate(10deg); }
                    40% { transform: rotate(-10deg); }
                    50% { transform: rotate(6deg); }
                    60% { transform: rotate(-4deg); }
                    70% { transform: rotate(2deg); }
                    80% { transform: rotate(-1deg); }
                    100% { transform: rotate(0deg); }
                }
                .animate-bell-ring {
                    animation: bell-ring 0.8s ease-in-out;
                }
            `}</style>
        </>
    );
}
