import { useEffect, useMemo, useState } from 'react'
import { reportsApi } from '../../api/reports.api'
import EmptyState from '../../components/ui/EmptyState'
import MetricCard from '../../components/ui/MetricCard'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import TableSkeleton from '../../components/ui/TableSkeleton'
import { formatCurrency, formatNumber, formatWeight, toNumber } from '../../utils/formatters'

const getMetricValue = (row = {}, keys = [], fallback = 0) => {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== null && value !== undefined && value !== '') {
      return value
    }
  }

  return fallback
}

const formatRevenue = (value) => formatCurrency(value)

export default function DashboardPage() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let active = true

    const loadSummary = async () => {
      setLoading(true)
      setError('')

      try {
        const to = new Date()
        const from = new Date()
        from.setDate(from.getDate() - 29)

        const toDateStr = (date) => date.toISOString().split('T')[0]
        const response = await reportsApi.getAdminSummary({
          from: toDateStr(from),
          to: toDateStr(to),
        })

        if (!active) return
        setSummary(response?.data ?? null)
      } catch (err) {
        if (!active) return
        setError(err?.error || err?.message || 'Failed to load dashboard summary.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadSummary()

    return () => {
      active = false
    }
  }, [refreshToken])

  const supplierRows = useMemo(
    () => (Array.isArray(summary?.bySupplier) ? summary.bySupplier : []),
    [summary],
  )
  const salesmanRows = useMemo(
    () => (Array.isArray(summary?.bySalesman) ? summary.bySalesman : []),
    [summary],
  )

  const totalSales = toNumber(summary?.totalSales)
  const totalNetWeight = toNumber(summary?.totalNetWeight)
  const totalRevenue = toNumber(summary?.totalRevenue)

  return (
    <div className="page-shell space-y-8">
      {/* Page header */}
      <PageHeader
        eyebrow="Business Overview"
        title="Dashboard"
        description="Revenue, movement, and top-performing partners."
      />

      {/* Error banner */}
      {error && (
        <div className="surface-card border-red-500/20 bg-red-500/10 text-red-200 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRefreshToken((current) => current + 1)}
            className="primary-luxury-button bg-red-500 text-white hover:bg-red-400"
            aria-label="Retry loading dashboard summary"
          >
            Retry
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Sales"
          value={loading ? '' : formatNumber(totalSales)}
          loading={loading}
        />
        <MetricCard
          title="Total Net Weight (g)"
          value={loading ? '' : formatWeight(totalNetWeight)}
          loading={loading}
        />
        <MetricCard
          title="Total Revenue"
          value={loading ? '' : formatRevenue(totalRevenue)}
          loading={loading}
        />
      </section>

      {/* Supplier and salesman rankings */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Supplier ranking */}
        <SectionCard eyebrow="Suppliers" title="Top Suppliers">
          {loading ? (
            <TableSkeleton columns={4} rows={4} />
          ) : supplierRows.length === 0 ? (
            <EmptyState
              title="No supplier summary yet"
              description="Once sales are recorded, supplier performance will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.18em] text-muted border-b border-white/10">
                    <th className="py-4 pr-4">Name</th>
                    <th className="py-4 pr-4">Sales Count</th>
                    <th className="py-4 pr-4">Net Weight (g)</th>
                    <th className="py-4 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {supplierRows.map((row, index) => {
                    const name = row?.name || 'Unknown'

                    return (
                      <tr key={`${name}-${index}`} className="hover:bg-white/5">
                        <td className="py-4 pr-4 font-medium text-primary">{name}</td>
                        <td className="py-4 pr-4 text-muted">
                          {formatNumber(getMetricValue(row, ['salesCount', 'count'], 0))}
                        </td>
                        <td className="py-4 pr-4 text-muted">
                          {formatWeight(getMetricValue(row, ['netWeight', 'totalWeight'], 0))}
                        </td>
                        <td className="py-4 text-right font-semibold text-gold-500">
                          {formatRevenue(getMetricValue(row, ['revenue', 'totalRevenue'], 0))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Salesman ranking */}
        <SectionCard eyebrow="Salesmen" title="Top Salesmen">
          {loading ? (
            <TableSkeleton columns={3} rows={4} />
          ) : salesmanRows.length === 0 ? (
            <EmptyState
              title="No salesman summary yet"
              description="Salesman performance will populate after sales are saved."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.18em] text-muted border-b border-white/10">
                    <th className="py-4 pr-4">Name</th>
                    <th className="py-4 pr-4">Sales Count</th>
                    <th className="py-4 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {salesmanRows.map((row, index) => {
                    const name = row?.name || 'Unknown'

                    return (
                      <tr key={`${name}-${index}`} className="hover:bg-white/5">
                        <td className="py-4 pr-4 font-medium text-primary">{name}</td>
                        <td className="py-4 pr-4 text-muted">
                          {formatNumber(getMetricValue(row, ['salesCount', 'count'], 0))}
                        </td>
                        <td className="py-4 text-right font-semibold text-gold-500">
                          {formatRevenue(getMetricValue(row, ['revenue', 'totalRevenue'], 0))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </section>
    </div>
  )
}
