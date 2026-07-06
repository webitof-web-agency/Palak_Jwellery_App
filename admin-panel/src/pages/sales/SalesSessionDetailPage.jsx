import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { captureSessionsApi } from '../../api/captureSessions.api'
import { batchesApi } from '../../api/batches.api'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import SectionCard from '../../components/ui/SectionCard'
import { formatDateTime, formatWeight } from '../../utils/formatters'
import { buttonStyles, formatSessionStatusLabel, getName } from './salesPage.utils'

const getObject = (value) => (value && typeof value === 'object' ? value : {})

const valueOrDash = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

const formatWeightValue = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  return formatWeight(value)
}

const formatMoneyValue = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const numericValue = Number(value)
  return Number.isNaN(numericValue) ? String(value) : numericValue.toFixed(2)
}

const formatPercentValue = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const numericValue = Number(value)
  return Number.isNaN(numericValue) ? String(value) : `${numericValue.toFixed(2)}%`
}

const formatFieldLabel = (value) =>
  String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())

const DetailField = ({ label, value, hint = null, mono = false, className = '' }) => (
  <div className={`rounded-2xl surface-panel-faint panel-border px-4 py-3 ${className}`.trim()}>
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

const Overlay = ({ children, onBackdropClick, title }) => (
  <div
    className="fixed inset-0 z-[140] flex items-center justify-center bg-[color:var(--jsm-overlay)] p-4 backdrop-blur-md"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    onClick={(event) => {
      if (event.target === event.currentTarget) onBackdropClick?.()
    }}
  >
    <div className="w-full max-w-2xl rounded-[28px] border border-[var(--jsm-border)] surface-card shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
      {children}
    </div>
  </div>
)

const Toast = ({ message }) => {
  if (!message) return null
  return (
    <div className="fixed right-4 top-4 z-[150] rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 shadow-lg shadow-black/20">
      {message}
    </div>
  )
}

const ItemRow = ({ item, index }) => {
  const calculation = getObject(item?.calculationSnapshot)
  const settlementInputs = getObject(item?.settlementInputs)
  const parsedDisplay = getObject(item?.parsedSnapshot?.display || item?.parsedSnapshot)
  const parsedItem = getObject(parsedDisplay?.item)
  const parsedWeights = getObject(parsedDisplay?.weights)
  const parsedAmounts = getObject(parsedDisplay?.amounts)
  const parsedCalculation = getObject(parsedDisplay?.calculation)
  const supplier = getObject(item?.supplier)
  const warnings = [
    ...(Array.isArray(calculation?.warnings) ? calculation.warnings : []),
    ...(Array.isArray(parsedDisplay?.warnings) ? parsedDisplay.warnings : []),
  ].filter(Boolean)
  const requiresReview = calculation?.requiresReview === true || parsedDisplay?.requiresReview === true
  const duplicate = item?.isDuplicate === true
  const overridden =
    item?.wasManuallyEdited === true ||
    settlementInputs?.purityOverridden === true ||
    settlementInputs?.wastageOverridden === true

  const itemCode = parsedItem?.itemCode || parsedItem?.designCode || item?.itemCode || item?.ref || '-'
  const supplierName = supplier?.name || parsedDisplay?.supplier?.name || item?.supplierName || 'Unknown'
  const category = parsedItem?.category || parsedItem?.colorCategory || item?.category || null
  const karat = settlementInputs?.karat || parsedItem?.karat || item?.purity || '-'
  const purity = settlementInputs?.purityPercent ?? calculation?.purityPercent ?? null
  const wastage = settlementInputs?.wastagePercent ?? calculation?.wastagePercent ?? null
  const gross = calculation?.grossWeight ?? item?.grossWeight ?? parsedWeights?.grossWeight ?? null
  const stone = calculation?.stoneWeight ?? item?.stoneWeight ?? parsedWeights?.stoneWeight ?? null
  const other = calculation?.otherWeight ?? parsedWeights?.otherWeight ?? null
  const net = calculation?.netWeight ?? item?.netWeight ?? parsedCalculation?.netWeight ?? null
  const fine = calculation?.fineWeight ?? parsedCalculation?.fineWeight ?? null
  const stoneAmount = parsedAmounts?.stoneAmount ?? calculation?.stoneAmount ?? null
  const otherAmount = parsedAmounts?.otherAmount ?? calculation?.otherAmount ?? null
  const rawQr = item?.rawQr || parsedDisplay?.rawQr || null
  const supplierCategoryLabel = [supplierName, category].filter(Boolean).join(' - ') || 'Unknown'

  return (
    <tr className="hover:bg-[var(--jsm-panel-bg-faint)]">
      <td className="px-4 py-3 whitespace-nowrap text-primary">{index + 1}</td>
      <td className="px-4 py-3 text-primary">
        <div className="whitespace-nowrap font-mono text-xs text-primary">{itemCode}</div>
        {rawQr ? <div className="mt-1 max-w-[240px] truncate text-[11px] text-muted" title={rawQr}>QR: {rawQr}</div> : null}
      </td>
      <td className="px-4 py-3 text-primary">
        <div className="max-w-[220px] truncate">{supplierCategoryLabel}</div>
        <div className="mt-1 text-[11px] text-muted">{getName(item?.salesman)}</div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">{valueOrDash(karat)}</td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">{formatPercentValue(purity)}</td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">{formatPercentValue(wastage)}</td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">{formatWeightValue(gross)}</td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">{formatWeightValue(stone)}</td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">{formatWeightValue(other)}</td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">{formatWeightValue(net)}</td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">{formatWeightValue(fine)}</td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">{formatMoneyValue(stoneAmount)}</td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">{formatMoneyValue(otherAmount)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {duplicate ? <Badge tone="amber">Duplicate</Badge> : null}
          {requiresReview ? <Badge tone="rose">Review</Badge> : null}
          {overridden ? <Badge tone="gold">Custom</Badge> : null}
          {warnings.length ? <Badge tone="neutral">{warnings.length} warning{warnings.length === 1 ? '' : 's'}</Badge> : null}
          {!warnings.length && !duplicate && !requiresReview && !overridden ? <span className="text-[11px] text-muted">None</span> : null}
        </div>
      </td>
    </tr>
  )
}
const CancelSummaryModal = ({ session, onContinue, onClose }) => {
  const items = Number(session?.itemCount || session?.totals?.itemCount || 0) || 0
  const gross = session?.totals?.grossWeight ?? 0
  const net = session?.totals?.netWeight ?? 0
  const fine = session?.totals?.fineWeight ?? 0

  return (
    <Overlay title="Cancel session summary" onBackdropClick={onClose}>
      <div className="border-b border-[var(--jsm-border)] px-5 py-4">
        <div className="text-sm font-bold uppercase tracking-[0.18em] text-gold-500/90">Cancel Session</div>
        <h2 className="mt-2 text-2xl font-bold font-display text-heading">Review before cancellation</h2>
        <p className="mt-1 text-sm text-muted">Confirm this session before moving to the reason step.</p>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className="grid gap-3 md:grid-cols-2">
          <DetailField label="Customer" value={session?.customerName || '-'} />
          <DetailField label="Date" value={formatDateTime(session?.createdAt || session?.updatedAt)} />
          <DetailField label="Item count" value={valueOrDash(items)} />
          <DetailField label="Gross / Net / Fine" value={`${formatWeightValue(gross)} / ${formatWeightValue(net)} / ${formatWeightValue(fine)}`} />
        </div>
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Cancelling this session will hide it from the default sales list.
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--jsm-border)] px-5 py-4 sm:flex-row sm:justify-end">
        <button type="button" className={buttonStyles.secondary} onClick={onClose}>
          Close
        </button>
        <button type="button" className={buttonStyles.primary} onClick={onContinue}>
          Continue
        </button>
      </div>
    </Overlay>
  )
}

