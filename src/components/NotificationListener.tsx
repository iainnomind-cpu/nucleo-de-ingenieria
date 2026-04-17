import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

// Generate a WAV file in memory and return an object URL
function createBeepWav(): string {
    const sampleRate = 44100;
    const duration = 0.25;
    const freq1 = 880;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // WAV header
    const w = (off: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
    w(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    w(8, 'WAVE');
    w(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    w(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const envelope = Math.min(1, (duration - t) * 15) * Math.min(1, t * 200);
        const sample = Math.sin(2 * Math.PI * freq1 * t) * envelope * 0.6;
        view.setInt16(44 + i * 2, Math.floor(sample * 32767), true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
}

// Create the sound URL once at module level
let notifSoundUrl: string | null = null;
function getNotifSoundUrl() {
    if (!notifSoundUrl) notifSoundUrl = createBeepWav();
    return notifSoundUrl;
}

export default function NotificationListener() {
    const { user } = useAuth();
    const [notification, setNotification] = useState<{ id: string; title: string; message: string; isTask: boolean } | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Pre-create audio element on mount
    useEffect(() => {
        const audio = new Audio(getNotifSoundUrl());
        audio.volume = 0.7;
        audioRef.current = audio;

        // Warm up audio on first user interaction (required by Chrome autoplay policy)
        const warmUp = () => {
            if (audioRef.current) {
                audioRef.current.play().then(() => {
                    audioRef.current!.pause();
                    audioRef.current!.currentTime = 0;
                }).catch(() => {});
            }
        };
        document.addEventListener('click', warmUp, { once: true });
        return () => { document.removeEventListener('click', warmUp); };
    }, []);

    const playSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(err => console.warn('Sound play failed:', err));
        }
    }, []);

    const showNotif = useCallback((id: string, title: string, message: string, isTask: boolean) => {
        playSound();
        setNotification({ id, title, message, isTask });
        setTimeout(() => setNotification(null), 8000);
    }, [playSound]);

    useEffect(() => {
        if (!user) return;

        const taskSubscription = supabase
            .channel('notif:team_tasks')
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
            .channel('notif:wa_messages')
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
        <div className="fixed bottom-6 right-6 z-50" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
            <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
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
