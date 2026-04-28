import { useEffect, useMemo, useState } from 'react'
import { salesApi } from '../../api/sales.api'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
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
            q: filters.q.trim(),
            searchScope: filters.searchScope,
            duplicatesOnly: filters.duplicatesOnly,
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
        eyebrow="Operations Log"
        title="Sales"
        description="Search sales by supplier, salesman, entry details, date, and sort order."
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
        <div className="surface-card border-red-500/20 bg-red-500/10 text-red-200 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={retry}
            className={buttonStyles.primary + ' bg-red-500 hover:bg-red-400 shadow-none'}
            aria-label="Retry loading sales"
          >
            Retry
          </button>
        </div>
      )}

      <SalesRecordsTable
        sales={sales}
        loading={loading}
        page={page}
        pages={pages}
        total={total}
        limit={limit}
        onPageChange={setPage}
      />
    </div>
  )
}
