import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import SectionCard from '../../../components/ui/SectionCard'
import { buttonStyles } from '../../sales/salesPage.utils'

export default function ExceptionCorrectionPanel({
  editableFields,
  formValues,
  correctionNote,
  onFormChange,
  normalizeField,
  onCorrectionNoteChange,
  onSaveCorrections,
  onApprove,
  onMarkReviewed,
  savingAction,
  isLocked,
}) {
  return (
    <SectionCard title="Resolved Values">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {editableFields.map((field) => (
            <label key={field.key} className="rounded-2xl surface-panel-soft panel-border p-4 block">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">
                {field.label}
              </div>
              <input
                className="input mt-2"
                type={field.type}
                step={field.precision === 3 ? '0.001' : '0.01'}
                value={formValues[field.key] ?? ''}
                onChange={(event) => onFormChange(field.key, event.target.value)}
                onBlur={() => normalizeField(field)}
                aria-label={field.label}
                disabled={isLocked}
              />
            </label>
          ))}
        </div>

        <div className="rounded-2xl surface-panel-soft panel-border p-4">
          <label className="block">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">
              Correction Note
            </div>
            <textarea
              className="input mt-2 min-h-[110px]"
              value={correctionNote}
              onChange={(event) => onCorrectionNoteChange(event.target.value)}
              placeholder="Add a note for major numeric overrides or supplier clarifications."
              disabled={isLocked}
              aria-label="Correction note"
            />
          </label>
          <p className="mt-2 text-xs text-muted">
            Required when a correction materially changes numeric values.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onSaveCorrections}
            className={buttonStyles.primary}
            disabled={savingAction === 'save' || isLocked}
          >
            {isLocked ? (
              'Locked'
            ) : savingAction === 'save' ? (
              <>
                <LoadingSpinner />
                Saving...
              </>
            ) : (
              'Save Corrections'
            )}
          </button>
          <button
            type="button"
            onClick={onApprove}
            className={buttonStyles.secondary}
            disabled={savingAction === 'approve' || isLocked}
          >
            {isLocked ? (
              'Approved'
            ) : savingAction === 'approve' ? (
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
            onClick={onMarkReviewed}
            className={buttonStyles.secondary}
            disabled={savingAction === 'review' || isLocked}
          >
            {isLocked ? (
              'Reviewed'
            ) : savingAction === 'review' ? (
              <>
                <LoadingSpinner />
                Marking...
              </>
            ) : (
              'Mark Reviewed'
            )}
          </button>
        </div>
      </div>
    </SectionCard>
  )
}
