import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import {
  formatCurrency,
  formatDateTime,
  formatPercentage,
  formatWeight,
} from '../../../utils/formatters'

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

const formatPercentValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return formatPercentage(value)
}

const formatMoneyValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return formatCurrency(value)
}

const formatSourceLabel = (value) => {
  const sourceMap = {
    supplier_override: 'Supplier rule',
    supplier_category: 'Supplier category rule',
    supplier_default: 'Supplier default',
    global_default: 'Global default',
    parsed_qr: 'QR value',
    manual_override: 'Manually changed',
    request: 'Entered on sale',
    unknown: 'Unknown',
  }

  return sourceMap[value] || valueOrDash(value)
}

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
    <div className="text-sm font-bold uppercase tracking-[0.18em] text-gold-500/90">
      {title}
    </div>
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

const ToggleDetails = ({ open, onToggle, label }) => (
  <button
    type="button"
    onClick={onToggle}
    className="rounded-2xl surface-panel-soft panel-border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-heading transition-all hover:bg-gold-500/10 hover:border-gold-500/30"
    aria-expanded={open}
  >
    {open ? `Hide ${label}` : `Show ${label}`}
  </button>
)

const SnapshotNotice = ({ children }) => (
  <div className="rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-4 text-sm text-muted">
    {children}
  </div>
)

