// ============================================================
// Tipos para el módulo de Reparaciones — Flujo completo Núcleo
// Recoger → Enviar → Diagnóstico → Cotizar → Autorizar → OC → Reparar → Regreso → Entregar → Facturar
// ============================================================

export type RepairStatus =
    | 'reported'
    | 'pickup_pending' | 'picked_up'
    | 'sent_to_provider' | 'received_by_provider'
    | 'diagnosis_received'
    | 'quoted' | 'authorized' | 'po_sent'
    | 'in_repair'
    | 'return_shipped' | 'return_received'
    | 'delivered'
    | 'invoiced'
    | 'completed' | 'cancelled';

export type FailureType = 'electrical' | 'mechanical' | 'hydraulic' | 'electronic' | 'structural' | 'other';
export type RepairUrgency = 'critical' | 'high' | 'normal' | 'low';
export type RepairLocation = 'internal' | 'external';
export type PickupMethod = 'crane' | 'pickup' | 'client_delivers' | 'other';
export type PartSource = 'inventory' | 'purchased' | 'client_provided';
export type TimelineEventType = 'status_change' | 'note' | 'photo' | 'cost_update' | 'part_added' | 'shipping' | 'document';

export interface EquipmentRepair {
    id: string;
    equipment_id: string | null;
    external_equipment_name: string | null;
    client_id: string | null;
    external_client_name: string | null;
    // 1) Reporte
    report_date: string;
    reported_by: string | null;
    failure_description: string;
    failure_type: FailureType;
    urgency: RepairUrgency;
    photos_before: unknown[];
    // 2) Recolección
    pickup_date: string | null;
    pickup_location: string | null;
    pickup_method: PickupMethod;
    // 3) Envío al proveedor
    external_provider: string | null;
    shipping_carrier_to: string | null;
    tracking_number_to: string | null;
    sent_to_provider_date: string | null;
    provider_received_date: string | null;
    // 4) Diagnóstico
    diagnosis: string | null;
    diagnosis_date: string | null;
    diagnosis_documents: unknown[];
    // 5) Cotización
    quote_amount: number;
    quote_date: string | null;
    quote_notes: string | null;
    quote_document_url: string | null;
    // 6) Autorización y OC
    authorization_date: string | null;
    authorized_by: string | null;
    purchase_order_number: string | null;
    purchase_order_date: string | null;
    purchase_order_url: string | null;
    // 7) Reparación
    repair_start_date: string | null;
    estimated_days: number | null;
    repair_location: RepairLocation;
    // 8) Regreso
    shipping_carrier_return: string | null;
    tracking_number_return: string | null;
    return_shipped_date: string | null;
    return_received_date: string | null;
    // 9) Entrega
    delivery_date: string | null;
    delivery_notes: string | null;
    // 10) Facturación
    invoice_number: string | null;
    invoice_date: string | null;
    invoice_amount: number;
    invoice_url: string | null;
    // Costos
    parts_cost: number;
    labor_cost: number;
    external_cost: number;
    other_cost: number;
    // Garantía
    is_warranty_claim: boolean;
    warranty_id: string | null;
    // Resolución
    resolution_notes: string | null;
    photos_after: unknown[];
    completion_date: string | null;
    // Estado
    status: RepairStatus;
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
    // Joins
    equipment?: { id: string; name: string; well_name: string | null; equipment_type: string; brand: string | null; model: string | null; serial_number: string | null };
    client?: { id: string; company_name: string };
}

export interface RepairPart {
    id: string;
    repair_id: string;
    part_name: string;
    part_number: string | null;
    quantity: number;
    unit_cost: number;
    source: PartSource;
    inventory_item_id: string | null;
    notes: string | null;
    created_at: string;
}

export interface RepairTimelineEvent {
    id: string;
    repair_id: string;
    event_type: TimelineEventType;
    description: string | null;
    old_status: string | null;
    new_status: string | null;
    created_by: string | null;
    photos: unknown[];
    created_at: string;
}

export interface ExternalWorkshop {
    id: string;
    name: string;
    contact_phone: string | null;
    contact_email: string | null;
    address: string | null;
    specialty: string | null;
    created_at: string;
}

export interface ShippingCarrier {
    id: string;
    name: string;
    tracking_url_template: string | null;
    created_at: string;
}

// ============================================================
// Labels & Colors — Full workflow
// ============================================================

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
    reported: 'Reportada',
    pickup_pending: 'Pend. Recoger',
    picked_up: 'Recogido',
    sent_to_provider: 'Enviado a Proveedor',
    received_by_provider: 'Proveedor Recibió',
    diagnosis_received: 'Diagnóstico Recibido',
    quoted: 'Cotizado',
    authorized: 'Autorizado',
    po_sent: 'OC Enviada',
    in_repair: 'En Reparación',
    return_shipped: 'Regreso Enviado',
    return_received: 'Regreso Recibido',
    delivered: 'Entregado a Cliente',
    invoiced: 'Facturado',
    completed: 'Completada',
    cancelled: 'Cancelada',
};

