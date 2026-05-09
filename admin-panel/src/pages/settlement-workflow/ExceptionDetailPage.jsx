import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import TableSkeleton from '../../components/ui/TableSkeleton'
import { qrOperationsApi } from '../../api/qrOperations.api'
import { formatConfidence, formatCurrency, formatDateTime, formatPercentage, formatWeight } from '../../utils/formatters'
import { normalizePrecisionInput } from '../../utils/precision'
import ExceptionCorrectionPanel from './components/ExceptionCorrectionPanel'
import ExceptionDiffTable from './components/ExceptionDiffTable'
import ExceptionParsedPanel from './components/ExceptionParsedPanel'
import ExceptionRawPanel from './components/ExceptionRawPanel'
import WorkflowStatusBadges from './components/WorkflowStatusBadges'
import ExceptionValidationPanel from './components/ExceptionValidationPanel'
import ExceptionValuationPanel from './components/ExceptionValuationPanel'
import { buttonStyles } from '../sales/salesPage.utils'
import { deriveWorkflowState } from './workflow.utils'

const EDITABLE_FIELDS = [
  { key: 'gross_weight', label: 'Gross Weight', type: 'number', format: formatWeight, precision: 3 },
  { key: 'stone_weight', label: 'Stone Weight', type: 'number', format: formatWeight, precision: 3 },
  { key: 'other_weight', label: 'Other Weight', type: 'number', format: formatWeight, precision: 3 },
  { key: 'net_weight', label: 'Net Weight', type: 'number', format: formatWeight, precision: 3 },
  { key: 'purity_percent', label: 'Purity %', type: 'number', format: formatPercentage, precision: 2 },
  { key: 'wastage_percent', label: 'Wastage %', type: 'number', format: formatPercentage, precision: 2 },
  { key: 'stone_amount', label: 'Stone Amount', type: 'number', format: formatCurrency, precision: 2 },
  { key: 'other_amount', label: 'Other Amount', type: 'number', format: formatCurrency, precision: 2 },
]

const readOnlyFields = [
  { key: 'supplier', label: 'Supplier' },
  { key: 'itemCode', label: 'Item Code' },
  { key: 'design_code', label: 'Design Code' },
  { key: 'grossWeight', label: 'Gross Weight', format: formatWeight },
  { key: 'stoneWeight', label: 'Stone Weight', format: formatWeight },
  { key: 'otherWeight', label: 'Other Weight', format: formatWeight },
  { key: 'netWeight', label: 'Net Weight', format: formatWeight },
  { key: 'purity', label: 'Purity', format: formatPercentage },
]

const comparisonFields = [
  { key: 'gross_weight', label: 'Gross Weight', originalKey: 'grossWeight', format: formatWeight, precision: 3 },
  { key: 'stone_weight', label: 'Stone Weight', originalKey: 'stoneWeight', format: formatWeight, precision: 3 },
  { key: 'other_weight', label: 'Other Weight', originalKey: 'otherWeight', format: formatWeight, precision: 3 },
  { key: 'net_weight', label: 'Net Weight', originalKey: 'netWeight', format: formatWeight, precision: 3 },
  { key: 'purity_percent', label: 'Purity %', originalKey: 'purity', format: formatPercentage, precision: 2 },
  { key: 'wastage_percent', label: 'Wastage %', originalKey: 'wastage_percent', format: formatPercentage, precision: 2 },
  { key: 'stone_amount', label: 'Stone Amount', originalKey: 'stone_amount', format: formatCurrency, precision: 2 },
]

const toInputValue = (value) => (value === null || value === undefined ? '' : String(value))

const buildInitialFormState = (record) =>
  EDITABLE_FIELDS.reduce((acc, field) => {
    acc[field.key] =
      record?.final?.[field.key] ??
      record?.corrections?.[field.key] ??
      record?.parsed?.[field.key] ??
      record?.parsed?.[field.key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] ??
      ''
    return acc
  }, {})

