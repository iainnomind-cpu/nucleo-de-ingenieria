import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    InventoryMovement, InventoryProduct,
    CATEGORY_LABELS, CATEGORY_ICONS,
    UNIT_LABELS,
    formatCurrencyInv,
} from '../../types/inventory';

interface ProjectSummary {
    id: string;
    project_number: string;
    title: string;
    status: string;
    budget: number | null;
    actual_cost: number | null;
}

interface ConsumptionRow {
    product_id: string;
    product_name: string;
    product_code: string;
    category: string;
    unit: string;
    total_qty: number;
    avg_unit_cost: number;
    total_cost: number;
}

export default function ConsumptionReport() {
    const navigate = useNavigate();
    const [movements, setMovements] = useState<(InventoryMovement & { product?: InventoryProduct })[]>([]);
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState<string>('all');

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [movRes, projRes] = await Promise.all([
            supabase.from('inventory_movements')
                .select('*, product:inventory_products(*)')
                .eq('movement_type', 'exit')
                .order('created_at', { ascending: false }),
            supabase.from('projects')
                .select('id, project_number, title, status, budget, actual_cost')
                .order('project_number', { ascending: false }),
        ]);
        setMovements((movRes.data || []) as (InventoryMovement & { product?: InventoryProduct })[]);
        setProjects((projRes.data || []) as ProjectSummary[]);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Group movements by project
    const projectConsumption = useMemo(() => {
        const map = new Map<string, { project: ProjectSummary | null; rows: ConsumptionRow[]; total: number }>();

        const filteredMovements = selectedProject === 'all'
            ? movements
            : movements.filter(m => m.reference_id === selectedProject);

        filteredMovements.forEach(m => {
            const projId = m.reference_id || '__no_project__';
            if (!map.has(projId)) {
                const proj = projects.find(p => p.id === projId) || null;
                map.set(projId, { project: proj, rows: [], total: 0 });
            }
            const entry = map.get(projId)!;
            const existing = entry.rows.find(r => r.product_id === m.product_id);
            const cost = m.total_cost || (m.quantity * (m.unit_cost || 0));
            if (existing) {
                existing.total_qty += m.quantity;
                existing.total_cost += cost;
                existing.avg_unit_cost = existing.total_cost / existing.total_qty;
            } else {
                entry.rows.push({
                    product_id: m.product_id,
                    product_name: m.product?.name || '—',
                    product_code: m.product?.code || '—',
                    category: m.product?.category || 'otro',
                    unit: m.product?.unit || 'pieza',
                    total_qty: m.quantity,
                    avg_unit_cost: m.unit_cost || 0,
                    total_cost: cost,
                });
            }
            entry.total += cost;
        });

        // Sort by total descending
        return Array.from(map.entries())
            .sort((a, b) => b[1].total - a[1].total);
    }, [movements, projects, selectedProject]);

    // Grand totals
    const grandTotal = projectConsumption.reduce((s, [, v]) => s + v.total, 0);
    const totalMovements = movements.length;

    const sectionClass = 'rounded-xl border border-slate-200/60 bg-white/50 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50';

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
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                            Consumo por Proyecto
                        </h2>
                        <p className="text-sm text-slate-500">
                            {totalMovements} salidas · Total consumido: <strong className="text-red-500">{formatCurrencyInv(grandTotal)}</strong>
                        </p>
                    </div>
                </div>
                <div>
                    <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        <option value="all">Todos los proyectos</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: 'Total Consumido', value: formatCurrencyInv(grandTotal), icon: 'trending_down', color: 'from-red-500 to-rose-500' },
                    { label: 'Proyectos con Consumo', value: projectConsumption.filter(([k]) => k !== '__no_project__').length.toString(), icon: 'engineering', color: 'from-sky-500 to-cyan-500' },
                    { label: 'Materiales Distintos', value: new Set(movements.map(m => m.product_id)).size.toString(), icon: 'inventory_2', color: 'from-amber-500 to-orange-500' },
                    { label: 'Salidas Registradas', value: totalMovements.toString(), icon: 'swap_vert', color: 'from-purple-500 to-violet-500' },
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

            {/* Content */}
            {loading ? (
                <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : projectConsumption.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                    <span className="material-symbols-outlined text-[48px] text-slate-300">analytics</span>
                    <p className="text-sm text-slate-500">Sin consumo de materiales registrado.</p>
                    <p className="text-xs text-slate-400">Registra salidas de inventario con razón "Consumo Proyecto" y referencia al proyecto.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {projectConsumption.map(([projId, data]) => {
                        const proj = data.project;
                        const budgetDiff = proj?.budget ? proj.budget - data.total : null;
                        const budgetUsedPct = proj?.budget ? (data.total / proj.budget) * 100 : null;
                        return (
                            <div key={projId} className={sectionClass}>
                                {/* Project header */}
                                <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-cyan-500 shadow">
                                            <span className="material-symbols-outlined text-white text-[20px]">engineering</span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white">
                                                {proj ? `${proj.project_number} — ${proj.title}` : 'Sin proyecto asignado'}
                                            </h3>
                                            {proj && <p className="text-xs text-slate-400">{proj.status}</p>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 text-right">
                                        <div>
                                            <p className="text-xs text-slate-400">Consumido</p>
                                            <p className="text-lg font-bold text-red-500">{formatCurrencyInv(data.total)}</p>
                                        </div>
                                        {proj?.budget && (
                                            <div>
                                                <p className="text-xs text-slate-400">Presupuesto</p>
                                                <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrencyInv(proj.budget)}</p>
                                            </div>
                                        )}
                                        {budgetDiff !== null && (
                                            <div>
                                                <p className="text-xs text-slate-400">Diferencia</p>
                                                <p className={`text-lg font-bold ${budgetDiff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {budgetDiff >= 0 ? '+' : ''}{formatCurrencyInv(budgetDiff)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Budget progress bar */}
                                {budgetUsedPct !== null && (
                                    <div className="px-5 pt-3">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-400">Uso de presupuesto en materiales</span>
                                            <span className={`font-bold ${budgetUsedPct > 100 ? 'text-red-500' : budgetUsedPct > 80 ? 'text-amber-500' : 'text-emerald-600'}`}>
                                                {budgetUsedPct.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${budgetUsedPct > 100 ? 'bg-red-500' : budgetUsedPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min(budgetUsedPct, 100)}%` }} />
                                        </div>
                                    </div>
                                )}

                                {/* Materials table */}
                                <div className="p-5">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                <th className="pb-2 text-left text-xs font-semibold text-slate-400">Código</th>
                                                <th className="pb-2 text-left text-xs font-semibold text-slate-400">Material</th>
                                                <th className="pb-2 text-center text-xs font-semibold text-slate-400">Categoría</th>
                                                <th className="pb-2 text-right text-xs font-semibold text-slate-400">Cantidad</th>
                                                <th className="pb-2 text-right text-xs font-semibold text-slate-400">Costo Prom.</th>
                                                <th className="pb-2 text-right text-xs font-semibold text-slate-400">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                            {data.rows.sort((a, b) => b.total_cost - a.total_cost).map(row => (
                                                <tr key={row.product_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                    <td className="py-2 font-mono text-xs font-bold text-primary">{row.product_code}</td>
                                                    <td className="py-2 font-medium text-slate-900 dark:text-white">{row.product_name}</td>
                                                    <td className="py-2 text-center">
                                                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                                            <span className="material-symbols-outlined text-[14px]">{CATEGORY_ICONS[row.category as keyof typeof CATEGORY_ICONS] || 'category'}</span>
                                                            {CATEGORY_LABELS[row.category as keyof typeof CATEGORY_LABELS] || row.category}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 text-right font-semibold text-slate-900 dark:text-white">
                                                        {row.total_qty} <span className="text-xs font-normal text-slate-400">{UNIT_LABELS[row.unit as keyof typeof UNIT_LABELS] || row.unit}</span>
                                                    </td>
                                                    <td className="py-2 text-right text-slate-500">{formatCurrencyInv(row.avg_unit_cost)}</td>
                                                    <td className="py-2 text-right font-bold text-red-500">{formatCurrencyInv(row.total_cost)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                                                <td colSpan={5} className="py-2 text-right text-xs font-semibold text-slate-500">Total Proyecto</td>
                                                <td className="py-2 text-right text-lg font-bold text-red-500">{formatCurrencyInv(data.total)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
