import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { triggerWaAutomation } from '../../lib/waAutomation';
import {
    Project,
    ProjectStatus,
    PROJECT_STATUS_LABELS,
    PROJECT_STATUS_COLORS,
    PROJECT_STATUS_ICONS,
    PRIORITY_LABELS,
    PRIORITY_COLORS,
    formatCurrencyMXN,
} from '../../types/projects';

const STATUS_FLOW: ProjectStatus[] = ['pending', 'preparation', 'in_field', 'completed', 'invoiced'];

export default function ProjectsList() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);

    // Form
    const [form, setForm] = useState({ title: '', client_id: '', work_type: '', priority: 'normal', location: '', estimated_days: '1', project_manager: '', notes: '' });
    const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('projects').select('*, client:clients(id, company_name)').order('created_at', { ascending: false });
        if (filter !== 'all') q = q.eq('status', filter);
        if (search.trim()) q = q.or(`title.ilike.%${search}%,project_number.ilike.%${search}%`);
        const { data } = await q;
        setProjects((data as Project[]) || []);
        setLoading(false);
    }, [filter, search]);

    useEffect(() => { fetchProjects(); }, [fetchProjects]);
    useEffect(() => { supabase.from('clients').select('id, company_name').order('company_name').then(({ data }) => setClients(data || [])); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const year = new Date().getFullYear();
        const { count } = await supabase.from('projects').select('*', { count: 'exact', head: true });
        const projectNumber = `PRY-${year}-${String((count || 0) + 1).padStart(4, '0')}`;

        const { data: project, error } = await supabase.from('projects').insert({
            project_number: projectNumber,
            title: form.title,
            client_id: form.client_id || null,
            work_type: form.work_type || null,
            priority: form.priority,
            location: form.location || null,
            estimated_days: parseInt(form.estimated_days) || 1,
            project_manager: form.project_manager || null,
            notes: form.notes || null,
        }).select('*, client:clients(id, company_name)').single();

        if (error) { alert('Error: ' + error.message); return; }

        if (project) {
            // → M8: Auto-create Space Contextual del proyecto con todos los involucrados
            const clientName = project.client?.company_name || 'Cliente';
            await supabase.from('spaces').insert({
                name: `${clientName} - ${project.title.substring(0, 20)}`,
                description: `Espacio contextual (M8) para proyecto ${project.project_number}`,
                space_type: 'project',
                icon: 'engineering',
                project_id: project.id,
                created_by: 'Sistema'
            }).select().single();

            // → M8: Checklist pre-trabajo como tareas asignadas con fecha límite
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 3); // Due in 3 days
            const formattedDueDate = dueDate.toISOString().split('T')[0];

            const tasksToInsert = [
                {
                    title: `Checklist M3: Administrativo/Facturación para ${projectNumber}`,
                    description: 'Validar anticipos, contratos y trámites administrativos antes de iniciar obra.',
                    assigned_to: form.project_manager || 'Admin',
                    due_date: formattedDueDate,
                    project_id: project.id,
                    priority: 'high',
                },
                {
                    title: `Checklist M4: Materiales y Almacén para ${projectNumber}`,
                    description: 'Preparar y apartar materiales en inventario (M4).',
                    assigned_to: form.project_manager || 'Admin',
                    due_date: formattedDueDate,
                    project_id: project.id,
                    priority: 'high',
                },
                {
                    title: `Checklist M5: Vehículos y Herramienta para ${projectNumber}`,
                    description: 'Revisar estado de vehículos y herramienta pesada requerida.',
                    assigned_to: form.project_manager || 'Admin',
                    due_date: formattedDueDate,
                    project_id: project.id,
                    priority: 'high',
                },
                {
                    title: `Checklist M8: Cuadrilla para ${projectNumber}`,
                    description: 'Asignar personal, hospedaje, y viáticos en campo.',
                    assigned_to: form.project_manager || 'Admin',
                    due_date: formattedDueDate,
                    project_id: project.id,
                    priority: 'high',
                }
            ];

            await supabase.from('team_tasks').insert(tasksToInsert);

            // → Trigger WA Automation: Proyecto creado manual
            triggerWaAutomation({
                module: 'projects',
                event: 'created',
                record: {
                    title: project.title,
                    project_number: project.project_number,
                    client_name: project.client?.company_name || 'Sin Asignar',
                    status_label: 'Pendiente',
                    project_manager: project.project_manager || 'Admin',
                },
                referenceId: project.id,
            });

            alert(`Proyecto creado. \n✓ Space (M8) generado \n✓ Tareas pre-trabajo asignadas (M8) a ${form.project_manager || 'Admin'}`);
        }

        setShowForm(false);
        setForm({ title: '', client_id: '', work_type: '', priority: 'normal', location: '', estimated_days: '1', project_manager: '', notes: '' });
        fetchProjects();
    };

    // KPIs
    const total = projects.length;
    const inField = projects.filter(p => p.status === 'in_field').length;
    const completed = projects.filter(p => p.status === 'completed' || p.status === 'invoiced').length;
    const quotedTotal = projects.reduce((s, p) => s + p.quoted_amount, 0);

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Proyectos & Operaciones</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">Gestión del ciclo completo post-venta.</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Nuevo Proyecto
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: 'Total Proyectos', value: total.toString(), icon: 'folder', color: 'from-sky-500 to-cyan-500' },
                    { label: 'En Campo', value: inField.toString(), icon: 'engineering', color: 'from-amber-500 to-orange-500' },
                    { label: 'Completados', value: completed.toString(), icon: 'check_circle', color: 'from-emerald-500 to-teal-500' },
                    { label: 'Valor Cotizado', value: formatCurrencyMXN(quotedTotal), icon: 'payments', color: 'from-violet-500 to-purple-500' },
                ].map(k => (
                    <div key={k.label} className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between">
                            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k.label}</p><p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{k.value}</p></div>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${k.color} shadow-lg`}><span className="material-symbols-outlined text-white text-[24px]">{k.icon}</span></div>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${k.color} opacity-60`} />
                    </div>
                ))}
            </div>

            {/* Form */}
            {showForm && (
                <form onSubmit={handleCreate} className="rounded-xl border border-primary/20 bg-primary/5 p-6">
                    <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Nuevo Proyecto</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="md:col-span-2"><label className={labelClass}>Título *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Ej: Equipamiento Pozo #5 - Rancho El Mirador" className={inputClass} /></div>
                        <div><label className={labelClass}>Cliente</label><select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className={inputClass}><option value="">Sin cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select></div>
                        <div><label className={labelClass}>Tipo de Trabajo</label><input value={form.work_type} onChange={e => setForm({ ...form, work_type: e.target.value })} placeholder="Equipamiento, Aforo..." className={inputClass} /></div>
                        <div><label className={labelClass}>Prioridad</label><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className={inputClass}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></div>
                        <div><label className={labelClass}>Ubicación</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Dirección o coordenadas" className={inputClass} /></div>
                        <div><label className={labelClass}>Días Estimados</label><input type="number" min="1" value={form.estimated_days} onChange={e => setForm({ ...form, estimated_days: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>Responsable</label><input value={form.project_manager} onChange={e => setForm({ ...form, project_manager: e.target.value })} placeholder="Nombre del PM" className={inputClass} /></div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button type="submit" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">Crear Proyecto</button>
                        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-400">Cancelar</button>
                    </div>
                </form>
            )}

            {/* Filters & Search */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input type="text" placeholder="Buscar por título o número..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setFilter('all')} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === 'all' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>Todos</button>
                    {STATUS_FLOW.map(s => (
                        <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === s ? `${PROJECT_STATUS_COLORS[s].bg} ${PROJECT_STATUS_COLORS[s].text}` : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {PROJECT_STATUS_LABELS[s]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Project Cards */}
            {loading ? (
                <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : projects.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                    <span className="material-symbols-outlined text-[48px] text-slate-300">folder_off</span>
                    <p className="text-sm text-slate-500">No hay proyectos.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {projects.map(p => {
                        const checklistDone = [p.checklist_invoice, p.checklist_materials, p.checklist_vehicle, p.checklist_team].filter(Boolean).length;
                        const statusColor = PROJECT_STATUS_COLORS[p.status] || { bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-600 dark:text-slate-400' };
                        return (
                            <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                                className="group cursor-pointer rounded-xl border border-slate-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md hover:border-primary/30 dark:border-slate-800/60 dark:bg-slate-900/50">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${statusColor.bg}`}>
                                            <span className={`material-symbols-outlined text-[20px] ${statusColor.text}`}>{PROJECT_STATUS_ICONS[p.status] || 'help'}</span>
                                        </div>
                                        <div>
                                            <p className="font-mono text-xs text-primary font-bold">{p.project_number}</p>
                                            <p className="font-semibold text-slate-900 dark:text-white text-sm mt-0.5">{p.title}</p>
                                        </div>
                                    </div>
                                    <span className={`text-xs font-bold ${PRIORITY_COLORS[p.priority]}`}>{PRIORITY_LABELS[p.priority]}</span>
                                </div>

                                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                                    <span className="material-symbols-outlined text-[14px]">business</span>
                                    <span>{p.client?.company_name || '—'}</span>
                                    {p.work_type && <><span>·</span><span>{p.work_type}</span></>}
                                </div>

                                {p.project_manager && (
                                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                                        <span className="material-symbols-outlined text-[14px]">person</span>
                                        <span>{p.project_manager}</span>
                                    </div>
                                )}

                                {/* Checklist progress */}
                                <div className="mt-3 flex items-center gap-2">
                                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${checklistDone === 4 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${(checklistDone / 4) * 100}%` }} />
                                    </div>
                                    <span className="text-xs font-semibold text-slate-400">{checklistDone}/4</span>
                                </div>

                                <div className="mt-3 flex items-center justify-between">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor.bg} ${statusColor.text}`}>
                                        {PROJECT_STATUS_LABELS[p.status]}
                                    </span>
                                    {p.quoted_amount > 0 && <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrencyMXN(p.quoted_amount)}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
