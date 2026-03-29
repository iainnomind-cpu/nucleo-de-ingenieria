import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    Quote,
    QuoteItem,
    QuoteStatus,
    QUOTE_STATUS_LABELS,
    QUOTE_STATUS_COLORS,
    RISK_LABELS,
    formatCurrency,
} from '../../types/quotes';

export default function QuoteDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [quote, setQuote] = useState<Quote | null>(null);
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [versions, setVersions] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchQuote = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('quotes')
            .select('*, client:clients(id, company_name, contact_name)')
            .eq('id', id)
            .single();

        if (error || !data) { navigate('/quotes'); return; }
        setQuote(data as Quote);

        // Fetch items
        const { data: itemsData } = await supabase.from('quote_items').select('*').eq('quote_id', id).order('sort_order');
        setItems(itemsData || []);

        // Fetch versions (quotes with same parent or this as parent)
        if (data.parent_quote_id) {
            const { data: vers } = await supabase.from('quotes').select('id, quote_number, version, status, total, created_at')
                .or(`id.eq.${data.parent_quote_id},parent_quote_id.eq.${data.parent_quote_id}`)
                .order('version');
            setVersions((vers as Quote[]) || []);
        } else {
            const { data: vers } = await supabase.from('quotes').select('id, quote_number, version, status, total, created_at')
                .eq('parent_quote_id', id)
                .order('version');
            setVersions((vers as Quote[]) || []);
        }

        setLoading(false);
    }, [id, navigate]);

    useEffect(() => { fetchQuote(); }, [fetchQuote]);

    const handleStatusChange = async (newStatus: QuoteStatus) => {
        if (!quote) return;
        const updates: Record<string, unknown> = { status: newStatus };
        if (newStatus === 'approved') {
            updates.approved_at = new Date().toISOString();
            updates.approved_by = 'Admin';
        }
        await supabase.from('quotes').update(updates).eq('id', quote.id);

        // → Pipeline Sync: Mapear status de cotización a etapa del pipeline
        const statusToPipelineStage: Record<string, string> = {
            sent: 'quoting',
            negotiation: 'negotiation',
            approved: 'closed_won',
            rejected: 'closed_lost',
        };
        const pipelineStage = statusToPipelineStage[newStatus];
        const probabilityMap: Record<string, number> = {
            sent: 40, negotiation: 60, approved: 100, rejected: 0,
        };

        if (pipelineStage && quote.client_id) {
            // Try to find linked opportunity (by opportunity_id or by client)
            let oppId = quote.opportunity_id;
            if (!oppId) {
                const { data: existingOpp } = await supabase.from('sales_opportunities')
                    .select('id').eq('client_id', quote.client_id)
                    .not('stage', 'in', '("closed_won","closed_lost")')
                    .order('created_at', { ascending: false }).limit(1).maybeSingle();
                oppId = existingOpp?.id || null;
            }

            if (oppId) {
                await supabase.from('sales_opportunities').update({
                    stage: pipelineStage,
                    probability: probabilityMap[newStatus] ?? 50,
                    estimated_value: quote.total,
                }).eq('id', oppId);
                // Link if not already linked
                if (!quote.opportunity_id) {
                    await supabase.from('quotes').update({ opportunity_id: oppId }).eq('id', quote.id);
                }
            } else {
                // Create new opportunity
                const { data: newOpp } = await supabase.from('sales_opportunities').insert({
                    client_id: quote.client_id,
                    title: quote.title,
                    estimated_value: quote.total,
                    probability: probabilityMap[newStatus] ?? 50,
                    stage: pipelineStage,
                }).select().single();
                if (newOpp) {
                    await supabase.from('quotes').update({ opportunity_id: newOpp.id }).eq('id', quote.id);
                }
            }
        }

        if (newStatus === 'approved') {
            // → M8: Notify Sales Team Space
            const { data: spaces } = await supabase.from('spaces')
                .select('id').ilike('name', '%venta%').limit(1);
            if (spaces && spaces.length > 0) {
                await supabase.from('messages').insert({
                    space_id: spaces[0].id,
                    sender_id: '12345678-1234-1234-1234-123456789012', // System or Admin
                    content: `✅ ¡La cotización **${quote.quote_number}** para **${quote.client?.company_name || 'Cliente'}** ha sido **APROBADA** por ${formatCurrency(quote.total)}!`,
                    message_type: 'text'
                });
            }
            // → M6: Create Draft Invoice
            const { data: invoice } = await supabase.from('invoices').insert({
                client_id: quote.client_id,
                project_id: null, // Not yet a project
                invoice_number: `F-${quote.quote_number.replace('COT-', '')}`,
                issue_date: new Date().toISOString().split('T')[0],
                due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                subtotal: quote.subtotal + quote.margin_amount - quote.discount_amount,
                tax_amount: quote.tax_amount,
                total: quote.total,
                amount_paid: 0,
                balance: quote.total,
                status: 'draft',
                currency: 'MXN',
                notes: `Factura generada automáticamente desde cotización ${quote.quote_number}`
            }).select().single();
            if (invoice) {
                alert(`Generada factura en borrador: ${invoice.invoice_number} (Módulo M6)`);
            }
        }

        fetchQuote();
    };

    const handleNewVersion = async () => {
        if (!quote) return;
        const parentId = quote.parent_quote_id || quote.id;
        // Count existing versions
        const { count } = await supabase.from('quotes').select('*', { count: 'exact', head: true })
            .or(`id.eq.${parentId},parent_quote_id.eq.${parentId}`);
        const newVersion = (count || 1) + 1;
        const year = new Date().getFullYear();
        const { count: totalCount } = await supabase.from('quotes').select('*', { count: 'exact', head: true });
        const quoteNumber = `COT-${year}-${String((totalCount || 0) + 1).padStart(4, '0')}`;

        const { data: newQ, error } = await supabase.from('quotes').insert({
            ...Object.fromEntries(Object.entries(quote).filter(([k]) =>
                !['id', 'created_at', 'updated_at', 'client', 'items', 'versions', 'quote_number', 'version', 'parent_quote_id', 'status', 'approved_by', 'approved_at'].includes(k)
            )),
            quote_number: quoteNumber,
            version: newVersion,
            parent_quote_id: parentId,
            status: 'draft',
        }).select().single();

        if (error || !newQ) { alert('Error: ' + (error?.message || '')); return; }

        // Copy items
        if (items.length > 0) {
            await supabase.from('quote_items').insert(
                items.map(item => ({
                    quote_id: newQ.id,
                    service_id: item.service_id,
                    description: item.description,
                    quantity: item.quantity,
                    unit: item.unit,
                    unit_price: item.unit_price,
                    subtotal: item.subtotal,
                    sort_order: item.sort_order,
                }))
            );
        }

        navigate(`/quotes/${newQ.id}`);
    };

    const handleConvertToProject = async () => {
        if (!quote) return;

        // Generate Project Number
        const year = new Date().getFullYear();
        const { count: totalProj } = await supabase.from('projects').select('*', { count: 'exact', head: true });
        const projectNumber = `PRY-${year}-${String((totalProj || 0) + 1).padStart(4, '0')}`;

        // → M3: Auto-create Project
        const { data: project, error: projErr } = await supabase.from('projects').insert({
            project_number: projectNumber,
            client_id: quote.client_id,
            quote_id: quote.id,
            title: `Proyecto: ${quote.title}`,
            description: quote.description || `Proyecto derivado de la cotización ${quote.quote_number}`,
            status: 'planning',
            priority: 'normal',
            start_date: new Date().toISOString().split('T')[0],
            estimated_days: quote.estimated_days || 30,
            quoted_amount: quote.total,
            project_manager: 'Admin',
        }).select().single();

        if (projErr) {
            console.error('Error creating project:', projErr);
            alert('Error al crear el proyecto: ' + projErr.message);
            return;
        }

        // update quote status to converted and link to project
        await supabase.from('quotes').update({ status: 'converted', converted_project_id: project?.id }).eq('id', quote.id);

        // Also link to opportunity if exists
        if (quote.opportunity_id) {
            await supabase.from('sales_opportunities').update({ stage: 'closed_won' }).eq('id', quote.opportunity_id);
        }

        // → M8: Auto-create Space for the Project
        if (project && quote.client) {
            await supabase.from('spaces').insert({
                name: `${quote.client.company_name} - ${quote.title.substring(0, 20)}`,
                description: `Espacio de coordinación para el proyecto ${projectNumber} (${quote.client.company_name})`,
                space_type: 'project',
                icon: 'engineering',
                project_id: project.id,
                created_by: 'Sistema' // Or current user UUID
            });

            // → M8: Checklist pre-trabajo como tareas asignadas con fecha límite
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 3); // Due in 3 days
            const formattedDueDate = dueDate.toISOString().split('T')[0];

            const tasksToInsert = [
                {
                    title: `Checklist M3: Administrativo/Facturación para ${projectNumber}`,
                    description: 'Validar anticipos, contratos y trámites administrativos antes de iniciar obra.',
                    assigned_to: 'Admin',
                    due_date: formattedDueDate,
                    project_id: project.id,
                    priority: 'high',
                },
                {
                    title: `Checklist M4: Materiales y Almacén para ${projectNumber}`,
                    description: 'Preparar y apartar materiales en inventario (M4).',
                    assigned_to: 'Admin',
                    due_date: formattedDueDate,
                    project_id: project.id,
                    priority: 'high',
                },
                {
                    title: `Checklist M5: Vehículos y Herramienta para ${projectNumber}`,
                    description: 'Revisar estado de vehículos y herramienta pesada requerida.',
                    assigned_to: 'Admin',
                    due_date: formattedDueDate,
                    project_id: project.id,
                    priority: 'high',
                },
                {
                    title: `Checklist M8: Cuadrilla para ${projectNumber}`,
                    description: 'Asignar personal, hospedaje, y viáticos en campo.',
                    assigned_to: 'Admin',
                    due_date: formattedDueDate,
                    project_id: project.id,
                    priority: 'high',
                }
            ];
            await supabase.from('team_tasks').insert(tasksToInsert);
        }

        alert('¡Cotización convertida a proyecto exitosamente! (M3 y M8 actualizados con tareas generadas)');
        navigate('/projects');
    };

    const handleGeneratePDF = async () => {
        if (!quote) return;
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            // Header
            doc.setFillColor(19, 182, 236); // primary color
            doc.rect(0, 0, pageWidth, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('COTIZACIÓN', 14, 20);
            doc.setFontSize(12);
            doc.text(quote.quote_number, 14, 30);
            doc.setFontSize(10);
            doc.text(`v${quote.version}`, pageWidth - 14, 20, { align: 'right' });
            doc.text(new Date(quote.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth - 14, 30, { align: 'right' });

            // Company info
            doc.setTextColor(50, 50, 50);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Núcleo de Ingeniería', 14, 55);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);

            // Client info
            let y = 70;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(50, 50, 50);
            doc.text('Cliente:', 14, y);
            doc.setFont('helvetica', 'normal');
            doc.text(quote.client?.company_name || 'N/A', 50, y);
            y += 7;
            doc.text('Contacto:', 14, y);
            doc.text(quote.client?.contact_name || 'N/A', 50, y);
            y += 10;
            doc.text('Título:', 14, y);
            doc.setFont('helvetica', 'bold');
            doc.text(quote.title, 50, y);
            y += 7;
            doc.setFont('helvetica', 'normal');
            if (quote.work_type) { doc.text('Tipo:', 14, y); doc.text(quote.work_type, 50, y); y += 7; }
            if (quote.description) { doc.text('Desc:', 14, y); doc.text(quote.description.substring(0, 80), 50, y); y += 7; }

            // Technical vars
            y += 5;
            doc.setFillColor(240, 240, 240);
            doc.rect(14, y - 5, pageWidth - 28, 20, 'F');
            doc.setFontSize(9);
            const techVars = [
                quote.well_depth ? `Profundidad: ${quote.well_depth}m` : '',
                quote.motor_hp ? `HP: ${quote.motor_hp}` : '',
                quote.distance_km ? `Distancia: ${quote.distance_km}km` : '',
                `Personal: ${quote.crew_size}`,
                `Riesgo: ${RISK_LABELS[quote.risk_level]}`,
                `Días: ${quote.estimated_days}`,
            ].filter(Boolean);
            doc.text(techVars.join('  |  '), 18, y + 3);
            y += 25;

            // Items table
            autoTable(doc, {
                startY: y,
                head: [['#', 'Concepto', 'Cant.', 'Unidad', 'P. Unitario', 'Subtotal']],
                body: items.map((item, idx) => [
                    idx + 1,
                    item.description,
                    item.quantity.toString(),
                    item.unit,
                    formatCurrency(item.unit_price),
                    formatCurrency(item.subtotal),
                ]),
                headStyles: { fillColor: [19, 182, 236], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
                bodyStyles: { fontSize: 9 },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 14, right: 14 },
            });

            // Totals
            const finalY = (doc as any).lastAutoTable?.finalY || y + 30;
            let ty = finalY + 10;
            const rightX = pageWidth - 14;

            const totalsData = [
                ['Subtotal', formatCurrency(quote.subtotal)],
                [`Margen (${quote.margin_percent}%)`, `+${formatCurrency(quote.margin_amount)}`],
            ];
            if (quote.discount_amount > 0) totalsData.push([`Descuento (${quote.discount_percent}%)`, `-${formatCurrency(quote.discount_amount)}`]);
            totalsData.push([`IVA (${quote.tax_percent}%)`, formatCurrency(quote.tax_amount)]);

            doc.setFontSize(9);
            for (const [label, val] of totalsData) {
                doc.setFont('helvetica', 'normal');
                doc.text(label, rightX - 80, ty);
                doc.text(val, rightX, ty, { align: 'right' });
                ty += 7;
            }

            // Total line
            doc.setDrawColor(19, 182, 236);
            doc.setLineWidth(0.5);
            doc.line(rightX - 80, ty - 2, rightX, ty - 2);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('TOTAL', rightX - 80, ty + 5);
            doc.setTextColor(19, 182, 236);
            doc.text(formatCurrency(quote.total), rightX, ty + 5, { align: 'right' });

            // Footer
            ty += 20;
            if (quote.valid_until) {
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`Vigencia: ${new Date(quote.valid_until).toLocaleDateString('es-MX')}`, 14, ty);
            }
            if (quote.notes) {
                ty += 10;
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text('Notas: ' + quote.notes.substring(0, 200), 14, ty, { maxWidth: pageWidth - 28 });
            }

            doc.save(`${quote.quote_number}.pdf`);
        } catch (err) {
            console.error('PDF error:', err);
            alert('Error generando PDF. Verifica que jspdf esté instalado.');
        }
    };

    if (loading || !quote) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-6 p-8">
            {/* Back + Actions */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/quotes')}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        Volver
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{quote.quote_number}</h2>
                        <p className="text-sm text-slate-500">{quote.title} · v{quote.version}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${QUOTE_STATUS_COLORS[quote.status].bg} ${QUOTE_STATUS_COLORS[quote.status].text}`}>
                        {QUOTE_STATUS_LABELS[quote.status]}
                    </span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={handleGeneratePDF}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                        Descargar PDF
                    </button>
                    <button onClick={handleNewVersion}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[18px]">content_copy</span>
                        Nueva Versión
                    </button>
                    {quote.status === 'draft' && (
                        <button onClick={() => handleStatusChange('sent')}
                            className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600">
                            <span className="material-symbols-outlined text-[18px]">send</span>
                            Enviar
                        </button>
                    )}
                    {(quote.status === 'sent' || quote.status === 'negotiation') && (
                        <>
                            <button onClick={() => handleStatusChange('negotiation')}
                                className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600">
                                <span className="material-symbols-outlined text-[18px]">handshake</span>
                                Negociación
                            </button>
                            <button onClick={() => handleStatusChange('approved')}
                                className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600">
                                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                Aprobar
                            </button>
                            <button onClick={() => handleStatusChange('rejected')}
                                className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-600">
                                <span className="material-symbols-outlined text-[18px]">cancel</span>
                                Rechazar
                            </button>
                        </>
                    )}
                    {quote.status === 'approved' && (
                        <button onClick={handleConvertToProject}
                            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg">
                            <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                            Convertir a Proyecto
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Main content */}
                <div className="flex flex-col gap-6 lg:col-span-2">
                    {/* Client & General */}
                    <div className="rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                        <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Información General</h3>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 text-sm">
                            <div><span className="text-xs text-slate-400 block">Cliente</span><span className="font-medium text-slate-900 dark:text-white">{quote.client?.company_name || '—'}</span></div>
                            <div><span className="text-xs text-slate-400 block">Tipo de Trabajo</span><span className="font-medium text-slate-900 dark:text-white">{quote.work_type || '—'}</span></div>
                            <div><span className="text-xs text-slate-400 block">Profundidad</span><span className="font-medium text-slate-900 dark:text-white">{quote.well_depth ? `${quote.well_depth}m` : '—'}</span></div>
                            <div><span className="text-xs text-slate-400 block">HP Motor</span><span className="font-medium text-slate-900 dark:text-white">{quote.motor_hp || '—'}</span></div>
                            <div><span className="text-xs text-slate-400 block">Distancia</span><span className="font-medium text-slate-900 dark:text-white">{quote.distance_km ? `${quote.distance_km} km` : '—'}</span></div>
                            <div><span className="text-xs text-slate-400 block">Riesgo</span><span className="font-medium text-slate-900 dark:text-white">{RISK_LABELS[quote.risk_level]}</span></div>
                            <div><span className="text-xs text-slate-400 block">Personal</span><span className="font-medium text-slate-900 dark:text-white">{quote.crew_size}</span></div>
                            <div><span className="text-xs text-slate-400 block">Días Estimados</span><span className="font-medium text-slate-900 dark:text-white">{quote.estimated_days}</span></div>
                            <div><span className="text-xs text-slate-400 block">Vigencia</span><span className="font-medium text-slate-900 dark:text-white">{quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('es-MX') : '—'}</span></div>
                        </div>
                        {quote.description && <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{quote.description}</p>}
                    </div>

                    {/* Items Table */}
                    <div className="rounded-xl border border-slate-200/60 bg-white/50 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Conceptos</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50/50 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-500">#</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-500">Concepto</th>
                                        <th className="px-4 py-3 text-center font-semibold text-slate-500">Cant.</th>
                                        <th className="px-4 py-3 text-center font-semibold text-slate-500">Unidad</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-500">P. Unit.</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-500">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {items.map((item, idx) => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{item.description}</td>
                                            <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{item.quantity}</td>
                                            <td className="px-4 py-3 text-center capitalize text-slate-600 dark:text-slate-300">{item.unit}</td>
                                            <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(item.unit_price)}</td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{formatCurrency(item.subtotal)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Notes */}
                    {quote.notes && (
                        <div className="rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                            <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Notas</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{quote.notes}</p>
                        </div>
                    )}
                </div>

                {/* Sidebar: Totals + Versions */}
                <div className="flex flex-col gap-6">
                    {/* Totals */}
                    <div className="rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                        <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white">Resumen Financiero</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium text-slate-900 dark:text-white">{formatCurrency(quote.subtotal)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Margen ({quote.margin_percent}%)</span><span className="text-emerald-600">+{formatCurrency(quote.margin_amount)}</span></div>
                            {quote.discount_amount > 0 && <div className="flex justify-between"><span className="text-slate-500">Descuento ({quote.discount_percent}%)</span><span className="text-red-500">-{formatCurrency(quote.discount_amount)}</span></div>}
                            <div className="flex justify-between"><span className="text-slate-500">IVA ({quote.tax_percent}%)</span><span className="font-medium text-slate-900 dark:text-white">{formatCurrency(quote.tax_amount)}</span></div>
                            <div className="border-t-2 border-primary/30 pt-3 flex justify-between">
                                <span className="text-lg font-bold text-slate-900 dark:text-white">Total</span>
                                <span className="text-2xl font-bold text-primary">{formatCurrency(quote.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Operational Costs */}
                    <div className="rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Costos Operativos</h3>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between text-slate-500"><span>Costo/km</span><span>{formatCurrency(quote.cost_per_km)}</span></div>
                            <div className="flex justify-between text-slate-500"><span>Viáticos/persona</span><span>{formatCurrency(quote.viaticos_per_person)}</span></div>
                            {quote.insurance_cost > 0 && <div className="flex justify-between text-slate-500"><span>Seguros</span><span>{formatCurrency(quote.insurance_cost)}</span></div>}
                            {quote.vehicle_wear > 0 && <div className="flex justify-between text-slate-500"><span>Desgaste vehículo</span><span>{formatCurrency(quote.vehicle_wear)}</span></div>}
                            {quote.maniobra_cost > 0 && <div className="flex justify-between text-slate-500"><span>Maniobras</span><span>{formatCurrency(quote.maniobra_cost)}</span></div>}
                        </div>
                    </div>

                    {/* Versions */}
                    {versions.length > 0 && (
                        <div className="rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
                            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Historial de Versiones</h3>
                            <div className="space-y-2">
                                {versions.map(v => (
                                    <button key={v.id} onClick={() => navigate(`/quotes/${v.id}`)}
                                        className={`w-full flex items-center justify-between rounded-lg border p-3 text-left text-xs transition-all hover:shadow-sm ${v.id === quote.id ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'}`}>
                                        <div>
                                            <span className="font-semibold text-slate-900 dark:text-white">{v.quote_number}</span>
                                            <span className="ml-2 text-slate-400">v{v.version}</span>
                                        </div>
                                        <span className={`rounded-full px-2 py-0.5 font-semibold ${QUOTE_STATUS_COLORS[v.status].bg} ${QUOTE_STATUS_COLORS[v.status].text}`}>
                                            {QUOTE_STATUS_LABELS[v.status]}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Approval info */}
                    {quote.approved_at && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                <span className="material-symbols-outlined text-[18px]">verified</span>
                                Aprobada
                            </div>
                            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                                Por: {quote.approved_by} — {new Date(quote.approved_at).toLocaleDateString('es-MX')}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
