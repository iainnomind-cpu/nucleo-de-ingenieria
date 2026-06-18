import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    InventoryMovement, InventoryProduct,
    CATEGORY_LABELS, CATEGORY_ICONS,
    UNIT_LABELS,
    REASON_LABELS, MovementReason,
    formatCurrencyInv,
} from '../../types/inventory';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
    AreaChart, Area,
} from 'recharts';

/* ───── Palette ───── */
const COLORS = [
    '#6366f1', '#f43f5e', '#0ea5e9', '#f59e0b', '#10b981',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b',
    '#a855f7', '#06b6d4',
];

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/* ───── Helper: custom tooltip ───── */
function CustomTooltip({ active, payload, label, isCurrency = false }: {
    active?: boolean; payload?: Array<{ value: number; name: string; color: string }>;
    label?: string; isCurrency?: boolean;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95">
            <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</p>
            {payload.map((p, i) => (
                <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
                    {p.name}: {isCurrency ? formatCurrencyInv(p.value) : p.value.toLocaleString('es-MX')}
                </p>
            ))}
        </div>
    );
}

/* ───── Component ───── */
export default function MonthlyEntriesReport() {
    const navigate = useNavigate();
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth()); // 0-indexed
    const [movements, setMovements] = useState<(InventoryMovement & { product?: InventoryProduct })[]>([]);
    const [loading, setLoading] = useState(true);

    /* ─── Fetch entries for selected month ─── */
    const fetchEntries = useCallback(async () => {
        setLoading(true);
        const from = new Date(year, month, 1).toISOString();
        const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

        const { data } = await supabase
            .from('inventory_movements')
            .select('*, product:inventory_products(*)')
            .eq('movement_type', 'entry')
            .gte('created_at', from)
            .lte('created_at', to)
            .order('created_at', { ascending: true });

        setMovements((data || []) as (InventoryMovement & { product?: InventoryProduct })[]);
        setLoading(false);
    }, [year, month]);

    useEffect(() => { fetchEntries(); }, [fetchEntries]);

    /* ───────────── Computed Analytics ───────────── */

    // KPIs
    const totalEntries = movements.length;
    const totalCost = movements.reduce((s, m) => s + (m.total_cost || m.quantity * (m.unit_cost || 0)), 0);
    const uniqueProducts = new Set(movements.map(m => m.product_id)).size;
    const avgCostPerEntry = totalEntries > 0 ? totalCost / totalEntries : 0;

    // 1. Top 10 materiales por costo
    const topMaterialsByCost = useMemo(() => {
        const map = new Map<string, { name: string; cost: number; qty: number; unit: string }>();
        movements.forEach(m => {
            const id = m.product_id;
            const cost = m.total_cost || m.quantity * (m.unit_cost || 0);
            if (!map.has(id)) {
                map.set(id, {
                    name: m.product?.name || 'Desconocido',
                    cost: 0,
                    qty: 0,
                    unit: m.product?.unit || 'pieza',
                });
            }
            const entry = map.get(id)!;
            entry.cost += cost;
            entry.qty += m.quantity;
        });
        return Array.from(map.values())
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 10)
            .map(d => ({ ...d, name: d.name.length > 25 ? d.name.slice(0, 22) + '...' : d.name }));
    }, [movements]);

    // 2. Distribución por categoría
    const categoryDistribution = useMemo(() => {
        const map = new Map<string, number>();
        movements.forEach(m => {
            const cat = m.product?.category || 'otro';
            const cost = m.total_cost || m.quantity * (m.unit_cost || 0);
            map.set(cat, (map.get(cat) || 0) + cost);
        });
        return Array.from(map.entries())
            .map(([key, value]) => ({
                name: CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS] || key,
                value,
                key,
            }))
            .sort((a, b) => b.value - a.value);
    }, [movements]);

    // 3. Tendencia diaria
    const dailyTrend = useMemo(() => {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days: { day: string; entradas: number; costo: number }[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            days.push({ day: d.toString(), entradas: 0, costo: 0 });
        }
        movements.forEach(m => {
            const date = new Date(m.created_at);
            const dayIndex = date.getDate() - 1;
            if (dayIndex >= 0 && dayIndex < days.length) {
                days[dayIndex].entradas += 1;
                days[dayIndex].costo += (m.total_cost || m.quantity * (m.unit_cost || 0));
            }
        });
        return days;
    }, [movements, year, month]);

    // 4. Distribución por razón de entrada
    const reasonDistribution = useMemo(() => {
        const map = new Map<string, { count: number; cost: number }>();
        movements.forEach(m => {
            const reason = m.reason || 'project_consumption';
            const cost = m.total_cost || m.quantity * (m.unit_cost || 0);
            const entry = map.get(reason) || { count: 0, cost: 0 };
            entry.count += 1;
            entry.cost += cost;
            map.set(reason, entry);
        });
        return Array.from(map.entries())
            .map(([key, val]) => ({
                name: REASON_LABELS[key as MovementReason] || key,
                count: val.count,
                cost: val.cost,
            }))
            .sort((a, b) => b.cost - a.cost);
    }, [movements]);

    // 5. Tabla detallada agrupada por producto
    const detailedRows = useMemo(() => {
        const map = new Map<string, {
            product_id: string; name: string; code: string; category: string; unit: string;
            totalQty: number; totalCost: number; entries: number;
        }>();
        movements.forEach(m => {
            const id = m.product_id;
            const cost = m.total_cost || m.quantity * (m.unit_cost || 0);
            if (!map.has(id)) {
                map.set(id, {
                    product_id: id,
                    name: m.product?.name || '—',
                    code: m.product?.code || '—',
                    category: m.product?.category || 'otro',
                    unit: m.product?.unit || 'pieza',
                    totalQty: 0,
                    totalCost: 0,
                    entries: 0,
                });
            }
            const entry = map.get(id)!;
            entry.totalQty += m.quantity;
            entry.totalCost += cost;
            entry.entries += 1;
        });
        return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
    }, [movements]);

    // Year range for selector
    const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

    const sectionClass = 'rounded-xl border border-slate-200/60 bg-white/50 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50';

    const renderPieLabel = (props: any) => {
        const { name, percent } = props;
        return percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : '';
    };

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* ─── Header ─── */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/inventory')}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        Inventario
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                            Entradas del Mes
                        </h2>
                        <p className="text-sm text-slate-500">
                            Análisis de materiales con entrada — <strong className="text-indigo-500">{MONTH_NAMES[month]} {year}</strong>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select value={month} onChange={e => setMonth(Number(e.target.value))}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select value={year} onChange={e => setYear(Number(e.target.value))}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* ─── KPI Cards ─── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: 'Entradas Totales', value: totalEntries.toString(), icon: 'output', color: 'from-indigo-500 to-violet-500' },
                    { label: 'Costo Total Entradas', value: formatCurrencyInv(totalCost), icon: 'payments', color: 'from-red-500 to-rose-500' },
                    { label: 'Materiales Distintos', value: uniqueProducts.toString(), icon: 'inventory_2', color: 'from-amber-500 to-orange-500' },
                    { label: 'Costo Prom. / Entrada', value: formatCurrencyInv(avgCostPerEntry), icon: 'analytics', color: 'from-emerald-500 to-teal-500' },
                ].map(k => (
                    <div key={k.label} className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md dark:border-slate-800/60 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k.label}</p>
                                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{k.value}</p>
                            </div>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${k.color} shadow-lg`}>
                                <span className="material-symbols-outlined text-white text-[24px]">{k.icon}</span>
                            </div>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${k.color} opacity-60`} />
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : totalEntries === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16">
                    <span className="material-symbols-outlined text-[56px] text-slate-300">inbox</span>
                    <p className="text-sm text-slate-500">Sin entradas de materiales registradas en {MONTH_NAMES[month]} {year}.</p>
                    <p className="text-xs text-slate-400">Selecciona otro mes o registra entradas desde el inventario.</p>
                </div>
            ) : (
                <>
                    {/* ─── Charts Row 1: Trend + Category ─── */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* Daily Trend */}
                        <div className={`${sectionClass} p-5 lg:col-span-2`}>
                            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-indigo-500 text-[20px]">show_chart</span>
                                Tendencia Diaria de Entradas
                            </h3>
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={dailyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradCosto" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area yAxisId="left" type="monotone" dataKey="entradas" name="Entradas" stroke="#f43f5e" fill="url(#gradEntradas)" strokeWidth={2} />
                                    <Area yAxisId="right" type="monotone" dataKey="costo" name="Costo" stroke="#6366f1" fill="url(#gradCosto)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Category Pie */}
                        <div className={`${sectionClass} p-5`}>
                            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-rose-500 text-[20px]">donut_large</span>
                                Por Categoría
                            </h3>
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie
                                        data={categoryDistribution}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={90}
                                        paddingAngle={3}
                                        label={renderPieLabel}
                                        labelLine={false}
                                    >
                                        {categoryDistribution.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v: any) => formatCurrencyInv(Number(v))} />
                                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* ─── Charts Row 2: Top materials + Reason breakdown ─── */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Top 10 Materiales */}
                        <div className={`${sectionClass} p-5`}>
                            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-amber-500 text-[20px]">bar_chart</span>
                                Top 10 Materiales (por Costo)
                            </h3>
                            <ResponsiveContainer width="100%" height={320}>
                                <BarChart data={topMaterialsByCost} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8"
                                        tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                                    <Tooltip content={<CustomTooltip isCurrency />} />
                                    <Bar dataKey="cost" name="Costo Total" radius={[0, 6, 6, 0]} barSize={18}>
                                        {topMaterialsByCost.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Razón de entrada */}
                        <div className={`${sectionClass} p-5`}>
                            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-teal-500 text-[20px]">pie_chart</span>
                                Distribución por Razón de Entrada
                            </h3>
                            {reasonDistribution.length > 0 ? (
                                <div className="space-y-3">
                                    {reasonDistribution.map((r, i) => {
                                        const pct = totalCost > 0 ? (r.cost / totalCost) * 100 : 0;
                                        return (
                                            <div key={r.name}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{r.name}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs text-slate-400">{r.count} entradas</span>
                                                        <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrencyInv(r.cost)}</span>
                                                    </div>
                                                </div>
                                                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${Math.max(pct, 2)}%`,
                                                            backgroundColor: COLORS[i % COLORS.length],
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="py-8 text-center text-sm text-slate-400">Sin datos</p>
                            )}

                            {/* Quick insights */}
                            <div className="mt-6 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/40 dark:bg-indigo-900/10">
                                <h4 className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                    <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                                    Análisis Rápido
                                </h4>
                                <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                                    {topMaterialsByCost.length > 0 && (
                                        <li>• El material con mayor gasto es <strong className="text-slate-900 dark:text-white">{topMaterialsByCost[0].name}</strong> con {formatCurrencyInv(topMaterialsByCost[0].cost)} ({totalCost > 0 ? ((topMaterialsByCost[0].cost / totalCost) * 100).toFixed(1) : 0}% del total).</li>
                                    )}
                                    {categoryDistribution.length > 0 && (
                                        <li>• La categoría principal es <strong className="text-slate-900 dark:text-white">{categoryDistribution[0].name}</strong> representando {totalCost > 0 ? ((categoryDistribution[0].value / totalCost) * 100).toFixed(1) : 0}% del costo.</li>
                                    )}
                                    {dailyTrend.length > 0 && (() => {
                                        const peakDay = dailyTrend.reduce((max, d) => d.entradas > max.entradas ? d : max, dailyTrend[0]);
                                        return peakDay.entradas > 0 ? (
                                            <li>• El día con más actividad fue el <strong className="text-slate-900 dark:text-white">{peakDay.day} de {MONTH_NAMES[month]}</strong> con {peakDay.entradas} entradas.</li>
                                        ) : null;
                                    })()}
                                    <li>• Promedio diario: <strong className="text-slate-900 dark:text-white">{(totalEntries / new Date(year, month + 1, 0).getDate()).toFixed(1)}</strong> entradas/día.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* ─── Detailed Table ─── */}
                    <div className={sectionClass}>
                        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-sky-500 text-[20px]">table_chart</span>
                                Desglose Completo — {MONTH_NAMES[month]} {year}
                            </h3>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                {detailedRows.length} materiales
                            </span>
                        </div>
                        <div className="overflow-x-auto p-5">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="pb-3 text-left text-xs font-semibold text-slate-400">#</th>
                                        <th className="pb-3 text-left text-xs font-semibold text-slate-400">Código</th>
                                        <th className="pb-3 text-left text-xs font-semibold text-slate-400">Material</th>
                                        <th className="pb-3 text-center text-xs font-semibold text-slate-400">Categoría</th>
                                        <th className="pb-3 text-right text-xs font-semibold text-slate-400">Entradas</th>
                                        <th className="pb-3 text-right text-xs font-semibold text-slate-400">Cant. Total</th>
                                        <th className="pb-3 text-right text-xs font-semibold text-slate-400">Costo Total</th>
                                        <th className="pb-3 text-right text-xs font-semibold text-slate-400">% del Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {detailedRows.map((row, idx) => (
                                        <tr key={row.product_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="py-2.5 text-xs text-slate-400 font-mono">{idx + 1}</td>
                                            <td className="py-2.5 font-mono text-xs font-bold text-primary">{row.code}</td>
                                            <td className="py-2.5 font-medium text-slate-900 dark:text-white">{row.name}</td>
                                            <td className="py-2.5 text-center">
                                                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                                    <span className="material-symbols-outlined text-[14px]">
                                                        {CATEGORY_ICONS[row.category as keyof typeof CATEGORY_ICONS] || 'category'}
                                                    </span>
                                                    {CATEGORY_LABELS[row.category as keyof typeof CATEGORY_LABELS] || row.category}
                                                </span>
                                            </td>
                                            <td className="py-2.5 text-right text-slate-600 dark:text-slate-300 font-semibold">{row.entries}</td>
                                            <td className="py-2.5 text-right font-semibold text-slate-900 dark:text-white">
                                                {row.totalQty.toLocaleString('es-MX')} <span className="text-xs font-normal text-slate-400">{UNIT_LABELS[row.unit as keyof typeof UNIT_LABELS] || row.unit}</span>
                                            </td>
                                            <td className="py-2.5 text-right font-bold text-red-500">{formatCurrencyInv(row.totalCost)}</td>
                                            <td className="py-2.5 text-right">
                                                <span className="inline-flex items-center gap-1">
                                                    <div className="h-1.5 w-12 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${totalCost > 0 ? (row.totalCost / totalCost) * 100 : 0}%` }} />
                                                    </div>
                                                    <span className="text-xs font-semibold text-slate-500">
                                                        {totalCost > 0 ? ((row.totalCost / totalCost) * 100).toFixed(1) : '0'}%
                                                    </span>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                                        <td colSpan={4} className="py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total del Mes</td>
                                        <td className="py-3 text-right font-bold text-slate-900 dark:text-white">{totalEntries}</td>
                                        <td className="py-3 text-right text-slate-500">—</td>
                                        <td className="py-3 text-right text-lg font-bold text-red-500">{formatCurrencyInv(totalCost)}</td>
                                        <td className="py-3 text-right text-xs font-bold text-indigo-500">100%</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
