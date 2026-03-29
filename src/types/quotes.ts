export type ServiceCategory = string;
export type QuoteStatus = 'draft' | 'sent' | 'negotiation' | 'approved' | 'rejected' | 'converted';
export type RiskLevel = 'low' | 'normal' | 'high' | 'critical';

export interface ServiceCatalogItem {
    id: string;
    name: string;
    category: ServiceCategory;
    description: string | null;
    base_price: number;
    unit: string;
    variables: Record<string, number>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Quote {
    id: string;
    quote_number: string;
    client_id: string | null;
    opportunity_id: string | null;
    version: number;
    parent_quote_id: string | null;
    status: QuoteStatus;
    title: string;
    description: string | null;
    work_type: string | null;
    well_depth: number | null;
    motor_hp: number | null;
    distance_km: number | null;
    crew_size: number;
    risk_level: RiskLevel;
    estimated_days: number;
    subtotal: number;
    margin_percent: number;
    margin_amount: number;
    discount_percent: number;
    discount_amount: number;
    tax_percent: number;
    tax_amount: number;
    total: number;
    cost_per_km: number;
    viaticos_per_person: number;
    insurance_cost: number;
    vehicle_wear: number;
    maniobra_cost: number;
    valid_until: string | null;
    notes: string | null;
    approved_by: string | null;
    approved_at: string | null;
    converted_project_id: string | null;
    created_at: string;
    updated_at: string;
    // Joined
    client?: { id: string; company_name: string; contact_name: string | null; email?: string; phone?: string; };
    items?: QuoteItem[];
    versions?: Quote[];
}

export interface QuoteItem {
    id: string;
    quote_id: string;
    service_id: string | null;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    subtotal: number;
    sort_order: number;
    created_at: string;
}

// Labels
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
    draft: 'Borrador',
    sent: 'Enviada',
    negotiation: 'Negociación',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    converted: 'Convertida a Proyecto',
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, { bg: string; text: string }> = {
    draft: { bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-600 dark:text-slate-400' },
    sent: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
    negotiation: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    approved: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
    converted: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
};

// Las etiquetas estáticas de categorías fueron removidas en favor de `system_settings` dinámico.

export const RISK_LABELS: Record<RiskLevel, string> = {
    low: 'Bajo',
    normal: 'Normal',
    high: 'Alto',
    critical: 'Crítico',
};

export const RISK_MARGIN_MULTIPLIERS: Record<RiskLevel, number> = {
    low: 0.9,
    normal: 1.0,
    high: 1.25,
    critical: 1.5,
};

// Pricing engine
export function calculateQuoteTotals(params: {
    items: { quantity: number; unit_price: number }[];
    distance_km: number;
    crew_size: number;
    estimated_days: number;
    cost_per_km: number;
    viaticos_per_person: number;
    insurance_cost: number;
    vehicle_wear: number;
    maniobra_cost: number;
    margin_percent: number;
    discount_percent: number;
    tax_percent: number;
    risk_level: RiskLevel;
    well_depth?: number;
    motor_hp?: number;
}) {
    // Sum of line items
    const itemsSubtotal = params.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

    // Operational costs
    const travelCost = (params.distance_km || 0) * params.cost_per_km * 2; // ida y vuelta
    const viaticosCost = (params.viaticos_per_person || 0) * params.crew_size * params.estimated_days;
    const operationalCosts = travelCost + viaticosCost + params.insurance_cost + params.vehicle_wear + params.maniobra_cost;

    // Depth & HP complexity factor
    let complexityFactor = 1.0;
    if (params.well_depth && params.well_depth > 100) {
        complexityFactor += (params.well_depth - 100) * 0.001; // +0.1% per meter above 100m
    }
    if (params.motor_hp && params.motor_hp > 50) {
        complexityFactor += (params.motor_hp - 50) * 0.002; // +0.2% per HP above 50
    }

    // Risk multiplier
    const riskMultiplier = RISK_MARGIN_MULTIPLIERS[params.risk_level];

    // Subtotal
    const subtotal = (itemsSubtotal + operationalCosts) * complexityFactor;

    // Margin adjusted by risk
    const effectiveMargin = params.margin_percent * riskMultiplier;
    const marginAmount = subtotal * (effectiveMargin / 100);

    // Discount
    const discountAmount = (subtotal + marginAmount) * (params.discount_percent / 100);

    // Tax
    const beforeTax = subtotal + marginAmount - discountAmount;
    const taxAmount = beforeTax * (params.tax_percent / 100);

    const total = beforeTax + taxAmount;

    return {
        subtotal: Math.round(subtotal * 100) / 100,
        margin_amount: Math.round(marginAmount * 100) / 100,
        discount_amount: Math.round(discountAmount * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
        complexity_factor: complexityFactor,
        effective_margin: effectiveMargin,
        operational_costs: operationalCosts,
        travel_cost: travelCost,
        viaticos_cost: viaticosCost,
    };
}

export function generateQuoteNumber(seq: number): string {
    const year = new Date().getFullYear();
    return `COT-${year}-${String(seq).padStart(4, '0')}`;
}

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}
