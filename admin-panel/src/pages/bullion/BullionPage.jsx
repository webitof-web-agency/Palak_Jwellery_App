import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { bullionApi } from '../../api/bullion'
import ActionToast from '../../components/ui/ActionToast'
import EmptyState from '../../components/ui/EmptyState'
import MetricCard from '../../components/ui/MetricCard'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import TableSkeleton from '../../components/ui/TableSkeleton'
import useDebouncedValue from '../../hooks/useDebouncedValue'

const SALES_PAGE_SIZE = 10
const PURCHASE_ORDER_PAGE_SIZE = 8

const salesTypeOptions = [
  { label: 'All Types', value: 'all' },
  { label: 'Sales', value: 'sale' },
  { label: 'Returns', value: 'return' },
]

const purchaseStatusOptions = [
  { label: 'All Orders', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Done', value: 'done' },
]

const tabOptions = [
  { label: 'Sales', value: 'sales' },
  { label: 'Analytics', value: 'analytics' },
  { label: 'Settings', value: 'settings' },
]

const formatWeight = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0.000'
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}

const formatMoney = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0.00'
  return numeric.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const safeText = (value, fallback = '-') => {
  const text = String(value || '').trim()
  return text || fallback
}

const normalizeSalesResponse = (response) => {
  if (Array.isArray(response?.sales)) {
    return {
      rows: response.sales,
      pagination: {
        page: Number(response.page) || 1,
        limit: Number(response.limit) || SALES_PAGE_SIZE,
        pages: Number(response.pages) || 1,
        total: Number(response.total) || 0,
      },
    }
  }

  if (Array.isArray(response?.data?.sales)) {
    return {
      rows: response.data.sales,
      pagination: response.data.pagination || {
        page: Number(response.data.page) || 1,
        limit: Number(response.data.limit) || SALES_PAGE_SIZE,
        pages: Number(response.data.pages) || 1,
        total: Number(response.data.total) || 0,
      },
    }
  }

  return {
    rows: [],
    pagination: {
      page: 1,
      limit: SALES_PAGE_SIZE,
      pages: 1,
      total: 0,
    },
  }
}

const normalizePurchaseOrdersResponse = (response) => {
  if (Array.isArray(response?.purchaseOrders)) {
    return {
      rows: response.purchaseOrders,
      pagination: {
        page: Number(response.page) || 1,
        limit: Number(response.limit) || PURCHASE_ORDER_PAGE_SIZE,
        pages: Number(response.pages) || 1,
        total: Number(response.total) || 0,
      },
    }
  }

  if (Array.isArray(response?.data?.purchaseOrders)) {
    return {
      rows: response.data.purchaseOrders,
      pagination: response.data.pagination || {
        page: Number(response.data.page) || 1,
        limit: Number(response.data.limit) || PURCHASE_ORDER_PAGE_SIZE,
        pages: Number(response.data.pages) || 1,
        total: Number(response.data.total) || 0,
      },
    }
  }

  return {
    rows: [],
    pagination: {
      page: 1,
      limit: PURCHASE_ORDER_PAGE_SIZE,
      pages: 1,
      total: 0,
    },
  }
}



const DialogShell = ({ open, title, description, onClose, children, footer }) => {
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-2xl overflow-hidden premium-shadow">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <h3 className="text-2xl font-bold text-heading font-display">{title}</h3>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-white/10"
            aria-label="Close dialog"
          >
            Close
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-6 py-5">{children}</div>

        {footer ? (
          <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-5 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

const TabButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] transition-all focus:outline-none focus:ring-0 ${
      active
        ? 'border-gold-500/50 bg-gold-500/10 text-gold-500'
        : 'surface-panel-soft panel-border text-muted hover:text-primary hover:border-gold-500/30 hover:bg-gold-500/10'
    }`}
  >
    {children}
  </button>
)

const FilterLabel = ({ children }) => (
  <label className="block text-[10px] font-bold uppercase tracking-widest text-faint">
    {children}
  </label>
)

const RowBadge = ({ children, tone = 'muted' }) => {
  const toneClasses = {
    muted: 'border-white/10 bg-white/5 text-muted',
    gold: 'border-gold-500/30 bg-gold-500/10 text-gold-500',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
    danger: 'border-red-500/30 bg-red-500/10 text-red-500',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
        toneClasses[tone] || toneClasses.muted
      }`}
    >
      {children}
    </span>
  )
}