const CancelReasonModal = ({
  session,
  reason,
  confirmText,
  submitting,
  onClose,
  onReasonChange,
  onConfirmTextChange,
  onConfirm,
}) => {
  const ready = reason.trim().length > 0 && confirmText.trim() === 'CANCEL'

  return (
    <Overlay title="Confirm cancellation" onBackdropClick={onClose}>
      <div className="border-b border-[var(--jsm-border)] px-5 py-4">
        <div className="text-sm font-bold uppercase tracking-[0.18em] text-gold-500/90">Confirm Cancellation</div>
        <h2 className="mt-2 text-2xl font-bold font-display text-heading">Type CANCEL to proceed</h2>
        <p className="mt-1 text-sm text-muted">This action is restricted to admins and will keep the session record intact.</p>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className="grid gap-3 md:grid-cols-2">
          <DetailField label="Customer" value={session?.customerName || '-'} />
          <DetailField label="Session ref" value={session?.sessionRef || session?.reference || '-'} mono />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted" htmlFor="cancel-reason">
            Cancellation reason
          </label>
          <textarea
            id="cancel-reason"
            className="min-h-28 w-full rounded-2xl border border-[var(--jsm-border)] surface-panel-soft px-4 py-3 text-sm text-primary outline-none transition-colors focus:border-gold-500/40"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Explain why this session is being cancelled"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-[0.18em] text-muted" htmlFor="cancel-confirm-text">
            Type confirmation
          </label>
          <input
            id="cancel-confirm-text"
            className="w-full rounded-2xl border border-[var(--jsm-border)] surface-panel-soft px-4 py-3 text-sm text-primary outline-none transition-colors focus:border-gold-500/40"
            value={confirmText}
            onChange={(event) => onConfirmTextChange(event.target.value)}
            placeholder="CANCEL"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--jsm-border)] px-5 py-4 sm:flex-row sm:justify-end">
        <button type="button" className={buttonStyles.secondary} onClick={onClose} disabled={submitting}>
          Back
        </button>
        <button type="button" className={buttonStyles.primary} onClick={onConfirm} disabled={!ready || submitting}>
          {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
        </button>
      </div>
    </Overlay>
  )
}

