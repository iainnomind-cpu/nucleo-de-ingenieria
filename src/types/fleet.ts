export type VehicleType = 'sedan' | 'pickup' | 'suv' | 'crane' | 'truck' | 'other';
export type VehicleStatus = 'active' | 'maintenance' | 'inactive';
export type VerificationStatus = 'current' | 'pending' | 'expired';
export type ScheduleStatus = 'active' | 'paused' | 'completed';
export type SchedulePriority = 'low' | 'normal' | 'high' | 'critical';

export interface Vehicle {
    id: string;
    plates: string;
    brand: string;
    model: string;
    year: number;
    vehicle_type: VehicleType;
    status: VehicleStatus;
    assigned_to: string | null;
    cost_per_km: number;
    current_mileage: number;
    serial_number: string | null;
    dealer: string | null;
    verification_date: string | null;
    verification_status: VerificationStatus;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface VehicleInsurance {
    id: string;
    vehicle_id: string;
    policy_number: string;
    provider: string;
    start_date: string;
    end_date: string;
    cost: number;
    coverage_details: string | null;
    created_at: string;
}

export interface VehicleMileage {
    id: string;
    vehicle_id: string;
    project_id: string | null;
    driver_name: string;
    date: string;
    odometer_start: number;
    odometer_end: number;
    distance: number;
    fuel_cost: number;
    fuel_liters: number;
    calculated_trip_cost: number;
    destination: string | null;
    departure_date: string | null;
    return_date: string | null;
    fuel_level_start: number | null;
    fuel_level_end: number | null;
    notes: string | null;
    created_at: string;
}

export interface VehicleMaintenance {
    id: string;
    vehicle_id: string;
    project_id: string | null;
    service_type: string;
    service_date: string;
    cost: number;
    provider: string | null;
    odometer_reading: number | null;
    next_service_date: string | null;
    next_service_mileage: number | null;
    notes: string | null;
    invoice_url: string | null;
    created_at: string;
}

// Labels & Helpers
export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
    sedan: 'Sedán',
    pickup: 'Pick-up',
    suv: 'SUV',
    crane: 'Grúa',
    truck: 'Camión',
    other: 'Otro'
};

export const VEHICLE_TYPE_ICONS: Record<VehicleType, string> = {
    sedan: 'directions_car',
    pickup: 'airport_shuttle',
    suv: 'time_auto',
    crane: 'car_repair',
    truck: 'local_shipping',
    other: 'commute'
};

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
    active: 'Activo',
    maintenance: 'En Taller',
    inactive: 'Inactivo'
};

export const VEHICLE_STATUS_COLORS: Record<VehicleStatus, { bg: string; text: string }> = {
    active: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    maintenance: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    inactive: { bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-500 dark:text-slate-400' }
};

export const SCHEDULE_PRIORITY_LABELS: Record<SchedulePriority, string> = {
    low: 'Baja', normal: 'Normal', high: 'Alta', critical: 'Crítica'
};

export const SCHEDULE_PRIORITY_COLORS: Record<SchedulePriority, { bg: string; text: string }> = {
    low: { bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-600 dark:text-slate-400' },
    normal: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
    high: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
    current: 'Vigente', pending: 'Pendiente', expired: 'Vencida'
};

export const VERIFICATION_STATUS_COLORS: Record<VerificationStatus, { bg: string; text: string }> = {
    current: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    expired: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

export interface VehicleServiceSchedule {
    id: string;
    vehicle_id: string;
    service_name: string;
    interval_km: number | null;
    interval_months: number | null;
    last_service_date: string | null;
    last_service_mileage: number | null;
    next_due_date: string | null;
    next_due_mileage: number | null;
    status: ScheduleStatus;
    priority: SchedulePriority;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export function isInsuranceExpiringSoon(endDate: string): { status: 'ok' | 'warning' | 'expired', days: number } {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { status: 'expired', days: diffDays };
    if (diffDays <= 30) return { status: 'warning', days: diffDays };
    return { status: 'ok', days: diffDays };
}

export function getServiceScheduleStatus(schedule: VehicleServiceSchedule, currentMileage: number): {
    status: 'ok' | 'upcoming' | 'due' | 'overdue';
    trigger: 'km' | 'time' | 'both' | 'none';
    daysUntilDue: number | null;
    kmUntilDue: number | null;
} {
    const now = new Date();
    let daysUntilDue: number | null = null;
    let kmUntilDue: number | null = null;
    let timeDue = false;
    let kmDue = false;
    let timeUpcoming = false;
    let kmUpcoming = false;

    if (schedule.next_due_date) {
        const dueDate = new Date(schedule.next_due_date);
        daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue <= 0) timeDue = true;
        else if (daysUntilDue <= 15) timeUpcoming = true;
    }

    if (schedule.next_due_mileage) {
        kmUntilDue = schedule.next_due_mileage - currentMileage;
        if (kmUntilDue <= 0) kmDue = true;
        else if (kmUntilDue <= 500) kmUpcoming = true;
    }

    let status: 'ok' | 'upcoming' | 'due' | 'overdue' = 'ok';
    if (timeDue || kmDue) status = 'overdue';
    else if (timeUpcoming || kmUpcoming) status = 'upcoming';

    let trigger: 'km' | 'time' | 'both' | 'none' = 'none';
    if ((timeDue || timeUpcoming) && (kmDue || kmUpcoming)) trigger = 'both';
    else if (timeDue || timeUpcoming) trigger = 'time';
    else if (kmDue || kmUpcoming) trigger = 'km';

    return { status, trigger, daysUntilDue, kmUntilDue };
}

export function calculateEfficiency(mileageRecords: VehicleMileage[]): {
    avgKmPerLiter: number;
    totalKm: number;
    totalLiters: number;
    totalFuelCost: number;
    records: number;
} {
    const validRecords = mileageRecords.filter(m => m.fuel_liters > 0 && m.distance > 0);
    const totalKm = validRecords.reduce((s, m) => s + m.distance, 0);
    const totalLiters = validRecords.reduce((s, m) => s + m.fuel_liters, 0);
    const totalFuelCost = mileageRecords.reduce((s, m) => s + (m.fuel_cost || 0), 0);
    const avgKmPerLiter = totalLiters > 0 ? totalKm / totalLiters : 0;
    return { avgKmPerLiter, totalKm, totalLiters, totalFuelCost, records: validRecords.length };
}
