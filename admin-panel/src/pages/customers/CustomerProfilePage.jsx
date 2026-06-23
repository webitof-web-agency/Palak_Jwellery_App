import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { customersApi } from '../../api/customers.api'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import SectionCard from '../../components/ui/SectionCard'
import { formatDateTime, formatWeight } from '../../utils/formatters'
import CustomerArchiveDialog from './components/CustomerArchiveDialog'
import CustomerFormModal from './components/CustomerFormModal'

const emptyFormData = {
  name: '',
  phone: '',
  area: '',
  email: '',
}

const tabs = [
  { label: 'Overview', value: 'overview' },
  { label: 'Sales History', value: 'history' },
]

const statusMeta = (customer) => {
  if (customer?.isArchived) {
    return {
      label: 'Archived',
      tone: 'danger',
      helper: customer.archiveReason || 'Archived from normal workflow',
    }
  }

  return {
    label: 'Active',
    tone: 'success',
    helper: 'Available for normal workflow',
  }
}

const badgeTone = {
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
  danger: 'border-red-500/25 bg-red-500/10 text-red-100',
  muted: 'border-white/10 bg-white/5 text-muted',
}

const smallBadge =
  'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest'

const emptyDetails = {
  customer: null,
  aggregates: {
    totalSessions: 0,
    totalItems: 0,
    totalGross: 0,
    totalNet: 0,
    totalFine: 0,
  },
  history: [],
  salesmanHistory: [],
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}


const toHistoryTableRow = (item) => ({
  id: item?.id || item?._id || item?.reference || null,
  date: item?.date || item?.finalizedAt || item?.submittedAt || item?.createdAt || null,
  salesman: item?.salesmanName || '-',
  itemCount: Number(item?.itemCount || 0) || 0,
  grossWeight: Number(item?.grossWeight || 0) || 0,
  netWeight: Number(item?.netWeight || 0) || 0,
  fineWeight: Number(item?.fineWeight || 0) || 0,
  warnings: Number(item?.warningCount || item?.warningsCount || 0) || 0,
  reference: item?.reference || item?.sessionRef || item?._id || null,
})

