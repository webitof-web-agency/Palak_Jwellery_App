import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { buttonStyles, getName } from '../salesPage.utils'

const valueOrEmpty = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
}

const Field = ({ label, id, children, hint = null }) => (
  <div className="field">
    <label className="field-label" htmlFor={id}>
      {label}
    </label>
    {children}
    {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
  </div>
)

export default function BatchCreateModal({
  open,
  suppliers = [],
  users = [],
  currentUser = null,
  currentUserRole = '',
  loading = false,
  error = '',
  onClose,
  onCreate,
}) {
  const [formData, setFormData] = useState({
    supplierId: '',
    assignedSalesmanId: '',
    customerName: '',
    customerPhone: '',
    referenceNote: '',
  })
  const [localError, setLocalError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const activeSalesmen = useMemo(() => {
    return Array.isArray(users)
      ? users.filter((user) => user?.role === 'salesman' && user?.isActive !== false)
      : []
  }, [users])

  const currentUserId = currentUser?._id || currentUser?.id || null
  const currentUserName = getName(currentUser)

  useEffect(() => {
    if (!open) {
      setSubmitting(false)
      setLocalError('')
      return undefined
    }

    setLocalError('')
    setFormData({
      supplierId: '',
      assignedSalesmanId:
        currentUserRole === 'salesman'
          ? valueOrEmpty(currentUserId)
          : activeSalesmen.length === 1
            ? valueOrEmpty(activeSalesmen[0]?._id)
            : '',
      customerName: '',
      customerPhone: '',
      referenceNote: '',
    })

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeSalesmen, currentUserId, currentUserRole, onClose, open])

  const selectedSupplier = Array.isArray(suppliers)
    ? suppliers.find((supplier) => String(supplier?._id || '') === String(formData.supplierId || ''))
    : null

  const selectedSalesman = Array.isArray(activeSalesmen)
    ? activeSalesmen.find((user) => String(user?._id || '') === String(formData.assignedSalesmanId || ''))
    : null

  const canCreate =
    !submitting &&
    !loading &&
    String(formData.supplierId || '').trim() !== '' &&
    String(formData.assignedSalesmanId || '').trim() !== ''

  const handleChange = (name, value) => {
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLocalError('')

    const supplierId = String(formData.supplierId || '').trim()
    const assignedSalesmanId = String(formData.assignedSalesmanId || '').trim()

    if (!supplierId) {
      setLocalError('Supplier is required.')
      return
    }

    if (!assignedSalesmanId) {
      setLocalError('Assigned salesman is required.')
      return
    }

    setSubmitting(true)

    try {
      await onCreate?.({
        supplierId,
        assignedSalesmanId,
        customerName: String(formData.customerName || '').trim(),
        customerPhone: String(formData.customerPhone || '').trim(),
        referenceNote: String(formData.referenceNote || '').trim(),
      })
    } catch (submitError) {
      setLocalError(submitError?.error || submitError?.message || 'Failed to create batch.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open || typeof document === 'undefined') {
    return null
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[color:var(--jsm-overlay)] p-3 backdrop-blur-md backdrop-saturate-75 md:p-6"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.()
        }
      }}
    >
      <div className="flex h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-[color:var(--jsm-surface)] panel-border shadow-[0_24px_80px_rgba(0,0,0,0.42)] md:h-[90vh]">
        <div className="flex items-start justify-between gap-4 border-b panel-border px-5 py-4 md:px-6">
          <div className="min-w-0">
            <span className="eyebrow">Create batch</span>
            <h2 className="mt-2 text-2xl font-bold font-display text-heading">
              New batch workflow
            </h2>
            <p className="mt-1 text-sm text-muted">
              Start a new batch shell for supplier work. Items can be added after creation.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex min-h-11 flex-shrink-0 items-center justify-center rounded-xl surface-panel-soft panel-border px-4 text-sm font-semibold text-primary transition-all duration-200 hover:bg-gold-500/10 hover:border-gold-500/30"
            onClick={onClose}
            aria-label="Close create batch dialog"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] px-5 py-5 md:px-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {localError || error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-primary">
                {localError || error}
              </div>
            ) : null}

            <section className="rounded-3xl surface-panel-soft panel-border p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Supplier"
                  id="batch-create-supplier"
                  hint="Required. Used to generate the batch reference."
                >
                  <select
                    id="batch-create-supplier"
                    className="input"
                    value={formData.supplierId}
                    onChange={(event) => handleChange('supplierId', event.target.value)}
                    disabled={loading || submitting}
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier._id} value={supplier._id}>
                        {getName(supplier)}{supplier?.code ? ` (${supplier.code})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>

                {currentUserRole === 'salesman' ? (
                  <Field
                    label="Assigned salesman"
                    id="batch-create-salesman"
                    hint="For salesmen, the batch is assigned to your account."
                  >
                    <div className="rounded-xl surface-panel-soft panel-border px-4 py-3 text-sm text-heading">
                      {currentUserName}
                    </div>
                  </Field>
                ) : (
                  <Field
                    label="Assigned salesman"
                    id="batch-create-salesman"
                    hint="Required for admin-created batches."
                  >
                    <select
                      id="batch-create-salesman"
                      className="input"
                      value={formData.assignedSalesmanId}
                      onChange={(event) => handleChange('assignedSalesmanId', event.target.value)}
                      disabled={loading || submitting}
                    >
                      <option value="">Select salesman</option>
                      {activeSalesmen.map((user) => (
                        <option key={user._id} value={user._id}>
                          {getName(user)}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field
                  label="Customer name"
                  id="batch-create-customer-name"
                  hint="Optional. Useful for the batch cover sheet."
                >
                  <input
                    id="batch-create-customer-name"
                    className="input"
                    type="text"
                    value={formData.customerName}
                    onChange={(event) => handleChange('customerName', event.target.value)}
                    placeholder="Customer name"
                    disabled={loading || submitting}
                  />
                </Field>

                <Field
                  label="Customer phone"
                  id="batch-create-customer-phone"
                  hint="Optional. Leave blank if not needed."
                >
                  <input
                    id="batch-create-customer-phone"
                    className="input"
                    type="text"
                    value={formData.customerPhone}
                    onChange={(event) => handleChange('customerPhone', event.target.value)}
                    placeholder="Customer phone"
                    disabled={loading || submitting}
                  />
                </Field>
              </div>

              <div className="mt-4">
                <Field
                  label="Reference note"
                  id="batch-create-reference-note"
                  hint="Optional. Internal note shown in the batch ledger."
                >
                  <textarea
                    id="batch-create-reference-note"
                    className="input min-h-[120px] resize-y"
                    value={formData.referenceNote}
                    onChange={(event) => handleChange('referenceNote', event.target.value)}
                    placeholder="Batch reference note"
                    disabled={loading || submitting}
                  />
                </Field>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl surface-panel-faint panel-border px-4 py-3 text-sm text-muted">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Supplier preview</div>
                  <div className="mt-1 text-heading font-semibold">
                    {selectedSupplier ? `${getName(selectedSupplier)}${selectedSupplier?.code ? ` (${selectedSupplier.code})` : ''}` : 'Select a supplier'}
                  </div>
                </div>
                <div className="rounded-2xl surface-panel-faint panel-border px-4 py-3 text-sm text-muted">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Salesman preview</div>
                  <div className="mt-1 text-heading font-semibold">
                    {selectedSalesman ? getName(selectedSalesman) : currentUserRole === 'salesman' ? currentUserName : 'Select a salesman'}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl surface-panel-soft panel-border p-5">
              <div className="text-sm font-bold uppercase tracking-[0.18em] text-gold-500/90">
                What happens next
              </div>
              <p className="mt-2 text-sm text-muted">
                Creating the batch saves the workflow shell. You can open the batch detail sheet next to review it and continue operational work.
              </p>
            </section>

            <div className="flex flex-col gap-3 border-t panel-border pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                className={buttonStyles.secondary}
                onClick={onClose}
                disabled={loading || submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={buttonStyles.primary}
                disabled={!canCreate}
              >
                {submitting ? (
                  <>
                    <LoadingSpinner />
                    Creating...
                  </>
                ) : (
                  'Create batch'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
