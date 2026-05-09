import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import React from 'react'

export default function SupplierAlerts({
  successMessage,
  errorMessage,
  onDismissSuccess,
  onDismissError,
  onRetry,
  isRetrying,
}) {
  if (!successMessage && !errorMessage) {
    return null
  }

  return (
    <>
      {successMessage && (
        <div className="mb-6 bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-2xl flex items-start justify-between gap-4 animate-fade-in duration-300">
          <p>{successMessage}</p>
          <button
            type="button"
            className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-primary"
            onClick={onDismissSuccess}
            aria-label="Dismiss success message"
          >
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex justify-between items-start gap-4 transition-all">
          <p>{errorMessage}</p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-primary"
              onClick={onRetry}
              aria-label="Retry loading suppliers"
              disabled={isRetrying}
            >
              {isRetrying ? (
                <>
                  <LoadingSpinner />
                  Retrying...
                </>
              ) : (
                'Retry'
              )}
            </button>
            <button
              type="button"
              className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-primary"
              onClick={onDismissError}
              aria-label="Dismiss error message"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}
