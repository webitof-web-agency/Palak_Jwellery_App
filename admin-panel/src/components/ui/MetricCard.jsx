const MetricGlyph = ({ title }) => {
  const normalized = String(title || '').toLowerCase()

  if (normalized.includes('sales')) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
        <path d="M5 17V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9 17V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M13 17V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17 17V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M4 18.5h16"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.45"
        />
      </svg>
    )
  }

  if (normalized.includes('weight')) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
        <path
          d="M9.5 6.5a2.5 2.5 0 1 1 5 0v1.25h2.25a2 2 0 0 1 2 2v7.25a2 2 0 0 1-2 2H7.25a2 2 0 0 1-2-2V9.75a2 2 0 0 1 2-2H9.5V6.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 12h5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M12 4.5 14.9 9.8 20.8 10.6 16.6 14.6 17.6 20.4 12 17.3 6.4 20.4 7.4 14.6 3.2 10.6 9.1 9.8 12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function MetricCard({ title, value, loading }) {
  return (
    <div className="glass-panel p-6 min-h-[132px] flex flex-col justify-between">
      <div className="flex items-start justify-between gap-4">
        <span className="eyebrow mb-0">{title}</span>
        <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-heading">
          <MetricGlyph title={title} />
        </div>
      </div>
      {loading ? (
        <div className="mt-4 space-y-3">
          <div className="skeleton-line h-9 w-3/5" />
          <div className="skeleton-line h-4 w-1/3" />
        </div>
      ) : (
        <div className="mt-4 text-3xl font-bold text-heading tracking-tight font-display break-words">
          {value}
        </div>
      )}
    </div>
  );
}
