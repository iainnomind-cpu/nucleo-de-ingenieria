import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { triggerWaAutomation } from '../../lib/waAutomation';
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
    const location = useLocation();
    const [quote, setQuote] = useState<Quote | null>(null);
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [versions, setVersions] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);

    const [showSendModal, setShowSendModal] = useState(false);
    const [sendChannels, setSendChannels] = useState({ whatsapp: true, email: true });
    const [sendingInProgress, setSendingInProgress] = useState(false);
    const [sendResultMsgs, setSendResultMsgs] = useState<string[]>([]);

    const fetchQuote = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('quotes')
            .select('*, client:clients(id, company_name, contact_name, email, phone)')
            .eq('id', id)
            .single();

        if (error || !data) { navigate('/quotes'); return; }
        setQuote(data as Quote);

        if (new URLSearchParams(location.search).get('send') === '1' && data.status === 'draft') {
            setShowSendModal(true);
            navigate(`/quotes/${id}`, { replace: true });
        }

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

            // → Trigger WA Automation: Cotización Aprobada / Proyecto Ganado
            triggerWaAutomation({
                module: 'quotes',
                event: 'approved',
                record: {
                    quote_number: quote.quote_number,
                    client_name: quote.client?.company_name || '',
                    total_amount: formatCurrency(quote.total),
                    title: quote.title,
                },
                referenceId: quote.id,
            });
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

            // → M8: Checklist como tareas asignadas desde Plantillas Automáticas
            const { data: stmts } = await supabase.from('system_settings').select('value').eq('key', 'task_templates').single();
            const templates: any[] = stmts?.value || [];
            const activeTemplate = templates.find((t: any) => t.project_type === quote.work_type);

            let tasksToInsert: any[] = [];
            
            if (activeTemplate && activeTemplate.tasks && activeTemplate.tasks.length > 0) {
                // Fetch assigned users to get phone numbers for WhatsApp
                const userIds = Array.from(new Set(activeTemplate.tasks.map((t: any) => t.assigned_to_id)));
                const { data: usersData } = await supabase.from('app_users').select('id, phone').in('id', userIds as string[]);
                const usersMap = new Map(usersData?.map((u: any) => [u.id, u.phone]) || []);

                activeTemplate.tasks.forEach((t: any) => {
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + (t.days_to_due || 0));
                    
                    tasksToInsert.push({
                        title: `${t.title}`,
                        description: `Tarea automática para el proyecto ${projectNumber}. (Derivado de la cotización ${quote.quote_number})`,
                        assigned_to: t.assigned_to_name || 'Admin', // Nota: team_tasks usa string. Si usa uuid en el futuro cambiar a t.assigned_to_id
                        due_date: dueDate.toISOString().split('T')[0],
                        project_id: project.id,
                        priority: 'normal',
                        status: 'pending' // Asumimos estado pendiente
                    });

                    // Notificación silenciosa a WhatsApp (Fire and Forget)
                    const phone = usersMap.get(t.assigned_to_id);
                    if (phone) {
                        fetch('/api/whatsapp-send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                to: phone,
                                type: 'text',
                                text: `🔔 *Nueva Tarea Asignada*\n\nHola ${t.assigned_to_name},\nSe te ha asignado una nueva tarea para el proyecto *${projectNumber}*:\n📌 *${t.title}*\n⏳ Límite: ${dueDate.toISOString().split('T')[0]}\n\nIngresa al Sistema NDI para más detalles y marcarla como completada.`
                            })
                        }).catch(e => console.error('Error enviando WA a', t.assigned_to_name, e));
                    }
                });
            } else {
                // Fallback default tasks Si no existe plantilla
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 3);
                const formattedDueDate = dueDate.toISOString().split('T')[0];

                tasksToInsert = [
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
                    }
                ];
            }

            if (tasksToInsert.length > 0) {
                await supabase.from('team_tasks').insert(tasksToInsert);
            }
        }

        // → Trigger WA Automation: Proyecto creado desde cotización
        if (project) {
            triggerWaAutomation({
                module: 'projects',
                event: 'created',
                record: {
                    title: `Proyecto: ${quote.title}`,
                    project_number: projectNumber,
                    client_name: quote.client?.company_name || '',
                    status_label: 'Planeación',
                    project_manager: 'Admin',
                },
                referenceId: project.id,
            });
        }

        alert('¡Cotización convertida a proyecto exitosamente! (M3 y M8 actualizados con tareas generadas)');
        navigate('/projects');
    };

    const generatePDFDocument = async () => {
        if (!quote) return null;
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

            // Load logo
            let logoImg: HTMLImageElement | null = null;
            try {
                logoImg = await new Promise((resolve, reject) => {
                    const img = new window.Image();
                    img.src = '/logo.png';
                    img.onload = () => resolve(img);
                    img.onerror = () => reject();
                });
            } catch (e) { 
                console.warn('Logo no encontrado'); 
            }

            // Company info
            let logoOffset = 0;
            if (logoImg) {
                const ratio = logoImg.height / logoImg.width;
                const logoW = 35;
                const logoH = logoW * ratio;
                // Center vertically between 40 and 65 (25px block) => y = 45
                doc.addImage(logoImg, 'PNG', 14, 45, logoW, logoH);
                logoOffset = logoW + 5;
            }

            doc.setTextColor(50, 50, 50);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Núcleo de Ingeniería', 14 + logoOffset, 55);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);

            // Client info
            let y = logoImg ? Math.max(70, 45 + (35 * (logoImg.height / logoImg.width)) + 15) : 70;
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

            return doc;
        } catch (err) {
            console.error('PDF error:', err);
            return null;
        }
    };

    const handleGeneratePDF = async () => {
        const doc = await generatePDFDocument();
        if (doc) {
            doc.save(`${quote?.quote_number}.pdf`);
        } else {
            alert('Error generando PDF. Verifica que jspdf esté instalado.');
        }
    };

    const handleConfirmSend = async () => {
        if (!quote) return;
        if (!sendChannels.whatsapp && !sendChannels.email) {
            alert('Selecciona al menos un canal de envío.');
            return;
        }

        setSendingInProgress(true);
        setSendResultMsgs([]);

        try {
            const doc = await generatePDFDocument();
            if (!doc) throw new Error('No se pudo construir el PDF en memoria');
            const base64Pdf = doc.output('datauristring');
            const filename = `${quote.quote_number}.pdf`;

            const promises: Promise<string>[] = [];

            if (sendChannels.email && quote.client?.email) {
                promises.push(
                    fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: quote.client.email,
                            subject: `Cotización ${quote.quote_number} - Núcleo de Ingeniería`,
                            html: `<h3>Hola ${quote.client.contact_name || ''},</h3><p>Adjunto encontrarás tu cotización <strong>${quote.quote_number}</strong> por el servicio de <strong>${quote.title}</strong>.</p><p>Saludos cordiales,<br/>Equipo Núcleo de Ingeniería</p>`,
                            attachments: [{ filename, content: base64Pdf }]
                        })
                    }).then(res => res.json()).then(data => data.success ? '✅ Correo enviado con éxito' : `❌ Correo falló: ${data.message}`)
                );
            }

            if (sendChannels.whatsapp && quote.client?.phone) {
                promises.push(
                    fetch('/api/whatsapp-send-quote', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: quote.client.phone,
                            base64Pdf,
                            filename,
                            caption: `Hola ${quote.client.contact_name || ''}, te adjuntamos la cotización de tu proyecto: ${quote.title}`
                        })
                    }).then(res => res.json()).then(data => data.success ? '✅ WhatsApp enviado con éxito' : `❌ WhatsApp falló: ${data.message}`)
                );
            }

            const results = await Promise.all(promises);
            setSendResultMsgs(results);

            // Registrar actividad en el CRM
            await supabase.from('client_activities').insert({
                client_id: quote.client_id,
                activity_type: 'quote',
                title: `Cotización ${quote.quote_number} enviada`,
                description: `Enviada a: ${quote.client?.contact_name || 'N/A'}.\nCanales utilizados y status:\n${results.join('\n')}`
            });

            // Automáticamente cambiar estado a enviado y pipeline
            handleStatusChange('sent');

        } catch (error: any) {
            console.error('Error in handleConfirmSend:', error);
            setSendResultMsgs([`❌ Error Crítico: ${error.message}`]);
        } finally {
            setSendingInProgress(false);
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
                        <button onClick={() => setShowSendModal(true)}
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

            {/* Modal de Envío Bicanal */}
            {showSendModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Enviar Cotización</h3>
                            <button onClick={() => { setShowSendModal(false); setSendResultMsgs([]); }} className="text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        {!sendResultMsgs.length ? (
                            <>
                                <p className="mb-5 text-sm text-slate-600 dark:text-slate-400">Selecciona los canales para hacer llegar la información a <strong>{quote.client?.contact_name || quote.client?.company_name}</strong>.</p>
                                <div className="space-y-3 mb-6">
                                    <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition-all hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                <span className="material-symbols-outlined">chat</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">WhatsApp</span>
                                                <span className="text-xs font-mono mt-0.5 text-slate-500">{quote.client?.phone || 'Sin número registrado'}</span>
                                            </div>
                                        </div>
                                        <input type="checkbox" checked={sendChannels.whatsapp} 
                                            onChange={e => setSendChannels({...sendChannels, whatsapp: e.target.checked})} 
                                            disabled={!quote.client?.phone}
                                            className="h-5 w-5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer" />
                                    </label>
                                    
                                    <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition-all hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
                                                <span className="material-symbols-outlined">mail</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Correo Electrónico</span>
                                                <span className="text-xs mt-0.5 text-slate-500">{quote.client?.email || 'Sin correo registrado'}</span>
                                            </div>
                                        </div>
                                        <input type="checkbox" checked={sendChannels.email} 
                                            onChange={e => setSendChannels({...sendChannels, email: e.target.checked})} 
                                            disabled={!quote.client?.email}
                                            className="h-5 w-5 rounded border-slate-300 text-sky-500 focus:ring-sky-500 cursor-pointer" />
                                    </label>
                                </div>
                                
                                <button onClick={handleConfirmSend} disabled={sendingInProgress || (!sendChannels.whatsapp && !sendChannels.email)}
                                    className="w-full rounded-xl bg-gradient-to-r from-primary to-sky-600 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:opacity-90 disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2">
                                    {sendingInProgress ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <span className="material-symbols-outlined text-[18px]">rocket_launch</span>}
                                    {sendingInProgress ? 'Generando PDF y enviando...' : 'Confirmar Envío Doble'}
                                </button>
                            </>
                        ) : (
                            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-800/50">
                                    <h4 className="font-bold text-slate-900 dark:text-white mb-3 flex relative items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">analytics</span> Resumen de Envío
                                    </h4>
                                    <ul className="space-y-3">
                                        {sendResultMsgs.map((msg, i) => (
                                            <li key={i} className={`flex items-start gap-2 text-sm font-medium ${msg.includes('Error') || msg.includes('falló') ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                <span className="material-symbols-outlined text-[18px]">{msg.includes('Error') || msg.includes('falló') ? 'error' : 'check_circle'}</span>
                                                <span>{msg}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <button onClick={() => { setShowSendModal(false); setSendResultMsgs([]); }}
                                    className="w-full rounded-xl border-2 border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-all">
                                    Cerrar Ventana
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
