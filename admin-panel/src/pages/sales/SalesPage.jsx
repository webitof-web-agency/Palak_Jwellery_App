import { useEffect, useMemo, useState } from 'react'
import { salesApi } from '../../api/sales.api'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatWeight,
} from '../../utils/formatters'

const sortOptions = [
  { value: 'saleDate:desc', label: 'Date newest first' },
  { value: 'saleDate:asc', label: 'Date oldest first' },
  { value: 'totalValue:desc', label: 'Total high to low' },
  { value: 'totalValue:asc', label: 'Total low to high' },
  { value: 'netWeight:desc', label: 'Net weight high to low' },
  { value: 'netWeight:asc', label: 'Net weight low to high' },
]

const getName = (value) => {
  if (!value) return 'Unknown'
  if (typeof value === 'string') return value
  if (typeof value === 'object') return value.name || value.title || 'Unknown'
  return String(value)
}

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

const LoadingRows = () => (
  <tbody className="divide-y divide-white/5">
    {[...Array(6)].map((_, rowIndex) => (
      <tr key={rowIndex}>
        {[...Array(9)].map((__, cellIndex) => (
          <td key={cellIndex} className="px-5 py-4">
            <div className="h-4 rounded bg-white/10 animate-pulse" />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
)

export default function SalesPage() {
  const [sales, setSales] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [filters, setFilters] = useState({
    salesman: '',
    supplier: '',
    startDate: '',
    endDate: '',
    sort: 'saleDate:desc',
  })

  const limit = 10
  const [sortBy, sortOrder] = filters.sort.split(':')

  useEffect(() => {
    let active = true

    const loadSales = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await salesApi.listSales({
          page,
          limit,
          salesman: filters.salesman.trim(),
          supplier: filters.supplier.trim(),
          startDate: filters.startDate,
          endDate: filters.endDate,
          sortBy,
          sortOrder,
        })

        if (!active) return

        const data = response?.data || {}
        setSales(Array.isArray(data.sales) ? data.sales : [])
        setTotal(Number(data.total) || 0)
        setPages(Number(data.pages) || 1)
        setPage(Number(data.page) || page)
      } catch (err) {
        if (!active) return
        setError(err?.error || err?.message || 'Failed to load sales.')
        setSales([])
        setTotal(0)
        setPages(1)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadSales()

    return () => {
      active = false
    }
  }, [filters, page, refreshToken, sortBy, sortOrder])

  const rangeText = useMemo(() => {
    if (!total) {
      return 'Showing 0 - 0 of 0 results'
    }

    const start = (page - 1) * limit + 1
    const end = Math.min(page * limit, total)
    return `Showing ${start} - ${end} of ${total} results`
  }, [page, total])

  const activeFilterCount = useMemo(
    () =>
      [
        filters.salesman,
        filters.supplier,
        filters.startDate,
        filters.endDate,
      ].filter(Boolean).length,
    [filters]
  )

  const updateFilter = (name, value) => {
    setPage(1)
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const retry = () => {
    setRefreshToken((current) => current + 1)
  }

  const handleExport = async (scope) => {
    setIsExporting(true)
    setError('')

    try {
      const blob = await salesApi.exportSales({
        page,
        limit,
        salesman: filters.salesman.trim(),
        supplier: filters.supplier.trim(),
        startDate: filters.startDate,
        endDate: filters.endDate,
        sortBy,
        sortOrder,
        scope,
      })

      const dateSuffix = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `sales-${scope}-${dateSuffix}.csv`)
    } catch (err) {
      setError(err?.error || err?.message || 'Failed to export sales.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Operations Log"
        title="Sales"
        description="Search the sales ledger by salesman, supplier, date, and sort order."
        actions={
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface-panel-soft panel-border rounded-2xl !p-4 mb-0 min-w-[160px]">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                Results
              </div>
              <div className="mt-2 text-2xl font-bold text-heading">
                {formatNumber(total)}
              </div>
              <div className="mt-1 text-sm text-muted">Matching sales records</div>
            </div>
            <div className="surface-panel-soft panel-border rounded-2xl !p-4 mb-0 min-w-[160px]">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                Active Filters
              </div>
              <div className="mt-2 text-2xl font-bold text-heading">
                {activeFilterCount}
              </div>
              <div className="mt-1 text-sm text-muted">Applied search controls</div>
            </div>
            <div className="surface-panel-soft panel-border rounded-2xl !p-4 mb-0 min-w-[160px]">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                Page Size
              </div>
              <div className="mt-2 text-2xl font-bold text-heading">{limit}</div>
              <div className="mt-1 text-sm text-muted">Rows per page</div>
            </div>
          </div>
        }
      />

      <SectionCard>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-5 items-end">
          <div className="field">
            <label className="field-label" htmlFor="salesman-filter">
              Salesman
            </label>
            <input
              id="salesman-filter"
              className="input"
              type="text"
              value={filters.salesman}
              onChange={(event) => updateFilter('salesman', event.target.value)}
              placeholder="Search by salesman"
              aria-label="Filter sales by salesman"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="supplier-filter">
              Supplier
            </label>
            <input
              id="supplier-filter"
              className="input"
              type="text"
              value={filters.supplier}
              onChange={(event) => updateFilter('supplier', event.target.value)}
              placeholder="Search by supplier"
              aria-label="Filter sales by supplier"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="start-date-filter">
              Date From
            </label>
            <input
              id="start-date-filter"
              className="input"
              type="date"
              value={filters.startDate}
              onChange={(event) => updateFilter('startDate', event.target.value)}
              aria-label="Filter sales from date"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="end-date-filter">
              Date To
            </label>
            <input
              id="end-date-filter"
              className="input"
              type="date"
              value={filters.endDate}
              onChange={(event) => updateFilter('endDate', event.target.value)}
              aria-label="Filter sales to date"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="sort-filter">
              Sort Order
            </label>
            <select
              id="sort-filter"
              className="input"
              value={filters.sort}
              onChange={(event) => updateFilter('sort', event.target.value)}
              aria-label="Sort sales records"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleExport('filtered')}
              disabled={isExporting}
              className="primary-luxury-button text-on-accent"
              aria-label="Export filtered sales as CSV"
            >
              {isExporting ? 'Exporting...' : 'Export Range'}
            </button>
            <button
              type="button"
              onClick={() => handleExport('all')}
              disabled={isExporting}
              className="luxury-button border border-white/10 bg-white/5 text-on-accent hover:bg-white/10"
              aria-label="Export all sales as CSV"
            >
              Export All
            </button>
          </div>
        </div>
      </SectionCard>

      {error && (
        <div className="surface-card border-red-500/20 bg-red-500/10 text-red-200 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={retry}
            className="primary-luxury-button bg-red-500 text-white hover:bg-red-400"
            aria-label="Retry loading sales"
          >
            Retry
          </button>
        </div>
      )}

      <SectionCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.18em] text-muted">
                <th className="px-5 py-4">Ref</th>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Salesman</th>
                <th className="px-5 py-4">Supplier</th>
                <th className="px-5 py-4">Category</th>
                <th className="px-5 py-4 text-right">Net Wt</th>
                <th className="px-5 py-4 text-right">Rate</th>
                <th className="px-5 py-4 text-right">Total</th>
                <th className="px-5 py-4 text-right">Duplicate</th>
              </tr>
            </thead>

            {loading ? (
              <LoadingRows />
            ) : sales.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan="9" className="px-5 py-6">
                    <EmptyState
                      title="No sales found"
                      description="Try widening the date range or clearing a filter."
                    />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-white/5">
                {sales.map((sale) => {
                  const netWeight = Number(sale?.netWeight) || 0
                  const isDuplicate = sale?.isDuplicate === true

                  return (
                    <tr key={sale._id} className="hover:bg-white/5">
                      <td className="px-5 py-4 font-mono text-xs text-muted">
                        {sale.ref || '-'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-primary">
                        {formatDateTime(sale.saleDate)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-primary">
                        {getName(sale.salesman)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-primary">
                        {getName(sale.supplier)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-primary">
                        {sale?.category || '-'}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                        {formatWeight(netWeight)}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                        {formatCurrency(sale.ratePerGram)}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap font-semibold text-gold-500">
                        {formatCurrency(sale.totalValue)}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {isDuplicate ? (
                          <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                            Duplicate
                          </span>
                        ) : (
                          <span className="text-muted text-[10px] uppercase tracking-[0.18em]">
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            )}
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted">{rangeText}</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="luxury-button border border-white/10 bg-white/5 text-on-accent hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Previous sales page"
            >
              Previous
            </button>
            <span className="text-xs uppercase tracking-[0.18em] text-muted">
              Page {page} of {pages}
            </span>
            <button
              type="button"
              className="luxury-button border border-white/10 bg-white/5 text-on-accent hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={loading || page >= pages}
              onClick={() => setPage((current) => Math.min(pages, current + 1))}
              aria-label="Next sales page"
            >
              Next
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
