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
    AREA_LABELS,
    AREA_ICONS,
} from '../../types/inventory';

interface ProjectOption { id: string; project_number: string; title: string; }

export default function PurchaseList() {
    const navigate = useNavigate();
    const [items, setItems] = useState<(PurchaseListItem & { product?: InventoryProduct })[]>([]);
    const [lowStockProducts, setLowStockProducts] = useState<InventoryProduct[]>([]);
    const [allProducts, setAllProducts] = useState<InventoryProduct[]>([]);
    const [projects, setProjects] = useState<ProjectOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<PurchaseStatus | 'all'>('all');

    // Inline edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ quantity_to_buy: '', estimated_cost: '', supplier: '', priority: 'normal', notes: '', project_id: '' });

    // Manual add
    const [showManualAdd, setShowManualAdd] = useState(false);
    const [manualProductId, setManualProductId] = useState('');
    const [manualQty, setManualQty] = useState('');
    const [manualSearch, setManualSearch] = useState('');

    const fetchAll = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('purchase_list_items').select('*, product:inventory_products(*)').order('created_at', { ascending: false });
        if (filterStatus !== 'all') q = q.eq('status', filterStatus);
        const [{ data }, { data: products }, { data: projs }] = await Promise.all([
            q,
            supabase.from('inventory_products').select('*').eq('is_active', true).order('name'),
            supabase.from('projects').select('id, project_number, title').order('project_number', { ascending: false }).limit(50),
        ]);
        const allProds = (products as InventoryProduct[]) || [];
        setItems(data || []);
        setAllProducts(allProds);
        setLowStockProducts(allProds.filter(p => { const st = getStockStatus(p); return st === 'low' || st === 'out' || st === 'critical'; }));
        setProjects((projs as ProjectOption[]) || []);
        setLoading(false);
    }, [filterStatus]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const addToPurchaseList = async (product: InventoryProduct) => {
        const qtyNeeded = Math.max(1, product.min_stock * 2 - product.current_stock);
        await supabase.from('purchase_list_items').insert({
            product_id: product.id, quantity_needed: qtyNeeded, quantity_to_buy: qtyNeeded,
            estimated_cost: qtyNeeded * product.unit_cost, supplier: product.supplier,
            priority: product.criticality === 'critical_path' ? 'urgent' : 'normal',
        });
        fetchAll();
    };

    const addManual = async () => {
        if (!manualProductId) return;
        const prod = allProducts.find(p => p.id === manualProductId);
        if (!prod) return;
        const qty = parseFloat(manualQty) || 1;
        await supabase.from('purchase_list_items').insert({
            product_id: prod.id, quantity_needed: qty, quantity_to_buy: qty,
            estimated_cost: qty * prod.unit_cost, supplier: prod.supplier, priority: 'normal',
        });
        setShowManualAdd(false); setManualProductId(''); setManualQty(''); setManualSearch('');
        fetchAll();
    };

    const updateStatus = async (id: string, status: PurchaseStatus) => {
        await supabase.from('purchase_list_items').update({ status }).eq('id', id);
        if (status === 'received') {
            const item = items.find(i => i.id === id);
            if (item?.product) {
                const qty = item.quantity_to_buy || item.quantity_needed;
                await supabase.from('inventory_products').update({ current_stock: item.product.current_stock + qty }).eq('id', item.product_id);
                await supabase.from('inventory_movements').insert({
                    product_id: item.product_id, movement_type: 'entry', quantity: qty,
                    unit_cost: item.estimated_cost ? item.estimated_cost / qty : item.product.unit_cost,
                    total_cost: item.estimated_cost || qty * item.product.unit_cost,
                    reason: 'purchase', notes: 'Recibido desde lista de compras',
                });
                // Notificación interna
                try {
                    await supabase.from('app_notifications').insert({
                        title: '📦 Compra Recibida',
                        message: `Se recibieron ${qty} ${item.product.name} (${item.product.code}). Stock actualizado.`,
                        type: 'inventory', priority: 'normal',
                        link: '/inventory/purchases',
                    });
                } catch { /* notifications table may not exist */ }
            }
        }
        fetchAll();
    };

    const startEdit = (item: PurchaseListItem & { product?: InventoryProduct }) => {
        setEditingId(item.id);
        setEditForm({
            quantity_to_buy: (item.quantity_to_buy || item.quantity_needed).toString(),
            estimated_cost: (item.estimated_cost || 0).toString(),
            supplier: item.supplier || item.product?.supplier || '',
            priority: item.priority || 'normal',
            notes: item.notes || '',
            project_id: item.project_id || '',
        });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        const qty = parseFloat(editForm.quantity_to_buy) || 0;
        await supabase.from('purchase_list_items').update({
            quantity_to_buy: qty,
            estimated_cost: parseFloat(editForm.estimated_cost) || 0,
            supplier: editForm.supplier || null,
            priority: editForm.priority,
            notes: editForm.notes || null,
            project_id: editForm.project_id || null,
        }).eq('id', editingId);
        setEditingId(null);
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
    const orderedCount = items.filter(i => i.status === 'ordered').length;

    const existingProductIds = new Set(items.map(i => i.product_id));
    const suggestedProducts = lowStockProducts.filter(p => !existingProductIds.has(p.id));

    // Filtered products for manual add search
    const filteredManualProducts = manualSearch.trim()
        ? allProducts.filter(p => !existingProductIds.has(p.id) && (p.name.toLowerCase().includes(manualSearch.toLowerCase()) || p.code.toLowerCase().includes(manualSearch.toLowerCase())))
        : [];

    const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelCls = 'block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1';
    const priorityColors: Record<string, string> = { low: 'text-slate-400', normal: 'text-sky-500', high: 'text-amber-500', urgent: 'text-red-500' };
    const priorityIcons: Record<string, string> = { low: 'arrow_downward', normal: 'remove', high: 'arrow_upward', urgent: 'priority_high' };

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
                        <p className="text-sm text-slate-500">{pendingCount} pendientes · {orderedCount} ordenados · Estimado: <strong className="text-primary">{formatCurrencyInv(totalEstimated)}</strong></p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowManualAdd(!showManualAdd)}
                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20">
                        <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                        Agregar Producto
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: 'Pendientes', value: pendingCount.toString(), icon: 'pending_actions', color: 'from-amber-500 to-orange-500' },
                    { label: 'Ordenados', value: orderedCount.toString(), icon: 'local_shipping', color: 'from-sky-500 to-cyan-500' },
                    { label: 'Costo Estimado', value: formatCurrencyInv(totalEstimated), icon: 'payments', color: 'from-emerald-500 to-teal-500' },
                    { label: 'Productos Bajo Stock', value: suggestedProducts.length.toString(), icon: 'warning', color: 'from-red-500 to-rose-500' },
                ].map(k => (
                    <div key={k.label} className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between">
                            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k.label}</p><p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{k.value}</p></div>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${k.color} shadow-lg`}><span className="material-symbols-outlined text-white text-[24px]">{k.icon}</span></div>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${k.color} opacity-60`} />
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                {(['all', 'pending', 'ordered', 'received', 'cancelled'] as const).map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${filterStatus === s ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {s === 'all' ? 'Todos' : PURCHASE_STATUS_LABELS[s]}
                    </button>
                ))}
            </div>

            {/* Manual Add Form */}
            {showManualAdd && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                    <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Agregar Producto a Lista de Compras</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="md:col-span-2 relative">
                            <label className={labelCls}>Buscar Producto</label>
                            <input value={manualSearch} onChange={e => { setManualSearch(e.target.value); setManualProductId(''); }}
                                placeholder="Buscar por nombre o código..." className={inputCls} />
                            {filteredManualProducts.length > 0 && !manualProductId && (
                                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                                    {filteredManualProducts.slice(0, 10).map(p => (
                                        <button key={p.id} onClick={() => { setManualProductId(p.id); setManualSearch(`${p.code} — ${p.name}`); setManualQty('1'); }}
                                            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                                            <span className="font-mono text-xs font-bold text-primary">{p.code}</span>
                                            <span className="flex-1 text-slate-900 dark:text-white">{p.name}</span>
                                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                                <span className="material-symbols-outlined text-[12px]">{AREA_ICONS[p.area || 'oficina']}</span>
                                                {AREA_LABELS[p.area || 'oficina']}
                                            </span>
                                            <span className="text-xs text-slate-400">Stock: {p.current_stock}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className={labelCls}>Cantidad</label>
                            <input type="number" step="1" min="1" value={manualQty} onChange={e => setManualQty(e.target.value)} placeholder="1" className={inputCls} />
                        </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button onClick={addManual} disabled={!manualProductId}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Agregar</button>
                        <button onClick={() => { setShowManualAdd(false); setManualSearch(''); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 dark:border-slate-700">Cancelar</button>
                    </div>
                </div>
            )}

            {/* Suggested products */}
            {suggestedProducts.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-900/10">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-amber-500 text-[20px]">notification_important</span>
                        <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">{suggestedProducts.length} producto(s) necesitan reabastecimiento</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {suggestedProducts.slice(0, 20).map(p => {
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

            {/* Edit Modal */}
            {editingId && (
                <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-5 dark:border-sky-900 dark:bg-sky-900/10">
                    <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Editar Item de Compra</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <div><label className={labelCls}>Cantidad a Comprar</label><input type="number" step="1" value={editForm.quantity_to_buy} onChange={e => setEditForm({ ...editForm, quantity_to_buy: e.target.value })} className={inputCls} /></div>
                        <div><label className={labelCls}>Costo Estimado</label><input type="number" step="0.01" value={editForm.estimated_cost} onChange={e => setEditForm({ ...editForm, estimated_cost: e.target.value })} className={inputCls} /></div>
                        <div><label className={labelCls}>Proveedor</label><input value={editForm.supplier} onChange={e => setEditForm({ ...editForm, supplier: e.target.value })} placeholder="Proveedor" className={inputCls} /></div>
                        <div><label className={labelCls}>Prioridad</label>
                            <select value={editForm.priority} onChange={e => setEditForm({ ...editForm, priority: e.target.value })} className={inputCls}>
                                <option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option>
                            </select>
                        </div>
                        <div><label className={labelCls}>Proyecto</label>
                            <select value={editForm.project_id} onChange={e => setEditForm({ ...editForm, project_id: e.target.value })} className={inputCls}>
                                <option value="">Sin proyecto</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-3"><label className={labelCls}>Notas</label><input value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Observaciones..." className={inputCls} /></div>
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button onClick={saveEdit} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Guardar</button>
                        <button onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 dark:border-slate-700">Cancelar</button>
                    </div>
                </div>
            )}

            {/* Purchase List grouped by supplier */}
            {loading ? (
                <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                    <span className="material-symbols-outlined text-[48px] text-slate-300">shopping_cart</span>
                    <p className="text-sm text-slate-500">Lista de compras vacía.</p>
                    <button onClick={() => setShowManualAdd(true)} className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Agregar Producto</button>
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
                                    <div key={item.id} className="flex items-center gap-4 px-4 py-3 group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        {/* Priority indicator */}
                                        <span className={`material-symbols-outlined text-[18px] ${priorityColors[item.priority || 'normal']}`} title={`Prioridad: ${item.priority}`}>
                                            {priorityIcons[item.priority || 'normal']}
                                        </span>
                                        {/* Product info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{item.product?.name || '—'}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                                <span>{item.product?.code}</span>
                                                <span>·</span>
                                                <span>Stock: {item.product?.current_stock || 0}</span>
                                                {item.notes && <><span>·</span><span className="italic truncate max-w-[200px]">📝 {item.notes}</span></>}
                                            </div>
                                        </div>
                                        {/* Quantity */}
                                        <div className="text-center min-w-[70px]">
                                            <p className="text-[10px] text-slate-400 uppercase">Cantidad</p>
                                            <p className="font-bold text-sm text-slate-900 dark:text-white">{item.quantity_to_buy || item.quantity_needed}</p>
                                        </div>
                                        {/* Cost */}
                                        <div className="text-right min-w-[90px]">
                                            <p className="text-[10px] text-slate-400 uppercase">Estimado</p>
                                            <p className="font-semibold text-sm text-slate-900 dark:text-white">{formatCurrencyInv(item.estimated_cost || 0)}</p>
                                        </div>
                                        {/* Status badge */}
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${PURCHASE_STATUS_COLORS[item.status].bg} ${PURCHASE_STATUS_COLORS[item.status].text}`}>
                                            {PURCHASE_STATUS_LABELS[item.status]}
                                        </span>
                                        {/* Actions */}
                                        <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                            {item.status === 'pending' && (
                                                <>
                                                    <button onClick={() => startEdit(item)} className="rounded p-1 text-slate-400 hover:text-primary hover:bg-primary/10" title="Editar">
                                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                                    </button>
                                                    <button onClick={() => updateStatus(item.id, 'ordered')} className="rounded p-1 text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20" title="Marcar como Ordenado">
                                                        <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                                                    </button>
                                                    <button onClick={() => updateStatus(item.id, 'cancelled')} className="rounded p-1 text-slate-400 hover:text-amber-500 hover:bg-amber-50" title="Cancelar">
                                                        <span className="material-symbols-outlined text-[18px]">block</span>
                                                    </button>
                                                </>
                                            )}
                                            {item.status === 'ordered' && (
                                                <>
                                                    <button onClick={() => startEdit(item)} className="rounded p-1 text-slate-400 hover:text-primary hover:bg-primary/10" title="Editar">
                                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                                    </button>
                                                    <button onClick={() => updateStatus(item.id, 'received')} className="rounded p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" title="Marcar como Recibido (actualiza stock)">
                                                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                                    </button>
                                                </>
                                            )}
                                            <button onClick={() => deleteItem(item.id)} className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50" title="Eliminar">
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
