import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import { formatCurrency, formatNumber, formatWeight } from '../../utils/formatters'
import { downloadBlob, buttonStyles } from '../sales/salesPage.utils'
import { settlementReportsApi } from '../../api/settlementReports.api'
import { batchesApi } from '../../api/batches.api'
import { salesApi } from '../../api/sales.api'
import { captureSessionsApi } from '../../api/captureSessions.api'
import { getSuppliers } from '../../api/suppliers.api'
import { usersApi } from '../../api/users.api'
import { normalizeText } from './workflow.utils'
import SettlementReportsViewToggle from './components/SettlementReportsViewToggle'
import SettlementReportsFiltersBar from './components/SettlementReportsFiltersBar'
import SettlementReportsSummary from './components/SettlementReportsSummary'
import SessionReportsTable from './components/SessionReportsTable'
import SupplierSectionReportsTable from './components/SupplierSectionReportsTable'
import SettlementReportsTable from './components/SettlementReportsTable'
import CaptureSessionDetailModal from '../sales/components/CaptureSessionDetailModal'
import BatchDetailModal from '../sales/components/BatchDetailModal'
import SaleDetailModal from '../sales/components/SaleDetailModal'

const REPORT_PAGE_SIZE_DEFAULT = 10

const splitSort = (sortValue, fallback) => {
  const [fallbackField, fallbackOrder] = fallback.split(':')
  const [field, order] = String(sortValue || fallback).split(':')
  return [field || fallbackField, order || fallbackOrder]
}

const countActiveValues = (values = []) =>
  values.filter((value) => value !== null && value !== undefined && value !== '' && value !== false).length

const createInitialSessionFilters = () => ({
  search: '',
  customer: '',
  assignedSalesman: '',
  status: '',
  startDate: '',
  endDate: '',
  sort: 'updatedAt:desc',
})

const createInitialSectionFilters = () => ({
  search: '',
  supplier: '',
  session: '',
  assignedSalesman: '',
  status: '',
  startDate: '',
  endDate: '',
  sort: 'updatedAt:desc',
})

const createInitialItemFilters = () => ({
  search: '',
  supplier: '',
  category: '',
  startDate: '',
  endDate: '',
})

const buildSessionApiFilters = (filters, page, limit) => {
  const [sortBy, sortOrder] = splitSort(filters.sort, 'updatedAt:desc')
  return {
    scope: 'session',
    page,
    limit,
    search: normalizeText(filters.search),
    customer: normalizeText(filters.customer),
    assignedSalesman: normalizeText(filters.assignedSalesman),
    status: normalizeText(filters.status),
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    sortBy,
    sortOrder,
  }
}

const buildSectionApiFilters = (filters, page, limit) => {
  const [sortBy, sortOrder] = splitSort(filters.sort, 'updatedAt:desc')
  return {
    scope: 'supplier-section',
    page,
    limit,
    search: normalizeText(filters.search),
    supplier: normalizeText(filters.supplier),
    session: normalizeText(filters.session),
    assignedSalesman: normalizeText(filters.assignedSalesman),
    status: normalizeText(filters.status),
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    sortBy,
    sortOrder,
  }
}

const buildItemApiFilters = (filters, page, limit) => ({
  scope: 'item-ledger',
  page,
  limit,
  search: normalizeText(filters.search),
  supplier: normalizeText(filters.supplier),
  category: normalizeText(filters.category),
  startDate: filters.startDate || undefined,
  endDate: filters.endDate || undefined,
})

const resolveSessionRowId = (session = {}) => session?.id || session?._id || session?.sessionId || null

const resolveSectionRowId = (section = {}) => section?.batchId || section?.id || section?._id || null

