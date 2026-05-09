import { useEffect, useMemo, useState } from 'react'
import { reportsApi } from '../../api/reports.api'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import MetricCard from '../../components/ui/MetricCard'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import TableSkeleton from '../../components/ui/TableSkeleton'
import { formatNumber, formatWeight, toNumber } from '../../utils/formatters'

const getMetricValue = (row = {}, keys = [], fallback = 0) => {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== null && value !== undefined && value !== '') {
      return value
    }
  }

  return fallback
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
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
        if (active) {
          setLoading(false)
          setHasLoadedOnce(true)
        }
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
  const showInitialLoading = loading && !hasLoadedOnce
  return (
    <div className="page-shell space-y-8">
      {/* Page header */}
      <PageHeader
        eyebrow="Operational Overview"
        title="Dashboard"
        description="Quick visibility into today’s gross, net, and recent operational movement."
      />

      {/* Error banner */}
      {error && (
        <div className="surface-card border-red-500/20 bg-red-500/10 text-primary flex items-center justify-between gap-4">
          <span className="font-medium">{error}</span>
          <button
            type="button"
            onClick={() => setRefreshToken((current) => current + 1)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none border border-red-500/20 bg-red-500/90 text-white shadow-lg shadow-red-500/20 hover:bg-red-400"
            aria-label="Retry loading dashboard summary"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoadingSpinner />
                Retrying...
              </>
            ) : (
              'Retry'
            )}
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Sales"
          value={showInitialLoading ? '' : formatNumber(totalSales)}
          loading={showInitialLoading}
        />
        <MetricCard
          title="Total Net Weight (g)"
          value={showInitialLoading ? '' : formatWeight(totalNetWeight)}
          loading={showInitialLoading}
        />
        <MetricCard
          title="Total Gross Weight (g)"
          value={showInitialLoading ? '' : formatWeight(toNumber(summary?.totalGrossWeight))}
          loading={showInitialLoading}
        />
      </section>

      {/* Supplier and salesman rankings */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Supplier ranking */}
        <SectionCard eyebrow="Suppliers" title="Top Suppliers">
          {showInitialLoading ? (
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
                    <th className="py-4 text-right">Gross Weight (g)</th>
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
                          {formatWeight(getMetricValue(row, ['grossWeight', 'totalGrossWeight'], 0))}
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
          {showInitialLoading ? (
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
                    <th className="py-4 text-right">Net Weight (g)</th>
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
                          {formatWeight(getMetricValue(row, ['netWeight', 'totalWeight'], 0))}
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
