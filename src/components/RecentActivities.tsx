function RecentActivities() {
  return (
    <div className="flex h-full flex-col rounded-xl bg-surface-light p-6 shadow-sm ring-1 ring-slate-200/50 dark:bg-surface-dark dark:ring-slate-700">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Recent Activities
        </h3>
        <button className="text-xs font-medium text-primary hover:text-primary-dark">
          View All
        </button>
      </div>
      <div className="flex flex-col gap-6">
        <div className="relative flex gap-4 pl-4 before:absolute before:bottom-0 before:left-[5px] before:top-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-700">
          <div className="absolute left-0 top-1 h-3 w-3 rounded-full border-2 border-white bg-primary dark:border-surface-dark" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Blueprint V2.4 Approved
            </p>
            <p className="text-xs text-text-muted">
              Project Alpha-X • <span className="text-slate-400">2h ago</span>
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-background-dark">
              <span className="material-symbols-outlined text-blue-500">
                description
              </span>
              <span className="truncate text-xs text-slate-600 dark:text-slate-300">
                structural_layout_final.pdf
              </span>
            </div>
          </div>
        </div>

        <div className="relative flex gap-4 pl-4 before:absolute before:bottom-0 before:left-[5px] before:top-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-700">
          <div className="absolute left-0 top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-surface-dark" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Phase 3 Milestone Completed
            </p>
            <p className="text-xs text-text-muted">
              Hydraulic System • <span className="text-slate-400">5h ago</span>
            </p>
            <div className="mt-1 flex -space-x-2 overflow-hidden">
              <img
                alt="Team member"
                className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-surface-dark"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBQ_gg4o061p1_VkY2Bqw131-YQ_ffo19Pylv7iwBeXuuk1_XwUKdBynbYwaVcZl9IroVG0gLquoPAFuA_PYJqAZoNNl5_-6DPGFbQqt5AieTAPvAEPLBe27bgDL1fWJkby2_sxCXZUKwkXBDIFkBBcOTJp35Vhe4wzcWeO_uUPdrgPk5iFUyuDZ9wVrp8OMyWA22q5WwL3qdTv9kPn0_dweTYM0hODAM9siNBwt2aeI1MaXKahNsb_PWFqZabGl8VqN6DB79E0DgwT"
              />
              <img
                alt="Team member"
                className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-surface-dark"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB1hYvIfRifSsDJsVjjK9To7oyjr0JmNRbq6ddAOH1d8bvBpnxMVl1rZRYR5MGvqgEisRTh5T31KCoDC42uGBMnGV58ZhVEl2rjHfeG9xvWhiNun20amuL1t-IkCRlX8N8aumFpdZw-EMQ-3VHfD7_DiZ5B2ykKI9zEbo2KYVIb-IxoAUDe9y_DkY_OdrJWH3FKMWW8GlZ9vudQtUrF_sDgytdBcGjfPoLLPdEtUzKXCVHvBuV1jVIAiCQexBeEsyLhcfNnZWzB6Xrt"
              />
            </div>
          </div>
        </div>

        <div className="relative flex gap-4 pl-4 before:absolute before:bottom-0 before:left-[5px] before:top-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-700">
          <div className="absolute left-0 top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-500 dark:border-surface-dark" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Budget Variance Alert
            </p>
            <p className="text-xs text-text-muted">
              Procurement • <span className="text-slate-400">Yesterday</span>
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Cost overrun on steel beam acquisition requires manager approval.
            </p>
          </div>
        </div>

        <div className="relative flex gap-4 pl-4">
          <div className="absolute left-0 top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-400 dark:border-surface-dark" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              New Resource Assigned
            </p>
            <p className="text-xs text-text-muted">
              Project Delta • <span className="text-slate-400">Yesterday</span>
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Software
              </span>
              <span className="text-xs text-slate-500">Sarah Jenkins joined the team</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-auto pt-6">
        <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary/10 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20">
          <span className="material-symbols-outlined text-[18px]">add_task</span>
          Add New Activity
        </button>
      </div>
    </div>
  );
}

export default RecentActivities;
