import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useSidebar } from '../lib/SidebarContext';
import NotificationCenter from './NotificationCenter';

function Header() {
  const [now, setNow] = useState(new Date());
  const { user } = useAuth();
  const { toggle } = useSidebar();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = now.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedDateShort = now.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  });
  const formattedTime = now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <header className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-slate-200 bg-background-light/80 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-background-dark/80 sm:px-8 sm:py-5">
      {/* Left: hamburger (mobile) + date */}
      <div className="flex items-center gap-3">
        {/* Hamburger — only on mobile */}
        <button
          onClick={toggle}
          className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          aria-label="Abrir menú"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        {/* Date — full on desktop, compact on mobile */}
        <div className="flex flex-col gap-0.5">
          <h2 className="hidden sm:block text-xl font-bold text-slate-900 capitalize dark:text-white">
            {formattedDate}
          </h2>
          <h2 className="sm:hidden text-sm font-bold text-slate-900 capitalize dark:text-white">
            {formattedDateShort}
          </h2>
          <p className="text-xs font-medium text-slate-500">{formattedTime}</p>
        </div>
      </div>

      {/* Right: search + notifications + user */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Search — hidden on mobile to save space */}
        <div className="relative hidden sm:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            search
          </span>
          <input
            className="h-10 w-64 rounded-full border border-slate-200 bg-surface-light pl-10 pr-4 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-surface-dark dark:text-white dark:placeholder-slate-500"
            placeholder="Buscar proyectos, IDs..."
            type="text"
          />
        </div>

        {/* Notification Center */}
        <NotificationCenter />

        {/* User avatar */}
        {user && (
          <div className="flex items-center gap-2 sm:gap-3 rounded-full bg-surface-light pl-1 pr-2 sm:pr-4 py-1 shadow-sm dark:bg-surface-dark">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: user.avatar_color || '#6366f1' }}
            >
              {user.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="hidden sm:block text-sm font-semibold text-slate-700 dark:text-slate-200">
              {user.full_name}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