export default function BullionPage() {
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('sales')

  const [salesSearch, setSalesSearch] = useState('')
  const debouncedSalesSearch = useDebouncedValue(salesSearch.trim(), 300)
  const [salesTypeFilter, setSalesTypeFilter] = useState('all')
  const [salesStartDate, setSalesStartDate] = useState('')
  const [salesEndDate, setSalesEndDate] = useState('')
  const [salesPage, setSalesPage] = useState(1)
  const [salesPagination, setSalesPagination] = useState({
    page: 1,
    limit: SALES_PAGE_SIZE,
    pages: 1,
    total: 0,
  })
  const [salesRows, setSalesRows] = useState([])
  const [salesLoading, setSalesLoading] = useState(true)
  const [salesError, setSalesError] = useState('')

  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState('')

  const [inventory, setInventory] = useState(null)
  const [inventoryLoading, setInventoryLoading] = useState(true)
  const [inventoryError, setInventoryError] = useState('')
  const [inventorySaving, setInventorySaving] = useState(false)
  const [inventoryForm, setInventoryForm] = useState({
    currentStockGrams: '',
    currentMarketRatePerGram: '',
    notes: '',
  })

  const [purchaseOrderStatus, setPurchaseOrderStatus] = useState('all')
  const [purchaseOrderPage, setPurchaseOrderPage] = useState(1)
  const [purchaseOrderPagination, setPurchaseOrderPagination] = useState({
    page: 1,
    limit: PURCHASE_ORDER_PAGE_SIZE,
    pages: 1,
    total: 0,
  })
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [purchaseOrdersLoading, setPurchaseOrdersLoading] = useState(true)
  const [purchaseOrdersError, setPurchaseOrdersError] = useState('')

  const [createOrderOpen, setCreateOrderOpen] = useState(false)
  const [createOrderSaving, setCreateOrderSaving] = useState(false)
  const [createOrderForm, setCreateOrderForm] = useState({
    suggestedGrams: '',
    requestedGrams: '',
    notes: '',
  })

  const [markDoneOpen, setMarkDoneOpen] = useState(false)
  const [markDoneSaving, setMarkDoneSaving] = useState(false)
  const [activeOrder, setActiveOrder] = useState(null)
  const [markDoneForm, setMarkDoneForm] = useState({
    purchasedGrams: '',
    purchasePricePerGram: '',
    notes: '',
  })

  const [toast, setToast] = useState({ message: '', tone: 'success' })

  const totalSales = salesPagination.total || 0
  const salesStartIndex = totalSales === 0 ? 0 : (salesPagination.page - 1) * salesPagination.limit + 1
  const salesEndIndex = totalSales === 0 ? 0 : Math.min(salesPagination.page * salesPagination.limit, totalSales)

  const totalPurchaseOrders = purchaseOrderPagination.total || 0
  const purchaseOrdersStartIndex =
    totalPurchaseOrders === 0 ? 0 : (purchaseOrderPagination.page - 1) * purchaseOrderPagination.limit + 1
  const purchaseOrdersEndIndex =
    totalPurchaseOrders === 0
      ? 0
      : Math.min(purchaseOrderPagination.page * purchaseOrderPagination.limit, totalPurchaseOrders)

  const showSalesInitialLoading = salesLoading && salesRows.length === 0
  const showAnalyticsInitialLoading = analyticsLoading && !analytics
  const showInventoryInitialLoading = inventoryLoading && !inventory
  const showPurchaseInitialLoading = purchaseOrdersLoading && purchaseOrders.length === 0

  const refreshSales = useCallback(async () => {
    setSalesLoading(true)
    setSalesError('')

    try {
      const response = await bullionApi.getBullionSales({
        page: salesPage,
        limit: SALES_PAGE_SIZE,
        q: debouncedSalesSearch || undefined,
        transactionType: salesTypeFilter !== 'all' ? salesTypeFilter : undefined,
        startDate: salesStartDate || undefined,
        endDate: salesEndDate || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })

      const { rows, pagination } = normalizeSalesResponse(response)
      setSalesRows(rows)
      setSalesPagination(pagination)
      setSalesPage(Number(pagination.page) || 1)
    } catch (error) {
      setSalesRows([])
      setSalesError(error?.error || error?.message || 'Failed to load bullion sales')
    } finally {
      setSalesLoading(false)
    }
  }, [debouncedSalesSearch, salesEndDate, salesPage, salesStartDate, salesTypeFilter])

  const refreshAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    setAnalyticsError('')

    try {
      const response = await bullionApi.getBullionAnalytics()
      setAnalytics(response?.data || response || null)
    } catch (error) {
      setAnalytics(null)
      setAnalyticsError(error?.error || error?.message || 'Failed to load analytics summary')
    } finally {
      setAnalyticsLoading(false)
    }
  }, [])

  const refreshInventory = useCallback(async () => {
    setInventoryLoading(true)
    setInventoryError('')

    try {
      const response = await bullionApi.getBullionInventory()
      const nextInventory = response?.data || response || null
      setInventory(nextInventory)
      setInventoryForm({
        currentStockGrams: Number(nextInventory?.currentStockGrams ?? 0).toString(),
        currentMarketRatePerGram: Number(nextInventory?.currentMarketRatePerGram ?? 0).toString(),
        notes: nextInventory?.notes || '',
      })
    } catch (error) {
      setInventory(null)
      setInventoryError(error?.error || error?.message || 'Failed to load inventory settings')
    } finally {
      setInventoryLoading(false)
    }
  }, [])

  const refreshPurchaseOrders = useCallback(async () => {
    setPurchaseOrdersLoading(true)
    setPurchaseOrdersError('')

    try {
      const response = await bullionApi.getBullionPurchaseOrders({
        page: purchaseOrderPage,
        limit: PURCHASE_ORDER_PAGE_SIZE,
        status: purchaseOrderStatus !== 'all' ? purchaseOrderStatus : undefined,
      })

      const { rows, pagination } = normalizePurchaseOrdersResponse(response)
      setPurchaseOrders(rows)
      setPurchaseOrderPagination(pagination)
      setPurchaseOrderPage(Number(pagination.page) || 1)
    } catch (error) {
      setPurchaseOrders([])
      setPurchaseOrdersError(error?.error || error?.message || 'Failed to load purchase orders')
    } finally {
      setPurchaseOrdersLoading(false)
    }
  }, [purchaseOrderPage, purchaseOrderStatus])

  useEffect(() => {
    void refreshSales()
  }, [refreshSales])

  useEffect(() => {
    void refreshAnalytics()
    void refreshInventory()
    void refreshPurchaseOrders()
  }, [refreshAnalytics, refreshInventory, refreshPurchaseOrders])

  useEffect(() => {
    setSalesPage(1)
  }, [debouncedSalesSearch, salesEndDate, salesStartDate, salesTypeFilter])

  useEffect(() => {
    setPurchaseOrderPage(1)
  }, [purchaseOrderStatus])


  useEffect(() => {
    if (!toast.message) return undefined

    const timeoutId = window.setTimeout(() => {
      setToast({ message: '', tone: 'success' })
    }, 3000)

    return () => window.clearTimeout(timeoutId)
  }, [toast.message])

  const openCreateOrder = () => {
    const suggestedGrams = Number(analytics?.suggestedPurchaseGrams ?? 0)
    setCreateOrderForm({
      suggestedGrams: suggestedGrams > 0 ? suggestedGrams.toString() : '',
      requestedGrams: suggestedGrams > 0 ? suggestedGrams.toString() : '',
      notes: '',
    })
    setCreateOrderOpen(true)
  }

  const closeCreateOrder = () => {
    if (createOrderSaving) return
    setCreateOrderOpen(false)
  }

  const openMarkDone = (order) => {
    if (!order) return
    setActiveOrder(order)
    setMarkDoneForm({
      purchasedGrams: Number(order.requestedGrams ?? 0).toString(),
      purchasePricePerGram: Number(inventory?.currentMarketRatePerGram ?? 0).toString(),
      notes: order.notes || '',
    })
    setMarkDoneOpen(true)
  }

  const closeMarkDone = () => {
    if (markDoneSaving) return
    setMarkDoneOpen(false)
    setActiveOrder(null)
  }

  const handleCreateOrder = async (event) => {
    event.preventDefault()
    if (createOrderSaving) return

    const requestedGrams = Number(createOrderForm.requestedGrams)
    const suggestedGrams = Number(createOrderForm.suggestedGrams)

    if (!Number.isFinite(requestedGrams) || requestedGrams < 0) {
      setToast({ tone: 'danger', message: 'Requested grams must be 0 or greater' })
      return
    }

    setCreateOrderSaving(true)

    try {
      await bullionApi.createBullionPurchaseOrder({
        suggestedGrams: Number.isFinite(suggestedGrams) ? suggestedGrams : undefined,
        requestedGrams,
        notes: createOrderForm.notes || undefined,
      })

      setCreateOrderOpen(false)
      setToast({ tone: 'success', message: 'Purchase order created' })
      await Promise.all([refreshPurchaseOrders(), refreshAnalytics()])
    } catch (error) {
      setToast({ tone: 'danger', message: error?.error || error?.message || 'Failed to create purchase order' })
    } finally {
      setCreateOrderSaving(false)
    }
  }

  const handleMarkDone = async (event) => {
    event.preventDefault()
    if (markDoneSaving || !activeOrder?._id) return

    const purchasedGrams = Number(markDoneForm.purchasedGrams)
    const purchasePricePerGram = Number(markDoneForm.purchasePricePerGram)

    if (!Number.isFinite(purchasedGrams) || purchasedGrams <= 0) {
      setToast({ tone: 'danger', message: 'Purchased grams must be greater than 0' })
      return
    }

    if (!Number.isFinite(purchasePricePerGram) || purchasePricePerGram <= 0) {
      setToast({ tone: 'danger', message: 'Purchase price per gram must be greater than 0' })
      return
    }

    setMarkDoneSaving(true)

    try {
      await bullionApi.markPurchaseOrderDone(activeOrder._id, {
        purchasedGrams,
        purchasePricePerGram,
        notes: markDoneForm.notes || undefined,
      })

      setMarkDoneOpen(false)
      setActiveOrder(null)
      setToast({ tone: 'success', message: 'Purchase order marked done' })
      await Promise.all([refreshPurchaseOrders(), refreshAnalytics(), refreshInventory()])
    } catch (error) {
      setToast({ tone: 'danger', message: error?.error || error?.message || 'Failed to update purchase order' })
    } finally {
      setMarkDoneSaving(false)
    }
  }

  const handleSaveInventory = async (event) => {
    event.preventDefault()
    if (inventorySaving) return

    const currentStockGrams = Number(inventoryForm.currentStockGrams)
    const currentMarketRatePerGram = Number(inventoryForm.currentMarketRatePerGram)

    if (!Number.isFinite(currentStockGrams) || currentStockGrams < 0) {
      setToast({ tone: 'danger', message: 'Current stock must be 0 or greater' })
      return
    }

    if (!Number.isFinite(currentMarketRatePerGram) || currentMarketRatePerGram < 0) {
      setToast({ tone: 'danger', message: 'Market rate must be 0 or greater' })
      return
    }

    setInventorySaving(true)

    try {
      await bullionApi.updateBullionInventory({
        currentStockGrams,
        currentMarketRatePerGram,
        notes: inventoryForm.notes || undefined,
      })

      setToast({ tone: 'success', message: 'Bullion inventory updated' })
      await Promise.all([refreshInventory(), refreshAnalytics()])
    } catch (error) {
      setToast({ tone: 'danger', message: error?.error || error?.message || 'Failed to update inventory' })
    } finally {
      setInventorySaving(false)
    }
  }

  const handleRefreshAll = async () => {
    await Promise.all([refreshSales(), refreshAnalytics(), refreshInventory(), refreshPurchaseOrders()])
  }

  const analyticsMetrics = useMemo(
    () => [
      { title: 'Sales Entries', value: analytics?.totalEntries ?? 0, loading: showAnalyticsInitialLoading },
      { title: 'Total Revenue', value: `Rs. ${formatMoney(analytics?.totalRevenue ?? 0)}`, loading: showAnalyticsInitialLoading },
      { title: 'Net Sold Grams', value: formatWeight(analytics?.netSoldGrams ?? 0), loading: showAnalyticsInitialLoading },
      { title: 'Current Stock', value: formatWeight(analytics?.currentStockGrams ?? 0), loading: showAnalyticsInitialLoading },
      { title: 'Suggested Purchase', value: formatWeight(analytics?.suggestedPurchaseGrams ?? 0), loading: showAnalyticsInitialLoading },
      { title: 'Pending Orders', value: analytics?.pendingPurchaseOrdersCount ?? 0, loading: showAnalyticsInitialLoading },
    ],
    [analytics, showAnalyticsInitialLoading],
  )

  const stockNotes = useMemo(() => {
    if (Array.isArray(inventory?.noteHistory) && inventory.noteHistory.length > 0) {
      return inventory.noteHistory.slice(0, 5).map((note, index) => ({
        key: `${index}-${String(note)}`,
        label: String(note || '').trim(),
      }))
    }

    if (inventory?.notes) {
      return [{ key: 'latest-note', label: inventory.notes }]
    }

    return []
  }, [inventory])

  const renderSalesTab = () => (
    <div className="space-y-6">
      <SectionCard
        title="Sales Filters"
        description="Search by customer, salesman, note, reference, or purity. Filter by transaction type and date range."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshSales()}
              className="secondary-luxury-button"
              disabled={salesLoading}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                setSalesSearch('')
                setSalesTypeFilter('all')
                setSalesStartDate('')
                setSalesEndDate('')
              }}
              className="secondary-luxury-button text-heading border border-gray-300 hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        }
      >
        <div className="grid gap-4 p-6 xl:grid-cols-2">
          <div className="xl:col-span-2">
            <FilterLabel>Search</FilterLabel>
            <input
              className="input mt-2"
              type="search"
              value={salesSearch}
              onChange={(event) => setSalesSearch(event.target.value)}
              placeholder="Search customer, salesman, note, or ref"
              aria-label="Search bullion sales"
            />
          </div>

          <div>
            <FilterLabel>Transaction Type</FilterLabel>
            <select
              className="input mt-2"
              value={salesTypeFilter}
              onChange={(event) => setSalesTypeFilter(event.target.value)}
              aria-label="Transaction type filter"
            >
              {salesTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FilterLabel>Start Date</FilterLabel>
            <input
              className="input mt-2"
              type="date"
              value={salesStartDate}
              onChange={(event) => setSalesStartDate(event.target.value)}
              aria-label="Start date filter"
            />
          </div>

          <div>
            <FilterLabel>End Date</FilterLabel>
            <input
              className="input mt-2"
              type="date"
              value={salesEndDate}
              onChange={(event) => setSalesEndDate(event.target.value)}
              aria-label="End date filter"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard className="!p-0 overflow-hidden" title="Sales Records" description="Bullion sales and returns captured from the backend.">
        {showSalesInitialLoading ? (
          <div className="px-6 py-6">
            <TableSkeleton columns={9} rows={5} />
          </div>
        ) : salesError ? (
          <EmptyState title="Could not load bullion sales" description={salesError} className="px-8" />
        ) : salesRows.length === 0 ? (
          <EmptyState
            title="No bullion sales found"
            description="Try a different search or clear the selected filters."
            className="px-8"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] w-full text-left">
                <thead>
                  <tr className="surface-panel-faint">
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Date</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Customer</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Salesman</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold whitespace-nowrap">Weight (g)</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold whitespace-nowrap">Rate (Rs/g)</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold whitespace-nowrap">Total (Rs)</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Purity</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Type</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--jsm-border)]">
                  {salesRows.map((sale) => {
                    const customer = sale.customer || {}
                    const salesman = sale.salesman || {}
                    const saleType = String(sale.transactionType || 'sale').toLowerCase()

                    return (
                      <tr key={sale._id || sale.id} className="border-t border-[var(--jsm-border)] align-top">
                        <td className="px-6 py-5 whitespace-nowrap text-sm text-primary">{formatDateTime(sale.createdAt)}</td>
                        <td className="px-6 py-5">
                          <button
                            type="button"
                            className="text-left font-bold text-primary transition-colors hover:text-gold-500"
                            onClick={() => customer?.id && navigate(`/customers/${customer.id}`)}
                          >
                            {safeText(customer.name || sale.customerName)}
                          </button>
                          <div className="mt-1 text-xs text-muted">
                            <div>{safeText(customer.phone || sale.customerPhone)}</div>
                            <div>{safeText(customer.area || sale.customerArea)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-semibold text-primary">{safeText(salesman.name || sale.salesmanName)}</div>
                          <div className="mt-1 text-xs text-muted">{safeText(salesman.email || salesman.phone)}</div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm text-primary">{formatWeight(sale.weightGrams)}</td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm text-primary">{formatMoney(sale.ratePerGram)}</td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm font-semibold text-primary">Rs. {formatMoney(sale.totalAmount)}</td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm text-primary">{safeText(sale.goldPurity)}</td>
                        <td className="px-6 py-5">
                          <RowBadge tone={saleType === 'return' ? 'warning' : 'success'}>
                            {saleType === 'return' ? 'Return' : 'Sale'}
                          </RowBadge>
                        </td>
                        <td className="px-6 py-5 text-sm text-muted">
                          <div className="space-y-2">
                            <div className="max-w-[260px] break-words">{safeText(sale.notes)}</div>
                            {sale.syncStatus && sale.syncStatus !== 'synced' ? (
                              <RowBadge tone="gold">{safeText(sale.syncStatus)}</RowBadge>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--jsm-border)] px-6 py-5 text-sm text-muted lg:flex-row lg:items-center lg:justify-between">
              <div>
                Showing {salesStartIndex}-{salesEndIndex} of {totalSales} bullion sales
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="secondary-luxury-button text-on-accent disabled:opacity-50"
                  disabled={salesLoading || salesPagination.page <= 1}
                  onClick={() => setSalesPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest text-heading">
                  Page {salesPagination.page} of {salesPagination.pages}
                </span>
                <button
                  type="button"
                  className="secondary-luxury-button text-on-accent disabled:opacity-50"
                  disabled={salesLoading || salesPagination.page >= salesPagination.pages}
                  onClick={() => setSalesPage((current) => Math.min(salesPagination.pages, current + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  )

  const renderAnalyticsTab = () => {
    const chartData = [...salesRows].reverse().map(row => ({
      date: new Date(row.createdAt || row.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      weight: row.weightGrams || 0,
    }))

    return (
      <div className="space-y-6">
        <SectionCard title="Analytics Summary" description="Bullion sales and inventory snapshot for planning purchases.">
          <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
            {analyticsMetrics.map((metric) => (
              <MetricCard
                key={metric.title}
                title={metric.title}
                value={metric.value}
                loading={metric.loading}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Recent Sales Trend" description="Chart of recent transaction volumes from the current view.">
          <div className="h-[300px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--jsm-surface-strong)', borderColor: 'var(--jsm-border)', borderRadius: '12px' }} />
                <Bar dataKey="weight" name="Weight (g)" fill="var(--jsm-gold-600)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Purchase Requirement"
        description="Review the current stock, suggested purchase grams, and market snapshot."
        actions={
          <button
            type="button"
            className="primary-luxury-button text-on-accent"
            onClick={openCreateOrder}
          >
            Create Purchase Order
          </button>
        }
      >
        {showAnalyticsInitialLoading ? (
          <div className="p-6">
            <TableSkeleton columns={4} rows={2} />
          </div>
        ) : analyticsError ? (
          <EmptyState title="Could not load analytics" description={analyticsError} className="px-8" />
        ) : (
          <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-[var(--jsm-border)] surface-panel-soft p-5">
              <div className="eyebrow">Suggested Purchase</div>
              <div className="mt-2 text-3xl font-bold text-primary">{formatWeight(analytics?.suggestedPurchaseGrams ?? 0)} g</div>
              <div className="mt-2 text-sm text-muted">Based on sold weight vs current stock.</div>
            </div>
            <div className="rounded-[22px] border border-[var(--jsm-border)] surface-panel-soft p-5">
              <div className="eyebrow">Current Stock</div>
              <div className="mt-2 text-3xl font-bold text-primary">{formatWeight(analytics?.currentStockGrams ?? 0)} g</div>
              <div className="mt-2 text-sm text-muted">From the bullion inventory snapshot.</div>
            </div>
            <div className="rounded-[22px] border border-[var(--jsm-border)] surface-panel-soft p-5">
              <div className="eyebrow">Current Market Rate</div>
              <div className="mt-2 text-3xl font-bold text-primary">Rs. {formatMoney(analytics?.currentMarketRatePerGram ?? 0)}</div>
              <div className="mt-2 text-sm text-muted">Used for stock valuation and done purchase orders.</div>
            </div>
            <div className="rounded-[22px] border border-[var(--jsm-border)] surface-panel-soft p-5">
              <div className="eyebrow">Estimated Stock Value</div>
              <div className="mt-2 text-3xl font-bold text-primary">Rs. {formatMoney(analytics?.estimatedStockValue ?? 0)}</div>
              <div className="mt-2 text-sm text-muted">Stock grams multiplied by current market rate.</div>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        className="!p-0 overflow-hidden"
        title="Purchase Orders"
        description="Create new orders, mark completed orders, and track pending requirements."
      >
        <div className="border-b border-[var(--jsm-border)] surface-panel-faint px-6 py-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {purchaseStatusOptions.map((option) => {
              const isActive = purchaseOrderStatus === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPurchaseOrderStatus(option.value)}
                  className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                    isActive
                      ? 'border-gold-500/50 bg-gold-500/10 text-gold-500'
                      : 'surface-panel-soft panel-border text-muted hover:text-primary hover:border-gold-500/30 hover:bg-gold-500/10'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        {showPurchaseInitialLoading ? (
          <div className="px-6 py-6">
            <TableSkeleton columns={8} rows={4} />
          </div>
        ) : purchaseOrdersError ? (
          <EmptyState title="Could not load purchase orders" description={purchaseOrdersError} className="px-8" />
        ) : purchaseOrders.length === 0 ? (
          <EmptyState
            title="No purchase orders found"
            description="Create a purchase order from the analytics panel to start tracking replenishment."
            className="px-8"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full text-left">
                <thead>
                  <tr className="surface-panel-faint">
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Date</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Suggested g</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Requested g</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Purchased g</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Cost</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Status</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Notes</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--jsm-border)]">
                  {purchaseOrders.map((order) => {
                    const status = String(order.status || 'pending').toLowerCase()

                    return (
                      <tr key={order._id || order.id} className="border-t border-[var(--jsm-border)] align-top">
                        <td className="px-6 py-5 whitespace-nowrap text-sm text-primary">{formatDateTime(order.createdAt)}</td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm text-primary">{formatWeight(order.suggestedGrams)}</td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm text-primary">{formatWeight(order.requestedGrams)}</td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm text-primary">{formatWeight(order.purchasedGrams)}</td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm text-primary">
                          Rs. {formatMoney(order.totalPurchaseCost)}
                        </td>
                        <td className="px-6 py-5">
                          <RowBadge tone={status === 'done' ? 'success' : 'warning'}>{status}</RowBadge>
                        </td>
                        <td className="px-6 py-5 text-sm text-muted">
                          <div className="max-w-[260px] break-words">{safeText(order.notes)}</div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          {status === 'pending' ? (
                            <button
                              type="button"
                              onClick={() => openMarkDone(order)}
                              className="group flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-gold-600 transition-colors"
                            >
                              Mark Done
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-faint">
                              Completed
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--jsm-border)] px-6 py-5 text-sm text-muted lg:flex-row lg:items-center lg:justify-between">
              <div>
                Showing {purchaseOrdersStartIndex}-{purchaseOrdersEndIndex} of {totalPurchaseOrders} purchase orders
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="secondary-luxury-button text-on-accent disabled:opacity-50"
                  disabled={purchaseOrdersLoading || purchaseOrderPagination.page <= 1}
                  onClick={() => setPurchaseOrderPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest text-heading">
                  Page {purchaseOrderPagination.page} of {purchaseOrderPagination.pages}
                </span>
                <button
                  type="button"
                  className="secondary-luxury-button text-on-accent disabled:opacity-50"
                  disabled={purchaseOrdersLoading || purchaseOrderPagination.page >= purchaseOrderPagination.pages}
                  onClick={() => setPurchaseOrderPage((current) => Math.min(purchaseOrderPagination.pages, current + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </SectionCard>
    </div>
    )
  }

  const renderSettingsTab = () => {
    const isInventoryModified =
      inventoryForm.currentStockGrams !== Number(inventory?.currentStockGrams ?? 0).toString() ||
      inventoryForm.currentMarketRatePerGram !== Number(inventory?.currentMarketRatePerGram ?? 0).toString() ||
      inventoryForm.notes !== (inventory?.notes || '')

    return (
      <div className="space-y-6">
        <SectionCard
          title="Inventory Settings"
          description="Keep the bullion stock snapshot and market rate current."
          actions={
            <button
              type="button"
              onClick={handleSaveInventory}
              className="primary-luxury-button text-on-accent disabled:opacity-50"
              disabled={inventorySaving || !isInventoryModified}
            >
              {inventorySaving ? 'Saving...' : 'Save Inventory'}
            </button>
          }
        >
        {showInventoryInitialLoading ? (
          <div className="p-6">
            <TableSkeleton columns={2} rows={3} />
          </div>
        ) : inventoryError ? (
          <EmptyState title="Could not load inventory" description={inventoryError} className="px-8" />
        ) : (
          <form onSubmit={handleSaveInventory} className="grid gap-4 p-6 lg:grid-cols-2">
            <div>
              <FilterLabel>Current Stock (grams)</FilterLabel>
              <input
                className="input mt-2"
                type="number"
                min="0"
                step="0.001"
                value={inventoryForm.currentStockGrams}
                onChange={(event) =>
                  setInventoryForm((current) => ({
                    ...current,
                    currentStockGrams: event.target.value,
                  }))
                }
                placeholder="0.000"
              />
            </div>

            <div>
              <FilterLabel>Current Market Rate (Rs / gm)</FilterLabel>
              <input
                className="input mt-2"
                type="number"
                min="0"
                step="0.01"
                value={inventoryForm.currentMarketRatePerGram}
                onChange={(event) =>
                  setInventoryForm((current) => ({
                    ...current,
                    currentMarketRatePerGram: event.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>

            <div className="lg:col-span-2">
              <FilterLabel>Stock Notes</FilterLabel>
              <textarea
                className="input mt-2 min-h-[130px]"
                value={inventoryForm.notes}
                onChange={(event) =>
                  setInventoryForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Add the latest stock note or remark"
              />
            </div>

            <div className="lg:col-span-2 rounded-[22px] border border-[var(--jsm-border)] surface-panel-soft p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="eyebrow">Last Updated</div>
                  <div className="mt-2 text-primary font-semibold">{formatDateTime(inventory?.updatedAt || inventory?.lastUpdatedAt)}</div>
                </div>
                <div>
                  <div className="eyebrow">Updated By</div>
                  <div className="mt-2 text-primary font-semibold">
                    {(() => {
                      const by = inventory?.lastUpdatedBy
                      if (!by) return '-'
                      if (typeof by === 'string') return by
                      return by.name || by.email || by.username || String(by._id || '-')
                    })()}
                  </div>
                </div>
                <div>
                  <div className="eyebrow">Estimated Stock Value</div>
                  <div className="mt-2 text-primary font-semibold">Rs. {formatMoney(analytics?.estimatedStockValue ?? 0)}</div>
                </div>
              </div>
            </div>
          </form>
        )}
      </SectionCard>

      <SectionCard title="Recent Stock Notes" description="Latest note history if the backend exposes it.">
        {stockNotes.length === 0 ? (
          <EmptyState title="No stock notes yet" description="Save a note in the inventory settings to capture the latest change." className="px-8" />
        ) : (
          <div className="grid gap-3 p-6">
            {stockNotes.map((note) => (
              <div key={note.key} className="rounded-[18px] border border-[var(--jsm-border)] surface-panel-soft px-4 py-3">
                <div className="text-sm text-primary">{note.label}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
    )
  }

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Bullion Sales"
        title="Bullion Sales"
        description="Monitor bullion sales, analytics, purchase requirements, and inventory settings from a single admin view."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleRefreshAll()}
              className="secondary-luxury-button"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreateOrder}
              className="primary-luxury-button text-on-accent"
            >
              Create Purchase Order
            </button>
          </div>
        }
      />

      <SectionCard className="surface-panel-faint">
        <div className="flex flex-wrap gap-2 p-2">
          {tabOptions.map((tab) => (
            <TabButton
              key={tab.value}
              active={activeTab === tab.value}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </TabButton>
          ))}
        </div>
      </SectionCard>

      {activeTab === 'sales' ? renderSalesTab() : null}
      {activeTab === 'analytics' ? renderAnalyticsTab() : null}
      {activeTab === 'settings' ? renderSettingsTab() : null}

      <DialogShell
        open={createOrderOpen}
        title="Create Purchase Order"
        description="Set the suggested grams, requested grams, and optional notes for the new bullion order."
        onClose={closeCreateOrder}
        footer={
          <>
            <button
              type="button"
              onClick={closeCreateOrder}
              className="secondary-luxury-button text-on-accent disabled:opacity-50"
              disabled={createOrderSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-order-form"
              className="primary-luxury-button text-on-accent disabled:opacity-50"
              disabled={createOrderSaving}
            >
              {createOrderSaving ? 'Creating...' : 'Create Order'}
            </button>
          </>
        }
      >
        <form id="create-order-form" onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <FilterLabel>Suggested Grams</FilterLabel>
            <input
              className="input mt-2"
              type="number"
              min="0"
              step="0.001"
              value={createOrderForm.suggestedGrams}
              onChange={(event) =>
                setCreateOrderForm((current) => ({
                  ...current,
                  suggestedGrams: event.target.value,
                }))
              }
              placeholder={analytics?.suggestedPurchaseGrams ? formatWeight(analytics.suggestedPurchaseGrams) : '0.000'}
            />
          </div>
          <div>
            <FilterLabel>Requested Grams</FilterLabel>
            <input
              className="input mt-2"
              type="number"
              min="0"
              step="0.001"
              value={createOrderForm.requestedGrams}
              onChange={(event) =>
                setCreateOrderForm((current) => ({
                  ...current,
                  requestedGrams: event.target.value,
                }))
              }
              placeholder={analytics?.suggestedPurchaseGrams ? formatWeight(analytics.suggestedPurchaseGrams) : '0.000'}
            />
          </div>
          <div>
            <FilterLabel>Notes</FilterLabel>
            <textarea
              className="input mt-2 min-h-[120px]"
              value={createOrderForm.notes}
              onChange={(event) =>
                setCreateOrderForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Optional note for purchasing"
            />
          </div>
        </form>
      </DialogShell>

      <DialogShell
        open={markDoneOpen}
        title="Mark Purchase Order Done"
        description={activeOrder ? `Complete order #{activeOrder._id || activeOrder.id}` : 'Complete the selected purchase order.'}
        onClose={closeMarkDone}
        footer={
          <>
            <button
              type="button"
              onClick={closeMarkDone}
              className="secondary-luxury-button text-on-accent disabled:opacity-50"
              disabled={markDoneSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="mark-done-form"
              className="primary-luxury-button text-on-accent disabled:opacity-50"
              disabled={markDoneSaving}
            >
              {markDoneSaving ? 'Saving...' : 'Mark Done'}
            </button>
          </>
        }
      >
        <form id="mark-done-form" onSubmit={handleMarkDone} className="space-y-4">
          <div className="rounded-[22px] border border-[var(--jsm-border)] surface-panel-soft p-4 text-sm text-muted">
            <div className="flex flex-wrap gap-3">
              <span className="font-semibold text-primary">
                Suggested: {formatWeight(activeOrder?.suggestedGrams)} g
              </span>
              <span className="font-semibold text-primary">
                Requested: {formatWeight(activeOrder?.requestedGrams)} g
              </span>
            </div>
          </div>
          <div>
            <FilterLabel>Purchased Grams</FilterLabel>
            <input
              className="input mt-2"
              type="number"
              min="0"
              step="0.001"
              value={markDoneForm.purchasedGrams}
              onChange={(event) =>
                setMarkDoneForm((current) => ({
                  ...current,
                  purchasedGrams: event.target.value,
                }))
              }
              placeholder={formatWeight(activeOrder?.requestedGrams || 0)}
            />
          </div>
          <div>
            <FilterLabel>Purchase Price Per Gram</FilterLabel>
            <input
              className="input mt-2"
              type="number"
              min="0"
              step="0.01"
              value={markDoneForm.purchasePricePerGram}
              onChange={(event) =>
                setMarkDoneForm((current) => ({
                  ...current,
                  purchasePricePerGram: event.target.value,
                }))
              }
              placeholder={formatMoney(inventory?.currentMarketRatePerGram || 0)}
            />
          </div>
          <div>
            <FilterLabel>Notes</FilterLabel>
            <textarea
              className="input mt-2 min-h-[120px]"
              value={markDoneForm.notes}
              onChange={(event) =>
                setMarkDoneForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Optional completion note"
            />
          </div>
        </form>
      </DialogShell>

      <ActionToast message={toast.message} tone={toast.tone} />
    </div>
  )
}
