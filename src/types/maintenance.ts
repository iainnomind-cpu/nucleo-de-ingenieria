export type EquipmentType = 'variador' | 'ventilador' | 'bomba' | 'motor' | 'tablero' | 'cable' | 'tuberia' | 'pozo' | 'otro';
export type EquipmentStatus = 'active' | 'maintenance' | 'inactive' | 'replaced';
export type ServiceType = 'revision_general' | 'variador' | 'ventilador' | 'termografia' | 'ppm' | 'videograbacion' | 'otro';
export type ScheduleStatus = 'scheduled' | 'notified' | 'confirmed' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
export type WarrantyType = 'supplier' | 'nucleo';
export type WarrantyStatus = 'active' | 'expired' | 'claimed' | 'void';
export type ContractStatus = 'draft' | 'active' | 'paused' | 'expired' | 'cancelled';
export type BillingType = 'monthly' | 'annual' | 'per_service';

export const EQUIPMENT_MAINTENANCE_RULES: Record<EquipmentType, number> = {
    bomba: 6,      // 6 meses
    motor: 12,     // 12 meses
    variador: 12,  // 12 meses
    ventilador: 6, // 6 meses
    tablero: 12,   // 12 meses
    cable: 24,     // 24 meses
    tuberia: 24,   // 24 meses
    pozo: 12,      // 12 meses
    otro: 12,      // 12 meses
};

export interface InstalledEquipment {
    id: string;
    client_id: string | null;
    project_id: string | null;
    name: string;
    equipment_type: EquipmentType;
    brand: string | null;
    model: string | null;
    serial_number: string | null;
    well_name: string | null;
    installation_date: string | null;
    location: string | null;
    specs: Record<string, unknown>;
    status: EquipmentStatus;
    notes: string | null;
    created_at: string;
    updated_at: string;
    client?: { id: string; company_name: string };
}

export interface MaintenanceSchedule {
    id: string;
    equipment_id: string;
    client_id: string | null;
    service_type: ServiceType;
    title: string;
    description: string | null;
    frequency_months: number;
    last_service_date: string | null;
    next_service_date: string;
    alert_days_before: number;
    assigned_to: string | null;
    status: ScheduleStatus;
    completed_at: string | null;
    completion_notes: string | null;
    cost: number | null;
    created_at: string;
    updated_at: string;
    equipment?: InstalledEquipment;
    client?: { id: string; company_name: string };
}

export interface MonitoringLog {
    id: string;
    equipment_id: string;
    log_date: string;
    recorded_by: string | null;
    static_level: number | null;
    dynamic_level: number | null;
    amperage: number | null; // Mantenido para retrocompatibilidad
    amperage_a1: number | null;
    amperage_a2: number | null;
    amperage_a3: number | null;
    amperage_unbalance: number | null;
    voltage: number | null; // Mantenido para retrocompatibilidad
    voltage_l1: number | null;
    voltage_l2: number | null;
    voltage_l3: number | null;
    voltage_unbalance: number | null;
    flow_rate: number | null;
    pressure: number | null;
    ppm: number | null;
    insulation_resistance: number | null;
    kw: number | null;
    motor_torque: number | null;
    temperature: number | null;
    frequency: number | null;
    observations: string | null;
    photos: string[];
    created_at: string;
}

export interface VideoRecording {
    id: string;
    equipment_id: string;
    recording_date: string;
    recorded_by: string | null;
    grid_depth: number | null;
    static_level: number | null;
    bottom_depth: number | null;
    casing_observations: string | null;
    video_url: string | null;
    created_at: string;
}

export interface EquipmentWarranty {
    id: string;
    equipment_id: string;
    warranty_type: WarrantyType;
    provider: string | null;
    start_date: string;
    end_date: string;
    coverage: string | null;
    conditions: string | null;
    document_url: string | null;
    status: WarrantyStatus;
    alert_days_before: number;
    created_at: string;
    equipment?: InstalledEquipment;
}

export interface MaintenanceContract {
    id: string;
    client_id: string | null;
    contract_number: string | null;
    title: string;
    description: string | null;
    billing_type: BillingType;
    monthly_amount: number;
    annual_amount: number;
    start_date: string;
    end_date: string | null;
    auto_renew: boolean;
    status: ContractStatus;
    included_services: string[];
    equipment_ids: string[];
    notes: string | null;
    created_at: string;
    updated_at: string;
    client?: { id: string; company_name: string };
}

