import { useEffect, useMemo, useState } from 'react'
import { salesApi } from '../../api/sales.api'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import { formatNumber } from '../../utils/formatters'
import SalesFilterBar from './components/SalesFilterBar'
import SalesHeaderStats from './components/SalesHeaderStats'
import SalesRecordsTable from './components/SalesRecordsTable'
import { buttonStyles, downloadBlob } from './salesPage.utils'

export default function SalesPage() {
  const [sales, setSales] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [error, setError] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [filters, setFilters] = useState({
    q: '',
    searchScope: 'all',
    startDate: '',
    endDate: '',
    duplicatesOnly: false,
    sort: 'saleDate:desc',
  })

  const limit = 10
  const debouncedFilters = useDebouncedValue(filters, 250)
  const [sortBy, sortOrder] = debouncedFilters.sort.split(':')

  useEffect(() => {
    let active = true

    const loadSales = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await salesApi.listSales({
          page,
          limit,
          q: debouncedFilters.q.trim(),
          searchScope: debouncedFilters.searchScope,
          duplicatesOnly: debouncedFilters.duplicatesOnly,
          startDate: debouncedFilters.startDate,
          endDate: debouncedFilters.endDate,
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
        if (active) {
          setLoading(false)
          setHasLoadedOnce(true)
        }
      }
    }

    void loadSales()

    return () => {
      active = false
    }
  }, [debouncedFilters, page, refreshToken, sortBy, sortOrder])

  const showInitialLoading = loading && !hasLoadedOnce

  const activeFilterCount = useMemo(
    () =>
      [
        filters.q,
        filters.searchScope !== 'all' ? filters.searchScope : '',
        filters.startDate,
        filters.endDate,
        filters.duplicatesOnly,
      ].filter(Boolean)
        .length,
    [filters],
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
        q: filters.q.trim(),
        searchScope: filters.searchScope,
        duplicatesOnly: filters.duplicatesOnly,
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
        eyebrow="Operational Ledger"
        title="Sales"
        description="Search the operational ledger by supplier, salesman, entry details, date, and sort order."
        actions={
          <SalesHeaderStats
            total={total}
            activeFilterCount={activeFilterCount}
            limit={limit}
            formatNumber={formatNumber}
          />
        }
      />

      <SectionCard>
        <SalesFilterBar
          filters={filters}
          onFilterChange={updateFilter}
          onExport={handleExport}
          isExporting={isExporting}
        />
      </SectionCard>

      {error && (
        <div className="surface-card border-red-500/20 bg-red-500/10 text-primary flex items-center justify-between gap-4">
          <span className="font-medium">{error}</span>
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none border border-red-500/20 bg-red-500/90 text-white shadow-lg shadow-red-500/20 hover:bg-red-400"
            aria-label="Retry loading sales"
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

      <SalesRecordsTable
        sales={sales}
        loading={showInitialLoading}
        page={page}
        pages={pages}
        total={total}
        limit={limit}
        onPageChange={setPage}
      />
    </div>
  )
}
