export type ProjectStatus = 'pending' | 'preparation' | 'in_field' | 'completed' | 'invoiced' | 'cancelled';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type IncidentType = 'tire' | 'leak' | 'delay' | 'equipment' | 'weather' | 'other';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'windy';
export type ExpenseType = 'comida' | 'hospedaje' | 'combustible' | 'refaccion' | 'peaje' | 'otro';

export interface Project {
    id: string;
    project_number: string;
    quote_id: string | null;
    client_id: string | null;
    title: string;
    description: string | null;
    work_type: string | null;
    status: ProjectStatus;
    priority: Priority;
    well_depth: number | null;
    motor_hp: number | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    actual_start: string | null;
    actual_end: string | null;
    estimated_days: number;
    project_manager: string | null;
    assigned_team: string[];
    quoted_amount: number;
    actual_cost: number;
    checklist_invoice: boolean;
    checklist_materials: boolean;
    checklist_vehicle: boolean;
    checklist_team: boolean;
    checklist_completed_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    client?: { id: string; company_name: string };
}

export interface ProjectTask {
    id: string;
    project_id: string;
    title: string;
    description: string | null;
    assigned_to: string | null;
    status: TaskStatus;
    priority: Priority;
    due_date: string | null;
    completed_at: string | null;
    estimated_hours: number | null;
    actual_hours: number | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface FieldLog {
    id: string;
    project_id: string;
    log_date: string;
    author: string | null;
    weather: Weather | null;
    arrival_time: string | null;
    departure_time: string | null;
    summary: string;
    activities_done: string | null;
    materials_used: string | null;
    pump_test_data: Record<string, unknown> | null;
    photos: string[];
    created_at: string;
}

export interface ProjectIncident {
    id: string;
    project_id: string;
    incident_type: IncidentType;
    severity: Severity;
    title: string;
    description: string | null;
    cost_impact: number;
    time_impact_hours: number;
    resolution: string | null;
    resolved_at: string | null;
    reported_by: string | null;
    photos: unknown[];
    created_at: string;
}

export interface FieldExpense {
    id: string;
    project_id: string;
    employee_name: string;
    expense_type: ExpenseType;
    amount: number;
    expense_date: string;
    receipt_url: string | null;
    authorized_by: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface ProjectVehicle {
    id: string;
    project_id: string;
    vehicle_id: string;
    assigned_date: string;
    release_date: string | null;
    operator_name: string | null;
    notes: string | null;
    created_at: string;
    vehicle?: {
        id: string;
        plates: string;
        brand: string;
        model: string;
        year: number;
        vehicle_type: string;
        status: string;
        cost_per_km: number;
        current_mileage: number;
    };
}

// Labels
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
    pending: 'Pendiente',
    preparation: 'En Preparación',
    in_field: 'En Campo',
    completed: 'Finalizado',
    invoiced: 'Facturado',
    cancelled: 'Cancelado',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, { bg: string; text: string }> = {
    pending: { bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-600 dark:text-slate-400' },
    preparation: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    in_field: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
    completed: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    invoiced: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
    cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

export const PROJECT_STATUS_ICONS: Record<ProjectStatus, string> = {
    pending: 'schedule',
    preparation: 'construction',
    in_field: 'engineering',
    completed: 'check_circle',
    invoiced: 'receipt',
    cancelled: 'cancel',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
    pending: 'Pendiente',
    in_progress: 'En Progreso',
    completed: 'Completada',
    blocked: 'Bloqueada',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, { bg: string; text: string }> = {
    pending: { bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-600 dark:text-slate-400' },
    in_progress: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
    completed: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    blocked: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

export const PRIORITY_LABELS: Record<Priority, string> = {
    low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
    low: 'text-slate-500', normal: 'text-sky-500', high: 'text-amber-500', urgent: 'text-red-500',
};

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
    tire: 'Llanta', leak: 'Fuga', delay: 'Retraso', equipment: 'Equipo', weather: 'Clima', other: 'Otro',
};

export const INCIDENT_TYPE_ICONS: Record<IncidentType, string> = {
    tire: 'tire_repair', leak: 'water_damage', delay: 'timer_off', equipment: 'build', weather: 'thunderstorm', other: 'report',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
    low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica',
};

export const SEVERITY_COLORS: Record<Severity, { bg: string; text: string }> = {
    low: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400' },
    medium: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    high: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
    critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

export const WEATHER_LABELS: Record<Weather, string> = {
    sunny: 'Soleado', cloudy: 'Nublado', rainy: 'Lluvioso', windy: 'Ventoso',
};

export const WEATHER_ICONS: Record<Weather, string> = {
    sunny: 'wb_sunny', cloudy: 'cloud', rainy: 'rainy', windy: 'air',
};

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
    comida: 'Viáticos (Alimentación)', hospedaje: 'Hospedaje', combustible: 'Combustible', 
    refaccion: 'Refacción de Emergencia', peaje: 'Peajes / Casetas', otro: 'Otro'
};

export const EXPENSE_TYPE_ICONS: Record<ExpenseType, string> = {
    comida: 'restaurant', hospedaje: 'hotel', combustible: 'local_gas_station',
    refaccion: 'build_circle', peaje: 'toll', otro: 'receipt_long'
};

// Team members (Legacy fallback)
export const TEAM_MEMBERS = ['Samara', 'Paulina', 'Joel', 'Alejandro'];

export function formatCurrencyMXN(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}
