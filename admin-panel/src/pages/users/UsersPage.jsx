import { useEffect, useState } from 'react'
import { usersApi } from '../../api/users.api'
import PageHeader from '../../components/ui/PageHeader'
import SectionCard from '../../components/ui/SectionCard'
import EmptyState from '../../components/ui/EmptyState'
import TableSkeleton from '../../components/ui/TableSkeleton'
import UserRow from './components/UserRow'
import AddUserModal from './components/AddUserModal'
import DeleteUserDialog from './components/DeleteUserDialog'

const initialFormData = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'salesman',
}

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [formData, setFormData] = useState(initialFormData)

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchUsers(searchTerm)
    }, 250)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchUsers = async (query = '') => {
    setLoading(true)
    setError(null)

    try {
      const res = await usersApi.listUsers(query ? { q: query } : undefined)
      if (res.success) {
        setUsers(Array.isArray(res.data) ? res.data : [])
      } else {
        setError('Failed to fetch user directory')
      }
    } catch (err) {
      setError('Failed to fetch user directory')
    } finally {
      setLoading(false)
    }
  }

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
      {/* Page header */}
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

      {/* Users table */}
      <SectionCard className="!p-0 overflow-hidden">
        <div className="surface-panel-faint border-b border-white/10 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-display text-heading">
                  Search users
                </h2>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted hover:text-primary hover:border-gold-500/30 hover:bg-white/10"
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
        </div>

        {loading ? (
          <div className="px-8 py-8">
            <TableSkeleton columns={5} rows={5} />
          </div>
        ) : error ? (
          <EmptyState title="Could not load users" description={error} className="px-8" />
        ) : users.length === 0 ? (
          <EmptyState
            title="No users yet"
            description="Create the first admin or salesman account to begin."
            className="px-8"
          />
        ) : (
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
              <tbody className="divide-y divide-white/5">
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
        )}
      </SectionCard>

      {/* Add user modal */}
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
