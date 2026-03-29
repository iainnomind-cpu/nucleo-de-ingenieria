function ResourceAllocation() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="rounded-xl bg-surface-light p-6 shadow-sm ring-1 ring-slate-200/50 dark:bg-surface-dark dark:ring-slate-700">
        <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
          Resource Allocation
        </h3>
        <div className="mb-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900 dark:text-white">92%</span>
          <span className="text-sm text-text-muted">Utilized</span>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-700 dark:text-slate-300">
                Mechanical Dept
              </span>
              <span className="text-slate-500">95%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div className="h-full w-[95%] rounded-full bg-primary" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-700 dark:text-slate-300">
                Electrical Dept
              </span>
              <span className="text-slate-500">88%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div className="h-full w-[88%] rounded-full bg-purple-500" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-700 dark:text-slate-300">Software Dept</span>
              <span className="text-slate-500">75%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div className="h-full w-[75%] rounded-full bg-cyan-400" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-700 dark:text-slate-300">
                Civil Engineering
              </span>
              <span className="text-slate-500">42%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div className="h-full w-[42%] rounded-full bg-slate-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-1 flex-col justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark p-6 text-white shadow-lg">
          <div className="mb-2 flex items-center gap-2 opacity-80">
            <span className="material-symbols-outlined">verified_user</span>
            <span className="text-xs font-bold uppercase tracking-wider">
              Safety Status
            </span>
          </div>
          <h3 className="text-2xl font-bold">450 Days</h3>
          <p className="text-sm opacity-90">Without lost time injury</p>
        </div>
        <div className="flex flex-1 flex-col rounded-xl bg-surface-light p-6 shadow-sm ring-1 ring-slate-200/50 dark:bg-surface-dark dark:ring-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <span className="material-symbols-outlined">warning</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Material Delay
              </h4>
              <p className="text-xs text-text-muted">Steel shipment +3 days late</p>
            </div>
          </div>
          <button className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
            View Logistics
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResourceAllocation;
