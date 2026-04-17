import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    TeamTask, TaskStatus, TaskPriority,
    TASK_STATUS_LABELS, TASK_STATUS_COLORS,
    TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS, TASK_PRIORITY_ICONS,
    getInitials, getAvatarColor,
} from '../../types/teams';

type ViewMode = 'kanban' | 'my_day' | 'manager';
const CURRENT_USER = 'Director';

export default function TeamBoard() {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<TeamTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<ViewMode>('kanban');
    const [filterUser, setFilterUser] = useState<string>('');
    const [showForm, setShowForm] = useState(false);
    const [projects, setProjects] = useState<{ id: string; project_number: string; title: string }[]>([]);
    const [teamMembers, setTeamMembers] = useState<string[]>([]);

    const [form, setForm] = useState({ title: '', description: '', assigned_to: '', priority: 'normal' as TaskPriority, due_date: '', project_id: '' });

    const fetchAll = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('team_tasks').select('*, project:projects(id, project_number, title)').order('due_date', { ascending: true });
        if (filterUser) q = q.eq('assigned_to', filterUser);
        const [tRes, pRes, usersRes] = await Promise.all([
            q, 
            supabase.from('projects').select('id, project_number, title').order('project_number', { ascending: false }),
            supabase.from('app_users').select('full_name').eq('is_active', true).order('full_name')
        ]);
        setTasks((tRes.data as TeamTask[]) || []);
        setProjects(pRes.data || []);
        if (usersRes.data) {
            setTeamMembers(usersRes.data.map(u => u.full_name).filter(Boolean));
        } else {
            setTeamMembers([]);
        }
        setLoading(false);
    }, [filterUser]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from('team_tasks').insert({
            title: form.title, description: form.description || null, assigned_to: form.assigned_to,
            created_by: CURRENT_USER, priority: form.priority, due_date: form.due_date || null,
            project_id: form.project_id || null,
        });
        setShowForm(false);
        setForm({ title: '', description: '', assigned_to: '', priority: 'normal', due_date: '', project_id: '' });
        fetchAll();
    };

    const updateStatus = async (id: string, status: TaskStatus) => {
        const updates: Record<string, unknown> = { status };
        if (status === 'completed') {
            updates.completed_at = new Date().toISOString();
            // → M8→M3: Register task completion in project's Field Logs timeline
            const task = tasks.find(t => t.id === id);
            if (task && task.project_id) {
                await supabase.from('field_logs').insert({
                    project_id: task.project_id,
                    author: task.assigned_to || CURRENT_USER,
                    summary: `✅ Tarea completada: ${task.title}`,
                    activities_done: `Sincronización automática M8→M3: Tarea del Team Board marcada como completada.`
                });
            }
        }
        await supabase.from('team_tasks').update(updates).eq('id', id);
        fetchAll();
    };

    const today = new Date().toISOString().split('T')[0];
    const columns: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'completed'];
    const columnIcons: Record<TaskStatus, string> = { pending: 'schedule', in_progress: 'play_circle', blocked: 'block', completed: 'check_circle' };

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    const TaskCard = ({ t }: { t: TeamTask }) => {
        const overdue = t.due_date && t.due_date < today && t.status !== 'completed';
        return (
            <div className={`rounded-lg border p-3 transition-all hover:shadow-sm ${overdue ? 'border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-900/10' : 'border-slate-200/60 bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/50'}`}>
                <div className="flex items-start justify-between mb-1">
                    <span className={`material-symbols-outlined text-[14px] ${TASK_PRIORITY_COLORS[t.priority]}`} title={TASK_PRIORITY_LABELS[t.priority]}>{TASK_PRIORITY_ICONS[t.priority]}</span>
                    <div className="flex gap-1">
                        {t.status !== 'completed' && <button onClick={() => updateStatus(t.id, t.status === 'pending' ? 'in_progress' : 'completed')} className="rounded p-0.5 text-slate-400 hover:text-emerald-500"><span className="material-symbols-outlined text-[14px]">{t.status === 'pending' ? 'play_arrow' : 'check'}</span></button>}
                        {t.status !== 'blocked' && t.status !== 'completed' && <button onClick={() => updateStatus(t.id, 'blocked')} className="rounded p-0.5 text-slate-400 hover:text-red-500"><span className="material-symbols-outlined text-[14px]">block</span></button>}
                    </div>
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-white leading-snug">{t.title}</p>
                <div className="mt-2 flex items-center gap-2">
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full text-white text-[8px] font-bold ${getAvatarColor(t.assigned_to)}`}>{getInitials(t.assigned_to)}</div>
                    <span className="text-[10px] text-slate-400">{t.assigned_to}</span>
                    {t.due_date && <span className={`ml-auto text-[10px] font-bold ${overdue ? 'text-red-500' : 'text-slate-400'}`}>{new Date(t.due_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>}
                </div>
                {t.project && <div className="mt-1"><span className="text-[10px] text-primary font-mono">{t.project.project_number}</span></div>}
                {t.source_message_id && <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-violet-500"><span className="material-symbols-outlined text-[10px]">chat</span>Desde chat</span>}
            </div>
        );
    };

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/team')} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><span className="material-symbols-outlined text-[20px]">arrow_back</span></button>
                    <div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Board de Tareas</h2>
                        <p className="text-sm text-slate-500">{tasks.filter(t => t.status !== 'completed').length} pendientes · {tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'completed').length} vencidas</p>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    {/* View toggle */}
                    <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                        {([
                            { key: 'kanban', icon: 'view_kanban', label: 'Kanban' },
                            { key: 'my_day', icon: 'today', label: 'Mi Día' },
                            { key: 'manager', icon: 'supervisor_account', label: 'Manager' },
                        ] as const).map(v => (
                            <button key={v.key} onClick={() => setView(v.key)} className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${view === v.key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>
                                <span className="material-symbols-outlined text-[14px]">{v.icon}</span>{v.label}
                            </button>
                        ))}
                    </div>
                    <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        <option value="">Todos</option>{teamMembers.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">
                        <span className="material-symbols-outlined text-[16px]">add</span>Nueva Tarea
                    </button>
                </div>
            </div>

            {/* Task form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="rounded-xl border border-primary/20 bg-primary/5 p-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="md:col-span-2"><label className={labelClass}>Tarea *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Verificar bomba pozo Limonera..." className={inputClass} /></div>
                        <div><label className={labelClass}>Responsable *</label><select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} required className={inputClass}><option value="">Seleccionar</option>{teamMembers.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                        <div><label className={labelClass}>Prioridad</label><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as TaskPriority })} className={inputClass}>{(['low', 'normal', 'high', 'urgent'] as TaskPriority[]).map(p => <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>)}</select></div>
                        <div><label className={labelClass}>Fecha Límite</label><input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>Proyecto</label><select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className={inputClass}><option value="">Ninguno</option>{projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>)}</select></div>
                    </div>
                    <div className="mt-4 flex gap-2"><button type="submit" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">Crear Tarea</button><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500">Cancelar</button></div>
                </form>
            )}

            {loading ? <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div> : (
                <>
                    {/* KANBAN VIEW */}
                    {view === 'kanban' && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {columns.map(col => {
                                const colTasks = tasks.filter(t => t.status === col);
                                return (
                                    <div key={col} className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3 dark:border-slate-800/60 dark:bg-slate-900/30">
                                        <div className="mb-3 flex items-center gap-2">
                                            <span className={`material-symbols-outlined text-[16px] ${TASK_STATUS_COLORS[col].text}`}>{columnIcons[col]}</span>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{TASK_STATUS_LABELS[col]}</span>
                                            <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-400">{colTasks.length}</span>
                                        </div>
                                        <div className="space-y-2">{colTasks.map(t => <TaskCard key={t.id} t={t} />)}</div>
                                        {colTasks.length === 0 && <p className="py-6 text-center text-[10px] text-slate-400">Vacío</p>}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* MY DAY VIEW */}
                    {view === 'my_day' && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-slate-200/60 bg-white/50 p-4 dark:border-slate-800/60 dark:bg-slate-900/50">
                                <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Mi Día — {filterUser || CURRENT_USER}</h3>
                                {(() => {
                                    const user = filterUser || CURRENT_USER;
                                    const myTasks = tasks.filter(t => t.assigned_to === user && t.status !== 'completed');
                                    const overdueTasks = myTasks.filter(t => t.due_date && t.due_date < today).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
                                    const todayTasks = myTasks.filter(t => t.due_date === today);
                                    const upcomingTasks = myTasks.filter(t => !t.due_date || t.due_date > today).sort((a, b) => (a.due_date || 'z').localeCompare(b.due_date || 'z'));
                                    return (
                                        <div className="space-y-4">
                                            {overdueTasks.length > 0 && (
                                                <div>
                                                    <p className="mb-2 text-xs font-bold text-red-500 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">warning</span>Vencidas ({overdueTasks.length})</p>
                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{overdueTasks.map(t => <TaskCard key={t.id} t={t} />)}</div>
                                                </div>
                                            )}
                                            {todayTasks.length > 0 && (
                                                <div>
                                                    <p className="mb-2 text-xs font-bold text-primary flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">today</span>Hoy ({todayTasks.length})</p>
                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{todayTasks.map(t => <TaskCard key={t.id} t={t} />)}</div>
                                                </div>
                                            )}
                                            {upcomingTasks.length > 0 && (
                                                <div>
                                                    <p className="mb-2 text-xs font-bold text-slate-500 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">schedule</span>Próximas ({upcomingTasks.length})</p>
                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{upcomingTasks.map(t => <TaskCard key={t.id} t={t} />)}</div>
                                                </div>
                                            )}
                                            {myTasks.length === 0 && <p className="py-6 text-center text-sm text-slate-400">🎉 Sin tareas pendientes</p>}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* MANAGER VIEW */}
                    {view === 'manager' && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                                <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-violet-500 text-[18px]">supervisor_account</span>¿Dónde está el equipo?
                                </h3>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                                    {teamMembers.map(member => {
                                        const memberTasks = tasks.filter(t => t.assigned_to === member);
                                        const pending = memberTasks.filter(t => t.status !== 'completed').length;
                                        const completed = memberTasks.filter(t => t.status === 'completed').length;
                                        const overdue = memberTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'completed').length;
                                        const blocked = memberTasks.filter(t => t.status === 'blocked').length;
                                        return (
                                            <div key={member} onClick={() => { setFilterUser(member); setView('my_day'); }}
                                                className={`cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md ${overdue > 0 ? 'border-red-200 bg-red-50/30 dark:border-red-900' : 'border-slate-200/60 bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/50'}`}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold ${getAvatarColor(member)}`}>{getInitials(member)}</div>
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{member}</span>
                                                </div>
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between"><span className="text-slate-500">Pendientes</span><span className="font-bold text-slate-900 dark:text-white">{pending}</span></div>
                                                    <div className="flex justify-between"><span className="text-slate-500">Completadas</span><span className="font-bold text-emerald-500">{completed}</span></div>
                                                    {overdue > 0 && <div className="flex justify-between"><span className="text-red-500">Vencidas</span><span className="font-bold text-red-600">{overdue}</span></div>}
                                                    {blocked > 0 && <div className="flex justify-between"><span className="text-amber-500">Bloqueadas</span><span className="font-bold text-amber-600">{blocked}</span></div>}
                                                </div>
                                                <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                    <div className={`h-full rounded-full ${overdue > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${memberTasks.length > 0 ? (completed / memberTasks.length) * 100 : 0}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Full task list */}
                            <div className="rounded-xl border border-slate-200/60 bg-white/50 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold text-slate-500">Tarea</th>
                                            <th className="px-4 py-3 text-center font-semibold text-slate-500">Responsable</th>
                                            <th className="px-4 py-3 text-center font-semibold text-slate-500">Estado</th>
                                            <th className="px-4 py-3 text-center font-semibold text-slate-500">Prioridad</th>
                                            <th className="px-4 py-3 text-center font-semibold text-slate-500">Fecha</th>
                                            <th className="px-4 py-3 text-center font-semibold text-slate-500">Proyecto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {tasks.filter(t => t.status !== 'completed').map(t => {
                                            const overdue = t.due_date && t.due_date < today;
                                            return (
                                                <tr key={t.id} className={overdue ? 'bg-red-50/30 dark:bg-red-900/5' : ''}>
                                                    <td className="px-4 py-3"><p className="font-medium text-slate-900 dark:text-white text-sm">{t.title}</p>{t.source_message_id && <span className="text-[10px] text-violet-400">💬 Desde chat</span>}</td>
                                                    <td className="px-4 py-3 text-center"><div className="inline-flex items-center gap-1"><div className={`flex h-5 w-5 items-center justify-center rounded-full text-white text-[8px] font-bold ${getAvatarColor(t.assigned_to)}`}>{getInitials(t.assigned_to)}</div><span className="text-xs">{t.assigned_to}</span></div></td>
                                                    <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TASK_STATUS_COLORS[t.status].bg} ${TASK_STATUS_COLORS[t.status].text}`}>{TASK_STATUS_LABELS[t.status]}</span></td>
                                                    <td className="px-4 py-3 text-center"><span className={`material-symbols-outlined text-[14px] ${TASK_PRIORITY_COLORS[t.priority]}`}>{TASK_PRIORITY_ICONS[t.priority]}</span></td>
                                                    <td className={`px-4 py-3 text-center text-xs ${overdue ? 'text-red-500 font-bold' : 'text-slate-400'}`}>{t.due_date ? new Date(t.due_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—'}</td>
                                                    <td className="px-4 py-3 text-center text-xs text-primary font-mono">{t.project?.project_number || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
