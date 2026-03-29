import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export default function NotificationListener() {
    const { user } = useAuth();
    const [notification, setNotification] = useState<{ id: string; title: string; message: string; isTask: boolean } | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Un archivo MP3 público simple para la notificación (Campanita o pop)
    const NOTIFICATION_SOUND_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

    useEffect(() => {
        if (!user) return;
        
        audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
        audioRef.current.volume = 0.5;

        // Escuchar inserciones en team_tasks asignadas explícitamente al nombre del usuario (ya que en team_tasks 'assigned_to' es el nombre)
        // O si cambia a UUID, sería user.id
        const taskSubscription = supabase
            .channel('public:team_tasks')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'team_tasks',
                },
                (payload) => {
                    // Validar si es para este usuario (asumimos que payload.new.assigned_to coincide con full_name pero haremos un match parcial por si acaso)
                    const newTask = payload.new;
                    if (newTask.assigned_to && user.full_name && newTask.assigned_to.includes(user.full_name)) {
                        
                        // Play sound
                        if (audioRef.current) {
                            audioRef.current.play().catch(e => console.error("Error reproduciendo sonido", e));
                        }

                        // Show visual toast
                        setNotification({
                            id: newTask.id,
                            title: 'Nueva Tarea Asignada',
                            message: newTask.title,
                            isTask: true,
                        });

                        // Auto hide after 8s
                        setTimeout(() => setNotification(null), 8000);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(taskSubscription);
        };
    }, [user]);

    if (!notification) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 slide-in-from-right-4 duration-500">
            <div className={`relative flex w-80 flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-white/10 ${notification.isTask ? 'border-l-4 border-l-primary' : ''}`}>
                <div className="flex items-start gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                        <span className="material-symbols-outlined text-[20px]">{notification.isTask ? 'task_alt' : 'notifications'}</span>
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
