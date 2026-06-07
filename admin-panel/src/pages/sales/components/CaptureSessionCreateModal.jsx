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

export default function CaptureSessionCreateModal({
  open,
  users = [],
  currentUser = null,
  currentUserRole = '',
  loading = false,
  error = '',
  onClose,
  onCreate,
}) {
  const [formData, setFormData] = useState({
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

  const canCreate =
    !submitting &&
    !loading &&
    String(formData.assignedSalesmanId || '').trim() !== ''

  const handleChange = (name, value) => {
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLocalError('')

    const assignedSalesmanId = String(formData.assignedSalesmanId || '').trim()

    if (!assignedSalesmanId) {
      setLocalError('Assigned salesman is required.')
      return
    }

    setSubmitting(true)

    try {
      await onCreate?.({
        assignedSalesmanId,
        customerName: String(formData.customerName || '').trim(),
        customerPhone: String(formData.customerPhone || '').trim(),
        referenceNote: String(formData.referenceNote || '').trim(),
      })
    } catch (submitError) {
      setLocalError(submitError?.error || submitError?.message || 'Failed to create capture session.')
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
            <span className="eyebrow">Create session</span>
            <h2 className="mt-2 text-2xl font-bold font-display text-heading">
              New capture session
            </h2>
            <p className="mt-1 text-sm text-muted">
              Create an umbrella session for one assigned salesman and optional customer details.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex min-h-11 flex-shrink-0 items-center justify-center rounded-xl surface-panel-soft panel-border px-4 text-sm font-semibold text-primary transition-all duration-200 hover:bg-gold-500/10 hover:border-gold-500/30"
            onClick={onClose}
            aria-label="Close create session dialog"
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
                {currentUserRole === 'salesman' ? (
                  <Field
                    label="Assigned salesman"
                    id="session-create-salesman"
                    hint="For salesmen, the session is assigned to your account."
                  >
                    <div className="rounded-xl surface-panel-soft panel-border px-4 py-3 text-sm text-heading">
                      {currentUserName}
                    </div>
                  </Field>
                ) : (
                  <Field
                    label="Assigned salesman"
                    id="session-create-salesman"
                    hint="Required for admin-created sessions."
                  >
                    <select
                      id="session-create-salesman"
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
                  id="session-create-customer-name"
                  hint="Optional. Useful for grouping the session."
                >
                  <input
                    id="session-create-customer-name"
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
                  id="session-create-customer-phone"
                  hint="Optional. Helps match the customer record."
                >
                  <input
                    id="session-create-customer-phone"
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
                    id="session-create-reference-note"
                    hint="Optional. Use this for the session cover note or job reference."
                  >
                    <textarea
                      id="session-create-reference-note"
                      className="input min-h-28 resize-y"
                      value={formData.referenceNote}
                      onChange={(event) => handleChange('referenceNote', event.target.value)}
                      placeholder="Reference note"
                      disabled={loading || submitting}
                    />
                  </Field>
                </div>
              </div>
            </section>
          </form>
        </div>

        <div className="flex flex-col gap-3 border-t panel-border px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="text-sm text-muted">
            Capture sessions keep supplier batches grouped under one salesman assignment.
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
                'Create session'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
