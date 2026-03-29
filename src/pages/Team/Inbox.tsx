import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    MessageMention, Space, Message,
    getInitials, getAvatarColor, timeAgo,
} from '../../types/teams';

const CURRENT_USER = 'Director';

interface MentionWithContext extends MessageMention {
    message?: Message;
    space?: Space;
}

export default function Inbox() {
    const navigate = useNavigate();
    const [mentions, setMentions] = useState<MentionWithContext[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread'>('unread');

    const fetchMentions = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('message_mentions').select('*, message:messages(id, sender, content, message_type, created_at, space_id), space:spaces(id, name, icon, space_type)')
            .eq('mentioned_user', CURRENT_USER).order('created_at', { ascending: false }).limit(50);
        if (filter === 'unread') q = q.eq('is_read', false);
        const { data } = await q;
        setMentions((data as MentionWithContext[]) || []);
        setLoading(false);
    }, [filter]);

    useEffect(() => { fetchMentions(); }, [fetchMentions]);

    const markRead = async (id: string, spaceId: string) => {
        await supabase.from('message_mentions').update({ is_read: true }).eq('id', id);
        navigate(`/team/space/${spaceId}`);
    };

    const markAllRead = async () => {
        await supabase.from('message_mentions').update({ is_read: true }).eq('mentioned_user', CURRENT_USER).eq('is_read', false);
        fetchMentions();
    };

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/team')} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><span className="material-symbols-outlined text-[20px]">arrow_back</span></button>
                    <div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Inbox de Menciones</h2>
                        <p className="text-sm text-slate-500">{mentions.filter(m => !m.is_read).length} sin leer</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                        <button onClick={() => setFilter('unread')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === 'unread' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>Sin Leer</button>
                        <button onClick={() => setFilter('all')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>Todas</button>
                    </div>
                    <button onClick={markAllRead} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 dark:border-slate-700">Marcar todas leídas</button>
                </div>
            </div>

            {loading ? <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div> : mentions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16"><span className="material-symbols-outlined text-[64px] text-slate-200">mark_email_read</span><p className="text-sm text-slate-500">{filter === 'unread' ? 'Sin menciones pendientes. 🎉' : 'No hay menciones.'}</p></div>
            ) : (
                <div className="space-y-2">
                    {mentions.map(m => (
                        <div key={m.id} onClick={() => markRead(m.id, m.space_id)} className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-sm ${m.is_read ? 'border-slate-200/60 bg-white/50 dark:border-slate-800/60 dark:bg-slate-900/50' : 'border-primary/20 bg-primary/5'}`}>
                            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white text-xs font-bold ${getAvatarColor(m.message?.sender || '')}`}>{getInitials(m.message?.sender || '?')}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{m.message?.sender}</span>
                                    <span className="text-[10px] text-slate-400">te mencionó en</span>
                                    <span className="flex items-center gap-1 text-xs text-primary font-semibold"><span className="material-symbols-outlined text-[14px]">{m.space?.icon || 'forum'}</span>{m.space?.name}</span>
                                </div>
                                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400 truncate">{m.message?.content}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">{timeAgo(m.created_at)}</span>
                                {!m.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
