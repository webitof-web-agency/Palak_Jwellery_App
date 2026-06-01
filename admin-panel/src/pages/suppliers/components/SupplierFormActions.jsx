import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function SupplierFormActions({
  error,
  onCancel,
  isSaving,
  submitLabel,
  className = '',
}) {
  return (
    <div className={className}>
      <div className="surface-panel-soft panel-border rounded-2xl p-3 md:p-4 shadow-lg shadow-black/5 dark:shadow-black/20 backdrop-blur-sm">
        {error ? (
          <p
            className="mb-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-xl font-bold"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-heading transition-all surface-panel-soft border panel-border hover:bg-gold-500/10 hover:border-gold-500/30 rounded-2xl"
            aria-label="Cancel supplier editing"
          >
            Cancel
          </button>
          <button
            disabled={isSaving}
            type="submit"
            className="flex-[2] primary-luxury-button text-sm text-on-accent min-h-[48px]"
            aria-label={submitLabel}
          >
            {isSaving ? (
              <>
                <LoadingSpinner />
                Saving...
              </>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
