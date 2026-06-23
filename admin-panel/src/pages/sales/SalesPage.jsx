import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { captureSessionsApi } from '../../api/captureSessions.api'
import { getSuppliers } from '../../api/suppliers.api'
import { usersApi } from '../../api/users.api'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import { formatNumber } from '../../utils/formatters'
import CaptureSessionDetailModal from './components/CaptureSessionDetailModal'
import CaptureSessionFilterBar from './components/CaptureSessionFilterBar'
import CaptureSessionRecordsTable from './components/CaptureSessionRecordsTable'
import SalesHeaderStats from './components/SalesHeaderStats'

const splitSort = (sortValue, fallback) => {
  const [fallbackField, fallbackOrder] = fallback.split(':')
  const [field, order] = String(sortValue || fallback).split(':')
  return [field || fallbackField, order || fallbackOrder]
}

const countActiveValues = (values = []) =>
  values.filter((value) => value !== null && value !== undefined && value !== '' && value !== false).length

export default function SalesPage() {
  const location = useLocation()
  const [refreshToken, setRefreshToken] = useState(0)

  const [suppliers, setSuppliers] = useState([])
  const [suppliersLoading, setSuppliersLoading] = useState(true)
  const [salesmen, setSalesmen] = useState([])
  const [salesmenLoading, setSalesmenLoading] = useState(true)

  const [sessionFilters, setSessionFilters] = useState({
    q: '',
    supplier: '',
    status: '',
    assignedSalesman: '',
    startDate: '',
    endDate: '',
    warningsOnly: false,
    sort: 'updatedAt:desc',
  })
  const [sessionPage, setSessionPage] = useState(1)
  const [sessionPages, setSessionPages] = useState(1)
  const [sessionTotal, setSessionTotal] = useState(0)
  const [sessions, setSessions] = useState([])
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionHasLoadedOnce, setSessionHasLoadedOnce] = useState(false)
  const [sessionError, setSessionError] = useState('')

  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [selectedSessionDetail, setSelectedSessionDetail] = useState(null)
  const [sessionDetailOpen, setSessionDetailOpen] = useState(false)
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false)
  const [sessionDetailError, setSessionDetailError] = useState('')

  const debouncedSessionFilters = useDebouncedValue(sessionFilters, 250)
  const [sessionSortBy, sessionSortOrder] = splitSort(debouncedSessionFilters.sort, 'updatedAt:desc')

  useEffect(() => {
    const sessionId = new URLSearchParams(location.search).get('sessionId')
    if (!sessionId) return

    setSelectedSessionId(sessionId)
    setSessionDetailOpen(true)
  }, [location.search])

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

    void loadSuppliers()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadSalesmen = async () => {
      setSalesmenLoading(true)
      try {
        const response = await usersApi.listUsers()
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

    void loadSalesmen()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadSessions = async () => {
      setSessionLoading(true)
      setSessionError('')

      try {
        const response = await captureSessionsApi.listSessions({
          page: sessionPage,
          limit: 10,
          q: debouncedSessionFilters.q.trim(),
          supplier: debouncedSessionFilters.supplier || undefined,
          status: debouncedSessionFilters.status || undefined,
          assignedSalesman: debouncedSessionFilters.assignedSalesman || undefined,
          warningsOnly: debouncedSessionFilters.warningsOnly,
          startDate: debouncedSessionFilters.startDate || undefined,
          endDate: debouncedSessionFilters.endDate || undefined,
          sortBy: sessionSortBy,
          sortOrder: sessionSortOrder,
        })

        if (!active) return

        const data = response?.data || {}
        setSessions(Array.isArray(data.sessions) ? data.sessions : [])
        setSessionTotal(Number(data.total) || 0)
        setSessionPages(Number(data.pages) || 1)
        setSessionPage(Number(data.page) || sessionPage)
      } catch (err) {
        if (!active) return
        setSessionError(err?.error || err?.message || 'Failed to load capture sessions.')
        setSessions([])
        setSessionTotal(0)
        setSessionPages(1)
      } finally {
        if (active) {
          setSessionLoading(false)
          setSessionHasLoadedOnce(true)
        }
      }
    }

    void loadSessions()

    return () => {
      active = false
    }
  }, [debouncedSessionFilters, refreshToken, sessionPage, sessionSortBy, sessionSortOrder])

  useEffect(() => {
    if (!sessionDetailOpen || !selectedSessionId) {
      return undefined
    }

    let active = true

    const loadSessionDetail = async () => {
      setSessionDetailLoading(true)
      setSessionDetailError('')

      try {
        const response = await captureSessionsApi.getSessionDetail(selectedSessionId)
        if (!active) return
        setSelectedSessionDetail(response?.data || null)
      } catch (err) {
        if (!active) return
        setSelectedSessionDetail(null)
        setSessionDetailError(err?.error || err?.message || 'Failed to load capture session detail.')
      } finally {
        if (active) {
          setSessionDetailLoading(false)
        }
      }
    }

    void loadSessionDetail()

    return () => {
      active = false
    }
  }, [refreshToken, selectedSessionId, sessionDetailOpen])

  const activeFilterCount = useMemo(() => {
    return countActiveValues([
      debouncedSessionFilters.q,
      debouncedSessionFilters.supplier,
      debouncedSessionFilters.status,
      debouncedSessionFilters.assignedSalesman,
      debouncedSessionFilters.warningsOnly,
      debouncedSessionFilters.startDate,
      debouncedSessionFilters.endDate,
      debouncedSessionFilters.sort !== 'updatedAt:desc' ? debouncedSessionFilters.sort : '',
    ])
  }, [debouncedSessionFilters])

  const showInitialLoading = sessionLoading && !sessionHasLoadedOnce

  const handleRefresh = () => {
    setRefreshToken((current) => current + 1)
  }

  const handleSessionFilterChange = (name, value) => {
    setSessionPage(1)
    setSessionFilters((current) => ({ ...current, [name]: value }))
  }

  const openSessionDetail = useCallback((sessionId) => {
    if (!sessionId) return

    setSelectedSessionId(sessionId)
    setSessionDetailOpen(true)
  }, [])

  const closeSessionDetail = useCallback(() => {
    setSessionDetailOpen(false)
    setSelectedSessionId(null)
    setSelectedSessionDetail(null)
    setSessionDetailError('')
    setSessionDetailLoading(false)
  }, [])

  return (
    <div className="page-shell space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="Session review"
        title="Sales"
        description="Review customer sales sessions, filter by supplier or salesman, and open a read-only session detail view."
        actions={
          <SalesHeaderStats
            total={sessionTotal}
            activeFilterCount={activeFilterCount}
            limit={10}
            formatNumber={formatNumber}
            labels={{
              total: 'Matching sessions',
              activeFilters: 'Applied session filters',
              pageSize: 'Sessions per page',
            }}
          />
        }
      />

      {suppliersLoading ? (
        <div className="rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-4 text-sm text-muted">
          Loading supplier list for session filters...
        </div>
      ) : null}

      {salesmenLoading ? (
        <div className="rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-4 text-sm text-muted">
          Loading salesman list for session filters...
        </div>
      ) : null}

      {sessionError ? (
        <div className="surface-panel-soft panel-border border-red-500/20 text-primary flex items-center justify-between gap-4">
          <span className="font-medium">{sessionError}</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none border border-red-500/20 bg-red-500/90 text-white shadow-lg shadow-red-500/20 hover:bg-red-400"
            aria-label="Retry loading sessions"
            disabled={sessionLoading}
          >
            {sessionLoading ? (
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
        <CaptureSessionFilterBar
          filters={sessionFilters}
          suppliers={suppliers}
          salesmen={salesmen}
          onFilterChange={handleSessionFilterChange}
        />
      </SectionCard>

      <CaptureSessionRecordsTable
        sessions={sessions}
        loading={showInitialLoading}
        page={sessionPage}
        pages={sessionPages}
        total={sessionTotal}
        limit={10}
        onPageChange={setSessionPage}
        onViewSession={openSessionDetail}
        viewingSessionId={selectedSessionId}
        actionLoadingSessionId={sessionDetailLoading ? selectedSessionId : null}
      />

      <div className="rounded-2xl surface-panel-soft panel-border px-4 py-4 text-sm text-muted">
        Delete is intentionally disabled for now. Session archive and reopen flows can be added later.
      </div>

      <CaptureSessionDetailModal
        open={sessionDetailOpen}
        session={selectedSessionDetail}
        loading={sessionDetailLoading}
        error={sessionDetailError}
        onClose={closeSessionDetail}
      />
    </div>
  )
}


