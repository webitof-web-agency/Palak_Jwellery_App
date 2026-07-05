import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import { settlementReportsApi } from '../../api/settlementReports.api'
import { getSuppliers } from '../../api/suppliers.api'
import { usersApi } from '../../api/users.api'
import { formatNumber, formatWeight } from '../../utils/formatters'
import { normalizeText } from './workflow.utils'
import SalesSessionReportsModeToggle from './components/SalesSessionReportsModeToggle'
import SalesSessionReportsFiltersBar from './components/SalesSessionReportsFiltersBar'
import SalesSessionReportsSummary from './components/SalesSessionReportsSummary'
import SalesSessionReportsTable from './components/SalesSessionReportsTable'

const REPORT_PAGE_SIZE_DEFAULT = 10

const createInitialFilters = () => ({
  customer: '',
  salesman: '',
  supplier: '',
  status: 'active',
  warningsOnly: false,
  startDate: '',
  endDate: '',
  category: '',
  karat: '',
  wastage: '',
})

const countActiveValues = (values = []) => values.filter(Boolean).length

const buildV2ApiFilters = (mode, filters, page, limit) => {
  const params = {
    mode,
    page,
    limit,
    customer: normalizeText(filters.customer),
    salesman: normalizeText(filters.salesman),
    supplier: normalizeText(filters.supplier),
    status: normalizeText(filters.status) || 'active',
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
  }

  if (filters.warningsOnly) {
    params.warningsOnly = true
  }

  if (mode === 'category' && normalizeText(filters.category)) {
    params.category = normalizeText(filters.category)
  }

  if (mode === 'karat' && normalizeText(filters.karat)) {
    params.karat = normalizeText(filters.karat)
  }

  if (mode === 'wastage' && normalizeText(filters.wastage)) {
    params.wastage = normalizeText(filters.wastage)
  }

  return params
}

const buildActiveFilterCount = (mode, filters) => countActiveValues([
  normalizeText(filters.customer),
  normalizeText(filters.salesman),
  normalizeText(filters.supplier),
  filters.status && filters.status !== 'active',
  filters.warningsOnly,
  filters.startDate,
  filters.endDate,
  mode === 'category' ? normalizeText(filters.category) : '',
  mode === 'karat' ? normalizeText(filters.karat) : '',
  mode === 'wastage' ? normalizeText(filters.wastage) : '',
])

const modeDescriptions = {
  session: 'Session-wise view rolls synced mobile items up under each CaptureSession.',
  supplier: 'Supplier-wise view groups synced mobile items by supplier or company.',
  category: 'Category-wise view groups synced mobile items by supplier plus category when category exists.',
  karat: 'Karat-wise view groups synced mobile items by applied karat.',
  wastage: 'Wastage-wise view groups synced mobile items by applied wastage percent.',
}

