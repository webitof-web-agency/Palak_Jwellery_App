import MetricCard from '../../../components/ui/MetricCard'

export default function ExceptionsStats({
  summary,
  visibleCount,
  loading,
  formatNumber,
}) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
      <MetricCard title="Visible Rows" value={loading ? '' : formatNumber(visibleCount)} loading={loading} />
      <MetricCard title="Total Items" value={loading ? '' : formatNumber(summary?.total_items)} loading={loading} />
      <MetricCard title="Approved" value={loading ? '' : formatNumber(summary?.approved_count)} loading={loading} />
      <MetricCard title="Requires Verification" value={loading ? '' : formatNumber(summary?.needs_review_count)} loading={loading} />
      <MetricCard title="Settlement Complete" value={loading ? '' : formatNumber(summary?.complete_valuation_count)} loading={loading} />
      <MetricCard title="Supplier Only" value={loading ? '' : formatNumber(summary?.supplier_only_count)} loading={loading} />
    </section>
  )
}
