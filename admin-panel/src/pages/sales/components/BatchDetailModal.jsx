import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { formatDateTime, formatWeight } from '../../../utils/formatters'
import {
  buttonStyles,
  formatBatchEntryModeLabel,
  formatBatchStatusLabel,
  getName,
} from '../salesPage.utils'

const valueOrDash = (value) => {
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

const DetailField = ({ label, value, hint = null, mono = false }) => (
  <div className="rounded-2xl surface-panel-faint panel-border px-4 py-3">
    <div className="text-[10px] uppercase tracking-[0.18em] text-muted">{label}</div>
    <div className={`mt-1 text-sm font-semibold ${mono ? 'font-mono break-all' : 'text-heading'}`}>
      {value}
    </div>
    {hint ? <div className="mt-1 text-[11px] leading-5 text-muted">{hint}</div> : null}
  </div>
)

const SectionTitle = ({ title, description }) => (
  <div>
    <div className="text-sm font-bold uppercase tracking-[0.18em] text-gold-500/90">{title}</div>
    {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
  </div>
)

const Badge = ({ children, tone = 'neutral' }) => {
  const toneClasses = {
    neutral: 'border panel-border surface-panel-soft text-primary',
    gold: 'border-gold-500/30 bg-gold-500/10 text-gold-100',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    rose: 'border-red-400/30 bg-red-400/10 text-red-100',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${toneClasses[tone] || toneClasses.neutral}`}
    >
      {children}
    </span>
  )
}

const SnapshotNotice = ({ children }) => (
  <div className="rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-4 text-sm text-muted">
    {children}
  </div>
)

const ChildRowBadge = ({ children, tone = 'neutral' }) => {
  const toneClasses = {
    neutral: 'surface-panel-faint border-[var(--jsm-border)] text-muted',
    gold: 'border-gold-500/30 bg-gold-500/10 text-gold-100',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    rose: 'border-red-400/30 bg-red-400/10 text-red-100',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${toneClasses[tone] || toneClasses.neutral}`}
    >
      {children}
    </span>
  )
}

const getStatusTone = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'draft':
      return 'neutral'
    case 'open':
      return 'gold'
    case 'submitted':
      return 'amber'
    case 'finalized':
      return 'gold'
    case 'reopened':
      return 'rose'
    case 'cancelled':
      return 'neutral'
    default:
      return 'neutral'
  }
}

const getEntryTone = (value) => {
  switch (String(value || '').toLowerCase()) {
    case 'manual':
      return 'amber'
    case 'mixed':
      return 'rose'
    default:
      return 'neutral'
  }
}

