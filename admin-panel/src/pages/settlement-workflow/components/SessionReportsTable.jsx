import EmptyState from '../../../components/ui/EmptyState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import SectionCard from '../../../components/ui/SectionCard'
import TableSkeleton from '../../../components/ui/TableSkeleton'
import { buttonStyles } from '../../sales/salesPage.utils'
import { formatWeight } from '../../../utils/formatters'
import { formatSessionStatusLabel, formatDateTimeOrDash, getName } from '../../sales/salesPage.utils'

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

const getTone = (status) => {
  switch (String(status || '').toLowerCase()) {
    case 'finalized':
      return 'gold'
    case 'submitted':
      return 'amber'
    case 'cancelled':
      return 'neutral'
    case 'open':
      return 'gold'
    default:
      return 'neutral'
  }
}

const valueOrDash = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

const weightOrDash = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  return formatWeight(value)
}

const actionButton =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--jsm-border)] surface-panel-soft px-3 text-[11px] font-semibold text-primary transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none hover:bg-gold-500/10 hover:border-gold-500/30'

const Row = ({
  session,
  onViewSession,
  onDownloadSessionCsv,
  onDownloadSessionPdf,
  activeDownloadKey = null,
  isActive = false,
  isLoading = false,
}) => {
  const sessionId = session?.id || session?._id || session?.sessionId || null
  const supplierCount = Number(session?.supplierCount) || 0
  const itemCount = Number(session?.itemCount) || 0
  const canDownload = String(session?.status || '').toLowerCase() === 'finalized'
  const csvDownloadKey = sessionId ? `session:${sessionId}:csv` : ''
  const pdfDownloadKey = sessionId ? `session:${sessionId}:pdf` : ''
  const isCsvDownloading = activeDownloadKey === csvDownloadKey
  const isPdfDownloading = activeDownloadKey === pdfDownloadKey

  return (
    <tr className={isActive ? 'bg-[var(--jsm-panel-bg-faint)]' : 'hover:bg-[var(--jsm-panel-bg-faint)]'}>
      <td className="px-4 py-3 font-mono text-xs text-muted whitespace-nowrap">
        {valueOrDash(session?.sessionRef)}
      </td>
      <td className="px-4 py-3">
        <div className="text-primary font-medium">{valueOrDash(session?.customerName || 'Unknown')}</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
          {[
            session?.customerPhone ? `Phone ${session.customerPhone}` : '',
            session?.referenceNote ? session.referenceNote : '',
          ].filter(Boolean).join(' | ') || '-'}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">
        {getName(session?.assignedSalesman)}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{supplierCount}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{itemCount}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{weightOrDash(session?.totals?.grossWeight)}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{weightOrDash(session?.totals?.netWeight)}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap text-primary">{weightOrDash(session?.totals?.fineWeight)}</td>
      <td className="px-4 py-3 whitespace-nowrap text-primary">{formatDateTimeOrDash(session?.finalizedAt || session?.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone={getTone(session?.status)}>{formatSessionStatusLabel(session?.status)}</Badge>
          {Number(session?.warningsCount) > 0 ? <Badge tone="rose">{session.warningsCount} warnings</Badge> : null}
          {Number(session?.duplicateCount) > 0 ? <Badge tone="amber">{session.duplicateCount} duplicates</Badge> : null}
          {Number(session?.manualOverrideCount) > 0 ? <Badge tone="gold">{session.manualOverrideCount} overrides</Badge> : null}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={actionButton}
            disabled={isLoading}
            onClick={() => onViewSession?.(sessionId)}
            aria-label={`View session ${session?.sessionRef || 'details'}`}
          >
            View session
          </button>
          {canDownload ? (
            <>
              <button
                type="button"
                className={actionButton}
                disabled={Boolean(activeDownloadKey) || !sessionId}
                onClick={() => onDownloadSessionPdf?.(session)}
                aria-label={`Print preview for session ${session?.sessionRef || 'details'}`}
              >
                {isPdfDownloading ? <><LoadingSpinner className="h-3 w-3" /> Download PDF</> : 'Download PDF'}
              </button>
              <button
                type="button"
                className={actionButton}
                disabled={Boolean(activeDownloadKey) || !sessionId}
                onClick={() => onDownloadSessionCsv?.(session)}
                aria-label={`Download CSV for session ${session?.sessionRef || 'details'}`}
              >
                {isCsvDownloading ? <><LoadingSpinner className="h-3 w-3" /> Download CSV</> : 'Download CSV'}
              </button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

export default function SessionReportsTable({
  sessions = [],
  loading,
  page = 1,
  pages = 1,
  total = 0,
  limit = 10,
  onPageChange,
  onLimitChange,
  onViewSession,
  onDownloadSessionCsv,
  onDownloadSessionPdf,
  viewingSessionId = null,
  actionLoadingSessionId = null,
  activeDownloadKey = null,
}) {
  const hasData = Array.isArray(sessions) && sessions.length > 0

  return (
    <SectionCard className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--jsm-border)] text-[10px] uppercase tracking-[0.18em] text-muted">
              <th className="px-4 py-3">Session Ref</th>
              <th className="px-4 py-3">Customer / Reference</th>
              <th className="px-4 py-3">Salesman</th>
              <th className="px-4 py-3 text-right">Suppliers</th>
              <th className="px-4 py-3 text-right">Items</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3 text-right">Fine</th>
              <th className="px-4 py-3 whitespace-nowrap">Finalized</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>

          {loading ? (
            <tbody>
              <tr>
                <td colSpan="11" className="px-5 py-6">
                  <TableSkeleton columns={11} rows={6} />
                </td>
              </tr>
            </tbody>
          ) : !hasData ? (
            <tbody>
              <tr>
                <td colSpan="11" className="px-5 py-6">
                  <EmptyState
                    title="No finalized sessions found"
                    description="Finalize all supplier batches and then finalize the session to review the combined report."
                  />
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody className="divide-y divide-[var(--jsm-border)]">
              {sessions.map((session) => (
                <Row
          key={session.id || session._id || session.sessionId}
          session={session}
                  onViewSession={onViewSession}
                  onDownloadSessionCsv={onDownloadSessionCsv}
                  onDownloadSessionPdf={onDownloadSessionPdf}
                  activeDownloadKey={activeDownloadKey}
                  isActive={viewingSessionId === (session.id || session._id || session.sessionId)}
                  isLoading={actionLoadingSessionId === (session.id || session._id || session.sessionId)}
                />
              ))}
            </tbody>
          )}
        </table>
      </div>

      {!loading && hasData ? (
        <div className="flex flex-col gap-3 border-t panel-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted">
            Showing {Math.min((page - 1) * limit + 1, total)}-{Math.min(page * limit, total)} of {total} sessions
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
