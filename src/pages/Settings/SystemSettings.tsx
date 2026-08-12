import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
    OperationalDefaults,
    DEFAULT_OPERATIONAL_VALUES,
    OPERATIONAL_FIELD_LABELS,
} from '../../types/settings';
import { formatCurrency } from '../../types/quotes';
import {
    AppUser, ModulePermissions,
    MODULE_KEYS, PASSWORD_RULES, isPasswordValid,
    buildEmptyPermissions, AVATAR_COLORS,
} from '../../types/auth';

import TareasTab from './TareasTab';
import IntegracionesTab from './IntegracionesTab';

type TabKey = 'operativos' | 'catalogos' | 'usuarios' | 'tareas' | 'integraciones';

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function SystemSettings() {
    const [activeTab, setActiveTab] = useState<TabKey>('operativos');

    const tabs: { key: TabKey; label: string; icon: string }[] = [
        { key: 'operativos', label: 'Parámetros Operativos', icon: 'tune' },
        { key: 'catalogos', label: 'Catálogos', icon: 'folder_open' },
        { key: 'usuarios', label: 'Usuarios', icon: 'people' },
        { key: 'tareas', label: 'Automatizaciones', icon: 'bolt' },
        { key: 'integraciones', label: 'Integraciones', icon: 'mail' },
    ];

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-white text-[26px]">settings</span>
                </div>
                <div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                        Configuración del Sistema
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Administra parámetros, catálogos, usuarios y roles
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200/60 bg-white/50 p-1.5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                            activeTab === t.key
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[20px]">{t.icon}</span>
                        <span className="hidden sm:inline">{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'operativos' && <OperativosTab />}
            {activeTab === 'catalogos' && <CatalogosTab />}
            {activeTab === 'usuarios' && <UsuariosTab />}
            {activeTab === 'tareas' && <TareasTab />}
            {activeTab === 'integraciones' && <IntegracionesTab />}
        </div>
    );
}

// ============================================================
// Shared styles
// ============================================================
const sectionClass = 'rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50';
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

