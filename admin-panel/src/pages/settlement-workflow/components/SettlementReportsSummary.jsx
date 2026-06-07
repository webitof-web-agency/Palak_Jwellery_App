import MetricCard from '../../../components/ui/MetricCard'

const buildCards = (scope, summary = {}, formatWeight, formatCurrency, formatNumber) => {
  if (scope === 'session') {
    return [
      { title: 'Finalized Sessions', value: summary?.total_sessions, formatter: formatNumber },
      { title: 'Supplier Sections', value: summary?.total_sections, formatter: formatNumber },
      { title: 'Items', value: summary?.total_items, formatter: formatNumber },
      { title: 'Gross Weight', value: summary?.total_gross_weight, formatter: formatWeight },
      { title: 'Net Weight', value: summary?.total_net_weight, formatter: formatWeight },
      { title: 'Fine Weight', value: summary?.total_fine_weight, formatter: formatWeight },
    ]
  }

  if (scope === 'supplier-section') {
    return [
      { title: 'Finalized Sections', value: summary?.total_sections, formatter: formatNumber },
      { title: 'Sessions Represented', value: summary?.total_sessions, formatter: formatNumber },
      { title: 'Standalone Sections', value: summary?.total_standalone_sections, formatter: formatNumber },
      { title: 'Items', value: summary?.total_items, formatter: formatNumber },
      { title: 'Gross Weight', value: summary?.total_gross_weight, formatter: formatWeight },
      { title: 'Net Weight', value: summary?.total_net_weight, formatter: formatWeight },
      { title: 'Fine Weight', value: summary?.total_fine_weight, formatter: formatWeight },
    ]
  }

  return [
    { title: 'Finalized Rows', value: summary?.total_items, formatter: formatNumber },
    { title: 'Gross Weight', value: summary?.total_gross_weight, formatter: formatWeight },
    { title: 'Stone Weight', value: summary?.total_stone_weight, formatter: formatWeight },
    { title: 'Net Weight', value: summary?.total_net_weight, formatter: formatWeight },
    { title: 'Fine Weight', value: summary?.total_fine_weight, formatter: formatWeight },
    { title: 'Stone Amount', value: summary?.total_stone_amount, formatter: formatCurrency },
  ]
}

export default function SettlementReportsSummary({ scope = 'item-ledger', summary, loading, formatWeight, formatCurrency, formatNumber }) {
  const totals = buildCards(scope, summary, formatWeight, formatCurrency, formatNumber)

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
