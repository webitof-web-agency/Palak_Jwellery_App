import LoadingSpinner from '../../../components/ui/LoadingSpinner'
export default function SupplierFormActions({ error, onCancel, isSaving, submitLabel }) {
  return (
    <>
      {error ? (
        <p className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-4 rounded-xl font-bold" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t panel-border">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-muted hover:text-primary transition-all bg-white/5 hover:bg-white/10 rounded-2xl"
          aria-label="Cancel supplier editing"
        >
          Cancel
        </button>
        <button
          disabled={isSaving}
          type="submit"
          className="flex-[2] primary-luxury-button text-sm text-on-accent"
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
    </>
  )
}
