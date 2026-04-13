import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Login from './pages/Auth/Login';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import ClientsList from './pages/CRM/ClientsList';
import ClientDetail from './pages/CRM/ClientDetail/ClientDetail';
import PipelineBoard from './pages/CRM/Pipeline/PipelineBoard';
import QuotesList from './pages/Quotes/QuotesList';
import QuoteBuilder from './pages/Quotes/QuoteBuilder';
import QuoteDetail from './pages/Quotes/QuoteDetail';
import ServiceCatalog from './pages/Quotes/ServiceCatalog';
import ProjectsList from './pages/Projects/ProjectsList';
import ProjectDetail from './pages/Projects/ProjectDetail/ProjectDetail';
import InventoryList from './pages/Inventory/InventoryList';
import PurchaseList from './pages/Inventory/PurchaseList';
import ConsumptionReport from './pages/Inventory/ConsumptionReport';
import MaintenanceDashboard from './pages/Maintenance/MaintenanceDashboard';
import EquipmentDetail from './pages/Maintenance/EquipmentDetail/EquipmentDetail';
import ContractsList from './pages/Maintenance/ContractsList';
import FinanceDashboard from './pages/Finance/FinanceDashboard';
import InvoicesList from './pages/Finance/InvoicesList';
import InvoiceDetail from './pages/Finance/InvoiceDetail/InvoiceDetail';
import FieldExpenses from './pages/Finance/FieldExpenses';
import VehiclesList from './pages/Fleet/VehiclesList';
import VehicleDetail from './pages/Fleet/VehicleDetail/VehicleDetail';
import SpaceChat from './pages/Team/SpaceChat';
import TeamBoard from './pages/Team/TeamBoard';
import Inbox from './pages/Team/Inbox';
import WhatsAppDashboard from './pages/WhatsApp/WhatsAppDashboard';
import ConversationsInbox from './pages/WhatsApp/ConversationsInbox';
import CampaignsList from './pages/WhatsApp/CampaignsList';
import TemplatesList from './pages/WhatsApp/TemplatesList';
import WhatsAppReports from './pages/WhatsApp/WhatsAppReports';
import DirectSend from './pages/WhatsApp/DirectSend';
import SystemSettings from './pages/Settings/SystemSettings';
import NotificationListener from './components/NotificationListener';
import ClientWellLogPublic from './pages/Maintenance/ClientWellLogPublic';
import RepairsDashboard from './pages/Repairs/RepairsDashboard';
import RepairDetail from './pages/Repairs/RepairDetail';

function ProtectedApp() {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar />
      <NotificationListener />
      <main className="flex flex-1 flex-col overflow-y-auto bg-background-light dark:bg-background-dark">
        <Header />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {/* M1: CRM */}
          {hasPermission('crm', 'view') && (
            <>
              <Route path="/crm" element={<ClientsList />} />
              <Route path="/crm/pipeline" element={<PipelineBoard />} />
              <Route path="/crm/:id" element={<ClientDetail />} />
            </>
          )}
          {/* M2: Cotizador */}
          {hasPermission('quotes', 'view') && (
            <>
              <Route path="/quotes" element={<QuotesList />} />
              <Route path="/quotes/new" element={<QuoteBuilder />} />
              <Route path="/quotes/catalog" element={<ServiceCatalog />} />
              <Route path="/quotes/:id" element={<QuoteDetail />} />
            </>
          )}
          {/* M3: Proyectos */}
          {hasPermission('projects', 'view') && (
            <>
              <Route path="/projects" element={<ProjectsList />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
            </>
          )}
          {/* M4: Inventario */}
          {hasPermission('inventory', 'view') && (
            <>
              <Route path="/inventory" element={<InventoryList />} />
              <Route path="/inventory/purchases" element={<PurchaseList />} />
              <Route path="/inventory/consumption" element={<ConsumptionReport />} />
            </>
          )}
          {/* M5: Mantenimiento */}
          {hasPermission('maintenance', 'view') && (
            <>
              <Route path="/maintenance" element={<MaintenanceDashboard />} />
              <Route path="/maintenance/equipment/:id" element={<EquipmentDetail />} />
              <Route path="/maintenance/contracts" element={<ContractsList />} />
            </>
          )}
          {/* Reparaciones */}
          {hasPermission('maintenance', 'view') && (
            <>
              <Route path="/repairs" element={<RepairsDashboard />} />
              <Route path="/repairs/:id" element={<RepairDetail />} />
            </>
          )}
          {/* M6: Finanzas */}
          {hasPermission('finance', 'view') && (
            <>
              <Route path="/finance" element={<FinanceDashboard />} />
              <Route path="/finance/invoices" element={<InvoicesList />} />
              <Route path="/finance/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/finance/viaticos" element={<FieldExpenses />} />
            </>
          )}
          {/* Flotilla */}
          {hasPermission('fleet', 'view') && (
            <>
              <Route path="/fleet" element={<VehiclesList />} />
              <Route path="/fleet/:id" element={<VehicleDetail />} />
            </>
          )}
          {/* M8: Equipos & Comunicación */}
          {hasPermission('team', 'view') && (
            <>
              <Route path="/team" element={<SpaceChat />} />
              <Route path="/team/space/:spaceId" element={<SpaceChat />} />
              <Route path="/team/board" element={<TeamBoard />} />
              <Route path="/team/inbox" element={<Inbox />} />
            </>
          )}
          {/* M9: WhatsApp Marketing */}
          {hasPermission('whatsapp', 'view') && (
            <>
              <Route path="/whatsapp" element={<WhatsAppDashboard />} />
              <Route path="/whatsapp/conversations" element={<ConversationsInbox />} />
              <Route path="/whatsapp/campaigns" element={<CampaignsList />} />
              <Route path="/whatsapp/send" element={<DirectSend />} />
              <Route path="/whatsapp/templates" element={<TemplatesList />} />
              <Route path="/whatsapp/reports" element={<WhatsAppReports />} />
            </>
          )}
          {/* Configuración del Sistema */}
          {hasPermission('settings', 'view') && (
            <Route path="/settings" element={<SystemSettings />} />
          )}
          {/* Catch-all: redirigir a dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public route — no auth required */}
        <Route path="/well-log/:token" element={<ClientWellLogPublic />} />
        {/* All other routes go through auth */}
        <Route path="*" element={<AuthProvider><ProtectedApp /></AuthProvider>} />
      </Routes>
    </Router>
  );
}

export default App;
