import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { formatDateTime, formatWeight } from '../../../utils/formatters'
import {
  buttonStyles,
  formatBatchStatusLabel,
  formatSessionStatusLabel,
  getName,
} from '../salesPage.utils'
import CaptureSessionAddBatchModal from './CaptureSessionAddBatchModal'

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
    case 'cancelled':
      return 'neutral'
    default:
      return 'neutral'
  }
}

const getBatchTone = (status) => {
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

const getNotice = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'submitted':
      return 'This session is awaiting admin review. Finalize it or return it to the assigned salesman for correction.'
    case 'finalized':
      return 'This session is finalized. Reopen the related batch if more capture is needed.'
    case 'cancelled':
      return 'This session is cancelled. No new supplier batches can be added.'
    case 'draft':
    case 'open':
    default:
      return 'This session groups supplier batches. Add batches here if the work needs to be split before review.'
  }
}

const formatActionError = (error) => {
  if (!error) return 'Session action failed.'
  if (error?.details && typeof error.details === 'object') {
    return Object.entries(error.details)
      .map(([field, message]) => `${field}: ${message}`)
      .join(' · ')
  }

  return error?.error || error?.message || 'Session action failed.'
}

const SessionBatchRow = ({ batch, onViewBatch }) => {
  const supplierName = getName(batch?.supplier)
  const salesmanName = getName(batch?.assignedSalesman)
  const status = String(batch?.status || '').toLowerCase()

  return (
    <tr className="hover:bg-[var(--jsm-panel-bg-faint)]">
      <td className="px-4 py-3 font-mono text-xs text-muted whitespace-nowrap">
        {batch?.batchRef || '—'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">
        {supplierName}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">
        {salesmanName}
      </td>
      <td className="px-4 py-3">
        <Badge tone={getBatchTone(status)}>{formatBatchStatusLabel(status)}</Badge>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{valueOrDash(batch?.itemCount)}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap text-primary">
        {formatWeightValue(batch?.totals?.grossWeight)}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap text-primary">
        {formatWeightValue(batch?.totals?.netWeight)}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap text-primary">
        {formatWeightValue(batch?.totals?.fineWeight)}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap text-primary">
        {valueOrDash(batch?.revision)}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          className={buttonStyles.ghost}
          onClick={() => onViewBatch?.(batch?.id || batch?._id || batch?.batchId)}
          aria-label={`View batch ${batch?.batchRef || 'details'}`}
        >
          View batch
        </button>
      </td>
    </tr>
  )
}

export default function CaptureSessionDetailModal({
  open,
  session,
  loading,
  error,
  suppliers = [],
  currentUserRole = '',
  onClose,
  onViewBatch,
  onCreateSupplierBatch,
  onSubmitSession,
  onFinalizeSession,
  onCancelSession,
}) {
  const [activeAction, setActiveAction] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [addBatchOpen, setAddBatchOpen] = useState(false)

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
      setCancelReason('')
      setActionBusy(false)
      setActionError('')
      setAddBatchOpen(false)
      return
    }

    setActiveAction(null)
    setCancelReason('')
    setActionError('')
    setActionBusy(false)
    setAddBatchOpen(false)
  }, [open, session?._id])

  const batches = Array.isArray(session?.batches) ? session.batches : []
  const status = String(session?.status || '').toLowerCase()
  const statusTone = getStatusTone(status)
  const canAddBatch = ['draft', 'open'].includes(status)
  const canSubmit = ['draft', 'open'].includes(status)
  const canFinalize = status === 'submitted' && currentUserRole === 'admin'
  const canCancel = ['draft', 'open'].includes(status) && currentUserRole === 'admin'

  const summaryCards = useMemo(() => ([
    { label: 'Supplier count', value: valueOrDash(session?.supplierCount) },
    { label: 'Item count', value: valueOrDash(session?.itemCount) },
    { label: 'Gross total', value: formatWeightValue(session?.totals?.grossWeight) },
    { label: 'Stone total', value: formatWeightValue(session?.totals?.stoneWeight) },
    { label: 'Net total', value: formatWeightValue(session?.totals?.netWeight) },
    { label: 'Fine total', value: formatWeightValue(session?.totals?.fineWeight) },
  ]), [session])

  const handleAction = async (action) => {
    if (actionBusy) return

    setActionBusy(true)
    setActionError('')
    setActiveAction(action)

    try {
      if (action === 'submit') {
        await onSubmitSession?.(session?._id)
      } else if (action === 'finalize') {
        await onFinalizeSession?.(session?._id)
      } else if (action === 'cancel') {
        const reason = String(cancelReason || '').trim()
        if (!reason) {
          setActionError('A cancel reason is required.')
          return
        }
        await onCancelSession?.(session?._id, reason)
      }
      setActiveAction(null)
      setCancelReason('')
    } catch (actionErrorResult) {
      setActionError(formatActionError(actionErrorResult))
    } finally {
      setActionBusy(false)
      if (action !== 'cancel') {
        setActiveAction(null)
      }
    }
  }

  const handleCreateSupplierBatch = async (payload) => {
    const created = await onCreateSupplierBatch?.(session?._id, payload)
    setAddBatchOpen(false)
    return created
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
              <span className="eyebrow">Capture session</span>
              <Badge tone={statusTone}>{formatSessionStatusLabel(status)}</Badge>
            </div>
            <h2 className="mt-2 text-2xl font-bold font-display text-heading">
              {session?.sessionRef || 'Session detail'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {getName(session?.assignedSalesman)}
              {session?.customerName ? ` · ${session.customerName}` : ''}
              {session?.referenceNote ? ` · ${session.referenceNote}` : ''}
            </p>
          </div>

          <button
            type="button"
            className="inline-flex min-h-11 flex-shrink-0 items-center justify-center rounded-xl surface-panel-soft panel-border px-4 text-sm font-semibold text-primary transition-all duration-200 hover:bg-gold-500/10 hover:border-gold-500/30"
            onClick={onClose}
            aria-label="Close capture session dialog"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] px-5 py-5 md:px-6">
          {loading || (!session && !error) ? (
            <div className="rounded-3xl surface-panel-soft panel-border p-6 text-sm text-muted">
              <LoadingSpinner /> Loading session details...
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-primary">
              {error}
            </div>
          ) : session ? (
            <div className="space-y-6">
              <div className="rounded-3xl surface-panel-soft panel-border p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <SectionTitle
                      title="Session notice"
                      description={getNotice(status)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {canAddBatch ? (
                      <button
                        type="button"
                        className={buttonStyles.primary}
                        onClick={() => setAddBatchOpen(true)}
                      >
                        Add supplier batch
                      </button>
                    ) : null}
                    {canSubmit ? (
                      <button
                        type="button"
                        className={buttonStyles.secondary}
                        onClick={() => handleAction('submit')}
                        disabled={actionBusy}
                      >
                        {actionBusy && activeAction === 'submit' ? (
                          <>
                            <LoadingSpinner />
                            Submitting...
                          </>
                        ) : (
                          'Submit session'
                        )}
                      </button>
                    ) : null}
                    {canFinalize ? (
                      <button
                        type="button"
                        className={buttonStyles.primary}
                        onClick={() => handleAction('finalize')}
                        disabled={actionBusy}
                      >
                        {actionBusy && activeAction === 'finalize' ? (
                          <>
                            <LoadingSpinner />
                            Finalizing...
                          </>
                        ) : (
                          'Finalize session'
                        )}
                      </button>
                    ) : null}
                    {canCancel ? (
                      <button
                        type="button"
                        className={buttonStyles.secondary}
                        onClick={() => setActiveAction('cancel')}
                        disabled={actionBusy}
                      >
                        Cancel session
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <DetailField label="Session ref" value={session?.sessionRef || '—'} mono />
                <DetailField label="Assigned salesman" value={getName(session?.assignedSalesman)} />
                <DetailField label="Customer name" value={valueOrDash(session?.customerName)} />
                <DetailField label="Customer phone" value={valueOrDash(session?.customerPhone)} />
                <DetailField label="Created at" value={formatDateTime(session?.createdAt)} />
                <DetailField label="Reference note" value={valueOrDash(session?.referenceNote)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {summaryCards.map((card) => (
                  <DetailField key={card.label} label={card.label} value={card.value} />
                ))}
              </div>

              {activeAction === 'cancel' ? (
                <div className="rounded-3xl surface-panel-soft panel-border p-5">
                  <SectionTitle
                    title="Cancel session"
                    description="Explain why the session is being cancelled."
                  />
                  <div className="mt-4 space-y-4">
                    <textarea
                      className="input min-h-28 resize-y"
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      placeholder="Cancel reason"
                      disabled={actionBusy}
                    />
                    {actionError ? (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-primary">
                        {actionError}
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        className={buttonStyles.secondary}
                        onClick={() => {
                          setActiveAction(null)
                          setCancelReason('')
                          setActionError('')
                        }}
                        disabled={actionBusy}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className={buttonStyles.primary}
                        onClick={() => handleAction('cancel')}
                        disabled={actionBusy}
                      >
                        {actionBusy ? (
                          <>
                            <LoadingSpinner />
                            Cancelling...
                          </>
                        ) : (
                          'Confirm cancel'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-3xl surface-panel-soft panel-border p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <SectionTitle
                    title="Child batches"
                    description="Each child batch belongs to one supplier and keeps its own status and totals."
                  />
                  <div className="text-sm text-muted">
                    {batches.length} batch{batches.length === 1 ? '' : 'es'}
                  </div>
                </div>

                {batches.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-6 text-sm text-muted">
                    {canAddBatch
                      ? 'Add the first supplier batch to start this capture session.'
                      : 'No supplier batches are attached to this session.'}
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
                    <table className="w-full min-w-[1200px] text-left">
                      <thead>
                        <tr className="border-b border-[var(--jsm-border)] text-[10px] uppercase tracking-[0.18em] text-muted">
                          <th className="px-4 py-3">Batch Ref</th>
                          <th className="px-4 py-3">Supplier</th>
                          <th className="px-4 py-3">Assigned Salesman</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Items</th>
                          <th className="px-4 py-3 text-right">Gross</th>
                          <th className="px-4 py-3 text-right">Net</th>
                          <th className="px-4 py-3 text-right">Fine</th>
                          <th className="px-4 py-3 text-right">Revision</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--jsm-border)]">
                        {batches.map((batch) => (
                          <SessionBatchRow
                            key={batch._id}
                            batch={batch}
                            onViewBatch={onViewBatch}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {actionError && activeAction !== 'cancel' ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-primary">
                  {actionError}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <CaptureSessionAddBatchModal
        open={addBatchOpen}
        session={session}
        suppliers={suppliers}
        loading={loading}
        error={error}
        onClose={() => setAddBatchOpen(false)}
        onCreate={handleCreateSupplierBatch}
      />
    </div>
  )

  return createPortal(modalContent, document.body)
}
