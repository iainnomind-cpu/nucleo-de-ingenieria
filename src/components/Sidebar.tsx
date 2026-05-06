import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAuth } from '../lib/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSidebar } from '../lib/SidebarContext';

const navItems = [
  { label: 'Dashboard', icon: 'space_dashboard', path: '/dashboard', module: 'dashboard' },
  { label: 'CRM & Clientes', icon: 'people', path: '/crm', module: 'crm' },
  { label: 'Pipeline', icon: 'conversion_path', path: '/crm/pipeline', module: 'crm' },
  { label: 'Cotizaciones', icon: 'request_quote', path: '/quotes', module: 'quotes' },
  { label: 'Catálogo Servicios', icon: 'inventory_2', path: '/quotes/catalog', module: 'quotes' },
  { label: 'Proyectos', icon: 'engineering', path: '/projects', module: 'projects' },
  { label: 'Inventario', icon: 'warehouse', path: '/inventory', module: 'inventory' },
  { label: 'Mantenimiento', icon: 'build', path: '/maintenance', module: 'maintenance' },
  { label: 'Reparaciones', icon: 'construction', path: '/repairs', module: 'maintenance' },
  { label: 'Finanzas', icon: 'account_balance', path: '/finance', module: 'finance' },
  { label: 'Flotilla', icon: 'local_shipping', path: '/fleet', module: 'fleet' },
  { label: 'WhatsApp Mktg', icon: 'chat', path: '/whatsapp', module: 'whatsapp' },
  { label: 'Tablero de Tareas', icon: 'task', path: '/tasks', module: 'tasks' },
  { label: 'Chat de Equipo', icon: 'forum', path: '/team', module: 'team' },
  { label: 'Vacaciones y RH', icon: 'event_available', path: '/team/board', module: 'team' },
];

function Sidebar() {
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const { isOpen, close } = useSidebar();
  const [unreadWaCount, setUnreadWaCount] = useState(0);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    close();
  }, [location.pathname, close]);

  useEffect(() => {
    if (!user || !hasPermission('whatsapp', 'view')) return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('wa_conversations')
        .select('*', { count: 'exact', head: true })
        .gt('unread_count', 0);
      setUnreadWaCount(count || 0);
    };
    fetchUnread();

    const sub = supabase
      .channel('wa_unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations' }, fetchUnread)
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [user, hasPermission]);

  const visibleItems = navItems.filter(item => hasPermission(item.module, 'view'));

  const sidebarContent = (
    <aside className="flex h-full w-72 flex-col border-r border-slate-200 dark:border-slate-800 bg-surface-light dark:bg-surface-dark transition-colors duration-300">
      {/* Header */}
      <div className="shrink-0 p-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg shadow-primary/20">
            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain p-1" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold leading-tight text-slate-900 dark:text-white">
              Núcleo de<br />Ingeniería
            </h1>
          </div>
        </div>
        {/* Close button — only shown on mobile */}
        <button
          onClick={close}
          className="flex md:hidden items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Cerrar menú"
        >
          <span className="material-symbols-outlined text-[22px]">close</span>
        </button>
      </div>

      {/* Scrollable nav */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-2"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(148,163,184,0.3) transparent' }}
      >
        <nav className="flex flex-col gap-1">
          {visibleItems.map((item) => {
            const isActive =
              item.path === '/crm'
                ? location.pathname === '/crm'
                : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'group relative flex items-center gap-3 rounded-lg px-4 py-3 transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-content font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                )}
              >
                <span className="material-symbols-outlined relative text-[24px]">
                  {item.icon}
                  {item.module === 'whatsapp' && unreadWaCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900 shadow-sm" />
                  )}
                </span>
                <span className="text-sm">{item.label}</span>
                {item.module === 'whatsapp' && unreadWaCount > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                    {unreadWaCount}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="my-2 border-t border-slate-200 dark:border-slate-700" />

          {hasPermission('settings', 'view') && (
            <Link
              to="/settings"
              className={clsx(
                'group flex items-center gap-3 rounded-lg px-4 py-3 transition-all',
                location.pathname === '/settings'
                  ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-content font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              )}
            >
              <span className="material-symbols-outlined text-[24px]">settings</span>
              <span className="text-sm font-medium">Settings</span>
            </Link>
          )}
        </nav>
      </div>

      {/* User info + Logout */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-4">
        {user && (
          <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
              style={{ backgroundColor: user.avatar_color || '#6366f1' }}
            >
              {user.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {user.full_name}
              </p>
              <p className="truncate text-[11px] font-medium text-slate-400">
                {user.role_name || 'Sin rol'}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-slate-600 transition-all hover:bg-slate-100 hover:text-accent-danger dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400"
        >
          <span className="material-symbols-outlined text-[24px]">logout</span>
          <span className="text-sm font-medium">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* ── Desktop: always visible sidebar ── */}
      <div className="hidden md:flex h-screen flex-shrink-0">
        {sidebarContent}
      </div>

      {/* ── Mobile: slide-in drawer ── */}
      {/* Backdrop */}
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={close}
        aria-hidden="true"
      />
      {/* Drawer panel */}
      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex h-full transition-transform duration-300 ease-in-out md:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </div>
    </>
  );
}

export default Sidebar;
