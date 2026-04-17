import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportData {
  // Ventas
  totalQuotes: number; approvedQuotes: number; conversionRate: number; totalQuotedValue: number;
  // CRM
  totalClients: number; activeClients: number;
  // Operaciones
  activeProjects: number; delayedProjects: number; completedProjects: number; totalProjects: number;
  // Inventario
  totalProducts: number; lowStockProducts: number; outOfStockProducts: number; inventoryValue: number;
  // Finanzas
  monthRevenue: number; totalAR: number; overdueInvoices: number; totalExpenses: number;
  // Mantenimiento
  totalEquipment: number; overdueSchedules: number; activeContracts: number; mrr: number;
  // Teams
  activeSpaces: number; pendingTasks: number;
  // Alertas
  alerts: { type: string; title: string; description: string }[];
  // Recientes
  recentInvoices: { invoice_number: string; total: number; status: string; client_name: string }[];
  recentProjects: { project_number: string; title: string; status: string; project_type: string }[];
  // Team
  teamStats: { name: string; assigned: number; completed: number }[];
}

const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(v);
const pct = (v: number) => `${v.toFixed(1)}%`;

const statusLabels: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviada', partial: 'Parcial', paid: 'Pagada', overdue: 'Vencida',
  cancelled: 'Cancelada', pending: 'Pendiente', preparation: 'Preparación',
  in_progress: 'En Curso', completed: 'Completado', invoiced: 'Facturado',
};

const COLORS = {
  primary: [16, 185, 129] as [number, number, number],      // emerald-500
  primaryDark: [6, 95, 70] as [number, number, number],      // emerald-800
  accent: [59, 130, 246] as [number, number, number],        // blue-500
  danger: [239, 68, 68] as [number, number, number],         // red-500
  warning: [245, 158, 11] as [number, number, number],       // amber-500
  success: [34, 197, 94] as [number, number, number],        // green-500
  dark: [15, 23, 42] as [number, number, number],            // slate-900
  medium: [100, 116, 139] as [number, number, number],       // slate-500
  light: [241, 245, 249] as [number, number, number],        // slate-100
  white: [255, 255, 255] as [number, number, number],
};

function drawHeader(doc: jsPDF, pageWidth: number) {
  // Top accent bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 4, 'F');
  // Title bar
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 4, pageWidth, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  doc.text('Núcleo de Ingeniería', 14, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 200, 220);
  doc.text('Reporte Ejecutivo', pageWidth - 14, 18, { align: 'right' });
  doc.setFontSize(7);
  doc.text(new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), pageWidth - 14, 26, { align: 'right' });
}

function drawSectionTitle(doc: jsPDF, y: number, title: string, icon?: string): number {
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(14, y, 3, 16, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.dark);
  doc.text(title, 22, y + 11);
  return y + 22;
}

function drawKPIBox(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, color: [number, number, number]) {
  // Card background
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, w, h, 3, 3, 'F');
  // Left accent
  doc.setFillColor(...color);
  doc.roundedRect(x, y, 3, h, 1.5, 1.5, 'F');
  // Value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.dark);
  doc.text(value, x + 10, y + 18);
  // Label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.medium);
  doc.text(label.toUpperCase(), x + 10, y + 26);
}

function drawProgressBar(doc: jsPDF, x: number, y: number, w: number, h: number, pctValue: number, color: [number, number, number]) {
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F');
  if (pctValue > 0) {
    doc.setFillColor(...color);
    doc.roundedRect(x, y, Math.max(w * (pctValue / 100), h), h, h / 2, h / 2, 'F');
  }
}

function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(226, 232, 240);
  doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.medium);
  doc.text('Núcleo de Ingeniería · Reporte Ejecutivo · Confidencial', 14, pageHeight - 8);
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
}

function checkPageBreak(doc: jsPDF, currentY: number, needed: number, pageWidth: number): number {
  if (currentY + needed > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    drawHeader(doc, pageWidth);
    return 42;
  }
  return currentY;
}

