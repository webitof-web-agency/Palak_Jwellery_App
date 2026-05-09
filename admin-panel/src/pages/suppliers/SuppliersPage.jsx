import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { deleteSupplier, getSuppliers, testSupplierParse } from '../../api/suppliers.api'
import PageHeader from '../../components/ui/PageHeader'
import DeleteSupplierDialog from './components/DeleteSupplierDialog'
import SupplierAlerts from './components/SupplierAlerts'
import SupplierCard from './components/SupplierCard'
import SupplierOverview from './components/SupplierOverview'
import SupplierQrTool from './components/SupplierQrTool'

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
        const message =
          error instanceof ApiError
            ? error.error
            : error?.message || 'Failed to load suppliers.'
        setErrorMessage(message)
      } finally {
        if (active) {
          setIsLoading(false)
          setHasLoadedOnce(true)
        }
      }
    }

    void loadSuppliers()

    return () => {
      active = false
    }
  }, [reloadTick, location.pathname])

  const openAddPage = () => {
    navigate('/suppliers/form')
  }

  const beginEdit = (supplier) => {
    navigate('/suppliers/form', { state: { supplier } })
  }

  const handleDelete = (supplier) => {
    setPendingDelete(supplier)
  }

  const dismissSuccessMessage = () => setSuccessMessage('')
  const dismissErrorMessage = () => setErrorMessage('')

  const refreshSuppliers = () => {
    setHasLoadedOnce(false)
    setReloadTick((value) => value + 1)
  }

  const confirmDeleteSupplier = async () => {
    if (!pendingDelete) return

    setDeletingId(pendingDelete._id)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      const response = await deleteSupplier(pendingDelete._id)
      setSuccessMessage(response?.message || `Deleted ${pendingDelete.name}.`)
      setPendingDelete(null)
      setReloadTick((value) => value + 1)
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.error
          : error?.message || 'Failed to delete supplier.'
      setErrorMessage(message)
    } finally {
      setDeletingId('')
    }
  }

  const handleParseTest = async (event) => {
    event.preventDefault()

    const trimmedRaw = rawQR.trim()
    if (!trimmedRaw) {
      setQrError('Paste a raw QR string before testing.')
      return
    }

    setIsTesting(true)
    setQrError('')
    setSuccessMessage('')

    try {
      const payload = { raw: trimmedRaw }
      if (qrSupplierId) {
        payload.supplierId = qrSupplierId
      }

      const result = await testSupplierParse(payload)
      setQrResult(result)
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.error
          : error?.message || 'QR parsing failed.'
      setQrError(message)
      setQrResult(null)
    } finally {
      setIsTesting(false)
    }
  }

  const selectedSupplier =
    suppliers.find((supplier) => supplier._id === qrSupplierId) || null
  const showInitialLoading = isLoading && !hasLoadedOnce

  return (
    <main className="page-shell">
      <section className="page-hero flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="eyebrow">Inventory Management</span>
          <h1 className="text-4xl font-bold font-display gold-gradient-text tracking-tight uppercase">
            Suppliers List
          </h1>
          <p className="text-muted mt-2 max-w-xl">
            Manage your suppliers, configure delimiter mappings, and test QR parsing to ensure scanning accuracy on the mobile app.
          </p>
        </div>
        <button
          type="button"
          className="primary-luxury-button self-start xl:self-auto text-on-accent"
          onClick={openAddPage}
          aria-label="Add supplier"
        >
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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <SupplierOverview
          totalSuppliers={suppliers.length}
          onAddSupplier={openAddPage}
        />

        <section className="xl:col-span-8 space-y-8">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-bold font-display text-heading">
                Active Suppliers
              </h2>
              <p className="text-xs text-muted uppercase tracking-widest font-bold mt-1">
                {showInitialLoading ? 'Loading supplier records...' : `${suppliers.length} Records Found`}
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-bold text-muted hover:text-primary transition-colors"
              onClick={refreshSuppliers}
              aria-label="Refresh supplier data"
              disabled={isLoading}
            >
              {isLoading ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>

          {showInitialLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="state-skeleton" />
              <div className="state-skeleton" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="glass-panel p-20 text-center border-dashed panel-border">
              <div className="text-3xl mb-4 text-heading">+</div>
              <h3 className="text-lg font-bold mb-2 text-heading">No Suppliers Found</h3>
              <p className="text-sm text-muted">
                Add a supplier to configure QR parsing rules.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {suppliers.map((supplier) => (
                <SupplierCard
                  key={supplier._id}
                  supplier={supplier}
                  onEdit={beginEdit}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
              ))}
            </div>
          )}

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
        </section>
      </div>

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
