import MetricCard from '../../../components/ui/MetricCard'

export default function SettlementReportsSummary({ summary, loading, formatWeight, formatCurrency, formatNumber }) {
  const totals = [
    { title: 'Finalized Rows', value: summary?.total_items, formatter: formatNumber },
    { title: 'Gross Weight', value: summary?.total_gross_weight, formatter: formatWeight },
    { title: 'Net Weight', value: summary?.total_net_weight, formatter: formatWeight },
    { title: 'Fine Weight', value: summary?.total_fine_weight, formatter: formatWeight },
    { title: 'Stone Amount', value: summary?.total_stone_amount, formatter: formatCurrency },
  ]

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {totals.map((metric) => (
          <MetricCard
            key={metric.title}
            title={metric.title}
            value={loading ? '' : metric.formatter(metric.value)}
            loading={loading}
          />
        ))}
      </section>
    </div>
  )
}
