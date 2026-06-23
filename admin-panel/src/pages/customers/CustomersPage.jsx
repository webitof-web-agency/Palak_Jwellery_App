import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { customersApi } from '../../api/customers.api'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import TableSkeleton from '../../components/ui/TableSkeleton'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import CustomerArchiveDialog from './components/CustomerArchiveDialog'
import CustomerFormModal from './components/CustomerFormModal'

const PAGE_SIZE = 10
const PHONE_REGEX = /^\d{10}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'With Sales', value: 'withSales' },
  { label: 'Without Sales', value: 'withoutSales' },
  { label: 'Archived', value: 'archived' },
]

const emptyFormData = {
  name: '',
  phone: '',
  area: '',
  email: '',
}

const initialStats = {
  total: 0,
  active: 0,
  withSales: 0,
  withoutSales: 0,
  archived: 0,
}

const normalizeCustomersResponse = (response) => {
  if (Array.isArray(response?.data)) {
    return {
      customers: response.data,
      pagination: response.pagination || null,
    }
  }

  if (Array.isArray(response)) {
    return {
      customers: response,
      pagination: null,
    }
  }

  return {
    customers: [],
    pagination: null,
  }
}

const normalizeText = (value) => String(value || '').trim()
const sanitizePhone = (value) => normalizeText(value).replace(/\D/g, '').slice(0, 10)

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

const getListQuery = (statusFilter) => {
  if (statusFilter === 'archived') {
    return { archived: 'archived' }
  }

  const hasSessions =
    statusFilter === 'withSales'
      ? 'yes'
      : statusFilter === 'withoutSales'
        ? 'no'
        : undefined

  return {
    archived: 'active',
    hasSessions,
  }
}

const formatMetric = (value, fallback = '0') => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? String(numeric) : fallback
}

const buildStatusMeta = (customer) => {
  if (customer?.isArchived) {
    return {
      label: 'Archived',
      tone: 'danger',
      helper: customer.archiveReason || 'Hidden from normal workflow',
    }
  }

  return {
    label: 'Active',
    tone: 'success',
    helper: customer?.sessionCount > 0 ? 'With sales history' : 'No sales yet',
  }
}

const statusToneClasses = {
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
  danger: 'border-red-500/25 bg-red-500/10 text-red-100',
  muted: 'border-white/10 bg-white/5 text-muted',
}

const smallBadgeClasses =
  'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest'

