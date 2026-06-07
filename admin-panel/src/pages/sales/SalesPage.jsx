import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { captureSessionsApi } from '../../api/captureSessions.api'
import { batchesApi } from '../../api/batches.api'
import { salesApi } from '../../api/sales.api'
import { getSuppliers } from '../../api/suppliers.api'
import { usersApi } from '../../api/users.api'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import { formatNumber } from '../../utils/formatters'
import CaptureSessionDetailModal from './components/CaptureSessionDetailModal'
import CaptureSessionCreateModal from './components/CaptureSessionCreateModal'
import CaptureSessionFilterBar from './components/CaptureSessionFilterBar'
import CaptureSessionRecordsTable from './components/CaptureSessionRecordsTable'
import BatchDetailModal from './components/BatchDetailModal'
import BatchCreateModal from './components/BatchCreateModal'
import BatchFilterBar from './components/BatchFilterBar'
import BatchRecordsTable from './components/BatchRecordsTable'
import SaleDetailModal from './components/SaleDetailModal'
import SalesFilterBar from './components/SalesFilterBar'
import SalesHeaderStats from './components/SalesHeaderStats'
import SalesRecordsTable from './components/SalesRecordsTable'
import SalesViewToggle from './components/SalesViewToggle'
import { buttonStyles, downloadBlob } from './salesPage.utils'

const splitSort = (sortValue, fallback) => {
  const [fallbackField, fallbackOrder] = fallback.split(':')
  const [field, order] = String(sortValue || fallback).split(':')
  return [field || fallbackField, order || fallbackOrder]
}

const countActiveValues = (values = []) =>
  values.filter((value) => value !== null && value !== undefined && value !== '' && value !== false).length

