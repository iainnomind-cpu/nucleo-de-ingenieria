export type ClientStatus = 'prospect' | 'active' | 'inactive' | 'vip' | 'overdue';
export type GrowthPotential = 'low' | 'medium' | 'high';
export type AssetType = 'well' | 'motor' | 'pump' | 'variator';
export type AssetStatus = 'active' | 'maintenance' | 'inactive';
export type PipelineStage = 'prospecting' | 'quoting' | 'negotiation' | 'closed_won' | 'closed_lost';
export type ActivityType = 'call' | 'email' | 'meeting' | 'monitoring' | 'quote' | 'project';

export interface Client {
    id: string;
    company_name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    rfc: string | null;
    address: string | null;
    formatted_address: string | null;
    latitude: number | null;
    longitude: number | null;
    industry: string | null;
    status: ClientStatus;
    payment_score: number | null;
    growth_potential: GrowthPotential | null;
    credit_days: number;
    is_trusted_client: boolean;
    created_at: string;
    updated_at: string;
}

export interface ClientAsset {
    id: string;
    client_id: string;
    asset_type: AssetType;
    name: string;
    brand: string | null;
    model: string | null;
    horsepower: number | null;
    depth: number | null;
    specifications: Record<string, unknown> | null;
    installation_date: string | null;
    status: AssetStatus;
    created_at: string;
    updated_at: string;
}

export interface SalesOpportunity {
    id: string;
    client_id: string;
    title: string;
    description: string | null;
    estimated_value: number | null;
    probability: number;
    stage: PipelineStage;
    closing_date: string | null;
    created_at: string;
    updated_at: string;
    // Joined
    client?: Client;
}

export interface ClientActivity {
    id: string;
    client_id: string;
    asset_id: string | null;
    opportunity_id: string | null;
    activity_type: ActivityType;
    title: string;
    description: string | null;
    activity_date: string;
    created_by: string | null;
    created_at: string;
}

// Helpers for UI labels
export const STATUS_LABELS: Record<ClientStatus, string> = {
    prospect: 'Prospecto',
    active: 'Activo',
    inactive: 'Inactivo',
    vip: 'VIP',
    overdue: 'Moroso',
};

export const STATUS_COLORS: Record<ClientStatus, { bg: string; text: string }> = {
    prospect: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-400' },
    active: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-400' },
    inactive: { bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-600 dark:text-slate-400' },
    vip: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-400' },
    overdue: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-400' },
};

export const STAGE_LABELS: Record<PipelineStage, string> = {
    prospecting: 'Prospección',
    quoting: 'Cotización Enviada',
    negotiation: 'Negociación',
    closed_won: 'Cierre Ganado',
    closed_lost: 'Cierre Perdido',
};

export const STAGE_COLORS: Record<PipelineStage, { bg: string; border: string; text: string }> = {
    prospecting: { bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-300 dark:border-sky-700', text: 'text-sky-700 dark:text-sky-400' },
    quoting: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-400' },
    negotiation: { bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-300 dark:border-violet-700', text: 'text-violet-700 dark:text-violet-400' },
    closed_won: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-400' },
    closed_lost: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-300 dark:border-red-700', text: 'text-red-700 dark:text-red-400' },
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
    well: 'Pozo',
    motor: 'Motor',
    pump: 'Bomba',
    variator: 'Variador',
};

export const ASSET_TYPE_ICONS: Record<AssetType, string> = {
    well: 'water_drop',
    motor: 'electric_bolt',
    pump: 'air',
    variator: 'tune',
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
    call: 'Llamada',
    email: 'Correo',
    meeting: 'Reunión',
    monitoring: 'Monitoreo',
    quote: 'Cotización',
    project: 'Proyecto',
};

export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
    call: 'phone',
    email: 'mail',
    meeting: 'groups',
    monitoring: 'monitoring',
    quote: 'request_quote',
    project: 'engineering',
};
