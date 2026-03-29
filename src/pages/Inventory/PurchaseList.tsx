import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    InventoryProduct,
    PurchaseListItem,
    PurchaseStatus,
    PURCHASE_STATUS_LABELS,
    PURCHASE_STATUS_COLORS,
    getStockStatus,
    STOCK_STATUS_CONFIG,
    formatCurrencyInv,
} from '../../types/inventory';

export default function PurchaseList() {
    const navigate = useNavigate();
    const [items, setItems] = useState<(PurchaseListItem & { product?: InventoryProduct })[]>([]);
    const [lowStockProducts, setLowStockProducts] = useState<InventoryProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<PurchaseStatus | 'all'>('all');

    const fetchAll = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('purchase_list_items').select('*, product:inventory_products(*)').order('created_at', { ascending: false });
        if (filterStatus !== 'all') q = q.eq('status', filterStatus);
        const { data } = await q;
        setItems(data || []);

        // Also get low/out products not yet in purchase list
        const { data: products } = await supabase.from('inventory_products').select('*').eq('is_active', true);
        if (products) {
            const lowProducts = (products as InventoryProduct[]).filter(p => {
                const st = getStockStatus(p);
                return st === 'low' || st === 'out' || st === 'critical';
            });
            setLowStockProducts(lowProducts);
        }
        setLoading(false);
    }, [filterStatus]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const addToPurchaseList = async (product: InventoryProduct) => {
        const qtyNeeded = Math.max(0, product.min_stock * 2 - product.current_stock);
        await supabase.from('purchase_list_items').insert({
            product_id: product.id,
            quantity_needed: qtyNeeded,
            quantity_to_buy: qtyNeeded,
            estimated_cost: qtyNeeded * product.unit_cost,
            supplier: product.supplier,
            priority: product.criticality === 'critical_path' ? 'urgent' : 'normal',
        });
        fetchAll();
    };

    const updateStatus = async (id: string, status: PurchaseStatus) => {
        await supabase.from('purchase_list_items').update({ status }).eq('id', id);
        if (status === 'received') {
            const item = items.find(i => i.id === id);
            if (item && item.product) {
                const qty = item.quantity_to_buy || item.quantity_needed;
                await supabase.from('inventory_products').update({
                    current_stock: item.product.current_stock + qty,
                }).eq('id', item.product_id);
                // Also register movement
                await supabase.from('inventory_movements').insert({
                    product_id: item.product_id,
                    movement_type: 'entry',
                    quantity: qty,
                    unit_cost: item.product.unit_cost,
                    total_cost: qty * item.product.unit_cost,
                    reason: 'purchase',
                    notes: 'Recibido desde lista de compras',
                });
            }
        }
        fetchAll();
    };

    const deleteItem = async (id: string) => {
        await supabase.from('purchase_list_items').delete().eq('id', id);
        fetchAll();
    };

    // Group by supplier
    const grouped = items.reduce((acc, item) => {
        const supplier = item.supplier || item.product?.supplier || 'Sin proveedor';
        if (!acc[supplier]) acc[supplier] = [];
        acc[supplier].push(item);
        return acc;
    }, {} as Record<string, typeof items>);

    const totalEstimated = items.filter(i => i.status === 'pending' || i.status === 'ordered').reduce((s, i) => s + (i.estimated_cost || 0), 0);
    const pendingCount = items.filter(i => i.status === 'pending').length;

    // Products that need to be added to the list
    const existingProductIds = new Set(items.map(i => i.product_id));
    const suggestedProducts = lowStockProducts.filter(p => !existingProductIds.has(p.id));

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/inventory')}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        Inventario
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Lista de Compras</h2>
                        <p className="text-sm text-slate-500">{pendingCount} pendientes · Estimado: <strong className="text-primary">{formatCurrencyInv(totalEstimated)}</strong></p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {(['all', 'pending', 'ordered', 'received'] as const).map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${filterStatus === s ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {s === 'all' ? 'Todos' : PURCHASE_STATUS_LABELS[s]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Suggested products alert */}
            {suggestedProducts.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-900/10">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-amber-500 text-[20px]">notification_important</span>
                        <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">{suggestedProducts.length} producto(s) necesitan reabastecimiento</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {suggestedProducts.map(p => {
                            const st = getStockStatus(p);
                            return (
                                <button key={p.id} onClick={() => addToPurchaseList(p)}
                                    className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs dark:border-amber-700 dark:bg-slate-800 hover:shadow-sm transition-all">
                                    <span>{STOCK_STATUS_CONFIG[st].icon}</span>
                                    <span className="font-medium text-slate-900 dark:text-white">{p.name}</span>
                                    <span className="text-slate-400">({p.current_stock}/{p.min_stock})</span>
                                    <span className="material-symbols-outlined text-primary text-[16px]">add_shopping_cart</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Grouped purchase list */}
            {loading ? (
                <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                    <span className="material-symbols-outlined text-[48px] text-slate-300">shopping_cart</span>
                    <p className="text-sm text-slate-500">Lista de compras vacía.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(grouped).map(([supplier, supplierItems]) => (
                        <div key={supplier} className="rounded-xl border border-slate-200/60 bg-white/50 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-[20px]">store</span>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{supplier}</h3>
                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{supplierItems.length}</span>
                                </div>
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                    {formatCurrencyInv(supplierItems.reduce((s, i) => s + (i.estimated_cost || 0), 0))}
                                </span>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {supplierItems.map(item => (
                                    <div key={item.id} className="flex items-center gap-4 px-4 py-3">
                                        <div className="flex-1">
                                            <p className="font-medium text-sm text-slate-900 dark:text-white">{item.product?.name || '—'}</p>
                                            <p className="text-xs text-slate-400">{item.product?.code} · Stock: {item.product?.current_stock || 0}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-slate-400">Cantidad</p>
                                            <p className="font-bold text-sm text-slate-900 dark:text-white">{item.quantity_to_buy || item.quantity_needed}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-slate-400">Estimado</p>
                                            <p className="font-semibold text-sm text-slate-900 dark:text-white">{formatCurrencyInv(item.estimated_cost || 0)}</p>
                                        </div>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PURCHASE_STATUS_COLORS[item.status].bg} ${PURCHASE_STATUS_COLORS[item.status].text}`}>
                                            {PURCHASE_STATUS_LABELS[item.status]}
                                        </span>
                                        <div className="flex gap-1">
                                            {item.status === 'pending' && (
                                                <button onClick={() => updateStatus(item.id, 'ordered')} className="rounded p-1 text-sky-500 hover:bg-sky-50" title="Marcar como Ordenado">
                                                    <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                                                </button>
                                            )}
                                            {item.status === 'ordered' && (
                                                <button onClick={() => updateStatus(item.id, 'received')} className="rounded p-1 text-emerald-500 hover:bg-emerald-50" title="Marcar como Recibido (actualiza stock)">
                                                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                                </button>
                                            )}
                                            <button onClick={() => deleteItem(item.id)} className="rounded p-1 text-slate-400 hover:text-red-500" title="Eliminar">
                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
