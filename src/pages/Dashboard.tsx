import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import GoogleMapView, { MapPin } from '../components/GoogleMap';
import { NUCLEO_HQ } from '../lib/maps';
import { generateExecutiveReport } from '../lib/reportGenerator';

interface DashboardData {
  // Ventas
  totalQuotes: number; approvedQuotes: number; conversionRate: number;
  totalQuotedValue: number;
  // CRM (M1)
  totalClients: number; activeClients: number;
  // Operaciones
  activeProjects: number; delayedProjects: number; completedProjects: number; totalProjects: number;
  // Inventario
  totalProducts: number; lowStockProducts: number; outOfStockProducts: number; inventoryValue: number;
  // Finanzas
  monthRevenue: number; totalAR: number; overdueInvoices: number; totalExpenses: number;
  // Mantenimiento
  totalEquipment: number; overdueSchedules: number; activeContracts: number; mrr: number;
  // Teams (M8)
  activeSpaces: number; pendingTasks: number;
  // Alertas
  alerts: Alert[];
  // Recientes
  recentInvoices: { id: string; invoice_number: string; total: number; status: string; client_name: string }[];
  recentProjects: { id: string; project_number: string; title: string; status: string; project_type: string }[];
  // Team
  teamStats: { name: string; assigned: number; completed: number }[];
  // Top profitable projects
  topProjects: { number: string; title: string; billed: number; cost: number; margin: number }[];
  // Geo (Maps)
  geoClients: { id: string; company_name: string; status: string; latitude: number; longitude: number }[];
  geoProjects: { id: string; title: string; status: string; latitude: number; longitude: number }[];
}

interface Alert {
  type: 'critical' | 'warning' | 'info';
  icon: string;
  title: string;
  description: string;
  link: string;
}