export default function CustomerProfilePage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [profile, setProfile] = useState(emptyDetails)
  const [activeTab, setActiveTab] = useState('overview')

  const [formOpen, setFormOpen] = useState(false)
  const [formSaving, setFormSaving] = useState(false)
  const [formErrors, setFormErrors] = useState([])
  const [formData, setFormData] = useState(emptyFormData)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveStep, setArchiveStep] = useState(1)
  const [archiveReason, setArchiveReason] = useState('')
  const [archiveConfirmText, setArchiveConfirmText] = useState('')
  const [archiveSubmitting, setArchiveSubmitting] = useState(false)

  const customer = profile.customer || emptyDetails.customer
  const aggregates = profile.aggregates || emptyDetails.aggregates
  const salesmanHistory = Array.isArray(profile.salesmanHistory) ? profile.salesmanHistory : []
  const isArchived = Boolean(customer?.isArchived)
  const status = statusMeta(customer)

  const loadProfile = useCallback(async () => {
    if (!id) return

    setLoading(true)
    setError(null)

    try {
      const response = await customersApi.getCustomer(id)
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to load customer profile')
      }

      setProfile(response.data || emptyDetails)
    } catch (fetchError) {
      setError(fetchError?.error || fetchError?.message || 'Failed to load customer profile')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const openEdit = () => {
    if (!customer) return

    setFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      area: customer.area || '',
      email: customer.email || '',
    })
    setFormErrors([])
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setFormErrors([])
    setFormSaving(false)
  }

  const validateForm = (data) => {
    const nextErrors = []
    const nextPayload = {
      name: String(data.name || '').trim(),
      phone: String(data.phone || '').replace(/\D/g, '').slice(0, 10),
      area: String(data.area || '').trim(),
      email: String(data.email || '').trim().toLowerCase(),
    }

    if (!nextPayload.name) nextErrors.push('Customer name is required')
    if (!nextPayload.phone) nextErrors.push('Customer phone is required')
    else if (!/^\d{10}$/.test(nextPayload.phone)) nextErrors.push('Phone must be exactly 10 digits')
    if (!nextPayload.area) nextErrors.push('Customer area is required')
    if (nextPayload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextPayload.email)) {
      nextErrors.push('Invalid email address')
    }

    return {
      errors: nextErrors,
      payload: {
        ...nextPayload,
        email: nextPayload.email || null,
      },
    }
  }

  const submitForm = async (event) => {
    event.preventDefault()

    const { errors, payload } = validateForm(formData)
    if (errors.length > 0) {
      setFormErrors(errors)
      return
    }

    setFormSaving(true)
    setFormErrors([])

    try {
      await customersApi.updateCustomer(id, payload)
      closeForm()
      await loadProfile()
    } catch (submitError) {
      const nextErrors = Array.isArray(submitError?.details)
        ? submitError.details
        : [submitError?.error || submitError?.message || 'Failed to update customer']
      setFormErrors(nextErrors)
    } finally {
      setFormSaving(false)
    }
  }

  const openArchive = () => {
    if (!customer) return
    setArchiveStep(1)
    setArchiveReason('')
    setArchiveConfirmText('')
    setArchiveOpen(true)
  }

  const closeArchive = () => {
    setArchiveOpen(false)
    setArchiveStep(1)
    setArchiveReason('')
    setArchiveConfirmText('')
    setArchiveSubmitting(false)
  }

  const submitArchive = async () => {
    if (!customer) return

    setArchiveSubmitting(true)

    try {
      await customersApi.archiveCustomer(id, {
        confirm: true,
        reason: archiveReason.trim() || undefined,
        archiveReason: archiveReason.trim() || undefined,
      })
      closeArchive()
      await loadProfile()
    } catch (archiveError) {
      window.alert(archiveError?.error || archiveError?.message || 'Failed to archive customer')
    } finally {
      setArchiveSubmitting(false)
    }
  }

  const sessionRows = useMemo(() => (Array.isArray(profile.history) ? profile.history : []).map(toHistoryTableRow), [profile.history])

  return (
    <div className="page-shell space-y-8">
      <div className="flex flex-col gap-4 rounded-[28px] border border-[var(--jsm-border)] surface-card p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/customers')}
            className="secondary-luxury-button text-on-accent"
          >
            Back to Customers
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openEdit}
              className="secondary-luxury-button text-on-accent disabled:opacity-50"
              disabled={loading || isArchived}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={openArchive}
              className="secondary-luxury-button text-on-accent"
              disabled={loading || isArchived}
            >
              Archive / Delete
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-44 items-center justify-center rounded-3xl border border-[var(--jsm-border)] surface-panel-soft">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <EmptyState title="Could not load customer" description={error} />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold font-display text-heading">
                    {customer?.name || 'Customer Profile'}
                  </h1>
                  <span className={`${smallBadge} ${badgeTone[status.tone] || badgeTone.muted}`}>
                    {status.label}
                  </span>
                </div>
                <p className="mt-2 text-muted">{status.helper}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Phone', value: customer?.phone || '-' },
                { label: 'Area', value: customer?.area || '-' },
                { label: 'Email', value: customer?.email || '-' },
                { label: 'Last Sale Date', value: formatDate(aggregates.lastSaleDate || customer?.lastSessionAt) },
              ].map((field) => (
                <div key={field.label} className="rounded-[22px] border border-[var(--jsm-border)] surface-panel-soft p-5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-heading">{field.label}</div>
                  <div className="mt-2 text-lg font-bold text-primary break-words">{field.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!loading && !error ? (
        <SectionCard>
          <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-6">
            {[
              { label: 'Total Sessions', value: aggregates.totalSessions || 0 },
              { label: 'Total Items', value: aggregates.totalItems || 0 },
              { label: 'Total Gross', value: formatWeight(aggregates.totalGross || 0) },
              { label: 'Total Net', value: formatWeight(aggregates.totalNet || 0) },
              { label: 'Total Fine', value: formatWeight(aggregates.totalFine || 0) },
              { label: 'Last Sale Date', value: formatDate(aggregates.lastSaleDate || customer?.lastSessionAt) },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[22px] border border-[var(--jsm-border)] surface-panel-soft p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-heading">{stat.label}</div>
                <div className="mt-2 text-2xl font-bold text-primary break-words">{stat.value}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {!loading && !error ? (
        <SectionCard className="!p-0 overflow-hidden">
          <div className="border-b border-[var(--jsm-border)] surface-panel-faint px-6 py-4">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => {
                const active = activeTab === tab.value
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setActiveTab(tab.value)}
                    className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${active ? 'border-gold-500/50 bg-gold-500/10 text-gold-500' : 'surface-panel-soft panel-border text-muted hover:text-primary hover:border-gold-500/30 hover:bg-gold-500/10'}`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {activeTab === 'overview' ? (
            <div className="grid gap-6 p-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-[var(--jsm-border)] surface-panel-soft p-6 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-heading">Customer Details</div>
                <div className="text-lg font-bold text-primary">{customer?.name || '-'}</div>
                <div className="text-sm text-muted">Phone: {customer?.phone || '-'}</div>
                <div className="text-sm text-muted">Area: {customer?.area || '-'}</div>
                <div className="text-sm text-muted">Email: {customer?.email || '-'}</div>
                <div className="text-sm text-muted">Status: {status.label}</div>
                <div className="text-sm text-muted">
                  Relation source: {profile.relationSource || 'none'}
                </div>
                <div className="text-sm text-muted">
                  Last updated: {formatDateTime(customer?.updatedAt || customer?.createdAt)}
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--jsm-border)] surface-panel-soft p-6 space-y-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-heading">Sales Summary</div>
                {aggregates.totalSessions > 0 ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { label: 'Sessions', value: aggregates.totalSessions || 0 },
                        { label: 'Items', value: aggregates.totalItems || 0 },
                        { label: 'Gross', value: formatWeight(aggregates.totalGross || 0) },
                        { label: 'Net', value: formatWeight(aggregates.totalNet || 0) },
                        { label: 'Fine', value: formatWeight(aggregates.totalFine || 0) },
                        { label: 'Salesmen', value: salesmanHistory.length || 0 },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-[var(--jsm-border)] bg-[var(--jsm-surface-strong)] p-4">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-heading">{item.label}</div>
                          <div className="mt-2 text-xl font-bold text-primary">{item.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-[var(--jsm-border)] bg-[var(--jsm-surface-strong)] p-4 text-sm text-muted">
                      This view uses the existing customer detail aggregate payload. Customer sales history remains read-only in this slice.
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="No sales history yet"
                    description="This customer has not been linked to any saved sales sessions yet."
                    className="py-8"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-6">
              {sessionRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-[1040px] w-full text-left">
                    <thead>
                      <tr className="surface-panel-faint">
                        <th className="px-5 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Date</th>
                        <th className="px-5 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Salesman</th>
                        <th className="px-5 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Items</th>
                        <th className="px-5 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Gross</th>
                        <th className="px-5 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Net</th>
                        <th className="px-5 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Fine</th>
                        <th className="px-5 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Warnings</th>
                        <th className="px-5 py-4 text-[10px] tracking-widest uppercase text-heading font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--jsm-border)]">
                      {sessionRows.map((item) => (
                        <tr key={String(item.id)} className="align-top">
                          <td className="px-5 py-4 text-sm text-primary whitespace-nowrap">{formatDate(item.date)}</td>
                          <td className="px-5 py-4 text-sm text-primary">{item.salesman}</td>
                          <td className="px-5 py-4 text-sm text-primary">{item.itemCount}</td>
                          <td className="px-5 py-4 text-sm text-primary">{formatWeight(item.grossWeight)}</td>
                          <td className="px-5 py-4 text-sm text-primary">{formatWeight(item.netWeight)}</td>
                          <td className="px-5 py-4 text-sm text-primary">{formatWeight(item.fineWeight)}</td>
                          <td className="px-5 py-4 text-sm text-primary">{item.warnings}</td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                className="secondary-luxury-button px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-accent"
                                onClick={() => navigate(`/sales?sessionId=${encodeURIComponent(String(item.id || ''))}`)}
                                disabled={!item.id}
                              >
                                View Session
                              </button>
                              <button
                                type="button"
                                className="secondary-luxury-button px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-accent opacity-60"
                                disabled
                                title="Coming soon"
                              >
                                Delete / Archive Session
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No sales history"
                  description="No saved sessions were returned for this customer."
                />
              )}
            </div>
          )}
        </SectionCard>
      ) : null}

      <CustomerFormModal
        open={formOpen}
        mode="edit"
        formData={formData}
        setFormData={setFormData}
        errors={formErrors}
        isSaving={formSaving}
        onClose={closeForm}
        onSubmit={submitForm}
      />

      <CustomerArchiveDialog
        open={archiveOpen}
        customer={customer}
        step={archiveStep}
        reason={archiveReason}
        confirmText={archiveConfirmText}
        isSubmitting={archiveSubmitting}
        onClose={closeArchive}
        onStepChange={() => setArchiveStep(2)}
        onReasonChange={setArchiveReason}
        onConfirmTextChange={setArchiveConfirmText}
        onConfirm={submitArchive}
      />
    </div>
  )
}




