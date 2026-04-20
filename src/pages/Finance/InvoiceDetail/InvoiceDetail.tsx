import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import {
    Invoice, Payment, ProjectExpense, InvoiceStatus,
    PaymentMethod, ExpenseCategory,
    INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS,
    INVOICE_TYPE_LABELS, PAYMENT_METHOD_LABELS,
    EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_ICONS,
    formatCurrencyFin,
} from '../../../types/finance';
import { triggerWaAutomation } from '../../../lib/waAutomation';

export default function InvoiceDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPayment, setShowPayment] = useState(false);
    const [showExpense, setShowExpense] = useState(false);

    const [payForm, setPayForm] = useState({ amount: '', payment_method: 'transfer' as PaymentMethod, reference: '', notes: '', received_by: '' });
    const [expForm, setExpForm] = useState({ category: 'materials' as ExpenseCategory, description: '', amount: '', supplier: '', receipt_number: '', recorded_by: '' });

    const fetchAll = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        const [invRes, payRes] = await Promise.all([
            supabase.from('invoices').select('*, client:clients(id, company_name), project:projects(id, project_number, title)').eq('id', id).single(),
            supabase.from('payments').select('*').eq('invoice_id', id).order('payment_date', { ascending: false }),
        ]);
        if (!invRes.data) { navigate('/finance/invoices'); return; }
        const inv = invRes.data as Invoice;
        setInvoice(inv);
        setPayments((payRes.data as Payment[]) || []);
        // Fetch expenses if linked to project
        if (inv.project_id) {
            const { data } = await supabase.from('project_expenses').select('*').eq('project_id', inv.project_id).order('expense_date', { ascending: false });
            setExpenses((data as ProjectExpense[]) || []);
        }
        setLoading(false);
    }, [id, navigate]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invoice) return;
        const amount = parseFloat(payForm.amount) || 0;
        await supabase.from('payments').insert({
            invoice_id: id, amount, payment_method: payForm.payment_method,
            reference: payForm.reference || null, notes: payForm.notes || null, received_by: payForm.received_by || null,
        });
        const newPaid = invoice.amount_paid + amount;
        const newBalance = invoice.total - newPaid;
        const newStatus: InvoiceStatus = newBalance <= 0 ? 'paid' : 'partial';
        await supabase.from('invoices').update({ amount_paid: newPaid, balance: Math.max(0, newBalance), status: newStatus }).eq('id', id);

        // ─── START AUTOMATION: WhatsApp Notificación de Pago ───
        triggerWaAutomation({
            module: 'invoices',
            event: 'payment_received',
            record: {
                invoice_number: invoice.invoice_number,
                client_name: invoice.client?.company_name || 'Cliente',
                amount: formatCurrencyFin(invoice.total),
                payment_amount: formatCurrencyFin(amount),
                due_date: new Date(invoice.due_date).toLocaleDateString('es-MX'),
            },
            referenceId: invoice.id,
        });
        // ─── END AUTOMATION ───

        // If fully paid, trigger "Pagado / Liberado" automation
        if (newStatus === 'paid') {
            const clientName = invoice.client?.company_name || 'Cliente';

            // Sync cost to project
            if (invoice.project_id) {
                const totalExp = expenses.reduce((s, exp) => s + exp.amount, 0);
                await supabase.from('projects').update({ actual_cost: totalExp }).eq('id', invoice.project_id);
            }

            // 6.2 Validación de Cobro — Samara
            await supabase.from('team_tasks').insert({
                title: `Validación de Cobro — ${invoice.invoice_number}`,
                description: `Factura: ${invoice.invoice_number}\nCliente: ${clientName}\nMonto Total: ${formatCurrencyFin(invoice.total)}\n\nActividades:\n• Confirmar pago (anticipo o total según condiciones)\n• Registrar pago en CRM\n\nEl proyecto queda LIBERADO para avanzar a operación.`,
                assigned_to: 'Samara',
                created_by: 'Sistema',
                status: 'pending',
                priority: 'high',
                due_date: new Date().toISOString().split('T')[0],
                project_id: invoice.project_id || null,
                checklist: JSON.stringify([
                    { text: 'Confirmar pago (anticipo o total según condiciones)', done: false },
                    { text: 'Registrar pago en CRM', done: false },
                ]),
                tags: ['auto', 'cobro', 'pagado-liberado'],
            });

            // Notificar en spaces
            const { data: spaces } = await supabase.from('spaces')
                .select('id, name').in('name', ['Operaciones', 'Administración']);
            if (spaces) {
                const msg = `💰 **PAGO CONFIRMADO — PROYECTO LIBERADO**\n\n📄 Factura: **${invoice.invoice_number}**\n👤 Cliente: **${clientName}**\n💲 Total: **${formatCurrencyFin(invoice.total)}**\n\nEl proyecto está financieramente liberado para avanzar a la fase operativa.\n\n_Tarea de Validación de Cobro asignada a @Samara._`;
                for (const space of spaces) {
                    await supabase.from('messages').insert({
                        space_id: space.id,
                        sender: 'Sistema',
                        content: msg,
                        message_type: 'system'
                    });
                }
            }

            // Push notifications internas
            await supabase.from('app_notifications').insert([
                {
                    user_name: 'Samara',
                    title: '💰 Validación de Cobro',
                    message: `Factura ${invoice.invoice_number} de ${clientName} pagada (${formatCurrencyFin(invoice.total)}). Confirma y registra en CRM.`,
                    type: 'payment',
                    icon: 'payments',
                    link: `/finance/invoices/${id}`,
                    source: 'finance',
                },
                {
                    user_name: 'Joel',
                    title: '✅ Proyecto Liberado',
                    message: `Factura ${invoice.invoice_number} de ${clientName} cobrada. El proyecto puede avanzar a ejecución.`,
                    type: 'payment',
                    icon: 'check_circle',
                    link: '/tasks',
                    source: 'finance',
                },
                {
                    user_name: 'Director',
                    title: '💰 Pago Confirmado',
                    message: `Factura ${invoice.invoice_number} — ${clientName} — ${formatCurrencyFin(invoice.total)} cobrado.`,
                    type: 'payment',
                    icon: 'payments',
                    link: `/finance/invoices/${id}`,
                    source: 'finance',
                },
            ]);
        }

        setShowPayment(false);
        setPayForm({ amount: '', payment_method: 'transfer', reference: '', notes: '', received_by: '' });
        fetchAll();
    };

    const handleExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invoice?.project_id) return;
        await supabase.from('project_expenses').insert({
            project_id: invoice.project_id, category: expForm.category, description: expForm.description,
            amount: parseFloat(expForm.amount) || 0, supplier: expForm.supplier || null,
            receipt_number: expForm.receipt_number || null, recorded_by: expForm.recorded_by || null,
        });
        setShowExpense(false);
        setExpForm({ category: 'materials', description: '', amount: '', supplier: '', receipt_number: '', recorded_by: '' });
        fetchAll();
    };

    const handleStatusChange = async (status: InvoiceStatus) => {
        if (!invoice) return;
        const updates: Record<string, unknown> = { status };
        if (status === 'cancelled') updates.cancelled_at = new Date().toISOString();

        // → M6→M3: Sync actual cost to project when invoice is fully paid
        if (status === 'paid' && invoice.project_id) {
            const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
            await supabase.from('projects').update({
                actual_cost: totalExp
            }).eq('id', invoice.project_id);
        }

        await supabase.from('invoices').update(updates).eq('id', id);

        // → TRIGGER: Cambio de estatus a "Pagado / Liberado"
        if (status === 'paid') {
            const clientName = invoice.client?.company_name || 'Cliente';

            // 6.2 Validación de Cobro — Samara
            await supabase.from('team_tasks').insert({
                title: `Validación de Cobro — ${invoice.invoice_number}`,
                description: `Factura: ${invoice.invoice_number}\nCliente: ${clientName}\nMonto Total: ${formatCurrencyFin(invoice.total)}\n\nActividades:\n• Confirmar pago (anticipo o total según condiciones)\n• Registrar pago en CRM\n\nEl proyecto queda LIBERADO para avanzar a operación.`,
                assigned_to: 'Samara',
                created_by: 'Sistema',
                status: 'pending',
                priority: 'high',
                due_date: new Date().toISOString().split('T')[0],
                project_id: invoice.project_id || null,
                checklist: JSON.stringify([
                    { text: 'Confirmar pago (anticipo o total según condiciones)', done: false },
                    { text: 'Registrar pago en CRM', done: false },
                ]),
                tags: ['auto', 'cobro', 'pagado-liberado'],
            });

            // Notificar en spaces de Operaciones y Administración
            const { data: spaces } = await supabase.from('spaces')
                .select('id, name').in('name', ['Operaciones', 'Administración']);
            if (spaces) {
                const msg = `💰 **PAGO CONFIRMADO — PROYECTO LIBERADO**\n\n📄 Factura: **${invoice.invoice_number}**\n👤 Cliente: **${clientName}**\n💲 Total: **${formatCurrencyFin(invoice.total)}**\n\nEl proyecto está financieramente liberado para avanzar a la fase operativa.\n\n_Tarea de Validación de Cobro asignada a @Samara._`;
                for (const space of spaces) {
                    await supabase.from('messages').insert({
                        space_id: space.id,
                        sender: 'Sistema',
                        content: msg,
                        message_type: 'system'
                    });
                }
            }

            // Push notifications internas
            await supabase.from('app_notifications').insert([
                {
                    user_name: 'Samara',
                    title: '💰 Validación de Cobro',
                    message: `Factura ${invoice.invoice_number} de ${clientName} marcada como pagada (${formatCurrencyFin(invoice.total)}).`,
                    type: 'payment',
                    icon: 'payments',
                    link: `/finance/invoices/${id}`,
                    source: 'finance',
                },
                {
                    user_name: 'Joel',
                    title: '✅ Proyecto Liberado',
                    message: `Factura ${invoice.invoice_number} de ${clientName} cobrada. El proyecto puede avanzar a ejecución.`,
                    type: 'payment',
                    icon: 'check_circle',
                    link: '/tasks',
                    source: 'finance',
                },
                {
                    user_name: 'Director',
                    title: '💰 Pago Confirmado',
                    message: `Factura ${invoice.invoice_number} — ${clientName} — ${formatCurrencyFin(invoice.total)} cobrado.`,
                    type: 'payment',
                    icon: 'payments',
                    link: `/finance/invoices/${id}`,
                    source: 'finance',
                },
            ]);
        }

        // → M6→M8: Notify Samara when invoice is sent and due date is approaching/overdue
        if (status === 'sent' && invoice.balance > 0) {
            const today = new Date();
            const dueDate = new Date(invoice.due_date);
            const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (daysUntilDue <= 5) {
                const { data: spaces } = await supabase.from('spaces')
                    .select('id').ilike('name', '%admin%').limit(1);
                if (spaces && spaces.length > 0) {
                    await supabase.from('messages').insert({
                        space_id: spaces[0].id,
                        sender: 'Sistema',
                        content: `💰 **ALERTA COBRANZA**: La factura **${invoice.invoice_number}** de **${invoice.client?.company_name || 'N/A'}** ${daysUntilDue < 0 ? `está **vencida** hace ${Math.abs(daysUntilDue)} días` : daysUntilDue === 0 ? '**vence hoy**' : `vence en **${daysUntilDue} días**`}.\n\n📋 Monto: **${formatCurrencyFin(invoice.total)}** | Saldo: **${formatCurrencyFin(invoice.balance)}**\n\n👤 @Samara — Se requiere seguimiento de cobranza inmediato.`,
                        message_type: 'system'
                    });

                    // → M6→M8: Assign task directly to Samara on the board
                    await supabase.from('team_tasks').insert({
                        title: `Gestionar cobro factura ${invoice.invoice_number}`,
                        description: `Cobranza de ${invoice.client?.company_name || 'Cliente'} (Saldo: ${formatCurrencyFin(invoice.balance)}). Generada por alerta automática.`,
                        assigned_to: 'Samara',
                        created_by: 'Sistema',
                        priority: daysUntilDue < 0 ? 'urgent' : 'high',
                        due_date: new Date(invoice.due_date).toISOString().split('T')[0],
                        project_id: invoice.project_id || null,
                        status: 'pending'
                    });
                }
            }
        }

        fetchAll();
    };

    const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
    const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';
    const sectionClass = 'rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50';

    if (loading || !invoice) return <div className="flex flex-1 items-center justify-center p-8"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

    const totalExpenseCost = expenses.reduce((s, e) => s + e.amount, 0);
    const margin = invoice.subtotal > 0 ? ((invoice.subtotal - totalExpenseCost) / invoice.subtotal) * 100 : 0;

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/finance/invoices')} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold font-mono text-slate-900 dark:text-white">{invoice.invoice_number}</h2>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${(INVOICE_STATUS_COLORS[invoice.status] || { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500' }).bg} ${(INVOICE_STATUS_COLORS[invoice.status] || { bg: '', text: 'text-slate-500' }).text}`}>{INVOICE_STATUS_LABELS[invoice.status] || invoice.status}</span>
                        </div>
                        <p className="text-sm text-slate-500">{INVOICE_TYPE_LABELS[invoice.invoice_type]} · {invoice.client?.company_name || '—'}{invoice.project ? ` · ${invoice.project.project_number}` : ''}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {invoice.status === 'draft' && <button onClick={() => handleStatusChange('sent')} className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white">Enviar</button>}
                    {invoice.balance > 0 && invoice.status !== 'cancelled' && <button onClick={() => setShowPayment(true)} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white"><span className="material-symbols-outlined text-[16px]">payments</span>Registrar Pago</button>}
                    {invoice.status !== 'cancelled' && invoice.status !== 'paid' && <button onClick={() => handleStatusChange('cancelled')} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-500">Cancelar</button>}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Main info */}
                <div className="flex flex-col gap-6 lg:col-span-2">
                    {/* Financial summary */}
                    <div className={sectionClass}>
                        <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Resumen Financiero</h3>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div><span className="text-xs text-slate-400 block">Subtotal</span><span className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrencyFin(invoice.subtotal)}</span></div>
                            <div><span className="text-xs text-slate-400 block">IVA ({invoice.tax_rate}%)</span><span className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrencyFin(invoice.tax_amount)}</span></div>
                            <div><span className="text-xs text-slate-400 block">Total</span><span className="text-xl font-bold text-primary">{formatCurrencyFin(invoice.total)}</span></div>
                            <div><span className="text-xs text-slate-400 block">Saldo</span><span className={`text-xl font-bold ${invoice.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{formatCurrencyFin(invoice.balance)}</span></div>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-4">
                            <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Cobrado</span><span className="font-bold text-emerald-600">{invoice.total > 0 ? ((invoice.amount_paid / invoice.total) * 100).toFixed(0) : 0}%</span></div>
                            <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${invoice.total > 0 ? (invoice.amount_paid / invoice.total) * 100 : 0}%` }} />
                            </div>
                        </div>
                    </div>

                    {/* Payment form */}
                    {showPayment && (
                        <form onSubmit={handlePayment} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 dark:border-emerald-900 dark:bg-emerald-900/10">
                            <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Registrar Pago <span className="text-xs text-slate-400 font-normal">(Saldo: {formatCurrencyFin(invoice.balance)})</span></h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div><label className={labelClass}>Monto *</label><input type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} required className={inputClass} placeholder={invoice.balance.toString()} /></div>
                                <div><label className={labelClass}>Método</label><select value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value as PaymentMethod })} className={inputClass}>{(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}</select></div>
                                <div><label className={labelClass}>Referencia</label><input value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} placeholder="No. transferencia, cheque..." className={inputClass} /></div>
                                <div><label className={labelClass}>Recibido Por</label><input value={payForm.received_by} onChange={e => setPayForm({ ...payForm, received_by: e.target.value })} className={inputClass} /></div>
                                <div className="md:col-span-2"><label className={labelClass}>Notas</label><input value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} className={inputClass} /></div>
                            </div>
                            <div className="mt-4 flex gap-2"><button type="submit" className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white">Registrar Pago</button><button type="button" onClick={() => setShowPayment(false)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-500">Cancelar</button></div>
                        </form>
                    )}

                    {/* Payments history */}
                    <div className={sectionClass}>
                        <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Historial de Pagos ({payments.length})</h3>
                        {payments.length === 0 ? (
                            <div className="py-4 text-center text-sm text-slate-500">Sin pagos registrados.</div>
                        ) : (
                            <div className="space-y-2">
                                {payments.map(p => (
                                    <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-200/60 p-3 dark:border-slate-700/60">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                                            <span className="material-symbols-outlined text-emerald-600 text-[16px]">payments</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm text-slate-900 dark:text-white">{formatCurrencyFin(p.amount)}</p>
                                            <p className="text-xs text-slate-400">{PAYMENT_METHOD_LABELS[p.payment_method]}{p.reference ? ` · Ref: ${p.reference}` : ''}{p.received_by ? ` · ${p.received_by}` : ''}</p>
                                        </div>
                                        <span className="text-xs text-slate-400">{new Date(p.payment_date).toLocaleDateString('es-MX')}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Project expenses */}
                    {invoice.project_id && (
                        <div className={sectionClass}>
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Costos del Proyecto ({expenses.length})</h3>
                                <button onClick={() => setShowExpense(!showExpense)} className="flex items-center gap-1 rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white">
                                    <span className="material-symbols-outlined text-[16px]">add</span>Agregar Gasto
                                </button>
                            </div>
                            {showExpense && (
                                <form onSubmit={handleExpense} className="mb-4 rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-900/10">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                        <div><label className={labelClass}>Categoría</label><select value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value as ExpenseCategory })} className={inputClass}>{(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map(c => <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>)}</select></div>
                                        <div><label className={labelClass}>Descripción *</label><input value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} required className={inputClass} placeholder="Tubería PVC 4in" /></div>
                                        <div><label className={labelClass}>Monto *</label><input type="number" step="0.01" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} required className={inputClass} /></div>
                                        <div><label className={labelClass}>Proveedor</label><input value={expForm.supplier} onChange={e => setExpForm({ ...expForm, supplier: e.target.value })} className={inputClass} /></div>
                                        <div><label className={labelClass}>No. Recibo</label><input value={expForm.receipt_number} onChange={e => setExpForm({ ...expForm, receipt_number: e.target.value })} className={inputClass} /></div>
                                        <div><label className={labelClass}>Registrado Por</label><input value={expForm.recorded_by} onChange={e => setExpForm({ ...expForm, recorded_by: e.target.value })} className={inputClass} /></div>
                                    </div>
                                    <div className="mt-3 flex gap-2"><button type="submit" className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white">Guardar</button><button type="button" onClick={() => setShowExpense(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500">Cancelar</button></div>
                                </form>
                            )}
                            {expenses.length === 0 ? (
                                <div className="py-4 text-center text-sm text-slate-500">Sin gastos registrados.</div>
                            ) : (
                                <div className="space-y-2">
                                    {expenses.map(exp => (
                                        <div key={exp.id} className="flex items-center gap-3 rounded-lg border border-slate-200/60 p-3 dark:border-slate-700/60">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/20">
                                                <span className="material-symbols-outlined text-red-500 text-[16px]">{EXPENSE_CATEGORY_ICONS[exp.category]}</span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-sm text-slate-900 dark:text-white">{exp.description}</p>
                                                <p className="text-xs text-slate-400">{EXPENSE_CATEGORY_LABELS[exp.category]}{exp.supplier ? ` · ${exp.supplier}` : ''}</p>
                                            </div>
                                            <span className="font-bold text-sm text-red-500">{formatCurrencyFin(exp.amount)}</span>
                                            <span className="text-xs text-slate-400">{new Date(exp.expense_date).toLocaleDateString('es-MX')}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="flex flex-col gap-6">
                    <div className={sectionClass}>
                        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Detalles</h3>
                        <div className="space-y-3 text-sm">
                            <div><span className="text-xs text-slate-400 block">Emisión</span><span className="font-medium text-slate-900 dark:text-white">{new Date(invoice.issue_date).toLocaleDateString('es-MX')}</span></div>
                            <div><span className="text-xs text-slate-400 block">Vencimiento</span><span className="font-medium text-slate-900 dark:text-white">{new Date(invoice.due_date).toLocaleDateString('es-MX')}</span></div>
                            {invoice.payment_terms && <div><span className="text-xs text-slate-400 block">Condiciones</span><span className="font-medium text-slate-900 dark:text-white">{invoice.payment_terms}</span></div>}
                        </div>
                    </div>

                    {/* Fiscal info */}
                    <div className={sectionClass}>
                        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Datos Fiscales</h3>
                        <div className="space-y-3 text-sm">
                            <div><span className="text-xs text-slate-400 block">RFC</span><span className="font-mono font-medium text-slate-900 dark:text-white">{invoice.client_rfc || '—'}</span></div>
                            <div><span className="text-xs text-slate-400 block">Razón Social</span><span className="font-medium text-slate-900 dark:text-white">{invoice.client_fiscal_name || '—'}</span></div>
                        </div>
                    </div>

                    {/* Profitability */}
                    {invoice.project_id && (
                        <div className={sectionClass}>
                            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Rentabilidad</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-slate-500">Facturado</span><span className="font-bold text-slate-900 dark:text-white">{formatCurrencyFin(invoice.subtotal)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Costos</span><span className="font-bold text-red-500">{formatCurrencyFin(totalExpenseCost)}</span></div>
                                <hr className="border-slate-200 dark:border-slate-700" />
                                <div className="flex justify-between"><span className="text-slate-500">Utilidad</span><span className={`font-bold ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrencyFin(invoice.subtotal - totalExpenseCost)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Margen</span><span className={`font-bold text-lg ${margin >= 30 ? 'text-emerald-600' : margin >= 15 ? 'text-amber-500' : 'text-red-500'}`}>{margin.toFixed(1)}%</span></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
