import SectionCard from '../../../components/ui/SectionCard'
import EmptyState from '../../../components/ui/EmptyState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { formatDateTime, formatWeight } from '../../../utils/formatters'
import { buttonStyles, formatSessionStatusLabel, getName } from '../salesPage.utils'

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

const formatWeightValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return formatWeight(value)
}

const StatusBadge = ({ status }) => {
  const toneMap = {
    draft: 'surface-panel-faint border-[var(--jsm-border)] text-muted',
    open: 'border-gold-500/30 bg-gold-500/10 text-gold-100',
    submitted: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    finalized: 'border-green-400/30 bg-green-400/10 text-green-100',
    cancelled: 'surface-panel-faint border-[var(--jsm-border)] text-muted',
  }

  const normalized = String(status || '').toLowerCase()

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
        toneMap[normalized] || toneMap.draft
      }`}
    >
      {formatSessionStatusLabel(normalized)}
    </span>
  )
}

const WarningBadge = ({ session }) => {
  const warnings = Number(session?.warningsCount) || 0
  const reviews = Number(session?.reviewCount) || 0
  const duplicates = Number(session?.duplicateCount) || 0
  const overrides = Number(session?.manualOverrideCount) || 0

  const titleParts = []
  if (reviews) titleParts.push(`${reviews} review`)
  if (duplicates) titleParts.push(`${duplicates} duplicate`)
  if (overrides) titleParts.push(`${overrides} override`)

  if (!warnings) {
    return <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] surface-panel-faint border-[var(--jsm-border)] text-muted">None</span>
  }

  return (
    <div className="flex flex-col gap-1">
      <span
        className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200"
        title={titleParts.join(' | ') || 'Warnings recorded'}
      >
        {warnings} warning{warnings === 1 ? '' : 's'}
      </span>
      {titleParts.length ? (
        <span className="text-[11px] leading-4 text-muted">{titleParts.join(' | ')}</span>
      ) : null}
    </div>
  )
}

const LoadingRows = () => (
  <tbody className="divide-y divide-[var(--jsm-border)]">
    {[...Array(6)].map((_, rowIndex) => (
      <tr key={rowIndex}>
        {[...Array(10)].map((__, cellIndex) => (
          <td key={cellIndex} className="px-5 py-4">
            <div className="skeleton-line h-4" />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
)

export default function CaptureSessionRecordsTable({
  sessions,
  loading,
  page,
  pages,
  total,
  limit,
  onPageChange,
  onViewSession,
  viewingSessionId,
  actionLoadingSessionId,
}) {
  const rangeText = (() => {
    if (!total) {
      return 'Showing 0 - 0 of 0 results'
    }

    const start = (page - 1) * limit + 1
    const end = Math.min(page * limit, total)
    return `Showing ${start} - ${end} of ${total} results`
  })()

  return (
    <SectionCard className="!p-0 overflow-hidden">
      <div className="overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
        <table className="w-full min-w-[1350px] text-left">
          <thead>
            <tr className="border-b border-[var(--jsm-border)] text-[10px] uppercase tracking-[0.18em] text-muted">
              <th className="px-5 py-4">Date</th>
              <th className="px-5 py-4">Customer</th>
              <th className="px-5 py-4">Salesman</th>
              <th className="px-5 py-4 text-right">Items</th>
              <th className="px-5 py-4 text-right">Gross</th>
              <th className="px-5 py-4 text-right">Net</th>
              <th className="px-5 py-4 text-right">Fine</th>
              <th className="px-5 py-4">Warnings</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>

          {loading ? (
            <LoadingRows />
          ) : sessions.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan="10" className="px-5 py-6">
                  <EmptyState
                    title="No capture sessions found"
                    description="Try widening the date range or clearing a filter."
                  />
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody className="divide-y divide-[var(--jsm-border)]">
              {sessions.map((session) => {
                const actionBusy = actionLoadingSessionId === session._id
                const customerLabel = session?.customerName || session?.customerPhone || 'Unknown'
                const customerMeta = [session?.customerPhone, session?.referenceNote]
                  .filter((value) => value !== null && value !== undefined && value !== '')
                  .join(' | ')

                return (
                  <tr key={session._id} className="hover:bg-[var(--jsm-panel-bg-faint)]">
                    <td className="px-5 py-4 whitespace-nowrap text-primary">
                      {formatDateTime(session.createdAt || session.updatedAt)}
                      <div className="mt-1 font-mono text-[11px] text-muted">{session.sessionRef || '-'}</div>
                    </td>
                    <td className="px-5 py-4 text-primary">
                      <div className="max-w-[260px] truncate font-semibold">{formatValue(customerLabel)}</div>
                      {customerMeta ? <div className="mt-1 text-[11px] text-muted">{customerMeta}</div> : null}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-primary">
                      {getName(session?.assignedSalesman)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {formatValue(session?.itemCount)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {formatWeightValue(session?.totals?.grossWeight)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {formatWeightValue(session?.totals?.netWeight)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {formatWeightValue(session?.totals?.fineWeight)}
                    </td>
                    <td className="px-5 py-4">
                      <WarningBadge session={session} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={session?.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <button
                          type="button"
                          className={buttonStyles.ghost}
                          onClick={() => onViewSession?.(session._id)}
                          aria-label={`View session ${session.sessionRef || 'details'}`}
                          disabled={actionBusy && viewingSessionId === session._id}
                        >
                          {actionBusy && viewingSessionId === session._id ? (
                            <>
                              <LoadingSpinner />
                              Opening...
                            </>
                          ) : (
                            'View'
                          )}
                        </button>
                        <button
                          type="button"
                          className={buttonStyles.secondary}
                          disabled
                          title="Coming soon"
                          aria-label={`Delete session ${session.sessionRef || 'details'} coming soon`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          )}
        </table>
      </div>

      <div className="flex flex-col gap-4 border-t border-[var(--jsm-border)] px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted">{rangeText}</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={buttonStyles.secondary}
            disabled={loading || page <= 1}
            onClick={() => onPageChange((current) => Math.max(1, current - 1))}
            aria-label="Previous sessions page"
          >
            Previous
          </button>
          <span className="text-xs uppercase tracking-[0.18em] text-muted">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            className={buttonStyles.secondary}
            disabled={loading || page >= pages}
            onClick={() => onPageChange((current) => Math.min(pages, current + 1))}
            aria-label="Next sessions page"
          >
            Next
          </button>
        </div>
      </div>
    </SectionCard>
  )
}
