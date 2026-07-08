import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { FinanceAccount, FinanceCategory, FinanceTransaction, formatCurrencyFin } from '../../types/finance';

export function GeneralBalance() {
    const { user, db: supabase } = useAuth();
    
    // Data State
    const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
    const [categories, setCategories] = useState<FinanceCategory[]>([]);
    const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
    const [showTransForm, setShowTransForm] = useState(false);
    const [showCatForm, setShowCatForm] = useState(false);
    const [editingTrans, setEditingTrans] = useState<FinanceTransaction | null>(null);
    const [editingCat, setEditingCat] = useState<FinanceCategory | null>(null);
    const [saving, setSaving] = useState(false);

    // Filters & Search
    const [search, setSearch] = useState('');
    const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM

    // Transaction Form State
    const [transForm, setTransForm] = useState({
        date: new Date().toISOString().split('T')[0],
        description: '',
        type: 'expense' as 'income' | 'expense',
        amount: '',
        category_id: '',
        invoice_number: '',
        rfc: '',
        is_invoiced: false,
    });

    // Category Form State
    const [catForm, setCatForm] = useState({
        name: '',
        color: 'bg-slate-100 text-slate-800',
        is_deductible: true,
    });

    // Color options for categories
    const COLOR_OPTIONS = [
        { label: 'Gris', value: 'bg-slate-100 text-slate-800' },
        { label: 'Esmeralda', value: 'bg-emerald-100 text-emerald-800' },
        { label: 'Rojo', value: 'bg-rose-100 text-rose-800' },
        { label: 'Azul', value: 'bg-sky-100 text-sky-800' },
        { label: 'Morado', value: 'bg-purple-100 text-purple-800' },
        { label: 'Índigo', value: 'bg-indigo-100 text-indigo-800' },
        { label: 'Ámbar', value: 'bg-amber-100 text-amber-800' },
        { label: 'Verde', value: 'bg-green-100 text-green-800' },
    ];

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch Accounts
            const { data: accData, error: accErr } = await supabase.from('finance_accounts').select('*').order('name');
            if (accErr) throw accErr;
            setAccounts(accData || []);
            if (accData && accData.length > 0 && !activeAccountId) {
                // Auto-select Pyme by default if exists, else first one
                const pyme = accData.find(a => a.name.toLowerCase().includes('pyme'));
                setActiveAccountId(pyme ? pyme.id : accData[0].id);
            }

            // Fetch Categories
            const { data: catData, error: catErr } = await supabase.from('finance_categories').select('*').order('name');
            if (catErr) throw catErr;
            setCategories(catData || []);

            // Fetch Transactions for current month
            const startDate = `${filterMonth}-01`;
            const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().split('T')[0];
            
            const { data: transData, error: transErr } = await supabase
                .from('finance_transactions')
                .select('*, category:finance_categories(*)')
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });
                
            if (transErr) throw transErr;
            setTransactions(transData || []);
            
        } catch (error) {
            console.error('Error fetching finance data:', error);
        } finally {
            setLoading(false);
        }
    }, [filterMonth, activeAccountId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const activeAccount = accounts.find(a => a.id === activeAccountId);
    
    // Filter transactions by active account & search
    const filteredTransactions = useMemo(() => {
        let filtered = transactions.filter(t => t.account_id === activeAccountId);
        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(t => 
                t.description.toLowerCase().includes(q) || 
                (t.invoice_number && t.invoice_number.toLowerCase().includes(q)) ||
                (t.rfc && t.rfc.toLowerCase().includes(q)) ||
                (t.category?.name.toLowerCase().includes(q))
            );
        }
        return filtered;
    }, [transactions, activeAccountId, search]);

    // Calculate Summary
    const summary = useMemo(() => {
        const result = {
            total_income: 0,
            total_expense: 0,
            total_invoiced: 0,
            total_not_invoiced: 0,
            total_deductible: 0,
            expenses_by_category: {} as Record<string, number>
        };

        // All transactions for this account (ignoring search to give true month totals)
        const accountTrans = transactions.filter(t => t.account_id === activeAccountId);
        
        accountTrans.forEach(t => {
            const amount = Number(t.amount);
            if (t.type === 'income') {
                result.total_income += amount;
            } else {
                result.total_expense += amount;
                
                // Track by category
                const catName = t.category?.name || 'Sin Categoría';
                result.expenses_by_category[catName] = (result.expenses_by_category[catName] || 0) + amount;
                
                // Deductible?
                if (t.category?.is_deductible) {
                    result.total_deductible += amount;
                }
            }

            // Invoiced?
            if (t.is_invoiced) {
                result.total_invoiced += amount;
            } else {
                result.total_not_invoiced += amount;
            }
        });

        return result;
    }, [transactions, activeAccountId]);

    const currentBalance = (activeAccount?.initial_balance || 0) + summary.total_income - summary.total_expense;

    const handleSaveTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeAccountId || !user) return;
        setSaving(true);
        
        const payload = {
            account_id: activeAccountId,
            date: transForm.date,
            description: transForm.description,
            type: transForm.type,
            amount: Number(transForm.amount),
            category_id: transForm.category_id || null,
            invoice_number: transForm.invoice_number || null,
            rfc: transForm.rfc || null,
            is_invoiced: transForm.is_invoiced,
            created_by: user.id
        };

        try {
            if (editingTrans) {
                const { error } = await supabase.from('finance_transactions').update(payload).eq('id', editingTrans.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('finance_transactions').insert([payload]);
                if (error) throw error;
            }
            setShowTransForm(false);
            setEditingTrans(null);
            fetchData();
        } catch (error: any) {
            alert('Error al guardar movimiento: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingCat) {
                const { error } = await supabase.from('finance_categories').update(catForm).eq('id', editingCat.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('finance_categories').insert([catForm]);
                if (error) throw error;
            }
            setShowCatForm(false);
            setEditingCat(null);
            fetchData();
        } catch (error: any) {
            alert('Error al guardar categoría: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateInitialBalance = async () => {
        if (!activeAccount) return;
        const newBalance = prompt(`Ingresa el nuevo Capital Inicial para la cuenta ${activeAccount.name}:`, activeAccount.initial_balance.toString());
        if (newBalance === null) return;
        const parsed = Number(newBalance);
        if (isNaN(parsed)) {
            alert('El monto ingresado no es válido.');
            return;
        }
        
        try {
            const { error } = await supabase.from('finance_accounts').update({ initial_balance: parsed }).eq('id', activeAccount.id);
            if (error) throw error;
            fetchData();
        } catch (error: any) {
            alert('Error al actualizar el saldo inicial: ' + error.message);
        }
    };

    const openCreateTrans = (type: 'income' | 'expense') => {
        setEditingTrans(null);
        setTransForm({
            date: new Date().toISOString().split('T')[0],
            description: '',
            type,
            amount: '',
            category_id: '',
            invoice_number: '',
            rfc: '',
            is_invoiced: false,
        });
        setShowTransForm(true);
    };

    const openEditTrans = (t: FinanceTransaction) => {
        setEditingTrans(t);
        setTransForm({
            date: t.date,
            description: t.description,
            type: t.type,
            amount: t.amount.toString(),
            category_id: t.category_id || '',
            invoice_number: t.invoice_number || '',
            rfc: t.rfc || '',
            is_invoiced: t.is_invoiced,
        });
        setShowTransForm(true);
    };

    const openCreateCat = () => {
        setEditingCat(null);
        setCatForm({ name: '', color: 'bg-slate-100 text-slate-800', is_deductible: true });
        setShowCatForm(true);
    };

    const openEditCat = (c: FinanceCategory) => {
        setEditingCat(c);
        setCatForm({ name: c.name, color: c.color, is_deductible: c.is_deductible });
        setShowCatForm(true);
    };

    if (loading && accounts.length === 0) {
        return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div></div>;
    }

    const handleInitialize = async () => {
        setSaving(true);
        try {
            // First check if tables exist by doing a dummy select
            const { error: checkErr } = await supabase.from('finance_accounts').select('id').limit(1);
            if (checkErr) {
                alert('Las tablas no existen aún. Asegúrate de haber ejecutado el SQL en Supabase (SQL Editor).');
                return;
            }

            await supabase.from('finance_accounts').insert([
                { name: 'Pyme', type: 'bank', initial_balance: 136095.52 },
                { name: 'Crédito', type: 'credit', initial_balance: 0 },
                { name: 'Efectivo', type: 'cash', initial_balance: 0 }
            ]);
            await supabase.from('finance_categories').insert([
                { name: 'Nómina', color: 'bg-emerald-100 text-emerald-800', is_deductible: true },
                { name: 'Pago de Impuestos', color: 'bg-rose-100 text-rose-800', is_deductible: true },
                { name: 'IMSS', color: 'bg-sky-100 text-sky-800', is_deductible: true },
                { name: 'TDC', color: 'bg-purple-100 text-purple-800', is_deductible: false },
                { name: 'Facturas Crédito', color: 'bg-indigo-100 text-indigo-800', is_deductible: true },
                { name: 'Gastos Deducibles', color: 'bg-amber-100 text-amber-800', is_deductible: true },
                { name: 'Otros', color: 'bg-slate-100 text-slate-800', is_deductible: false }
            ]);
            await fetchData();
        } catch (err: any) {
            console.error('Error inicializando:', err);
            alert('Error inicializando datos: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (accounts.length === 0) {
        return (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                <span className="material-symbols-outlined mb-2 text-4xl text-slate-400">account_balance</span>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No hay cuentas configuradas</h3>
                <p className="text-sm text-slate-500 mb-4 text-center max-w-md">
                    Las tablas están creadas, pero faltan los datos iniciales (Cuentas y Categorías).
                </p>
                <button 
                    onClick={handleInitialize}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-primary-dark transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                    {saving ? 'Inicializando...' : 'Inicializar Cuentas por Defecto'}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & Tabs */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Balance General</h1>
                    <p className="text-sm text-slate-500">Gestión de ingresos, egresos y conciliación bancaria interna.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
                    {accounts.map(acc => (
                        <button
                            key={acc.id}
                            onClick={() => setActiveAccountId(acc.id)}
                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                                activeAccountId === acc.id
                                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">
                                {acc.type === 'bank' ? 'account_balance' : acc.type === 'credit' ? 'credit_card' : 'payments'}
                            </span>
                            {acc.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Dashboard Panel */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                {/* Left Column: Totals & Summary */}
                <div className="flex flex-col gap-6 xl:col-span-2">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Capital Inicial</p>
                                    <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{formatCurrencyFin(activeAccount?.initial_balance || 0)}</p>
                                </div>
                                <button onClick={handleUpdateInitialBalance} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700">
                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                </button>
                            </div>
                        </div>
                        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Ingresos</p>
                            <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrencyFin(summary.total_income)}</p>
                        </div>
                        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Egresos</p>
                            <p className="mt-1 text-xl font-bold text-rose-600 dark:text-rose-400">{formatCurrencyFin(summary.total_expense)}</p>
                        </div>
                        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-5 shadow-sm dark:bg-primary/10">
                            <p className="text-xs font-bold uppercase tracking-wider text-primary">Capital Actual</p>
                            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{formatCurrencyFin(currentBalance)}</p>
                            <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-primary to-primary-dark opacity-60" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Facturación Overview */}
                        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="mb-4 text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sky-500">receipt_long</span> Estatus de Facturación
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-500">Facturado</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrencyFin(summary.total_invoiced)}</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                        <div className="h-full bg-sky-500" style={{ width: `${Math.min(100, (summary.total_invoiced / (summary.total_invoiced + summary.total_not_invoiced || 1)) * 100)}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-500">No Facturado</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrencyFin(summary.total_not_invoiced)}</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                        <div className="h-full bg-slate-400" style={{ width: `${Math.min(100, (summary.total_not_invoiced / (summary.total_invoiced + summary.total_not_invoiced || 1)) * 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Deductibles Overview */}
                        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-center items-center text-center">
                            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                <span className="material-symbols-outlined text-[28px]">account_balance_wallet</span>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-500">Gastos Deducibles del Mes</h3>
                            <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{formatCurrencyFin(summary.total_deductible)}</p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Desglose de Categorías */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 flex flex-col h-full max-h-[400px]">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <span className="material-symbols-outlined text-purple-500">pie_chart</span> Desglose de Egresos
                        </h3>
                        <button onClick={() => setShowCatForm(true)} className="text-xs text-primary hover:underline flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">settings</span> Configurar
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {Object.entries(summary.expenses_by_category)
                            .sort(([, a], [, b]) => b - a)
                            .map(([catName, amount]) => {
                                const catObj = categories.find(c => c.name === catName);
                                return (
                                    <div key={catName} className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                <div className={`h-3 w-3 rounded-full ${catObj ? catObj.color.split(' ')[0] : 'bg-slate-400'}`} />
                                                {catName}
                                            </span>
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrencyFin(amount)}</span>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                            <div className={`h-full ${catObj ? catObj.color.split(' ')[0] : 'bg-slate-400'}`} style={{ width: `${Math.min(100, (amount / summary.total_expense) * 100)}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        {Object.keys(summary.expenses_by_category).length === 0 && (
                            <p className="text-center text-sm text-slate-500 mt-10">No hay egresos en este mes.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Filtros de Tabla */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mt-8">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Movimientos</h2>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">calendar_month</span>
                        <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[250px]">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input type="text" placeholder="Buscar concepto o factura..." value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    </div>
                    <button onClick={() => openCreateTrans('expense')} className="flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-600 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">remove</span> Egreso
                    </button>
                    <button onClick={() => openCreateTrans('income')} className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">add</span> Ingreso
                    </button>
                </div>
            </div>

            {/* Transacciones Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/50 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="px-6 py-4 font-semibold">Fecha</th>
                            <th className="px-6 py-4 font-semibold">Descripción</th>
                            <th className="px-6 py-4 font-semibold">Categoría</th>
                            <th className="px-6 py-4 font-semibold text-right">Ingreso</th>
                            <th className="px-6 py-4 font-semibold text-right">Egreso</th>
                            <th className="px-6 py-4 font-semibold">Factura / RFC</th>
                            <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {filteredTransactions.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                <td className="px-6 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                                    {new Date(t.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                </td>
                                <td className="px-6 py-3">
                                    <p className="font-medium text-slate-900 dark:text-white">{t.description}</p>
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap">
                                    {t.category ? (
                                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${t.category.color}`}>
                                            {t.category.name}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 text-xs italic">- Ninguna -</span>
                                    )}
                                </td>
                                <td className="px-6 py-3 text-right whitespace-nowrap">
                                    {t.type === 'income' ? (
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrencyFin(t.amount)}</span>
                                    ) : '-'}
                                </td>
                                <td className="px-6 py-3 text-right whitespace-nowrap">
                                    {t.type === 'expense' ? (
                                        <span className="font-bold text-rose-600 dark:text-rose-400">-{formatCurrencyFin(t.amount)}</span>
                                    ) : '-'}
                                </td>
                                <td className="px-6 py-3">
                                    <div className="flex flex-col gap-1 text-xs">
                                        <div className="flex items-center gap-1.5">
                                            {t.is_invoiced ? (
                                                <span className="material-symbols-outlined text-[14px] text-sky-500" title="Facturado">check_circle</span>
                                            ) : (
                                                <span className="material-symbols-outlined text-[14px] text-slate-300" title="No Facturado">cancel</span>
                                            )}
                                            {t.invoice_number ? <span className="font-semibold text-slate-700 dark:text-slate-300">#{t.invoice_number}</span> : <span className="text-slate-400 italic">S/F</span>}
                                        </div>
                                        {t.rfc && <span className="text-slate-500 uppercase tracking-wider">{t.rfc}</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-right whitespace-nowrap">
                                    <button onClick={() => openEditTrans(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-700">
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredTransactions.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                                    No se encontraron movimientos en este mes o con ese filtro.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal: Formulario Transacción */}
            {showTransForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
                        <div className={`flex items-center justify-between border-b px-6 py-4 ${transForm.type === 'income' ? 'border-emerald-100 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10' : 'border-rose-100 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-900/10'}`}>
                            <h3 className={`text-lg font-bold ${transForm.type === 'income' ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-800 dark:text-rose-400'}`}>
                                {editingTrans ? 'Editar Movimiento' : (transForm.type === 'income' ? 'Registrar Ingreso' : 'Registrar Egreso')}
                            </h3>
                            <button onClick={() => setShowTransForm(false)} className="rounded-full p-1 text-slate-400 hover:bg-black/5 hover:text-slate-600">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSaveTransaction} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Fecha</label>
                                    <input type="date" required value={transForm.date} onChange={e => setTransForm({...transForm, date: e.target.value})} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Monto</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-slate-400">$</span>
                                        <input type="number" step="0.01" min="0" required value={transForm.amount} onChange={e => setTransForm({...transForm, amount: e.target.value})} className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="0.00" />
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Concepto / Descripción</label>
                                <input type="text" required value={transForm.description} onChange={e => setTransForm({...transForm, description: e.target.value})} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="Ej. Pago a proveedor, Factura 123..." />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300 flex justify-between">
                                    Categoría
                                    <button type="button" onClick={() => { setShowTransForm(false); openCreateCat(); }} className="text-primary hover:underline text-xs">Crear nueva</button>
                                </label>
                                <select value={transForm.category_id} onChange={e => setTransForm({...transForm, category_id: e.target.value})} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                                    <option value="">-- Sin categoría --</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50 space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={transForm.is_invoiced} onChange={e => setTransForm({...transForm, is_invoiced: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Es un movimiento Facturado</span>
                                </label>
                                {transForm.is_invoiced && (
                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-slate-500">No. de Factura</label>
                                            <input type="text" value={transForm.invoice_number} onChange={e => setTransForm({...transForm, invoice_number: e.target.value})} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="Ej. A-1024" />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-slate-500">RFC</label>
                                            <input type="text" value={transForm.rfc} onChange={e => setTransForm({...transForm, rfc: e.target.value.toUpperCase()})} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm uppercase outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="RFC" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setShowTransForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Cancelar</button>
                                <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-primary-dark disabled:opacity-50">
                                    {saving ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : <span className="material-symbols-outlined text-[18px]">save</span>}
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Administrador de Categorías */}
            {showCatForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Categorías de Balance</h3>
                            <button onClick={() => setShowCatForm(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        
                        <div className="flex flex-1 overflow-hidden">
                            {/* Editor lateral */}
                            <div className="w-1/2 border-r border-slate-100 p-6 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">{editingCat ? 'Editar Categoría' : 'Nueva Categoría'}</h4>
                                <form onSubmit={handleSaveCategory} className="space-y-4">
                                    <div>
                                        <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre</label>
                                        <input type="text" required value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="Ej. Materiales, Gasolina..." />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Color (Etiqueta)</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {COLOR_OPTIONS.map(c => (
                                                <button key={c.value} type="button" onClick={() => setCatForm({...catForm, color: c.value})} className={`h-8 w-full rounded-lg ${c.value} ${catForm.color === c.value ? 'ring-2 ring-primary ring-offset-1 dark:ring-offset-slate-800' : ''}`} title={c.label} />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-2 cursor-pointer mt-4">
                                            <input type="checkbox" checked={catForm.is_deductible} onChange={e => setCatForm({...catForm, is_deductible: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Gasto Deducible</span>
                                        </label>
                                        <p className="text-xs text-slate-500 mt-1 pl-6">Los gastos en esta categoría sumarán al total deducible del mes.</p>
                                    </div>
                                    
                                    <div className="flex justify-end gap-2 pt-4">
                                        {editingCat && (
                                            <button type="button" onClick={openCreateCat} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">Nuevo</button>
                                        )}
                                        <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
                                            {saving ? 'Guardando...' : 'Guardar'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Lista de categorías */}
                            <div className="w-1/2 p-4 overflow-y-auto custom-scrollbar">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 px-2">Categorías Existentes</h4>
                                <div className="space-y-1.5">
                                    {categories.map(c => (
                                        <div key={c.id} className={`flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer ${editingCat?.id === c.id ? 'ring-1 ring-primary/50 bg-primary/5' : ''}`} onClick={() => openEditCat(c)}>
                                            <div className="flex items-center gap-3">
                                                <div className={`h-3 w-3 rounded-full ${c.color.split(' ')[0]}`} />
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.name}</span>
                                            </div>
                                            {c.is_deductible && <span className="material-symbols-outlined text-[14px] text-emerald-500" title="Deducible">receipt_long</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