export default function BatchDetailModal({
  open,
  batch,
  loading,
  error,
  onClose,
  onViewSale,
  onSubmitBatch,
  onFinalizeBatch,
  onReopenBatch,
  currentUserRole = '',
  initialAction = null,
}) {
  const [activeAction, setActiveAction] = useState(null)
  const [reopenReason, setReopenReason] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (!open) {
      return undefined
    }

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
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setActiveAction(null)
      setReopenReason('')
      setActionBusy(false)
      setActionError('')
      return
    }

    setActiveAction(initialAction || null)
    setActionError('')
    setReopenReason('')
  }, [initialAction, open, batch?._id])

  const supplier = batch?.supplier && typeof batch.supplier === 'object' ? batch.supplier : {}
  const salesman = batch?.assignedSalesman && typeof batch.assignedSalesman === 'object'
    ? batch.assignedSalesman
    : batch?.salesman && typeof batch.salesman === 'object'
      ? batch.salesman
      : {}
  const currentRevision = batch?.currentRevision && typeof batch.currentRevision === 'object'
    ? batch.currentRevision
    : {}
  const revisionHistory = Array.isArray(batch?.revisionHistory) ? batch.revisionHistory : []
  const items = Array.isArray(batch?.items) ? batch.items : []
  const totals = batch?.totals && typeof batch.totals === 'object' ? batch.totals : {}
  const status = String(batch?.status || '').toLowerCase()
  const statusTone = getStatusTone(status)
  const entryModeLabel = formatBatchEntryModeLabel(batch?.entryMode || currentRevision?.entryMode)
  const canSubmit = ['draft', 'open', 'reopened'].includes(status) && ['admin', 'salesman'].includes(currentUserRole)
  const canFinalize = status === 'submitted' && currentUserRole === 'admin'
  const canReopen = status === 'finalized' && currentUserRole === 'admin'
  const hasItems = items.length > 0
  const hasRevisions = revisionHistory.length > 0
  const workflowNotice = (() => {
    switch (status) {
      case 'submitted':
        return 'This batch is awaiting admin review. Finalize it or return it for correction.'
      case 'finalized':
        return 'This batch is finalized. Reopen it to allow the assigned salesman to add more items.'
      case 'cancelled':
        return 'This batch is cancelled. No new items can be added.'
      case 'draft':
      case 'open':
      case 'reopened':
      default:
        return 'Assigned salesman can add items from the mobile app.'
    }
  })()
  const activeSummaryAction = useMemo(() => {
    if (activeAction === 'submit' && canSubmit) return 'submit'
    if (activeAction === 'finalize' && canFinalize) return 'finalize'
    if (activeAction === 'reopen' && canReopen) return 'reopen'
    return null
  }, [activeAction, canFinalize, canReopen, canSubmit])

  const runAction = async (action) => {
    if (actionBusy) return

    setActionBusy(true)
    setActionError('')
    try {
      if (action === 'submit') {
        await onSubmitBatch?.(batch?._id)
      } else if (action === 'finalize') {
        await onFinalizeBatch?.(batch?._id)
      } else if (action === 'reopen') {
        if (!reopenReason.trim()) {
          setActionError('Reopen reason is required.')
          return
        }
        await onReopenBatch?.(batch?._id, reopenReason.trim())
      }
      setActiveAction(null)
      setReopenReason('')
    } catch (submitError) {
      setActionError(submitError?.error || submitError?.message || 'Batch action failed.')
    } finally {
      setActionBusy(false)
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
      <div className="flex h-[calc(100vh-1.5rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] bg-[color:var(--jsm-surface)] panel-border shadow-[0_24px_80px_rgba(0,0,0,0.42)] md:h-[90vh]">
        <div className="flex items-start justify-between gap-4 border-b panel-border px-5 py-4 md:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Batch detail</span>
              <Badge tone={statusTone}>{formatBatchStatusLabel(status)}</Badge>
              {hasRevisions ? <Badge tone="amber">Revision {batch?.revision || currentRevision?.revision || 1}</Badge> : null}
            </div>
            <h2 className="mt-2 text-2xl font-bold font-display text-heading">
              {batch?.batchRef || 'Batch detail'}
            </h2>
            <p className="mt-1 break-words text-sm text-muted">
              {getName(supplier)}{supplier?.code ? ` (${supplier.code})` : ''} | {getName(salesman)} | {valueOrDash(formatDateTime(batch?.createdAt))}
            </p>
          </div>

          <button
            type="button"
            className="inline-flex min-h-11 flex-shrink-0 items-center justify-center rounded-xl surface-panel-soft panel-border px-4 text-sm font-semibold text-primary transition-all duration-200 hover:bg-gold-500/10 hover:border-gold-500/30"
            onClick={onClose}
            aria-label="Close batch detail"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] px-5 py-5 md:px-6">
          {loading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="flex items-center gap-3 text-muted">
                <LoadingSpinner />
                Loading batch detail...
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-primary">
              <div className="font-semibold">Unable to load batch detail</div>
              <div className="mt-1 text-sm text-muted">{error}</div>
            </div>
          ) : batch ? (
            <div className="space-y-4">
              <SnapshotNotice>{workflowNotice}</SnapshotNotice>

              {!hasItems ? (
                <SnapshotNotice>This batch does not have any items yet.</SnapshotNotice>
              ) : null}

              <section className="rounded-3xl surface-panel-soft panel-border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <SectionTitle
                  title="Header"
                  description="Batch reference, ownership, and timeline."
                />
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <DetailField label="Batch Ref" value={valueOrDash(batch?.batchRef)} mono />
                  <DetailField label="Status" value={valueOrDash(formatBatchStatusLabel(status))} />
                  <DetailField label="Revision" value={valueOrDash(batch?.revision || currentRevision?.revision)} />
                  <DetailField label="Supplier" value={valueOrDash(`${getName(supplier)}${supplier?.code ? ` (${supplier.code})` : ''}`)} />
                  <DetailField label="Assigned Salesman" value={valueOrDash(getName(salesman))} />
                  <DetailField label="Customer" value={valueOrDash(batch?.customerName || '—')} />
                  <DetailField label="Reference Note" value={valueOrDash(batch?.referenceNote)} />
                  <DetailField label="Entry Mode" value={valueOrDash(entryModeLabel)} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                  <DetailField label="Created" value={valueOrDash(formatDateTime(batch?.createdAt))} />
                  <DetailField label="Submitted" value={valueOrDash(formatDateTime(batch?.submittedAt))} />
                  <DetailField label="Finalized" value={valueOrDash(formatDateTime(batch?.finalizedAt))} />
                  <DetailField label="Reopened" value={valueOrDash(formatDateTime(batch?.reopenedAt))} />
                </div>
              </section>

              <section className="rounded-3xl surface-panel-soft panel-border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <SectionTitle
                  title="Totals summary"
                  description="Operational totals captured for this batch."
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <DetailField label="Item Count" value={valueOrDash(batch?.itemCount)} />
                  <DetailField label="Gross Total" value={formatWeightValue(totals?.grossWeight)} />
                  <DetailField label="Stone Total" value={formatWeightValue(totals?.stoneWeight)} />
                  <DetailField label="Other Total" value={formatWeightValue(totals?.otherWeight)} />
                  <DetailField label="Net Total" value={formatWeightValue(totals?.netWeight)} />
                  <DetailField label="Fine Total" value={formatWeightValue(totals?.fineWeight)} />
                  <DetailField label="Stone Amount" value={formatWeightValue(totals?.stoneAmount)} />
                  <DetailField label="Review Count" value={valueOrDash(batch?.reviewCount)} />
                  <DetailField label="Duplicate Count" value={valueOrDash(batch?.duplicateCount)} />
                  <DetailField label="Manual Override Count" value={valueOrDash(batch?.manualOverrideCount)} />
                  <DetailField label="Warnings Count" value={valueOrDash(batch?.warningsCount)} />
                  <DetailField
                    label="Current Entry Mode"
                    value={valueOrDash(formatBatchEntryModeLabel(currentRevision?.entryMode || batch?.entryMode))}
                  />
                </div>
              </section>

              <section className="rounded-3xl surface-panel-soft panel-border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <SectionTitle
                  title="Batch actions"
                  description="Submit, finalize, or reopen this batch as the workflow progresses."
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  {canSubmit ? (
                    <button
                      type="button"
                      className={buttonStyles.primary}
                      onClick={() => setActiveAction('submit')}
                      disabled={actionBusy}
                    >
                      Submit batch
                    </button>
                  ) : null}
                  {canFinalize ? (
                    <button
                      type="button"
                      className={buttonStyles.primary}
                      onClick={() => setActiveAction('finalize')}
                      disabled={actionBusy}
                    >
                      Finalize batch
                    </button>
                  ) : null}
                  {canReopen ? (
                    <button
                      type="button"
                      className={buttonStyles.secondary}
                      onClick={() => setActiveAction('reopen')}
                      disabled={actionBusy}
                    >
                      Reopen batch
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={buttonStyles.secondary}
                    onClick={onClose}
                    disabled={actionBusy}
                  >
                    Close
                  </button>
                </div>

                {activeSummaryAction ? (
                  <div className="mt-4 rounded-2xl surface-panel-faint panel-border p-4">
                    {actionError ? (
                      <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-primary">
                        {actionError}
                      </div>
                    ) : null}

                    {activeSummaryAction === 'submit' ? (
                      <div className="space-y-3">
                        <div className="text-sm text-muted">
                          Submitting moves this batch to the next workflow step.
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            className={buttonStyles.primary}
                            onClick={() => runAction('submit')}
                            disabled={actionBusy}
                          >
                            {actionBusy ? (
                              <>
                                <LoadingSpinner />
                                Submitting...
                              </>
                            ) : (
                              'Confirm submit'
                            )}
                          </button>
                          <button
                            type="button"
                            className={buttonStyles.secondary}
                            onClick={() => setActiveAction(null)}
                            disabled={actionBusy}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {activeSummaryAction === 'finalize' ? (
                      <div className="space-y-3">
                        <div className="text-sm text-muted">
                          Finalizing locks the current revision until an admin reopens it.
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            className={buttonStyles.primary}
                            onClick={() => runAction('finalize')}
                            disabled={actionBusy}
                          >
                            {actionBusy ? (
                              <>
                                <LoadingSpinner />
                                Finalizing...
                              </>
                            ) : (
                              'Confirm finalize'
                            )}
                          </button>
                          <button
                            type="button"
                            className={buttonStyles.secondary}
                            onClick={() => setActiveAction(null)}
                            disabled={actionBusy}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {activeSummaryAction === 'reopen' ? (
                      <div className="space-y-3">
                        <div className="text-sm text-muted">
                          Reopening creates a new revision. Previous finalized history remains preserved.
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor="batch-reopen-reason">
                            Reopen reason
                          </label>
                          <textarea
                            id="batch-reopen-reason"
                            className="input min-h-[110px] resize-y"
                            value={reopenReason}
                            onChange={(event) => setReopenReason(event.target.value)}
                            placeholder="Explain why the batch needs a new revision"
                            aria-label="Batch reopen reason"
                          />
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            className={buttonStyles.primary}
                            onClick={() => runAction('reopen')}
                            disabled={actionBusy}
                          >
                            {actionBusy ? (
                              <>
                                <LoadingSpinner />
                                Reopening...
                              </>
                            ) : (
                              'Confirm reopen'
                            )}
                          </button>
                          <button
                            type="button"
                            className={buttonStyles.secondary}
                            onClick={() => setActiveAction(null)}
                            disabled={actionBusy}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section className="rounded-3xl surface-panel-soft panel-border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <SectionTitle
                  title="Child items"
                  description="Item-level audit records inside this batch."
                />
                <div className="mt-4 overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
                  <table className="w-full min-w-[1300px] text-left">
                    <thead>
                      <tr className="border-b border-[var(--jsm-border)] text-[10px] uppercase tracking-[0.18em] text-muted">
                        <th className="px-4 py-3">Sale Ref</th>
                        <th className="px-4 py-3">Item / Design Code</th>
                        <th className="px-4 py-3">Karat</th>
                        <th className="px-4 py-3 text-right">Gross</th>
                        <th className="px-4 py-3 text-right">Stone</th>
                        <th className="px-4 py-3 text-right">Net</th>
                        <th className="px-4 py-3 text-right">Fine</th>
                        <th className="px-4 py-3">Entry Mode</th>
                        <th className="px-4 py-3 text-right">Revision Added</th>
                        <th className="px-4 py-3">Flags</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--jsm-border)]">
                      {items.map((sale) => {
                        const calculation = sale?.calculationSnapshot && typeof sale.calculationSnapshot === 'object'
                          ? sale.calculationSnapshot
                          : {}
                        const settlementInputs = sale?.settlementInputs && typeof sale.settlementInputs === 'object'
                          ? sale.settlementInputs
                          : {}
                        const parsedSnapshot = sale?.parsedSnapshot && typeof sale.parsedSnapshot === 'object'
                          ? sale.parsedSnapshot
                          : {}
                        const parsedDisplay = parsedSnapshot?.display && typeof parsedSnapshot.display === 'object'
                          ? parsedSnapshot.display
                          : parsedSnapshot
                        const parsedItem = parsedDisplay?.item && typeof parsedDisplay.item === 'object'
                          ? parsedDisplay.item
                          : {}
                        const itemCode = parsedItem?.itemCode || parsedItem?.designCode || sale?.itemCode || sale?.designCode || sale?.design_code
                        const karat = settlementInputs?.karat || parsedItem?.karat || sale?.purity
                        const entryMode = formatBatchEntryModeLabel(sale?.entryMode)
                        const duplicate = sale?.isDuplicate === true
                        const requiresReview = calculation?.requiresReview === true || parsedDisplay?.requiresReview === true
                        const wasOverridden = settlementInputs?.purityOverridden === true || settlementInputs?.wastageOverridden === true || sale?.wasManuallyEdited === true

                        return (
                          <tr key={sale._id} className="hover:bg-[var(--jsm-panel-bg-faint)]">
                            <td className="px-4 py-3 font-mono text-xs text-muted whitespace-nowrap">{sale?.ref || '—'}</td>
                            <td className="px-4 py-3 text-primary whitespace-nowrap">{valueOrDash(itemCode)}</td>
                            <td className="px-4 py-3 text-primary whitespace-nowrap">{valueOrDash(karat)}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{formatWeightValue(calculation?.grossWeight ?? sale?.grossWeight)}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{formatWeightValue(calculation?.stoneWeight ?? sale?.stoneWeight)}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{formatWeightValue(calculation?.selectedNetWeight ?? calculation?.computedNetWeight ?? sale?.netWeight)}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{formatWeightValue(calculation?.fineWeight ?? sale?.fineWeight)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-primary">
                              <ChildRowBadge tone={getEntryTone(sale?.entryMode)}>
                                {entryMode}
                              </ChildRowBadge>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap text-primary">
                              {valueOrDash(sale?.revisionAdded)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                {duplicate ? <ChildRowBadge tone="amber">Duplicate</ChildRowBadge> : null}
                                {requiresReview ? <ChildRowBadge tone="rose">Needs review</ChildRowBadge> : null}
                                {wasOverridden ? <ChildRowBadge tone="gold">Override</ChildRowBadge> : null}
                                {!duplicate && !requiresReview && !wasOverridden ? (
                                  <ChildRowBadge tone="neutral">OK</ChildRowBadge>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                className={buttonStyles.ghost}
                                onClick={() => onViewSale?.(sale._id)}
                                aria-label={`View item ${sale?.ref || 'details'}`}
                              >
                                View Item
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-3xl surface-panel-soft panel-border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <SectionTitle
                  title="Revision summary"
                  description="Finalized revisions and reopen history."
                />
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl surface-panel-faint panel-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="gold">Current revision</Badge>
                      <Badge tone={statusTone}>{formatBatchStatusLabel(status)}</Badge>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <DetailField label="Revision" value={valueOrDash(currentRevision?.revision || batch?.revision)} />
                      <DetailField label="Item Count" value={valueOrDash(currentRevision?.itemCount || batch?.itemCount)} />
                      <DetailField label="Finalized At" value={valueOrDash(formatDateTime(currentRevision?.finalizedAt || batch?.finalizedAt))} />
                      <DetailField label="Reopen Reason" value={valueOrDash(currentRevision?.reopenReason || batch?.reopenReason)} />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <DetailField label="Gross Total" value={formatWeightValue(currentRevision?.totals?.grossWeight ?? totals?.grossWeight)} />
                      <DetailField label="Stone Total" value={formatWeightValue(currentRevision?.totals?.stoneWeight ?? totals?.stoneWeight)} />
                      <DetailField label="Other Total" value={formatWeightValue(currentRevision?.totals?.otherWeight ?? totals?.otherWeight)} />
                      <DetailField label="Net Total" value={formatWeightValue(currentRevision?.totals?.netWeight ?? totals?.netWeight)} />
                      <DetailField label="Fine Total" value={formatWeightValue(currentRevision?.totals?.fineWeight ?? totals?.fineWeight)} />
                      <DetailField label="Stone Amount" value={formatWeightValue(currentRevision?.totals?.stoneAmount ?? totals?.stoneAmount)} />
                    </div>
                  </div>

                  <div className="rounded-2xl surface-panel-faint panel-border p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                      Revision history
                    </div>
                    <div className="mt-3 space-y-3">
                      {hasRevisions ? (
                        revisionHistory.map((revision) => (
                          <div key={revision.revision} className="rounded-2xl surface-panel-soft panel-border p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone="gold">Revision {revision.revision}</Badge>
                              <Badge tone={getStatusTone(revision.status)}>{formatBatchStatusLabel(revision.status)}</Badge>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <DetailField label="Finalized At" value={valueOrDash(formatDateTime(revision.finalizedAt))} />
                              <DetailField label="Item Count" value={valueOrDash(revision.itemCount)} />
                              <DetailField label="Gross Total" value={formatWeightValue(revision?.totals?.grossWeight)} />
                              <DetailField label="Stone Total" value={formatWeightValue(revision?.totals?.stoneWeight)} />
                              <DetailField label="Other Total" value={formatWeightValue(revision?.totals?.otherWeight)} />
                              <DetailField label="Net Total" value={formatWeightValue(revision?.totals?.netWeight)} />
                              <DetailField label="Fine Total" value={formatWeightValue(revision?.totals?.fineWeight)} />
                              <DetailField label="Stone Amount" value={formatWeightValue(revision?.totals?.stoneAmount)} />
                              <DetailField label="Reopen Reason" value={valueOrDash(revision.reopenReason)} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed panel-border surface-panel-soft px-4 py-4 text-sm text-muted">
                          No historical revisions yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl surface-panel-soft panel-border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <SectionTitle
                  title="Warnings"
                  description="Anything that needs attention before the batch is trusted."
                />
                <div className="mt-4 space-y-3">
                  {Array.isArray(batch?.warnings) && batch.warnings.length > 0 ? (
                    batch.warnings.map((warning, index) => (
                      <div
                        key={`${warning}-${index}`}
                        className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-heading"
                      >
                        {warning}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl surface-panel-faint panel-border px-4 py-5 text-sm text-muted">
                      No warnings
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