export default function ExceptionDetailPage() {
  const { id } = useParams()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formValues, setFormValues] = useState({})
  const [correctionNote, setCorrectionNote] = useState('')
  const [savingAction, setSavingAction] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const loadRecord = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await qrOperationsApi.getIngestionDetail(id)
      setRecord(response?.data ?? null)
    } catch (err) {
      setError(err?.error || err?.message || 'Failed to load QR detail.')
      setRecord(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    setStatusMessage('')
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await qrOperationsApi.getIngestionDetail(id)
        if (!active) return
        setRecord(response?.data ?? null)
      } catch (err) {
        if (!active) return
        setError(err?.error || err?.message || 'Failed to load QR detail.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    if (record) {
      setFormValues(buildInitialFormState(record))
      setCorrectionNote(record?.correction_note || '')
    }
  }, [record])

  const currentValidationWarnings = useMemo(
    () =>
      Array.isArray(record?.validationWarnings)
        ? record.validationWarnings
        : Array.isArray(record?.validation?.warnings)
          ? record.validation.warnings
          : [],
    [record],
  )

  const currentValuationWarnings = useMemo(
    () =>
      Array.isArray(record?.valuationWarnings)
        ? record.valuationWarnings
        : Array.isArray(record?.valuation?.warnings)
          ? record.valuation.warnings
          : [],
    [record],
  )

  const originalValidationWarnings = useMemo(
    () => (Array.isArray(record?.originalValidationWarnings) ? record.originalValidationWarnings : []),
    [record],
  )

  const originalValuationWarnings = useMemo(
    () => (Array.isArray(record?.originalValuationWarnings) ? record.originalValuationWarnings : []),
    [record],
  )

  const parsedDisplayData = useMemo(
    () => ({
      ...record?.parsed,
      design_code: record?.parsed?.designCode,
    }),
    [record],
  )

  const valuation = record?.valuation || {}
  const totals = valuation?.totals || {}
  const workflowState = deriveWorkflowState(record || {})
  const isLocked = Boolean(record?.approvedAt || record?.status === 'approved' || workflowState === 'approved')

  const comparisonRows = useMemo(
    () =>
      comparisonFields.map((field) => ({
        ...field,
        original: record?.parsed?.[field.originalKey],
        corrected: formValues[field.key],
        final: record?.final?.[field.key],
      })),
    [formValues, record],
  )

  const onFormChange = (field, value) => {
    setFormValues((current) => ({ ...current, [field]: value }))
  }

  const normalizeField = (field) => {
    setFormValues((current) => ({
      ...current,
      [field.key]: normalizePrecisionInput(current[field.key], field.precision),
    }))
  }

  const buildNormalizedCorrections = () =>
    EDITABLE_FIELDS.reduce((acc, field) => {
      acc[field.key] = normalizePrecisionInput(formValues[field.key], field.precision)
      return acc
    }, {})

  const buildChangedNote = () => correctionNote.trim()

  const handleSaveCorrections = async () => {
    setSavingAction('save')
    setError('')
    try {
      const normalizedCorrections = buildNormalizedCorrections()
      setFormValues(normalizedCorrections)
      const normalizedNote = buildChangedNote()
      setCorrectionNote(normalizedNote)
      await qrOperationsApi.saveCorrections(id, normalizedCorrections, normalizedNote)
      setStatusMessage('Corrections saved')
      await loadRecord()
    } catch (err) {
      setError(err?.error || err?.message || 'Failed to save corrections.')
    } finally {
      setSavingAction('')
    }
  }

  const handleApprove = async () => {
    setSavingAction('approve')
    setError('')
    try {
      await qrOperationsApi.approveIngestion(id)
      setStatusMessage('Record approved')
      await loadRecord()
    } catch (err) {
      setError(err?.error || err?.message || 'Failed to approve QR.')
    } finally {
      setSavingAction('')
    }
  }

  const handleMarkReviewed = async () => {
    setSavingAction('review')
    setError('')
    try {
      await qrOperationsApi.markReviewed(id)
      setStatusMessage('Record marked as reviewed')
      await loadRecord()
    } catch (err) {
      setError(err?.error || err?.message || 'Failed to mark QR as reviewed.')
    } finally {
      setSavingAction('')
    }
  }

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Exceptions"
        title="Exception Detail"
        description="Inspect parsed values, apply correction overrides, and persist approval state with auditability."
        actions={
          <Link to="/exceptions" className={buttonStyles.secondary}>
            Back to Exceptions
          </Link>
        }
      />

      {statusMessage ? (
        <div className="surface-card border-green-500/20 bg-green-500/10 text-green-200 flex items-center justify-between gap-4">
          <span>{statusMessage}</span>
          <button
            type="button"
            className="text-xs font-bold uppercase tracking-widest text-green-100"
            onClick={() => setStatusMessage('')}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {error && (
        <div className="surface-card border-red-500/20 bg-red-500/10 text-primary flex items-center justify-between gap-4">
          <span className="font-medium">{error}</span>
          <Link to="/exceptions" className={buttonStyles.secondary}>
            Back
          </Link>
        </div>
      )}

      {loading ? (
        <SectionCard>
          <TableSkeleton columns={2} rows={6} />
        </SectionCard>
      ) : !record ? (
        <EmptyState
          title="Exception record not found"
          description="The requested record could not be loaded."
        />
      ) : (
        <div className="space-y-6">
          {isLocked ? (
            <div className="surface-card border-cyan-500/20 bg-cyan-500/10 text-cyan-100 flex items-center justify-between gap-4">
              <span>Approved records are locked for audit safety. Reopen flow is not enabled yet.</span>
              <span className="text-xs font-bold uppercase tracking-widest">Read Only</span>
            </div>
          ) : null}

          <SectionCard title="Overview">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Status</div>
                <div className="mt-2">
                  <WorkflowStatusBadges
                    status={record.status}
                    valuationStatus={valuation.valuation_status}
                    workflowState={workflowState}
                  />
                </div>
              </div>
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Confidence</div>
                <div className="mt-2 text-2xl font-bold text-heading">{formatConfidence(record.confidence)}%</div>
              </div>
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Validation warnings</div>
                <div className="mt-2 text-2xl font-bold text-heading">{currentValidationWarnings.length}</div>
              </div>
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Valuation warnings</div>
                <div className="mt-2 text-2xl font-bold text-heading">{currentValuationWarnings.length}</div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Correction Metadata">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Corrected By</div>
                <div className="mt-2 text-primary">{record.correctedBy ? String(record.correctedBy) : '-'}</div>
              </div>
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Corrected At</div>
                <div className="mt-2 text-primary">{record.correctedAt ? formatDateTime(record.correctedAt) : '-'}</div>
              </div>
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Approved By</div>
                <div className="mt-2 text-primary">{record.approvedBy ? String(record.approvedBy) : '-'}</div>
              </div>
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Approved At</div>
                <div className="mt-2 text-primary">{record.approvedAt ? formatDateTime(record.approvedAt) : '-'}</div>
              </div>
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Reviewed By</div>
                <div className="mt-2 text-primary">{record.reviewedBy ? String(record.reviewedBy) : '-'}</div>
              </div>
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Reviewed At</div>
                <div className="mt-2 text-primary">{record.reviewedAt ? formatDateTime(record.reviewedAt) : '-'}</div>
              </div>
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Validation State</div>
                <div className="mt-2 text-primary">{record.validation?.status || '-'}</div>
              </div>
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Valuation State</div>
                <div className="mt-2 text-primary">{record.valuation?.valuation_status || '-'}</div>
              </div>
              <div className="rounded-2xl surface-panel-soft panel-border p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">Workflow State</div>
                <div className="mt-2 text-primary">{workflowState || '-'}</div>
              </div>
            </div>
          </SectionCard>

          <ExceptionRawPanel rawQr={record.raw_qr || record.raw} />

          <ExceptionParsedPanel fields={readOnlyFields} data={parsedDisplayData} />

          <SectionCard title="Correction Diff">
            <ExceptionDiffTable rows={comparisonRows} />
          </SectionCard>

          <ExceptionCorrectionPanel
            editableFields={EDITABLE_FIELDS}
            formValues={formValues}
            correctionNote={correctionNote}
            onFormChange={onFormChange}
            normalizeField={normalizeField}
            onCorrectionNoteChange={setCorrectionNote}
            onSaveCorrections={handleSaveCorrections}
            onApprove={handleApprove}
            onMarkReviewed={handleMarkReviewed}
            savingAction={savingAction}
            isLocked={isLocked}
          />

          <ExceptionValuationPanel
            valuation={record.valuation}
            currentWarnings={currentValuationWarnings}
            originalWarnings={originalValuationWarnings}
            status={record.status}
            workflowState={workflowState}
            correctionNote={record.correction_note}
          />

          <ExceptionValidationPanel
            originalWarnings={originalValidationWarnings}
            currentWarnings={currentValidationWarnings}
          />
        </div>
      )}
    </div>
  )
}
