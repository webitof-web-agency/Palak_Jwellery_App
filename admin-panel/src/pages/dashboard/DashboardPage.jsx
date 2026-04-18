import { useEffect, useMemo, useState } from 'react'
import { reportsApi } from '../../api/reports.api'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
})

const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
})

const getMetricValue = (row = {}, keys = [], fallback = 0) => {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== null && value !== undefined && value !== '') {
      return value
    }
  }

  return fallback
}

const toNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const formatWeight = (value) => numberFormatter.format(toNumber(value))
const formatRevenue = (value) => currencyFormatter.format(toNumber(value))

const MetricCard = ({ title, value, loading }) => (
  <div className="glass-panel p-6 min-h-[132px] flex flex-col justify-between">
    <div className="flex items-start justify-between gap-4">
      <span className="eyebrow mb-0">{title}</span>
      <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10" />
    </div>
    {loading ? (
      <div className="mt-4 space-y-3">
        <div className="h-9 w-3/5 rounded-lg bg-white/10 animate-pulse" />
        <div className="h-4 w-1/3 rounded-lg bg-white/5 animate-pulse" />
      </div>
    ) : (
      <div className="mt-4 text-3xl font-bold text-white tracking-tight font-display break-words">
        {value}
      </div>
    )}
  </div>
)

const TableSkeleton = ({ columns = 4, rows = 4 }) => (
  <div className="space-y-3">
    {[...Array(rows)].map((_, rowIndex) => (
      <div
        key={rowIndex}
        className={`grid gap-3 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}
      >
        {[...Array(columns)].map((__, columnIndex) => (
          <div key={columnIndex} className="h-4 rounded bg-white/10 animate-pulse" />
        ))}
      </div>
    ))}
  </div>
)

const EmptyState = ({ title, description }) => (
  <div className="py-16 text-center">
    <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
      •
    </div>
    <div className="text-lg font-semibold text-white/80">{title}</div>
    <p className="mt-2 text-sm text-white/40">{description}</p>
  </div>
)

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

        // Backend expects YYYY-MM-DD — toISOString() gives full timestamp which breaks getISTRange
        const toDateStr = (d) => d.toISOString().split('T')[0]
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
      <header className="page-hero">
        <div>
          <span className="eyebrow">Business Overview</span>
          <h1 className="text-4xl font-bold font-display gold-gradient-text tracking-tight">Dashboard</h1>
          <p className="mt-2 text-white/40">Revenue, movement, and top-performing partners.</p>
        </div>
      </header>

      {error && (
        <div className="surface-card border-red-500/20 bg-red-500/10 text-red-200 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRefreshToken((current) => current + 1)}
            className="primary-luxury-button bg-red-500 text-white hover:bg-red-400"
          >
            Retry
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Sales"
          value={loading ? '' : numberFormatter.format(totalSales)}
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

      <section className="surface-card">
        <div className="surface-card__header">
          <div>
            <span className="eyebrow">Suppliers</span>
            <h2 className="text-xl font-bold font-display">Top Suppliers</h2>
          </div>
        </div>

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
                <tr className="text-[10px] uppercase tracking-[0.18em] text-white/30 border-b border-white/10">
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
                      <td className="py-4 pr-4 font-medium text-white/85">{name}</td>
                      <td className="py-4 pr-4 text-white/60">
                        {numberFormatter.format(toNumber(getMetricValue(row, ['salesCount', 'count'], 0)))}
                      </td>
                      <td className="py-4 pr-4 text-white/60">
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
      </section>

      <section className="surface-card">
        <div className="surface-card__header">
          <div>
            <span className="eyebrow">Salesmen</span>
            <h2 className="text-xl font-bold font-display">Top Salesmen</h2>
          </div>
        </div>

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
                <tr className="text-[10px] uppercase tracking-[0.18em] text-white/30 border-b border-white/10">
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
                      <td className="py-4 pr-4 font-medium text-white/85">{name}</td>
                      <td className="py-4 pr-4 text-white/60">
                        {numberFormatter.format(toNumber(getMetricValue(row, ['salesCount', 'count'], 0)))}
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
      </section>
    </div>
  )
}
