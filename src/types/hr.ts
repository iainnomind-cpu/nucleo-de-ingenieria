export interface HREmployee {
    id: string;
    user_id: string | null;
    full_name: string;
    department: string;
    hire_date: string | null;
    base_vacation_days: number;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export type AbsenceType = 'VACACIONES' | 'INCAPACIDAD MÉDICA' | 'PERMISO NO REMUNERADO' | 'LICENCIA PAGADA' | 'CAPACITACIÓN' | 'TRABAJO REMOTO' | 'VIAJE LABORAL' | 'OTRO';
export type AbsenceStatus = 'pending' | 'approved' | 'rejected';

export interface HRAbsence {
    id: string;
    employee_id: string;
    absence_type: AbsenceType;
    start_date: string;
    end_date: string | null;
    days_count: number;
    return_date: string | null;
    is_compensated: boolean;
    notes: string | null;
    status: AbsenceStatus;
    created_at: string;
    updated_at: string;
    employee?: HREmployee;
}

export const ABSENCE_TYPE_COLORS: Record<AbsenceType, { bg: string; text: string; icon: string }> = {
    'VACACIONES': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: 'flight_takeoff' },
    'INCAPACIDAD MÉDICA': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: 'medical_services' },
    'PERMISO NO REMUNERADO': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: 'money_off' },
    'LICENCIA PAGADA': { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400', icon: 'paid' },
    'CAPACITACIÓN': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', icon: 'school' },
    'TRABAJO REMOTO': { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', icon: 'home_work' },
    'VIAJE LABORAL': { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400', icon: 'luggage' },
    'OTRO': { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', icon: 'more_horiz' },
};

// Helper: Calculate accumulated vacation days based on years worked.
export function calculateVacationDays(hireDateStr: string | null, baseDays: number = 12): number {
    if (!hireDateStr) return baseDays;
    const hireDate = new Date(hireDateStr);
    const now = new Date();
    
    let years = now.getFullYear() - hireDate.getFullYear();
    if (now.getMonth() < hireDate.getMonth() || (now.getMonth() === hireDate.getMonth() && now.getDate() < hireDate.getDate())) {
        years--;
    }
    
    if (years < 1) return baseDays; // First year

    // According to new LFT (Mexico)
    let extra = 0;
    if (years <= 5) {
        extra = years * 2;
    } else {
        extra = 10 + (Math.floor((years - 6) / 5) + 1) * 2;
    }
    
    return baseDays + extra;
}
