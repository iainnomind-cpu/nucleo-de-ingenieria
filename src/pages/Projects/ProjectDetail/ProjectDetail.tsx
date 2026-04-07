import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import {
    Project, ProjectTask, FieldLog, ProjectIncident, ProjectVehicle,
    ProjectStatus, TaskStatus as TStatus,
    PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, PROJECT_STATUS_ICONS,
    TASK_STATUS_LABELS, TASK_STATUS_COLORS,
    PRIORITY_LABELS, PRIORITY_COLORS,
    INCIDENT_TYPE_LABELS, INCIDENT_TYPE_ICONS,
    SEVERITY_LABELS, SEVERITY_COLORS,
    WEATHER_LABELS, WEATHER_ICONS,
    TEAM_MEMBERS, formatCurrencyMXN,
    IncidentType, Severity, Weather, FieldExpense, ExpenseType, EXPENSE_TYPE_LABELS, EXPENSE_TYPE_ICONS
} from '../../../types/projects';
import { PhotoAttachment } from '../../../types/photos';
import PhotoUploader, { PhotoGallery } from '../../../components/PhotoUploader';
import { InventoryProduct, InventoryMovement, formatCurrencyInv, UNIT_LABELS } from '../../../types/inventory';
import { getNavigationUrl, getStaticMapUrl, getCurrentPosition } from '../../../lib/maps';
import { EquipmentType, EQUIPMENT_MAINTENANCE_RULES, EQUIPMENT_TYPE_LABELS } from '../../../types/maintenance';
import {
    Vehicle, VEHICLE_TYPE_LABELS, VEHICLE_TYPE_ICONS,
    VEHICLE_STATUS_LABELS, VEHICLE_STATUS_COLORS
} from '../../../types/fleet';

type Tab = 'overview' | 'tasks' | 'fieldlogs' | 'incidents' | 'materials' | 'viaticos' | 'vehicles';
const STATUS_FLOW: ProjectStatus[] = ['pending', 'preparation', 'in_field', 'completed', 'invoiced'];

