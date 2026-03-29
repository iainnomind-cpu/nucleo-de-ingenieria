function KPICards() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <div className="group flex flex-col rounded-xl bg-surface-light p-6 shadow-sm ring-1 ring-slate-200/50 transition-all hover:shadow-md dark:bg-surface-dark dark:ring-slate-700">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
            <span className="material-symbols-outlined text-[24px]">
              engineering
            </span>
          </span>
          <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <span className="material-symbols-outlined text-[14px]">
              trending_up
            </span>
            2.4%
          </span>
        </div>
        <p className="text-sm font-medium text-text-muted">Active Projects</p>
        <h3 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">12</h3>
        <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
          <div className="h-1.5 w-[75%] rounded-full bg-primary" />
        </div>
      </div>

      <div className="group flex flex-col rounded-xl bg-surface-light p-6 shadow-sm ring-1 ring-slate-200/50 transition-all hover:shadow-md dark:bg-surface-dark dark:ring-slate-700">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
            <span className="material-symbols-outlined text-[24px]">
              attach_money
            </span>
          </span>
          <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
            <span className="material-symbols-outlined text-[14px]">
              trending_down
            </span>
            5.1%
          </span>
        </div>
        <p className="text-sm font-medium text-text-muted">Total Budget</p>
        <h3 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
          $2.4M
        </h3>
        <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
          <div className="h-1.5 w-[60%] rounded-full bg-emerald-500" />
        </div>
      </div>

      <div className="group flex flex-col rounded-xl bg-surface-light p-6 shadow-sm ring-1 ring-slate-200/50 transition-all hover:shadow-md dark:bg-surface-dark dark:ring-slate-700">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400">
            <span className="material-symbols-outlined text-[24px]">schedule</span>
          </span>
          <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <span className="material-symbols-outlined text-[14px]">
              trending_up
            </span>
            120h
          </span>
        </div>
        <p className="text-sm font-medium text-text-muted">Man-hours</p>
        <h3 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
          14,205
        </h3>
        <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
          <div className="h-1.5 w-[88%] rounded-full bg-cyan-500" />
        </div>
      </div>

      <div className="group flex flex-col rounded-xl bg-surface-light p-6 shadow-sm ring-1 ring-slate-200/50 transition-all hover:shadow-md dark:bg-surface-dark dark:ring-slate-700">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
            <span className="material-symbols-outlined text-[24px]">
              pending_actions
            </span>
          </span>
          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            3 Urgent
          </span>
        </div>
        <p className="text-sm font-medium text-text-muted">Pending Approvals</p>
        <h3 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">5</h3>
        <div className="mt-4 flex gap-1">
          <div className="h-1.5 w-1/5 rounded-full bg-amber-500" />
          <div className="h-1.5 w-1/5 rounded-full bg-amber-500" />
          <div className="h-1.5 w-1/5 rounded-full bg-amber-500" />
          <div className="h-1.5 w-1/5 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="h-1.5 w-1/5 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    </div>
  );
}

export default KPICards;
