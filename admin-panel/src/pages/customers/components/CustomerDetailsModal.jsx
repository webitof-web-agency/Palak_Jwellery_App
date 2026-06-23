import { createPortal } from 'react-dom'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatNumber = (value, digits = 2) => Number(value || 0).toFixed(digits)

export default function CustomerDetailsModal({
  open,
  customer,
  loading,
  data,
  error,
  onClose,
}) {
  if (!open) return null

  const aggregates = data?.aggregates || {}
  const history = Array.isArray(data?.history) ? data.history : []
  const salesmanHistory = Array.isArray(data?.salesmanHistory) ? data.salesmanHistory : []

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-start sm:items-center justify-center overflow-y-auto p-4 sm:p-6 bg-[var(--jsm-overlay-strong)] backdrop-blur-2xl saturate-150">
      <div className="w-full max-w-4xl my-4 max-h-[calc(100vh-2rem)] overflow-y-auto p-8 md:p-10 rounded-[28px] border border-[var(--jsm-border-strong)] bg-[color-mix(in_srgb,var(--jsm-surface)_84%,transparent)] backdrop-blur-3xl shadow-[0_24px_80px_rgba(0,0,0,0.18)] animate-zoom-in duration-300 text-primary">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold font-display text-heading uppercase tracking-tight mb-2">
              Customer Profile
            </h2>
            <p className="text-muted text-sm">Read-only summary of the customer and their saved sessions.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="secondary-luxury-button text-on-accent"
          >
            Close
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-48 items-center justify-center rounded-3xl border border-[var(--jsm-border)] surface-panel-soft">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Total Sessions', value: data?.aggregates?.totalSessions ?? 0 },
                { label: 'Total Items', value: data?.aggregates?.totalItems ?? 0 },
                { label: 'Total Gross', value: `${formatNumber(aggregates.totalGross)} g` },
                { label: 'Total Net', value: `${formatNumber(aggregates.totalNet)} g` },
              ].map((stat) => (
                <div key={stat.label} className="rounded-3xl border border-[var(--jsm-border)] surface-panel-soft p-5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-heading">{stat.label}</div>
                  <div className="mt-2 text-2xl font-bold text-primary">{stat.value}</div>
                </div>
              ))}
            </section>

            <section className="rounded-3xl border border-[var(--jsm-border)] surface-panel-soft p-6 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-heading">Customer Details</div>
              <div className="text-lg font-bold text-primary">{customer?.name || data?.customer?.name || '-'}</div>
              <div className="text-sm text-muted">Phone: {customer?.phone || data?.customer?.phone || '-'}</div>
              <div className="text-sm text-muted">Area: {customer?.area || data?.customer?.area || '-'}</div>
              <div className="text-sm text-muted">Email: {customer?.email || data?.customer?.email || '-'}</div>
              <div className="text-sm text-muted">Relation source: {data?.relationSource || '-'}</div>
              <div className="text-sm text-muted">Last updated: {formatDate(data?.customer?.updatedAt || customer?.updatedAt)}</div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-[var(--jsm-border)] surface-panel-soft p-6">
                <div className="text-[10px] font-bold uppercase tracking-widest text-heading mb-4">Recent Sessions</div>
                {history.length > 0 ? (
                  <div className="space-y-3">
                    {history.map((item) => (
                      <div key={String(item.id)} className="rounded-2xl border border-[var(--jsm-border)] bg-[var(--jsm-surface-strong)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-bold text-primary">{item.reference || '-'}</div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-heading">{item.status || '-'}</div>
                        </div>
                        <div className="mt-2 text-sm text-muted">
                          Items {item.itemCount} · Gross {formatNumber(item.grossWeight)} g · Net {formatNumber(item.netWeight)} g · Fine {formatNumber(item.fineWeight)} g
                        </div>
                        <div className="mt-1 text-xs text-muted">Date: {formatDate(item.date)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--jsm-border)] p-6 text-sm text-muted">
                    No linked sessions yet.
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-[var(--jsm-border)] surface-panel-soft p-6">
                <div className="text-[10px] font-bold uppercase tracking-widest text-heading mb-4">Salesman History</div>
                {salesmanHistory.length > 0 ? (
                  <div className="space-y-3">
                    {salesmanHistory.map((item) => (
                      <div key={String(item.salesmanId)} className="rounded-2xl border border-[var(--jsm-border)] bg-[var(--jsm-surface-strong)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-bold text-primary">{item.salesmanName || '-'}</div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-heading">{item.sessionCount} sessions</div>
                        </div>
                        <div className="mt-2 text-sm text-muted">Items {item.totalItems} · Fine {formatNumber(item.totalFine)} g</div>
                        <div className="mt-1 text-xs text-muted">Last session: {formatDate(item.lastSessionAt)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--jsm-border)] p-6 text-sm text-muted">
                    No salesman history available yet.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