export default function SettlementReportsPage() {
  const navigate = useNavigate()

  const [mode, setMode] = useState('session')
  const [filters, setFilters] = useState(createInitialFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(REPORT_PAGE_SIZE_DEFAULT)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [error, setError] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const [isExportingCsv, setIsExportingCsv] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [exportError, setExportError] = useState('')

  const [suppliers, setSuppliers] = useState([])
  const [suppliersLoading, setSuppliersLoading] = useState(true)
  const [salesmen, setSalesmen] = useState([])
  const [salesmenLoading, setSalesmenLoading] = useState(true)

  const debouncedFilters = useDebouncedValue(filters, 300)
  const apiFilters = useMemo(
    () => buildV2ApiFilters(mode, debouncedFilters, page, pageSize),
    [debouncedFilters, mode, page, pageSize],
  )
  const exportFilters = useMemo(
    () => buildV2ApiFilters(mode, filters, undefined, undefined),
    [filters, mode],
  )

  const activeFilterCount = useMemo(
    () => buildActiveFilterCount(mode, debouncedFilters),
    [debouncedFilters, mode],
  )

  useEffect(() => {
    let active = true

    const loadSuppliers = async () => {
      setSuppliersLoading(true)
      try {
        const response = await getSuppliers()
        if (!active) return

        const supplierList = Array.isArray(response)
          ? response
          : Array.isArray(response?.suppliers)
            ? response.suppliers
            : []

        setSuppliers(supplierList)
      } catch {
        if (!active) return
        setSuppliers([])
      } finally {
        if (active) {
          setSuppliersLoading(false)
        }
      }
    }

    const loadSalesmen = async () => {
      setSalesmenLoading(true)
      try {
        const response = await usersApi.listUsers({ role: 'salesman', page: 1, limit: 100 })
        if (!active) return
        const list = Array.isArray(response?.data) ? response.data : []
        setSalesmen(list.filter((user) => user?.role === 'salesman' && user?.isActive !== false))
      } catch {
        if (!active) return
        setSalesmen([])
      } finally {
        if (active) {
          setSalesmenLoading(false)
        }
      }
    }

    void Promise.all([loadSuppliers(), loadSalesmen()])

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadData = async () => {
      setLoading(true)
      setError('')

      try {
        const [summaryResponse, listResponse] = await Promise.all([
          settlementReportsApi.getSalesSessionReportsSummary(apiFilters),
          settlementReportsApi.getSalesSessionReports(apiFilters),
        ])

        if (!active) return

        const summaryData = summaryResponse?.data || null
        const listData = listResponse?.data || {}

        setSummary(summaryData)
        setRows(Array.isArray(listData.rows) ? listData.rows : [])
        setTotal(Number(listData.total) || 0)
        setPages(Number(listData.pages) || 1)
        setPage(Number(listData.page) || 1)
      } catch (err) {
        if (!active) return
        setError(err?.error || err?.message || 'Failed to load synced sales reports.')
        setSummary(null)
        setRows([])
        setTotal(0)
        setPages(1)
      } finally {
        if (active) {
          setLoading(false)
          setHasLoadedOnce(true)
        }
      }
    }

    void loadData()

    return () => {
      active = false
    }
  }, [apiFilters, refreshToken])

  useEffect(() => {
    setPage(1)
  }, [
    mode,
    debouncedFilters.customer,
    debouncedFilters.salesman,
    debouncedFilters.supplier,
    debouncedFilters.status,
    debouncedFilters.warningsOnly,
    debouncedFilters.startDate,
    debouncedFilters.endDate,
    debouncedFilters.category,
    debouncedFilters.karat,
    debouncedFilters.wastage,
  ])

  const showInitialLoading = loading && !hasLoadedOnce

  const handleRefresh = useCallback(() => {
    setRefreshToken((current) => current + 1)
  }, [])

  const handleModeChange = useCallback((nextMode) => {
    if (nextMode === mode) return

    setMode(nextMode)
    setPage(1)
    setError('')
    setExportError('')
    setFilters((current) => ({
      ...current,
      category: nextMode === 'category' ? current.category : '',
      karat: nextMode === 'karat' ? current.karat : '',
      wastage: nextMode === 'wastage' ? current.wastage : '',
    }))
  }, [mode])

  const handleFilterChange = useCallback((name, value) => {
    setPage(1)
    setExportError('')
    setFilters((current) => ({ ...current, [name]: value }))
  }, [])

  const handleResetFilters = useCallback(() => {
    setPage(1)
    setExportError('')
    setFilters(createInitialFilters())
  }, [])

  const handleViewSession = useCallback((sessionId) => {
    if (!sessionId) return
    navigate(`/sales/${sessionId}`)
  }, [navigate])

  const handleExportCsv = useCallback(async () => {
    setIsExportingCsv(true)
    setExportError('')

    try {
      await settlementReportsApi.exportSalesSessionReportsCsv(exportFilters)
    } catch (err) {
      setExportError(err?.error || err?.message || 'Failed to export V2 sales report CSV.')
    } finally {
      setIsExportingCsv(false)
    }
  }, [exportFilters])

  const handleExportPdf = useCallback(async () => {
    setIsExportingPdf(true)
    setExportError('')

    try {
      await settlementReportsApi.exportSalesSessionReportsPdf(exportFilters)
    } catch (err) {
      setExportError(err?.error || err?.message || 'Failed to export V2 sales report PDF.')
    } finally {
      setIsExportingPdf(false)
    }
  }, [exportFilters])

  return (
    <div className="page-shell space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="Settlement Reports"
        title="Settlement Reports"
        description={modeDescriptions[mode] || modeDescriptions.session}
      />

      <SalesSessionReportsSummary
        summary={summary}
        loading={showInitialLoading}
        formatWeight={formatWeight}
        formatNumber={formatNumber}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SalesSessionReportsModeToggle activeMode={mode} onChange={handleModeChange} />
        <div className="text-sm text-muted">
          V2 synced mobile sales is the primary report source. Legacy settlement exports remain untouched while CSV and PDF exports use the new read-only report contract.
        </div>
      </div>

      {suppliersLoading || salesmenLoading ? (
        <SectionCard className="flex items-center gap-3 text-sm text-muted">
          <LoadingSpinner />
          Loading report filter metadata...
        </SectionCard>
      ) : null}

      {error ? (
        <div className="surface-panel-soft panel-border border-red-500/20 text-primary flex items-center justify-between gap-4">
          <span className="font-medium">{error}</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none border border-red-500/20 bg-red-500/90 text-white shadow-lg shadow-red-500/20 hover:bg-red-400"
            disabled={loading || isExportingCsv || isExportingPdf}
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
      ) : null}

      <SectionCard>
        <SalesSessionReportsFiltersBar
          mode={mode}
          filters={filters}
          suppliers={suppliers}
          salesmen={salesmen}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          onRefresh={handleRefresh}
          activeFilterCount={activeFilterCount}
          isExportingCsv={isExportingCsv}
          isExportingPdf={isExportingPdf}
          exportError={exportError}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
        />
      </SectionCard>

      <SalesSessionReportsTable
        mode={mode}
        rows={rows}
        loading={showInitialLoading}
        page={page}
        pages={pages}
        total={total}
        limit={pageSize}
        onPageChange={setPage}
        onLimitChange={(nextLimit) => {
          setPage(1)
          setPageSize(nextLimit)
        }}
        onViewSession={handleViewSession}
      />
    </div>
  )
}