export const REPAIR_STATUS_COLORS: Record<RepairStatus, { bg: string; text: string; icon: string; kanban: string }> = {
    reported:             { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: 'report', kanban: 'border-t-red-500' },
    pickup_pending:       { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', icon: 'schedule', kanban: 'border-t-orange-500' },
    picked_up:            { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: 'local_shipping', kanban: 'border-t-amber-500' },
    sent_to_provider:     { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400', icon: 'flight_takeoff', kanban: 'border-t-sky-500' },
    received_by_provider: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: 'inventory', kanban: 'border-t-blue-500' },
    diagnosis_received:   { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', icon: 'troubleshoot', kanban: 'border-t-indigo-500' },
    quoted:               { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', icon: 'request_quote', kanban: 'border-t-purple-500' },
    authorized:           { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30', text: 'text-fuchsia-700 dark:text-fuchsia-400', icon: 'verified', kanban: 'border-t-fuchsia-500' },
    po_sent:              { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-400', icon: 'description', kanban: 'border-t-pink-500' },
    in_repair:            { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', icon: 'construction', kanban: 'border-t-yellow-500' },
    return_shipped:       { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400', icon: 'flight_land', kanban: 'border-t-teal-500' },
    return_received:      { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400', icon: 'done_all', kanban: 'border-t-cyan-500' },
    delivered:            { bg: 'bg-lime-100 dark:bg-lime-900/30', text: 'text-lime-700 dark:text-lime-400', icon: 'handshake', kanban: 'border-t-lime-500' },
    invoiced:             { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: 'receipt_long', kanban: 'border-t-emerald-600' },
    completed:            { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: 'check_circle', kanban: 'border-t-green-500' },
    cancelled:            { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-400', icon: 'cancel', kanban: 'border-t-slate-400' },
};

export const REPAIR_STATUS_ORDER: RepairStatus[] = [
    'reported', 'pickup_pending', 'picked_up',
    'sent_to_provider', 'received_by_provider',
    'diagnosis_received', 'quoted', 'authorized', 'po_sent',
    'in_repair',
    'return_shipped', 'return_received',
    'delivered', 'invoiced', 'completed', 'cancelled',
];

// Kanban groups — para no tener 16 columnas, agrupamos en fases
export type KanbanPhase = 'logistics_out' | 'diagnosis_quote' | 'repair' | 'logistics_return' | 'closing';
export const KANBAN_PHASES: { key: KanbanPhase; label: string; icon: string; statuses: RepairStatus[]; color: string }[] = [
    { key: 'logistics_out', label: 'Logística Envío', icon: 'local_shipping', statuses: ['reported', 'pickup_pending', 'picked_up', 'sent_to_provider', 'received_by_provider'], color: 'border-t-sky-500' },
    { key: 'diagnosis_quote', label: 'Diagnóstico y Cotización', icon: 'troubleshoot', statuses: ['diagnosis_received', 'quoted', 'authorized', 'po_sent'], color: 'border-t-purple-500' },
    { key: 'repair', label: 'En Reparación', icon: 'construction', statuses: ['in_repair'], color: 'border-t-amber-500' },
    { key: 'logistics_return', label: 'Logística Regreso', icon: 'flight_land', statuses: ['return_shipped', 'return_received', 'delivered'], color: 'border-t-teal-500' },
    { key: 'closing', label: 'Cierre', icon: 'check_circle', statuses: ['invoiced', 'completed'], color: 'border-t-emerald-500' },
];

// Next status transitions (what buttons to show)
export const NEXT_STATUS_MAP: Partial<Record<RepairStatus, RepairStatus[]>> = {
    reported: ['pickup_pending'],
    pickup_pending: ['picked_up'],
    picked_up: ['sent_to_provider'],
    sent_to_provider: ['received_by_provider'],
    received_by_provider: ['diagnosis_received'],
    diagnosis_received: ['quoted'],
    quoted: ['authorized'],
    authorized: ['po_sent'],
    po_sent: ['in_repair'],
    in_repair: ['return_shipped'],
    return_shipped: ['return_received'],
    return_received: ['delivered'],
    delivered: ['invoiced'],
    invoiced: ['completed'],
};

export const FAILURE_TYPE_LABELS: Record<FailureType, string> = {
    electrical: 'Eléctrica', mechanical: 'Mecánica', hydraulic: 'Hidráulica',
    electronic: 'Electrónica', structural: 'Estructural', other: 'Otra',
};
export const FAILURE_TYPE_ICONS: Record<FailureType, string> = {
    electrical: 'electric_bolt', mechanical: 'settings', hydraulic: 'water_drop',
    electronic: 'memory', structural: 'foundation', other: 'help',
};

export const URGENCY_LABELS: Record<RepairUrgency, string> = {
    critical: 'Crítica', high: 'Alta', normal: 'Normal', low: 'Baja',
};
export const URGENCY_COLORS: Record<RepairUrgency, { bg: string; text: string; dot: string }> = {
    critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
    high:     { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
    normal:   { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400', dot: 'bg-sky-500' },
    low:      { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
};

export const PICKUP_METHOD_LABELS: Record<PickupMethod, string> = {
    crane: 'Grúa', pickup: 'Recolección', client_delivers: 'Cliente Entrega', other: 'Otro',
};

export const REPAIR_LOCATION_LABELS: Record<RepairLocation, string> = {
    internal: 'Reparación Interna', external: 'Taller Externo',
};
export const PART_SOURCE_LABELS: Record<PartSource, string> = {
    inventory: 'Del Inventario', purchased: 'Comprada', client_provided: 'Proporcionada por Cliente',
};

export function formatCurrencyRepair(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}

export function getRepairTotalCost(r: EquipmentRepair): number {
    return (r.parts_cost || 0) + (r.labor_cost || 0) + (r.external_cost || 0) + (r.other_cost || 0);
}

export function getRepairDaysElapsed(reportDate: string): number {
    return Math.floor((Date.now() - new Date(reportDate).getTime()) / (1000 * 60 * 60 * 24));
}
