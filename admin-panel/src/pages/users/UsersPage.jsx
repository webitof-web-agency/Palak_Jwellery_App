import { useCallback, useEffect, useMemo, useState } from 'react'
import { usersApi } from '../../api/users.api'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import EmptyState from '../../components/ui/EmptyState'
import TableSkeleton from '../../components/ui/TableSkeleton'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import UserRow from './components/UserRow'
import AddUserModal from './components/AddUserModal'
import DeleteUserDialog from './components/DeleteUserDialog'

const PAGE_SIZE = 10

const roleOptions = [
  { label: 'All', value: '' },
  { label: 'Salesmen', value: 'salesmen' },
  { label: 'Admins', value: 'admins' },
]

const initialFormData = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'salesman',
}

const normalizeUsersResponse = (response) => {
  if (Array.isArray(response?.data)) {
    return {
      users: response.data,
      pagination: response.pagination || null,
    }
  }

  if (Array.isArray(response)) {
    return {
      users: response,
      pagination: null,
    }
  }

  return {
    users: [],
    pagination: null,
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [formData, setFormData] = useState(initialFormData)

  const debouncedSearchTerm = useDebouncedValue(searchTerm.trim(), 300)

  const fetchUsers = useCallback(async ({ q, role, page: currentPage }) => {
    setLoading(true)
    setError(null)

    try {
      const res = await usersApi.listUsers({
        q: q || undefined,
        role: role || undefined,
        page: currentPage,
        limit: PAGE_SIZE,
      })

      const { users: nextUsers, pagination } = normalizeUsersResponse(res)
      setUsers(nextUsers)

      if (pagination) {
        setTotal(Number(pagination.total) || 0)
        setPages(Number(pagination.pages) || 1)
        setPage(Number(pagination.page) || currentPage)
      } else {
        setTotal(nextUsers.length)
        setPages(1)
        setPage(1)
      }
    } catch {
      setError('Failed to fetch user directory')
      setUsers([])
      setTotal(0)
      setPages(1)
    } finally {
      setLoading(false)
      setHasLoadedOnce(true)
    }
  }, [])

  useEffect(() => {
    setPage((current) => (current === 1 ? current : 1))
  }, [debouncedSearchTerm, roleFilter])

  useEffect(() => {
    void fetchUsers({
      q: debouncedSearchTerm,
      role: roleFilter,
      page,
    })
  }, [debouncedSearchTerm, fetchUsers, page, roleFilter])

  const showInitialLoading = loading && !hasLoadedOnce
  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endIndex = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total)

  const selectedRoleLabel = useMemo(
    () => roleOptions.find((option) => option.value === roleFilter)?.label || 'All',
    [roleFilter],
  )

  const handleToggleStatus = async (id) => {
    try {
      const res = await usersApi.toggleStatus(id)
      if (res.success) {
        setUsers((current) => current.map((user) => (user._id === id ? res.data : user)))
      }
    } catch (err) {
      alert(err.error || err.message || 'Failed to toggle status')
    }
  }

  const handleDeleteUser = (id, name) => {
    setPendingDelete({ id, name })
  }

  const confirmDeleteUser = async () => {
    if (!pendingDelete) return

    setIsDeleting(true)

    try {
      const res = await usersApi.deleteUser(pendingDelete.id)
      if (res.success) {
        setUsers((current) =>
          current.map((user) => (user._id === pendingDelete.id ? { ...user, isActive: false } : user)),
        )
        setPendingDelete(null)
      }
    } catch (err) {
      alert(err.error || err.message || 'Failed to deactivate user')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAddUser = async (event) => {
    event.preventDefault()
    setIsSaving(true)

    try {
      const res = await usersApi.createUser(formData)
      if (res.success) {
        setUsers((current) => [res.data, ...current])
        setShowAddModal(false)
        setFormData(initialFormData)
      }
    } catch (err) {
      alert(err.error || err.message || 'Failed to create user')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Staff Management"
        title="User Directory"
        description="Manage administrative access and salesman accounts for the mobile application."
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="primary-luxury-button text-on-accent"
            aria-label="Add new user"
          >
            Add New User
          </button>
        }
      />

      <SectionCard className="!p-0 overflow-hidden">
        <div className="surface-panel-faint border-b border-[var(--jsm-border)] px-6 py-5 space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-display text-heading">
                  Search users
                </h2>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full surface-panel-soft panel-border text-muted hover:text-primary hover:border-gold-500/30 hover:bg-gold-500/10"
                  title="Search by name, email, or phone number."
                  aria-label="Search help"
                >
                  i
                </button>
              </div>
              <p className="mt-1 text-sm text-muted">
                Find users by name, email, or phone number.
              </p>
            </div>
            <div className="w-full max-w-xl">
              <input
                className="input"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, email, or phone"
                aria-label="Search users"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {roleOptions.map((option) => {
              const isActive = roleFilter === option.value
              return (
                <button
                  key={option.value || 'all'}
                  type="button"
                  onClick={() => setRoleFilter(option.value)}
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
          <div className="px-8 py-8">
            <TableSkeleton columns={5} rows={5} />
          </div>
        ) : error ? (
          <EmptyState title="Could not load users" description={error} className="px-8" />
        ) : users.length === 0 ? (
          <EmptyState
            title="No users found"
            description={
              searchTerm || roleFilter
                ? 'Try a different search or clear the selected role filter.'
                : 'Create the first admin or salesman account to begin.'
            }
            className="px-8"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="surface-panel-faint">
                    <th className="px-8 py-5 text-[10px] tracking-widest uppercase text-heading font-bold">
                      User Profile
                    </th>
                    <th className="px-8 py-5 text-[10px] tracking-widest uppercase text-heading font-bold">
                      Account Role
                    </th>
                    <th className="px-8 py-5 text-[10px] tracking-widest uppercase text-heading font-bold">
                      Status
                    </th>
                    <th className="px-8 py-5 text-[10px] tracking-widest uppercase text-heading font-bold">
                      Joined
                    </th>
                    <th className="px-8 py-5 text-[10px] tracking-widest uppercase text-heading font-bold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--jsm-border)]">
                  {users.map((user) => (
                    <UserRow
                      key={user._id}
                      user={user}
                      onToggleStatus={handleToggleStatus}
                      onDelete={handleDeleteUser}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--jsm-border)] px-6 py-5 text-sm text-muted lg:flex-row lg:items-center lg:justify-between">
              <div>
                Showing {startIndex}-{endIndex} of {total} users
                <span className="ml-2 text-[10px] uppercase tracking-widest text-heading font-bold">
                  {selectedRoleLabel}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="secondary-luxury-button text-on-accent disabled:opacity-50"
                  disabled={loading || page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  aria-label="Previous users page"
                >
                  Previous
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest text-heading">
                  Page {page} of {pages}
                </span>
                <button
                  type="button"
                  className="secondary-luxury-button text-on-accent disabled:opacity-50"
                  disabled={loading || page >= pages}
                  onClick={() => setPage((current) => Math.min(pages, current + 1))}
                  aria-label="Next users page"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      <AddUserModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddUser}
        formData={formData}
        setFormData={setFormData}
        isSaving={isSaving}
      />

      <DeleteUserDialog
        open={Boolean(pendingDelete)}
        userName={pendingDelete?.name}
        isDeleting={isDeleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDeleteUser}
      />
    </div>
  )
}