export default function SalesPage() {
  const currentUser = useAuthStore((state) => state.user || null)
  const currentUserRole = currentUser?.role || ''

  const [activeView, setActiveView] = useState('batch')
  const [refreshToken, setRefreshToken] = useState(0)

  const [suppliers, setSuppliers] = useState([])
  const [suppliersLoading, setSuppliersLoading] = useState(true)
  const [salesmen, setSalesmen] = useState([])
  const [salesmenLoading, setSalesmenLoading] = useState(true)

  const [batchFilters, setBatchFilters] = useState({
    q: '',
    supplier: '',
    status: '',
    entryMode: '',
    startDate: '',
    endDate: '',
    sort: 'updatedAt:desc',
  })
  const [batchPage, setBatchPage] = useState(1)
  const [batchPages, setBatchPages] = useState(1)
  const [batchTotal, setBatchTotal] = useState(0)
  const [batches, setBatches] = useState([])
  const [batchLoading, setBatchLoading] = useState(true)
  const [batchHasLoadedOnce, setBatchHasLoadedOnce] = useState(false)
  const [batchError, setBatchError] = useState('')

  const [itemFilters, setItemFilters] = useState({
    q: '',
    supplier: '',
    searchScope: 'all',
    startDate: '',
    endDate: '',
    duplicatesOnly: false,
    sort: 'saleDate:desc',
  })
  const [itemPage, setItemPage] = useState(1)
  const [itemPages, setItemPages] = useState(1)
  const [itemTotal, setItemTotal] = useState(0)
  const [sales, setSales] = useState([])
  const [salesLoading, setSalesLoading] = useState(true)
  const [salesHasLoadedOnce, setSalesHasLoadedOnce] = useState(false)
  const [salesError, setSalesError] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const [saleDetailOpen, setSaleDetailOpen] = useState(false)
  const [saleDetailLoading, setSaleDetailLoading] = useState(false)
  const [saleDetailError, setSaleDetailError] = useState('')
  const [selectedSaleId, setSelectedSaleId] = useState(null)
  const [selectedSaleDetail, setSelectedSaleDetail] = useState(null)

  const [batchDetailOpen, setBatchDetailOpen] = useState(false)
  const [batchDetailLoading, setBatchDetailLoading] = useState(false)
  const [batchDetailError, setBatchDetailError] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState(null)
  const [selectedBatchDetail, setSelectedBatchDetail] = useState(null)
  const [selectedBatchAction, setSelectedBatchAction] = useState(null)
  const [batchCreateOpen, setBatchCreateOpen] = useState(false)
  const [batchCreateError, setBatchCreateError] = useState('')

  const [sessionFilters, setSessionFilters] = useState({
    q: '',
    status: '',
    assignedSalesman: '',
    startDate: '',
    endDate: '',
    sort: 'updatedAt:desc',
  })
  const [sessionPage, setSessionPage] = useState(1)
  const [sessionPages, setSessionPages] = useState(1)
  const [sessionTotal, setSessionTotal] = useState(0)
  const [sessions, setSessions] = useState([])
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionHasLoadedOnce, setSessionHasLoadedOnce] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [sessionCreateOpen, setSessionCreateOpen] = useState(false)
  const [sessionCreateError, setSessionCreateError] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [selectedSessionDetail, setSelectedSessionDetail] = useState(null)
  const [sessionDetailOpen, setSessionDetailOpen] = useState(false)
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false)
  const [sessionDetailError, setSessionDetailError] = useState('')

  const debouncedBatchFilters = useDebouncedValue(batchFilters, 250)
  const debouncedItemFilters = useDebouncedValue(itemFilters, 250)
  const debouncedSessionFilters = useDebouncedValue(sessionFilters, 250)

  const [batchSortBy, batchSortOrder] = splitSort(debouncedBatchFilters.sort, 'updatedAt:desc')
  const [itemSortBy, itemSortOrder] = splitSort(debouncedItemFilters.sort, 'saleDate:desc')
  const [sessionSortBy, sessionSortOrder] = splitSort(debouncedSessionFilters.sort, 'updatedAt:desc')

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
    if (activeView !== 'batch') {
      return undefined
    }

    let active = true

    const loadBatches = async () => {
      setBatchLoading(true)
      setBatchError('')

      try {
        const response = await batchesApi.getBatches({
          page: batchPage,
          limit: 10,
          q: debouncedBatchFilters.q.trim(),
          supplier: debouncedBatchFilters.supplier || undefined,
          status: debouncedBatchFilters.status || undefined,
          entryMode: debouncedBatchFilters.entryMode || undefined,
          startDate: debouncedBatchFilters.startDate || undefined,
          endDate: debouncedBatchFilters.endDate || undefined,
          sortBy: batchSortBy,
          sortOrder: batchSortOrder,
        })

        if (!active) return

        const data = response?.data || {}
        setBatches(Array.isArray(data.batches) ? data.batches : [])
        setBatchTotal(Number(data.total) || 0)
        setBatchPages(Number(data.pages) || 1)
        setBatchPage(Number(data.page) || batchPage)
      } catch (err) {
        if (!active) return
        setBatchError(err?.error || err?.message || 'Failed to load batches.')
        setBatches([])
        setBatchTotal(0)
        setBatchPages(1)
      } finally {
        if (active) {
          setBatchLoading(false)
          setBatchHasLoadedOnce(true)
        }
      }
    }

    void loadBatches()

    return () => {
      active = false
    }
  }, [activeView, batchPage, batchSortBy, batchSortOrder, debouncedBatchFilters, refreshToken])

  useEffect(() => {
    if (activeView !== 'item') {
      return undefined
    }

    let active = true

    const loadSales = async () => {
      setSalesLoading(true)
      setSalesError('')

      try {
        const response = await salesApi.listSales({
          page: itemPage,
          limit: 10,
          q: debouncedItemFilters.q.trim(),
          searchScope: debouncedItemFilters.searchScope,
          supplier: debouncedItemFilters.supplier || undefined,
          duplicatesOnly: debouncedItemFilters.duplicatesOnly,
          startDate: debouncedItemFilters.startDate,
          endDate: debouncedItemFilters.endDate,
          sortBy: itemSortBy,
          sortOrder: itemSortOrder,
        })

        if (!active) return

        const data = response?.data || {}
        setSales(Array.isArray(data.sales) ? data.sales : [])
        setItemTotal(Number(data.total) || 0)
        setItemPages(Number(data.pages) || 1)
        setItemPage(Number(data.page) || itemPage)
      } catch (err) {
        if (!active) return
        setSalesError(err?.error || err?.message || 'Failed to load sales.')
        setSales([])
        setItemTotal(0)
        setItemPages(1)
      } finally {
        if (active) {
          setSalesLoading(false)
          setSalesHasLoadedOnce(true)
        }
      }
    }

    void loadSales()

    return () => {
      active = false
    }
  }, [activeView, debouncedItemFilters, itemPage, itemSortBy, itemSortOrder, refreshToken])

  useEffect(() => {
    if (activeView !== 'session') {
      return undefined
    }

    let active = true

    const loadSessions = async () => {
      setSessionLoading(true)
      setSessionError('')

      try {
        const response = await captureSessionsApi.listSessions({
          page: sessionPage,
          limit: 10,
          q: debouncedSessionFilters.q.trim(),
          status: debouncedSessionFilters.status || undefined,
          assignedSalesman: debouncedSessionFilters.assignedSalesman || undefined,
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
  }, [activeView, debouncedSessionFilters, refreshToken, sessionPage, sessionSortBy, sessionSortOrder])

  useEffect(() => {
    if (!saleDetailOpen || !selectedSaleId) {
      return undefined
    }

    let active = true

    const loadDetail = async () => {
      setSaleDetailLoading(true)
      setSaleDetailError('')

      try {
        const response = await salesApi.getSaleDetail(selectedSaleId)
        if (!active) return
        setSelectedSaleDetail(response?.data || null)
      } catch (err) {
        if (!active) return
        setSelectedSaleDetail(null)
        setSaleDetailError(err?.error || err?.message || 'Failed to load sale detail.')
      } finally {
        if (active) {
          setSaleDetailLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      active = false
    }
  }, [saleDetailOpen, selectedSaleId, refreshToken])

  useEffect(() => {
    if (!batchDetailOpen || !selectedBatchId) {
      return undefined
    }

    let active = true

    const loadBatchDetail = async () => {
      setBatchDetailLoading(true)
      setBatchDetailError('')

      try {
        const response = await batchesApi.getBatchDetail(selectedBatchId)
        if (!active) return
        setSelectedBatchDetail(response?.data || null)
      } catch (err) {
        if (!active) return
        setSelectedBatchDetail(null)
        setBatchDetailError(err?.error || err?.message || 'Failed to load batch detail.')
      } finally {
        if (active) {
          setBatchDetailLoading(false)
        }
      }
    }

    void loadBatchDetail()

    return () => {
      active = false
    }
  }, [batchDetailOpen, selectedBatchId, refreshToken])

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
    if (activeView === 'batch') {
      return countActiveValues([
        debouncedBatchFilters.q,
        debouncedBatchFilters.supplier,
        debouncedBatchFilters.status,
        debouncedBatchFilters.entryMode,
        debouncedBatchFilters.startDate,
        debouncedBatchFilters.endDate,
        debouncedBatchFilters.sort !== 'updatedAt:desc' ? debouncedBatchFilters.sort : '',
      ])
    }

    if (activeView === 'session') {
      return countActiveValues([
        debouncedSessionFilters.q,
        debouncedSessionFilters.status,
        debouncedSessionFilters.assignedSalesman,
        debouncedSessionFilters.startDate,
        debouncedSessionFilters.endDate,
        debouncedSessionFilters.sort !== 'updatedAt:desc' ? debouncedSessionFilters.sort : '',
      ])
    }

    return countActiveValues([
      debouncedItemFilters.q,
      debouncedItemFilters.supplier,
      debouncedItemFilters.searchScope !== 'all' ? debouncedItemFilters.searchScope : '',
      debouncedItemFilters.startDate,
      debouncedItemFilters.endDate,
      debouncedItemFilters.duplicatesOnly,
      debouncedItemFilters.sort !== 'saleDate:desc' ? debouncedItemFilters.sort : '',
    ])
  }, [activeView, debouncedBatchFilters, debouncedItemFilters, debouncedSessionFilters])

  const currentLoading = activeView === 'batch'
    ? batchLoading
    : activeView === 'session'
      ? sessionLoading
      : salesLoading
  const currentHasLoadedOnce = activeView === 'batch'
    ? batchHasLoadedOnce
    : activeView === 'session'
      ? sessionHasLoadedOnce
      : salesHasLoadedOnce
  const currentTotal = activeView === 'batch'
    ? batchTotal
    : activeView === 'session'
      ? sessionTotal
      : itemTotal
  const currentError = activeView === 'batch'
    ? batchError
    : activeView === 'session'
      ? sessionError
      : salesError
  const showInitialLoading = currentLoading && !currentHasLoadedOnce

  const handleRefresh = () => {
    setRefreshToken((current) => current + 1)
  }

  const handleViewChange = (nextView) => {
    if (nextView === activeView) {
      return
    }

    setSessionCreateOpen(false)
    setSessionCreateError('')
    setSessionDetailOpen(false)
    setSessionDetailLoading(false)
    setSessionDetailError('')
    setSelectedSessionId(null)
    setSelectedSessionDetail(null)

    setBatchCreateOpen(false)
    setBatchCreateError('')
    setBatchDetailOpen(false)
    setBatchDetailError('')
    setSelectedBatchId(null)
    setSelectedBatchDetail(null)
    setSelectedBatchAction(null)
    setSaleDetailOpen(false)
    setSaleDetailError('')
    setSelectedSaleId(null)
    setSelectedSaleDetail(null)
    setActiveView(nextView)
  }

  const handleBatchFilterChange = (name, value) => {
    setBatchPage(1)
    setBatchFilters((current) => ({ ...current, [name]: value }))
  }

  const handleItemFilterChange = (name, value) => {
    setItemPage(1)
    setItemFilters((current) => ({ ...current, [name]: value }))
  }

  const handleSessionFilterChange = (name, value) => {
    setSessionPage(1)
    setSessionFilters((current) => ({ ...current, [name]: value }))
  }

  const openSaleDetail = useCallback((saleId) => {
    if (!saleId) return

    setSelectedSaleId(saleId)
    setSaleDetailOpen(true)
  }, [])

  const closeSaleDetail = useCallback(() => {
    setSaleDetailOpen(false)
    setSelectedSaleId(null)
    setSelectedSaleDetail(null)
    setSaleDetailError('')
  }, [])

  const openBatchDetail = useCallback((batchId, initialAction = null) => {
    if (!batchId) return

    setSelectedBatchId(batchId)
    setSelectedBatchAction(initialAction)
    setBatchDetailOpen(true)
  }, [])

  const closeBatchDetail = useCallback(() => {
    setBatchDetailOpen(false)
    setSelectedBatchId(null)
    setSelectedBatchDetail(null)
    setSelectedBatchAction(null)
    setBatchDetailError('')
  }, [])

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

  const handleViewSaleFromBatch = useCallback((saleId) => {
    closeBatchDetail()
    openSaleDetail(saleId)
  }, [closeBatchDetail, openSaleDetail])

  const handleViewBatchFromSession = useCallback((batchId) => {
    closeSessionDetail()
    openBatchDetail(batchId)
  }, [closeSessionDetail, openBatchDetail])

  const handleCreateBatch = useCallback(async (payload) => {
    const response = await batchesApi.createBatch(payload)
    const createdBatch = response?.data || null

    setBatchCreateOpen(false)
    setBatchCreateError('')
    setRefreshToken((current) => current + 1)

    if (createdBatch?._id) {
      setSelectedBatchId(createdBatch._id)
      setSelectedBatchDetail(createdBatch)
      setSelectedBatchAction(null)
      setBatchDetailError('')
      setBatchDetailOpen(true)
    }

    return createdBatch
  }, [])

  const handleCreateSession = useCallback(async (payload) => {
    const response = await captureSessionsApi.createSession(payload)
    const createdSession = response?.data || null

    setSessionCreateOpen(false)
    setSessionCreateError('')
    setRefreshToken((current) => current + 1)

    if (createdSession?._id) {
      setSelectedSessionId(createdSession._id)
      setSelectedSessionDetail(createdSession)
      setSessionDetailError('')
      setSessionDetailOpen(true)
    }

    return createdSession
  }, [])

  const handleCreateSupplierBatchInSession = useCallback(async (sessionId, payload) => {
    const response = await captureSessionsApi.createSupplierBatch(sessionId, payload)
    const data = response?.data || null
    setRefreshToken((current) => current + 1)
    return data
  }, [])

  const handleSessionSubmitAction = useCallback(async (sessionId) => {
    const response = await captureSessionsApi.submitSession(sessionId)
    const data = response?.data || null
    if (selectedSessionId === sessionId) {
      setSelectedSessionDetail(data)
    }
    setRefreshToken((current) => current + 1)
    return data
  }, [selectedSessionId])

  const handleSessionFinalizeAction = useCallback(async (sessionId) => {
    const response = await captureSessionsApi.finalizeSession(sessionId)
    const data = response?.data || null
    if (selectedSessionId === sessionId) {
      setSelectedSessionDetail(data)
    }
    setRefreshToken((current) => current + 1)
    return data
  }, [selectedSessionId])

  const handleSessionCancelAction = useCallback(async (sessionId, reason) => {
    const response = await captureSessionsApi.cancelSession(sessionId, reason)
    const data = response?.data || null
    if (selectedSessionId === sessionId) {
      setSelectedSessionDetail(data)
    }
    setRefreshToken((current) => current + 1)
    return data
  }, [selectedSessionId])

  const handleBatchSubmitAction = useCallback(async (batchId) => {
    const response = await batchesApi.submitBatch(batchId)
    const data = response?.data || null
    if (selectedBatchId === batchId) {
      setSelectedBatchDetail(data)
    }
    setRefreshToken((current) => current + 1)
    return data
  }, [selectedBatchId])

  const handleBatchFinalizeAction = useCallback(async (batchId) => {
    const response = await batchesApi.finalizeBatch(batchId)
    const data = response?.data || null
    if (selectedBatchId === batchId) {
      setSelectedBatchDetail(data)
    }
    setRefreshToken((current) => current + 1)
    return data
  }, [selectedBatchId])

  const handleBatchReopenAction = useCallback(async (batchId, reason) => {
    const response = await batchesApi.reopenBatch(batchId, reason)
    const data = response?.data || null
    if (selectedBatchId === batchId) {
      setSelectedBatchDetail(data)
    }
    setRefreshToken((current) => current + 1)
    return data
  }, [selectedBatchId])

  const handleExport = async (scope) => {
    if (activeView !== 'item') {
      return
    }

    setIsExporting(true)
    setSalesError('')

    try {
      const [sortBy, sortOrder] = splitSort(debouncedItemFilters.sort, 'saleDate:desc')
      const blob = await salesApi.exportSales({
        page: itemPage,
        limit: 10,
        q: debouncedItemFilters.q.trim(),
        searchScope: debouncedItemFilters.searchScope,
        supplier: debouncedItemFilters.supplier || undefined,
        duplicatesOnly: debouncedItemFilters.duplicatesOnly,
        startDate: debouncedItemFilters.startDate,
        endDate: debouncedItemFilters.endDate,
        sortBy,
        sortOrder,
        scope,
      })

      const dateSuffix = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `sales-${scope}-${dateSuffix}.csv`)
    } catch (err) {
      setSalesError(err?.error || err?.message || 'Failed to export sales.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="page-shell space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="Operational Ledger"
        title="Sales"
        description={
          activeView === 'batch'
            ? 'Track batches by supplier, status, and revision.'
            : 'Search the item ledger by supplier, salesman, entry details, date, and sort order.'
        }
        actions={
          <SalesHeaderStats
            total={currentTotal}
            activeFilterCount={activeFilterCount}
            limit={10}
            formatNumber={formatNumber}
            labels={
              activeView === 'session'
                ? {
                    total: 'Matching capture sessions',
                    activeFilters: 'Applied session filters',
                    pageSize: 'Sessions per page',
                  }
                : activeView === 'batch'
                  ? {
                      total: 'Matching batches',
                      activeFilters: 'Applied batch filters',
                      pageSize: 'Batches per page',
                    }
                  : {
                      total: 'Matching sales records',
                      activeFilters: 'Applied search controls',
                      pageSize: 'Rows per page',
                    }
            }
          />
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SalesViewToggle activeView={activeView} onChange={handleViewChange} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {activeView === 'session' ? (
            <button
              type="button"
              className={buttonStyles.primary}
              onClick={() => setSessionCreateOpen(true)}
            >
              Create session
            </button>
          ) : activeView === 'batch' ? (
            <button
              type="button"
              className={buttonStyles.primary}
              onClick={() => setBatchCreateOpen(true)}
            >
              Create batch
            </button>
          ) : null}
          <div className="text-sm text-muted">
            {activeView === 'session'
              ? 'Session View groups supplier batches under one capture umbrella.'
              : activeView === 'batch'
              ? 'Batch View is the default operational workflow.'
              : 'Item View keeps the existing sales ledger intact.'}
          </div>
        </div>
      </div>

      {suppliersLoading ? (
        <div className="rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-4 text-sm text-muted">
          Loading supplier list for filters and batch setup...
        </div>
      ) : null}

      {salesmenLoading ? (
        <div className="rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-4 text-sm text-muted">
          Loading salesman list for session and batch creation...
        </div>
      ) : null}

      {currentError ? (
        <div className="surface-panel-soft panel-border border-red-500/20 text-primary flex items-center justify-between gap-4">
          <span className="font-medium">{currentError}</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none border border-red-500/20 bg-red-500/90 text-white shadow-lg shadow-red-500/20 hover:bg-red-400"
            aria-label="Retry loading records"
            disabled={currentLoading}
          >
            {currentLoading ? (
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

      {activeView === 'session' ? (
        <SectionCard>
          <CaptureSessionFilterBar
            filters={sessionFilters}
            salesmen={salesmen}
            onFilterChange={handleSessionFilterChange}
          />
        </SectionCard>
      ) : activeView === 'batch' ? (
        <SectionCard>
          <BatchFilterBar
            filters={batchFilters}
            suppliers={suppliers}
            onFilterChange={handleBatchFilterChange}
          />
        </SectionCard>
      ) : (
        <SectionCard>
          <SalesFilterBar
            filters={itemFilters}
            suppliers={suppliers}
            onFilterChange={handleItemFilterChange}
            onExport={handleExport}
            isExporting={isExporting}
          />
        </SectionCard>
      )}

      {activeView === 'session' ? (
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
      ) : activeView === 'batch' ? (
        <BatchRecordsTable
          batches={batches}
          loading={showInitialLoading}
          page={batchPage}
          pages={batchPages}
          total={batchTotal}
          limit={10}
          onPageChange={setBatchPage}
          onViewBatch={(batchId, action = null) => openBatchDetail(batchId, action)}
          onSubmitBatch={(batchId) => openBatchDetail(batchId, 'submit')}
          onFinalizeBatch={(batchId) => openBatchDetail(batchId, 'finalize')}
          onReopenBatch={(batchId) => openBatchDetail(batchId, 'reopen')}
          onViewRevisions={(batchId) => openBatchDetail(batchId, 'revisions')}
          viewingBatchId={selectedBatchId}
          actionLoadingBatchId={batchDetailLoading ? selectedBatchId : null}
          currentUserRole={currentUserRole}
        />
      ) : (
        <SalesRecordsTable
          sales={sales}
          loading={showInitialLoading}
          page={itemPage}
          pages={itemPages}
          total={itemTotal}
          limit={10}
          onPageChange={setItemPage}
          onViewDetail={openSaleDetail}
          viewingSaleId={selectedSaleId}
          detailLoading={saleDetailLoading}
        />
      )}

      <BatchDetailModal
        open={batchDetailOpen}
        batch={selectedBatchDetail}
        loading={batchDetailLoading}
        error={batchDetailError}
        onClose={closeBatchDetail}
        onViewSale={handleViewSaleFromBatch}
        onSubmitBatch={handleBatchSubmitAction}
        onFinalizeBatch={handleBatchFinalizeAction}
        onReopenBatch={handleBatchReopenAction}
        currentUserRole={currentUserRole}
        initialAction={selectedBatchAction}
      />

      <BatchCreateModal
        open={batchCreateOpen}
        suppliers={suppliers}
        users={salesmen}
        currentUser={currentUser}
        currentUserRole={currentUserRole}
        loading={suppliersLoading || salesmenLoading}
        error={batchCreateError}
        onClose={() => {
          setBatchCreateOpen(false)
          setBatchCreateError('')
        }}
        onCreate={handleCreateBatch}
      />

      <CaptureSessionDetailModal
        open={sessionDetailOpen}
        session={selectedSessionDetail}
        loading={sessionDetailLoading}
        error={sessionDetailError}
        suppliers={suppliers}
        currentUserRole={currentUserRole}
        onClose={closeSessionDetail}
        onViewBatch={handleViewBatchFromSession}
        onCreateSupplierBatch={handleCreateSupplierBatchInSession}
        onSubmitSession={handleSessionSubmitAction}
        onFinalizeSession={handleSessionFinalizeAction}
        onCancelSession={handleSessionCancelAction}
      />

      <CaptureSessionCreateModal
        open={sessionCreateOpen}
        users={salesmen}
        currentUser={currentUser}
        currentUserRole={currentUserRole}
        loading={salesmenLoading}
        error={sessionCreateError}
        onClose={() => {
          setSessionCreateOpen(false)
          setSessionCreateError('')
        }}
        onCreate={handleCreateSession}
      />

      <SaleDetailModal
        open={saleDetailOpen}
        sale={selectedSaleDetail}
        loading={saleDetailLoading}
        error={saleDetailError}
        onClose={closeSaleDetail}
      />
    </div>
  )
}
