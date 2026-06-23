import { createPortal } from 'react-dom'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

const sanitizeDigits = (value) => String(value || '').replace(/\D/g, '').slice(0, 10)

export default function CustomerFormModal({
  open,
  mode,
  formData,
  setFormData,
  errors,
  isSaving,
  onClose,
  onSubmit,
}) {
  if (!open) return null

  const title = mode === 'edit' ? 'Edit Customer' : 'Add Customer'
  const description = mode === 'edit'
    ? 'Update customer details without affecting historical sessions.'
    : 'Create a customer record for session tracking and reporting.'

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-start sm:items-center justify-center overflow-y-auto p-4 sm:p-6 bg-[var(--jsm-overlay-strong)] backdrop-blur-2xl saturate-150">
      <div className="w-full max-w-2xl my-4 max-h-[calc(100vh-2rem)] overflow-y-auto p-8 md:p-10 rounded-[28px] border border-[var(--jsm-border-strong)] bg-[color-mix(in_srgb,var(--jsm-surface)_84%,transparent)] backdrop-blur-3xl shadow-[0_24px_80px_rgba(0,0,0,0.18)] animate-zoom-in duration-300 text-primary">
        <h2 className="text-2xl font-bold font-display text-heading uppercase tracking-tight mb-2">
          {title}
        </h2>
        <p className="text-muted text-sm mb-6">{description}</p>

        {errors.length > 0 ? (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">
            <div className="font-bold text-red-100">Please fix the following:</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="field">
              <label className="field-label">Name</label>
              <input
                required
                type="text"
                className="input"
                placeholder="Customer name"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-label">Phone</label>
              <input
                required
                type="tel"
                inputMode="numeric"
                maxLength={10}
                className="input"
                placeholder="10 digit phone number"
                value={formData.phone}
                onChange={(event) => setFormData({ ...formData, phone: sanitizeDigits(event.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="field">
              <label className="field-label">Area / Location</label>
              <input
                required
                type="text"
                className="input"
                placeholder="Area / location"
                value={formData.area}
                onChange={(event) => setFormData({ ...formData, area: event.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="Optional email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t panel-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-heading transition-all surface-panel-faint hover:bg-[var(--jsm-surface-strong)] rounded-2xl"
              aria-label="Cancel customer form"
            >
              Cancel
            </button>
            <button
              disabled={isSaving}
              type="submit"
              className="flex-[2] primary-luxury-button text-on-accent"
              aria-label={mode === 'edit' ? 'Save customer changes' : 'Create customer'}
            >
              {isSaving ? (
                <>
                  <LoadingSpinner />
                  Saving...
                </>
              ) : mode === 'edit' ? 'Save Changes' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

