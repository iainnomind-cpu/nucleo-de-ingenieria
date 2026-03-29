export type InvoiceType = 'project' | 'maintenance' | 'service' | 'other';
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'transfer' | 'cash' | 'check' | 'card' | 'other';
export type ExpenseCategory = 'materials' | 'labor' | 'machinery' | 'transport' | 'subcontract' | 'other';

export interface Invoice {
    id: string;
    invoice_number: string;
    client_id: string | null;
    project_id: string | null;
    contract_id: string | null;
    invoice_type: InvoiceType;
    status: InvoiceStatus;
    issue_date: string;
    due_date: string;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    amount_paid: number;
    balance: number;
    currency: string;
    payment_terms: string | null;
    client_rfc: string | null;
    client_fiscal_name: string | null;
    client_fiscal_address: string | null;
    cfdi_use: string | null;
    notes: string | null;
    cancelled_at: string | null;
    created_at: string;
    updated_at: string;
    client?: { id: string; company_name: string };
    project?: { id: string; project_number: string; title: string };
    payments?: Payment[];
}

export interface Payment {
    id: string;
    invoice_id: string;
    payment_date: string;
    amount: number;
    payment_method: PaymentMethod;
    reference: string | null;
    notes: string | null;
    received_by: string | null;
    created_at: string;
}

export interface ProjectExpense {
    id: string;
    project_id: string;
    category: ExpenseCategory;
    description: string;
    amount: number;
    expense_date: string;
    supplier: string | null;
    receipt_number: string | null;
    notes: string | null;
    recorded_by: string | null;
    created_at: string;
}

// Labels
export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
    project: 'Proyecto', maintenance: 'Mantenimiento', service: 'Servicio', other: 'Otro',
};
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
    draft: 'Borrador', sent: 'Enviada', partial: 'Pago Parcial', paid: 'Pagada', overdue: 'Vencida', cancelled: 'Cancelada',
};
export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string }> = {
    draft: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400' },
    sent: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
    partial: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    paid: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    overdue: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
    cancelled: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-400' },
};
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
    transfer: 'Transferencia', cash: 'Efectivo', check: 'Cheque', card: 'Tarjeta', other: 'Otro',
};
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
    materials: 'Materiales', labor: 'Mano de Obra', machinery: 'Maquinaria', transport: 'Transporte', subcontract: 'Subcontrato', other: 'Otro',
};
export const EXPENSE_CATEGORY_ICONS: Record<ExpenseCategory, string> = {
    materials: 'inventory', labor: 'group', machinery: 'precision_manufacturing', transport: 'local_shipping', subcontract: 'handshake', other: 'receipt',
};

// Aging helpers
export type AgingBucket = '0-30' | '30-60' | '60-90' | '90+';
export function getAgingBucket(dueDate: string): AgingBucket {
    const days = Math.ceil((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 30) return '0-30';
    if (days <= 60) return '30-60';
    if (days <= 90) return '60-90';
    return '90+';
}
export const AGING_LABELS: Record<AgingBucket, string> = { '0-30': '0-30 días', '30-60': '30-60 días', '60-90': '60-90 días', '90+': '+90 días' };
export const AGING_COLORS: Record<AgingBucket, string> = { '0-30': 'from-emerald-500 to-teal-500', '30-60': 'from-amber-500 to-orange-500', '60-90': 'from-red-400 to-rose-500', '90+': 'from-red-600 to-red-800' };

export function formatCurrencyFin(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}
