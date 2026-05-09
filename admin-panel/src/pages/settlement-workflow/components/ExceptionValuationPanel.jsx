import SectionCard from '../../../components/ui/SectionCard'
import { formatCurrency, formatWeight } from '../../../utils/formatters'
import ExceptionWarningList from './ExceptionWarningList'
import WorkflowStatusBadges from './WorkflowStatusBadges'

const renderAmount = (value, formatter) => (typeof value === 'number' ? formatter(value) : '-')

export default function ExceptionValuationPanel({
  valuation,
  currentWarnings,
  originalWarnings,
  status,
  workflowState,
  correctionNote,
}) {
  const totals = valuation?.totals || {}

  return (
    <div className="space-y-6">
      <SectionCard title="Persisted Valuation">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-2xl surface-panel-soft panel-border p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Fine Weight</div>
            <div className="mt-2 text-2xl font-bold text-heading">
              {valuation?.fine_weight == null ? '-' : formatWeight(valuation.fine_weight)}
            </div>
            <div className="text-xs text-muted mt-1">{valuation?.fine_weight_source || 'missing'}</div>
          </div>
          <div className="rounded-2xl surface-panel-soft panel-border p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Stone Amount</div>
            <div className="mt-2 text-2xl font-bold text-heading">
              {valuation?.stone_amount == null ? '-' : formatCurrency(valuation.stone_amount)}
            </div>
            <div className="text-xs text-muted mt-1">{valuation?.stone_amount_source || 'missing'}</div>
          </div>
          <div className="rounded-2xl surface-panel-soft panel-border p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Valuation State</div>
            <div className="mt-2">
              <WorkflowStatusBadges
                status={status}
                valuationStatus={valuation?.valuation_status}
                workflowState={workflowState}
              />
            </div>
          </div>
          <div className="rounded-2xl surface-panel-soft panel-border p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Correction Note</div>
            <div className="mt-2 text-primary whitespace-pre-wrap">{correctionNote || valuation?.correction_note || '-'}</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Totals">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[
            ['Gross', totals.gross_weight],
            ['Stone', totals.stone_weight],
            ['Other', totals.other_weight],
            ['Net', totals.net_weight],
            ['Fine', totals.fine_weight],
            ['Stone Amount', totals.stone_amount],
            ['Other Amount', totals.other_amount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl surface-panel-soft panel-border p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">{label}</div>
              <div className="mt-2 text-xl font-bold text-heading">
                {typeof value !== 'number'
                  ? '-'
                  : label.includes('Amount')
                    ? renderAmount(value, formatCurrency)
                    : renderAmount(value, formatWeight)}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ExceptionWarningList
          title="Original Valuation Warnings"
          items={originalWarnings}
          emptyDescription="The original valuation did not produce warnings."
        />
        <ExceptionWarningList
          title="Current Valuation Warnings"
          items={currentWarnings}
          emptyDescription="The corrected valuation did not produce warnings."
        />
      </div>
    </div>
  )
}