export default function ProjectDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [tab, setTab] = useState<Tab>('overview');
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<ProjectTask[]>([]);
    const [logs, setLogs] = useState<FieldLog[]>([]);
    const [incidents, setIncidents] = useState<ProjectIncident[]>([]);
    const [inventoryCost, setInventoryCost] = useState(0);
    const [materialsUsed, setMaterialsUsed] = useState<InventoryMovement[]>([]);
    const [invProducts, setInvProducts] = useState<InventoryProduct[]>([]);
    const [expenses, setExpenses] = useState<FieldExpense[]>([]);
    const [expenseCost, setExpenseCost] = useState(0);
    const [fleetCost, setFleetCost] = useState(0);

    // Vehicles assignment
    const [projectVehicles, setProjectVehicles] = useState<ProjectVehicle[]>([]);
    const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);

    const [loading, setLoading] = useState(true);
    const [teamMembers, setTeamMembers] = useState<string[]>(TEAM_MEMBERS);

    // Forms
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [showLogForm, setShowLogForm] = useState(false);
    const [showIncidentForm, setShowIncidentForm] = useState(false);
    const [showMaterialForm, setShowMaterialForm] = useState(false);
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [showVehicleForm, setShowVehicleForm] = useState(false);
    
    // Auto-maintenance Modal
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [selectedEqTypes, setSelectedEqTypes] = useState<EquipmentType[]>([]);

    const fetchAll = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        const [pRes, tRes, lRes, iRes, invRes, ipRes, expRes, sysRes, milRes, mntRes, pvRes, avRes] = await Promise.all([
            supabase.from('projects').select('*, client:clients(id, company_name)').eq('id', id).single(),
            supabase.from('project_tasks').select('*').eq('project_id', id).order('sort_order'),
            supabase.from('field_logs').select('*').eq('project_id', id).order('log_date', { ascending: false }),
            supabase.from('project_incidents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
            supabase.from('inventory_movements').select('*, product:inventory_products(*)').eq('reference_id', id).eq('movement_type', 'exit'),
            supabase.from('inventory_products').select('*').eq('is_active', true).order('name'),
            supabase.from('field_expenses').select('*').eq('project_id', id).order('created_at', { ascending: false }),
            supabase.from('system_settings').select('value').eq('key', 'team_directory').single(),
            supabase.from('vehicle_mileage').select('calculated_trip_cost').eq('project_id', id),
            supabase.from('vehicle_maintenance').select('cost').eq('project_id', id),
            supabase.from('project_vehicles').select('*, vehicle:vehicles(id, plates, brand, model, year, vehicle_type, status, cost_per_km, current_mileage)').eq('project_id', id).order('assigned_date'),
            supabase.from('vehicles').select('*').eq('status', 'active').order('brand')
        ]);
        if (!pRes.data) { navigate('/projects'); return; }
        setProject(pRes.data as Project);
        setTasks(tRes.data || []);
        setLogs(lRes.data || []);
        setIncidents(iRes.data || []);
        setInvProducts((ipRes.data as InventoryProduct[]) || []);

        const mUsed = (invRes.data as InventoryMovement[]) || [];
        setMaterialsUsed(mUsed);

        // Calculate material costs
        const totalInvCost = mUsed.reduce((sum, mov) => sum + (mov.total_cost || 0), 0);
        setInventoryCost(totalInvCost);

        // Field Expenses logic
        const exps = (expRes.data as FieldExpense[]) || [];
        setExpenses(exps);
        setExpenseCost(exps.reduce((sum, item) => sum + Number(item.amount || 0), 0));

        // Fleet Cost logic
        const p_mil = milRes.data || [];
        const p_mnt = mntRes.data || [];
        const mileageCost = p_mil.reduce((sum: number, item: any) => sum + Number(item.calculated_trip_cost || 0), 0);
        const maintenanceCost = p_mnt.reduce((sum: number, item: any) => sum + Number(item.cost || 0), 0);
        setFleetCost(mileageCost + maintenanceCost);

        // Project Vehicles
        setProjectVehicles((pvRes.data as ProjectVehicle[]) || []);
        setAvailableVehicles((avRes.data as Vehicle[]) || []);

        if (sysRes.data?.value && Array.isArray(sysRes.data.value)) {
            setTeamMembers(sysRes.data.value);
        } else {
            setTeamMembers(TEAM_MEMBERS);
        }

        setLoading(false);
    }, [id, navigate]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Checklist toggle
    type ChecklistField = 'checklist_invoice' | 'checklist_materials' | 'checklist_vehicle' | 'checklist_team';
    const getChecklist = (p: Project, f: ChecklistField) => p[f];
    const toggleChecklist = async (field: ChecklistField) => {
        if (!project) return;
        const val = !getChecklist(project, field);
        const updates: Record<string, unknown> = { [field]: val };
        const projected = { ...project, [field]: val };
        const allDone = (['checklist_invoice', 'checklist_materials', 'checklist_vehicle', 'checklist_team'] as ChecklistField[]).every(f => getChecklist(projected, f));
        if (allDone) {
            updates.checklist_completed_at = new Date().toISOString();
        } else {
            updates.checklist_completed_at = null;
        }
        await supabase.from('projects').update(updates).eq('id', project.id);
        fetchAll();
    };

    // Status change
    const handleStatusChange = async (newStatus: ProjectStatus) => {
        if (!project) return;
        const updates: Record<string, unknown> = { status: newStatus };
        if (newStatus === 'in_field' && !project.actual_start) {
            updates.actual_start = new Date().toISOString().split('T')[0];

            // → M4: Consume materials from warehouse
            if (project.quote_id) {
                const { data: quoteItems } = await supabase.from('quote_items').select('*').eq('quote_id', project.quote_id);
                if (quoteItems && quoteItems.length > 0) {
                    let itemsConsumed = 0;
                    for (const item of quoteItems) {
                        const { data: invProduct } = await supabase.from('inventory_products')
                            .select('id, current_stock, unit_cost').eq('name', item.description).single();

                        if (invProduct) {
                            // Create movement
                            await supabase.from('inventory_movements').insert({
                                product_id: invProduct.id,
                                movement_type: 'exit',
                                quantity: item.quantity,
                                unit_cost: invProduct.unit_cost,
                                total_cost: (invProduct.unit_cost || 0) * item.quantity,
                                reason: 'project_consumption',
                                reference_id: project.id,
                                reference_type: 'project',
                                reference_number: project.project_number,
                                notes: `Consumo automático al iniciar proyecto en campo`
                            });
                            // Update stock
                            await supabase.from('inventory_products')
                                .update({ current_stock: invProduct.current_stock - item.quantity })
                                .eq('id', invProduct.id);
                            itemsConsumed++;
                        }
                    }
                    if (itemsConsumed > 0) alert(`${itemsConsumed} materiales consumidos del inventario (M4)`);
                }
            }

            // → M3→M8: Auto-create contextual Space for this project with full team
            const spaceName = `${project.client?.company_name || 'Cliente'} — ${project.title}`;
            const { data: existingSpace } = await supabase.from('spaces').select('id').ilike('name', `%${project.title.substring(0, 20)}%`).limit(1);
            let projectSpaceId = existingSpace?.[0]?.id;
            if (!projectSpaceId) {
                const { data: newSpace } = await supabase.from('spaces').insert({
                    name: spaceName,
                    space_type: 'project',
                    description: `Space contextual: ${project.project_number} · ${project.title}`,
                    members: ['Joel', 'Alejandro', 'Samara', 'Paulina'],
                    is_archived: false,
                }).select().single();
                projectSpaceId = newSpace?.id;
            }

            // → M3→M8: Post kickoff message in the Space
            if (projectSpaceId) {
                await supabase.from('messages').insert({
                    space_id: projectSpaceId,
                    sender_id: '12345678-1234-1234-1234-123456789012',
                    content: `🚀 **INICIO DE PROYECTO (M3→M8)**: El proyecto **${project.project_number}** ha iniciado trabajo en campo.\n\n📋 **${project.title}**\n👤 PM: ${project.project_manager || 'Sin asignar'}\n📍 Equipo: Joel, Alejandro, Samara, Paulina`,
                    message_type: 'text'
                });
            }

            // → M3→M8: Create Board tasks from project checklist items
            const checklistItems = [
                { field: 'checklist_invoice', title: `Factura previa — ${project.project_number}`, assignee: 'Samara' },
                { field: 'checklist_materials', title: `Materiales listos — ${project.project_number}`, assignee: 'Paulina' },
                { field: 'checklist_vehicle', title: `Vehículo preparado — ${project.project_number}`, assignee: 'Joel' },
                { field: 'checklist_team', title: `Equipo asignado — ${project.project_number}`, assignee: 'Alejandro' },
            ];
            for (const item of checklistItems) {
                await supabase.from('team_tasks').insert({
                    title: item.title,
                    description: `Tarea de checklist pre-trabajo generada automáticamente desde proyecto ${project.project_number}`,
                    assigned_to: item.assignee,
                    created_by: 'Sistema',
                    priority: 'high',
                    due_date: project.start_date || null,
                    project_id: project.id,
                    status: 'pending',
                });
            }
        }

        if (newStatus === 'completed' && !project.actual_end) {
            setShowCompletionModal(true);
            return;
        }

        await supabase.from('projects').update(updates).eq('id', project.id);
        fetchAll();
    };

    const handleCompleteProject = async () => {
        if (!project) return;
        const actual_end = new Date().toISOString().split('T')[0];

        // M5: Equipment & Maintenance Schedules (Automatic)
        if (project.client_id && selectedEqTypes.length > 0) {
            let count = 0;
            for (const eqType of selectedEqTypes) {
                const { data: eqData } = await supabase.from('installed_equipment').insert({
                    client_id: project.client_id,
                    equipment_type: eqType,
                    location_description: project.location || project.title,
                    installation_date: actual_end,
                    status: 'active'
                }).select().single();

                if (eqData) {
                    const frequency = EQUIPMENT_MAINTENANCE_RULES[eqType] || 12;
                    const nextDate = new Date();
                    nextDate.setMonth(nextDate.getMonth() + frequency);
                    await supabase.from('maintenance_schedules').insert({
                        equipment_id: eqData.id,
                        service_type: 'revision_general',
                        frequency_months: frequency,
                        last_service_date: actual_end,
                        next_service_date: nextDate.toISOString().split('T')[0],
                        assigned_to: project.project_manager || 'Admin',
                        status: 'scheduled',
                    });
                    count++;
                }
            }
            alert(`✅ ${count} equipo(s) instalados y su mantenimiento preventivo programado a futuro (M5)`);
        }

        // → M6: Generate pending invoice
        if (project.client_id && project.quoted_amount > 0) {
            const { data: invData } = await supabase.from('invoices').insert({
                client_id: project.client_id,
                project_id: project.id,
                invoice_number: `F-${project.project_number.replace('PRY-', '')}`,
                issue_date: actual_end,
                due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                subtotal: project.quoted_amount / 1.16,
                tax_amount: project.quoted_amount - (project.quoted_amount / 1.16),
                total: project.quoted_amount,
                amount_paid: 0,
                balance: project.quoted_amount,
                status: 'pending',
                currency: 'MXN',
                notes: `Factura por proyecto completado: ${project.project_number}`
            }).select().single();
            if (invData) alert(`Generada factura pendiente: ${invData.invoice_number} (M6)`);
        }

        // → M8: Notify Project Space (find space by project title snippet)
        const { data: spaces } = await supabase.from('spaces')
            .select('id').ilike('name', `%${project.title.substring(0, 20)}%`).limit(1);
        if (spaces && spaces.length > 0) {
            await supabase.from('messages').insert({
                space_id: spaces[0].id,
                sender_id: '12345678-1234-1234-1234-123456789012', // System or Admin
                content: `🎉 ¡El proyecto **${project.project_number}** ha sido marcado como COMPLETADO!`,
                message_type: 'text'
            });
        }

        await supabase.from('projects').update({ status: 'completed', actual_end }).eq('id', project.id);
        setShowCompletionModal(false);
        fetchAll();
    };

    // Add task
    const [taskForm, setTaskForm] = useState({ title: '', assigned_to: '', due_date: '', estimated_hours: '', priority: 'normal' });
    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from('project_tasks').insert({
            project_id: id,
            title: taskForm.title,
            assigned_to: taskForm.assigned_to || null,
            due_date: taskForm.due_date || null,
            estimated_hours: parseFloat(taskForm.estimated_hours) || null,
            priority: taskForm.priority,
            sort_order: tasks.length,
        });
        setTaskForm({ title: '', assigned_to: '', due_date: '', estimated_hours: '', priority: 'normal' });
        setShowTaskForm(false);
        fetchAll();
    };

    const updateTaskStatus = async (taskId: string, status: TStatus) => {
        const updates: Record<string, unknown> = { status };
        if (status === 'completed') updates.completed_at = new Date().toISOString();
        await supabase.from('project_tasks').update(updates).eq('id', taskId);
        fetchAll();
    };

    // Add field log
    const [logForm, setLogForm] = useState({ log_date: new Date().toISOString().split('T')[0], author: '', weather: 'sunny' as Weather, arrival_time: '', departure_time: '', summary: '', activities_done: '', materials_used: '' });
    const [logPhotos, setLogPhotos] = useState<PhotoAttachment[]>([]);
    const handleAddLog = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from('field_logs').insert({
            project_id: id,
            log_date: logForm.log_date,
            author: logForm.author || null,
            weather: logForm.weather,
            arrival_time: logForm.arrival_time || null,
            departure_time: logForm.departure_time || null,
            summary: logForm.summary,
            activities_done: logForm.activities_done || null,
            materials_used: logForm.materials_used || null,
            photos: logPhotos,
        });
        setLogForm({ log_date: new Date().toISOString().split('T')[0], author: '', weather: 'sunny', arrival_time: '', departure_time: '', summary: '', activities_done: '', materials_used: '' });
        setLogPhotos([]);
        setShowLogForm(false);
        fetchAll();
    };

    // Add incident
    const [incForm, setIncForm] = useState({ incident_type: 'other' as IncidentType, severity: 'low' as Severity, title: '', description: '', cost_impact: '', time_impact: '', reported_by: '' });
    const [incPhotos, setIncPhotos] = useState<PhotoAttachment[]>([]);
    const handleAddIncident = async (e: React.FormEvent) => {
        e.preventDefault();
        await supabase.from('project_incidents').insert({
            project_id: id,
            incident_type: incForm.incident_type,
            severity: incForm.severity,
            title: incForm.title,
            description: incForm.description || null,
            cost_impact: parseFloat(incForm.cost_impact) || 0,
            time_impact_hours: parseFloat(incForm.time_impact) || 0,
            reported_by: incForm.reported_by || null,
            photos: incPhotos,
        });
        setIncForm({ incident_type: 'other', severity: 'low', title: '', description: '', cost_impact: '', time_impact: '', reported_by: '' });
        setIncPhotos([]);
        setShowIncidentForm(false);
        fetchAll();
    };

    const resolveIncident = async (incId: string, resolution: string) => {
        await supabase.from('project_incidents').update({ resolution, resolved_at: new Date().toISOString() }).eq('id', incId);
        fetchAll();
    };

    // Add material consumption (M4)
    const [matForm, setMatForm] = useState({ product_id: '', quantity: '' });
    const handleAddMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!project || !matForm.product_id) return;
        
        const qty = parseFloat(matForm.quantity) || 0;
        if (qty <= 0) return;

        const prod = invProducts.find(p => p.id === matForm.product_id);
        if (!prod) return;

        const finalStock = Math.max(0, prod.current_stock - qty);
        const total = qty * prod.unit_cost;

        // 1. Insert Movement
        await supabase.from('inventory_movements').insert({
            product_id: prod.id,
            movement_type: 'exit',
            quantity: qty,
            unit_cost: prod.unit_cost,
            total_cost: total,
            reason: 'project_consumption',
            reference_id: project.id,
            reference_type: 'project',
            reference_number: project.project_number,
            notes: `Consumo registrado manualmente en el proyecto`,
            performed_by: project.project_manager || 'PM', 
        });

        // 2. Update Stock
        await supabase.from('inventory_products').update({ current_stock: finalStock }).eq('id', prod.id);

        // 3. Check Min Stock and notify Admin Space
        if (prod.min_stock !== undefined && finalStock < prod.min_stock && prod.current_stock >= prod.min_stock) {
            const { data: spaces } = await supabase.from('spaces')
                .select('id').ilike('name', '%admin%').limit(1);

            if (spaces && spaces.length > 0) {
                await supabase.from('messages').insert({
                    space_id: spaces[0].id,
                    sender_id: '12345678-1234-1234-1234-123456789012',
                    content: `⚠️ **ALERTA DE INVENTARIO (M4→M8)**: Tras consumo en proyecto **${project.project_number}**, el producto **${prod.code} - ${prod.name}** ha caído por debajo de su stock mínimo (${finalStock} / Mín: ${prod.min_stock} ${UNIT_LABELS[prod.unit]}).\n\n👤 Se requiere orden de reposición inmediata.`,
                    message_type: 'text'
                });
            }
        }

        setMatForm({ product_id: '', quantity: '' });
        setShowMaterialForm(false);
        fetchAll();
    };

    // Gastos de Campo / Viáticos (M8)
    const [expenseForm, setExpenseForm] = useState<Partial<FieldExpense>>({ expense_type: 'comida', amount: 0, expense_date: new Date().toISOString().split('T')[0], employee_name: '' });
    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!project || !expenseForm.employee_name || !expenseForm.amount) return;
        
        await supabase.from('field_expenses').insert({
            project_id: project.id,
            ...expenseForm
        });
        
        setExpenseForm({ expense_type: 'comida', amount: 0, expense_date: new Date().toISOString().split('T')[0], employee_name: '' });
        setShowExpenseForm(false);
        fetchAll();
    };

    // Vehicle assignment
    const [vehForm, setVehForm] = useState({ vehicle_id: '', assigned_date: '', release_date: '', operator_name: '', notes: '' });
    const handleAssignVehicle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!project || !vehForm.vehicle_id) return;

        // Validate availability — check for date overlap
        const startDate = vehForm.assigned_date;
        const endDate = vehForm.release_date || '2099-12-31';

        let overlapQuery = supabase.from('project_vehicles')
            .select('*, project:projects(project_number, title)')
            .eq('vehicle_id', vehForm.vehicle_id)
            .neq('project_id', project.id);

        // Overlap: existing.assigned_date <= endDate AND (existing.release_date IS NULL OR existing.release_date >= startDate)
        overlapQuery = overlapQuery.lte('assigned_date', endDate);

        const { data: overlaps } = await overlapQuery;
        const actualOverlaps = (overlaps || []).filter((o: any) => {
            const oRelease = o.release_date || '2099-12-31';
            return oRelease >= startDate;
        });

        if (actualOverlaps.length > 0) {
            const conflict = actualOverlaps[0] as any;
            alert(`⚠️ Este vehículo ya está asignado al proyecto ${conflict.project?.project_number || 'Desconocido'} (${conflict.project?.title || ''}) del ${conflict.assigned_date} al ${conflict.release_date || 'sin fecha fin'}.\n\nSelecciona otro vehículo o ajusta las fechas.`);
            return;
        }

        await supabase.from('project_vehicles').insert({
            project_id: project.id,
            vehicle_id: vehForm.vehicle_id,
            assigned_date: vehForm.assigned_date,
            release_date: vehForm.release_date || null,
            operator_name: vehForm.operator_name || null,
            notes: vehForm.notes || null,
        });

        setVehForm({ vehicle_id: '', assigned_date: '', release_date: '', operator_name: '', notes: '' });
        setShowVehicleForm(false);
        fetchAll();
    };

    const handleReleaseVehicle = async (pvId: string) => {
        if (!confirm('¿Liberar este vehículo del proyecto? Quedará disponible para otros proyectos.')) return;
        await supabase.from('project_vehicles').delete().eq('id', pvId);
        fetchAll();
    };

    // KPIs & Financials
    const tasksCompleted = tasks.filter(t => t.status === 'completed').length;
    const totalIncidentCost = incidents.reduce((sum, i) => sum + i.cost_impact, 0);
    const projectActualCost = (project?.actual_cost || 0) + inventoryCost + totalIncidentCost + expenseCost + fleetCost;
    const projectMargin = (project?.quoted_amount || 0) - projectActualCost;

    const sectionClass = "rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50";

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    const defaultColor = { bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-600 dark:text-slate-400' };

    if (loading || !project) return <div className="flex flex-1 items-center justify-center p-8"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

    const statusColor = PROJECT_STATUS_COLORS[project.status] || defaultColor;

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/projects')} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{project.project_number}</h2>
                            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusColor.bg} ${statusColor.text}`}>
                                <span className="material-symbols-outlined text-[14px]">{PROJECT_STATUS_ICONS[project.status] || 'help'}</span>
                                {PROJECT_STATUS_LABELS[project.status] || project.status}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500">{project.title}</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {STATUS_FLOW.map((s, idx) => {
                        const currentIdx = STATUS_FLOW.indexOf(project.status);
                        const isNext = idx === currentIdx + 1;
                        if (!isNext) return null;
                        return (
                            <button key={s} onClick={() => handleStatusChange(s)}
                                className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-sm font-semibold text-white shadow-md">
                                <span className="material-symbols-outlined text-[18px]">{PROJECT_STATUS_ICONS[s]}</span>
                                Mover a {PROJECT_STATUS_LABELS[s]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg flex-wrap bg-slate-100 p-1 dark:bg-slate-800">
                {[
                    { key: 'overview', icon: 'dashboard', label: 'General' },
                    { key: 'tasks', icon: 'checklist', label: `Tareas (${tasksCompleted}/${tasks.length})` },
                    { key: 'fieldlogs', icon: 'menu_book', label: `Bitácora (${logs.length})` },
                    { key: 'incidents', icon: 'warning', label: `Incidencias (${incidents.length})` },
                    { key: 'materials', icon: 'inventory_2', label: `Materiales (${materialsUsed.length})` },
                    { key: 'viaticos', icon: 'payments', label: `Viáticos (${expenses.length})` },
                    { key: 'vehicles', icon: 'local_shipping', label: `Vehículos (${projectVehicles.length})` },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as Tab)}
                        className={`flex flex-1 items-center justify-center min-w-[120px] gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                        <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* TAB: Overview */}
            {tab === 'overview' && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="flex flex-col gap-6 lg:col-span-2">
                        {/* Checklist */}
                        <div className={sectionClass}>
                            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-primary text-[20px]">fact_check</span>
                                Checklist Pre-Trabajo
                            </h3>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {([
                                    { field: 'checklist_invoice' as ChecklistField, label: 'Factura Emitida', icon: 'receipt' },
                                    { field: 'checklist_materials' as ChecklistField, label: 'Materiales Verificados', icon: 'inventory' },
                                    { field: 'checklist_vehicle' as ChecklistField, label: 'Grúa/Vehículo Confirmado', icon: 'local_shipping' },
                                    { field: 'checklist_team' as ChecklistField, label: 'Equipo de Campo Asignado', icon: 'group' },
                                ]).map(item => {
                                    const checked = getChecklist(project, item.field);
                                    return (
                                        <button key={item.field} onClick={() => toggleChecklist(item.field)}
                                            className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-all ${checked ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-slate-200 bg-white hover:border-primary/30 dark:border-slate-700 dark:bg-slate-800'}`}>
                                            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${checked ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-700'}`}>
                                                <span className="material-symbols-outlined text-[18px]">{checked ? 'check' : item.icon}</span>
                                            </div>
                                            <span className={`text-sm font-medium ${checked ? 'text-emerald-700 dark:text-emerald-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {project.checklist_completed_at && (
                                <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">verified</span>
                                    Checklist completado el {new Date(project.checklist_completed_at).toLocaleDateString('es-MX')}
                                </p>
                            )}
                        </div>

                        {/* Info */}
                        <div className={sectionClass}>
                            <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Información del Proyecto</h3>
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 text-sm">
                                <div><span className="text-xs text-slate-400 block">Cliente</span><span className="font-medium text-slate-900 dark:text-white">{project.client?.company_name || '—'}</span></div>
                                <div><span className="text-xs text-slate-400 block">Tipo</span><span className="font-medium text-slate-900 dark:text-white">{project.work_type || '—'}</span></div>
                                <div><span className="text-xs text-slate-400 block">Ubicación</span><span className="font-medium text-slate-900 dark:text-white">{project.location || '—'}</span></div>
                                <div><span className="text-xs text-slate-400 block">PM</span><span className="font-medium text-slate-900 dark:text-white">{project.project_manager || '—'}</span></div>
                                <div><span className="text-xs text-slate-400 block">Días Estimados</span><span className="font-medium text-slate-900 dark:text-white">{project.estimated_days}</span></div>
                                <div><span className="text-xs text-slate-400 block">Prioridad</span><span className={`font-bold ${PRIORITY_COLORS[project.priority]}`}>{PRIORITY_LABELS[project.priority]}</span></div>
                            </div>
                            {project.assigned_team && project.assigned_team.length > 0 && (
                                <div className="mt-4">
                                    <span className="text-xs text-slate-400 block mb-2">Equipo Asignado</span>
                                    <div className="flex flex-wrap gap-2">
                                        {project.assigned_team.map(m => (
                                            <span key={m} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{m}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="flex flex-col gap-6">
                        <div className={sectionClass}>
                            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Resumen Financiero</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-slate-500">Cotizado Base</span><span className="font-bold text-slate-900 dark:text-white">{formatCurrencyMXN(project.quoted_amount)}</span></div>
                                <div className="my-2 border-t border-slate-200 border-dashed dark:border-slate-700" />
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Mano de Obra/Servicios</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrencyMXN(project.actual_cost)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs group">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">Materiales (M4)</span>
                                        <button onClick={() => { setTab('materials'); setShowMaterialForm(true); }} className="hidden items-center justify-center rounded bg-sky-100 text-sky-600 p-0.5 hover:bg-sky-200 group-hover:flex" title="Agregar Material">
                                            <span className="material-symbols-outlined text-[14px]">add</span>
                                        </button>
                                    </div>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-sky-500 transition-colors" onClick={() => setTab('materials')}>{formatCurrencyMXN(inventoryCost)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs group">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">Viáticos (M8)</span>
                                        <button onClick={() => { setTab('viaticos'); setShowExpenseForm(true); }} className="hidden items-center justify-center rounded bg-orange-100 text-orange-600 p-0.5 hover:bg-orange-200 group-hover:flex" title="Registrar Gasto">
                                            <span className="material-symbols-outlined text-[14px]">add</span>
                                        </button>
                                    </div>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-orange-500 transition-colors" onClick={() => setTab('viaticos')}>{formatCurrencyMXN(expenseCost)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs group">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">Flotilla / Traslados (Real)</span>
                                    </div>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrencyMXN(fleetCost)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Incidencias y Riesgos</span>
                                    <span className="font-semibold text-red-500">{formatCurrencyMXN(totalIncidentCost)}</span>
                                </div>
                                <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                                <div className="flex justify-between"><span className="text-slate-500">Costo Real Total</span><span className="font-bold text-slate-900 dark:text-white">{formatCurrencyMXN(projectActualCost)}</span></div>
                                <div className="flex justify-between mt-1"><span className="font-bold text-slate-900 dark:text-white">Margen Bruto</span><span className={`font-bold ${projectMargin > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{formatCurrencyMXN(projectMargin)}</span></div>
                            </div>
                        </div>
                        <div className={sectionClass}>
                            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Progreso</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs"><span className="text-slate-500">Tareas</span><span className="font-bold">{tasksCompleted}/{tasks.length}</span></div>
                                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: tasks.length > 0 ? `${(tasksCompleted / tasks.length) * 100}%` : '0%' }} />
                                </div>
                                <div className="flex justify-between text-xs"><span className="text-slate-500">Bitácoras</span><span className="font-bold">{logs.length}</span></div>
                            </div>
                        </div>

                        {/* Team assignment */}
                        <div className={sectionClass}>
                            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Asignar Equipo</h3>
                            <div className="flex flex-wrap gap-2">
                                {TEAM_MEMBERS.map(m => {
                                    const assigned = project.assigned_team?.includes(m);
                                    return (
                                        <button key={m} onClick={async () => {
                                            const newTeam = assigned ? project.assigned_team.filter(t => t !== m) : [...(project.assigned_team || []), m];
                                            await supabase.from('projects').update({ assigned_team: newTeam }).eq('id', project.id);
                                            fetchAll();
                                        }}
                                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${assigned ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-primary/10 dark:bg-slate-700 dark:text-slate-400'}`}>
                                            {m}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Maps: Ubicación y Navegación */}
                        {(project as unknown as { latitude: number | null; longitude: number | null }).latitude && (project as unknown as { latitude: number | null; longitude: number | null }).longitude && (
                            <div className={sectionClass}>
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                    <span className="material-symbols-outlined text-primary text-[20px]">location_on</span>
                                    Ubicación del Predio
                                </h3>
                                <img
                                    src={getStaticMapUrl(
                                        (project as unknown as { latitude: number }).latitude,
                                        (project as unknown as { longitude: number }).longitude,
                                        { zoom: 13, width: 400, height: 200 }
                                    )}
                                    alt="Mapa del proyecto"
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700"
                                />
                                <div className="mt-3 flex gap-2">
                                    <a href={getNavigationUrl(
                                        (project as unknown as { latitude: number }).latitude,
                                        (project as unknown as { longitude: number }).longitude
                                    )} target="_blank" rel="noopener noreferrer"
                                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md">
                                        <span className="material-symbols-outlined text-[18px]">navigation</span>
                                        Navegar al Predio
                                    </a>
                                    <button onClick={async () => {
                                        const pos = await getCurrentPosition();
                                        if (pos) {
                                            await supabase.from('field_logs').insert({
                                                project_id: project.id,
                                                log_date: new Date().toISOString().split('T')[0],
                                                author: project.project_manager || 'Joel',
                                                summary: `Check-in en campo · ${new Date().toLocaleTimeString('es-MX')}`,
                                                checkin_lat: pos.lat, checkin_lng: pos.lng,
                                                checkin_time: new Date().toISOString(),
                                            });
                                            alert(`✅ Check-in registrado: ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`);
                                            fetchAll();
                                        } else {
                                            alert('No se pudo obtener la ubicación GPS. Verifique permisos.');
                                        }
                                    }}
                                        className="flex items-center gap-1 rounded-lg border border-primary px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5">
                                        <span className="material-symbols-outlined text-[18px]">pin_drop</span>
                                        Check-in
                                    </button>
                                </div>
                                <p className="mt-2 text-[10px] text-slate-400 text-center">
                                    {(project as unknown as { formatted_address: string | null }).formatted_address || 'Coordenadas GPS guardadas'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: Tasks */}
            {tab === 'tasks' && (
                <div className={sectionClass}>
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cronograma de Actividades</h3>
                        <button onClick={() => setShowTaskForm(!showTaskForm)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">
                            <span className="material-symbols-outlined text-[16px]">add</span>Agregar Tarea
                        </button>
                    </div>

                    {showTaskForm && (
                        <form onSubmit={handleAddTask} className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <div className="md:col-span-2"><label className={labelClass}>Título *</label><input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} required className={inputClass} placeholder="Descripción de la tarea" /></div>
                                <div><label className={labelClass}>Asignado a</label><select value={taskForm.assigned_to} onChange={e => setTaskForm({ ...taskForm, assigned_to: e.target.value })} className={inputClass}><option value="">Sin asignar</option>{TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                                <div><label className={labelClass}>Fecha Límite</label><input type="date" value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} className={inputClass} /></div>
                                <div><label className={labelClass}>Horas Estimadas</label><input type="number" step="0.5" value={taskForm.estimated_hours} onChange={e => setTaskForm({ ...taskForm, estimated_hours: e.target.value })} className={inputClass} placeholder="8" /></div>
                            </div>
                            <div className="mt-3 flex gap-2"><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Guardar</button><button type="button" onClick={() => setShowTaskForm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 dark:border-slate-700">Cancelar</button></div>
                        </form>
                    )}

                    {tasks.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500">No hay tareas asignadas.</div>
                    ) : (
                        <div className="space-y-2">
                            {tasks.map(task => (
                                <div key={task.id} className="flex items-center gap-3 rounded-lg border border-slate-200/60 p-4 transition-colors hover:bg-slate-50/50 dark:border-slate-700/60 dark:hover:bg-slate-800/30">
                                    <button onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${task.status === 'completed' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-primary dark:border-slate-600'}`}>
                                        {task.status === 'completed' && <span className="material-symbols-outlined text-[16px]">check</span>}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>{task.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                                            {task.assigned_to && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">person</span>{task.assigned_to}</span>}
                                            {task.due_date && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">event</span>{new Date(task.due_date).toLocaleDateString('es-MX')}</span>}
                                            {task.estimated_hours && <span>{task.estimated_hours}h est.</span>}
                                        </div>
                                    </div>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TASK_STATUS_COLORS[task.status].bg} ${TASK_STATUS_COLORS[task.status].text}`}>{TASK_STATUS_LABELS[task.status]}</span>
                                    <span className={`text-xs font-bold ${PRIORITY_COLORS[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</span>
                                    <div className="flex gap-1">
                                        {(['pending', 'in_progress', 'blocked'] as TStatus[]).filter(s => s !== task.status).map(s => (
                                            <button key={s} onClick={() => updateTaskStatus(task.id, s)} className="rounded p-1 text-[10px] text-slate-400 hover:text-primary" title={TASK_STATUS_LABELS[s]}>
                                                {TASK_STATUS_LABELS[s].substring(0, 3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Field Logs */}
            {tab === 'fieldlogs' && (
                <div className={sectionClass}>
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bitácora de Campo</h3>
                        <button onClick={() => setShowLogForm(!showLogForm)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">
                            <span className="material-symbols-outlined text-[16px]">add</span>Nueva Entrada
                        </button>
                    </div>

                    {showLogForm && (
                        <form onSubmit={handleAddLog} className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <div><label className={labelClass}>Fecha</label><input type="date" value={logForm.log_date} onChange={e => setLogForm({ ...logForm, log_date: e.target.value })} className={inputClass} required /></div>
                                <div><label className={labelClass}>Autor</label><select value={logForm.author} onChange={e => setLogForm({ ...logForm, author: e.target.value })} className={inputClass}><option value="">Seleccionar...</option>{TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                                <div><label className={labelClass}>Clima</label><select value={logForm.weather} onChange={e => setLogForm({ ...logForm, weather: e.target.value as Weather })} className={inputClass}>{(Object.keys(WEATHER_LABELS) as Weather[]).map(w => <option key={w} value={w}>{WEATHER_LABELS[w]}</option>)}</select></div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className={labelClass}>Llegada</label><input type="time" value={logForm.arrival_time} onChange={e => setLogForm({ ...logForm, arrival_time: e.target.value })} className={inputClass} /></div>
                                    <div><label className={labelClass}>Salida</label><input type="time" value={logForm.departure_time} onChange={e => setLogForm({ ...logForm, departure_time: e.target.value })} className={inputClass} /></div>
                                </div>
                                <div className="md:col-span-4"><label className={labelClass}>Resumen del Día *</label><textarea value={logForm.summary} onChange={e => setLogForm({ ...logForm, summary: e.target.value })} rows={2} className={inputClass + ' resize-none'} required placeholder="¿Qué se hizo hoy?" /></div>
                                <div className="md:col-span-2"><label className={labelClass}>Actividades Realizadas</label><textarea value={logForm.activities_done} onChange={e => setLogForm({ ...logForm, activities_done: e.target.value })} rows={2} className={inputClass + ' resize-none'} placeholder="Detalle de actividades..." /></div>
                                <div className="md:col-span-2"><label className={labelClass}>Materiales Utilizados</label><textarea value={logForm.materials_used} onChange={e => setLogForm({ ...logForm, materials_used: e.target.value })} rows={2} className={inputClass + ' resize-none'} placeholder="Tubería PVC 4in x20m, etc." /></div>
                                <div className="md:col-span-4">
                                    <label className={labelClass}>Evidencia Fotográfica</label>
                                    <PhotoUploader
                                        photos={logPhotos}
                                        onPhotosChange={setLogPhotos}
                                        folder={`field-logs/${id}`}
                                        uploaderName={logForm.author || 'Técnico'}
                                        compact
                                    />
                                </div>
                            </div>
                            <div className="mt-3 flex gap-2"><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Guardar</button><button type="button" onClick={() => { setShowLogForm(false); setLogPhotos([]); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 dark:border-slate-700">Cancelar</button></div>
                        </form>
                    )}

                    {logs.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500">No hay entradas de bitácora.</div>
                    ) : (
                        <div className="space-y-4">
                            {logs.map(log => (
                                <div key={log.id} className="rounded-lg border border-slate-200/60 p-4 dark:border-slate-700/60">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/30">
                                                <span className="material-symbols-outlined text-sky-600 text-[20px]">menu_book</span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm text-slate-900 dark:text-white">{new Date(log.log_date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    {log.author && <span>{log.author}</span>}
                                                    {log.weather && <span className="flex items-center gap-0.5"><span className="material-symbols-outlined text-[12px]">{WEATHER_ICONS[log.weather]}</span>{WEATHER_LABELS[log.weather]}</span>}
                                                    {log.arrival_time && log.departure_time && <span>{log.arrival_time} — {log.departure_time}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{log.summary}</p>
                                    {log.activities_done && <div className="mt-2"><p className="text-xs font-semibold text-slate-500">Actividades:</p><p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 whitespace-pre-wrap">{log.activities_done}</p></div>}
                                    {log.materials_used && <div className="mt-2"><p className="text-xs font-semibold text-slate-500">Materiales:</p><p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{log.materials_used}</p></div>}
                                    {log.photos && log.photos.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">photo_library</span>
                                                Evidencia Fotográfica ({log.photos.length})
                                            </p>
                                            <PhotoGallery photos={log.photos} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Incidents */}
            {tab === 'incidents' && (
                <div className={sectionClass}>
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Registro de Incidencias</h3>
                            {totalIncidentCost > 0 && <p className="text-xs text-red-500 mt-0.5">Impacto total: {formatCurrencyMXN(totalIncidentCost)}</p>}
                        </div>
                        <button onClick={() => setShowIncidentForm(!showIncidentForm)} className="flex items-center gap-1 rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white">
                            <span className="material-symbols-outlined text-[16px]">add</span>Reportar Incidencia
                        </button>
                    </div>

                    {showIncidentForm && (
                        <form onSubmit={handleAddIncident} className="mb-4 rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-900/10">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div><label className={labelClass}>Tipo *</label><select value={incForm.incident_type} onChange={e => setIncForm({ ...incForm, incident_type: e.target.value as IncidentType })} className={inputClass}>{(Object.keys(INCIDENT_TYPE_LABELS) as IncidentType[]).map(t => <option key={t} value={t}>{INCIDENT_TYPE_LABELS[t]}</option>)}</select></div>
                                <div><label className={labelClass}>Severidad</label><select value={incForm.severity} onChange={e => setIncForm({ ...incForm, severity: e.target.value as Severity })} className={inputClass}>{(Object.keys(SEVERITY_LABELS) as Severity[]).map(s => <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}</select></div>
                                <div><label className={labelClass}>Reportado Por</label><select value={incForm.reported_by} onChange={e => setIncForm({ ...incForm, reported_by: e.target.value })} className={inputClass}><option value="">Seleccionar...</option>{TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                                <div className="md:col-span-3"><label className={labelClass}>Título *</label><input value={incForm.title} onChange={e => setIncForm({ ...incForm, title: e.target.value })} required className={inputClass} placeholder="Ej: Llanta ponchada en camino al pozo" /></div>
                                <div className="md:col-span-3"><label className={labelClass}>Descripción</label><textarea value={incForm.description} onChange={e => setIncForm({ ...incForm, description: e.target.value })} className={inputClass + ' resize-none'} rows={2} placeholder="Detalles del incidente..." /></div>
                                <div><label className={labelClass}>Impacto en Costo (MXN)</label><input type="number" step="0.01" value={incForm.cost_impact} onChange={e => setIncForm({ ...incForm, cost_impact: e.target.value })} className={inputClass} placeholder="2500" /></div>
                                <div><label className={labelClass}>Impacto en Tiempo (hrs)</label><input type="number" step="0.5" value={incForm.time_impact} onChange={e => setIncForm({ ...incForm, time_impact: e.target.value })} className={inputClass} placeholder="3" /></div>
                                <div className="md:col-span-3">
                                    <label className={labelClass}>Evidencia Fotográfica</label>
                                    <PhotoUploader
                                        photos={incPhotos}
                                        onPhotosChange={setIncPhotos}
                                        folder={`incidents/${id}`}
                                        uploaderName={incForm.reported_by || 'Técnico'}
                                        compact
                                    />
                                </div>
                            </div>
                            <div className="mt-3 flex gap-2"><button type="submit" className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white">Registrar</button><button type="button" onClick={() => { setShowIncidentForm(false); setIncPhotos([]); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 dark:border-slate-700">Cancelar</button></div>
                        </form>
                    )}

                    {incidents.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500">No hay incidencias registradas. ¡Excelente!</div>
                    ) : (
                        <div className="space-y-3">
                            {incidents.map(inc => (
                                <div key={inc.id} className="rounded-lg border border-slate-200/60 p-4 dark:border-slate-700/60">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${SEVERITY_COLORS[inc.severity].bg}`}>
                                                <span className={`material-symbols-outlined text-[20px] ${SEVERITY_COLORS[inc.severity].text}`}>{INCIDENT_TYPE_ICONS[inc.incident_type]}</span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm text-slate-900 dark:text-white">{inc.title}</p>
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <span className={`rounded-full px-2 py-0.5 font-semibold ${SEVERITY_COLORS[inc.severity].bg} ${SEVERITY_COLORS[inc.severity].text}`}>{SEVERITY_LABELS[inc.severity]}</span>
                                                    <span>{INCIDENT_TYPE_LABELS[inc.incident_type]}</span>
                                                    {inc.reported_by && <span>• {inc.reported_by}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right text-xs">
                                            {inc.cost_impact > 0 && <p className="font-bold text-red-500">{formatCurrencyMXN(inc.cost_impact)}</p>}
                                            {inc.time_impact_hours > 0 && <p className="text-slate-400">{inc.time_impact_hours}h perdidas</p>}
                                        </div>
                                    </div>
                                    {inc.description && <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{inc.description}</p>}
                                    {inc.photos && inc.photos.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">photo_library</span>
                                                Evidencia ({inc.photos.length})
                                            </p>
                                            <PhotoGallery photos={inc.photos} />
                                        </div>
                                    )}
                                    {inc.resolved_at ? (
                                        <div className="mt-2 rounded bg-emerald-50 p-2 dark:bg-emerald-900/20">
                                            <p className="text-xs text-emerald-700 dark:text-emerald-400"><span className="font-semibold">Resolución:</span> {inc.resolution}</p>
                                        </div>
                                    ) : (
                                        <button onClick={() => { const r = prompt('Describe la resolución:'); if (r) resolveIncident(inc.id, r); }}
                                            className="mt-2 text-xs font-semibold text-primary hover:underline">Marcar como Resuelta</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Materials */}
            {tab === 'materials' && (
                <div className={sectionClass}>
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Materiales Utilizados</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Control de consumos desde inventario (M4)</p>
                        </div>
                        <button onClick={() => setShowMaterialForm(!showMaterialForm)} className="flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 transition-colors">
                            <span className="material-symbols-outlined text-[16px]">add</span>Agregar Material
                        </button>
                    </div>

                    {showMaterialForm && (
                        <form onSubmit={handleAddMaterial} className="mb-4 rounded-lg border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900/40 dark:bg-sky-900/10">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <div className="md:col-span-3">
                                    <label className={labelClass}>Material del Inventario *</label>
                                    <input 
                                        type="text" 
                                        list="inventory-products-list"
                                        required 
                                        className={inputClass} 
                                        placeholder="Buscar por código o nombre..."
                                        onChange={e => {
                                            const val = e.target.value;
                                            // Extract ID from the format "CODE - Name [ID]" if we use a datalist, 
                                            // but since datalists only submit the exact text, it's safer to use a <select> 
                                            // or let them pick from a select with searchable behavior.
                                            // A simple select is better for exact ID mapping without custom dropdown code.
                                        }}
                                        style={{ display: 'none' }} 
                                    />
                                    <select 
                                        value={matForm.product_id}
                                        onChange={e => setMatForm({ ...matForm, product_id: e.target.value })}
                                        required
                                        className={inputClass}
                                    >
                                        <option value="">Selecciona un producto...</option>
                                        {invProducts.map(p => (
                                            <option key={p.id} value={p.id} disabled={p.current_stock <= 0}>
                                                {p.code} — {p.name} ({p.current_stock > 0 ? `${p.current_stock} disponibles` : 'Agotado'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Cantidad Usada *</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        value={matForm.quantity} 
                                        onChange={e => setMatForm({ ...matForm, quantity: e.target.value })} 
                                        required 
                                        className={inputClass} 
                                        placeholder="Ej. 2.5" 
                                    />
                                </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                                <div className="text-xs text-slate-500">
                                    {matForm.product_id && matForm.quantity && invProducts.find(p => p.id === matForm.product_id) && (
                                        <span>
                                            Costo estimado: <strong className="text-slate-900 dark:text-white">
                                                {formatCurrencyInv(parseFloat(matForm.quantity) * (invProducts.find(p => p.id === matForm.product_id)?.unit_cost || 0))}
                                            </strong>
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button type="submit" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600">Registrar Consumo</button>
                                    <button type="button" onClick={() => { setShowMaterialForm(false); setMatForm({ product_id: '', quantity: '' }); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 dark:border-slate-700">Cancelar</button>
                                </div>
                            </div>
                        </form>
                    )}

                    {materialsUsed.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500">
                            <span className="material-symbols-outlined mb-2 text-[48px] text-slate-300">inventory_2</span>
                            <p>No se han registrado materiales para este proyecto.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white/50 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-500">Fecha</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-500">Código</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-500">Producto</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-500">Cantidad</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-500">Costo Unit.</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-500">Total (MXN)</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-500">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {materialsUsed.map(mov => (
                                        <tr key={mov.id} className="group transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3 text-slate-500">{new Date(mov.created_at).toLocaleDateString('es-MX')}</td>
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-sky-600 dark:text-sky-400">{mov.product?.code || '—'}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{mov.product?.name || 'Material retirado'}</td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">
                                                {mov.quantity} <span className="text-xs font-normal text-slate-400">{mov.product?.unit ? UNIT_LABELS[mov.product.unit] : ''}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-500">{formatCurrencyInv(mov.unit_cost || 0)}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{formatCurrencyInv(mov.total_cost || 0)}</td>
                                            <td className="px-4 py-3 text-slate-500">{mov.performed_by || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50/50 dark:bg-slate-800/30">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">Total Materiales:</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{formatCurrencyMXN(inventoryCost)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Viáticos */}
            {tab === 'viaticos' && (
                <div className={sectionClass}>
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Gastos de Campo</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Viáticos, refacciones urgentes y consumos de cuadrilla</p>
                        </div>
                        <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600 transition-colors">
                            <span className="material-symbols-outlined text-[16px]">add</span>Registrar Gasto
                        </button>
                    </div>

                    {showExpenseForm && (
                        <form onSubmit={handleAddExpense} className="mb-4 rounded-lg border border-orange-200 bg-orange-50/50 p-4 dark:border-orange-900/40 dark:bg-orange-900/10">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <div><label className={labelClass}>Fecha *</label><input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} className={inputClass} required /></div>
                                <div><label className={labelClass}>Responsable *</label><select value={expenseForm.employee_name} onChange={e => setExpenseForm({ ...expenseForm, employee_name: e.target.value })} required className={inputClass}><option value="">Selecciona...</option>{teamMembers.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                                <div><label className={labelClass}>Tipo de Gasto *</label><select value={expenseForm.expense_type} onChange={e => setExpenseForm({ ...expenseForm, expense_type: e.target.value as ExpenseType })} className={inputClass}>{(Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[]).map(t => <option key={t} value={t}>{EXPENSE_TYPE_LABELS[t]}</option>)}</select></div>
                                <div><label className={labelClass}>Monto (MXN) *</label><input type="number" step="0.01" value={expenseForm.amount || ''} onChange={e => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) })} required className={inputClass} placeholder="1500" /></div>
                                <div className="md:col-span-4"><label className={labelClass}>Notas / Proveedor</label><textarea value={expenseForm.notes || ''} onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })} rows={2} className={inputClass + ' resize-none'} placeholder="Ej. Comida en carretera, carga de diésel..." /></div>
                                <div className="md:col-span-4">
                                    <label className={labelClass}>Comprobante (Ticket/Factura)</label>
                                    <PhotoUploader
                                        photos={expenseForm.receipt_url ? [{ id: '1', url: expenseForm.receipt_url, context: 'evidence' }] : []}
                                        onPhotosChange={(photos) => setExpenseForm({ ...expenseForm, receipt_url: photos.length > 0 ? photos[0].url : null })}
                                        folder={`viaticos/${id}`}
                                        uploaderName={expenseForm.employee_name || 'Técnico'}
                                        compact
                                        maxPhotos={1}
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Sube 1 foto obligatoria por gasto.</p>
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end gap-2"><button type="submit" className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white">Guardar Gasto</button><button type="button" onClick={() => { setShowExpenseForm(false); setExpenseForm({ expense_type: 'comida', amount: 0, expense_date: new Date().toISOString().split('T')[0], employee_name: '' }); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 dark:border-slate-700">Cancelar</button></div>
                        </form>
                    )}

                    {expenses.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500"><span className="material-symbols-outlined mb-2 text-[48px] text-slate-300">receipt_long</span><p>No se han registrado viáticos o gastos de campo.</p></div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white/50 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-500">Fecha</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-500">Responsable</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-500">Concepto</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-500">Notas</th>
                                        <th className="px-4 py-3 text-center font-semibold text-slate-500">Ticket</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-500">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {expenses.map(exp => (
                                        <tr key={exp.id} className="group transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(exp.expense_date).toLocaleDateString('es-MX')}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">{exp.employee_name}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                                                    <span className="material-symbols-outlined text-[16px]">{EXPENSE_TYPE_ICONS[exp.expense_type] || 'payments'}</span>
                                                    <span className="font-semibold text-xs">{EXPENSE_TYPE_LABELS[exp.expense_type] || exp.expense_type}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs text-slate-500 max-w-[200px] truncate">{exp.notes || '—'}</td>
                                            <td className="px-4 py-3 text-center">
                                                {exp.receipt_url ? (
                                                    <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-1.5 rounded bg-sky-100 text-sky-600 hover:bg-sky-200 transition-colors" title="Ver Comprobante">
                                                        <span className="material-symbols-outlined text-[16px]">receipt</span>
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">{formatCurrencyMXN(exp.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50/50 dark:bg-slate-800/30">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">Total Gastos de Campo:</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{formatCurrencyMXN(expenseCost)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Vehicles */}
            {tab === 'vehicles' && (
                <div className={sectionClass}>
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Vehículos Asignados</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Asigna y controla la disponibilidad de vehículos para este proyecto</p>
                        </div>
                        <button onClick={() => {
                            setVehForm({
                                vehicle_id: '',
                                assigned_date: project.start_date || new Date().toISOString().split('T')[0],
                                release_date: project.end_date || '',
                                operator_name: '',
                                notes: ''
                            });
                            setShowVehicleForm(!showVehicleForm);
                        }} className="flex items-center gap-1 rounded-lg bg-teal-500 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-600 transition-colors">
                            <span className="material-symbols-outlined text-[16px]">add</span>Asignar Vehículo
                        </button>
                    </div>

                    {showVehicleForm && (
                        <form onSubmit={handleAssignVehicle} className="mb-6 rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50/80 to-emerald-50/50 p-5 dark:border-teal-900/40 dark:from-teal-900/20 dark:to-emerald-900/10">
                            <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-teal-800 dark:text-teal-300">
                                <span className="material-symbols-outlined text-[18px]">directions_car</span>
                                Asignar Vehículo al Proyecto
                            </h4>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Vehículo *</label>
                                    <select value={vehForm.vehicle_id} onChange={e => setVehForm({ ...vehForm, vehicle_id: e.target.value })} required className={inputClass}>
                                        <option value="">Seleccionar vehículo disponible...</option>
                                        {availableVehicles
                                            .filter(v => !projectVehicles.some(pv => pv.vehicle_id === v.id))
                                            .map(v => (
                                                <option key={v.id} value={v.id}>
                                                    {VEHICLE_TYPE_LABELS[v.vehicle_type] || v.vehicle_type} — {v.brand} {v.model} ({v.plates}) · {v.current_mileage.toLocaleString()} km
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Fecha Asignación *</label>
                                    <input type="date" value={vehForm.assigned_date} onChange={e => setVehForm({ ...vehForm, assigned_date: e.target.value })} required className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Fecha Liberación (estimada)</label>
                                    <input type="date" value={vehForm.release_date} onChange={e => setVehForm({ ...vehForm, release_date: e.target.value })} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Operador / Chofer</label>
                                    <select value={vehForm.operator_name} onChange={e => setVehForm({ ...vehForm, operator_name: e.target.value })} className={inputClass}>
                                        <option value="">Sin asignar</option>
                                        {teamMembers.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Notas</label>
                                    <input type="text" value={vehForm.notes} onChange={e => setVehForm({ ...vehForm, notes: e.target.value })} className={inputClass} placeholder="Ej. Llevar equipo de soldadura" />
                                </div>
                            </div>

                            {/* Preview del vehículo seleccionado */}
                            {vehForm.vehicle_id && (() => {
                                const sel = availableVehicles.find(v => v.id === vehForm.vehicle_id);
                                if (!sel) return null;
                                return (
                                    <div className="mt-4 flex items-center gap-4 rounded-lg border border-teal-200 bg-white/70 p-3 dark:border-teal-800 dark:bg-slate-800/50">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/40">
                                            <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 text-[24px]">{VEHICLE_TYPE_ICONS[sel.vehicle_type] || 'directions_car'}</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white">{sel.brand} {sel.model} <span className="text-xs text-slate-500">({sel.year})</span></p>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                                <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{sel.plates}</span>
                                                <span>·</span>
                                                <span>{sel.current_mileage.toLocaleString()} km</span>
                                                <span>·</span>
                                                <span>${sel.cost_per_km}/km</span>
                                            </div>
                                        </div>
                                        <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${VEHICLE_STATUS_COLORS[sel.status].bg} ${VEHICLE_STATUS_COLORS[sel.status].text}`}>
                                            {VEHICLE_STATUS_LABELS[sel.status]}
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="mt-4 flex justify-end gap-2">
                                <button type="button" onClick={() => setShowVehicleForm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 dark:border-slate-700">Cancelar</button>
                                <button type="submit" className="rounded-lg bg-teal-500 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-600 shadow-sm">Asignar Vehículo</button>
                            </div>
                        </form>
                    )}

                    {projectVehicles.length === 0 ? (
                        <div className="py-12 text-center">
                            <span className="material-symbols-outlined mb-3 text-[56px] text-slate-200 dark:text-slate-700">local_shipping</span>
                            <p className="text-sm text-slate-500">No hay vehículos asignados a este proyecto.</p>
                            <p className="text-xs text-slate-400 mt-1">Asigna un vehículo para apartarlo y controlar su disponibilidad.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {projectVehicles.map(pv => {
                                const v = pv.vehicle;
                                if (!v) return null;
                                const isActive = !pv.release_date || new Date(pv.release_date) >= new Date();
                                const vStatusColor = VEHICLE_STATUS_COLORS[v.status as keyof typeof VEHICLE_STATUS_COLORS] || VEHICLE_STATUS_COLORS.active;
                                return (
                                    <div key={pv.id} className={`group relative rounded-xl border transition-all overflow-hidden ${
                                        isActive
                                            ? 'border-teal-200 bg-gradient-to-br from-white to-teal-50/30 shadow-sm hover:shadow-md hover:border-teal-300 dark:border-teal-800/60 dark:from-slate-800 dark:to-teal-900/10'
                                            : 'border-slate-200 bg-slate-50/50 opacity-75 dark:border-slate-700 dark:bg-slate-800/30'
                                    }`}>
                                        {/* Top color bar */}
                                        <div className={`h-1.5 w-full ${isActive ? 'bg-gradient-to-r from-teal-400 to-emerald-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                        <div className="p-5">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isActive ? 'bg-teal-100 dark:bg-teal-900/40' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                                        <span className={`material-symbols-outlined text-[22px] ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`}>
                                                            {VEHICLE_TYPE_ICONS[v.vehicle_type as keyof typeof VEHICLE_TYPE_ICONS] || 'directions_car'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 dark:text-white">{v.brand} {v.model}</p>
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                                            {v.plates}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${vStatusColor.bg} ${vStatusColor.text}`}>
                                                    {VEHICLE_STATUS_LABELS[v.status as keyof typeof VEHICLE_STATUS_LABELS] || v.status}
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-2">
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <span className="material-symbols-outlined text-[14px]">event</span>
                                                    <span className="font-semibold">
                                                        {new Date(pv.assigned_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        {pv.release_date ? ` → ${new Date(pv.release_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}` : ' → Sin fecha fin'}
                                                    </span>
                                                </div>
                                                {pv.operator_name && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span className="material-symbols-outlined text-[14px]">person</span>
                                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{pv.operator_name}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[12px]">speed</span>
                                                        {v.current_mileage.toLocaleString()} km
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[12px]">paid</span>
                                                        ${v.cost_per_km}/km
                                                    </span>
                                                    <span>
                                                        {VEHICLE_TYPE_LABELS[v.vehicle_type as keyof typeof VEHICLE_TYPE_LABELS] || v.vehicle_type} · {v.year}
                                                    </span>
                                                </div>
                                                {pv.notes && (
                                                    <p className="text-xs text-slate-400 italic mt-1">{pv.notes}</p>
                                                )}
                                            </div>

                                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700/50">
                                                {isActive ? (
                                                    <span className="flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400">
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75"></span>
                                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500"></span>
                                                        </span>
                                                        En uso
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">Periodo finalizado</span>
                                                )}
                                                <button
                                                    onClick={() => handleReleaseVehicle(pv.id)}
                                                    className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-all hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">link_off</span>
                                                    Liberar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Completion Modal: Select Equipment for Maintenance Scheduling */}
            {showCompletionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCompletionModal(false)} />
                    <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">Finalizar Proyecto</h3>
                        <p className="mb-6 text-sm text-slate-500">
                            ¿Qué equipos se instalaron en este proyecto? Selecciona todas las piezas mayores. 
                            El sistema generará **automáticamente** los mantenimientos preventivos a futuro según el documento del cliente.
                        </p>
                        
                        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {(Object.keys(EQUIPMENT_TYPE_LABELS) as EquipmentType[]).map(eqType => {
                                const isSelected = selectedEqTypes.includes(eqType);
                                return (
                                    <button
                                        key={eqType}
                                        type="button"
                                        onClick={() => {
                                            if (isSelected) {
                                                setSelectedEqTypes(prev => prev.filter(t => t !== eqType));
                                            } else {
                                                setSelectedEqTypes(prev => [...prev, eqType]);
                                            }
                                        }}
                                        className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all ${
                                            isSelected
                                                ? 'border-primary bg-primary/10 text-primary dark:border-primary/50 dark:bg-primary/20'
                                                : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/50'
                                        }`}
                                    >
                                        <span className={`material-symbols-outlined text-[28px] ${isSelected ? 'text-primary' : 'text-slate-400'}`}>
                                            {/* Note: In real setup, we would import EQUIPMENT_TYPE_ICONS, but we can just use an generic icon or import it */}
                                            {eqType === 'bomba' ? 'water_pump' : eqType === 'motor' ? 'electric_bolt' : eqType === 'pozo' ? 'water_well' : eqType === 'variador' ? 'speed' : 'settings'}
                                        </span>
                                        <span className="text-xs font-semibold">{EQUIPMENT_TYPE_LABELS[eqType]}</span>
                                        <span className="text-[10px] text-slate-400">Prog. {EQUIPMENT_MAINTENANCE_RULES[eqType] || 12}m</span>
                                    </button>
                                );
                            })}
                        </div>
                        
                        <div className="flex justify-end gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setShowCompletionModal(false)}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleCompleteProject}
                                className="rounded-xl border border-transparent bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                            >
                                {selectedEqTypes.length > 0 ? `Finalizar y Configurar ${selectedEqTypes.length} Eq.` : 'Finalizar sin Equipos'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
