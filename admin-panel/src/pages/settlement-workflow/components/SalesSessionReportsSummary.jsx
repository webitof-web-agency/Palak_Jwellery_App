import MetricCard from '../../../components/ui/MetricCard'

const buildCards = (summary = {}, formatWeight, formatNumber) => ([
  { title: 'Total Sessions', value: summary?.totalSessions, formatter: formatNumber },
  { title: 'Total Items', value: summary?.totalItems, formatter: formatNumber },
  { title: 'Gross', value: summary?.grossWeight, formatter: formatWeight },
  { title: 'Net', value: summary?.netWeight, formatter: formatWeight },
  { title: 'Fine', value: summary?.fineWeight, formatter: formatWeight },
  { title: 'Warnings', value: summary?.warningsCount, formatter: formatNumber },
])

export default function SalesSessionReportsSummary({
  summary,
  loading,
  formatWeight,
  formatNumber,
}) {
  const cards = buildCards(summary, formatWeight, formatNumber)

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((metric) => (
        <MetricCard
          key={metric.title}
          title={metric.title}
          value={loading ? '' : metric.formatter(metric.value)}
          loading={loading}
        />
      ))}
    </section>
  )
}
