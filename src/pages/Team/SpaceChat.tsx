import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    Space, Message, SpaceType,
    SPACE_TYPE_LABELS, SPACE_TYPE_ICONS, TEAM_MEMBERS,
    TASK_PRIORITY_LABELS, TaskPriority,
    getInitials, getAvatarColor, timeAgo, parseMentions,
} from '../../types/teams';

const CURRENT_USER = 'Director';

export default function SpaceChat() {
    const { spaceId } = useParams<{ spaceId: string }>();
    const navigate = useNavigate();
    const [spaces, setSpaces] = useState<Space[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentSpace, setCurrentSpace] = useState<Space | null>(null);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState('');
    const [showSpaceForm, setShowSpaceForm] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
    const [threadParent, setThreadParent] = useState<Message | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [spaceForm, setSpaceForm] = useState({ name: '', description: '', space_type: 'area' as SpaceType, icon: 'forum' });
    const [taskForm, setTaskForm] = useState({ title: '', assigned_to: '', priority: 'normal' as TaskPriority, due_date: '', project_id: '' });
    const [projects, setProjects] = useState<{ id: string; project_number: string; title: string }[]>([]);

    const fetchSpaces = useCallback(async () => {
        const { data } = await supabase.from('spaces').select('*').eq('is_archived', false).order('space_type').order('name');
        setSpaces((data as Space[]) || []);
    }, []);

    const fetchMessages = useCallback(async (sid: string) => {
        const [spRes, msgRes] = await Promise.all([
            supabase.from('spaces').select('*').eq('id', sid).single(),
            supabase.from('messages').select('*').eq('space_id', sid).order('created_at', { ascending: true }).limit(100),
        ]);
        setCurrentSpace(spRes.data as Space);
        setMessages((msgRes.data as Message[]) || []);
        setLoading(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }, []);

    useEffect(() => {
        fetchSpaces();
        supabase.from('projects').select('id, project_number, title').order('project_number', { ascending: false }).then(r => setProjects(r.data || []));
    }, [fetchSpaces]);

    useEffect(() => {
        if (spaceId) { setLoading(true); fetchMessages(spaceId); }
    }, [spaceId, fetchMessages]);

    useEffect(() => {
        if (!spaceId) return;
        const channel = supabase.channel('space-' + spaceId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'space_id=eq.' + spaceId }, (payload) => {
                setMessages(prev => [...prev, payload.new as Message]);
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
            }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [spaceId]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !spaceId) return;
        const content = input.trim();

        // Check for /tarea command
        const taskRe = /^\/tarea\s+@(\w+)\s+(.+?)(?:\s+para el\s+(.+))?$/i;
        const taskMatch = content.match(taskRe);
        if (taskMatch) {
            const assignee = taskMatch[1];
            const desc = taskMatch[2];
            const dueDateStr = taskMatch[3];
            let due_date: string | undefined;
            if (dueDateStr) {
                const d = new Date();
                const dayMap: Record<string, number> = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0 };
                const day = dayMap[dueDateStr.toLowerCase()];
                if (day !== undefined) { while (d.getDay() !== day) d.setDate(d.getDate() + 1); due_date = d.toISOString().split('T')[0]; }
            }
            const { data: taskData } = await supabase.from('team_tasks').insert({
                title: desc, assigned_to: assignee, created_by: CURRENT_USER,
                source_space_id: spaceId, due_date: due_date || null, priority: 'high',
            }).select().single();
            const taskMsg = '\u{1F4CB} Tarea creada: "' + desc + '" \u2192 @' + assignee + (due_date ? ' para ' + dueDateStr : '');
            await supabase.from('messages').insert({
                space_id: spaceId, sender: CURRENT_USER, content: taskMsg,
                message_type: 'task_created', task_id: taskData?.id,
            });
            setInput('');
            fetchMessages(spaceId);
            return;
        }

        const parentId = threadParent?.id || null;
        await supabase.from('messages').insert({ space_id: spaceId, sender: CURRENT_USER, content, parent_id: parentId });
        const mentions = parseMentions(content);
        if (mentions.length > 0) {
            const { data: msgData } = await supabase.from('messages').select('id').eq('space_id', spaceId).eq('content', content).order('created_at', { ascending: false }).limit(1).single();
            if (msgData) {
                for (const user of mentions) {
                    await supabase.from('message_mentions').insert({ message_id: msgData.id, space_id: spaceId, mentioned_user: user });
                }
            }
        }
        setInput('');
        setThreadParent(null);
        fetchMessages(spaceId);
    };

    const createSpace = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from('spaces').insert({ ...spaceForm, created_by: CURRENT_USER });
        setShowSpaceForm(false);
        setSpaceForm({ name: '', description: '', space_type: 'area', icon: 'forum' });
        fetchSpaces();
    };

    const createTaskFromMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMsg || !spaceId) return;
        const { data } = await supabase.from('team_tasks').insert({
            title: taskForm.title || selectedMsg.content.slice(0, 200),
            assigned_to: taskForm.assigned_to, created_by: CURRENT_USER,
            priority: taskForm.priority, due_date: taskForm.due_date || null,
            project_id: taskForm.project_id || null,
            source_message_id: selectedMsg.id, source_space_id: spaceId,
        }).select().single();
        if (data) await supabase.from('messages').update({ task_id: data.id }).eq('id', selectedMsg.id);
        setShowTaskModal(false);
        setSelectedMsg(null);
        setTaskForm({ title: '', assigned_to: '', priority: 'normal', due_date: '', project_id: '' });
        fetchMessages(spaceId);
    };

    const grouped = spaces.reduce<Record<string, Space[]>>((acc, s) => {
        const key = s.space_type;
        if (!acc[key]) acc[key] = [];
        acc[key].push(s);
        return acc;
    }, {});
    const typeOrder: SpaceType[] = ['general', 'area', 'project', 'maintenance', 'dm', 'group_dm'];

    const topMessages = messages.filter(m => !m.parent_id);
    const threadReplies = messages.filter(m => m.parent_id);
    const getReplies = (id: string) => threadReplies.filter(m => m.parent_id === id);

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    return (
        <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
            {/* Sidebar */}
            <div className="flex w-64 flex-col border-r border-slate-200 bg-white/50 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Spaces</h3>
                    <button onClick={() => setShowSpaceForm(!showSpaceForm)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                    </button>
                </div>

                {showSpaceForm && (
                    <form onSubmit={createSpace} className="border-b border-slate-200 p-3 dark:border-slate-800">
                        <input value={spaceForm.name} onChange={e => setSpaceForm({ ...spaceForm, name: e.target.value })} placeholder="Nombre del space..." required className="mb-2 w-full rounded border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                        <select value={spaceForm.space_type} onChange={e => setSpaceForm({ ...spaceForm, space_type: e.target.value as SpaceType })} className="mb-2 w-full rounded border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                            {typeOrder.map(t => <option key={t} value={t}>{SPACE_TYPE_LABELS[t]}</option>)}
                        </select>
                        <button type="submit" className="w-full rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white">Crear</button>
                    </form>
                )}

                <div className="flex-1 overflow-y-auto">
                    {typeOrder.filter(t => grouped[t] && grouped[t].length > 0).map(type => (
                        <div key={type}>
                            <p className="px-4 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{SPACE_TYPE_LABELS[type]}</p>
                            {grouped[type].map(s => {
                                const isActive = spaceId === s.id;
                                return (
                                    <button key={s.id} onClick={() => navigate('/team/space/' + s.id)}
                                        className={'flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-all ' + (isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800')}>
                                        <span className="material-symbols-outlined text-[16px]">{s.icon || SPACE_TYPE_ICONS[s.space_type]}</span>
                                        <span className="truncate">{s.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className="border-t border-slate-200 p-2 dark:border-slate-800">
                    <button onClick={() => navigate('/team/board')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined text-[16px]">view_kanban</span>Board de Tareas
                    </button>
                    <button onClick={() => navigate('/team/inbox')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined text-[16px]">inbox</span>Inbox de Menciones
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex flex-1 flex-col">
                {!spaceId || !currentSpace ? (
                    <div className="flex flex-1 items-center justify-center">
                        <div className="text-center">
                            <span className="material-symbols-outlined text-[64px] text-slate-200">forum</span>
                            <p className="mt-2 text-sm text-slate-400">Selecciona un space para comenzar.</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Channel header */}
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary text-[20px]">{currentSpace.icon}</span>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{currentSpace.name}</h3>
                                    {currentSpace.description && <p className="text-xs text-slate-400">{currentSpace.description}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            {loading ? (
                                <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
                            ) : (
                                <div className="space-y-1">
                                    {topMessages.map(msg => {
                                        const replies = getReplies(msg.id);
                                        const isTask = msg.message_type === 'task_created';
                                        return (
                                            <div key={msg.id} className="group">
                                                <div className={'flex gap-3 rounded-lg p-2 transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ' + (isTask ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : '')}>
                                                    <div className={'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white text-xs font-bold ' + getAvatarColor(msg.sender)}>{getInitials(msg.sender)}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-slate-900 dark:text-white">{msg.sender}</span>
                                                            <span className="text-[10px] text-slate-400">{timeAgo(msg.created_at)}</span>
                                                            {msg.is_pinned && <span className="material-symbols-outlined text-amber-400 text-[12px]">push_pin</span>}
                                                        </div>
                                                        <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">{msg.content}</p>
                                                        {msg.task_id && (
                                                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                                <span className="material-symbols-outlined text-[12px]">task_alt</span>Tarea vinculada
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button onClick={() => setThreadParent(msg)} className="rounded p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700" title="Responder en hilo">
                                                            <span className="material-symbols-outlined text-[14px]">reply</span>
                                                        </button>
                                                        <button onClick={() => { setSelectedMsg(msg); setTaskForm({ ...taskForm, title: msg.content.slice(0, 200) }); setShowTaskModal(true); }} className="rounded p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700" title="Convertir en tarea">
                                                            <span className="material-symbols-outlined text-[14px]">add_task</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                {replies.length > 0 && (
                                                    <div className="ml-11 border-l-2 border-primary/20 pl-3 space-y-1">
                                                        {replies.map(r => (
                                                            <div key={r.id} className="flex gap-2 rounded-lg p-1.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                                <div className={'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white text-[10px] font-bold ' + getAvatarColor(r.sender)}>{getInitials(r.sender)}</div>
                                                                <div>
                                                                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{r.sender}</span>
                                                                    <span className="ml-1 text-[10px] text-slate-400">{timeAgo(r.created_at)}</span>
                                                                    <p className="text-xs text-slate-600 dark:text-slate-400">{r.content}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        {/* Thread indicator */}
                        {threadParent && (
                            <div className="flex items-center gap-2 border-t border-primary/20 bg-primary/5 px-6 py-2">
                                <span className="material-symbols-outlined text-primary text-[16px]">reply</span>
                                <p className="flex-1 text-xs text-slate-600 dark:text-slate-400 truncate">
                                    Respondiendo a: <strong>{threadParent.sender}</strong> &mdash; {threadParent.content.slice(0, 60)}
                                </p>
                                <button onClick={() => setThreadParent(null)} className="text-slate-400">
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>
                            </div>
                        )}

                        {/* Input */}
                        <form onSubmit={sendMessage} className="border-t border-slate-200 px-6 py-3 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <input value={input} onChange={e => setInput(e.target.value)}
                                    placeholder={'Escribe en #' + currentSpace.name + '...'}
                                    className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                                <button type="submit" className="flex items-center justify-center rounded-lg bg-primary p-2.5 text-white">
                                    <span className="material-symbols-outlined text-[18px]">send</span>
                                </button>
                            </div>
                            <p className="mt-1 text-[10px] text-slate-400">
                                Tip: <code className="bg-slate-100 px-1 rounded dark:bg-slate-700">/tarea @Joel verificar bomba para el jueves</code> crea tarea
                            </p>
                        </form>
                    </>
                )}
            </div>

            {/* Task creation modal */}
            {showTaskModal && selectedMsg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <form onSubmit={createTaskFromMessage} className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Convertir en Tarea</h3>
                        <div className="mb-3 rounded-lg bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            <span className="font-bold">{selectedMsg.sender}:</span> {selectedMsg.content.slice(0, 200)}
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className={labelClass}>Titulo de la Tarea</label>
                                <input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} required className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Responsable *</label>
                                <select value={taskForm.assigned_to} onChange={e => setTaskForm({ ...taskForm, assigned_to: e.target.value })} required className={inputClass}>
                                    <option value="">Seleccionar...</option>
                                    {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Prioridad</label>
                                    <select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value as TaskPriority })} className={inputClass}>
                                        {(['low', 'normal', 'high', 'urgent'] as TaskPriority[]).map(p => <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Fecha Limite</label>
                                    <input type="date" value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} className={inputClass} />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Proyecto Vinculado</label>
                                <select value={taskForm.project_id} onChange={e => setTaskForm({ ...taskForm, project_id: e.target.value })} className={inputClass}>
                                    <option value="">Ninguno</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} - {p.title}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <button type="submit" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">Crear Tarea</button>
                            <button type="button" onClick={() => { setShowTaskModal(false); setSelectedMsg(null); }} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500">Cancelar</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