const buildItemVisibleRows = (rows, filters) => {
  const searchTerm = normalizeText(filters.search).toLowerCase()
  const supplierTerm = normalizeText(filters.supplier).toLowerCase()
  const categoryTerm = normalizeText(filters.category).toLowerCase()
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (supplierTerm && !normalizeText(row.supplier).toLowerCase().includes(supplierTerm)) {
      return false
    }

    if (categoryTerm && !normalizeText(row.category).toLowerCase().includes(categoryTerm)) {
      return false
    }

    if (!searchTerm) {
      return true
    }

    const itemCode = normalizeText(row.item_code || row.design_code).toLowerCase()
    const supplier = normalizeText(row.supplier).toLowerCase()
    const category = normalizeText(row.category).toLowerCase()
    const purity = normalizeText(row.purity).toLowerCase()
    const notes = normalizeText(row.notes).toLowerCase()
    const batchRef = normalizeText(row.batchRef).toLowerCase()
    const sessionRef = normalizeText(row.sessionRef).toLowerCase()

    return (
      supplier.includes(searchTerm) ||
      category.includes(searchTerm) ||
      itemCode.includes(searchTerm) ||
      purity.includes(searchTerm) ||
      notes.includes(searchTerm) ||
      batchRef.includes(searchTerm) ||
      sessionRef.includes(searchTerm)
    )
  })
}

const getSettlementExportErrorMessage = (error) => {
  const code = String(error?.code || '').toUpperCase()

  switch (code) {
    case 'INVALID_ID':
      return 'The selected report target is invalid.'
    case 'NOT_FOUND':
      return 'The requested session or supplier section could not be found.'
    case 'FORBIDDEN':
      return 'You do not have permission to export this report.'
    case 'SESSION_NOT_FINALIZED':
      return 'Finalize the session before exporting the official combined report.'
    case 'SESSION_HAS_PENDING_CHANGES':
      return 'One or more supplier sections still have pending changes. Finalize them first.'
    case 'BATCH_NOT_FINALIZED':
      return 'Finalize the supplier section before exporting it.'
    case 'REVISION_NOT_FOUND':
      return 'The selected revision could not be found.'
    case 'REVISION_NOT_FINALIZED':
      return 'Select a finalized revision to export.'
    case 'EXPORT_FAILED':
      return 'The export could not be generated. Try again.'
    default:
      return error?.error || error?.message || 'Something went wrong while preparing the export.'
  }
}

const makeDownloadKey = (scope, id, kind) => `${scope}:${id}:${kind}`

