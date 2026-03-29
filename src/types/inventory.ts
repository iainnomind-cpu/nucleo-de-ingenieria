export type ProductCategory = 'ferreteria' | 'hidraulica' | 'electrica' | 'herramienta' | 'consumible' | 'otro';
export type ProductUnit = 'pieza' | 'metro' | 'litro' | 'kg' | 'rollo' | 'tramo' | 'caja';
export type Criticality = 'normal' | 'high_rotation' | 'critical_path';
export type MovementType = 'entry' | 'exit' | 'adjustment';
export type MovementReason = 'purchase' | 'project_consumption' | 'return' | 'adjustment' | 'damaged' | 'initial';
export type PurchaseStatus = 'pending' | 'ordered' | 'received' | 'cancelled';

export interface InventoryProduct {
    id: string;
    code: string;
    name: string;
    description: string | null;
    category: ProductCategory;
    subcategory: string | null;
    unit: ProductUnit;
    current_stock: number;
    min_stock: number;
    max_stock: number | null;
    unit_cost: number;
    last_purchase_price: number | null;
    supplier: string | null;
    location: string | null;
    criticality: Criticality;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface InventoryMovement {
    id: string;
    product_id: string;
    movement_type: MovementType;
    quantity: number;
    unit_cost: number | null;
    total_cost: number | null;
    reason: MovementReason | null;
    reference_id: string | null;
    reference_type: string | null;
    reference_number: string | null;
    notes: string | null;
    performed_by: string | null;
    created_at: string;
    product?: InventoryProduct;
}

export interface PurchaseListItem {
    id: string;
    product_id: string;
    quantity_needed: number;
    quantity_to_buy: number | null;
    estimated_cost: number | null;
    supplier: string | null;
    priority: string;
    status: PurchaseStatus;
    project_id: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    product?: InventoryProduct;
}

// Labels
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
    ferreteria: 'Ferretería',
    hidraulica: 'Hidráulica',
    electrica: 'Eléctrica',
    herramienta: 'Herramienta',
    consumible: 'Consumible',
    otro: 'Otro',
};

export const CATEGORY_ICONS: Record<ProductCategory, string> = {
    ferreteria: 'hardware',
    hidraulica: 'water_drop',
    electrica: 'bolt',
    herramienta: 'construction',
    consumible: 'local_drink',
    otro: 'category',
};

export const UNIT_LABELS: Record<ProductUnit, string> = {
    pieza: 'Pieza', metro: 'Metro', litro: 'Litro', kg: 'Kilogramo', rollo: 'Rollo', tramo: 'Tramo', caja: 'Caja',
};

export const CRITICALITY_LABELS: Record<Criticality, string> = {
    normal: 'Normal',
    high_rotation: 'Alta Rotación',
    critical_path: 'Ruta Crítica',
};

export const CRITICALITY_COLORS: Record<Criticality, { bg: string; text: string }> = {
    normal: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400' },
    high_rotation: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    critical_path: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
    entry: 'Entrada', exit: 'Salida', adjustment: 'Ajuste',
};

export const MOVEMENT_TYPE_COLORS: Record<MovementType, string> = {
    entry: 'text-emerald-600', exit: 'text-red-500', adjustment: 'text-amber-500',
};

export const REASON_LABELS: Record<MovementReason, string> = {
    purchase: 'Compra', project_consumption: 'Consumo Proyecto', return: 'Devolución',
    adjustment: 'Ajuste', damaged: 'Dañado', initial: 'Inventario Inicial',
};

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
    pending: 'Pendiente', ordered: 'Ordenado', received: 'Recibido', cancelled: 'Cancelado',
};

export const PURCHASE_STATUS_COLORS: Record<PurchaseStatus, { bg: string; text: string }> = {
    pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
    ordered: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-400' },
    received: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

// Semáforo helper
export type StockStatus = 'ok' | 'low' | 'out' | 'critical';
export function getStockStatus(product: InventoryProduct): StockStatus {
    if (product.current_stock <= 0 && product.criticality === 'critical_path') return 'critical';
    if (product.current_stock <= 0) return 'out';
    if (product.current_stock <= product.min_stock) return 'low';
    return 'ok';
}

export const STOCK_STATUS_CONFIG: Record<StockStatus, { label: string; color: string; bg: string; icon: string }> = {
    ok: { label: 'OK', color: 'text-emerald-600', bg: 'bg-emerald-500', icon: '🟢' },
    low: { label: 'Stock Mínimo', color: 'text-amber-600', bg: 'bg-amber-500', icon: '🟡' },
    out: { label: 'Agotado', color: 'text-red-600', bg: 'bg-red-500', icon: '🔴' },
    critical: { label: 'Crítico', color: 'text-slate-900', bg: 'bg-slate-800', icon: '⚫' },
};

export function formatCurrencyInv(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}
