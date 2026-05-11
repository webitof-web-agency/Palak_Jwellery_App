import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { deleteSupplier, getSuppliers, testSupplierParse } from '../../api/suppliers.api'
import DeleteSupplierDialog from './components/DeleteSupplierDialog'
import SupplierAlerts from './components/SupplierAlerts'
import SupplierCard from './components/SupplierCard'
import SupplierQrTool from './components/SupplierQrTool'

/* ── Inline SVG icons (same style as MetricCard on /dashboard) ── */
const IconBuilding = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M9 21V9h6v12" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M9 13h6M9 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
  </svg>
)

const IconCheckCircle = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconCreditCard = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M7 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
  </svg>
)

const IconCash = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
    <rect x="2" y="7" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <circle cx="12" cy="13" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2 10.5h3M19 10.5h3M2 15.5h3M19 15.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
  </svg>
)

const IconTag = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
    <path
      d="M3.5 12.5 12 4l8 .5.5 8-8.5 8.5a1.5 1.5 0 0 1-2.1 0L3.5 14.6a1.5 1.5 0 0 1 0-2.1Z"
      stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
    />
    <circle cx="17" cy="7.5" r="1.2" fill="currentColor" opacity="0.6" />
  </svg>
)

const StatCard = ({ label, value, Icon, accentFrom, accentTo }) => (
  <div className="relative overflow-hidden rounded-2xl glass-panel p-5 flex flex-col justify-between min-h-[100px] group hover:border-gold-600/25 transition-all duration-200">
    <div className="flex items-start justify-between gap-3">
      <span className="eyebrow mb-0 leading-tight">{label}</span>
      <div className="h-9 w-9 flex-shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-heading">
        <Icon />
      </div>
    </div>
    <div className="mt-3 text-3xl font-bold text-heading tracking-tight font-display">{value}</div>
    {/* Hover glow */}
    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br ${accentFrom} ${accentTo}`} />
  </div>
)

export default function SuppliersPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [suppliers, setSuppliers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const [deletingId, setDeletingId] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [qrSupplierId, setQrSupplierId] = useState('')
  const [rawQR, setRawQR] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [qrError, setQrError] = useState('')
  const [qrResult, setQrResult] = useState(null)

  useEffect(() => {
    if (location.state?.successMessage) {
      setSuccessMessage(location.state.successMessage)
      navigate('/suppliers', { replace: true })
    }
  }, [location.state, navigate])

  useEffect(() => {
    let active = true
    const loadSuppliers = async () => {
      setIsLoading(true)
      setErrorMessage('')
      try {
        const response = await getSuppliers()
        if (!active) return
        setSuppliers(Array.isArray(response) ? response : [])
      } catch (error) {
        if (!active) return
        setErrorMessage(
          error instanceof ApiError ? error.error : error?.message || 'Failed to load suppliers.',
        )
      } finally {
        if (active) { setIsLoading(false); setHasLoadedOnce(true) }
      }
    }
    void loadSuppliers()
    return () => { active = false }
  }, [reloadTick, location.pathname])

  const openAddPage = () => navigate('/suppliers/form')
  const beginEdit = (supplier) => navigate('/suppliers/form', { state: { supplier } })
  const handleDelete = (supplier) => setPendingDelete(supplier)
  const dismissSuccessMessage = () => setSuccessMessage('')
  const dismissErrorMessage = () => setErrorMessage('')
  const refreshSuppliers = () => { setHasLoadedOnce(false); setReloadTick((v) => v + 1) }

  const confirmDeleteSupplier = async () => {
    if (!pendingDelete) return
    setDeletingId(pendingDelete._id)
    setSuccessMessage('')
    setErrorMessage('')
    try {
      const response = await deleteSupplier(pendingDelete._id)
      setSuccessMessage(response?.message || `Deleted ${pendingDelete.name}.`)
      setPendingDelete(null)
      setReloadTick((v) => v + 1)
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.error : error?.message || 'Failed to delete supplier.',
      )
    } finally { setDeletingId('') }
  }

  const handleParseTest = async (event) => {
    event.preventDefault()
    const trimmedRaw = rawQR.trim()
    if (!trimmedRaw) { setQrError('Paste a raw QR string before testing.'); return }
    setIsTesting(true); setQrError(''); setSuccessMessage('')
    try {
      const payload = { raw: trimmedRaw }
      if (qrSupplierId) payload.supplierId = qrSupplierId
      const result = await testSupplierParse(payload)
      setQrResult(result)
    } catch (error) {
      setQrError(error instanceof ApiError ? error.error : error?.message || 'QR parsing failed.')
      setQrResult(null)
    } finally { setIsTesting(false) }
  }

  const activeCount = useMemo(() => suppliers.filter((s) => s.isActive).length, [suppliers])
  const creditCount = useMemo(
    () => suppliers.filter((s) => s.paymentMode?.toLowerCase() === 'credit').length,
    [suppliers],
  )
  const selectedSupplier = suppliers.find((s) => s._id === qrSupplierId) || null
  const showInitialLoading = isLoading && !hasLoadedOnce

  return (
    <main className="page-shell space-y-8 animate-fade-in">

      {/* ── Page Hero ── */}
      <section className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="eyebrow">Inventory Management</span>
          <h1 className="text-4xl font-bold font-display gold-gradient-text tracking-tight uppercase mt-1">
            Suppliers List
          </h1>
          <p className="text-muted mt-2 max-w-lg text-sm leading-relaxed">
            Manage your suppliers, configure delimiter mappings, and test QR parsing to ensure
            scanning accuracy on the mobile app.
          </p>
        </div>
        <button
          type="button"
          className="primary-luxury-button self-start xl:self-auto text-on-accent gap-2"
          onClick={openAddPage}
          aria-label="Add supplier"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Supplier
        </button>
      </section>

      <SupplierAlerts
        successMessage={successMessage}
        errorMessage={errorMessage}
        onDismissSuccess={dismissSuccessMessage}
        onDismissError={dismissErrorMessage}
        onRetry={refreshSuppliers}
        isRetrying={isLoading}
      />

      {/* ── Stats Row ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Suppliers" value={suppliers.length} Icon={IconBuilding} accentFrom="from-gold-500/5" accentTo="to-transparent" />
        <StatCard label="Active" value={activeCount} Icon={IconCheckCircle} accentFrom="from-green-500/5" accentTo="to-transparent" />
        <StatCard label="Credit Settlement" value={creditCount} Icon={IconCreditCard} accentFrom="from-blue-500/5" accentTo="to-transparent" />
        <StatCard label="Cash Settlement" value={suppliers.length - creditCount} Icon={IconCash} accentFrom="from-amber-500/5" accentTo="to-transparent" />
      </section>

      {/* ── Supplier List Panel ── */}
      <section className="surface-panel panel-border rounded-3xl overflow-hidden">

        {/* Panel header */}
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b panel-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-heading flex-shrink-0">
              <IconTag />
            </div>
            <div>
              <h2 className="text-base font-bold font-display text-primary leading-tight">
                Active Suppliers
              </h2>
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted mt-0.5">
                {showInitialLoading
                  ? 'Loading records…'
                  : `${suppliers.length} Supplier${suppliers.length !== 1 ? 's' : ''} registered`}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold
              text-muted hover:text-primary border border-transparent hover:border-white/10
              hover:bg-white/5 transition-all duration-200"
            onClick={refreshSuppliers}
            disabled={isLoading}
            aria-label="Refresh supplier data"
          >
            <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform duration-500 ${isLoading ? 'animate-spin' : ''}`} fill="none" aria-hidden="true">
              <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M18 7l.5-3.5L22 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Column labels */}
        {!showInitialLoading && suppliers.length > 0 && (
          <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-6 py-2.5 border-b panel-border bg-white/[0.015]">
            <div className="w-11" />
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted">
              Supplier / Code / Payment
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted text-right pr-2">
              QR Field Mappings
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted text-right">
              Actions
            </span>
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-2">
          {showInitialLoading ? (
            [1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[72px] rounded-2xl skeleton-line"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))
          ) : suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-heading">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d="M9 21V9h6v12" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d="M12 6v3M12 6h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-heading mb-1">No Suppliers Yet</h3>
                <p className="text-sm text-muted max-w-sm">
                  Add your first supplier to configure QR parsing rules and settlement modes.
                </p>
              </div>
              <button type="button" className="primary-luxury-button text-on-accent mt-2" onClick={openAddPage}>
                + Add First Supplier
              </button>
            </div>
          ) : (
            suppliers.map((supplier) => (
              <SupplierCard
                key={supplier._id}
                supplier={supplier}
                onEdit={beginEdit}
                onDelete={handleDelete}
                deletingId={deletingId}
              />
            ))
          )}
        </div>

        {/* Panel footer */}
        {!showInitialLoading && suppliers.length > 0 && (
          <div className="px-6 py-3 border-t panel-border bg-white/[0.015] flex items-center justify-between gap-4">
            <p className="text-[10px] text-muted">
              {activeCount} active · {creditCount} credit · {suppliers.length - creditCount} cash
            </p>
            <button
              type="button"
              className="text-[10px] font-bold text-heading hover:underline transition-all"
              onClick={openAddPage}
            >
              + Add another supplier
            </button>
          </div>
        )}
      </section>

      {/* ── QR Test Tool ── */}
      <SupplierQrTool
        suppliers={suppliers}
        qrSupplierId={qrSupplierId}
        setQrSupplierId={setQrSupplierId}
        rawQR={rawQR}
        setRawQR={setRawQR}
        isTesting={isTesting}
        qrError={qrError}
        qrResult={qrResult}
        selectedSupplier={selectedSupplier}
        onParseTest={handleParseTest}
      />

      <DeleteSupplierDialog
        open={Boolean(pendingDelete)}
        supplierName={pendingDelete?.name}
        isDeleting={Boolean(deletingId)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDeleteSupplier}
      />
    </main>
  )
}
