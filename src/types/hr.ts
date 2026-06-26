export interface HREmployee {
    id: string;
    user_id: string | null;
    full_name: string;
    department: string;
    hire_date: string | null;
    vacation_start_date: string | null;
    base_vacation_days: number;
    is_active: boolean;
    notes: string | null;
    manual_vacation_adjustment: number;
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
// Uses vacation_start_date as the reference if provided, otherwise falls back to hire_date.
export function calculateVacationDays(hireDateStr: string | null, baseDays: number = 12, vacationStartDateStr?: string | null, filterYear?: number): number {
    const refDateStr = vacationStartDateStr || hireDateStr;
    if (!refDateStr) return baseDays;
    const refDate = new Date(refDateStr);
    const targetYear = filterYear || new Date().getFullYear();
    
    let years = targetYear - refDate.getFullYear();
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

export function getCurrentAnniversaryPeriod(hireDateStr: string | null, filterYear: number, vacationStartDateStr?: string | null) {
    const refDateStr = vacationStartDateStr || hireDateStr;
    if (!refDateStr) return null;
    
    const refDate = new Date(refDateStr);
    
    // The anniversary falls in the year given by filterYear
    const currentPeriodStart = new Date(filterYear, refDate.getMonth(), refDate.getDate());
    
    // Cycle ends the day before the next anniversary
    const currentPeriodEnd = new Date(currentPeriodStart);
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() - 1);
    
    return { start: currentPeriodStart, end: currentPeriodEnd };
}

export interface HrDocumentFolder {
    id: string;
    employee_id: string;
    name: string;
    created_at: string;
}

export interface HrEmployeeDocument {
    id: string;
    employee_id: string;
    folder_id: string | null;
    file_name: string;
    file_url: string;
    file_type: string | null;
    file_size_bytes: number | null;
    uploaded_by: string | null;
    created_at: string;
}

export interface CompanyDocumentFolder {
    id: string;
    name: string;
    created_at: string;
}

export interface CompanyDocument {
    id: string;
    folder_id: string | null;
    file_name: string;
    file_url: string;
    file_type: string | null;
    file_size_bytes: number | null;
    uploaded_by: string | null;
    created_at: string;
}
