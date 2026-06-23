import { createPortal } from 'react-dom'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function CustomerArchiveDialog({
  open,
  customer,
  step,
  reason,
  confirmText,
  isSubmitting,
  onClose,
  onStepChange,
  onReasonChange,
  onConfirmTextChange,
  onConfirm,
}) {
  if (!open) return null

  const hasSales = Number(customer?.sessionCount || 0) > 0
  const isSecondStep = hasSales && step === 2
  const needsTypedConfirm = hasSales

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-start sm:items-center justify-center overflow-y-auto p-4 sm:p-6 bg-[var(--jsm-overlay-strong)] backdrop-blur-2xl saturate-150">
      <div className="w-full max-w-lg my-4 max-h-[calc(100vh-2rem)] overflow-y-auto p-8 md:p-10 rounded-[28px] border border-[var(--jsm-border-strong)] bg-[color-mix(in_srgb,var(--jsm-surface)_84%,transparent)] backdrop-blur-3xl shadow-[0_24px_80px_rgba(0,0,0,0.18)] animate-zoom-in duration-300 text-primary">
        <h2 className="text-2xl font-bold font-display text-heading uppercase tracking-tight mb-2">
          {hasSales ? 'Archive Customer with Sessions' : 'Archive Customer'}
        </h2>
        <p className="text-muted text-sm mb-6">
          {hasSales
            ? 'This customer has linked sessions. Archive will keep history intact and hide the customer from normal workflow.'
            : 'This customer has no linked sessions. Archive will hide them from normal workflow.'}
        </p>

        <div className="rounded-2xl border border-[var(--jsm-border)] surface-panel-soft p-4 mb-6 space-y-1">
          <div className="font-bold text-primary">{customer?.name || '-'}</div>
          <div className="text-sm text-muted">{customer?.phone || '-'}</div>
          <div className="text-sm text-muted">{customer?.area || '-'}</div>
          <div className="text-sm text-muted">Sessions: {customer?.sessionCount ?? 0}</div>
        </div>

        {hasSales && step === 1 ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100 mb-6">
            Double confirmation is required because this customer already has sales history.
          </div>
        ) : null}

        {isSecondStep ? (
          <div className="space-y-4 mb-6">
            <div className="field">
              <label className="field-label">Archive reason</label>
              <textarea
                className="input min-h-28"
                placeholder="Why is this customer being archived?"
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">Type customer name to confirm</label>
              <input
                className="input"
                type="text"
                placeholder={customer?.name || 'Customer name'}
                value={confirmText}
                onChange={(event) => onConfirmTextChange(event.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div className="flex gap-4 pt-4 border-t panel-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-heading transition-all surface-panel-faint hover:bg-[var(--jsm-surface-strong)] rounded-2xl"
          >
            Cancel
          </button>
          {hasSales && step === 1 ? (
            <button
              type="button"
              onClick={onStepChange}
              className="flex-[2] primary-luxury-button text-on-accent"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting || (needsTypedConfirm && confirmText.trim() !== (customer?.name || '').trim()) || (hasSales && !reason.trim())}
              className="flex-[2] primary-luxury-button text-on-accent disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner />
                  Archiving...
                </>
              ) : hasSales ? 'Archive Customer' : 'Archive Customer'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
