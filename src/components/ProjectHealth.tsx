function ProjectHealth() {
  return (
    <div className="rounded-xl bg-surface-light p-6 shadow-sm ring-1 ring-slate-200/50 dark:bg-surface-dark dark:ring-slate-700">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Project Health
          </h3>
          <p className="text-sm text-text-muted">
            Progress vs Schedule (Year to Date)
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
          <button className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-900 dark:bg-slate-700 dark:text-white">
            YTD
          </button>
          <button className="rounded-md px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            6M
          </button>
          <button className="rounded-md px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            1M
          </button>
        </div>
      </div>
      <div className="flex items-end gap-2 pb-4">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
          On Track
        </h2>
        <span className="mb-1 text-sm font-medium text-accent-success">
          +5% efficiency this quarter
        </span>
      </div>
      <div className="relative h-64 w-full">
        <div className="absolute inset-0 flex flex-col justify-between text-xs text-slate-400">
          <div className="border-b border-dashed border-slate-200 pb-2 dark:border-slate-700">
            100%
          </div>
          <div className="border-b border-dashed border-slate-200 pb-2 dark:border-slate-700">
            75%
          </div>
          <div className="border-b border-dashed border-slate-200 pb-2 dark:border-slate-700">
            50%
          </div>
          <div className="border-b border-dashed border-slate-200 pb-2 dark:border-slate-700">
            25%
          </div>
          <div className="border-b border-slate-200 pb-2 dark:border-slate-700">0%</div>
        </div>
        <svg
          className="absolute inset-0 h-full w-full pt-4"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#13b6ec" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#13b6ec" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            className="opacity-50 dark:stroke-slate-600"
            d="M0,80 Q10,75 20,60 T40,55 T60,40 T80,30 T100,20"
            fill="none"
            stroke="#e2e8f0"
            strokeDasharray="2 2"
            strokeWidth="0.5"
          />
          <path
            d="M0,85 Q10,80 20,65 T40,50 T60,45 T80,25 T100,15 L100,100 L0,100 Z"
            fill="url(#chartGradient)"
          />
          <path
            d="M0,85 Q10,80 20,65 T40,50 T60,45 T80,25 T100,15"
            fill="none"
            stroke="#13b6ec"
            strokeLinecap="round"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            className="dark:stroke-surface-dark"
            cx="20"
            cy="65"
            fill="#13b6ec"
            r="1.5"
            stroke="white"
            strokeWidth="0.5"
          />
          <circle
            className="dark:stroke-surface-dark"
            cx="40"
            cy="50"
            fill="#13b6ec"
            r="1.5"
            stroke="white"
            strokeWidth="0.5"
          />
          <circle
            className="dark:stroke-surface-dark"
            cx="60"
            cy="45"
            fill="#13b6ec"
            r="1.5"
            stroke="white"
            strokeWidth="0.5"
          />
          <circle
            className="dark:stroke-surface-dark"
            cx="80"
            cy="25"
            fill="#13b6ec"
            r="1.5"
            stroke="white"
            strokeWidth="0.5"
          />
          <g transform="translate(75, 5)">
            <rect
              className="dark:fill-white"
              fill="#101d22"
              height="10"
              rx="2"
              width="20"
              x="0"
              y="0"
            />
            <text
              className="dark:fill-background-dark font-bold"
              fill="white"
              fontSize="4"
              textAnchor="middle"
              x="10"
              y="7"
            >
              88%
            </text>
          </g>
        </svg>
      </div>
      <div className="mt-2 flex justify-between px-2 text-xs font-medium text-text-muted">
        <span>Jan</span>
        <span>Feb</span>
        <span>Mar</span>
        <span>Apr</span>
        <span>May</span>
        <span>Jun</span>
      </div>
    </div>
  );
}

export default ProjectHealth;
