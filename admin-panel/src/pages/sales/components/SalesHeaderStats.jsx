const StatCard = ({ label, value, hint }) => (
  <div className="surface-panel-soft rounded-2xl !p-4 mb-0 min-w-[160px] border border-[rgba(92,70,56,0.22)] hover:border-gold-600/30 transition-colors duration-200">
    <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
      {label}
    </div>
    <div className="mt-2 text-2xl font-bold text-heading">{value}</div>
    <div className="mt-1 text-sm text-muted">{hint}</div>
  </div>
)

export default function SalesHeaderStats({
  total,
  activeFilterCount,
  limit,
  formatNumber,
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard
        label="Results"
        value={formatNumber(total)}
        hint="Matching sales records"
      />
      <StatCard
        label="Active Filters"
        value={activeFilterCount}
        hint="Applied search controls"
      />
      <StatCard label="Page Size" value={limit} hint="Rows per page" />
    </div>
  )
}
