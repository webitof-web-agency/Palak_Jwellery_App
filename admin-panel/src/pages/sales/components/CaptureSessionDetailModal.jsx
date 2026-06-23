import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import EmptyState from '../../../components/ui/EmptyState'
import { batchesApi } from '../../../api/batches.api'
import { formatDateTime, formatWeight } from '../../../utils/formatters'
import { formatSessionStatusLabel, getName } from '../salesPage.utils'

const getObject = (value) => (value && typeof value === 'object' ? value : {})

const getParsedSnapshot = (parsedSnapshot) => {
  if (!parsedSnapshot || typeof parsedSnapshot !== 'object') {
    return null
  }

  return parsedSnapshot
}

const getParsedDisplay = (parsedSnapshot) => {
  const snapshot = getParsedSnapshot(parsedSnapshot)
  if (!snapshot) {
    return null
  }

  if (snapshot.display && typeof snapshot.display === 'object') {
    return snapshot.display
  }

  return snapshot
}

const valueOrDash = (value) => {
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

const formatMoneyValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) {
    return String(value)
  }

  return numericValue.toFixed(2)
}

const formatPercentValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) {
    return String(value)
  }

  return `${numericValue.toFixed(2)}%`
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

const ItemRow = ({ item, index }) => {
  const calculation = getObject(item?.calculationSnapshot)
  const settlementInputs = getObject(item?.settlementInputs)
  const parsedDisplay = getParsedDisplay(item?.parsedSnapshot)
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
  const overridden = item?.wasManuallyEdited === true || settlementInputs?.purityOverridden === true || settlementInputs?.wastageOverridden === true

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

  const supplierCategoryLabel = [supplierName, category].filter(Boolean).join(' - ') || 'Unknown'

  return (
    <tr className="hover:bg-[var(--jsm-panel-bg-faint)]">
      <td className="px-4 py-3 whitespace-nowrap text-primary">{index + 1}</td>
      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-primary">{itemCode}</td>
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

export default function CaptureSessionDetailModal({
  open,
  session,
  loading,
  error,
  onClose,
}) {
  const [batchDetails, setBatchDetails] = useState([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchError, setBatchError] = useState('')

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
  }, [open, session])

  if (!open || typeof document === 'undefined') {
    return null
  }

  const status = String(session?.status || '').toLowerCase()
  const statusTone = status === 'finalized' ? 'gold' : status === 'submitted' ? 'amber' : 'neutral'
  const sessionBatches = Array.isArray(session?.batches) ? session.batches : []
  const lockedSettings = getObject(session?.lockedSettings || session?.settings || session?.captureSettings || session?.configuration)
  const lockedSettingEntries = Object.entries(lockedSettings).filter(([, value]) => value !== null && value !== undefined && value !== '')
  const summaryCards = [
    { label: 'Total items', value: valueOrDash(session?.itemCount) },
    { label: 'Gross', value: formatWeightValue(session?.totals?.grossWeight) },
    { label: 'Net', value: formatWeightValue(session?.totals?.netWeight) },
    { label: 'Fine', value: formatWeightValue(session?.totals?.fineWeight) },
    { label: 'Warnings', value: valueOrDash(session?.warningsCount) },
    { label: 'Reviews', value: valueOrDash(session?.reviewCount) },
  ]

  const itemRows = batchDetails.flatMap((entry) => {
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
            <p className="mt-1 break-words text-sm text-muted">
              {getName(session?.assignedSalesman)}
              {session?.customerName ? ` | ${session.customerName}` : ''}
              {session?.referenceNote ? ` | ${session.referenceNote}` : ''}
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
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <DetailField label="Customer" value={valueOrDash(session?.customerName)} />
                  <DetailField label="Phone" value={valueOrDash(session?.customerPhone)} />
                  <DetailField label="Date/time" value={valueOrDash(formatDateTime(session?.createdAt || session?.updatedAt))} />
                  <DetailField label="Status" value={formatSessionStatusLabel(status)} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {summaryCards.map((card) => (
                  <DetailField key={card.label} label={card.label} value={card.value} />
                ))}
              </div>

              <div className="rounded-3xl surface-panel-soft panel-border p-5">
                <SectionTitle
                  title="Supplier breakdown"
                  description="Each supplier batch inside this session is kept separate for review."
                />
                {sessionBatches.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-6 text-sm text-muted">
                    No supplier breakdown is available for this session yet.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                    {sessionBatches.map((batch) => (
                      <div key={batch?._id || batch?.id || batch?.batchRef} className="rounded-2xl surface-panel-faint panel-border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-heading">
                              {getName(batch?.supplier)}
                            </div>
                            <div className="mt-1 text-[11px] text-muted">
                              {batch?.batchRef || '-'}
                              {batch?.revision ? ` | Rev ${batch.revision}` : ''}
                            </div>
                          </div>
                          <Badge tone={batch?.status === 'finalized' ? 'gold' : batch?.status === 'submitted' ? 'amber' : 'neutral'}>
                            {formatSessionStatusLabel(batch?.status)}
                          </Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <DetailField label="Items" value={valueOrDash(batch?.itemCount)} className="p-3" />
                          <DetailField label="Gross" value={formatWeightValue(batch?.totals?.grossWeight)} className="p-3" />
                          <DetailField label="Net" value={formatWeightValue(batch?.totals?.netWeight)} className="p-3" />
                          <DetailField label="Fine" value={formatWeightValue(batch?.totals?.fineWeight)} className="p-3" />
                        </div>
                        <div className="mt-3 text-[11px] text-muted">
                          Warnings: {valueOrDash(batch?.warningsCount)} | Review: {valueOrDash(batch?.reviewCount)} | Duplicate: {valueOrDash(batch?.duplicateCount)} | Override: {valueOrDash(batch?.manualOverrideCount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl surface-panel-soft panel-border p-5">
                <SectionTitle
                  title="Locked settings"
                  description="Shown when the session snapshot includes the applied scan settings."
                />
                {lockedSettingEntries.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-6 text-sm text-muted">
                    Locked settings are not exposed in this session summary yet.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {lockedSettingEntries.map(([key, value]) => (
                      <DetailField
                        key={key}
                        label={formatFieldLabel(key)}
                        value={valueOrDash(typeof value === 'object' ? JSON.stringify(value) : value)}
                        mono={typeof value === 'string' && value.length > 32}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl surface-panel-soft panel-border p-5">
                <SectionTitle
                  title="Warning summary"
                  description="Quick view of items that need attention before approval."
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <DetailField label="Warnings" value={valueOrDash(session?.warningsCount)} />
                  <DetailField label="Reviews" value={valueOrDash(session?.reviewCount)} />
                  <DetailField label="Duplicates" value={valueOrDash(session?.duplicateCount)} />
                  <DetailField label="Overrides" value={valueOrDash(session?.manualOverrideCount)} />
                </div>
                {(session?.warningsCount || session?.reviewCount || session?.duplicateCount || session?.manualOverrideCount) ? (
                  <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                    Some items require review.
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl surface-panel-soft panel-border p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <SectionTitle
                    title="Full item list"
                    description="Read-only item rows flattened from the supplier batches in this session."
                  />
                  <div className="text-sm text-muted">
                    {itemRows.length} item{itemRows.length === 1 ? '' : 's'}
                  </div>
                </div>

                {batchLoading ? (
                  <div className="mt-4 flex items-center gap-3 text-sm text-muted">
                    <LoadingSpinner /> Loading batch item rows...
                  </div>
                ) : (
                  <>
                    {batchError ? (
                      <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                        {batchError}
                      </div>
                    ) : null}
                    {itemRows.length === 0 ? (
                      <div className="mt-4">
                        <EmptyState
                          title="No item rows available"
                          description="Open a finalized batch to see the flattened item rows here."
                        />
                      </div>
                    ) : (
                      <div className="mt-4 overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
                        <table className="w-full min-w-[1700px] text-left">
                          <thead>
                            <tr className="border-b border-[var(--jsm-border)] text-[10px] uppercase tracking-[0.18em] text-muted">
                              <th className="px-4 py-3">Sr</th>
                              <th className="px-4 py-3">Item Code</th>
                              <th className="px-4 py-3">Supplier / Category</th>
                              <th className="px-4 py-3">Karat</th>
                              <th className="px-4 py-3 text-right">Purity</th>
                              <th className="px-4 py-3 text-right">Wastage</th>
                              <th className="px-4 py-3 text-right">Gross</th>
                              <th className="px-4 py-3 text-right">Stone</th>
                              <th className="px-4 py-3 text-right">Other</th>
                              <th className="px-4 py-3 text-right">Net</th>
                              <th className="px-4 py-3 text-right">Fine</th>
                              <th className="px-4 py-3 text-right">Stone Amt</th>
                              <th className="px-4 py-3 text-right">Other Amt</th>
                              <th className="px-4 py-3">Warnings</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--jsm-border)]">
                            {itemRows.map((item, index) => (
                              <ItemRow key={item.__rowKey} item={item} index={index} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}