// ============================================================
// TAB 1: PARÁMETROS OPERATIVOS
// ============================================================
function OperativosTab() {
    const [defaults, setDefaults] = useState<OperationalDefaults>(DEFAULT_OPERATIONAL_VALUES);
    const [savedDefaults, setSavedDefaults] = useState<OperationalDefaults>(DEFAULT_OPERATIONAL_VALUES);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const costFields: (keyof OperationalDefaults)[] = ['cost_per_km', 'viaticos_per_person', 'insurance_cost', 'vehicle_wear', 'maniobra_cost'];
    const percentFields: (keyof OperationalDefaults)[] = ['margin_percent', 'tax_percent'];
    const operationalFields: (keyof OperationalDefaults)[] = ['crew_size', 'estimated_days'];
    const electricalFields: (keyof OperationalDefaults)[] = ['max_voltage_unbalance', 'max_amperage_unbalance'];

    const fetchDefaults = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('system_settings').select('*').eq('key', 'operational_defaults').single();
        if (data) {
            const merged = { ...DEFAULT_OPERATIONAL_VALUES, ...data.value } as OperationalDefaults;
            setDefaults(merged);
            setSavedDefaults(merged);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchDefaults(); }, [fetchDefaults]);

    const handleChange = (field: keyof OperationalDefaults, value: string) => {
        setDefaults(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    };

    const hasChanges = JSON.stringify(defaults) !== JSON.stringify(savedDefaults);
    const isChanged = (field: keyof OperationalDefaults) => defaults[field] !== savedDefaults[field];

    const handleSave = async () => {
        setSaving(true);
        await supabase.from('system_settings').update({ value: defaults as unknown as Record<string, unknown> }).eq('key', 'operational_defaults');
        setSavedDefaults({ ...defaults });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        setSaving(false);
    };

    const renderField = (field: keyof OperationalDefaults) => {
        const meta = OPERATIONAL_FIELD_LABELS[field];
        const changed = isChanged(field);
        return (
            <div key={field} className={`group relative rounded-xl border p-4 transition-all duration-300 ${changed
                ? 'border-amber-300 bg-amber-50/50 shadow-sm dark:border-amber-700 dark:bg-amber-900/10'
                : 'border-slate-200/60 bg-white/30 hover:border-slate-300 hover:shadow-sm dark:border-slate-700/40 dark:bg-slate-800/30'
            }`}>
                <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${changed
                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary dark:bg-slate-800'
                    }`}>
                        <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <label className="text-sm font-bold text-slate-900 dark:text-white">{meta.label}</label>
                            {changed && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 animate-pulse">Modificado</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mb-3">{meta.description}</p>
                        <div className="flex items-center gap-2">
                            <input type="number" step={field.includes('percent') ? '1' : '0.01'} min="0" value={defaults[field]}
                                onChange={e => handleChange(field, e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-right font-mono font-semibold"
                            />
                            <span className="shrink-0 text-xs font-semibold text-slate-400 w-20 text-right">{meta.unit}</span>
                        </div>
                        {changed && (
                            <div className="mt-2 flex items-center justify-between text-[10px]">
                                <span className="text-slate-400">Anterior: <span className="font-mono font-bold text-slate-500">{meta.unit.startsWith('$') ? formatCurrency(savedDefaults[field]) : `${savedDefaults[field]} ${meta.unit}`}</span></span>
                                <button onClick={() => setDefaults(prev => ({ ...prev, [field]: savedDefaults[field] }))} className="text-primary hover:underline font-semibold">Revertir</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) return <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

    return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="flex flex-col gap-6 xl:col-span-2">
                {/* Save bar */}
                {hasChanges && (
                    <div className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 dark:border-amber-800/40 dark:bg-amber-900/10">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500 text-[20px]">warning</span>
                            <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Cambios sin guardar</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setDefaults({ ...savedDefaults })} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-400">Descartar</button>
                            <button onClick={handleSave} disabled={saving} className={`rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-md ${saveSuccess ? 'bg-emerald-500' : 'bg-primary'}`}>
                                {saving ? 'Guardando...' : saveSuccess ? '¡Guardado!' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                )}

                <div className={sectionClass}>
                    <div className="mb-5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[22px]">local_shipping</span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Costos de Traslado y Viáticos</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{costFields.map(renderField)}</div>
                </div>

                <div className={sectionClass}>
                    <div className="mb-5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[22px]">percent</span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Márgenes e Impuestos</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{percentFields.map(renderField)}</div>
                </div>

                <div className={sectionClass}>
                    <div className="mb-5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[22px]">engineering</span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Parámetros Operativos</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{operationalFields.map(renderField)}</div>
                </div>

                <div className={sectionClass}>
                    <div className="mb-5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[22px]">speed</span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Parámetros de Mantenimiento Eléctrico</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{electricalFields.map(renderField)}</div>
                </div>
            </div>

            {/* Sidebar: Preview + Proactive Config */}
            <div className="xl:col-span-1">
                <div className="sticky top-8 space-y-6">
                    <div className={sectionClass}>
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                            <span className="material-symbols-outlined text-primary text-[20px]">preview</span>
                            Vista Previa de Cotización
                        </h3>
                        <div className="space-y-2.5 text-sm">
                            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Costo por km</span><span className="font-mono font-bold">{formatCurrency(defaults.cost_per_km)}</span></div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Viáticos/persona/día</span><span className="font-mono font-bold">{formatCurrency(defaults.viaticos_per_person)}</span></div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Seguros</span><span className="font-mono font-bold">{formatCurrency(defaults.insurance_cost)}</span></div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Desgaste vehículo</span><span className="font-mono font-bold">{formatCurrency(defaults.vehicle_wear)}</span></div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Maniobras</span><span className="font-mono font-bold">{formatCurrency(defaults.maniobra_cost)}</span></div>
                            <div className="border-t border-slate-200 pt-2 dark:border-slate-700">
                                <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Margen</span><span className="font-mono font-bold text-emerald-600">{defaults.margin_percent}%</span></div>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>IVA</span><span className="font-mono font-bold">{defaults.tax_percent}%</span></div>
                        </div>
                    </div>

                    {/* Proactive Maintenance Recipients */}
                    <ProactiveRecipientsConfig />
                </div>
            </div>
        </div>
    );
}

// ============================================================
// TAB 2: CATÁLOGOS Y DIRECTORIOS
// ============================================================
function CatalogosTab() {
    const [serviceCategories, setServiceCategories] = useState<string[]>([]);
    const [savedServiceCategories, setSavedServiceCategories] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [loading, setLoading] = useState(true);
    const [newCategory, setNewCategory] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('system_settings').select('*').eq('key', 'service_categories').single();
        if (data) {
            const arr = Array.isArray(data.value) ? data.value as string[] : [];
            setServiceCategories(arr);
            setSavedServiceCategories(arr);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const hasChanges = JSON.stringify(serviceCategories) !== JSON.stringify(savedServiceCategories);

    const handleSave = async () => {
        setSaving(true);
        await supabase.from('system_settings').update({ value: serviceCategories as unknown as Record<string, unknown> }).eq('key', 'service_categories');
        setSavedServiceCategories([...serviceCategories]);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        setSaving(false);
    };

    const handleAddCategory = () => {
        const trimmed = newCategory.trim();
        if (!trimmed) return;
        if (serviceCategories.includes(trimmed)) {
            alert('La categoría ya existe');
            return;
        }
        setServiceCategories([...serviceCategories, trimmed]);
        setNewCategory('');
    };

    const handleRemoveCategory = (cat: string) => {
        setServiceCategories(serviceCategories.filter(c => c !== cat));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCategory();
        }
    };

    if (loading) return <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

    return (
        <div className="max-w-3xl">
            {hasChanges && (
                <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 dark:border-amber-800/40 dark:bg-amber-900/10">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500 text-[20px]">warning</span>
                        <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Cambios sin guardar</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setServiceCategories([...savedServiceCategories])} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-400">Descartar</button>
                        <button onClick={handleSave} disabled={saving} className={`rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-md ${saveSuccess ? 'bg-emerald-500' : 'bg-primary'}`}>
                            {saving ? 'Guardando...' : saveSuccess ? '¡Guardado!' : 'Guardar'}
                        </button>
                    </div>
                </div>
            )}

            <div className={sectionClass}>
                <div className="mb-5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">category</span>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Categorías de Servicios</h3>
                        <p className="text-xs text-slate-500">Etiquetas disponibles para el catálogo de servicios y cotizaciones.</p>
                    </div>
                </div>

                {/* Input form */}
                <div className="mb-6 flex items-center gap-3">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">sell</span>
                        <input
                            type="text"
                            value={newCategory}
                            onChange={e => setNewCategory(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className={`${inputClass} pl-12`}
                            placeholder="Ej: Electricidad, Media Tensión, Aforo..."
                        />
                    </div>
                    <button
                        onClick={handleAddCategory}
                        disabled={!newCategory.trim()}
                        className="flex h-[42px] items-center gap-2 rounded-lg bg-primary px-5 font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-dark disabled:opacity-50 disabled:shadow-none"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        Agregar
                    </button>
                </div>

                {/* Chips container */}
                <div className="rounded-xl border border-slate-200/50 bg-slate-50/50 p-5 dark:border-slate-800/50 dark:bg-slate-800/30">
                    <div className="flex flex-wrap gap-2.5">
                        {serviceCategories.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">No hay categorías registradas.</p>
                        ) : (
                            serviceCategories.map((c, i) => (
                                <div key={i} className="group flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 pl-3 pr-1.5 py-1.5 transition-colors hover:border-primary/40 hover:bg-primary/20">
                                    <span className="material-symbols-outlined text-[14px] text-primary">label</span>
                                    <span className="text-xs font-bold text-primary dark:text-primary-content">{c}</span>
                                    <button
                                        onClick={() => handleRemoveCategory(c)}
                                        className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-primary hover:bg-primary hover:text-white transition-colors"
                                        title="Eliminar categoría"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// TAB 3: USUARIOS
// ============================================================
function UsuariosTab() {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState<AppUser | null>(null);
    const [form, setForm] = useState({ full_name: '', email: '', password: '', permissions: buildEmptyPermissions(), avatar_color: '#6366f1', phone: '' });
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [deactivateTarget, setDeactivateTarget] = useState<AppUser | null>(null);
    const [reassignTo, setReassignTo] = useState('');
    const [deactivating, setDeactivating] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [usersRes, tasksRes] = await Promise.all([
            supabase.from('app_users').select('*').order('full_name'),
            supabase.from('team_tasks').select('assigned_to').neq('status', 'completed'),
        ]);
        setUsers(usersRes.data || []);
        const counts: Record<string, number> = {};
        for (const t of (tasksRes.data || [])) {
            counts[t.assigned_to] = (counts[t.assigned_to] || 0) + 1;
        }
        setTaskCounts(counts);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const resetForm = () => {
        setForm({ full_name: '', email: '', password: '', permissions: buildEmptyPermissions(), avatar_color: '#6366f1', phone: '' });
        setEditingUser(null);
        setShowForm(false);
        setFormError('');
    };

    const handleCreateUser = async () => {
        setFormError('');
        if (!form.full_name.trim() || !form.email.trim()) { setFormError('Nombre y email son obligatorios'); return; }
        if (!form.password && !editingUser) { setFormError('La contraseña es obligatoria'); return; }
        if (form.password && !isPasswordValid(form.password)) { setFormError('La contraseña no cumple los requisitos de seguridad'); return; }
        setSaving(true);
        if (editingUser) {
            const { error } = await supabase.from('app_users').update({
                full_name: form.full_name.trim(),
                email: form.email.trim().toLowerCase(),
                permissions: form.permissions,
                avatar_color: form.avatar_color,
                phone: form.phone.trim() || null,
            }).eq('id', editingUser.id);
            if (error) { setFormError(error.message); setSaving(false); return; }
            if (form.password) {
                const { data } = await supabase.rpc('update_user_password', { p_user_id: editingUser.id, p_new_password: form.password });
                const result = data as { success: boolean; message?: string } | null;
                if (result && !result.success) { setFormError(result.message || 'Error al cambiar contraseña'); setSaving(false); return; }
            }
        } else {
            const { data } = await supabase.rpc('create_app_user', {
                p_full_name: form.full_name.trim(),
                p_email: form.email.trim().toLowerCase(),
                p_password: form.password,
                p_permissions: form.permissions,
                p_avatar_color: form.avatar_color,
                p_phone: form.phone.trim() || null,
            });
            const result = data as { success: boolean; message?: string } | null;
            if (result && !result.success) { setFormError(result.message || 'Error al crear usuario'); setSaving(false); return; }
        }
        setSaving(false);
        resetForm();
        fetchData();
    };

    const handleEditUser = (u: any) => {
        setEditingUser(u);
        const merged = { ...buildEmptyPermissions(), ...(u.permissions || {}) };
        setForm({ full_name: u.full_name, email: u.email, password: '', permissions: merged as any, avatar_color: u.avatar_color || '#6366f1', phone: u.phone || '' });
        setShowForm(true);
        setFormError('');
    };

    const confirmDeactivate = async () => {
        if (!deactivateTarget) return;
        setDeactivating(true);
        if (reassignTo && (taskCounts[deactivateTarget.full_name] || 0) > 0) {
            await supabase.from('team_tasks')
                .update({ assigned_to: reassignTo })
                .eq('assigned_to', deactivateTarget.full_name)
                .neq('status', 'completed');
        }
        await supabase.from('app_users').update({ is_active: false }).eq('id', deactivateTarget.id);
        setDeactivateTarget(null);
        setReassignTo('');
        setDeactivating(false);
        fetchData();
    };

    const handleToggleActive = async (u: AppUser) => {
        if (u.is_active) {
            setDeactivateTarget(u);
            setReassignTo('');
        } else {
            await supabase.from('app_users').update({ is_active: true }).eq('id', u.id);
            fetchData();
        }
    };

    if (loading) return <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

    return (
        <div>
            {/* Deactivate Confirmation Modal */}
            {deactivateTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                            <span className="material-symbols-outlined text-amber-600 text-[24px]">person_off</span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">Dar de baja a {deactivateTarget.full_name}</h4>
                        <p className="mt-1 text-sm text-slate-500">Este usuario no podrá iniciar sesión. Sus datos se conservan.</p>
                        {(taskCounts[deactivateTarget.full_name] || 0) > 0 && (
                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-900/20">
                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                    ⚠️ Tiene {taskCounts[deactivateTarget.full_name]} tareas pendientes
                                </p>
                                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">¿Reasignar a otro usuario? (opcional)</p>
                                <select
                                    value={reassignTo}
                                    onChange={e => setReassignTo(e.target.value)}
                                    className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm dark:border-amber-700 dark:bg-slate-700 dark:text-white"
                                >
                                    <option value="">— No reasignar —</option>
                                    {users.filter(u => u.is_active && u.id !== deactivateTarget.id).map(u => (
                                        <option key={u.id} value={u.full_name}>{u.full_name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="mt-5 flex gap-3">
                            <button onClick={confirmDeactivate} disabled={deactivating}
                                className="flex-1 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                                {deactivating ? 'Procesando...' : 'Confirmar Baja'}
                            </button>
                            <button onClick={() => { setDeactivateTarget(null); setReassignTo(''); }}
                                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-400">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Directorio de Usuarios</h3>
                    <p className="text-sm text-slate-500">
                        <span className="text-emerald-600 font-semibold">{users.filter(u => u.is_active).length} activos</span>
                        {users.some(u => !u.is_active) && <span className="ml-2 text-slate-400">· {users.filter(u => !u.is_active).length} dados de baja</span>}
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setForm(f => ({ ...f, permissions: buildEmptyPermissions() })); setShowForm(true); }}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20"
                >
                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                    Nuevo Usuario
                </button>
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-6 dark:bg-primary/5">
                    <h4 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">
                        {editingUser ? `Editar: ${editingUser.full_name}` : 'Crear Nuevo Usuario'}
                    </h4>

                    {formError && (
                        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                            <span className="material-symbols-outlined text-[18px]">error</span>{formError}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div>
                            <label className={labelClass}>Nombre completo *</label>
                            <input autoComplete="off" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className={inputClass} placeholder="Ej: Joel García" />
                        </div>
                        <div>
                            <label className={labelClass}>Email *</label>
                            <input type="email" autoComplete="off" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder="joel@nucleo.com" />
                        </div>
                        <div>
                            <label className={labelClass}>Celular (WhatsApp)</label>
                            <input type="tel" autoComplete="off" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass} placeholder="521..." title="Incluir código de país sin el '+'" />
                        </div>
                        <div>
                            <label className={labelClass}>{editingUser ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña *'}</label>
                            <input type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inputClass} placeholder="••••••••" />
                        </div>
                        
                        <div>
                            <label className={labelClass}>Color de avatar</label>
                            <div className="flex flex-wrap gap-2">
                                {AVATAR_COLORS.map(c => (
                                    <button key={c} onClick={() => setForm({ ...form, avatar_color: c })}
                                        className={`h-8 w-8 rounded-full transition-all ${form.avatar_color === c ? 'ring-2 ring-primary ring-offset-2 scale-110' : 'hover:scale-110'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                        
                    {/* Permissions Matrix */}
                    <div className="col-span-full mt-4">
                        <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Matriz de Permisos Individuales</h5>
                        <div className="rounded-xl border border-slate-200/60 bg-white/50 overflow-x-auto dark:border-slate-800/60 dark:bg-slate-900/50">
                            <table className="w-full text-sm min-w-[500px]">
                                <thead className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-500">Módulo</th>
                                        <th className="px-3 py-3 text-center font-semibold text-slate-500 w-20">Ver</th>
                                        <th className="px-3 py-3 text-center font-semibold text-slate-500 w-20">Crear</th>
                                        <th className="px-3 py-3 text-center font-semibold text-slate-500 w-20">Editar</th>
                                        <th className="px-3 py-3 text-center font-semibold text-slate-500 w-20">Eliminar</th>
                                        <th className="px-3 py-3 text-center font-semibold text-slate-500 w-20">Todo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {MODULE_KEYS.map(m => {
                                        const p = (form.permissions as any)[m.key] || { view: false, create: false, edit: false, delete: false };
                                        const allChecked = p.view && p.create && p.edit && p.delete;
                                        
                                        const togglePerm = (moduleKey: string, action: 'view' | 'create' | 'edit' | 'delete') => {
                                            setForm(prev => {
                                                const perms = { ...prev.permissions } as any;
                                                const mod = { ...(perms[moduleKey] || { view: false, create: false, edit: false, delete: false }) };
                                                mod[action] = !mod[action];
                                                if (action === 'view' && !mod[action]) {
                                                    mod.create = false; mod.edit = false; mod.delete = false;
                                                }
                                                if (action !== 'view' && mod[action]) { mod.view = true; }
                                                perms[moduleKey] = mod;
                                                return { ...prev, permissions: perms };
                                            });
                                        };
                                        const selectAllForModule = (moduleKey: string, value: boolean) => {
                                            setForm(prev => {
                                                const perms = { ...prev.permissions } as any;
                                                perms[moduleKey] = { view: value, create: value, edit: value, delete: value };
                                                return { ...prev, permissions: perms };
                                            });
                                        };
                                        return (
                                            <tr key={m.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[18px] text-slate-400">{m.icon}</span>
                                                        <span className="font-medium text-slate-700 dark:text-slate-300">{m.label}</span>
                                                    </div>
                                                </td>
                                                {(['view', 'create', 'edit', 'delete'] as const).map(action => (
                                                    <td key={action} className="px-3 py-3 text-center">
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); togglePerm(m.key, action); }}
                                                            className={`h-6 w-6 rounded-md border-2 transition-all mx-auto flex items-center justify-center ${
                                                                p[action]
                                                                    ? 'border-primary bg-primary text-white'
                                                                    : 'border-slate-300 bg-white hover:border-primary/50 dark:border-slate-600 dark:bg-slate-800'
                                                            }`}
                                                        >
                                                            {p[action] && <span className="material-symbols-outlined text-[16px]">check</span>}
                                                        </button>
                                                    </td>
                                                ))}
                                                <td className="px-3 py-3 text-center">
                                                    <button
                                                        onClick={(e) => { e.preventDefault(); selectAllForModule(m.key, !allChecked); }}
                                                        className={`h-6 w-6 rounded-md border-2 transition-all mx-auto flex items-center justify-center ${
                                                            allChecked
                                                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                                                : 'border-slate-300 bg-white hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800'
                                                        }`}
                                                    >
                                                        {allChecked && <span className="material-symbols-outlined text-[16px]">done_all</span>}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    </div>

                    {/* Password strength indicator */}
                    {form.password && (
                        <div className="mt-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                            <p className="mb-2 text-xs font-bold text-slate-500">Requisitos de contraseña:</p>
                            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                {PASSWORD_RULES.map(r => (
                                    <div key={r.key} className={`flex items-center gap-2 text-xs font-medium ${r.test(form.password) ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        <span className="material-symbols-outlined text-[16px]">{r.test(form.password) ? 'check_circle' : 'radio_button_unchecked'}</span>
                                        {r.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-4 flex gap-2">
                        <button onClick={handleCreateUser} disabled={saving} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                            {saving ? 'Guardando...' : editingUser ? 'Actualizar' : 'Crear Usuario'}
                        </button>
                        <button onClick={resetForm} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-400">Cancelar</button>
                    </div>
                </div>
            )}

            {/* User Cards — Active */}
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Usuarios Activos</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {users.filter(u => u.is_active).map(u => (
                    <div key={u.id}
                        onClick={() => handleEditUser(u)}
                        className="group cursor-pointer rounded-xl border border-slate-200/60 bg-white/50 p-5 transition-all hover:border-primary/30 hover:shadow-md dark:border-slate-800/60 dark:bg-slate-900/50"
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-sm"
                                style={{ backgroundColor: u.avatar_color || '#6366f1' }}
                            >
                                {u.full_name?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{u.full_name}</p>
                                <p className="truncate text-xs text-slate-500">{u.email}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Activo</span>
                                    {(taskCounts[u.full_name] || 0) > 0 && (
                                        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                            <span className="material-symbols-outlined text-[10px]">task_alt</span>
                                            {taskCounts[u.full_name]} tareas
                                        </span>
                                    )}
                                </div>
                                {u.phone && (
                                    <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                                        <span className="material-symbols-outlined text-[12px] text-emerald-500">phone_iphone</span>
                                        {u.phone}
                                    </p>
                                )}
                                {u.last_login && (
                                    <p className="mt-0.5 text-[10px] text-slate-400">
                                        Último login: {new Date(u.last_login).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                            <button onClick={e => { e.stopPropagation(); handleToggleActive(u); }}
                                className="ml-1 shrink-0 rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                                title="Dar de baja"
                            >
                                <span className="material-symbols-outlined text-[20px]">person_off</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* User Cards — Inactive */}
            {users.some(u => !u.is_active) && (
                <div className="mt-8">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Usuarios Dados de Baja</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {users.filter(u => !u.is_active).map(u => (
                            <div key={u.id} className="rounded-xl border border-slate-200/40 bg-slate-50/50 p-5 dark:border-slate-800/40 dark:bg-slate-900/30">
                                <div className="flex items-start gap-3">
                                    <div
                                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-sm grayscale opacity-50"
                                        style={{ backgroundColor: u.avatar_color || '#6366f1' }}
                                    >
                                        {u.full_name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-slate-400 line-through">{u.full_name}</p>
                                        <p className="truncate text-xs text-slate-400">{u.email}</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-400">Dado de baja</span>
                                            {(taskCounts[u.full_name] || 0) > 0 && (
                                                <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                                                    ⚠️ {taskCounts[u.full_name]} tareas pendientes
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={() => handleToggleActive(u)}
                                        className="ml-1 shrink-0 rounded-lg p-2 text-slate-300 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20"
                                        title="Reactivar usuario"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">person_add</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================
// Proactive Maintenance Recipients Config (used in OperativosTab sidebar)
// ============================================================
function ProactiveRecipientsConfig() {
    const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [saved, setSaved] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveOk, setSaveOk] = useState(false);

    useEffect(() => {
        (async () => {
            const [usersRes, settingRes] = await Promise.all([
                supabase.from('app_users').select('id, full_name').eq('is_active', true).order('full_name'),
                supabase.from('system_settings').select('value').eq('key', 'proactive_maint_recipients').single(),
            ]);
            setUsers(usersRes.data || []);
            const val = Array.isArray(settingRes.data?.value) ? settingRes.data.value as string[] : [];
            setSelected(val);
            setSaved(val);
            setLoading(false);
        })();
    }, []);

    const toggle = (name: string) => {
        setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
    };

    const hasChanges = JSON.stringify(selected.sort()) !== JSON.stringify(saved.sort());

    const handleSave = async () => {
        setSaving(true);
        await supabase.from('system_settings').upsert({
            key: 'proactive_maint_recipients',
            value: selected as unknown as Record<string, unknown>,
            description: 'Lista de nombres de usuario que recibirán notificaciones de mantenimiento proactivo.',
        }, { onConflict: 'key' });
        setSaved([...selected]);
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 3000);
        setSaving(false);
    };

    if (loading) return <div className="rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" /></div>;

    return (
        <div className="rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <span className="material-symbols-outlined text-amber-500 text-[20px]">track_changes</span>
                Alertas de Mantenimiento Proactivo
            </h3>
            <p className="mb-4 text-[11px] text-slate-500 leading-tight">
                Selecciona qué usuarios recibirán notificaciones internas cuando se detecte un equipo sin mantenimiento reciente.
            </p>

            <div className="space-y-2">
                {users.map(u => (
                    <button
                        key={u.id}
                        onClick={() => toggle(u.full_name)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                            selected.includes(u.full_name)
                                ? 'border-primary/30 bg-primary/5'
                                : 'border-slate-200/60 bg-white/30 hover:border-slate-300 dark:border-slate-700/40 dark:bg-slate-800/30'
                        }`}
                    >
                        <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
                            selected.includes(u.full_name)
                                ? 'border-primary bg-primary text-white'
                                : 'border-slate-300 dark:border-slate-600'
                        }`}>
                            {selected.includes(u.full_name) && <span className="material-symbols-outlined text-[14px]">check</span>}
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{u.full_name}</span>
                    </button>
                ))}
            </div>

            {selected.length === 0 && (
                <p className="mt-3 text-[10px] text-amber-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">info</span>
                    Sin destinatarios configurados — no se enviarán notificaciones.
                </p>
            )}

            {hasChanges && (
                <div className="mt-4 flex gap-2">
                    <button onClick={handleSave} disabled={saving}
                        className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm ${saveOk ? 'bg-emerald-500' : 'bg-primary'}`}>
                        {saving ? 'Guardando...' : saveOk ? '✓ Guardado' : 'Guardar'}
                    </button>
                    <button onClick={() => setSelected([...saved])}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 dark:border-slate-700">
                        Revertir
                    </button>
                </div>
            )}
        </div>
    );
}
