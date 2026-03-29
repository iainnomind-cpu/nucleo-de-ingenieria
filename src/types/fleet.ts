export type VehicleType = 'sedan' | 'pickup' | 'suv' | 'crane' | 'truck' | 'other';
export type VehicleStatus = 'active' | 'maintenance' | 'inactive';

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
    calculated_trip_cost: number;
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

export function isInsuranceExpiringSoon(endDate: string): { status: 'ok' | 'warning' | 'expired', days: number } {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { status: 'expired', days: diffDays };
    if (diffDays <= 30) return { status: 'warning', days: diffDays };
    return { status: 'ok', days: diffDays };
}