export default function CustomersPage() {
  const navigate = useNavigate()

  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    pages: 1,
    total: 0,
  })
  const [stats, setStats] = useState(initialStats)
  const [statsLoading, setStatsLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('add')
  const [formData, setFormData] = useState(emptyFormData)
  const [formErrors, setFormErrors] = useState([])
  const [formSaving, setFormSaving] = useState(false)
  const [activeCustomer, setActiveCustomer] = useState(null)

  const [archiveTarget, setArchiveTarget] = useState(null)
  const [archiveStep, setArchiveStep] = useState(1)
  const [archiveReason, setArchiveReason] = useState('')
  const [archiveConfirmText, setArchiveConfirmText] = useState('')
  const [archiveSubmitting, setArchiveSubmitting] = useState(false)

  const debouncedSearchTerm = useDebouncedValue(searchTerm.trim(), 300)

  const selectedFilterLabel = useMemo(
    () => filterOptions.find((option) => option.value === statusFilter)?.label || 'All',
    [statusFilter],
  )

  const fetchCustomers = useCallback(
    async ({ currentPage = page, query = debouncedSearchTerm, filter = statusFilter } = {}) => {
      setLoading(true)
      setError(null)

      try {
        const res = await customersApi.listCustomers({
          q: query || undefined,
          ...getListQuery(filter),
          page: currentPage,
          limit: PAGE_SIZE,
        })

        const { customers: nextCustomers, pagination: nextPagination } = normalizeCustomersResponse(res)
        setCustomers(nextCustomers)

        if (nextPagination) {
          setPagination({
            page: Number(nextPagination.page) || currentPage,
            limit: Number(nextPagination.limit) || PAGE_SIZE,
            pages: Number(nextPagination.pages) || 1,
            total: Number(nextPagination.total) || 0,
          })
          setPage(Number(nextPagination.page) || currentPage)
        } else {
          setPagination({
            page: currentPage,
            limit: PAGE_SIZE,
            pages: 1,
            total: nextCustomers.length,
          })
        }
      } catch (fetchError) {
        setError(fetchError?.error || fetchError?.message || 'Failed to fetch customers')
        setCustomers([])
        setPagination({
          page: 1,
          limit: PAGE_SIZE,
          pages: 1,
          total: 0,
        })
      } finally {
        setLoading(false)
        setHasLoadedOnce(true)
      }
    },
    [debouncedSearchTerm, page, statusFilter],
  )

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)

    try {
      const readTotal = async (params) => {
        const res = await customersApi.listCustomers({
          ...params,
          page: 1,
          limit: 1,
        })

        if (res?.pagination?.total !== undefined && res?.pagination?.total !== null) {
          return Number(res.pagination.total) || 0
        }

        const { customers: items } = normalizeCustomersResponse(res)
        return items.length
      }

      const [total, active, withSales, withoutSales, archived] = await Promise.all([
        readTotal({ archived: 'all' }),
        readTotal({ archived: 'active' }),
        readTotal({ archived: 'active', hasSessions: 'yes' }),
        readTotal({ archived: 'active', hasSessions: 'no' }),
        readTotal({ archived: 'archived' }),
      ])

      setStats({ total, active, withSales, withoutSales, archived })
    } catch {
      setStats(initialStats)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const refreshData = useCallback(
    async ({ nextPage = page, query = debouncedSearchTerm, filter = statusFilter } = {}) => {
      await Promise.all([
        fetchCustomers({ currentPage: nextPage, query, filter }),
        fetchStats(),
      ])
    },
    [debouncedSearchTerm, fetchCustomers, fetchStats, page, statusFilter],
  )

  useEffect(() => {
    setPage((current) => (current === 1 ? current : 1))
  }, [debouncedSearchTerm, statusFilter])

  useEffect(() => {
    void fetchCustomers({ currentPage: page, query: debouncedSearchTerm, filter: statusFilter })
  }, [debouncedSearchTerm, fetchCustomers, page, statusFilter])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  const total = pagination.total || 0
  const startIndex = total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1
  const endIndex = total === 0 ? 0 : Math.min(pagination.page * pagination.limit, total)
  const showInitialLoading = loading && !hasLoadedOnce

  const validateForm = (data) => {
    const nextErrors = []
    const nextPayload = {
      name: normalizeText(data.name),
      phone: sanitizePhone(data.phone),
      area: normalizeText(data.area),
      email: normalizeText(data.email).toLowerCase(),
    }

    if (!nextPayload.name) nextErrors.push('Customer name is required')
    if (!nextPayload.phone) nextErrors.push('Customer phone is required')
    else if (!PHONE_REGEX.test(nextPayload.phone)) nextErrors.push('Phone must be exactly 10 digits')
    if (!nextPayload.area) nextErrors.push('Customer area is required')
    if (nextPayload.email && !EMAIL_REGEX.test(nextPayload.email)) nextErrors.push('Invalid email address')

    return {
      errors: nextErrors,
      payload: {
        ...nextPayload,
        email: nextPayload.email || null,
      },
    }
  }

  const openAddCustomer = () => {
    setFormMode('add')
    setActiveCustomer(null)
    setFormData(emptyFormData)
    setFormErrors([])
    setFormOpen(true)
  }

  const openEditCustomer = (customer) => {
    setFormMode('edit')
    setActiveCustomer(customer)
    setFormData({
      name: customer?.name || '',
      phone: customer?.phone || '',
      area: customer?.area || '',
      email: customer?.email || '',
    })
    setFormErrors([])
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setFormErrors([])
    setFormSaving(false)
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault()

    const { errors, payload } = validateForm(formData)
    if (errors.length > 0) {
      setFormErrors(errors)
      return
    }

    setFormSaving(true)
    setFormErrors([])

    try {
      if (formMode === 'edit' && activeCustomer?._id) {
        await customersApi.updateCustomer(activeCustomer._id, payload)
      } else {
        await customersApi.createCustomer(payload)
      }

      closeForm()
      if (formMode === 'add') {
        setPage(1)
        await refreshData({ nextPage: 1, query: debouncedSearchTerm, filter: statusFilter })
      } else {
        await refreshData({ nextPage: page, query: debouncedSearchTerm, filter: statusFilter })
      }
    } catch (submitError) {
      const nextErrors = Array.isArray(submitError?.details)
        ? submitError.details
        : [submitError?.error || submitError?.message || 'Failed to save customer']
      setFormErrors(nextErrors)
    } finally {
      setFormSaving(false)
    }
  }

  const openArchiveCustomer = (customer) => {
    setArchiveTarget(customer)
    setArchiveStep(1)
    setArchiveReason('')
    setArchiveConfirmText('')
  }

  const closeArchive = () => {
    setArchiveTarget(null)
    setArchiveStep(1)
    setArchiveReason('')
    setArchiveConfirmText('')
    setArchiveSubmitting(false)
  }

  const confirmArchive = async () => {
    if (!archiveTarget) return

    setArchiveSubmitting(true)

    try {
      await customersApi.archiveCustomer(archiveTarget._id, {
        confirm: true,
        reason: archiveReason.trim() || undefined,
        archiveReason: archiveReason.trim() || undefined,
      })
      closeArchive()
      await refreshData({ nextPage: page, query: debouncedSearchTerm, filter: statusFilter })
    } catch (archiveError) {
      window.alert(archiveError?.error || archiveError?.message || 'Failed to archive customer')
    } finally {
      setArchiveSubmitting(false)
    }
  }

  const renderStatusCell = (customer) => {
    const status = buildStatusMeta(customer)
    const salesTone = customer?.sessionCount > 0 ? 'success' : 'muted'

    return (
      <div className="space-y-2">
        <span className={`${smallBadgeClasses} ${statusToneClasses[status.tone] || statusToneClasses.muted}`}>
          {status.label}
        </span>
        <div className={`${smallBadgeClasses} ${statusToneClasses[salesTone] || statusToneClasses.muted}`}>
          {customer?.sessionCount > 0 ? 'With Sales' : 'No Sales'}
        </div>
      </div>
    )
  }

  const renderCustomerRow = (customer) => {
    const status = buildStatusMeta(customer)

    return (
      <tr key={customer._id} className="border-t border-[var(--jsm-border)] align-top">
        <td className="px-6 py-5">
          <div className="font-bold text-primary">{customer.name || '-'}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest">
            <span className={`${smallBadgeClasses} ${statusToneClasses[status.tone] || statusToneClasses.muted}`}>
              {status.label}
            </span>
            <span className={`${smallBadgeClasses} ${statusToneClasses[customer?.sessionCount > 0 ? 'success' : 'muted'] || statusToneClasses.muted}`}>
              {customer?.sessionCount > 0 ? 'With Sales' : 'No Sales'}
            </span>
          </div>
          <div className="mt-2 break-words text-xs text-muted">{customer.email || 'Email not provided'}</div>
        </td>
        <td className="px-6 py-5 text-sm text-primary whitespace-nowrap">{customer.phone || '-'}</td>
        <td className="px-6 py-5 text-sm text-primary">{customer.area || '-'}</td>
        <td className="px-6 py-5 text-sm text-primary whitespace-nowrap">
          <div className="font-bold">{formatMetric(customer.sessionCount)}</div>
          <div className="text-xs text-muted">{formatMetric(customer.totalItems)} items</div>
        </td>
        <td className="px-6 py-5 text-sm text-primary whitespace-nowrap">{formatDate(customer.lastSessionAt)}</td>
        <td className="px-6 py-5 text-sm text-primary whitespace-nowrap">{formatDate(customer.createdAt)}</td>
        <td className="px-6 py-5 text-sm text-primary">{renderStatusCell(customer)}</td>
        <td className="px-6 py-5 text-right">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="secondary-luxury-button px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-accent"
              onClick={() => navigate(`/customers/${customer._id}`)}
            >
              View
            </button>
            <button
              type="button"
              className="secondary-luxury-button px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-accent"
              onClick={() => openEditCustomer(customer)}
            >
              Edit
            </button>
            <button
              type="button"
              className="secondary-luxury-button px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-accent"
              onClick={() => openArchiveCustomer(customer)}
            >
              Archive
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Customer Management"
        title="Customers"
        description="Manage customer records, session history, and archive state from a single admin view."
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshData({ nextPage: page, query: debouncedSearchTerm, filter: statusFilter })}
              className="secondary-luxury-button text-on-accent"
              disabled={loading || statsLoading}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={openAddCustomer}
              className="primary-luxury-button text-on-accent"
            >
              Add Customer
            </button>
          </div>
        }
      />

      <SectionCard title="Customer Overview" description="High-level counts from the customer module.">
        <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Total Customers', value: stats.total, helper: 'All customer records' },
            { label: 'Active Customers', value: stats.active, helper: 'Visible in normal workflow' },
            { label: 'With Sales', value: stats.withSales, helper: 'Active customers with sessions' },
            { label: 'Without Sales', value: stats.withoutSales, helper: 'Active customers without sessions' },
            { label: 'Archived', value: stats.archived, helper: 'Hidden from normal workflow' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[22px] border border-[var(--jsm-border)] surface-panel-soft p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-heading">{stat.label}</div>
              <div className="mt-2 text-3xl font-bold text-primary">{statsLoading ? '—' : formatMetric(stat.value)}</div>
              <div className="mt-2 text-xs text-muted">{stat.helper}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard className="!p-0 overflow-hidden" title="Customer List" description="Search, filter, and manage customer records.">
        <div className="border-b border-[var(--jsm-border)] surface-panel-faint px-6 py-5 space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-bold font-display text-heading">Search customers</h2>
              <p className="mt-1 text-sm text-muted">Search by name, phone, area, or email.</p>
            </div>

            <div className="w-full xl:max-w-xl">
              <input
                className="input"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, phone, area, or email"
                aria-label="Search customers"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => {
              const isActive = statusFilter === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${isActive ? 'border-gold-500/50 bg-gold-500/10 text-gold-500' : 'surface-panel-soft panel-border text-muted hover:text-primary hover:border-gold-500/30 hover:bg-gold-500/10'}`}
                  aria-pressed={isActive}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        {showInitialLoading ? (
          <div className="px-6 py-6">
            <TableSkeleton columns={8} rows={5} />
          </div>
        ) : error ? (
          <EmptyState title="Could not load customers" description={error} className="px-8" />
        ) : customers.length === 0 ? (
          <EmptyState
            title="No customers found"
            description={
              debouncedSearchTerm || statusFilter !== 'all'
                ? 'Try a different search or clear the selected filter.'
                : 'Add the first customer to begin managing records.'
            }
            className="px-8"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full text-left">
                <thead>
                  <tr className="surface-panel-faint">
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Customer Name</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Phone</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Area</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Total Sessions / Sales</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Last Sale Date</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Created Date</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold">Status</th>
                    <th className="px-6 py-4 text-[10px] tracking-widest uppercase text-heading font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--jsm-border)]">
                  {customers.map(renderCustomerRow)}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--jsm-border)] px-6 py-5 text-sm text-muted lg:flex-row lg:items-center lg:justify-between">
              <div>
                Showing {startIndex}-{endIndex} of {total} customers
                <span className="ml-2 text-[10px] uppercase tracking-widest text-heading font-bold">{selectedFilterLabel}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="secondary-luxury-button text-on-accent disabled:opacity-50"
                  disabled={loading || pagination.page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  aria-label="Previous customers page"
                >
                  Previous
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest text-heading">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  type="button"
                  className="secondary-luxury-button text-on-accent disabled:opacity-50"
                  disabled={loading || pagination.page >= pagination.pages}
                  onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}
                  aria-label="Next customers page"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      <CustomerFormModal
        open={formOpen}
        mode={formMode}
        formData={formData}
        setFormData={setFormData}
        errors={formErrors}
        isSaving={formSaving}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
      />

      <CustomerArchiveDialog
        open={Boolean(archiveTarget)}
        customer={archiveTarget}
        step={archiveStep}
        reason={archiveReason}
        confirmText={archiveConfirmText}
        isSubmitting={archiveSubmitting}
        onClose={closeArchive}
        onStepChange={() => setArchiveStep(2)}
        onReasonChange={setArchiveReason}
        onConfirmTextChange={setArchiveConfirmText}
        onConfirm={confirmArchive}
      />
    </div>
  )
}
