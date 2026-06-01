import SectionCard from '../../../components/ui/SectionCard'
import EmptyState from '../../../components/ui/EmptyState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { formatDateTime, formatWeight } from '../../../utils/formatters'
import { getName, buttonStyles } from '../salesPage.utils'

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

const getSnapshot = (sale) => (sale?.calculationSnapshot && typeof sale.calculationSnapshot === 'object'
  ? sale.calculationSnapshot
  : {})

const getSettlementInputs = (sale) => (sale?.settlementInputs && typeof sale.settlementInputs === 'object'
  ? sale.settlementInputs
  : {})

const getParsedItem = (sale) => {
  const parsedSnapshot = sale?.parsedSnapshot && typeof sale.parsedSnapshot === 'object'
    ? sale.parsedSnapshot
    : null
  const display = parsedSnapshot?.display && typeof parsedSnapshot.display === 'object'
    ? parsedSnapshot.display
    : parsedSnapshot
  return display?.item && typeof display.item === 'object' ? display.item : {}
}

const getStatusBadges = (sale) => {
  const calculation = getSnapshot(sale)
  const settlementInputs = getSettlementInputs(sale)
  const parsedSnapshot = sale?.parsedSnapshot && typeof sale.parsedSnapshot === 'object'
    ? sale.parsedSnapshot
    : null
  const parsedDisplay = parsedSnapshot?.display && typeof parsedSnapshot.display === 'object'
    ? parsedSnapshot.display
    : parsedSnapshot

  const badges = []
  if (sale?.isDuplicate === true) {
    badges.push({ label: 'Duplicate', tone: 'amber' })
  }

  if (calculation?.requiresReview === true || parsedDisplay?.requiresReview === true) {
    badges.push({ label: 'Needs Review', tone: 'rose' })
  }

  if (settlementInputs?.purityOverridden === true || settlementInputs?.wastageOverridden === true) {
    badges.push({ label: 'Manual Override', tone: 'gold' })
  }

  if (badges.length === 0) {
    badges.push({ label: 'OK', tone: 'neutral' })
  }

  return badges
}

const StatusBadge = ({ label, tone = 'neutral' }) => {
  const toneClasses = {
    neutral: 'border-white/10 bg-white/5 text-primary',
    gold: 'border-gold-500/30 bg-gold-500/10 text-gold-100',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    rose: 'border-red-400/30 bg-red-400/10 text-red-100',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${toneClasses[tone] || toneClasses.neutral}`}
    >
      {label}
    </span>
  )
}

const LoadingRows = () => (
  <tbody className="divide-y divide-white/5">
    {[...Array(6)].map((_, rowIndex) => (
      <tr key={rowIndex}>
        {[...Array(11)].map((__, cellIndex) => (
          <td key={cellIndex} className="px-5 py-4">
            <div className="skeleton-line h-4" />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
)

export default function SalesRecordsTable({
  sales,
  loading,
  page,
  pages,
  total,
  limit,
  onPageChange,
  onViewDetail,
  viewingSaleId,
  detailLoading,
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
        <table className="w-full min-w-[1180px] text-left">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.18em] text-muted">
              <th className="px-5 py-4">Ref</th>
              <th className="px-5 py-4">Date</th>
              <th className="px-5 py-4">Supplier</th>
              <th className="px-5 py-4">Item / Design Code</th>
              <th className="px-5 py-4">Karat</th>
              <th className="px-5 py-4 text-right">Gross Wt</th>
              <th className="px-5 py-4 text-right">Stone Wt</th>
              <th className="px-5 py-4 text-right">Net Wt</th>
              <th className="px-5 py-4 text-right">Fine Wt</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>

          {loading ? (
            <LoadingRows />
          ) : sales.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan="11" className="px-5 py-6">
                  <EmptyState
                    title="No sales found"
                    description="Try widening the date range or clearing a filter."
                  />
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody className="divide-y divide-white/5">
              {sales.map((sale) => {
                const calculation = getSnapshot(sale)
                const settlementInputs = getSettlementInputs(sale)
                const parsedItem = getParsedItem(sale)
                const itemCode = parsedItem?.itemCode || parsedItem?.designCode || sale?.itemCode || sale?.designCode || sale?.design_code || '—'
                const karat = settlementInputs?.karat || parsedItem?.karat || sale?.purity || '—'
                const grossWeight = calculation?.grossWeight ?? sale?.grossWeight ?? sale?.gross_weight
                const stoneWeight = calculation?.stoneWeight ?? sale?.stoneWeight ?? sale?.stone_weight
                const netWeight = calculation?.selectedNetWeight ?? calculation?.computedNetWeight ?? sale?.netWeight ?? sale?.net_weight
                const fineWeight = calculation?.fineWeight ?? sale?.fineWeight ?? sale?.fine_weight
                const statusBadges = getStatusBadges(sale)

                return (
                  <tr key={sale._id} className="hover:bg-white/5">
                    <td className="px-5 py-4 font-mono text-xs text-muted whitespace-nowrap">
                      {sale.ref || '—'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-primary">
                      {formatDateTime(sale.saleDate)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-primary">
                      {getName(sale.supplier)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-primary">
                      {formatValue(itemCode)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-primary">
                      {formatValue(karat)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {grossWeight === null || grossWeight === undefined || grossWeight === '' ? '—' : formatWeight(grossWeight)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {stoneWeight === null || stoneWeight === undefined || stoneWeight === '' ? '—' : formatWeight(stoneWeight)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {netWeight === null || netWeight === undefined || netWeight === '' ? '—' : formatWeight(netWeight)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {fineWeight === null || fineWeight === undefined || fineWeight === '' ? '—' : formatWeight(fineWeight)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {statusBadges.map((badge) => (
                          <StatusBadge key={badge.label} label={badge.label} tone={badge.tone} />
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        className={buttonStyles.ghost}
                        onClick={() => onViewDetail?.(sale._id)}
                        aria-label={`View details for ${sale.ref || 'this sale'}`}
                        disabled={detailLoading && viewingSaleId === sale._id}
                      >
                        {detailLoading && viewingSaleId === sale._id ? (
                          <>
                            <LoadingSpinner />
                            Opening...
                          </>
                        ) : (
                          'View details'
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          )}
        </table>
      </div>

      <div className="flex flex-col gap-4 border-t border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted">{rangeText}</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={buttonStyles.secondary}
            disabled={loading || page <= 1}
            onClick={() => onPageChange((current) => Math.max(1, current - 1))}
            aria-label="Previous sales page"
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
            aria-label="Next sales page"
          >
            Next
          </button>
        </div>
      </div>
    </SectionCard>
  )
}