const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(v);

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Report modal state (only for PDF export, does NOT affect dashboard view)
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportPreset, setReportPreset] = useState('this_month');
  const [reportFrom, setReportFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [generatingReport, setGeneratingReport] = useState(false);

  const applyReportPreset = (preset: string) => {
    const now = new Date();
    let from = '', to = new Date().toISOString().split('T')[0];
    switch (preset) {
      case 'this_month': { const d = new Date(); d.setDate(1); from = d.toISOString().split('T')[0]; break; }
      case 'last_month': { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); from = d.toISOString().split('T')[0]; const e = new Date(now.getFullYear(), now.getMonth(), 0); to = e.toISOString().split('T')[0]; break; }
      case 'last_3_months': { const d = new Date(now.getFullYear(), now.getMonth() - 2, 1); from = d.toISOString().split('T')[0]; break; }
      case 'last_6_months': { const d = new Date(now.getFullYear(), now.getMonth() - 5, 1); from = d.toISOString().split('T')[0]; break; }
      case 'this_year': { from = `${now.getFullYear()}-01-01`; break; }
      case 'all_time': { from = '2020-01-01'; break; }
    }
    setReportFrom(from); setReportTo(to); setReportPreset(preset);
  };

  const reportPresetLabel = (): string => {
    const labels: Record<string, string> = { this_month: 'Este Mes', last_month: 'Mes Pasado', last_3_months: 'Últimos 3 Meses', last_6_months: 'Últimos 6 Meses', this_year: 'Este Año', all_time: 'Todo el Historial', custom: 'Personalizado' };
    return labels[reportPreset] || 'Personalizado';
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [quotesR, projectsR, productsR, invoicesR, paymentsR, expensesR, equipR, schedR, contractsR, tasksR, clientsR, spacesR, teamTasksR, geoClientsR, geoProjectsR] = await Promise.all([
        supabase.from('quotes').select('id, status, total'),
        supabase.from('projects').select('id, project_number, title, status, project_type, assigned_team'),
        supabase.from('inventory_products').select('id, name, code, current_stock, min_stock, unit_cost, criticality').eq('is_active', true),
        supabase.from('invoices').select('id, invoice_number, status, total, amount_paid, balance, due_date, issue_date, client:clients(company_name)').gte('issue_date', reportFrom).lte('issue_date', reportTo).order('issue_date', { ascending: false }).limit(20),
        supabase.from('payments').select('amount, payment_date').gte('payment_date', reportFrom).lte('payment_date', reportTo),
        supabase.from('project_expenses').select('project_id, amount, category, expense_date').gte('expense_date', reportFrom).lte('expense_date', reportTo),
        supabase.from('installed_equipment').select('id, status'),
        supabase.from('maintenance_schedules').select('id, status, next_service_date, assigned_to, title, equipment:installed_equipment(name, well_name)').neq('status', 'completed').neq('status', 'cancelled'),
        supabase.from('maintenance_contracts').select('id, status, monthly_amount').eq('status', 'active'),
        supabase.from('project_tasks').select('id, status, assigned_to'),
        supabase.from('clients').select('id, company_name, status'),
        supabase.from('spaces').select('id').eq('is_archived', false),
        supabase.from('team_tasks').select('id, status').eq('status', 'pending'),
        supabase.from('clients').select('id, company_name, status, latitude, longitude').not('latitude', 'is', null),
        supabase.from('projects').select('id, title, status, latitude, longitude').not('latitude', 'is', null),
      ]);

      const quotes = quotesR.data || [];
      const projects = projectsR.data || [];
      const products = productsR.data || [];
      const invoices = ((invoicesR.data || []) as unknown) as Array<{ id: string; invoice_number: string; status: string; total: number; amount_paid: number; balance: number; due_date: string; issue_date: string; client?: { company_name: string } | null }>;
      const monthPayments = paymentsR.data || [];
      const expenses = expensesR.data || [];
      const equipment = equipR.data || [];
      const schedules = schedR.data || [];
      const contracts = contractsR.data || [];
      const tasks = tasksR.data || [];
      const allClients = clientsR.data || [];
      const spaces = spacesR.data || [];
      const teamTasks = teamTasksR.data || [];
      const geoClients = (geoClientsR.data || []) as { id: string; company_name: string; status: string; latitude: number; longitude: number }[];
      const geoProjects = (geoProjectsR.data || []) as { id: string; title: string; status: string; latitude: number; longitude: number }[];

      const totalQuotes = quotes.length;
      const approvedQuotes = quotes.filter((q: { status: string }) => q.status === 'approved' || q.status === 'converted').length;
      const conversionRate = totalQuotes > 0 ? (approvedQuotes / totalQuotes) * 100 : 0;
      const totalQuotedValue = quotes.reduce((s: number, q: { total: number }) => s + (q.total || 0), 0);
      const activeProjects = projects.filter((p: { status: string }) => p.status === 'in_progress' || p.status === 'preparation').length;
      const delayedProjects = projects.filter((p: { status: string }) => p.status === 'in_progress').length;
      const completedProjects = projects.filter((p: { status: string }) => p.status === 'completed' || p.status === 'invoiced').length;
      const totalProjects = projects.length;
      const totalProducts = products.length;
      const lowStockProducts = products.filter((p: { current_stock: number; min_stock: number }) => p.current_stock > 0 && p.current_stock <= p.min_stock).length;
      const outOfStockProducts = products.filter((p: { current_stock: number }) => p.current_stock <= 0).length;
      const inventoryValue = products.reduce((s: number, p: { current_stock: number; unit_cost: number }) => s + (p.current_stock * p.unit_cost), 0);
      const monthRevenue = monthPayments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
      const totalAR = invoices.filter(i => i.balance > 0 && i.status !== 'cancelled').reduce((s, i) => s + i.balance, 0);
      const overdueInvoices = invoices.filter(i => i.balance > 0 && i.due_date < today && i.status !== 'cancelled' && i.status !== 'paid').length;
      const totalExpenses = expenses.reduce((s: number, e: { amount: number }) => s + e.amount, 0);
      const totalEquipment = equipment.length;
      const overdueSchedules = schedules.filter((s: { next_service_date: string }) => s.next_service_date < today).length;
      const activeContracts = contracts.length;
      const mrr = contracts.reduce((s: number, c: { monthly_amount: number }) => s + c.monthly_amount, 0);
      const totalClients = allClients.length;
      const activeClients = allClients.filter((c: { status: string }) => c.status === 'active').length;
      const activeSpaces = spaces.length;
      const pendingTasks = teamTasks.length;

      const alerts: Alert[] = [];
      const criticalProducts = products.filter((p: { current_stock: number; criticality: string }) => p.current_stock <= 0 && p.criticality === 'critical_path');
      if (criticalProducts.length > 0) alerts.push({ type: 'critical', icon: '⚫', title: `${criticalProducts.length} producto(s) ruta crítica sin stock`, description: criticalProducts.map((p: { name: string }) => p.name).slice(0, 3).join(', '), link: '/inventory' });
      const lowStockNames = products.filter((p: { current_stock: number; min_stock: number }) => p.current_stock > 0 && p.current_stock <= p.min_stock).map((p: { name: string; current_stock: number; min_stock: number }) => `${p.name} (${p.current_stock}/${p.min_stock})`);
      if (lowStockNames.length > 0) alerts.push({ type: 'warning', icon: '📦', title: `${lowStockNames.length} producto(s) bajo mínimo`, description: lowStockNames.slice(0, 3).join(', '), link: '/inventory' });
      if (outOfStockProducts > 0) alerts.push({ type: 'warning', icon: '🔴', title: `${outOfStockProducts} producto(s) agotados`, description: 'Revisa el inventario para reabastecimiento.', link: '/inventory' });
      const overdue90 = invoices.filter(i => { const d = Math.ceil((new Date().getTime() - new Date(i.due_date).getTime()) / 86400000); return i.balance > 0 && d > 90 && i.status !== 'cancelled'; });
      if (overdue90.length > 0) alerts.push({ type: 'critical', icon: '💰', title: `${overdue90.length} factura(s) con +90 días sin pagar`, description: `${overdue90.map(i => i.client?.company_name || 'N/A').filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(', ')} · Total: ${fmt(overdue90.reduce((s, i) => s + i.balance, 0))}`, link: '/finance' });
      if (overdueInvoices > 0) alerts.push({ type: 'warning', icon: '⚠️', title: `${overdueInvoices} factura(s) vencidas`, description: 'Cuentas por cobrar pendientes.', link: '/finance/invoices' });
      const overdueSchList = (schedules.filter((s: { next_service_date: string }) => s.next_service_date < today) as unknown) as Array<{ title: string; assigned_to: string | null; equipment?: { name: string; well_name: string | null } | null }>;
      if (overdueSchList.length > 0) alerts.push({ type: 'warning', icon: '🔧', title: `${overdueSchList.length} mantenimiento(s) vencido(s)`, description: overdueSchList.slice(0, 3).map(s => `${s.title}${s.equipment?.well_name ? ' (' + s.equipment.well_name + ')' : ''}`).join(', '), link: '/maintenance' });

      const recentInvoices = invoices.slice(0, 5).map(i => ({ id: i.id, invoice_number: i.invoice_number, total: i.total, status: i.status, client_name: i.client?.company_name || '—' }));
      const recentProjects = projects.slice(0, 5).map((p: { id: string; project_number: string; title: string; status: string; project_type: string }) => ({ id: p.id, project_number: p.project_number, title: p.title, status: p.status, project_type: p.project_type }));

      const teamNames = ['Samara', 'Paulina', 'Joel', 'Alejandro'];
      const teamStats = teamNames.map(name => {
        const assigned = tasks.filter((t: { assigned_to: string | null }) => t.assigned_to?.toLowerCase().includes(name.toLowerCase())).length;
        const completed = tasks.filter((t: { assigned_to: string | null; status: string }) => t.assigned_to?.toLowerCase().includes(name.toLowerCase()) && t.status === 'completed').length;
        return { name, assigned, completed };
      }).filter(t => t.assigned > 0);

      const topProjects: any[] = []; // Omitted for brevity in report

      const reportPayload = {
        totalQuotes, approvedQuotes, conversionRate, totalQuotedValue,
        totalClients, activeClients,
        activeProjects, delayedProjects, completedProjects, totalProjects,
        totalProducts, lowStockProducts, outOfStockProducts, inventoryValue,
        monthRevenue, totalAR, overdueInvoices, totalExpenses,
        totalEquipment, overdueSchedules, activeContracts, mrr,
        activeSpaces, pendingTasks,
        alerts, recentInvoices, recentProjects, teamStats, topProjects,
        geoClients, geoProjects
      };

      generateExecutiveReport(reportPayload);
      setShowReportModal(false);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Hubo un error al generar el reporte.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(); monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const [quotesR, projectsR, productsR, invoicesR, paymentsR, expensesR, equipR, schedR, contractsR, tasksR, clientsR, spacesR, teamTasksR, geoClientsR, geoProjectsR] = await Promise.all([
      supabase.from('quotes').select('id, status, total'),
      supabase.from('projects').select('id, project_number, title, status, project_type, assigned_team'),
      supabase.from('inventory_products').select('id, name, code, current_stock, min_stock, unit_cost, criticality').eq('is_active', true),
      supabase.from('invoices').select('id, invoice_number, status, total, amount_paid, balance, due_date, issue_date, client:clients(company_name)').order('issue_date', { ascending: false }).limit(10),
      supabase.from('payments').select('amount, payment_date').gte('payment_date', monthStartStr),
      supabase.from('project_expenses').select('project_id, amount, category'),
      supabase.from('installed_equipment').select('id, status'),
      supabase.from('maintenance_schedules').select('id, status, next_service_date, assigned_to, title, equipment:installed_equipment(name, well_name)').neq('status', 'completed').neq('status', 'cancelled'),
      supabase.from('maintenance_contracts').select('id, status, monthly_amount').eq('status', 'active'),
      supabase.from('project_tasks').select('id, status, assigned_to'),
      supabase.from('clients').select('id, company_name, status'),
      supabase.from('spaces').select('id').eq('is_archived', false),
      supabase.from('team_tasks').select('id, status').eq('status', 'pending'),
      supabase.from('clients').select('id, company_name, status, latitude, longitude').not('latitude', 'is', null),
      supabase.from('projects').select('id, title, status, latitude, longitude').not('latitude', 'is', null),
    ]);

    const quotes = quotesR.data || [];
    const projects = projectsR.data || [];
    const products = productsR.data || [];
    const invoices = ((invoicesR.data || []) as unknown) as Array<{ id: string; invoice_number: string; status: string; total: number; amount_paid: number; balance: number; due_date: string; issue_date: string; client?: { company_name: string } | null }>;
    const monthPayments = paymentsR.data || [];
    const expenses = expensesR.data || [];
    const equipment = equipR.data || [];
    const schedules = schedR.data || [];
    const contracts = contractsR.data || [];
    const tasks = tasksR.data || [];
    const allClients = clientsR.data || [];
    const spaces = spacesR.data || [];
    const teamTasks = teamTasksR.data || [];
    const geoClients = (geoClientsR.data || []) as { id: string; company_name: string; status: string; latitude: number; longitude: number }[];
    const geoProjects = (geoProjectsR.data || []) as { id: string; title: string; status: string; latitude: number; longitude: number }[];

    // VENTAS
    const totalQuotes = quotes.length;
    const approvedQuotes = quotes.filter((q: { status: string }) => q.status === 'approved' || q.status === 'converted').length;
    const conversionRate = totalQuotes > 0 ? (approvedQuotes / totalQuotes) * 100 : 0;
    const totalQuotedValue = quotes.reduce((s: number, q: { total: number }) => s + (q.total || 0), 0);

    // OPERACIONES
    const activeProjects = projects.filter((p: { status: string }) => p.status === 'in_progress' || p.status === 'preparation').length;
    const delayedProjects = projects.filter((p: { status: string }) => p.status === 'in_progress').length; // Could be refined
    const completedProjects = projects.filter((p: { status: string }) => p.status === 'completed' || p.status === 'invoiced').length;
    const totalProjects = projects.length;

    // INVENTARIO
    const totalProducts = products.length;
    const lowStockProducts = products.filter((p: { current_stock: number; min_stock: number }) => p.current_stock > 0 && p.current_stock <= p.min_stock).length;
    const outOfStockProducts = products.filter((p: { current_stock: number }) => p.current_stock <= 0).length;
    const inventoryValue = products.reduce((s: number, p: { current_stock: number; unit_cost: number }) => s + (p.current_stock * p.unit_cost), 0);

    // FINANZAS
    const monthRevenue = monthPayments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
    const totalAR = invoices.filter(i => i.balance > 0 && i.status !== 'cancelled').reduce((s, i) => s + i.balance, 0);
    const overdueInvoices = invoices.filter(i => i.balance > 0 && i.due_date < today && i.status !== 'cancelled' && i.status !== 'paid').length;
    const totalExpenses = expenses.reduce((s: number, e: { amount: number }) => s + e.amount, 0);

    // MANTENIMIENTO
    const totalEquipment = equipment.length;
    const overdueSchedules = schedules.filter((s: { next_service_date: string }) => s.next_service_date < today).length;
    const activeContracts = contracts.length;
    const mrr = contracts.reduce((s: number, c: { monthly_amount: number }) => s + c.monthly_amount, 0);

    // CRM (M1)
    const totalClients = allClients.length;
    const activeClients = allClients.filter((c: { status: string }) => c.status === 'active').length;

    // TEAMS (M8)
    const activeSpaces = spaces.length;
    const pendingTasks = teamTasks.length;

    // ALERTAS EJECUTIVAS
    const alerts: Alert[] = [];
    // Inventario crítico (con nombres)
    const criticalProducts = products.filter((p: { current_stock: number; criticality: string }) => p.current_stock <= 0 && p.criticality === 'critical_path');
    if (criticalProducts.length > 0) alerts.push({ type: 'critical', icon: '⚫', title: `${criticalProducts.length} producto(s) ruta crítica sin stock`, description: criticalProducts.map((p: { name: string }) => p.name).slice(0, 3).join(', '), link: '/inventory' });
    const lowStockNames = products.filter((p: { current_stock: number; min_stock: number }) => p.current_stock > 0 && p.current_stock <= p.min_stock).map((p: { name: string; current_stock: number; min_stock: number }) => `${p.name} (${p.current_stock}/${p.min_stock})`);
    if (lowStockNames.length > 0) alerts.push({ type: 'warning', icon: '📦', title: `${lowStockNames.length} producto(s) bajo mínimo`, description: lowStockNames.slice(0, 3).join(', '), link: '/inventory' });
    if (outOfStockProducts > 0) alerts.push({ type: 'warning', icon: '🔴', title: `${outOfStockProducts} producto(s) agotados`, description: 'Revisa el inventario para reabastecimiento.', link: '/inventory' });
    // Clientes +90 días sin pagar (con nombres)
    const overdue90 = invoices.filter(i => { const d = Math.ceil((new Date().getTime() - new Date(i.due_date).getTime()) / 86400000); return i.balance > 0 && d > 90 && i.status !== 'cancelled'; });
    if (overdue90.length > 0) alerts.push({ type: 'critical', icon: '💰', title: `${overdue90.length} factura(s) con +90 días sin pagar`, description: `${overdue90.map(i => i.client?.company_name || 'N/A').filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(', ')} · Total: ${fmt(overdue90.reduce((s, i) => s + i.balance, 0))}`, link: '/finance' });
    if (overdueInvoices > 0) alerts.push({ type: 'warning', icon: '⚠️', title: `${overdueInvoices} factura(s) vencidas`, description: 'Cuentas por cobrar pendientes.', link: '/finance/invoices' });
    // Mantenimiento vencido (con detalles)
    const overdueSchList = (schedules.filter((s: { next_service_date: string }) => s.next_service_date < today) as unknown) as Array<{ title: string; assigned_to: string | null; equipment?: { name: string; well_name: string | null } | null }>;
    if (overdueSchList.length > 0) alerts.push({ type: 'warning', icon: '🔧', title: `${overdueSchList.length} mantenimiento(s) vencido(s)`, description: overdueSchList.slice(0, 3).map(s => `${s.title}${s.equipment?.well_name ? ' (' + s.equipment.well_name + ')' : ''}`).join(', '), link: '/maintenance' });

    // RECIENTES
    const recentInvoices = invoices.slice(0, 5).map(i => ({ id: i.id, invoice_number: i.invoice_number, total: i.total, status: i.status, client_name: i.client?.company_name || '—' }));
    const recentProjects = projects.slice(0, 5).map((p: { id: string; project_number: string; title: string; status: string; project_type: string }) => ({ id: p.id, project_number: p.project_number, title: p.title, status: p.status, project_type: p.project_type }));

    // TEAM STATS (from tasks)
    const teamNames = ['Samara', 'Paulina', 'Joel', 'Alejandro'];
    const teamStats = teamNames.map(name => {
      const assigned = tasks.filter((t: { assigned_to: string | null }) => t.assigned_to?.toLowerCase().includes(name.toLowerCase())).length;
      const completed = tasks.filter((t: { assigned_to: string | null; status: string }) => t.assigned_to?.toLowerCase().includes(name.toLowerCase()) && t.status === 'completed').length;
      return { name, assigned, completed };
    }).filter(t => t.assigned > 0);

    // TOP PROFITABLE PROJECTS
    const projExpMap: Record<string, number> = {};
    expenses.forEach((e: { project_id: string; amount: number }) => { projExpMap[e.project_id] = (projExpMap[e.project_id] || 0) + e.amount; });
    const projInvMap: Record<string, number> = {};
    invoices.forEach(i => { if (i.status !== 'cancelled') { /* we don't have project_id in this query, skip */ } });
    const topProjects = projects.slice(0, 5).map((p: { project_number: string; title: string; id: string }) => {
      const cost = projExpMap[p.id] || 0;
      const billed = 0; // Would need project-invoice join
      const margin = billed > 0 ? ((billed - cost) / billed) * 100 : 0;
      return { number: p.project_number, title: p.title, billed, cost, margin };
    });

    setData({
      totalQuotes, approvedQuotes, conversionRate, totalQuotedValue,
      totalClients, activeClients,
      activeProjects, delayedProjects, completedProjects, totalProjects,
      totalProducts, lowStockProducts, outOfStockProducts, inventoryValue,
      monthRevenue, totalAR, overdueInvoices, totalExpenses,
      totalEquipment, overdueSchedules, activeContracts, mrr,
      activeSpaces, pendingTasks,
      alerts, recentInvoices, recentProjects, teamStats, topProjects,
      geoClients, geoProjects,
    });
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading || !data) return <div className="flex flex-1 items-center justify-center p-8"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const kpis = [
    { label: 'Proyectos Activos', value: data.activeProjects.toString(), icon: 'engineering', color: 'from-sky-500 to-cyan-500', link: '/projects' },
    { label: 'Ingresos del Mes', value: fmt(data.monthRevenue), icon: 'payments', color: 'from-emerald-500 to-teal-500', link: '/finance' },
    { label: 'Cuentas por Cobrar', value: fmt(data.totalAR), icon: 'account_balance_wallet', color: 'from-amber-500 to-orange-500', link: '/finance/invoices' },
    { label: 'Valor Inventario', value: fmt(data.inventoryValue), icon: 'warehouse', color: 'from-violet-500 to-purple-500', link: '/inventory' },
  ];

  const statusColor: Record<string, string> = { draft: 'bg-slate-100 text-slate-600', sent: 'bg-sky-100 text-sky-700', partial: 'bg-amber-100 text-amber-700', paid: 'bg-emerald-100 text-emerald-700', overdue: 'bg-red-100 text-red-700', cancelled: 'bg-slate-100 text-slate-400', pending: 'bg-slate-100 text-slate-600', preparation: 'bg-sky-100 text-sky-700', in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-emerald-100 text-emerald-700', invoiced: 'bg-violet-100 text-violet-700' };
  const statusLabel: Record<string, string> = { draft: 'Borrador', sent: 'Enviada', partial: 'Parcial', paid: 'Pagada', overdue: 'Vencida', cancelled: 'Cancelada', pending: 'Pendiente', preparation: 'Preparación', in_progress: 'En Curso', completed: 'Completado', invoiced: 'Facturado' };

  const sectionClass = 'rounded-xl border border-slate-200/60 bg-white/50 p-6 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/50';

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Dashboard Ejecutivo</h2>
          <p className="mt-1 text-sm text-slate-500">Indicadores en tiempo real · {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowReportModal(true)} className="flex items-center gap-1 rounded-lg border border-primary bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 print:hidden" title="Exportar Reporte Ejecutivo">
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>Exportar PDF
          </button>
          <button onClick={fetchAll} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 print:hidden">
            <span className="material-symbols-outlined text-[16px]">refresh</span>Actualizar
          </button>
        </div>
      </div>



      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((a, i) => (
            <div key={i} onClick={() => navigate(a.link)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all hover:shadow-sm ${a.type === 'critical' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-900/10' : a.type === 'warning' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-900/10' : 'border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-900/10'}`}>
              <span className="text-lg">{a.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{a.title}</p>
                <p className="text-xs text-slate-500">{a.description}</p>
              </div>
              <span className="material-symbols-outlined text-slate-400 text-[18px]">chevron_right</span>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} onClick={() => navigate(k.link)}
            className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl transition-all hover:shadow-md hover:border-primary/30 dark:border-slate-800/60 dark:bg-slate-900/50">
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k.label}</p><p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{k.value}</p></div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${k.color} shadow-lg`}><span className="material-symbols-outlined text-white text-[24px]">{k.icon}</span></div>
            </div>
            <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${k.color} opacity-60`} />
          </div>
        ))}
      </div>

      {/* Operational Map */}
      {(() => {
        const mapPins: MapPin[] = [{ id: 'hq', lat: NUCLEO_HQ.lat, lng: NUCLEO_HQ.lng, title: 'Núcleo de Ingeniería', color: 'blue', label: 'N' }];
        data.geoClients.forEach(c => mapPins.push({ id: c.id, lat: c.latitude, lng: c.longitude, title: c.company_name, color: c.status === 'overdue' ? 'red' : 'green', info: c.status }));
        data.geoProjects.forEach(p => mapPins.push({ id: `p-${p.id}`, lat: p.latitude, lng: p.longitude, title: p.title, color: 'orange', info: p.status }));
        return mapPins.length > 1 ? (
          <div className={sectionClass}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <span className="material-symbols-outlined text-primary text-[18px]">map</span>Mapa de Control Operativo
              </h3>
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>HQ</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>Clientes</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-500"></span>Proyectos</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>Morosos</span>
              </div>
            </div>
            <GoogleMapView pins={mapPins} center={NUCLEO_HQ} zoom={9} height="350px" onPinClick={(p) => { if (p.id !== 'hq' && !p.id.startsWith('p-')) navigate(`/crm/${p.id}`); else if (p.id.startsWith('p-')) navigate(`/projects/${p.id.replace('p-', '')}`); }} />
          </div>
        ) : null;
      })()}

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Clientes', value: data.totalClients.toString(), sub: `${data.activeClients} activos`, color: 'text-primary' },
          { label: 'Cotizaciones', value: data.totalQuotes.toString(), sub: `${data.conversionRate.toFixed(0)}% conversión`, color: 'text-sky-500' },
          { label: 'Proy. Completados', value: data.completedProjects.toString(), sub: `de ${data.totalProjects}`, color: 'text-emerald-500' },
          { label: 'Stock Bajo', value: data.lowStockProducts.toString(), sub: `de ${data.totalProducts}`, color: 'text-amber-500' },
          { label: 'Equipos', value: data.totalEquipment.toString(), sub: `${data.overdueSchedules} mant. vencido`, color: 'text-violet-500' },
          { label: 'MRR Contratos', value: fmt(data.mrr), sub: `${data.activeContracts} activos`, color: 'text-primary' },
          { label: 'Spaces Activos', value: data.activeSpaces.toString(), sub: `${data.pendingTasks} tareas pend.`, color: 'text-rose-500' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
            <p className="text-xs text-slate-400">{k.label}</p>
            <p className={`mt-1 text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Invoices */}
        <div className={sectionClass}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">receipt_long</span>Facturas Recientes
            </h3>
            <button onClick={() => navigate('/finance/invoices')} className="text-xs text-primary font-semibold">Ver todas →</button>
          </div>
          {data.recentInvoices.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">Sin facturas</p> : (
            <div className="space-y-2">
              {data.recentInvoices.map(inv => (
                <div key={inv.id} onClick={() => navigate(`/finance/invoices/${inv.id}`)} className="flex items-center justify-between rounded-lg border border-slate-200/60 p-3 cursor-pointer hover:bg-slate-50/50 dark:border-slate-700/60">
                  <div>
                    <p className="font-mono text-xs font-bold text-primary">{inv.invoice_number}</p>
                    <p className="text-xs text-slate-400">{inv.client_name}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{fmt(inv.total)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor[inv.status] || ''}`}>{statusLabel[inv.status] || inv.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Projects */}
        <div className={sectionClass}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-[18px]">engineering</span>Proyectos Recientes
            </h3>
            <button onClick={() => navigate('/projects')} className="text-xs text-primary font-semibold">Ver todos →</button>
          </div>
          {data.recentProjects.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">Sin proyectos</p> : (
            <div className="space-y-2">
              {data.recentProjects.map(p => (
                <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="flex items-center justify-between rounded-lg border border-slate-200/60 p-3 cursor-pointer hover:bg-slate-50/50 dark:border-slate-700/60">
                  <div>
                    <p className="font-mono text-xs font-bold text-primary">{p.project_number}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[180px]">{p.title}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor[p.status] || ''}`}>{statusLabel[p.status] || p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Performance */}
        <div className={sectionClass}>
          <h3 className="mb-4 text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-violet-500 text-[18px]">group</span>Rendimiento del Equipo
          </h3>
          {data.teamStats.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">Sin datos de equipo</p> : (
            <div className="space-y-4">
              {data.teamStats.map(t => {
                const pct = t.assigned > 0 ? (t.completed / t.assigned) * 100 : 0;
                return (
                  <div key={t.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{t.name}</span>
                      <span className="text-slate-400">{t.completed}/{t.assigned} tareas · <span className={`font-bold ${pct >= 70 ? 'text-emerald-500' : pct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{pct.toFixed(0)}%</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Operational summary */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Resumen Financiero</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Cotizado Total</span>
                <span className="font-bold text-slate-900 dark:text-white">{fmt(data.totalQuotedValue)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Facturado Vencido</span>
                <span className="font-bold text-red-500">{data.overdueInvoices} facturas</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Gastos Reales</span>
                <span className="font-bold text-slate-900 dark:text-white">{fmt(data.totalExpenses)}</span>
              </div>
              <div className="flex justify-between text-xs border-t border-slate-200 dark:border-slate-700 pt-2">
                <span className="text-slate-500">Flujo Neto del Mes</span>
                <span className={`font-bold text-sm ${data.monthRevenue - data.totalExpenses >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(data.monthRevenue - data.totalExpenses)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">picture_as_pdf</span>
                Exportar Reporte Ejecutivo
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Selecciona el rango de fechas para generar el reporte consolidado. Esto no afectará la vista de tu Dashboard actual.
            </p>

            <div className="mb-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-500 uppercase">Períodos Predefinidos</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'this_month', label: 'Este Mes' },
                    { key: 'last_month', label: 'Mes Pasado' },
                    { key: 'last_3_months', label: 'Últimos 3 Meses' },
                    { key: 'last_6_months', label: 'Últimos 6 Meses' },
                    { key: 'this_year', label: 'Este Año' },
                    { key: 'all_time', label: 'Todo el Historial' },
                  ].map(p => (
                    <button key={p.key} onClick={() => applyReportPreset(p.key)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                        reportPreset === p.key
                          ? 'border-primary bg-primary/10 text-primary dark:border-primary/50'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-500 uppercase">Rango Personalizado</label>
                <div className="flex items-center gap-2">
                  <input type="date" value={reportFrom} onChange={e => { setReportFrom(e.target.value); setReportPreset('custom'); }}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/50 dark:text-white" />
                  <span className="text-xs text-slate-400">a</span>
                  <input type="date" value={reportTo} onChange={e => { setReportTo(e.target.value); setReportPreset('custom'); }}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/50 dark:text-white" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button 
                onClick={() => setShowReportModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button 
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-70"
              >
                {generatingReport ? (
                  <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Generando...</>
                ) : (
                  <><span className="material-symbols-outlined text-[18px]">download</span> Generar PDF</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
