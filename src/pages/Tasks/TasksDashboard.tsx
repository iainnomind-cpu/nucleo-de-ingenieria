import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import {
    TeamTask, TaskEvidence, TaskStatus, TaskPriority,
    TASK_STATUS_LABELS, TASK_STATUS_COLORS,
    TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS, TASK_PRIORITY_ICONS,
    getInitials, getAvatarColor,
} from '../../types/teams';

type ViewMode = 'kanban' | 'my_day' | 'manager' | 'calendar';

const RECURRENCE_LABELS: Record<string, string> = {
    daily: 'Diaria',
    weekdays: 'Días hábiles',
    weekly: 'Semanal',
    monthly: 'Mensual',
};

function formatBytes(bytes: number, d = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024, dm = d < 0 ? 0 : d, s = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${s[i]}`;
}

/** Generate all occurrence dates from startDate up to endDate for the given recurrence type */
function generateOccurrences(startDate: string, endDate: string, recurrence: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    let current = new Date(start);

    while (current <= end) {
        const iso = current.toISOString().split('T')[0];
        if (recurrence === 'weekdays') {
            const dow = current.getDay();
            if (dow !== 0 && dow !== 6) dates.push(iso);
        } else {
            dates.push(iso);
        }

        if (recurrence === 'daily' || recurrence === 'weekdays') {
            current.setDate(current.getDate() + 1);
        } else if (recurrence === 'weekly') {
            current.setDate(current.getDate() + 7);
        } else if (recurrence === 'monthly') {
            current.setMonth(current.getMonth() + 1);
        } else break;

        if (dates.length > 500) break; // safety cap
    }
    return dates;
}

export default function TasksDashboard() {
    const { user, hasPermission } = useAuth();
    const CURRENT_USER = user?.full_name || 'Director';
    const canAssignOthers = hasPermission('tasks', 'create');

    const [tasks, setTasks] = useState<TeamTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<ViewMode>('kanban');
    const [filterUser, setFilterUser] = useState<string>('');
    const [filterPriority, setFilterPriority] = useState<string>('');
    const [showForm, setShowForm] = useState(false);
    const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
    const [projects, setProjects] = useState<{ id: string; project_number: string; title: string }[]>([]);
    const [teamMembers, setTeamMembers] = useState<string[]>([]);
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    // Evidence modal
    const [evidenceTask, setEvidenceTask] = useState<TeamTask | null>(null);
    const [evidences, setEvidences] = useState<TaskEvidence[]>([]);
    const [uploadingEvidence, setUploadingEvidence] = useState(false);
    const [evidenceNote, setEvidenceNote] = useState('');

    const [form, setForm] = useState({
        title: '', description: '', assigned_to: '', priority: 'normal' as TaskPriority,
        due_date: '', project_id: '', tags: '',
        recurrence: '' as '' | 'daily' | 'weekdays' | 'weekly' | 'monthly',
        recurrence_end_date: '',
    });

    const fetchAll = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('team_tasks').select('*, project:projects(id, project_number, title)').order('due_date', { ascending: true });
        if (!canAssignOthers && !filterUser) {
            q = q.eq('assigned_to', CURRENT_USER);
        } else if (filterUser) {
            q = q.eq('assigned_to', filterUser);
        }
        if (filterPriority) q = q.eq('priority', filterPriority);
        const [tRes, pRes, usersRes] = await Promise.all([
            q,
            supabase.from('projects').select('id, project_number, title').order('project_number', { ascending: false }),
            supabase.from('app_users').select('full_name').eq('is_active', true).order('full_name')
        ]);
        setTasks((tRes.data as TeamTask[]) || []);
        setProjects(pRes.data || []);
        if (usersRes.data) setTeamMembers(usersRes.data.map((u: { full_name: string }) => u.full_name).filter(Boolean));
        else setTeamMembers([]);
        setLoading(false);
    }, [filterUser, filterPriority, canAssignOthers, CURRENT_USER]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const assignedTo = canAssignOthers ? form.assigned_to : CURRENT_USER;

        const basePayload = {
            title: form.title,
            description: form.description || null,
            assigned_to: assignedTo,
            created_by: CURRENT_USER,
            priority: form.priority,
            due_date: form.due_date || null,
            project_id: form.project_id || null,
            tags: form.tags ? form.tags.split(',').map(t => t.trim()) : null,
            recurrence: form.recurrence || null,
            recurrence_end_date: form.recurrence_end_date || null,
        };

        if (editingTask) {
            await supabase.from('team_tasks').update(basePayload).eq('id', editingTask.id);
        } else if (form.recurrence && form.recurrence_end_date && form.due_date) {
            // Generate all recurring instances
            const dates = generateOccurrences(form.due_date, form.recurrence_end_date, form.recurrence);
            if (dates.length === 0) {
                alert('No se generaron instancias. Verifica las fechas.');
                return;
            }
            // Insert parent (first date)
            const { data: parent, error: parentErr } = await supabase.from('team_tasks').insert({
                ...basePayload,
                due_date: dates[0],
            }).select().single();
            if (parentErr || !parent) { alert('Error al crear la tarea: ' + parentErr?.message); return; }

            // Insert children
            if (dates.length > 1) {
                await supabase.from('team_tasks').insert(
                    dates.slice(1).map(date => ({
                        ...basePayload,
                        due_date: date,
                        parent_recurring_task_id: parent.id,
                    }))
                );
            }
        } else {
            await supabase.from('team_tasks').insert(basePayload);
        }

        setShowForm(false);
        setEditingTask(null);
        setForm({ title: '', description: '', assigned_to: '', priority: 'normal', due_date: '', project_id: '', tags: '', recurrence: '', recurrence_end_date: '' });
        fetchAll();
    };

    const startEdit = (t: TeamTask) => {
        setEditingTask(t);
        setForm({
            title: t.title,
            description: t.description || '',
            assigned_to: t.assigned_to,
            priority: t.priority,
            due_date: t.due_date || '',
            project_id: t.project_id || '',
            tags: t.tags?.join(', ') || '',
            recurrence: (t.recurrence as typeof form.recurrence) || '',
            recurrence_end_date: t.recurrence_end_date || '',
        });
        setShowForm(true);
    };

    const deleteTask = async (id: string) => {
        if (!confirm('¿Eliminar esta tarea permanentemente?')) return;
        await supabase.from('team_tasks').delete().eq('id', id);
        fetchAll();
    };

    const updateStatus = async (id: string, status: TaskStatus) => {
        const updates: Record<string, unknown> = { status };
        if (status === 'completed') {
            updates.completed_at = new Date().toISOString();
            const task = tasks.find(t => t.id === id);
            if (task?.project_id) {
                await supabase.from('field_logs').insert({
                    project_id: task.project_id,
                    author: task.assigned_to || CURRENT_USER,
                    summary: `✅ Tarea completada: ${task.title}`,
                    activities_done: `Sincronización automática: Tarea del Tablero marcada como completada.`
                });
            }
        }
        await supabase.from('team_tasks').update(updates).eq('id', id);
        fetchAll();
    };

    // ── Evidence management ──
    const openEvidenceModal = async (t: TeamTask) => {
        setEvidenceTask(t);
        setEvidenceNote('');
        const { data } = await supabase.from('task_evidences').select('*').eq('task_id', t.id).order('created_at', { ascending: false });
        setEvidences((data as TaskEvidence[]) || []);
    };

    const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0] || !evidenceTask || !user) return;
        const file = e.target.files[0];
        setUploadingEvidence(true);
        try {
            const ext = file.name.split('.').pop();
            const path = `tasks/${evidenceTask.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const { error: upErr } = await supabase.storage.from('task-evidences').upload(path, file);
            if (upErr) throw upErr;
            const { data: { publicUrl } } = supabase.storage.from('task-evidences').getPublicUrl(path);
            await supabase.from('task_evidences').insert({
                task_id: evidenceTask.id,
                file_name: file.name,
                file_url: publicUrl,
                file_type: file.type,
                file_size_bytes: file.size,
                uploaded_by: CURRENT_USER,
                notes: evidenceNote || null,
            });
            const { data } = await supabase.from('task_evidences').select('*').eq('task_id', evidenceTask.id).order('created_at', { ascending: false });
            setEvidences((data as TaskEvidence[]) || []);
            setEvidenceNote('');
        } catch (err: unknown) {
            alert('Error al subir evidencia: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setUploadingEvidence(false);
            if (e.target) e.target.value = '';
        }
    };

    const deleteEvidence = async (ev: TaskEvidence) => {
        if (!confirm('¿Eliminar esta evidencia?')) return;
        await supabase.from('task_evidences').delete().eq('id', ev.id);
        const urlParts = ev.file_url.split('/task-evidences/');
        if (urlParts.length > 1) await supabase.storage.from('task-evidences').remove([urlParts[1]]);
        setEvidences(prev => prev.filter(e => e.id !== ev.id));
    };

    const today = new Date().toISOString().split('T')[0];
    const columns: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'completed'];
    const columnIcons: Record<TaskStatus, string> = { pending: 'schedule', in_progress: 'play_circle', blocked: 'block', completed: 'check_circle' };

    const pendingCount = tasks.filter(t => t.status !== 'completed').length;
    const overdueCount = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'completed').length;
    const completedThisWeek = tasks.filter(t => {
        if (t.status !== 'completed' || !t.completed_at) return false;
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(t.completed_at) >= weekAgo;
    }).length;

    const calendarDays = useMemo(() => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];
        const prevMonthDays = new Date(year, month, 0).getDate();
        for (let i = firstDay - 1; i >= 0; i--) {
            const d = prevMonthDays - i;
            const prevMonth = month === 0 ? 11 : month - 1;
            const prevYear = month === 0 ? year - 1 : year;
            days.push({ date: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            days.push({ date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: true });
        }
        const remaining = 42 - days.length;
        for (let d = 1; d <= remaining; d++) {
            const nextMonth = month === 11 ? 0 : month + 1;
            const nextYear = month === 11 ? year + 1 : year;
            days.push({ date: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false });
        }
        return days;
    }, [calendarMonth]);

    const tasksByDate = useMemo(() => {
        const map: Record<string, TeamTask[]> = {};
        tasks.forEach(t => {
            if (t.due_date) {
                if (!map[t.due_date]) map[t.due_date] = [];
                map[t.due_date].push(t);
            }
        });
        return map;
    }, [tasks]);

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    const TaskCard = ({ t }: { t: TeamTask }) => {
        const overdue = t.due_date && t.due_date < today && t.status !== 'completed';
        return (
            <div className={`group rounded-lg border p-3 transition-all hover:shadow-md ${overdue ? 'border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-900/10' : 'border-slate-200/60 bg-white/80 dark:border-slate-700/60 dark:bg-slate-900/60'}`}>
                <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-1">
                        <span className={`material-symbols-outlined text-[14px] ${TASK_PRIORITY_COLORS[t.priority]}`} title={TASK_PRIORITY_LABELS[t.priority]}>{TASK_PRIORITY_ICONS[t.priority]}</span>
                        {t.recurrence && (
                            <span className="text-[9px] font-bold text-violet-500 bg-violet-100 dark:bg-violet-900/30 px-1 rounded" title={`Recurrente: ${RECURRENCE_LABELS[t.recurrence]}`}>
                                🔁 {RECURRENCE_LABELS[t.recurrence]}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {t.status !== 'completed' && (
                            <button onClick={() => updateStatus(t.id, t.status === 'pending' ? 'in_progress' : 'completed')} className="rounded p-0.5 text-slate-400 hover:text-emerald-500" title={t.status === 'pending' ? 'Iniciar' : 'Completar'}>
                                <span className="material-symbols-outlined text-[14px]">{t.status === 'pending' ? 'play_arrow' : 'check'}</span>
                            </button>
                        )}
                        {t.status !== 'blocked' && t.status !== 'completed' && (
                            <button onClick={() => updateStatus(t.id, 'blocked')} className="rounded p-0.5 text-slate-400 hover:text-red-500" title="Bloquear">
                                <span className="material-symbols-outlined text-[14px]">block</span>
                            </button>
                        )}
                        {t.status === 'blocked' && (
                            <button onClick={() => updateStatus(t.id, 'pending')} className="rounded p-0.5 text-slate-400 hover:text-sky-500" title="Desbloquear">
                                <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                            </button>
                        )}
                        <button onClick={() => openEvidenceModal(t)} className="rounded p-0.5 text-slate-400 hover:text-amber-500" title="Evidencias">
                            <span className="material-symbols-outlined text-[14px]">attach_file</span>
                        </button>
                        <button onClick={() => startEdit(t)} className="rounded p-0.5 text-slate-400 hover:text-primary" title="Editar">
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                        <button onClick={() => deleteTask(t.id)} className="rounded p-0.5 text-slate-400 hover:text-red-500" title="Eliminar">
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                    </div>
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-white leading-snug">{t.title}</p>
                {t.description && <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{t.description}</p>}
                <div className="mt-2 flex items-center gap-2">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-white text-[9px] font-bold ${getAvatarColor(t.assigned_to)}`}>{getInitials(t.assigned_to)}</div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{t.assigned_to}</span>
                    {t.due_date && <span className={`ml-auto text-[10px] font-bold ${overdue ? 'text-red-500' : 'text-slate-400'}`}>{new Date(t.due_date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>}
                </div>
                {t.project && <div className="mt-1"><span className="text-[10px] text-primary font-mono">{t.project.project_number}</span></div>}
                {t.tags && t.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {t.tags.map((tag, i) => <span key={i} className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">{tag}</span>)}
                    </div>
                )}
                {t.source_message_id && <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-violet-500"><span className="material-symbols-outlined text-[10px]">chat</span>Desde chat</span>}
            </div>
        );
    };

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                        Tablero de Tareas
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">Gestiona y da seguimiento a las tareas de todo el equipo.</p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                        {([
                            { key: 'kanban', icon: 'view_kanban', label: 'Kanban' },
                            { key: 'my_day', icon: 'today', label: 'Mi Día' },
                            { key: 'calendar', icon: 'calendar_month', label: 'Calendario' },
                            ...(canAssignOthers ? [{ key: 'manager' as const, icon: 'supervisor_account', label: 'Manager' }] : []),
                        ] as const).map(v => (
                            <button key={v.key} onClick={() => setView(v.key as ViewMode)} className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${view === v.key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                <span className="material-symbols-outlined text-[14px]">{v.icon}</span>{v.label}
                            </button>
                        ))}
                    </div>
                    {canAssignOthers && (
                        <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                            <option value="">Todos</option>{teamMembers.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    )}
                    <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        <option value="">Prioridad</option>
                        {(['low', 'normal', 'high', 'urgent'] as TaskPriority[]).map(p => <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>)}
                    </select>
                    <button onClick={() => { setShowForm(!showForm); setEditingTask(null); setForm({ title: '', description: '', assigned_to: '', priority: 'normal', due_date: '', project_id: '', tags: '', recurrence: '', recurrence_end_date: '' }); }}
                        className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-xs font-semibold text-white shadow-md shadow-primary/20 hover:shadow-lg transition-all">
                        <span className="material-symbols-outlined text-[16px]">add</span>Nueva Tarea
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 text-slate-400 mb-1"><span className="material-symbols-outlined text-[18px]">pending_actions</span><span className="text-xs font-semibold uppercase">Pendientes</span></div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{pendingCount}</p>
                </div>
                <div className={`rounded-xl border p-4 shadow-sm backdrop-blur-xl ${overdueCount > 0 ? 'border-red-200/60 bg-red-50/70 dark:border-red-900/60 dark:bg-red-900/20' : 'border-slate-200/60 bg-white/70 dark:border-slate-800/60 dark:bg-slate-900/50'}`}>
                    <div className="flex items-center gap-2 text-red-400 mb-1"><span className="material-symbols-outlined text-[18px]">warning</span><span className="text-xs font-semibold uppercase">Vencidas</span></div>
                    <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>{overdueCount}</p>
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 text-emerald-400 mb-1"><span className="material-symbols-outlined text-[18px]">check_circle</span><span className="text-xs font-semibold uppercase">Completadas (7d)</span></div>
                    <p className="text-2xl font-bold text-emerald-600">{completedThisWeek}</p>
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2 text-primary mb-1"><span className="material-symbols-outlined text-[18px]">groups</span><span className="text-xs font-semibold uppercase">Total</span></div>
                    <p className="text-2xl font-bold text-primary">{tasks.length}</p>
                </div>
            </div>

            {/* Task form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 dark:from-primary/5 dark:to-primary/10">
                    <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">{editingTask ? 'edit' : 'add_task'}</span>
                        {editingTask ? 'Editar Tarea' : 'Nueva Tarea'}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="md:col-span-2">
                            <label className={labelClass}>Tarea *</label>
                            <input list="common-tasks" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Verificar bomba pozo Limonera..." className={inputClass} />
                            <datalist id="common-tasks">
                                <option value="Recarga o servicio de extintores" />
                                <option value="Mantenimiento preventivo" />
                                <option value="Revisión de equipos" />
                                <option value="Visita de inspección" />
                                <option value="Resolución de falla" />
                            </datalist>
                        </div>
                        <div><label className={labelClass}>Responsable *</label>
                            {canAssignOthers ? (
                                <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} required className={inputClass}>
                                    <option value="">Seleccionar</option>{teamMembers.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <input value={CURRENT_USER} disabled className={inputClass + ' bg-slate-100 dark:bg-slate-700 cursor-not-allowed'} />
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">Solo tú</span>
                                </div>
                            )}
                        </div>
                        <div><label className={labelClass}>Prioridad</label><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as TaskPriority })} className={inputClass}>{(['low', 'normal', 'high', 'urgent'] as TaskPriority[]).map(p => <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>)}</select></div>
                        <div><label className={labelClass}>Fecha Inicio / Primera Ocurrencia</label><input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className={inputClass} /></div>
                        
                        {/* Recurrence */}
                        <div>
                            <label className={labelClass}>Repetición 🔁</label>
                            <select value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value as typeof form.recurrence })} className={inputClass}>
                                <option value="">Sin repetición</option>
                                <option value="daily">Diaria</option>
                                <option value="weekdays">Días hábiles (L-V)</option>
                                <option value="weekly">Semanal</option>
                                <option value="monthly">Mensual</option>
                            </select>
                        </div>

                        {form.recurrence && (
                            <div>
                                <label className={labelClass}>Repetir hasta</label>
                                <input type="date" value={form.recurrence_end_date} onChange={e => setForm({ ...form, recurrence_end_date: e.target.value })} required className={inputClass} min={form.due_date} />
                                {form.due_date && form.recurrence_end_date && (
                                    <p className="mt-1 text-[10px] text-primary font-semibold">
                                        ≈ {generateOccurrences(form.due_date, form.recurrence_end_date, form.recurrence).length} instancias a crear
                                    </p>
                                )}
                            </div>
                        )}

                        <div><label className={labelClass}>Proyecto</label><select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })} className={inputClass}><option value="">Ninguno</option>{projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>)}</select></div>
                        <div><label className={labelClass}>Etiquetas</label><input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="facturación, campo..." className={inputClass} /></div>
                        <div className="md:col-span-4"><label className={labelClass}>Descripción</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Instrucciones detalladas..." className={inputClass + ' resize-none'} /></div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button type="submit" className="rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-sm">{editingTask ? 'Guardar Cambios' : form.recurrence ? 'Crear Serie de Tareas' : 'Crear Tarea'}</button>
                        <button type="button" onClick={() => { setShowForm(false); setEditingTask(null); }} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Cancelar</button>
                    </div>
                </form>
            )}

            {loading ? <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div> : (
                <>
                    {/* ═══ KANBAN VIEW ═══ */}
                    {view === 'kanban' && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {columns.map(col => {
                                const colTasks = tasks.filter(t => t.status === col);
                                return (
                                    <div key={col} className="rounded-xl border border-slate-200/60 bg-slate-50/50 dark:border-slate-800/60 dark:bg-slate-900/30 flex flex-col min-h-[300px]">
                                        <div className="flex items-center gap-2 p-3 border-b border-slate-200/40 dark:border-slate-700/40">
                                            <span className={`material-symbols-outlined text-[16px] ${TASK_STATUS_COLORS[col].text}`}>{columnIcons[col]}</span>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{TASK_STATUS_LABELS[col]}</span>
                                            <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-400">{colTasks.length}</span>
                                        </div>
                                        <div className="flex-1 space-y-2 p-3 overflow-y-auto">
                                            {colTasks.map(t => <TaskCard key={t.id} t={t} />)}
                                            {colTasks.length === 0 && <p className="py-8 text-center text-[11px] text-slate-400">Sin tareas</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ═══ MY DAY VIEW ═══ */}
                    {view === 'my_day' && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-slate-200/60 bg-white/50 p-5 dark:border-slate-800/60 dark:bg-slate-900/50">
                                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                    <span className="material-symbols-outlined text-primary text-[18px]">today</span>
                                    Mi Día — {filterUser || CURRENT_USER}
                                </h3>
                                {(() => {
                                    const userName = filterUser || CURRENT_USER;
                                    const myTasks = tasks.filter(t => t.assigned_to === userName && t.status !== 'completed');
                                    const overdueTasks = myTasks.filter(t => t.due_date && t.due_date < today).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
                                    const todayTasks = myTasks.filter(t => t.due_date === today);
                                    const upcomingTasks = myTasks.filter(t => !t.due_date || t.due_date > today).sort((a, b) => (a.due_date || 'z').localeCompare(b.due_date || 'z'));
                                    return (
                                        <div className="space-y-5">
                                            {overdueTasks.length > 0 && (
                                                <div>
                                                    <p className="mb-2 text-xs font-bold text-red-500 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">warning</span>Vencidas ({overdueTasks.length})</p>
                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{overdueTasks.map(t => <TaskCard key={t.id} t={t} />)}</div>
                                                </div>
                                            )}
                                            {todayTasks.length > 0 && (
                                                <div>
                                                    <p className="mb-2 text-xs font-bold text-primary flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">today</span>Hoy ({todayTasks.length})</p>
                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{todayTasks.map(t => <TaskCard key={t.id} t={t} />)}</div>
                                                </div>
                                            )}
                                            {upcomingTasks.length > 0 && (
                                                <div>
                                                    <p className="mb-2 text-xs font-bold text-slate-500 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">schedule</span>Próximas ({upcomingTasks.length})</p>
                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{upcomingTasks.map(t => <TaskCard key={t.id} t={t} />)}</div>
                                                </div>
                                            )}
                                            {myTasks.length === 0 && <p className="py-8 text-center text-sm text-slate-400">🎉 Sin tareas pendientes</p>}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* ═══ CALENDAR VIEW ═══ */}
                    {view === 'calendar' && (
                        <div className="rounded-xl border border-slate-200/60 bg-white/50 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                            <div className="flex items-center justify-between border-b border-slate-200/40 px-6 py-4 dark:border-slate-700/40">
                                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                                </button>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">{monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</h3>
                                <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                                </button>
                            </div>
                            <div className="grid grid-cols-7 border-b border-slate-200/40 dark:border-slate-700/40">
                                {dayNames.map(d => (
                                    <div key={d} className="py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7">
                                {calendarDays.map((day, idx) => {
                                    const dayTasks = tasksByDate[day.date] || [];
                                    const isToday = day.date === today;
                                    const hasOverdue = dayTasks.some(t => t.status !== 'completed' && day.date < today);
                                    return (
                                        <div key={idx} className={`min-h-[100px] border-b border-r border-slate-100 p-1.5 dark:border-slate-800/60 transition-colors ${!day.isCurrentMonth ? 'bg-slate-50/30 dark:bg-slate-900/20' : ''} ${isToday ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                                            <div className={`mb-1 text-right text-xs font-bold ${!day.isCurrentMonth ? 'text-slate-300 dark:text-slate-600' : isToday ? 'text-primary' : 'text-slate-600 dark:text-slate-400'} ${hasOverdue ? 'text-red-500' : ''}`}>
                                                {isToday && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}
                                                {day.day}
                                            </div>
                                            <div className="space-y-0.5">
                                                {dayTasks.slice(0, 3).map(t => (
                                                    <div key={t.id}
                                                        onClick={() => openEvidenceModal(t)}
                                                        className={`cursor-pointer truncate rounded px-1 py-0.5 text-[10px] font-medium transition-colors hover:opacity-80 ${t.status === 'completed' ? 'bg-emerald-100 text-emerald-700 line-through dark:bg-emerald-900/30 dark:text-emerald-400' : t.status === 'blocked' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'}`}
                                                        title={`${t.title} — ${t.assigned_to}`}>
                                                        {t.recurrence && '🔁 '}{t.title}
                                                    </div>
                                                ))}
                                                {dayTasks.length > 3 && <p className="text-[9px] text-slate-400 text-center">+{dayTasks.length - 3} más</p>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ═══ MANAGER VIEW ═══ */}
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
                                            <th className="px-4 py-3 text-center font-semibold text-slate-500">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {tasks.filter(t => t.status !== 'completed').map(t => {
                                            const overdue = t.due_date && t.due_date < today;
                                            return (
                                                <tr key={t.id} className={`transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${overdue ? 'bg-red-50/30 dark:bg-red-900/5' : ''}`}>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-slate-900 dark:text-white text-sm">{t.recurrence && <span className="mr-1 text-violet-500">🔁</span>}{t.title}</p>
                                                        {t.description && <p className="text-[10px] text-slate-400 line-clamp-1">{t.description}</p>}
                                                    </td>
                                                    <td className="px-4 py-3 text-center"><div className="inline-flex items-center gap-1"><div className={`flex h-5 w-5 items-center justify-center rounded-full text-white text-[8px] font-bold ${getAvatarColor(t.assigned_to)}`}>{getInitials(t.assigned_to)}</div><span className="text-xs">{t.assigned_to}</span></div></td>
                                                    <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TASK_STATUS_COLORS[t.status].bg} ${TASK_STATUS_COLORS[t.status].text}`}>{TASK_STATUS_LABELS[t.status]}</span></td>
                                                    <td className="px-4 py-3 text-center"><span className={`material-symbols-outlined text-[14px] ${TASK_PRIORITY_COLORS[t.priority]}`}>{TASK_PRIORITY_ICONS[t.priority]}</span></td>
                                                    <td className={`px-4 py-3 text-center text-xs ${overdue ? 'text-red-500 font-bold' : 'text-slate-400'}`}>{t.due_date ? new Date(t.due_date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—'}</td>
                                                    <td className="px-4 py-3 text-center text-xs text-primary font-mono">{t.project?.project_number || '—'}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={() => openEvidenceModal(t)} className="rounded p-1 text-slate-400 hover:text-amber-500" title="Evidencias"><span className="material-symbols-outlined text-[16px]">attach_file</span></button>
                                                            <button onClick={() => startEdit(t)} className="rounded p-1 text-slate-400 hover:text-primary"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                                                            <button onClick={() => deleteTask(t.id)} className="rounded p-1 text-slate-400 hover:text-red-500"><span className="material-symbols-outlined text-[16px]">delete</span></button>
                                                        </div>
                                                    </td>
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

            {/* ═══ EVIDENCE MODAL ═══ */}
            {evidenceTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-slate-800 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-amber-500">task</span>
                                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{evidenceTask.title}</h3>
                                    {evidenceTask.recurrence && <span className="text-[10px] font-bold text-violet-500 bg-violet-100 dark:bg-violet-900/30 px-1.5 py-0.5 rounded">🔁 {RECURRENCE_LABELS[evidenceTask.recurrence]}</span>}
                                </div>
                                <p className="text-xs text-slate-400">{evidenceTask.assigned_to} · {evidenceTask.due_date ? new Date(evidenceTask.due_date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin fecha'}</p>
                            </div>
                            <button onClick={() => setEvidenceTask(null)} className="ml-4 text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Quick status buttons */}
                        <div className="flex gap-2 px-5 pt-4">
                            {(['pending', 'in_progress', 'blocked', 'completed'] as TaskStatus[]).map(s => (
                                <button key={s} onClick={() => { updateStatus(evidenceTask.id, s); setEvidenceTask({ ...evidenceTask, status: s }); }}
                                    className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold transition-all ${evidenceTask.status === s ? `${TASK_STATUS_COLORS[s].bg} ${TASK_STATUS_COLORS[s].text}` : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 hover:opacity-80'}`}>
                                    {TASK_STATUS_LABELS[s]}
                                </button>
                            ))}
                        </div>

                        {/* Evidence list */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Evidencias ({evidences.length})</h4>
                            {evidences.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-300 dark:text-slate-600">
                                    <span className="material-symbols-outlined text-4xl mb-2">cloud_upload</span>
                                    <p className="text-sm">Aún no hay evidencias</p>
                                </div>
                            )}
                            {evidences.map(ev => (
                                <div key={ev.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-800 text-slate-400">
                                        <span className="material-symbols-outlined text-xl">
                                            {ev.file_type?.includes('image') ? 'image' : ev.file_type?.includes('pdf') ? 'picture_as_pdf' : 'description'}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{ev.file_name}</p>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                            <span>{ev.uploaded_by}</span>
                                            <span>·</span>
                                            <span>{formatBytes(ev.file_size_bytes || 0)}</span>
                                            <span>·</span>
                                            <span>{new Date(ev.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        {ev.notes && <p className="mt-1 text-[11px] text-slate-500 italic">"{ev.notes}"</p>}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <a href={ev.file_url} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700" title="Ver">
                                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                        </a>
                                        <button onClick={() => deleteEvidence(ev)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20" title="Eliminar">
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Upload area */}
                        <div className="border-t border-slate-200 p-5 dark:border-slate-700 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Subir evidencia</h4>
                            <input
                                type="text"
                                value={evidenceNote}
                                onChange={e => setEvidenceNote(e.target.value)}
                                placeholder="Nota u observación (opcional)..."
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                            <div>
                                <input type="file" id="evidence-upload" className="hidden" onChange={handleEvidenceUpload} disabled={uploadingEvidence} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />
                                <label htmlFor="evidence-upload"
                                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 text-sm font-medium transition-all ${uploadingEvidence ? 'border-slate-200 text-slate-300' : 'border-primary/30 text-primary hover:border-primary hover:bg-primary/5'}`}>
                                    {uploadingEvidence ? (
                                        <><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />Subiendo...</>
                                    ) : (
                                        <><span className="material-symbols-outlined text-[18px]">upload_file</span>Seleccionar archivo (imagen, PDF, doc...)</>
                                    )}
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
