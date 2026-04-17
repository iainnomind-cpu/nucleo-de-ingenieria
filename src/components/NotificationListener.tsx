import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

// Generate notification beep using Web Audio API (no external files needed)
function playNotificationSound() {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        // First beep
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.frequency.setValueAtTime(830, ctx.currentTime);
        osc1.type = 'sine';
        gain1.gain.setValueAtTime(0.3, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.15);

        // Second beep (higher pitch, slight delay)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(1200, ctx.currentTime + 0.18);
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0, ctx.currentTime);
        gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc2.start(ctx.currentTime + 0.18);
        osc2.stop(ctx.currentTime + 0.35);

        // Cleanup
        setTimeout(() => ctx.close(), 500);
    } catch (e) {
        console.warn('Could not play notification sound:', e);
    }
}

export default function NotificationListener() {
    const { user } = useAuth();
    const [notification, setNotification] = useState<{ id: string; title: string; message: string; isTask: boolean } | null>(null);
    const audioUnlockedRef = useRef(false);

    // Unlock audio on first user interaction (browser autoplay policy)
    useEffect(() => {
        const unlock = () => {
            if (!audioUnlockedRef.current) {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioCtx) {
                    const ctx = new AudioCtx();
                    const buf = ctx.createBuffer(1, 1, 22050);
                    const src = ctx.createBufferSource();
                    src.buffer = buf;
                    src.connect(ctx.destination);
                    src.start(0);
                    ctx.close();
                }
                audioUnlockedRef.current = true;
            }
        };
        document.addEventListener('click', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
        return () => {
            document.removeEventListener('click', unlock);
            document.removeEventListener('keydown', unlock);
        };
    }, []);

    const showNotif = useCallback((id: string, title: string, message: string, isTask: boolean) => {
        playNotificationSound();
        setNotification({ id, title, message, isTask });
        setTimeout(() => setNotification(null), 8000);
    }, []);

    useEffect(() => {
        if (!user) return;

        const taskSubscription = supabase
            .channel('public:team_tasks')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'team_tasks' },
                (payload) => {
                    const newTask = payload.new;
                    if (newTask.assigned_to && user.full_name && newTask.assigned_to.includes(user.full_name)) {
                        showNotif(newTask.id, 'Nueva Tarea Asignada', newTask.title, true);
                    }
                }
            )
            .subscribe();

        const waSubscription = supabase
            .channel('public:wa_messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'wa_messages', filter: "direction=eq.inbound" },
                (payload) => {
                    const newMsg = payload.new;
                    showNotif(newMsg.id, 'Nuevo Mensaje WhatsApp', newMsg.content || 'Mensaje recibido', false);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(taskSubscription);
            supabase.removeChannel(waSubscription);
        };
    }, [user, showNotif]);

    if (!notification) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 slide-in-from-right-4 duration-500">
            <div className={`relative flex w-80 flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10 ${notification.title.includes('WhatsApp') ? 'border-l-4 border-l-emerald-500' : notification.isTask ? 'border-l-4 border-l-primary' : ''}`}>
                <div className="flex items-start gap-4 p-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full mt-0.5 ${notification.title.includes('WhatsApp') ? 'bg-emerald-100 text-emerald-500 dark:bg-emerald-900/30' : 'bg-primary/10 text-primary'}`}>
                        <span className="material-symbols-outlined text-[20px]">
                            {notification.title.includes('WhatsApp') ? 'chat' : (notification.isTask ? 'task_alt' : 'notifications')}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                        <p className="font-bold text-slate-900 dark:text-white">{notification.title}</p>
                        <p className="mt-1 text-sm text-slate-500 line-clamp-2 dark:text-slate-400">{notification.message}</p>
                    </div>
                    <button 
                        onClick={() => setNotification(null)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