export default function SaleDetailModal({ open, sale, loading, error, onClose }) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

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

  if (!open || typeof document === 'undefined') {
    return null
  }

  const supplier = getObject(sale?.supplier)
  const salesman = getObject(sale?.salesman)
  const calculation = getObject(sale?.calculationSnapshot)
  const settlementInputs = getObject(sale?.settlementInputs)
  const parsedSnapshotRaw = getParsedSnapshot(sale?.parsedSnapshot)
  const parsedDisplay = getParsedDisplay(sale?.parsedSnapshot)
  const parsedItem = getObject(parsedDisplay?.item)
  const parsedWeights = getObject(parsedDisplay?.weights)
  const parsedAmounts = getObject(parsedDisplay?.amounts)
  const parsedCalculation = getObject(parsedDisplay?.calculation)
  const parsedWarnings = Array.isArray(parsedDisplay?.warnings) ? parsedDisplay.warnings : []
  const calculationWarnings = Array.isArray(calculation?.warnings) ? calculation.warnings : []
  const warnings = [...new Set([...calculationWarnings, ...parsedWarnings].filter(Boolean))]
  const stoneComponents = Array.isArray(parsedWeights.stoneComponents) ? parsedWeights.stoneComponents : []
  const duplicate = sale?.isDuplicate === true
  const requiresReview = calculation?.requiresReview === true || parsedDisplay?.requiresReview === true
  const rawQr = sale?.qrRaw || parsedDisplay?.rawQr || parsedSnapshotRaw?.rawQr || null
  const supplierName = supplier?.name || parsedDisplay?.supplier?.name || '—'
  const supplierCode = supplier?.code || parsedDisplay?.supplier?.code || '—'
  const salesmanName = salesman?.name || '—'
  const reportDate = formatDateTime(sale?.saleDate)

  const itemCode = parsedItem?.itemCode || parsedItem?.designCode || sale?.itemCode || '—'
  const designCode = parsedItem?.designCode || parsedItem?.itemCode || sale?.itemCode || '—'
  const category = parsedItem?.category || parsedItem?.colorCategory || sale?.category || '—'
  const metalType = parsedItem?.metalType || sale?.metalType || '—'
  const karat = settlementInputs?.karat || parsedItem?.karat || sale?.purity || '—'
  const purityPercent = settlementInputs?.purityPercent ?? calculation?.purityPercent ?? null
  const wastagePercent = settlementInputs?.wastagePercent ?? calculation?.wastagePercent ?? null
  const originalPurityPercent = settlementInputs?.originalPurityPercent ?? null
  const originalWastagePercent = settlementInputs?.originalWastagePercent ?? null
  const purityOverridden = settlementInputs?.purityOverridden === true
  const wastageOverridden = settlementInputs?.wastageOverridden === true
  const hasAuditSnapshot = Boolean(settlementInputs || calculation?.netFormula || parsedSnapshotRaw)

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
              <span className="eyebrow">Sale detail</span>
              {duplicate ? <Badge tone="amber">Duplicate</Badge> : null}
              {requiresReview ? <Badge tone="rose">Needs review</Badge> : null}
            </div>
            <h2 className="mt-2 text-2xl font-bold font-display text-heading">
              {sale?.ref || 'Sale detail'}
            </h2>
            <p className="mt-1 break-words text-sm text-muted">
              {supplierName} ({supplierCode}) | {salesmanName} | {reportDate}
            </p>
          </div>

          <button
            type="button"
            className="inline-flex min-h-11 flex-shrink-0 items-center justify-center rounded-xl surface-panel-soft panel-border px-4 text-sm font-semibold text-primary transition-all duration-200 hover:bg-gold-500/10 hover:border-gold-500/30"
            onClick={onClose}
            aria-label="Close sale detail"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] px-5 py-5 md:px-6">
          {loading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="flex items-center gap-3 text-muted">
                <LoadingSpinner />
                Loading sale detail...
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-primary">
              <div className="font-semibold">Unable to load sale detail</div>
              <div className="mt-1 text-sm text-muted">{error}</div>
            </div>
          ) : sale ? (
            <div className="space-y-4">
              {!hasAuditSnapshot ? (
                <SnapshotNotice>
                  Audit snapshot not available for this older sale.
                </SnapshotNotice>
              ) : null}

              <section className="rounded-3xl surface-panel-soft panel-border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <SectionTitle
                  title="Header"
                  description="Sale reference and who recorded it."
                />
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <DetailField label="Sale Ref" value={valueOrDash(sale?.ref)} />
                  <DetailField label="Sale Date" value={valueOrDash(reportDate)} />
                  <DetailField label="Supplier" value={valueOrDash(`${supplierName} (${supplierCode})`)} />
                  <DetailField label="Salesman" value={valueOrDash(salesmanName)} />
                </div>
              </section>

              <section className="rounded-3xl surface-panel-soft panel-border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <SectionTitle
                  title="Key summary"
                  description="Quick business scan of the record."
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <DetailField label="Supplier" value={valueOrDash(supplierName)} />
                  <DetailField label="Item Code" value={valueOrDash(itemCode)} />
                  <DetailField label="Karat" value={valueOrDash(karat)} />
                  <DetailField
                    label="Status"
                    value={requiresReview ? 'Needs review' : (purityOverridden || wastageOverridden ? 'Manual override' : 'Trusted')}
                  />
                </div>
              </section>

              <div className="grid gap-4 xl:grid-cols-2">
                <section className="rounded-3xl surface-panel-soft panel-border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                  <SectionTitle
                    title="Item details"
                    description="What was scanned and how the item was identified."
                  />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <DetailField label="Design Code" value={valueOrDash(designCode)} />
                    <DetailField label="Category / Color" value={valueOrDash(category)} />
                    <DetailField label="Metal Type" value={valueOrDash(metalType)} />
                    <DetailField
                      label="Raw QR"
                      value={rawQr ? 'Present' : 'Not available'}
                    />
                  </div>
                </section>

                <section className="rounded-3xl surface-panel-soft panel-border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                  <SectionTitle
                    title="Settlement Inputs"
                    description="The settlement values and their source."
                  />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <DetailField label="Karat" value={valueOrDash(karat)} />
                    <DetailField
                      label="Purity %"
                      value={
                        purityPercent === null || purityPercent === undefined
                          ? '—'
                          : formatPercentValue(purityPercent)
                      }
                      hint={`Source: ${formatSourceLabel(settlementInputs?.puritySource)}`}
                    />
                    <DetailField
                      label="Original Purity %"
                      value={
                        originalPurityPercent === null || originalPurityPercent === undefined
                          ? '—'
                          : formatPercentValue(originalPurityPercent)
                      }
                      hint={purityOverridden ? 'Shown because the value was changed after the supplier default.' : 'Supplier value'}
                    />
                    <DetailField
                      label="Purity Overridden"
                      value={purityOverridden ? 'Yes' : 'No'}
                    />
                    <DetailField
                      label="Wastage %"
                      value={
                        wastagePercent === null || wastagePercent === undefined
                          ? '—'
                          : formatPercentValue(wastagePercent)
                      }
                      hint={`Source: ${formatSourceLabel(settlementInputs?.wastageSource)}`}
                    />
                    <DetailField
                      label="Original Wastage %"
                      value={
                        originalWastagePercent === null || originalWastagePercent === undefined
                          ? '—'
                          : formatPercentValue(originalWastagePercent)
                      }
                      hint={wastageOverridden ? 'Shown because the value was changed after the supplier default.' : 'Supplier value'}
                    />
                    <DetailField
                      label="Wastage Overridden"
                      value={wastageOverridden ? 'Yes' : 'No'}
                    />
                    <DetailField
                      label="Resolution Time"
                      value={valueOrDash(formatDateTime(settlementInputs?.resolvedAt))}
                    />
                  </div>

                  {(purityOverridden || wastageOverridden) ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {purityOverridden ? <Badge tone="gold">Manual override</Badge> : null}
                      {wastageOverridden ? <Badge tone="amber">Manual override</Badge> : null}
                    </div>
                  ) : null}
                </section>
              </div>

              <section className="rounded-3xl surface-panel-soft panel-border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <SectionTitle
                  title="Weight check"
                  description="Weights used to verify the sale."
                />
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <DetailField label="Gross Weight" value={formatWeightValue(calculation?.grossWeight)} />
                  <DetailField label="Stone Total" value={formatWeightValue(calculation?.stoneWeight)} />
                  <DetailField label="QR Net Weight" value={formatWeightValue(calculation?.qrNetWeight)} />
                  <DetailField
                    label="Selected Net Weight"
                    value={formatWeightValue(calculation?.selectedNetWeight)}
                  />
                </div>

                <div className="mt-4 rounded-2xl surface-panel-faint panel-border p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                    Stone components
                  </div>
                  <div className="mt-3 space-y-2">
                    {stoneComponents.length > 0 ? (
                      stoneComponents.map((component, index) => (
                        <div
                          key={`${component?.sourceField || index}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-xl surface-panel-soft panel-border px-4 py-3"
                        >
                          <div>
                            <div className="text-sm font-semibold text-heading">
                              {valueOrDash(component?.label || `Stone Component ${index + 1}`)}
                            </div>
                            <div className="text-xs text-muted">
                              {valueOrDash(component?.sourceField)}
                            </div>
                          </div>
                          <div className="font-mono text-sm font-semibold text-heading">
                            {formatWeightValue(component?.value)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed panel-border surface-panel-faint px-4 py-3 text-sm text-muted">
                        Not available
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-3xl surface-panel-soft panel-border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <SectionTitle
                  title="Calculation"
                  description="Backend values stored at the time of sale."
                />
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <DetailField label="Purity Percent" value={formatPercentValue(calculation?.purityPercent)} />
                  <DetailField label="Wastage Percent" value={formatPercentValue(calculation?.wastagePercent)} />
                  <DetailField label="Settlement Percent" value={formatPercentValue(calculation?.settlementPercent)} />
                  <DetailField label="Fine Weight" value={formatWeightValue(calculation?.fineWeight)} />
                  <DetailField label="Tolerance" value={formatWeightValue(calculation?.tolerance)} />
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl surface-panel-faint panel-border p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                      Net weight check
                    </div>
                    <div className="mt-2 text-sm text-heading">
                      {calculation?.requiresReview ? 'Needs review' : 'Within tolerance'}
                    </div>
                    <div className="mt-1 text-sm text-muted">
                      {valueOrDash(calculation?.explanation)}
                    </div>
                  </div>
                  <div className="rounded-2xl surface-panel-faint panel-border p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                      Formula
                    </div>
                    <div className="mt-2 space-y-2 text-sm">
                      <div className="font-mono text-heading">
                        {valueOrDash(calculation?.netFormula)}
                      </div>
                      <div className="font-mono text-heading">
                        {valueOrDash(calculation?.fineFormula)}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl surface-panel-soft panel-border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <SectionTitle
                    title="Technical details"
                    description="Expanded scan and parse data for verification."
                  />
                  <ToggleDetails
                    open={showTechnicalDetails}
                    onToggle={() => setShowTechnicalDetails((current) => !current)}
                    label="technical details"
                  />
                </div>

                {showTechnicalDetails ? (
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl surface-panel-faint panel-border p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                        Raw QR
                      </div>
                      <div className="mt-3 rounded-2xl surface-panel-soft panel-border p-4">
                        {rawQr ? (
                          <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-primary">
                            {rawQr}
                          </pre>
                        ) : (
                          <div className="text-sm text-muted">Not available</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl surface-panel-faint panel-border p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                        Parsed preview
                      </div>
                      {parsedDisplay ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <DetailField
                            label="Supplier"
                            value={valueOrDash(parsedDisplay?.supplier?.name || parsedDisplay?.supplier?.code || supplierName)}
                          />
                          <DetailField
                            label="Item / Design Code"
                            value={valueOrDash(parsedItem?.itemCode || parsedItem?.designCode || itemCode)}
                          />
                          <DetailField
                            label="Gross Weight"
                            value={formatWeightValue(parsedWeights?.grossWeight)}
                          />
                          <DetailField
                            label="Stone Total"
                            value={formatWeightValue(parsedWeights?.stoneWeight)}
                          />
                          <DetailField
                            label="Net Weight"
                            value={formatWeightValue(
                              parsedWeights?.selectedNetWeight ?? parsedWeights?.computedNetWeight,
                            )}
                          />
                          <DetailField
                            label="Stone Amount"
                            value={formatMoneyValue(parsedAmounts?.stoneAmount)}
                          />
                          <DetailField
                            label="Parsed net check"
                            value={parsedCalculation?.mismatch === undefined
                              ? '—'
                              : (parsedCalculation?.mismatch ? 'Mismatch found' : 'Within tolerance')}
                          />
                          <DetailField
                            label="Parsed warnings"
                            value={parsedWarnings.length > 0 ? `${parsedWarnings.length}` : 'None'}
                          />
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl border border-dashed panel-border surface-panel-soft px-4 py-5 text-sm text-muted">
                          Not available for manual sale entry.
                        </div>
                      )}
                    </div>

                    <div className="xl:col-span-2 rounded-2xl surface-panel-faint panel-border p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                        Parsed explanation
                      </div>
                      <div className="mt-2 text-sm text-muted">
                        {valueOrDash(parsedCalculation?.explanation)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-4 text-sm text-muted">
                    Hidden by default. Open this section when you need to inspect the scan details.
                  </div>
                )}
              </section>

              <section className="rounded-3xl surface-panel-soft panel-border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <SectionTitle
                  title="Warnings"
                  description="Anything that needs attention before settlement trust is final."
                />
                <div className="mt-4 space-y-3">
                  {warnings.length > 0 ? (
                    warnings.map((warning, index) => (
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