export function generateExecutiveReport(data: ReportData) {
  const doc = new jsPDF('p', 'mm', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();

  // ─── PAGE 1: Cover + KPIs + Alerts ──────────────────────────
  drawHeader(doc, pageWidth);

  let y = 42;

  // ─── INDICADORES CLAVE ───
  y = drawSectionTitle(doc, y, 'Indicadores Clave de Desempeño');

  const kpiW = (pageWidth - 28 - 12) / 4; // 4 columns with gaps
  const kpis = [
    { label: 'Proyectos Activos', value: data.activeProjects.toString(), color: COLORS.accent },
    { label: 'Ingresos del Mes', value: fmt(data.monthRevenue), color: COLORS.success },
    { label: 'Cuentas por Cobrar', value: fmt(data.totalAR), color: COLORS.warning },
    { label: 'Valor Inventario', value: fmt(data.inventoryValue), color: [139, 92, 246] as [number, number, number] },
  ];
  kpis.forEach((k, i) => {
    drawKPIBox(doc, 14 + i * (kpiW + 4), y, kpiW, 32, k.label, k.value, k.color);
  });
  y += 40;

  // ─── MÉTRICAS SECUNDARIAS ───
  y = checkPageBreak(doc, y, 35, pageWidth);
  y = drawSectionTitle(doc, y, 'Métricas Operativas');

  const metrics = [
    { label: 'Clientes Totales', value: data.totalClients.toString(), detail: `${data.activeClients} activos (${data.totalClients > 0 ? ((data.activeClients / data.totalClients) * 100).toFixed(0) : 0}%)` },
    { label: 'Tasa Conversión', value: pct(data.conversionRate), detail: `${data.approvedQuotes} de ${data.totalQuotes} cotizaciones aprobadas` },
    { label: 'Proyectos Completados', value: `${data.completedProjects}/${data.totalProjects}`, detail: `${data.totalProjects > 0 ? ((data.completedProjects / data.totalProjects) * 100).toFixed(0) : 0}% completados` },
    { label: 'Equipos Instalados', value: data.totalEquipment.toString(), detail: `${data.overdueSchedules} mant. vencidos · ${data.activeContracts} contratos` },
    { label: 'Stock Bajo/Agotado', value: `${data.lowStockProducts} / ${data.outOfStockProducts}`, detail: `de ${data.totalProducts} productos` },
    { label: 'MRR Contratos', value: fmt(data.mrr), detail: `${data.activeContracts} contratos activos` },
  ];

  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor', 'Detalle']],
    body: metrics.map(m => [m.label, m.value, m.detail]),
    margin: { left: 14, right: 14 },
    theme: 'plain',
    headStyles: {
      fillColor: COLORS.dark,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 4,
    },
    bodyStyles: { fontSize: 8, cellPadding: 3.5, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { halign: 'center', cellWidth: 40 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ─── ALERTAS EJECUTIVAS ───
  if (data.alerts.length > 0) {
    y = checkPageBreak(doc, y, 20 + data.alerts.length * 12, pageWidth);
    y = drawSectionTitle(doc, y, 'Alertas Ejecutivas');

    data.alerts.forEach(alert => {
      y = checkPageBreak(doc, y, 14, pageWidth);
      const isCritical = alert.type === 'critical';
      doc.setFillColor(...(isCritical ? [254, 226, 226] : [254, 243, 199]) as [number, number, number]);
      doc.roundedRect(14, y, pageWidth - 28, 12, 2, 2, 'F');
      doc.setFillColor(...(isCritical ? COLORS.danger : COLORS.warning));
      doc.roundedRect(14, y, 3, 12, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...(isCritical ? COLORS.danger : [180, 83, 9]));
      doc.text(alert.title, 22, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.medium);
      doc.text(alert.description.slice(0, 100), 22, y + 10);
      y += 15;
    });
    y += 4;
  }

  // ─── RESUMEN FINANCIERO ───
  y = checkPageBreak(doc, y, 60, pageWidth);
  y = drawSectionTitle(doc, y, 'Resumen Financiero del Mes');

  const netFlow = data.monthRevenue - data.totalExpenses;
  const finRows = [
    ['Ingresos del Mes (Pagos recibidos)', fmt(data.monthRevenue), { positive: true }],
    ['Total Gastos Operativos', `- ${fmt(data.totalExpenses)}`, { positive: false }],
    ['Flujo Neto del Mes', fmt(netFlow), { positive: netFlow >= 0 }],
    ['──────────────────', '──────────', {}],
    ['Valor Total Cotizado (Acumulado)', fmt(data.totalQuotedValue), { positive: true }],
    ['Cuentas por Cobrar', fmt(data.totalAR), { positive: false }],
    ['Facturas Vencidas', `${data.overdueInvoices} facturas`, { positive: false }],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Monto']],
    body: finRows.map(r => [r[0], r[1]]),
    margin: { left: 14, right: 14 },
    theme: 'plain',
    headStyles: { fillColor: COLORS.dark, textColor: COLORS.white, fontStyle: 'bold', fontSize: 8, cellPadding: 4 },
    bodyStyles: { fontSize: 9, cellPadding: 3.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (hookData: any) => {
      if (hookData.section === 'body') {
        const rowIdx = hookData.row.index;
        if (rowIdx === 2) { // Net flow row
          hookData.cell.styles.fillColor = netFlow >= 0 ? [220, 252, 231] : [254, 226, 226];
          hookData.cell.styles.textColor = netFlow >= 0 ? [22, 101, 52] : [153, 27, 27];
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fontSize = 10;
        }
        if (rowIdx === 3) { // Separator
          hookData.cell.styles.textColor = [203, 213, 225];
          hookData.cell.styles.fontSize = 6;
        }
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ─── INSIGHTS ───
  y = checkPageBreak(doc, y, 50, pageWidth);
  y = drawSectionTitle(doc, y, 'Insights Clave');

  const insights: string[] = [];
  if (netFlow >= 0) insights.push(`✅ Flujo positivo de ${fmt(netFlow)}. La operación es rentable este mes.`);
  else insights.push(`⚠️ Flujo negativo de ${fmt(netFlow)}. Los gastos superan los ingresos del mes.`);
  if (data.conversionRate >= 50) insights.push(`✅ Tasa de conversión del ${pct(data.conversionRate)} — por encima del promedio de la industria.`);
  else if (data.conversionRate >= 30) insights.push(`📊 Tasa de conversión del ${pct(data.conversionRate)} — en el rango promedio. Hay oportunidad de mejora.`);
  else if (data.totalQuotes > 0) insights.push(`⚠️ Tasa de conversión baja (${pct(data.conversionRate)}). Considerar mejorar la calificación de prospectos.`);
  if (data.totalAR > data.monthRevenue * 2) insights.push(`⚠️ CxC (${fmt(data.totalAR)}) es más del doble del ingreso. Priorizar cobranza.`);
  if (data.overdueInvoices > 0) insights.push(`⚠️ ${data.overdueInvoices} facturas vencidas. Se recomienda gestión de cobranza inmediata.`);
  if (data.outOfStockProducts > 0) insights.push(`🔴 ${data.outOfStockProducts} productos agotados. Impacto potencial en operaciones.`);
  if (data.lowStockProducts > 0) insights.push(`📦 ${data.lowStockProducts} productos bajo mínimo. Programar reabastecimiento.`);
  if (data.overdueSchedules > 0) insights.push(`🔧 ${data.overdueSchedules} mantenimientos vencidos. Riesgo de falla de equipos.`);
  if (data.activeProjects > 0 && data.completedProjects < data.totalProjects) {
    const completionRate = (data.completedProjects / data.totalProjects) * 100;
    insights.push(`📊 ${completionRate.toFixed(0)}% de proyectos completados (${data.completedProjects}/${data.totalProjects}).`);
  }

  insights.forEach(ins => {
    y = checkPageBreak(doc, y, 10, pageWidth);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, pageWidth - 28, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.dark);
    doc.text(ins, 18, y + 6);
    y += 12;
  });
  y += 4;

  // ─── FACTURAS RECIENTES ───
  if (data.recentInvoices.length > 0) {
    y = checkPageBreak(doc, y, 50, pageWidth);
    y = drawSectionTitle(doc, y, 'Facturas Recientes');
    autoTable(doc, {
      startY: y,
      head: [['Factura', 'Cliente', 'Total', 'Estado']],
      body: data.recentInvoices.map(i => [i.invoice_number, i.client_name, fmt(i.total), statusLabels[i.status] || i.status]),
      margin: { left: 14, right: 14 },
      theme: 'plain',
      headStyles: { fillColor: COLORS.dark, textColor: COLORS.white, fontStyle: 'bold', fontSize: 8, cellPadding: 4 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body' && hookData.column.index === 3) {
          const st = data.recentInvoices[hookData.row.index]?.status;
          if (st === 'paid') hookData.cell.styles.textColor = COLORS.success;
          else if (st === 'overdue') hookData.cell.styles.textColor = COLORS.danger;
          else if (st === 'partial') hookData.cell.styles.textColor = COLORS.warning;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── PROYECTOS RECIENTES ───
  if (data.recentProjects.length > 0) {
    y = checkPageBreak(doc, y, 50, pageWidth);
    y = drawSectionTitle(doc, y, 'Proyectos Recientes');
    autoTable(doc, {
      startY: y,
      head: [['# Proyecto', 'Título', 'Tipo', 'Estado']],
      body: data.recentProjects.map(p => [p.project_number, p.title, p.project_type, statusLabels[p.status] || p.status]),
      margin: { left: 14, right: 14 },
      theme: 'plain',
      headStyles: { fillColor: COLORS.dark, textColor: COLORS.white, fontStyle: 'bold', fontSize: 8, cellPadding: 4 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body' && hookData.column.index === 3) {
          const st = data.recentProjects[hookData.row.index]?.status;
          if (st === 'completed' || st === 'invoiced') hookData.cell.styles.textColor = COLORS.success;
          else if (st === 'in_progress') hookData.cell.styles.textColor = COLORS.warning;
          else if (st === 'preparation' || st === 'pending') hookData.cell.styles.textColor = COLORS.accent;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── RENDIMIENTO DEL EQUIPO ───
  if (data.teamStats.length > 0) {
    y = checkPageBreak(doc, y, 50, pageWidth);
    y = drawSectionTitle(doc, y, 'Rendimiento del Equipo');

    const teamBody = data.teamStats.map(t => {
      const completionPct = t.assigned > 0 ? ((t.completed / t.assigned) * 100).toFixed(0) : '0';
      const pending = t.assigned - t.completed;
      let perf = '🟢 Excelente';
      if (Number(completionPct) < 70) perf = '🟡 Regular';
      if (Number(completionPct) < 40) perf = '🔴 Bajo';
      return [t.name, t.assigned.toString(), t.completed.toString(), pending.toString(), `${completionPct}%`, perf];
    });

    autoTable(doc, {
      startY: y,
      head: [['Miembro', 'Asignadas', 'Completadas', 'Pendientes', '% Completado', 'Desempeño']],
      body: teamBody,
      margin: { left: 14, right: 14 },
      theme: 'plain',
      headStyles: { fillColor: COLORS.dark, textColor: COLORS.white, fontStyle: 'bold', fontSize: 8, cellPadding: 4 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center', fontStyle: 'bold' },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── ADD PAGE NUMBERS ───
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, totalPages);
  }

  // ─── SAVE ───
  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`Reporte_Ejecutivo_NucleoIngenieria_${dateStr}.pdf`);
}
