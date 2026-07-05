import EmptyState from '../../../components/ui/EmptyState'
import SectionCard from '../../../components/ui/SectionCard'
import TableSkeleton from '../../../components/ui/TableSkeleton'
import { formatCurrency, formatWeight } from '../../../utils/formatters'
import { buttonStyles, formatDateTimeOrDash, formatSessionStatusLabel, getName } from '../../sales/salesPage.utils'

const Badge = ({ children, tone = 'neutral' }) => {
  const toneClasses = {
    neutral: 'surface-panel-faint text-muted border-[var(--jsm-border)]',
    gold: 'border-gold-500/30 bg-gold-500/10 text-gold-100',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    rose: 'border-red-400/30 bg-red-400/10 text-red-100',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${toneClasses[tone] || toneClasses.neutral}`}>
      {children}
    </span>
  )
}

const getStatusTone = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'finalized':
      return 'gold'
    case 'submitted':
      return 'amber'
    case 'cancelled':
      return 'rose'
    default:
      return 'neutral'
  }
}

const supplierBreakdownLabel = (breakdown = []) => (
  Array.isArray(breakdown) && breakdown.length > 0
    ? breakdown.map((entry) => `${entry.supplierName || 'Unknown'} - ${entry.itemCount || 0}`).join(', ')
    : '-'
)

const suppliersSummaryLabel = (suppliers = []) => (
  Array.isArray(suppliers) && suppliers.length > 0
    ? suppliers.map((entry) => `${entry.supplierName || 'Unknown'} - ${entry.itemCount || 0}`).join(', ')
    : '-'
)

const valueOrDash = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

const renderWeight = (value) => (value === null || value === undefined || value === '' ? '-' : formatWeight(value))
const renderAmount = (value) => (value === null || value === undefined || value === '' ? '-' : formatCurrency(value))

const actionButton =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--jsm-border)] surface-panel-soft px-3 text-[11px] font-semibold text-primary transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none hover:bg-gold-500/10 hover:border-gold-500/30'

const buildColumns = (mode) => {
  if (mode === 'session') {
    return [
      { key: 'sessionRef', label: 'Session Ref' },
      { key: 'date', label: 'Date' },
      { key: 'customer', label: 'Customer' },
      { key: 'salesman', label: 'Salesman' },
      { key: 'suppliers', label: 'Suppliers' },
      { key: 'itemCount', label: 'Items', align: 'right' },
      { key: 'grossWeight', label: 'Gross', align: 'right' },
      { key: 'stoneWeight', label: 'Stone', align: 'right' },
      { key: 'otherWeight', label: 'Other', align: 'right' },
      { key: 'netWeight', label: 'Net', align: 'right' },
      { key: 'fineWeight', label: 'Fine', align: 'right' },
      { key: 'warnings', label: 'Warnings', align: 'right' },
      { key: 'status', label: 'Status' },
      { key: 'actions', label: 'Action', align: 'right' },
    ]
  }

  if (mode === 'karat' || mode === 'wastage') {
    return [
      { key: 'groupLabel', label: mode === 'karat' ? 'Karat' : 'Wastage' },
      { key: 'sessionCount', label: 'Sessions', align: 'right' },
      { key: 'itemCount', label: 'Items', align: 'right' },
      { key: 'grossWeight', label: 'Gross', align: 'right' },
      { key: 'stoneWeight', label: 'Stone', align: 'right' },
      { key: 'otherWeight', label: 'Other', align: 'right' },
      { key: 'netWeight', label: 'Net', align: 'right' },
      { key: 'fineWeight', label: 'Fine', align: 'right' },
      { key: 'stoneAmount', label: 'Stone Amount', align: 'right' },
      { key: 'otherAmount', label: 'Other Amount', align: 'right' },
      { key: 'supplierBreakdown', label: 'Supplier / Company' },
      { key: 'warningsCount', label: 'Warnings', align: 'right' },
      { key: 'lastActivityAt', label: 'Last Activity' },
    ]
  }

  return [
    { key: 'groupLabel', label: 'Supplier / Company' },
    { key: 'sessionCount', label: 'Sessions', align: 'right' },
    { key: 'itemCount', label: 'Items', align: 'right' },
    { key: 'grossWeight', label: 'Gross', align: 'right' },
    { key: 'stoneWeight', label: 'Stone', align: 'right' },
    { key: 'otherWeight', label: 'Other', align: 'right' },
    { key: 'netWeight', label: 'Net', align: 'right' },
    { key: 'fineWeight', label: 'Fine', align: 'right' },
    { key: 'stoneAmount', label: 'Stone Amount', align: 'right' },
    { key: 'otherAmount', label: 'Other Amount', align: 'right' },
    { key: 'warningsCount', label: 'Warnings', align: 'right' },
    { key: 'lastActivityAt', label: 'Last Activity' },
  ]
}

const renderSessionRow = (row, onViewSession) => (
  <tr key={row.sessionId} className="hover:bg-[var(--jsm-panel-bg-faint)]">
    <td className="px-4 py-3 font-mono text-xs text-muted whitespace-nowrap">{valueOrDash(row.sessionRef)}</td>
    <td className="px-4 py-3 whitespace-nowrap text-primary">{formatDateTimeOrDash(row.date)}</td>
    <td className="px-4 py-3">
      <div className="text-primary font-medium">{valueOrDash(row.customerName || 'Unknown')}</div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
        {[row.customerPhone, row.customerArea].filter(Boolean).join(' | ') || '-'}
      </div>
    </td>
    <td className="px-4 py-3 whitespace-nowrap text-primary">{getName(row.salesman)}</td>
    <td className="px-4 py-3 text-primary">{suppliersSummaryLabel(row.suppliersSummary)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{valueOrDash(row.itemCount)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.grossWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.stoneWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.otherWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.netWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.fineWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{valueOrDash(row.warningsCount)}</td>
    <td className="px-4 py-3">
      <Badge tone={getStatusTone(row.status)}>{formatSessionStatusLabel(row.status)}</Badge>
    </td>
    <td className="px-4 py-3 text-right">
      <button
        type="button"
        className={actionButton}
        disabled={!row.sessionId}
        onClick={() => onViewSession?.(row.sessionId)}
      >
        View
      </button>
    </td>
  </tr>
)

const renderGroupedRow = (row, mode) => (
  <tr key={row.groupKey} className="hover:bg-[var(--jsm-panel-bg-faint)]">
    <td className="px-4 py-3">
      <div className="text-primary font-medium">{valueOrDash(row.groupLabel)}</div>
      {(mode === 'supplier' || mode === 'category') && row.supplierBreakdown?.length > 0 ? (
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted">{supplierBreakdownLabel(row.supplierBreakdown)}</div>
      ) : null}
    </td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{valueOrDash(row.sessionCount)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{valueOrDash(row.itemCount)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.grossWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.stoneWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.otherWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.netWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.fineWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderAmount(row.stoneAmount)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderAmount(row.otherAmount)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{valueOrDash(row.warningsCount)}</td>
    <td className="px-4 py-3 whitespace-nowrap text-primary">{formatDateTimeOrDash(row.lastActivityAt)}</td>
  </tr>
)

const renderKaratOrWastageRow = (row) => (
  <tr key={row.groupKey} className="hover:bg-[var(--jsm-panel-bg-faint)]">
    <td className="px-4 py-3 text-primary font-medium">{valueOrDash(row.groupLabel)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{valueOrDash(row.sessionCount)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{valueOrDash(row.itemCount)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.grossWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.stoneWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.otherWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.netWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderWeight(row.fineWeight)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderAmount(row.stoneAmount)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{renderAmount(row.otherAmount)}</td>
    <td className="px-4 py-3 text-primary">{supplierBreakdownLabel(row.supplierBreakdown)}</td>
    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{valueOrDash(row.warningsCount)}</td>
    <td className="px-4 py-3 whitespace-nowrap text-primary">{formatDateTimeOrDash(row.lastActivityAt)}</td>
  </tr>
)

export default function SalesSessionReportsTable({
  mode = 'session',
  rows = [],
  loading = false,
  page = 1,
  pages = 1,
  total = 0,
  limit = 10,
  onPageChange,
  onLimitChange,
  onViewSession,
}) {
  const columns = buildColumns(mode)
  const hasData = Array.isArray(rows) && rows.length > 0

  return (
    <SectionCard className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--jsm-border)] text-[10px] uppercase tracking-[0.18em] text-muted">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 ${column.align === 'right' ? 'text-right' : ''}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          {loading ? (
            <tbody>
              <tr>
                <td colSpan={columns.length} className="px-5 py-6">
                  <TableSkeleton columns={columns.length} rows={6} />
                </td>
              </tr>
            </tbody>
          ) : !hasData ? (
            <tbody>
              <tr>
                <td colSpan={columns.length} className="px-5 py-6">
                  <EmptyState
                    title="No synced mobile sales found for the selected filters."
                    description="Change the filters or sync new mobile sessions to see V2 sales session reports here."
                  />
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody className="divide-y divide-[var(--jsm-border)]">
              {rows.map((row) => {
                if (mode === 'session') return renderSessionRow(row, onViewSession)
                if (mode === 'karat' || mode === 'wastage') return renderKaratOrWastageRow(row)
                return renderGroupedRow(row, mode)
              })}
            </tbody>
          )}
        </table>
      </div>

      {!loading && hasData ? (
        <div className="flex flex-col gap-3 border-t panel-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted">
            Showing {Math.min((page - 1) * limit + 1, total)}-{Math.min(page * limit, total)} of {total} rows
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="field m-0">
              <span className="field-label">Rows per page</span>
              <select
                className="input min-w-[120px]"
                value={limit}
                onChange={(event) => onLimitChange?.(Number(event.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button type="button" className={buttonStyles.secondary} onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
                Previous
              </button>
              <div className="min-w-16 text-center text-sm font-semibold text-heading">
                {page} / {Math.max(1, pages)}
              </div>
              <button type="button" className={buttonStyles.secondary} onClick={() => onPageChange(Math.min(pages, page + 1))} disabled={page >= pages}>
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  )
}
