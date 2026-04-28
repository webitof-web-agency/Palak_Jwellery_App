import SectionCard from '../../../components/ui/SectionCard'
import EmptyState from '../../../components/ui/EmptyState'
import { formatDateTime, formatWeight } from '../../../utils/formatters'
import { getName, buttonStyles } from '../salesPage.utils'

const LoadingRows = () => (
  <tbody className="divide-y divide-white/5">
    {[...Array(6)].map((_, rowIndex) => (
      <tr key={rowIndex}>
        {[...Array(7)].map((__, cellIndex) => (
          <td key={cellIndex} className="px-5 py-4">
            <div className="h-4 rounded bg-white/10 animate-pulse" />
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
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.18em] text-muted">
              <th className="px-5 py-4">Ref</th>
              <th className="px-5 py-4">Date</th>
              <th className="px-5 py-4">Salesman</th>
              <th className="px-5 py-4">Supplier</th>
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4 text-right">Net Wt</th>
              <th className="px-5 py-4 text-right">Duplicate</th>
            </tr>
          </thead>

          {loading ? (
            <LoadingRows />
          ) : sales.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan="7" className="px-5 py-6">
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
                const netWeight = Number(sale?.netWeight) || 0
                const isDuplicate = sale?.isDuplicate === true

                return (
                  <tr key={sale._id} className="hover:bg-white/5">
                    <td className="px-5 py-4 font-mono text-xs text-muted">
                      {sale.ref || '-'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-primary">
                      {formatDateTime(sale.saleDate)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-primary">
                      {getName(sale.salesman)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-primary">
                      {getName(sale.supplier)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-primary">
                      {sale?.category || '-'}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap text-primary">
                      {formatWeight(netWeight)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {isDuplicate ? (
                        <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                          Duplicate
                        </span>
                      ) : (
                        <span className="text-muted text-[10px] uppercase tracking-[0.18em]">
                          -
                        </span>
                      )}
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
