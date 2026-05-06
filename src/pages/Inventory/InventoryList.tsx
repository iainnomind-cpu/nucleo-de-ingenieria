import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import {
    InventoryProduct,
    ProductCategory,
    Criticality,
    CATEGORY_LABELS,
    CATEGORY_ICONS,
    CRITICALITY_LABELS,
    CRITICALITY_COLORS,
    UNIT_LABELS,
    ProductUnit,
    MovementType,
    MovementReason,
    MOVEMENT_TYPE_LABELS,
    REASON_LABELS,
    getStockStatus,
    STOCK_STATUS_CONFIG,
    formatCurrencyInv,
    InventoryArea,
    AREA_LABELS,
    AREA_ICONS,
    AREA_COLORS,
    getAreaFromCode,
} from '../../types/inventory';

export default function InventoryList() {
    const navigate = useNavigate();
    const [products, setProducts] = useState<InventoryProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCat, setFilterCat] = useState<ProductCategory | 'all'>('all');
    const [filterStock, setFilterStock] = useState<'all' | 'ok' | 'low' | 'out' | 'critical'>('all');
    const [filterArea, setFilterArea] = useState<InventoryArea | 'all'>('all');
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<InventoryProduct | null>(null);
    const [showMovement, setShowMovement] = useState<InventoryProduct | null>(null);
    const { hasPermission } = useAuth();
    const canDelete = hasPermission('inventory', 'delete');

    // Form state
    const [form, setForm] = useState({
        code: '', name: '', category: 'ferreteria' as ProductCategory, subcategory: '', unit: 'pieza' as ProductUnit,
        current_stock: '', min_stock: '', max_stock: '', unit_cost: '', supplier: '', location: '',
        criticality: 'normal' as Criticality, description: '', area: 'oficina' as InventoryArea,
    });

    // Movement form
    const [movForm, setMovForm] = useState({
        movement_type: 'entry' as MovementType, quantity: '', unit_cost: '', reason: 'purchase' as MovementReason,
        reference_number: '', notes: '', performed_by: '',
    });

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('inventory_products').select('*').eq('is_active', true).order('category').order('name');
        if (filterCat !== 'all') q = q.eq('category', filterCat);
        if (filterArea !== 'all') q = q.eq('area', filterArea);
        if (search.trim()) q = q.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
        const { data } = await q;
        let filtered = (data as InventoryProduct[]) || [];
        if (filterStock !== 'all') filtered = filtered.filter(p => getStockStatus(p) === filterStock);
        setProducts(filtered);
        setLoading(false);
    }, [filterCat, filterStock, filterArea, search]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    const openCreateForm = () => {
        setEditing(null);
        setForm({ code: '', name: '', category: 'ferreteria', subcategory: '', unit: 'pieza', current_stock: '0', min_stock: '0', max_stock: '', unit_cost: '0', supplier: '', location: '', criticality: 'normal', description: '', area: 'oficina' });
        setShowForm(true);
    };

    const openEditForm = (p: InventoryProduct) => {
        setEditing(p);
        setForm({
            code: p.code, name: p.name, category: p.category, subcategory: p.subcategory || '', unit: p.unit,
            current_stock: p.current_stock.toString(), min_stock: p.min_stock.toString(), max_stock: p.max_stock?.toString() || '',
            unit_cost: p.unit_cost.toString(), supplier: p.supplier || '', location: p.location || '',
            criticality: p.criticality, description: p.description || '', area: p.area || 'oficina',
        });
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            code: form.code, name: form.name, category: form.category, subcategory: form.subcategory || null,
            unit: form.unit, current_stock: parseFloat(form.current_stock) || 0, min_stock: parseFloat(form.min_stock) || 0,
            max_stock: form.max_stock ? parseFloat(form.max_stock) : null, unit_cost: parseFloat(form.unit_cost) || 0,
            supplier: form.supplier || null, location: form.location || null, criticality: form.criticality,
            description: form.description || null, area: form.area,
        };
        if (editing) {
            await supabase.from('inventory_products').update(payload).eq('id', editing.id);
        } else {
            await supabase.from('inventory_products').insert(payload);
        }
        setShowForm(false);
        fetchProducts();
    };

    const handleMovement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!showMovement) return;
        const qty = parseFloat(movForm.quantity) || 0;
        const cost = parseFloat(movForm.unit_cost) || showMovement.unit_cost;
        await supabase.from('inventory_movements').insert({
            product_id: showMovement.id, movement_type: movForm.movement_type, quantity: qty,
            unit_cost: cost, total_cost: qty * cost, reason: movForm.reason,
            reference_number: movForm.reference_number || null, notes: movForm.notes || null,
            performed_by: movForm.performed_by || null,
        });
        // Update stock
        const isExit = movForm.movement_type === 'exit';
        const newStock = movForm.movement_type === 'entry'
            ? showMovement.current_stock + qty
            : isExit ? showMovement.current_stock - qty : parseFloat(movForm.quantity);

        const finalStock = Math.max(0, newStock);
        const updates: Record<string, unknown> = { current_stock: finalStock };

        if (movForm.movement_type === 'entry' && movForm.reason === 'purchase') {
            updates.last_purchase_price = cost;
            updates.unit_cost = cost;
        }
        await supabase.from('inventory_products').update(updates).eq('id', showMovement.id);

        // → M8: Alerta de stock mínimo al administrador/comprador
        if (isExit && showMovement.min_stock !== undefined && finalStock < showMovement.min_stock && showMovement.current_stock >= showMovement.min_stock) {
            const { data: spaces } = await supabase.from('spaces')
                .select('id').ilike('name', '%admin%').limit(1);

            if (spaces && spaces.length > 0) {
                await supabase.from('messages').insert({
                    space_id: spaces[0].id,
                    sender_id: '12345678-1234-1234-1234-123456789012', // System UUID
                    content: `⚠️ **ALERTA DE INVENTARIO (M4→M8)**: El producto **${showMovement.code} - ${showMovement.name}** ha caído por debajo de su stock mínimo (${finalStock} / Mín: ${showMovement.min_stock} ${UNIT_LABELS[showMovement.unit]}).\n\n👤 **@Paulina** — Se requiere generar orden de compra inmediata para reabastecimiento.\n\n[🟢 APROBAR ORDEN DE COMPRA AUTOMÁTICA](/inventory?action=approve_po&product=${showMovement.id})`,
                    message_type: 'text'
                });
            }
        }

        setShowMovement(null);
        setMovForm({ movement_type: 'entry', quantity: '', unit_cost: '', reason: 'purchase', reference_number: '', notes: '', performed_by: '' });
        fetchProducts();
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Está seguro de que desea eliminar este producto? Esta acción no se puede deshacer.')) return;
        
        try {
            await supabase.from('inventory_products').update({ is_active: false }).eq('id', id);
            fetchProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Hubo un error al intentar eliminar el producto.');
        }
    };

    // KPIs
    const totalProducts = products.length;
    const lowStock = products.filter(p => getStockStatus(p) === 'low').length;
    const outOfStock = products.filter(p => getStockStatus(p) === 'out' || getStockStatus(p) === 'critical').length;
    const totalValue = products.reduce((s, p) => s + (p.current_stock * p.unit_cost), 0);

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Inventario</h2>
                    <p className="mt-1 text-sm text-slate-500">Control de almacén en tiempo real.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => navigate('/inventory/consumption')}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[18px]">analytics</span>
                        Consumo x Proyecto
                    </button>
                    <button onClick={() => navigate('/inventory/uniforms')}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[18px]">checkroom</span>
                        Uniformes & EPP
                    </button>
                    <button onClick={() => navigate('/inventory/purchases')}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                        Lista de Compras
                    </button>
                    <button onClick={openCreateForm}
                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20">
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        Nuevo Producto
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: 'Productos', value: totalProducts.toString(), icon: 'inventory_2', color: 'from-sky-500 to-cyan-500' },
                    { label: 'Stock Bajo', value: lowStock.toString(), icon: 'warning', color: 'from-amber-500 to-orange-500' },
                    { label: 'Agotados', value: outOfStock.toString(), icon: 'error', color: 'from-red-500 to-rose-500' },
                    { label: 'Valor Inventario', value: formatCurrencyInv(totalValue), icon: 'account_balance', color: 'from-emerald-500 to-teal-500' },
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
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input type="text" placeholder="Buscar por nombre o código..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
                <div className="flex flex-wrap gap-2">
                    <select value={filterCat} onChange={e => setFilterCat(e.target.value as ProductCategory | 'all')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        <option value="all">Todas las categorías</option>
                        {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                    </select>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 self-center" />
                    {(['all', 'oficina', 'bodega', 'limpieza_pozos', 'equipos_aforo'] as const).map(a => (
                        <button key={a} onClick={() => setFilterArea(a as InventoryArea | 'all')}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${filterArea === a ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                            <span className="material-symbols-outlined text-[14px]">{a === 'all' ? 'apps' : AREA_ICONS[a]}</span>
                            {a === 'all' ? 'Todas' : AREA_LABELS[a]}
                        </button>
                    ))}
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 self-center" />
                    {(['all', 'ok', 'low', 'out', 'critical'] as const).map(s => (
                        <button key={s} onClick={() => setFilterStock(s)}
                            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-all ${filterStock === s ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {s !== 'all' && <span>{STOCK_STATUS_CONFIG[s].icon}</span>}
                            {s === 'all' ? 'Todos' : STOCK_STATUS_CONFIG[s].label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Form Modal */}
            {showForm && (
                <form onSubmit={handleSubmit} className="rounded-xl border border-primary/20 bg-primary/5 p-6">
                    <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">{editing ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div><label className={labelClass}>Código *</label><input value={form.code} onChange={e => { const code = e.target.value; setForm({ ...form, code, area: getAreaFromCode(code) }); }} required placeholder="FER-ALAM10-004" className={inputClass} /></div>
                        <div className="md:col-span-2"><label className={labelClass}>Nombre *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Tubería PVC 4in" className={inputClass} /></div>
                        <div><label className={labelClass}>Área</label><select value={form.area} onChange={e => setForm({ ...form, area: e.target.value as InventoryArea })} className={inputClass}>{(Object.keys(AREA_LABELS) as InventoryArea[]).map(a => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}</select></div>
                        <div><label className={labelClass}>Categoría</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as ProductCategory })} className={inputClass}>{(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></div>
                        <div><label className={labelClass}>Unidad</label><select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value as ProductUnit })} className={inputClass}>{(Object.keys(UNIT_LABELS) as ProductUnit[]).map(u => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}</select></div>
                        <div><label className={labelClass}>Stock Actual</label><input type="number" step="0.01" value={form.current_stock} onChange={e => setForm({ ...form, current_stock: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>Stock Mínimo</label><input type="number" step="0.01" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>Stock Máximo</label><input type="number" step="0.01" value={form.max_stock} onChange={e => setForm({ ...form, max_stock: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>Costo Unitario</label><input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })} className={inputClass} /></div>
                        <div><label className={labelClass}>Proveedor</label><input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Proveedor principal" className={inputClass} /></div>
                        <div><label className={labelClass}>Ubicación</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Estante A-3" className={inputClass} /></div>
                        <div><label className={labelClass}>Criticidad</label><select value={form.criticality} onChange={e => setForm({ ...form, criticality: e.target.value as Criticality })} className={inputClass}>{(Object.keys(CRITICALITY_LABELS) as Criticality[]).map(c => <option key={c} value={c}>{CRITICALITY_LABELS[c]}</option>)}</select></div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button type="submit" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">{editing ? 'Guardar Cambios' : 'Crear Producto'}</button>
                        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500 dark:border-slate-700">Cancelar</button>
                    </div>
                </form>
            )}

            {/* Movement Modal */}
            {showMovement && (
                <form onSubmit={handleMovement} className="rounded-xl border border-sky-200 bg-sky-50/50 p-6 dark:border-sky-900 dark:bg-sky-900/10">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Registrar Movimiento: <span className="text-primary">{showMovement.name}</span></h3>
                        <span className="text-xs text-slate-500">Stock actual: <strong>{showMovement.current_stock} {UNIT_LABELS[showMovement.unit]}</strong></span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div><label className={labelClass}>Tipo *</label><select value={movForm.movement_type} onChange={e => setMovForm({ ...movForm, movement_type: e.target.value as MovementType })} className={inputClass}>{(Object.keys(MOVEMENT_TYPE_LABELS) as MovementType[]).map(t => <option key={t} value={t}>{MOVEMENT_TYPE_LABELS[t]}</option>)}</select></div>
                        <div><label className={labelClass}>Cantidad *</label><input type="number" step="0.01" value={movForm.quantity} onChange={e => setMovForm({ ...movForm, quantity: e.target.value })} required className={inputClass} placeholder="10" /></div>
                        <div><label className={labelClass}>Costo Unitario</label><input type="number" step="0.01" value={movForm.unit_cost} onChange={e => setMovForm({ ...movForm, unit_cost: e.target.value })} className={inputClass} placeholder={showMovement.unit_cost.toString()} /></div>
                        <div><label className={labelClass}>Razón</label><select value={movForm.reason} onChange={e => setMovForm({ ...movForm, reason: e.target.value as MovementReason })} className={inputClass}>{(Object.keys(REASON_LABELS) as MovementReason[]).map(r => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}</select></div>
                        <div><label className={labelClass}>Referencia</label><input value={movForm.reference_number} onChange={e => setMovForm({ ...movForm, reference_number: e.target.value })} placeholder="PRY-2026-0001" className={inputClass} /></div>
                        <div><label className={labelClass}>Realizado Por</label><input value={movForm.performed_by} onChange={e => setMovForm({ ...movForm, performed_by: e.target.value })} placeholder="Nombre" className={inputClass} /></div>
                        <div className="md:col-span-2"><label className={labelClass}>Notas</label><input value={movForm.notes} onChange={e => setMovForm({ ...movForm, notes: e.target.value })} placeholder="Observaciones" className={inputClass} /></div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button type="submit" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white">Registrar</button>
                        <button type="button" onClick={() => setShowMovement(null)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500 dark:border-slate-700">Cancelar</button>
                    </div>
                </form>
            )}

            {/* Products Table */}
            {loading ? (
                <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : products.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                    <span className="material-symbols-outlined text-[48px] text-slate-300">inventory_2</span>
                    <p className="text-sm text-slate-500">No hay productos.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white/50 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500">Estado</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500">Código</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500">Producto</th>
                                <th className="px-4 py-3 text-center font-semibold text-slate-500">Categoría</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500">Stock</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500">Mín.</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500">Costo Unit.</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500">Valor</th>
                                <th className="px-4 py-3 text-center font-semibold text-slate-500">Criticidad</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {products.map(p => {
                                const status = getStockStatus(p);
                                const conf = STOCK_STATUS_CONFIG[status] || STOCK_STATUS_CONFIG.ok;
                                const areaConf = AREA_COLORS[p.area as InventoryArea] || AREA_COLORS.oficina;
                                const areaIcon = AREA_ICONS[p.area as InventoryArea] || AREA_ICONS.oficina;
                                const areaLabel = AREA_LABELS[p.area as InventoryArea] || AREA_LABELS.oficina;
                                const catIcon = CATEGORY_ICONS[p.category] || CATEGORY_ICONS.otro;
                                const catLabel = CATEGORY_LABELS[p.category] || CATEGORY_LABELS.otro;
                                const critConf = CRITICALITY_COLORS[p.criticality] || CRITICALITY_COLORS.normal;
                                const critLabel = CRITICALITY_LABELS[p.criticality] || CRITICALITY_LABELS.normal;
                                return (
                                    <tr key={p.id} className="group transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3">
                                            <span className="text-lg" title={conf.label}>{conf.icon}</span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{p.code}</td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-slate-900 dark:text-white">{p.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {p.location && <span className="text-xs text-slate-400">📍 {p.location}</span>}
                                                <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${areaConf.bg} ${areaConf.text}`}>
                                                    <span className="material-symbols-outlined text-[11px]">{areaIcon}</span>
                                                    {areaLabel}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                                <span className="material-symbols-outlined text-[14px]">{catIcon}</span>
                                                {catLabel}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${conf.color}`}>{p.current_stock} <span className="text-xs font-normal text-slate-400">{UNIT_LABELS[p.unit]}</span></td>
                                        <td className="px-4 py-3 text-right text-slate-400">{p.min_stock}</td>
                                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrencyInv(p.unit_cost)}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{formatCurrencyInv(p.current_stock * p.unit_cost)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${critConf.bg} ${critConf.text}`}>{critLabel}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={e => { e.stopPropagation(); setShowMovement(p); }} title="Movimiento" className="rounded p-1 text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20">
                                                    <span className="material-symbols-outlined text-[18px]">swap_vert</span>
                                                </button>
                                                <button onClick={e => { e.stopPropagation(); openEditForm(p); }} title="Editar" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                                {canDelete && (
                                                    <button onClick={e => { e.stopPropagation(); handleDelete(p.id); }} title="Eliminar" className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