export default function SalesSessionDetailPage() {
  const navigate = useNavigate()
  const { sessionId } = useParams()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [batchDetails, setBatchDetails] = useState([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchError, setBatchError] = useState('')
  const [notice, setNotice] = useState('')
  const [cancelStep, setCancelStep] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelConfirmText, setCancelConfirmText] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  const currentStatus = String(session?.status || '').toLowerCase()
  const isCancelled = currentStatus === 'cancelled'
  const warningsCount = Number(session?.warningsCount || 0) || 0
  const statusTone = isCancelled ? 'rose' : currentStatus === 'finalized' ? 'gold' : currentStatus === 'submitted' ? 'amber' : 'neutral'

  useEffect(() => {
    let active = true

    const loadSession = async () => {
      if (!sessionId) {
        setSession(null)
        setError('Session id is missing.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await captureSessionsApi.getSessionDetail(sessionId)
        if (!active) return
        setSession(response?.data || null)
      } catch (fetchError) {
        if (!active) return
        setSession(null)
        setError(fetchError?.error || fetchError?.message || 'Failed to load session detail.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadSession()

    return () => {
      active = false
    }
  }, [sessionId])
  useEffect(() => {
    if (!session) {
      setBatchDetails([])
      setBatchError('')
      setBatchLoading(false)
      return undefined
    }

    const batches = Array.isArray(session?.batches) ? session.batches : []
    let active = true

    const loadBatchDetails = async () => {
      if (!batches.length) {
        setBatchDetails([])
        setBatchLoading(false)
        setBatchError('')
        return
      }

      setBatchLoading(true)
      setBatchError('')

      const results = await Promise.all(
        batches.map(async (batch) => {
          const batchId = batch?.id || batch?._id || batch?.batchId
          if (!batchId) {
            return { batch, detail: null, error: 'Missing batch id.' }
          }

          try {
            const response = await batchesApi.getBatchDetail(batchId)
            return { batch, detail: response?.data || null, error: '' }
          } catch (fetchError) {
            return {
              batch,
              detail: null,
              error: fetchError?.error || fetchError?.message || 'Failed to load batch detail.',
            }
          }
        }),
      )

      if (!active) return

      setBatchDetails(results)
      const hasError = results.some((entry) => entry.error)
      setBatchError(hasError ? 'Some batch item details could not be loaded.' : '')
      setBatchLoading(false)
    }

    void loadBatchDetails()

    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const summaryCards = useMemo(
    () => [
      { label: 'Total items', value: valueOrDash(session?.itemCount) },
      { label: 'Gross', value: formatWeightValue(session?.totals?.grossWeight) },
      { label: 'Stone', value: formatWeightValue(session?.totals?.stoneWeight) },
      { label: 'Other', value: formatWeightValue(session?.totals?.otherWeight) },
      { label: 'Net', value: formatWeightValue(session?.totals?.netWeight) },
      { label: 'Fine', value: formatWeightValue(session?.totals?.fineWeight) },
      { label: 'Stone Amount', value: formatMoneyValue(session?.totals?.stoneAmount ?? session?.stoneAmount) },
      { label: 'Other Amount', value: formatMoneyValue(session?.totals?.otherAmount ?? session?.otherAmount) },
    ],
    [session],
  )

  const itemRows = useMemo(() => {
    const batchRows = batchDetails.flatMap((entry) => {
      const batch = getObject(entry?.batch)
      const detail = getObject(entry?.detail)
      const items = Array.isArray(detail?.items) ? detail.items : []

      return items.map((item, index) => ({
        ...item,
        __batchId: batch?.id || batch?._id || batch?.batchId || null,
        __batchRef: batch?.batchRef || null,
        __batchSupplier: batch?.supplier,
        __batchRevision: batch?.revision ?? null,
        __rowKey: `${batch?.id || batch?._id || batch?.batchRef || 'batch'}-${item?._id || item?.ref || index}`,
      }))
    })

    if (batchRows.length > 0) {
      return batchRows
    }

    const directItems = Array.isArray(session?.items) ? session.items : []
    return directItems.map((item, index) => ({
      ...item,
      __batchId: null,
      __batchRef: session?.sessionRef || null,
      __batchSupplier: item?.supplier || null,
      __batchRevision: null,
      __rowKey: `session-item-${item?._id || item?.id || item?.ref || index}`,
    }))
  }, [batchDetails, session])

  const goBack = () => navigate('/sales')

  const openCancelFlow = () => {
    setCancelStep(1)
    setCancelReason('')
    setCancelConfirmText('')
  }

  const closeCancelFlow = () => {
    if (cancelSubmitting) return
    setCancelStep(null)
    setCancelReason('')
    setCancelConfirmText('')
  }

  const continueCancelFlow = () => setCancelStep(2)

  const confirmCancellation = async () => {
    if (!sessionId || cancelSubmitting) return

    const typedConfirm = String(cancelConfirmText || '').trim()
    const typedReason = String(cancelReason || '').trim()
    if (!typedReason || typedConfirm !== 'CANCEL') return

    setCancelSubmitting(true)
    try {
      await captureSessionsApi.cancelSession(sessionId, {
        reason: typedReason,
        confirm: true,
      })
      navigate('/sales', {
        replace: true,
        state: { toastMessage: 'Session cancelled successfully.' },
      })
    } catch (cancelError) {
      setNotice(cancelError?.error || cancelError?.message || 'Failed to cancel session.')
    } finally {
      setCancelSubmitting(false)
      setCancelStep(null)
      setCancelReason('')
      setCancelConfirmText('')
    }
  }

  return (
    <div className="page-shell space-y-6 animate-fade-in">
      <Toast message={notice} />

      <div className="flex flex-col gap-4 rounded-[28px] border border-[var(--jsm-border)] surface-card p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={goBack} className={buttonStyles.secondary}>
                Back to Sales
              </button>
              <Badge tone={statusTone}>{formatSessionStatusLabel(currentStatus)}</Badge>
              {isCancelled ? <Badge tone="rose">Cancelled</Badge> : null}
              {warningsCount ? <Badge tone="amber">{warningsCount} warning{warningsCount === 1 ? '' : 's'}</Badge> : null}
            </div>
            <h1 className="text-3xl font-bold font-display text-heading break-words">
              {session?.sessionRef || session?.reference || sessionId || 'Sales session'}
            </h1>
            <p className="text-sm text-muted break-words">
              {session?.customerName || 'Unknown customer'}
              {session?.customerPhone ? ` | ${session.customerPhone}` : ''}
              {session?.referenceNote ? ` | ${session.referenceNote}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isCancelled ? (
              <button type="button" className={buttonStyles.primary} onClick={openCancelFlow}>
                Cancel Session
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl surface-panel-soft panel-border p-6 text-sm text-muted">
            <LoadingSpinner /> Loading session detail...
          </div>
        ) : error ? (
          <EmptyState title="Could not load session" description={error} />
        ) : session ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Customer', value: session?.customerName || '-' },
                { label: 'Phone', value: session?.customerPhone || '-' },
                { label: 'Salesman', value: getName(session?.assignedSalesman) },
                { label: 'Date / Time', value: formatDateTime(session?.createdAt || session?.updatedAt) },
              ].map((field) => (
                <DetailField key={field.label} label={field.label} value={field.value} />
              ))}
            </div>

            <SectionCard>
              <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
                {summaryCards.map((card) => (
                  <div key={card.label} className="rounded-[22px] border border-[var(--jsm-border)] surface-panel-soft p-5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-heading">{card.label}</div>
                    <div className="mt-2 text-2xl font-bold text-primary break-words">{card.value}</div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard>
                <div className="space-y-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-heading">Customer Details</div>
                  <div className="text-lg font-bold text-primary">{session?.customerName || '-'}</div>
                  <div className="text-sm text-muted">Phone: {session?.customerPhone || '-'}</div>
                  <div className="text-sm text-muted">Reference: {session?.referenceNote || '-'}</div>
                  <div className="text-sm text-muted">Status: {formatSessionStatusLabel(currentStatus)}</div>
                </div>
              </SectionCard>


            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard>
                <div className="space-y-4">
                  <SectionTitle
                    title="Supplier Breakdown"
                    description="Group the child batches by supplier to review the session at a glance."
                  />

                  {(() => {
                    const buckets = new Map()
                    itemRows.forEach((item) => {
                      const supplierLabel =
                        item?.__batchSupplier?.name ||
                        item?.__batchSupplier?.supplierName ||
                        item?.__batchSupplier?.code ||
                        item?.supplier?.name ||
                        item?.supplierName ||
                        'Unknown'
                      const current = buckets.get(supplierLabel) || {
                        label: supplierLabel,
                        count: 0,
                        gross: 0,
                        net: 0,
                        fine: 0,
                      }
                      current.count += 1
                      current.gross += Number(item?.grossWeight ?? item?.calculationSnapshot?.grossWeight ?? 0) || 0
                      current.net += Number(item?.netWeight ?? item?.calculationSnapshot?.netWeight ?? 0) || 0
                      current.fine += Number(item?.fineWeight ?? item?.calculationSnapshot?.fineWeight ?? 0) || 0
                      buckets.set(supplierLabel, current)
                    })

                    const breakdowns = Array.from(buckets.values())

                    if (!breakdowns.length) {
                      return (
                        <div className="rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-6 text-sm text-muted">
                          Supplier breakdown will appear after batch details finish loading.
                        </div>
                      )
                    }

                    return (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {breakdowns.map((bucket) => (
                          <div key={bucket.label} className="rounded-2xl border border-[var(--jsm-border)] surface-panel-soft p-4">
                            <div className="text-sm font-semibold text-primary break-words">{bucket.label}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge tone="gold">{bucket.count} item{bucket.count === 1 ? '' : 's'}</Badge>
                              <Badge tone="neutral">Gross {formatWeightValue(bucket.gross)}</Badge>
                              <Badge tone="neutral">Net {formatWeightValue(bucket.net)}</Badge>
                              <Badge tone="neutral">Fine {formatWeightValue(bucket.fine)}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </SectionCard>

              <SectionCard>
                <div className="space-y-4">
                  <SectionTitle
                    title="Warning Summary"
                    description="Review counts that matter before any further action."
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { label: 'Warnings', value: warningsCount },
                      { label: 'Duplicates', value: Number(session?.duplicateCount) || 0 },
                      { label: 'Reviews', value: Number(session?.reviewCount) || 0 },
                      { label: 'Custom overrides', value: Number(session?.manualOverrideCount) || 0 },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-[var(--jsm-border)] surface-panel-soft p-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-heading">{item.label}</div>
                        <div className="mt-2 text-2xl font-bold text-primary">{valueOrDash(item.value)}</div>
                      </div>
                    ))}
                  </div>

                  {warningsCount ? (
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                      Some items require review.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-6 text-sm text-muted">
                      No warnings were recorded for this session.
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>

            <SectionCard>
              <div className="space-y-4 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionTitle
                    title="Item List"
                    description="Flattened item rows from the session child batches."
                  />
                  {batchLoading ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--jsm-border)] surface-panel-soft px-3 py-2 text-xs font-semibold text-muted">
                      <LoadingSpinner /> Loading batch detail...
                    </div>
                  ) : null}
                </div>

                {batchError ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                    {batchError}
                  </div>
                ) : null}

                {!batchLoading && itemRows.length === 0 ? (
                  <EmptyState
                    title="No item rows found"
                    description="This session has no batch item rows available for review yet."
                  />
                ) : (
                  <div className="overflow-x-auto rounded-[22px] border border-[var(--jsm-border)]">
                    <table className="min-w-[1400px] w-full text-left">
                      <thead>
                        <tr className="border-b border-[var(--jsm-border)] text-[10px] uppercase tracking-[0.18em] text-muted">
                          <th className="px-4 py-4">Sr No</th>
                          <th className="px-4 py-4">Item Code</th>
                          <th className="px-4 py-4">Supplier / Category</th>
                          <th className="px-4 py-4">Karat</th>
                          <th className="px-4 py-4">Purity %</th>
                          <th className="px-4 py-4">Wastage %</th>
                          <th className="px-4 py-4 text-right">Gross</th>
                          <th className="px-4 py-4 text-right">Stone</th>
                          <th className="px-4 py-4 text-right">Other</th>
                          <th className="px-4 py-4 text-right">Net</th>
                          <th className="px-4 py-4 text-right">Fine</th>
                          <th className="px-4 py-4 text-right">Stone Amount</th>
                          <th className="px-4 py-4 text-right">Other Amount</th>
                          <th className="px-4 py-4">Warnings</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--jsm-border)]">
                        {itemRows.map((item, index) => (
                          <ItemRow key={item.__rowKey || `${item.__batchId || 'batch'}-${index}`} item={item} index={index} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        ) : null}
      </div>

      {cancelStep === 1 ? (
        <CancelSummaryModal session={session} onContinue={continueCancelFlow} onClose={closeCancelFlow} />
      ) : null}

      {cancelStep === 2 ? (
        <CancelReasonModal
          session={session}
          reason={cancelReason}
          confirmText={cancelConfirmText}
          submitting={cancelSubmitting}
          onClose={closeCancelFlow}
          onReasonChange={setCancelReason}
          onConfirmTextChange={setCancelConfirmText}
          onConfirm={confirmCancellation}
        />
      ) : null}
    </div>
  )
}



