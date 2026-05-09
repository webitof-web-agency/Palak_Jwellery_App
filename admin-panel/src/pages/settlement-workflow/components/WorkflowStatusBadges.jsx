import { getQrStatusTone, getValuationTone, getWorkflowTone } from '../workflow.utils'

const formatWorkflowLabel = (value) => {
  if (value === 'needs_review') return 'Requires Verification'
  if (value === 'corrected') return 'Corrected'
  if (value === 'reviewed') return 'Reviewed'
  if (value === 'approved') return 'Approved'
  return value || 'Unknown'
}

const formatSettlementLabel = (value) => {
  if (value === 'complete') return 'Settlement Complete'
  if (value === 'partial') return 'Pending Settlement'
  if (value === 'supplier_only') return 'Supplier Only'
  return value || 'Unknown'
}

export default function WorkflowStatusBadges({ status, valuationStatus, workflowState }) {
  const state = workflowState || status
  return (
    <div className="flex flex-wrap gap-2">
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getWorkflowTone(state)}`}
      >
        {formatWorkflowLabel(state)}
      </span>
      {status && status !== state ? (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getQrStatusTone(status)}`}
        >
          {formatWorkflowLabel(status)}
        </span>
      ) : null}
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getValuationTone(valuationStatus)}`}
      >
        {formatSettlementLabel(valuationStatus)}
      </span>
    </div>
  )
}
