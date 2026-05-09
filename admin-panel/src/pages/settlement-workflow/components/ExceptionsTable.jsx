import EmptyState from '../../../components/ui/EmptyState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import SectionCard from '../../../components/ui/SectionCard'
import TableSkeleton from '../../../components/ui/TableSkeleton'
import { formatConfidence, formatDateTime, formatNumber } from '../../../utils/formatters'
import WorkflowStatusBadges from './WorkflowStatusBadges'
import { buttonStyles } from '../../sales/salesPage.utils'
import { deriveWorkflowState } from '../workflow.utils'

const WarningCount = ({ label, count }) => (
  <div className="text-xs">
    <div className="uppercase tracking-[0.18em] text-[10px] text-muted font-bold">{label}</div>
    <div className="font-semibold text-heading">{formatNumber(count)}</div>
  </div>
)

export default function ExceptionsTable({
  rows,
  loading,
  onViewDetail,
  onApprove,
  onMarkReviewed,
  pendingAction = '',
}) {
  return (
    <SectionCard className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.18em] text-muted">
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Design Code</th>
              <th className="px-4 py-3">Settlement Status</th>
              <th className="px-4 py-3 text-right">Confidence</th>
              <th className="px-4 py-3">Verification</th>
              <th className="px-4 py-3 whitespace-nowrap">Recorded</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>

          {loading ? (
            <tbody>
              <tr>
                <td colSpan="7" className="px-4 py-5">
                  <TableSkeleton columns={7} rows={6} />
                </td>
              </tr>
            </tbody>
          ) : rows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan="7" className="px-4 py-5">
                  <EmptyState
                    title="No verification exceptions found"
                    description="This queue only shows malformed, low-confidence, or verification-required records."
                  />
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody className="divide-y divide-white/5">
              {rows.map((row) => {
                const validationCount = Array.isArray(row.validation_warnings) ? row.validation_warnings.length : 0
                const valuationCount = Array.isArray(row.valuation_warnings) ? row.valuation_warnings.length : 0
                const workflowState = deriveWorkflowState(row)
                const isLocked = workflowState === 'approved'
                const approveActionKey = `approve:${row.id}`
                const reviewActionKey = `review:${row.id}`
                const viewActionKey = `view:${row.id}`
                const isViewLoading = pendingAction === viewActionKey
                const isApproveLoading = pendingAction === approveActionKey
                const isReviewLoading = pendingAction === reviewActionKey

                return (
                  <tr key={row.id} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-medium text-primary">
                        {row.supplier || 'Unknown'}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                        {row.id}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-primary whitespace-nowrap font-mono text-sm">
                      {row.design_code || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <WorkflowStatusBadges
                        status={row.status}
                        valuationStatus={row.valuation_status}
                        workflowState={workflowState}
                      />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-primary">
                      {formatConfidence(row.confidence)}%
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        <WarningCount label="Validation" count={validationCount} />
                        <WarningCount label="Settlement" count={valuationCount} />
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col sm:flex-row gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => onViewDetail(row.id)}
                          className={buttonStyles.ghost}
                          disabled={Boolean(pendingAction)}
                        >
                          {isViewLoading ? (
                            <>
                              <LoadingSpinner />
                              Opening...
                            </>
                          ) : (
                            'View Details'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onApprove(row.id)}
                          disabled={isLocked || Boolean(pendingAction)}
                          className={buttonStyles.secondary}
                        >
                          {isLocked ? (
                            'Approved'
                          ) : isApproveLoading ? (
                            <>
                              <LoadingSpinner />
                              Approving...
                            </>
                          ) : (
                            'Approve'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onMarkReviewed(row.id)}
                          disabled={isLocked || Boolean(pendingAction)}
                          className={buttonStyles.secondary}
                        >
                          {isLocked ? (
                            'Locked'
                          ) : isReviewLoading ? (
                            <>
                              <LoadingSpinner />
                              Marking...
                            </>
                          ) : (
                            'Mark Reviewed'
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          )}
        </table>
      </div>
    </SectionCard>
  )
}