// Labels
export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
    variador: 'Variador de Frecuencia', ventilador: 'Ventilador', bomba: 'Bomba',
    motor: 'Motor', tablero: 'Tablero Eléctrico', cable: 'Cable', tuberia: 'Tubería', pozo: 'Pozo de Agua', otro: 'Otro',
};
export const EQUIPMENT_TYPE_ICONS: Record<EquipmentType, string> = {
    variador: 'speed', ventilador: 'mode_fan', bomba: 'water_pump', motor: 'electric_bolt',
    tablero: 'electrical_services', cable: 'cable', tuberia: 'plumbing', pozo: 'water_well', otro: 'settings',
};
export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
    active: 'Activo', maintenance: 'En Mantenimiento', inactive: 'Inactivo', replaced: 'Reemplazado',
};
export const EQUIPMENT_STATUS_COLORS: Record<EquipmentStatus, { bg: string; text: string }> = {
    active: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    maintenance: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    inactive: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400' },
    replaced: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
    revision_general: 'Revisión General', variador: 'Variador de Frecuencia', ventilador: 'Ventilador',
    termografia: 'Termografía', ppm: 'Prueba PPM', videograbacion: 'Videograbación', otro: 'Otro',
};
export const SERVICE_TYPE_ICONS: Record<ServiceType, string> = {
    revision_general: 'checklist', variador: 'speed', ventilador: 'mode_fan',
    termografia: 'device_thermostat', ppm: 'science', videograbacion: 'videocam', otro: 'build',
};
export const SERVICE_FREQUENCY: Record<ServiceType, number> = {
    revision_general: 1, variador: 12, ventilador: 8, termografia: 6, ppm: 3, videograbacion: 12, otro: 12,
};

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
    scheduled: 'Programado', notified: 'Notificado', confirmed: 'Confirmado',
    in_progress: 'En Proceso', completed: 'Completado', overdue: 'Vencido', cancelled: 'Cancelado',
};
export const SCHEDULE_STATUS_COLORS: Record<ScheduleStatus, { bg: string; text: string }> = {
    scheduled: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
    notified: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400' },
    confirmed: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400' },
    in_progress: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    completed: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    overdue: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
    cancelled: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-400' },
};

export const WARRANTY_TYPE_LABELS: Record<WarrantyType, string> = { supplier: 'Proveedor (1 año)', nucleo: 'Núcleo (2 años)' };
export const WARRANTY_STATUS_LABELS: Record<WarrantyStatus, string> = { active: 'Vigente', expired: 'Expirada', claimed: 'Reclamada', void: 'Anulada' };
export const WARRANTY_STATUS_COLORS: Record<WarrantyStatus, { bg: string; text: string }> = {
    active: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    expired: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-400' },
    claimed: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    void: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = { draft: 'Borrador', active: 'Activo', paused: 'Pausado', expired: 'Expirado', cancelled: 'Cancelado' };
export const CONTRACT_STATUS_COLORS: Record<ContractStatus, { bg: string; text: string }> = {
    draft: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400' },
    active: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    paused: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    expired: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-400' },
    cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};
export const BILLING_TYPE_LABELS: Record<BillingType, string> = { monthly: 'Mensual', annual: 'Anual', per_service: 'Por Servicio' };

// Monitoring fields for display
export const MONITORING_FIELDS = [
    { key: 'static_level', label: 'Nivel Estático', unit: 'm', icon: 'water' },
    { key: 'dynamic_level', label: 'Nivel Dinámico', unit: 'm', icon: 'waves' },
    { key: 'amperage', label: 'Amperaje', unit: 'A', icon: 'electric_bolt' },
    { key: 'voltage', label: 'Voltaje', unit: 'V', icon: 'bolt' },
    { key: 'flow_rate', label: 'Caudal', unit: 'L/s', icon: 'water_drop' },
    { key: 'pressure', label: 'Presión', unit: 'PSI', icon: 'speed' },
    { key: 'ppm', label: 'PPM', unit: 'ppm', icon: 'science' },
    { key: 'insulation_resistance', label: 'Resist. Aislamiento', unit: 'MΩ', icon: 'shield' },
    { key: 'kw', label: 'Potencia', unit: 'kW', icon: 'power' },
    { key: 'motor_torque', label: 'Par Motor', unit: 'Nm', icon: 'settings' },
    { key: 'temperature', label: 'Temperatura', unit: '°C', icon: 'thermostat' },
    { key: 'frequency', label: 'Frecuencia', unit: 'Hz', icon: 'graphic_eq' },
] as const;

export function formatCurrencyMaint(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}

export function getDaysUntil(dateStr: string): number {
    const d = new Date(dateStr);
    const now = new Date();
    return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getUrgencyColor(days: number): string {
    if (days < 0) return 'text-red-600';
    if (days <= 7) return 'text-red-500';
    if (days <= 15) return 'text-amber-500';
    if (days <= 30) return 'text-sky-500';
    return 'text-slate-400';
}
