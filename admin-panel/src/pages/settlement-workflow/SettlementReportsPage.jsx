import { useEffect, useMemo, useState } from 'react'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import { qrOperationsApi } from '../../api/qrOperations.api'
import { formatCurrency, formatNumber, formatWeight } from '../../utils/formatters'
import { createInitialWorkflowFilters, buildWorkflowFilterParams, downloadBlob, normalizeText } from './workflow.utils'
import WorkflowFiltersBar from './components/WorkflowFiltersBar'
import SettlementReportsTable from './components/SettlementReportsTable'
import SettlementReportsSummary from './components/SettlementReportsSummary'
import { buildSettlementDocumentName, buildSettlementPrintHtml, loadImageAsDataUrl } from './settlementReportPrint'
import { buttonStyles } from '../sales/salesPage.utils'

export default function SettlementReportsPage() {
  const [filters, setFilters] = useState(createInitialWorkflowFilters())
  const [summary, setSummary] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [error, setError] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const debouncedFilters = useDebouncedValue(filters, 250)

  const apiFilters = useMemo(
    () => ({
      ...buildWorkflowFilterParams(debouncedFilters),
    }),
    [debouncedFilters],
  )

  useEffect(() => {
    let active = true

    const loadData = async () => {
      setLoading(true)
      setError('')
      try {
        const [summaryResponse, listResponse] = await Promise.all([
          qrOperationsApi.getSettlementSummary(apiFilters),
          qrOperationsApi.listSettlementReports(apiFilters),
        ])

        if (!active) return

        setSummary(summaryResponse?.data ?? null)
        setRows(Array.isArray(listResponse?.data) ? listResponse.data : [])
      } catch (err) {
        if (!active) return
        setError(err?.error || err?.message || 'Failed to load settlement reports.')
        setRows([])
        setSummary(null)
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

  const visibleRows = useMemo(() => {
    const searchTerm = normalizeText(debouncedFilters.search).toLowerCase()
    if (!searchTerm) {
      return rows
    }

    return rows.filter((row) => {
      const supplier = normalizeText(row?.supplier).toLowerCase()
      const designCode = normalizeText(row?.item_code || row?.design_code).toLowerCase()
      const category = normalizeText(row?.category).toLowerCase()
      const metalType = normalizeText(row?.metal_type).toLowerCase()

      return (
        supplier.includes(searchTerm) ||
        designCode.includes(searchTerm) ||
        category.includes(searchTerm) ||
        metalType.includes(searchTerm)
      )
    })
  }, [debouncedFilters.search, rows])

  const showInitialLoading = loading && !hasLoadedOnce

  const activeFilterCount = useMemo(
    () => [filters.search, filters.supplier, filters.startDate, filters.endDate].filter(Boolean).length,
    [filters],
  )

  const totalRows = visibleRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStartIndex = (safeCurrentPage - 1) * pageSize
  const pageRows = useMemo(
    () => visibleRows.slice(pageStartIndex, pageStartIndex + pageSize),
    [visibleRows, pageStartIndex, pageSize],
  )
  const pageStartLabel = totalRows === 0 ? 0 : pageStartIndex + 1
  const pageEndLabel = Math.min(pageStartIndex + pageRows.length, totalRows)

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedFilters.search, debouncedFilters.supplier, debouncedFilters.startDate, debouncedFilters.endDate, pageSize])

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const refresh = () => {
    setRefreshToken((value) => value + 1)
  }

  const goToPage = (nextPage) => {
    setCurrentPage((current) => {
      const normalized = Number(nextPage)
      if (!Number.isFinite(normalized)) return current
      return Math.min(Math.max(1, normalized), totalPages)
    })
  }

  const handleExportCsv = async () => {
    setIsExporting(true)
    setError('')
    try {
      const blob = await qrOperationsApi.exportSettlementCsv(apiFilters)
      const stamp = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `settlement-reports-${stamp}.csv`)
    } catch (err) {
      setError(err?.error || err?.message || 'Failed to export CSV.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPdf = async () => {
    setIsExporting(true)
    setError('')
    try {
      const documentName = buildSettlementDocumentName(apiFilters.supplier || 'all')
      const logoDataUrl = await loadImageAsDataUrl('/logo-dark.png')
      const html = buildSettlementPrintHtml({
        rows: visibleRows,
        summary,
        meta: {
          supplier: apiFilters.supplier || 'All',
          reportDate: new Date().toISOString().slice(0, 10),
        },
        logoDataUrl,
        documentName,
      })
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const previewUrl = window.URL.createObjectURL(blob)
      const popup = window.open(previewUrl, '_blank')
      if (!popup) {
        downloadBlob(blob, `${documentName}.html`)
      }
      window.setTimeout(() => window.URL.revokeObjectURL(previewUrl), 60000)
    } catch (err) {
      setError(err?.error || err?.message || 'Failed to open print view.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Settlement Reports"
        title="Settlement Reports"
        description="Supplier-style settlement ledger built from gross, stone, net, fine, and export-ready totals."
      />

      {error ? (
        <div className="surface-card border-red-500/20 bg-red-500/10 text-primary flex items-center justify-between gap-4">
          <span className="font-medium">{error}</span>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none border border-red-500/20 bg-red-500/90 text-white shadow-lg shadow-red-500/20 hover:bg-red-400"
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
      ) : null}

      <SettlementReportsSummary
        summary={summary}
        loading={showInitialLoading}
        formatWeight={formatWeight}
        formatCurrency={formatCurrency}
        formatNumber={formatNumber}
      />

      <SectionCard>
        <WorkflowFiltersBar
          mode="settlement"
          title="Settlement filters"
          description="Filter finalized settlement records by supplier and date."
          filters={filters}
          onFilterChange={updateFilter}
          onResetFilters={() => setFilters(createInitialWorkflowFilters())}
          onRefresh={refresh}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          isExporting={isExporting}
          canExport={visibleRows.length > 0 && !loading}
          activeFilterCount={activeFilterCount}
          pdfButtonLabel="Preview PDF"
        />
      </SectionCard>

      <SettlementReportsTable rows={pageRows} loading={showInitialLoading} />
      {!showInitialLoading && totalRows > 0 ? (
        <SectionCard className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted">
            Showing {pageStartLabel}-{pageEndLabel} of {totalRows} settlement rows
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="field m-0">
              <span className="field-label">Rows per page</span>
              <select
                className="input min-w-[120px]"
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={buttonStyles.secondary}
                onClick={() => goToPage(safeCurrentPage - 1)}
                disabled={safeCurrentPage <= 1}
              >
                Previous
              </button>
              <div className="min-w-16 text-center text-sm font-semibold text-heading">
                {safeCurrentPage} / {totalPages}
              </div>
              <button
                type="button"
                className={buttonStyles.secondary}
                onClick={() => goToPage(safeCurrentPage + 1)}
                disabled={safeCurrentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  )
}
