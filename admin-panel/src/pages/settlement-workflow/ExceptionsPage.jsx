import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import { formatNumber } from '../../utils/formatters'
import { qrOperationsApi } from '../../api/qrOperations.api'
import WorkflowFiltersBar from './components/WorkflowFiltersBar'
import ExceptionsStats from './components/ExceptionsStats'
import ExceptionsTable from './components/ExceptionsTable'
import { createInitialWorkflowFilters, downloadBlob, normalizeText, buildWorkflowFilterParams } from './workflow.utils'

export default function ExceptionsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(createInitialWorkflowFilters())
  const [summary, setSummary] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [error, setError] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [pendingAction, setPendingAction] = useState('')

  const debouncedFilters = useDebouncedValue(filters, 250)

  const apiFilters = useMemo(
    () => ({
      ...buildWorkflowFilterParams(debouncedFilters),
      workflowScope: 'exceptions',
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
          qrOperationsApi.getSummary(apiFilters),
          qrOperationsApi.listIngestions(apiFilters),
        ])

        if (!active) return

        setSummary(summaryResponse?.data ?? null)
        setRows(Array.isArray(listResponse?.data) ? listResponse.data : [])
      } catch (err) {
        if (!active) return
        setError(err?.error || err?.message || 'Failed to load exceptions.')
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
      const designCode = normalizeText(row?.design_code).toLowerCase()
      const status = normalizeText(row?.status).toLowerCase()
      const valuation = normalizeText(row?.valuation_status).toLowerCase()

      return (
        supplier.includes(searchTerm) ||
        designCode.includes(searchTerm) ||
        status.includes(searchTerm) ||
        valuation.includes(searchTerm)
      )
    })
  }, [debouncedFilters.search, rows])

  const showInitialLoading = loading && !hasLoadedOnce

  const activeFilterCount = useMemo(
    () =>
      [
        filters.search,
        filters.supplier,
        filters.valuationStatus,
        filters.confidenceThreshold,
        filters.startDate,
        filters.endDate,
      ].filter(Boolean).length,
    [filters],
  )

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const refresh = () => {
    setRefreshToken((value) => value + 1)
  }

  const handleExportCsv = async () => {
    setIsExporting(true)
    setError('')
    try {
      const blob = await qrOperationsApi.exportCsv(apiFilters)
      const stamp = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `exceptions-${stamp}.csv`)
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
      const blob = await qrOperationsApi.exportPdf(apiFilters)
      const stamp = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `exceptions-${stamp}.pdf`)
    } catch (err) {
      setError(err?.error || err?.message || 'Failed to export PDF.')
    } finally {
      setIsExporting(false)
    }
  }

  const runRowAction = async (id, action, requestFn, fallbackMessage) => {
    setPendingAction(`${action}:${id}`)
    setError('')
    try {
      const response = await requestFn(id)
      setStatusMessage(response?.message || fallbackMessage)
      refresh()
    } catch (err) {
      setError(err?.error || err?.message || fallbackMessage)
    } finally {
      setPendingAction('')
    }
  }

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Settlement Operations"
        title="Exceptions"
        description="Review malformed scans, low-confidence records, and items that require verification."
      />

      {statusMessage ? (
        <div className="surface-card border-green-500/20 bg-green-500/10 text-green-200 flex items-center justify-between gap-4">
          <span>{statusMessage}</span>
          <button type="button" className="text-xs font-bold uppercase tracking-widest text-green-100" onClick={() => setStatusMessage('')}>
            Dismiss
          </button>
        </div>
      ) : null}

      {error && (
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
      )}

      <ExceptionsStats
        summary={summary}
        visibleCount={visibleRows.length}
        loading={showInitialLoading}
        formatNumber={formatNumber}
      />

      <SectionCard>
        <WorkflowFiltersBar
          mode="exceptions"
          title="Exception filters"
          description="Filter exception records by supplier, settlement state, confidence, and date."
          filters={filters}
          onFilterChange={updateFilter}
          onResetFilters={() => setFilters(createInitialWorkflowFilters())}
          onRefresh={refresh}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          isExporting={isExporting}
          canExport={visibleRows.length > 0 && !loading}
          activeFilterCount={activeFilterCount}
        />
      </SectionCard>

      <ExceptionsTable
        rows={visibleRows}
        loading={showInitialLoading}
        onViewDetail={(id) => navigate(`/exceptions/${id}`)}
        onApprove={(id) => runRowAction(id, 'approve', qrOperationsApi.approveIngestion, 'Record approved')}
        onMarkReviewed={(id) => runRowAction(id, 'review', qrOperationsApi.markReviewed, 'Record marked as reviewed')}
        pendingAction={pendingAction}
      />
    </div>
  )
}
