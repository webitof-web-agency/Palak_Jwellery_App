import { useState, useEffect } from 'react'
import { usersApi } from '../../api/users.api'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'salesman'
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await usersApi.listUsers()
      if (res.success) setUsers(res.data)
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
        setUsers(users.map(u => u._id === id ? res.data : u))
      }
    } catch (err) {
      alert(err.error || err.message || 'Failed to toggle status')
    }
  }

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Deactivate ${name}? They will lose app access immediately.`)) return
    try {
      const res = await usersApi.deleteUser(id)
      if (res.success) {
        setUsers(users.map(u => u._id === id ? { ...u, isActive: false } : u))
      }
    } catch (err) {
      alert(err.error || err.message || 'Failed to deactivate user')
    }
  }

  const handleAddUser = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await usersApi.createUser(formData)
      if (res.success) {
        setUsers([res.data, ...users])
        setShowAddModal(false)
        setFormData({ name: '', email: '', password: '', role: 'salesman' })
      }
    } catch (err) {
      alert(err.error || err.message || 'Failed to create user')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="page-shell space-y-8">
      <header className="page-hero">
        <div>
          <span className="eyebrow">Staff Management</span>
          <h1 className="text-4xl font-bold font-display gold-gradient-text tracking-tight uppercase">User Directory</h1>
          <p className="text-white/40 mt-1">Manage administrative access and salesman accounts for the mobile application.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="primary-luxury-button"
        >
          Add New User
        </button>
      </header>

      {/* User List Table */}
      <div className="surface-card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-dark-900/50">
                <th className="px-8 py-5 text-[10px] tracking-widest uppercase text-white/30 font-bold">User Profile</th>
                <th className="px-8 py-5 text-[10px] tracking-widest uppercase text-white/30 font-bold">Account Role</th>
                <th className="px-8 py-5 text-[10px] tracking-widest uppercase text-white/30 font-bold">Status</th>
                <th className="px-8 py-5 text-[10px] tracking-widest uppercase text-white/30 font-bold">Joined</th>
                <th className="px-8 py-5 text-[10px] tracking-widest uppercase text-white/30 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan="5" className="px-8 py-20 text-center text-white/20 uppercase text-[10px] font-bold tracking-widest">Loading directory...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="5" className="px-8 py-20 text-center text-white/20 italic">No users identified.</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id} className="hover:bg-white/[0.02] transition-all group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-dark-800 to-dark-950 border border-white/10 flex items-center justify-center font-bold text-gold-500 uppercase">
                          {user.name[0]}
                        </div>
                        <div>
                          <div className="text-white/90 font-bold">{user.name}</div>
                          <div className="text-[10px] text-white/20 font-bold">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${
                        user.role === 'admin' 
                          ? 'bg-gold-500/10 text-gold-500 border-gold-500/20' 
                          : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <button 
                        onClick={() => handleToggleStatus(user._id)}
                        className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                          user.isActive ? 'text-green-500 hover:text-green-400' : 'text-white/20 hover:text-white/40'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-white/10'}`} />
                        {user.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-8 py-5 text-white/40 text-[10px] font-bold uppercase tracking-widest">
                      {new Date(user.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button 
                        onClick={() => handleDeleteUser(user._id, user.name)}
                        className="text-[10px] uppercase font-bold tracking-widest text-red-500/40 hover:text-red-500 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/45 backdrop-blur-xl animate-fade-in duration-300">
          <div className="glass-panel w-full max-w-lg p-10 overflow-hidden premium-shadow animate-zoom-in duration-300">
            <h2 className="text-2xl font-bold font-display gold-gradient-text uppercase tracking-tight mb-2">Create Account</h2>
            <p className="text-white/40 text-sm mb-8">Establish a new credential for administrative or sales operations.</p>
            
            <form onSubmit={handleAddUser} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="field">
                  <label className="field-label">Full Name</label>
                  <input 
                    required
                    type="text" 
                    className="input" 
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="field">
                  <label className="field-label">Account Role</label>
                  <select 
                    className="input"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="salesman">Salesman</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>
              
              <div className="field">
                <label className="field-label">Email Identity</label>
                <input 
                  required
                  type="email" 
                  className="input" 
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div className="field">
                <label className="field-label">Initial Password</label>
                <input 
                  required
                  type="password" 
                  className="input" 
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-white/5">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-all bg-white/5 rounded-2xl"
                >
                  Cancel
                </button>
                <button 
                  disabled={isSaving}
                  type="submit"
                  className="flex-[2] primary-luxury-button"
                >
                  {isSaving ? 'Establishing Account...' : 'Generate user'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
