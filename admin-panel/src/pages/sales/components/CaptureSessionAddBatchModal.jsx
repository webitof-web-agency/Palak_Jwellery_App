import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { getName, buttonStyles } from '../salesPage.utils'

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

export default function CaptureSessionAddBatchModal({
  open,
  session = null,
  suppliers = [],
  loading = false,
  error = '',
  onClose,
  onCreate,
}) {
  const [formData, setFormData] = useState({
    supplierId: '',
    customerName: '',
    customerPhone: '',
    referenceNote: '',
  })
  const [localError, setLocalError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const supplierOptions = useMemo(() => (Array.isArray(suppliers) ? suppliers : []), [suppliers])

  useEffect(() => {
    if (!open) {
      setSubmitting(false)
      setLocalError('')
      return undefined
    }

    setLocalError('')
    setFormData({
      supplierId: '',
      customerName: valueOrEmpty(session?.customerName),
      customerPhone: valueOrEmpty(session?.customerPhone),
      referenceNote: valueOrEmpty(session?.referenceNote),
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
  }, [
    open,
    onClose,
    session?._id,
    session?.customerName,
    session?.customerPhone,
    session?.referenceNote,
  ])

  const selectedSupplier = Array.isArray(supplierOptions)
    ? supplierOptions.find((supplier) => String(supplier?._id || '') === String(formData.supplierId || ''))
    : null

  const canCreate =
    !submitting &&
    !loading &&
    String(formData.supplierId || '').trim() !== ''

  const handleChange = (name, value) => {
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLocalError('')

    const supplierId = String(formData.supplierId || '').trim()
    if (!supplierId) {
      setLocalError('Supplier is required.')
      return
    }

    setSubmitting(true)

    try {
      await onCreate?.({
        supplierId,
        customerName: String(formData.customerName || '').trim(),
        customerPhone: String(formData.customerPhone || '').trim(),
        referenceNote: String(formData.referenceNote || '').trim(),
      })
    } catch (submitError) {
      setLocalError(submitError?.error || submitError?.message || 'Failed to add supplier batch.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open || typeof document === 'undefined') {
    return null
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-[color:var(--jsm-overlay)] p-3 backdrop-blur-md backdrop-saturate-75 md:p-6"
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
            <span className="eyebrow">Add supplier batch</span>
            <h2 className="mt-2 text-2xl font-bold font-display text-heading">
              Attach a supplier batch
            </h2>
            <p className="mt-1 text-sm text-muted">
              Add a new supplier batch inside the current capture session.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex min-h-11 flex-shrink-0 items-center justify-center rounded-xl surface-panel-soft panel-border px-4 text-sm font-semibold text-primary transition-all duration-200 hover:bg-gold-500/10 hover:border-gold-500/30"
            onClick={onClose}
            aria-label="Close add batch dialog"
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
                  id="session-add-batch-supplier"
                  hint="Required. Each supplier can only appear once in a session."
                >
                  <select
                    id="session-add-batch-supplier"
                    className="input"
                    value={formData.supplierId}
                    onChange={(event) => handleChange('supplierId', event.target.value)}
                    disabled={loading || submitting}
                  >
                    <option value="">Select supplier</option>
                    {supplierOptions.map((supplier) => (
                      <option key={supplier._id} value={supplier._id}>
                        {getName(supplier)}{supplier?.code ? ` (${supplier.code})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Customer name"
                  id="session-add-batch-customer-name"
                  hint="Optional. Defaults to the session customer if present."
                >
                  <input
                    id="session-add-batch-customer-name"
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
                  id="session-add-batch-customer-phone"
                  hint="Optional. Useful for the batch cover note."
                >
                  <input
                    id="session-add-batch-customer-phone"
                    className="input"
                    type="text"
                    value={formData.customerPhone}
                    onChange={(event) => handleChange('customerPhone', event.target.value)}
                    placeholder="Customer phone"
                    disabled={loading || submitting}
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field
                    label="Reference note"
                    id="session-add-batch-reference-note"
                    hint="Optional. Use this for the batch note or job reference."
                  >
                    <textarea
                      id="session-add-batch-reference-note"
                      className="input min-h-28 resize-y"
                      value={formData.referenceNote}
                      onChange={(event) => handleChange('referenceNote', event.target.value)}
                      placeholder="Reference note"
                      disabled={loading || submitting}
                    />
                  </Field>
                </div>

                {selectedSupplier ? (
                  <div className="md:col-span-2 rounded-2xl surface-panel-faint panel-border px-4 py-3 text-sm text-muted">
                    Selected supplier: <span className="text-primary font-medium">{getName(selectedSupplier)}</span>
                  </div>
                ) : null}
              </div>
            </section>
          </form>
        </div>

        <div className="flex flex-col gap-3 border-t panel-border px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="text-sm text-muted">
            Item capture for this supplier batch continues from the mobile app.
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className={buttonStyles.secondary}
              onClick={onClose}
              disabled={loading || submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canCreate}
              className={buttonStyles.primary}
            >
              {submitting ? (
                <>
                  <LoadingSpinner />
                  Creating...
                </>
              ) : (
                'Add batch'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