const useReportScope = ({
  scope,
  activeScope,
  refreshToken,
  initialFilters,
  buildApiFilters,
  isPaginated = true,
}) => {
  const [filters, setFilters] = useState(initialFilters())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(REPORT_PAGE_SIZE_DEFAULT)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [error, setError] = useState('')
  const debouncedFilters = useDebouncedValue(filters, 250)
  const requestPage = isPaginated ? page : 1
  const requestLimit = isPaginated ? pageSize : REPORT_PAGE_SIZE_DEFAULT

  const apiFilters = useMemo(
    () => buildApiFilters(debouncedFilters, requestPage, requestLimit),
    [buildApiFilters, debouncedFilters, requestLimit, requestPage],
  )

  useEffect(() => {
    if (activeScope !== scope) {
      return undefined
    }

    let active = true

    const loadData = async () => {
      setLoading(true)
      setError('')

      try {
        const [summaryResponse, listResponse] = await Promise.all([
          settlementReportsApi.getSummary(apiFilters),
          settlementReportsApi.listReports(apiFilters),
        ])

        if (!active) return

        setSummary(summaryResponse?.data ?? null)

        if (scope === 'item-ledger') {
          setRows(Array.isArray(listResponse?.data) ? listResponse.data : [])
          setTotal(Array.isArray(listResponse?.data) ? listResponse.data.length : 0)
          setPages(1)
          setPage(1)
        } else {
          const data = listResponse?.data || {}
          setRows(Array.isArray(data.rows) ? data.rows : [])
          setTotal(Number(data.total) || 0)
          setPages(Number(data.pages) || 1)
          setPage(Number(data.page) || 1)
        }
      } catch (err) {
        if (!active) return
        setError(err?.error || err?.message || 'Failed to load settlement reports.')
        setRows([])
        setTotal(0)
        setPages(1)
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
  }, [activeScope, apiFilters, refreshToken, requestPage, scope, isPaginated])

  useEffect(() => {
    setPage(1)
  }, [
    debouncedFilters.search,
    debouncedFilters.supplier,
    debouncedFilters.category,
    debouncedFilters.customer,
    debouncedFilters.assignedSalesman,
    debouncedFilters.session,
    debouncedFilters.status,
    debouncedFilters.startDate,
    debouncedFilters.endDate,
    debouncedFilters.sort,
  ])

  const updateFilter = useCallback((name, value) => {
    setPage(1)
    setFilters((current) => ({ ...current, [name]: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setPage(1)
    setFilters(initialFilters())
  }, [initialFilters])

  const activeFilterCount = useMemo(() => {
    if (scope === 'session') {
      return countActiveValues([
        debouncedFilters.search,
        debouncedFilters.customer,
        debouncedFilters.assignedSalesman,
        debouncedFilters.status,
        debouncedFilters.startDate,
        debouncedFilters.endDate,
        debouncedFilters.sort !== 'updatedAt:desc' ? debouncedFilters.sort : '',
      ])
    }

    if (scope === 'supplier-section') {
      return countActiveValues([
        debouncedFilters.search,
        debouncedFilters.supplier,
        debouncedFilters.session,
        debouncedFilters.assignedSalesman,
        debouncedFilters.status,
        debouncedFilters.startDate,
        debouncedFilters.endDate,
        debouncedFilters.sort !== 'updatedAt:desc' ? debouncedFilters.sort : '',
      ])
    }

    return countActiveValues([
      debouncedFilters.search,
      debouncedFilters.supplier,
      debouncedFilters.category,
    debouncedFilters.startDate,
      debouncedFilters.endDate,
    ])
  }, [debouncedFilters, scope])

  return {
    filters,
    setFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    pages,
    total,
    rows,
    summary,
    loading,
    hasLoadedOnce,
    error,
    setError,
    updateFilter,
    resetFilters,
    activeFilterCount,
    apiFilters,
  }
}

export default function SettlementReportsPage() {
  const currentUser = useAuthStore((state) => state.user || null)
  const currentUserRole = currentUser?.role || ''

  const [activeScope, setActiveScope] = useState('session')
  const [refreshToken, setRefreshToken] = useState(0)

  const [suppliers, setSuppliers] = useState([])
  const [suppliersLoading, setSuppliersLoading] = useState(true)
  const [salesmen, setSalesmen] = useState([])
  const [salesmenLoading, setSalesmenLoading] = useState(true)

  const sessionScope = useReportScope({
    scope: 'session',
    activeScope,
    refreshToken,
    initialFilters: createInitialSessionFilters,
    buildApiFilters: buildSessionApiFilters,
    isPaginated: true,
  })

  const supplierSectionScope = useReportScope({
    scope: 'supplier-section',
    activeScope,
    refreshToken,
    initialFilters: createInitialSectionFilters,
    buildApiFilters: buildSectionApiFilters,
    isPaginated: true,
  })

  const itemLedgerScope = useReportScope({
    scope: 'item-ledger',
    activeScope,
    refreshToken,
    initialFilters: createInitialItemFilters,
    buildApiFilters: buildItemApiFilters,
    isPaginated: false,
  })

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

  const [sessionDetailOpen, setSessionDetailOpen] = useState(false)
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false)
  const [sessionDetailError, setSessionDetailError] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [selectedSessionDetail, setSelectedSessionDetail] = useState(null)

  const [isExporting, setIsExporting] = useState(false)
  const [activeDownloadKey, setActiveDownloadKey] = useState('')
  const [exportError, setExportError] = useState('')
  const activeDownloadLockRef = useRef('')

  const itemVisibleRows = useMemo(
    () => buildItemVisibleRows(itemLedgerScope.rows, itemLedgerScope.filters),
    [itemLedgerScope.rows, itemLedgerScope.filters],
  )

  const itemTotal = itemVisibleRows.length
  const itemPages = Math.max(1, Math.ceil(itemTotal / itemLedgerScope.pageSize))
  const itemSafePage = Math.min(itemLedgerScope.page, itemPages)
  const itemStartIndex = itemTotal === 0 ? 0 : (itemSafePage - 1) * itemLedgerScope.pageSize
  const itemPageRows = useMemo(
    () => itemVisibleRows.slice(itemStartIndex, itemStartIndex + itemLedgerScope.pageSize),
    [itemLedgerScope.pageSize, itemStartIndex, itemVisibleRows],
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

  const currentScope = activeScope === 'session'
    ? sessionScope
    : activeScope === 'supplier-section'
      ? supplierSectionScope
      : itemLedgerScope

  const currentLoading = currentScope.loading
  const currentHasLoadedOnce = currentScope.hasLoadedOnce
  const currentError = currentScope.error
  const showInitialLoading = currentLoading && !currentHasLoadedOnce

  const handleRefresh = () => {
    setRefreshToken((current) => current + 1)
  }

  const handleScopeChange = (nextScope) => {
    if (nextScope === activeScope) return

    setExportError('')
    setActiveDownloadKey('')
    activeDownloadLockRef.current = ''

    setSaleDetailOpen(false)
    setSaleDetailError('')
    setSelectedSaleId(null)
    setSelectedSaleDetail(null)

    setBatchDetailOpen(false)
    setBatchDetailError('')
    setSelectedBatchId(null)
    setSelectedBatchDetail(null)
    setSelectedBatchAction(null)

    setSessionDetailOpen(false)
    setSessionDetailError('')
    setSelectedSessionId(null)
    setSelectedSessionDetail(null)

    setActiveScope(nextScope)
  }

  const handleViewSession = useCallback((sessionId) => {
    if (!sessionId) return
    setSelectedSessionId(String(sessionId))
    setSessionDetailOpen(true)
  }, [])

  const closeSessionDetail = useCallback(() => {
    setSessionDetailOpen(false)
    setSelectedSessionId(null)
    setSelectedSessionDetail(null)
    setSessionDetailError('')
    setSessionDetailLoading(false)
  }, [])

  const handleViewSection = useCallback((batchId, action = null) => {
    if (!batchId) return
    setSelectedBatchId(String(batchId))
    setSelectedBatchAction(action)
    setBatchDetailOpen(true)
  }, [])

  const closeBatchDetail = useCallback(() => {
    setBatchDetailOpen(false)
    setSelectedBatchId(null)
    setSelectedBatchDetail(null)
    setSelectedBatchAction(null)
    setBatchDetailError('')
  }, [])

  const handleViewSale = useCallback((saleId) => {
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

  const handleViewBatchFromSession = useCallback((batchId) => {
    closeSessionDetail()
    handleViewSection(batchId)
  }, [closeSessionDetail, handleViewSection])

  const handleViewSaleFromBatch = useCallback((saleId) => {
    closeBatchDetail()
    handleViewSale(saleId)
  }, [closeBatchDetail, handleViewSale])

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

  const handleExportCsv = async () => {
    if (activeScope !== 'item-ledger') return

    setIsExporting(true)
    try {
      const blob = await settlementReportsApi.exportCsv(buildItemApiFilters(itemLedgerScope.filters, 1, itemLedgerScope.pageSize))
      const stamp = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `settlement-item-ledger-${stamp}.csv`)
    } catch (err) {
      itemLedgerScope.setError(err?.error || err?.message || 'Failed to export CSV.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPdf = async () => {
    if (activeScope !== 'item-ledger') return

    setIsExporting(true)
    try {
      const token = useAuthStore.getState().token
      const filters = buildItemApiFilters(itemLedgerScope.filters, 1, itemLedgerScope.pageSize)
      const query = new URLSearchParams()
      if (token) query.set('token', token)
      if (filters.search) query.set('search', filters.search)
      if (filters.supplier) query.set('supplier', filters.supplier)
      if (filters.category) query.set('category', filters.category)
      const karatFilter = filters.karat || filters.metalType
      if (karatFilter) query.set('karat', karatFilter)
      if (filters.startDate) query.set('startDate', filters.startDate)
      if (filters.endDate) query.set('endDate', filters.endDate)

      const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
      const previewUrl = `${apiBase}/api/v1/reports/settlement/export.html?${query.toString()}`
      window.open(previewUrl, '_blank')
    } catch (err) {
      itemLedgerScope.setError(err?.error || err?.message || 'Failed to open print view.')
    } finally {
      setIsExporting(false)
    }
  }

  const runScopedDownload = useCallback(async (downloadKey, task) => {
    if (activeDownloadLockRef.current) {
      return
    }

    activeDownloadLockRef.current = downloadKey
    setActiveDownloadKey(downloadKey)
    setExportError('')

    try {
      await task()
    } catch (err) {
      setExportError(getSettlementExportErrorMessage(err))
    } finally {
      activeDownloadLockRef.current = ''
      setActiveDownloadKey('')
    }
  }, [])

  const handleDownloadSessionCsv = useCallback((session) => {
    const sessionId = resolveSessionRowId(session)
    if (!sessionId) return
    void runScopedDownload(
      makeDownloadKey('session', sessionId, 'csv'),
      () => settlementReportsApi.downloadSessionSettlementCsv(sessionId),
    )
  }, [runScopedDownload])

  const handleDownloadSessionPdf = useCallback((session) => {
    const sessionId = resolveSessionRowId(session)
    if (!sessionId) return
    const token = useAuthStore.getState().token
    const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
    const previewUrl = `${apiBase}/api/v1/reports/settlement/sessions/${sessionId}/export.html?token=${token}`
    window.open(previewUrl, '_blank')
  }, [])

  const handleDownloadSectionCsv = useCallback((section) => {
    const sectionId = resolveSectionRowId(section)
    if (!sectionId) return
    void runScopedDownload(
      makeDownloadKey('section', sectionId, 'csv'),
      () => settlementReportsApi.downloadSupplierSectionCsv(sectionId),
    )
  }, [runScopedDownload])

  const handleDownloadSectionPdf = useCallback((section) => {
    const sectionId = resolveSectionRowId(section)
    if (!sectionId) return
    const token = useAuthStore.getState().token
    const revision = section?.revision
    const revisionQuery = revision !== undefined && revision !== null && revision !== '' ? `&revision=${encodeURIComponent(String(revision))}` : ''
    const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
    const previewUrl = `${apiBase}/api/v1/reports/settlement/supplier-sections/${sectionId}/export.html?token=${token}${revisionQuery}`
    window.open(previewUrl, '_blank')
  }, [])

  const pageDescription = activeScope === 'session'
    ? 'Session Reports is the default operational view. It rolls supplier sections up under the capture session umbrella.'
    : activeScope === 'supplier-section'
      ? 'Supplier Section Reports shows finalized batch-level reporting and revision-safe supplier sections.'
      : 'Item Ledger keeps the existing item-level audit trail and export flow.'

  return (
    <div className="page-shell space-y-8 animate-fade-in">
      <PageHeader
        eyebrow="Settlement Reports"
        title="Settlement Reports"
        description={pageDescription}
        actions={
          <SettlementReportsSummary
            scope={activeScope}
            summary={currentScope.summary}
            loading={showInitialLoading}
            formatWeight={formatWeight}
            formatCurrency={formatCurrency}
            formatNumber={formatNumber}
          />
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SettlementReportsViewToggle activeScope={activeScope} onChange={handleScopeChange} />
        <div className="text-sm text-muted">
          {activeScope === 'session'
            ? 'Session reports should be finalized before settlement review.'
            : activeScope === 'supplier-section'
              ? 'Supplier sections stay final only after the batch revision is locked.'
              : 'Item ledger export remains available only in this view.'}
        </div>
      </div>

      {suppliersLoading ? (
        <div className="rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-4 text-sm text-muted">
          Loading supplier list for filters and report drill-downs...
        </div>
      ) : null}

      {salesmenLoading ? (
        <div className="rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-4 text-sm text-muted">
          Loading salesman list for session and supplier-section filters...
        </div>
      ) : null}

      {currentError ? (
        <div className="surface-panel-soft panel-border border-red-500/20 text-primary flex items-center justify-between gap-4">
          <span className="font-medium">{currentError}</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none border border-red-500/20 bg-red-500/90 text-white shadow-lg shadow-red-500/20 hover:bg-red-400"
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

      {exportError ? (
        <div className="surface-panel-soft panel-border border-red-500/20 text-primary flex items-center justify-between gap-4" role="alert">
          <span className="font-medium">{exportError}</span>
          <button
            type="button"
            onClick={() => setExportError('')}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none border border-red-500/20 bg-red-500/90 text-white shadow-lg shadow-red-500/20 hover:bg-red-400"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <SectionCard>
        <SettlementReportsFiltersBar
          scope={activeScope}
          filters={currentScope.filters}
          suppliers={suppliers}
          salesmen={salesmen}
          onFilterChange={currentScope.updateFilter}
          onResetFilters={currentScope.resetFilters}
          onRefresh={handleRefresh}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          isExporting={isExporting}
          canExport={activeScope === 'item-ledger' && itemVisibleRows.length > 0 && !itemLedgerScope.loading}
          activeFilterCount={currentScope.activeFilterCount}
        />
      </SectionCard>

      {activeScope === 'session' ? (
        <SessionReportsTable
          sessions={sessionScope.rows}
          loading={showInitialLoading}
          page={sessionScope.page}
          pages={sessionScope.pages}
          total={sessionScope.total}
          limit={sessionScope.pageSize}
          onPageChange={sessionScope.setPage}
          onLimitChange={(nextLimit) => {
            sessionScope.setPage(1)
            sessionScope.setPageSize(nextLimit)
          }}
          onViewSession={handleViewSession}
          onDownloadSessionCsv={handleDownloadSessionCsv}
          onDownloadSessionPdf={handleDownloadSessionPdf}
          viewingSessionId={selectedSessionId}
          actionLoadingSessionId={sessionDetailLoading ? selectedSessionId : null}
          activeDownloadKey={activeDownloadKey}
        />
      ) : activeScope === 'supplier-section' ? (
        <SupplierSectionReportsTable
          sections={supplierSectionScope.rows}
          loading={showInitialLoading}
          page={supplierSectionScope.page}
          pages={supplierSectionScope.pages}
          total={supplierSectionScope.total}
          limit={supplierSectionScope.pageSize}
          onPageChange={supplierSectionScope.setPage}
          onLimitChange={(nextLimit) => {
            supplierSectionScope.setPage(1)
            supplierSectionScope.setPageSize(nextLimit)
          }}
          onViewSection={(batchId, action = null) => handleViewSection(batchId, action)}
          onDownloadSectionCsv={handleDownloadSectionCsv}
          onDownloadSectionPdf={handleDownloadSectionPdf}
          viewingSectionId={selectedBatchId}
          activeDownloadKey={activeDownloadKey}
        />
      ) : (
        <SettlementReportsTable
          rows={itemPageRows}
          loading={showInitialLoading}
          onViewDetail={handleViewSale}
        />
      )}

      {!showInitialLoading && activeScope === 'item-ledger' && itemVisibleRows.length > 0 ? (
        <SectionCard className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted">
            Showing {itemVisibleRows.length === 0 ? 0 : itemStartIndex + 1}-{Math.min(itemStartIndex + itemPageRows.length, itemVisibleRows.length)} of {itemVisibleRows.length} settlement rows
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="field m-0">
              <span className="field-label">Rows per page</span>
              <select
                className="input min-w-[120px]"
                value={itemLedgerScope.pageSize}
                onChange={(event) => {
                  itemLedgerScope.setPage(1)
                  itemLedgerScope.setPageSize(Number(event.target.value))
                }}
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
                onClick={() => itemLedgerScope.setPage(Math.max(1, itemLedgerScope.page - 1))}
                disabled={itemLedgerScope.page <= 1}
              >
                Previous
              </button>
              <div className="min-w-16 text-center text-sm font-semibold text-heading">
                {itemSafePage} / {itemPages}
              </div>
              <button
                type="button"
                className={buttonStyles.secondary}
                onClick={() => itemLedgerScope.setPage(Math.min(itemPages, itemLedgerScope.page + 1))}
                disabled={itemLedgerScope.page >= itemPages}
              >
                Next
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}

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
