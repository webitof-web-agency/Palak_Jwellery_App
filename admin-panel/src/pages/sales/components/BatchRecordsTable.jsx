import SectionCard from '../../../components/ui/SectionCard'
import EmptyState from '../../../components/ui/EmptyState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { formatDateTime, formatWeight } from '../../../utils/formatters'
import { buttonStyles, formatBatchStatusLabel, getName } from '../salesPage.utils'

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

const formatWeightValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return formatWeight(value)
}

const StatusBadge = ({ status }) => {
  const toneMap = {
    draft: 'surface-panel-faint border-[var(--jsm-border)] text-muted',
    open: 'border-gold-500/30 bg-gold-500/10 text-gold-100',
    submitted: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    finalized: 'border-green-400/30 bg-green-400/10 text-green-100',
    reopened: 'border-red-400/30 bg-red-400/10 text-red-100',
    cancelled: 'surface-panel-faint border-[var(--jsm-border)] text-muted',
  }

  const normalized = String(status || '').toLowerCase()

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
        toneMap[normalized] || toneMap.draft
      }`}
    >
      {formatBatchStatusLabel(normalized)}
    </span>
  )
}

const LoadingRows = () => (
  <tbody className="divide-y divide-[var(--jsm-border)]">
    {[...Array(6)].map((_, rowIndex) => (
      <tr key={rowIndex}>
        {[...Array(14)].map((__, cellIndex) => (
          <td key={cellIndex} className="px-5 py-4">
            <div className="skeleton-line h-4" />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
)

export default function BatchRecordsTable({
  batches,
  loading,
  page,
  pages,
  total,
  limit,
  onPageChange,
  onViewBatch,
  onSubmitBatch,
  onFinalizeBatch,
  onReopenBatch,
  onViewRevisions,
  viewingBatchId,
  actionLoadingBatchId,
  currentUserRole,
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
        <table className="w-full min-w-[1440px] text-left">
          <thead>
            <tr className="border-b border-[var(--jsm-border)] text-[10px] uppercase tracking-[0.18em] text-muted">
              <th className="px-5 py-4">Batch Ref</th>
              <th className="px-5 py-4">Date</th>
              <th className="px-5 py-4">Supplier</th>
              <th className="px-5 py-4">Assigned Salesman</th>
              <th className="px-5 py-4">Customer / Reference</th>
              <th className="px-5 py-4 text-right">Items</th>
              <th className="px-5 py-4 text-right">Gross Total</th>
              <th className="px-5 py-4 text-right">Stone Total</th>
              <th className="px-5 py-4 text-right">Net Total</th>
              <th className="px-5 py-4 text-right">Fine Total</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Revision</th>
              <th className="px-5 py-4 text-right">Review Count</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>

          {loading ? (
            <LoadingRows />
          ) : batches.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan="14" className="px-5 py-6">
                  <EmptyState
                    title="No batches found"
                    description="Try widening the date range or clearing a filter."
                  />
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody className="divide-y divide-[var(--jsm-border)]">
              {batches.map((batch) => {
                const status = String(batch?.status || '').toLowerCase()
                const canSubmit = ['draft', 'open'].includes(status)
                const canFinalize = status === 'submitted' && currentUserRole === 'admin'
                const canReopen = status === 'finalized' && currentUserRole === 'admin'
                const hasRevisions = Number(batch?.revision) > 1
                const batchSupplier = getName(batch?.supplier)
                const assignedSalesman = getName(batch?.assignedSalesman || batch?.salesman)
                const customerText = [batch?.customerName, batch?.referenceNote]
                  .filter((value) => value !== null && value !== undefined && value !== '')
                  .join(' · ')
                const actionBusy = actionLoadingBatchId === batch._id

                return (
                  <tr key={batch._id} className="hover:bg-[var(--jsm-panel-bg-faint)]">
                    <td className="px-5 py-4 font-mono text-xs text-muted whitespace-nowrap">
                      {batch.batchRef || '—'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-primary">
                      {formatDateTime(batch.createdAt || batch.updatedAt)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-primary">
                      {batchSupplier}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-primary">
                      {assignedSalesman}
                    </td>
                    <td className="px-5 py-4 text-primary">
                      <div className="max-w-[260px] truncate">
                        {formatValue(customerText)}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {formatValue(batch?.itemCount)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {formatWeightValue(batch?.totals?.grossWeight)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {formatWeightValue(batch?.totals?.stoneWeight)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {formatWeightValue(batch?.totals?.netWeight)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {formatWeightValue(batch?.totals?.fineWeight)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={batch?.status} />
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {formatValue(batch?.revision)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {formatValue(batch?.reviewCount)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className={buttonStyles.ghost}
                          onClick={() => onViewBatch?.(batch._id)}
                          aria-label={`View batch ${batch.batchRef || 'details'}`}
                          disabled={actionBusy && viewingBatchId === batch._id}
                        >
                          {actionBusy && viewingBatchId === batch._id ? (
                            <>
                              <LoadingSpinner />
                              Opening...
                            </>
                          ) : (
                            'View batch'
                          )}
                        </button>

                        {canSubmit ? (
                          <button
                            type="button"
                            className={buttonStyles.secondary}
                            onClick={() => onSubmitBatch?.(batch._id)}
                            aria-label={`Submit batch ${batch.batchRef || ''}`.trim()}
                            disabled={actionBusy}
                          >
                            Submit
                          </button>
                        ) : null}

                        {canFinalize ? (
                          <button
                            type="button"
                            className={buttonStyles.primary}
                            onClick={() => onFinalizeBatch?.(batch._id)}
                            aria-label={`Finalize batch ${batch.batchRef || ''}`.trim()}
                            disabled={actionBusy}
                          >
                            Finalize
                          </button>
                        ) : null}

                        {canReopen ? (
                          <button
                            type="button"
                            className={buttonStyles.secondary}
                            onClick={() => onReopenBatch?.(batch._id)}
                            aria-label={`Reopen batch ${batch.batchRef || ''}`.trim()}
                            disabled={actionBusy}
                          >
                            Reopen
                          </button>
                        ) : null}

                        {hasRevisions ? (
                          <button
                            type="button"
                            className={buttonStyles.ghost}
                            onClick={() => onViewRevisions?.(batch._id)}
                            aria-label={`View revisions for ${batch.batchRef || 'this batch'}`}
                            disabled={actionBusy}
                          >
                            Revisions
                          </button>
                        ) : null}
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
            aria-label="Previous batches page"
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
            aria-label="Next batches page"
          >
            Next
          </button>
        </div>
      </div>
    </SectionCard>
  )
}
