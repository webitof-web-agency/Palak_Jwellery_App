import { useEffect } from 'react'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import {
  formatCurrency,
  formatDateTime,
  formatPercentage,
  formatWeight,
} from '../../../utils/formatters'

const displayText = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

const displayWeight = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return formatWeight(value)
}

const displayPercentage = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return formatPercentage(value)
}

const displayCurrency = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return formatCurrency(value)
}

const getParsedDisplay = (parsedSnapshot) => {
  if (!parsedSnapshot || typeof parsedSnapshot !== 'object') {
    return null
  }

  if (parsedSnapshot.display && typeof parsedSnapshot.display === 'object') {
    return parsedSnapshot.display
  }

  return parsedSnapshot
}

const DetailField = ({ label, value, mono = false, className = '' }) => (
  <div
    className={`rounded-2xl border border-white/10 bg-white/5 px-4 py-3 ${className}`.trim()}
  >
    <div className="text-[10px] uppercase tracking-[0.18em] text-muted">{label}</div>
    <div className={`mt-1 text-sm font-semibold ${mono ? 'font-mono break-all' : 'text-heading'}`}>
      {value}
    </div>
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
    neutral: 'border-white/10 bg-white/5 text-primary',
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

export default function SaleDetailModal({ open, sale, loading, error, onClose }) {
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

  if (!open) {
    return null
  }

  const supplier = sale?.supplier && typeof sale.supplier === 'object' ? sale.supplier : null
  const salesman = sale?.salesman && typeof sale.salesman === 'object' ? sale.salesman : null
  const calculation = sale?.calculationSnapshot && typeof sale.calculationSnapshot === 'object'
    ? sale.calculationSnapshot
    : {}
  const parsedSnapshot = getParsedDisplay(sale?.parsedSnapshot)
  const item = parsedSnapshot?.item && typeof parsedSnapshot.item === 'object' ? parsedSnapshot.item : {}
  const weights = parsedSnapshot?.weights && typeof parsedSnapshot.weights === 'object'
    ? parsedSnapshot.weights
    : {}
  const amounts = parsedSnapshot?.amounts && typeof parsedSnapshot.amounts === 'object'
    ? parsedSnapshot.amounts
    : {}
  const calculationDisplay = parsedSnapshot?.calculation && typeof parsedSnapshot.calculation === 'object'
    ? parsedSnapshot.calculation
    : {}
  const parsedWarnings = Array.isArray(parsedSnapshot?.warnings) ? parsedSnapshot.warnings : []
  const calculationWarnings = Array.isArray(calculation?.warnings) ? calculation.warnings : []
  const warnings = [...new Set([...calculationWarnings, ...parsedWarnings].filter(Boolean))]
  const stoneComponents = Array.isArray(weights.stoneComponents) ? weights.stoneComponents : []
  const duplicate = sale?.isDuplicate === true
  const requiresReview = calculation?.requiresReview === true
  const rawQr = sale?.qrRaw || parsedSnapshot?.rawQr || null
  const itemCode = item?.itemCode || sale?.itemCode || '—'
  const designCode = item?.designCode || sale?.itemCode || '—'
  const category = item?.category || item?.colorCategory || sale?.category || '—'
  const metalType = item?.metalType || sale?.metalType || '—'
  const karat = item?.karat || sale?.purity || '—'
  const supplierName = supplier?.name || '—'
  const supplierCode = supplier?.code || '—'
  const salesmanName = salesman?.name || '—'
  const reportDate = formatDateTime(sale?.saleDate)

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.()
        }
      }}
    >
      <div className="mx-auto flex h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[color:var(--surface)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Sale detail</span>
              {duplicate ? <Badge tone="amber">Duplicate</Badge> : null}
              {requiresReview ? <Badge tone="rose">Needs review</Badge> : null}
            </div>
            <h2 className="mt-2 text-2xl font-bold font-display text-heading">
              {sale?.ref || 'Sale detail'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {supplierName} ({supplierCode}) · {salesmanName} · {reportDate}
            </p>
          </div>

          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-primary transition-all duration-200 hover:bg-white/10 hover:border-gold-500/30"
            onClick={onClose}
            aria-label="Close sale detail"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
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
            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <SectionTitle
                    title="Item Details"
                    description="Core business fields captured for this sale."
                  />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <DetailField label="Item Code" value={displayText(itemCode)} />
                    <DetailField label="Design Code" value={displayText(designCode)} />
                    <DetailField label="Category / Color" value={displayText(category)} />
                    <DetailField label="Metal Type" value={displayText(metalType)} />
                    <DetailField label="Karat / Purity" value={displayText(karat)} />
                  </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <SectionTitle
                    title="Stone Breakdown"
                    description="Stone components and deductions used in the net weight check."
                  />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <DetailField
                      label="Stone Weight"
                      value={displayWeight(calculation?.stoneWeight ?? weights?.stoneWeight)}
                    />
                    <DetailField
                      label="Other Weight"
                      value={displayWeight(calculation?.otherWeight ?? weights?.otherWeight)}
                    />
                    <DetailField
                      label="QR Net Weight"
                      value={displayWeight(calculation?.qrNetWeight ?? weights?.qrNetWeight)}
                    />
                    <DetailField
                      label="Computed Net Weight"
                      value={displayWeight(calculation?.computedNetWeight ?? weights?.computedNetWeight)}
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                      Stone components
                    </div>
                    <div className="mt-3 space-y-2">
                      {stoneComponents.length > 0 ? (
                        stoneComponents.map((component, index) => (
                          <div
                            key={`${component?.sourceField || index}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                          >
                            <div>
                              <div className="text-sm font-semibold text-heading">
                                {displayText(component?.label || `Stone Component ${index + 1}`)}
                              </div>
                              <div className="text-xs text-muted">
                                {displayText(component?.sourceField)}
                              </div>
                            </div>
                            <div className="font-mono text-sm font-semibold text-heading">
                              {displayWeight(component?.value)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-sm text-muted">
                          Not available
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <SectionTitle
                    title="Calculation"
                    description="The backend snapshot stored at the time of sale."
                  />
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <DetailField
                      label="Purity Percent"
                      value={displayPercentage(calculation?.purityPercent)}
                    />
                    <DetailField
                      label="Wastage Percent"
                      value={displayPercentage(calculation?.wastagePercent)}
                    />
                    <DetailField
                      label="Settlement Percent"
                      value={displayPercentage(calculation?.settlementPercent)}
                    />
                    <DetailField
                      label="Fine Weight"
                      value={displayWeight(calculation?.fineWeight)}
                    />
                    <DetailField
                      label="Selected Net Weight"
                      value={displayWeight(calculation?.selectedNetWeight)}
                    />
                    <DetailField
                      label="Tolerance"
                      value={displayWeight(calculation?.tolerance)}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                        Net weight check
                      </div>
                      <div className="mt-2 text-sm text-heading">
                        {displayText(calculationDisplay?.mismatch !== undefined ? (calculationDisplay?.mismatch ? 'Mismatch found' : 'Within tolerance') : (calculation?.requiresReview ? 'Needs review' : 'Within tolerance'))}
                      </div>
                      <div className="mt-1 text-sm text-muted">
                        {displayText(calculationDisplay?.explanation || calculation?.explanation)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                        Formula
                      </div>
                      <div className="mt-2 space-y-2 text-sm">
                        <div className="font-mono text-heading">
                          {displayText(calculation?.netFormula || calculationDisplay?.netFormula)}
                        </div>
                        <div className="font-mono text-heading">
                          {displayText(calculation?.fineFormula || calculationDisplay?.fineFormula)}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-4">
                <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <SectionTitle
                    title="Raw QR"
                    description="The original QR text saved with the sale, if available."
                  />
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    {rawQr ? (
                      <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-primary">
                        {rawQr}
                      </pre>
                    ) : (
                      <div className="text-sm text-muted">Not available</div>
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <SectionTitle
                    title="Captured Preview"
                    description="The parsed values kept for verification, when the sale came from a scan."
                  />
                  {parsedSnapshot ? (
                    <div className="mt-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DetailField
                          label="Supplier"
                          value={displayText(parsedSnapshot?.supplier?.name || parsedSnapshot?.supplier?.code || supplierName)}
                        />
                        <DetailField
                          label="Item Code"
                          value={displayText(parsedSnapshot?.item?.itemCode || parsedSnapshot?.item?.designCode || itemCode)}
                        />
                        <DetailField
                          label="Gross Weight"
                          value={displayWeight(parsedSnapshot?.weights?.grossWeight)}
                        />
                        <DetailField
                          label="Stone Total"
                          value={displayWeight(parsedSnapshot?.weights?.stoneWeight)}
                        />
                        <DetailField
                          label="Net Weight"
                          value={displayWeight(parsedSnapshot?.weights?.selectedNetWeight || parsedSnapshot?.weights?.computedNetWeight)}
                        />
                        <DetailField
                          label="Stone Amount"
                          value={displayCurrency(parsedSnapshot?.amounts?.stoneAmount)}
                        />
                        <DetailField
                          label="Other Amount"
                          value={displayCurrency(amounts?.otherAmount)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-muted">
                      Not available for manual sale entry.
                    </div>
                  )}
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <SectionTitle
                    title="Warnings"
                    description="Anything that needs attention before settlement trust is final."
                  />
                  <div className="mt-4 space-y-3">
                    {warnings.length > 0 ? (
                      warnings.map((warning, index) => (
                        <div
                          key={`${warning}-${index}`}
                          className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
                        >
                          {warning}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-5 text-sm text-muted">
                        No warnings
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
