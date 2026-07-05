import LogoBadge from '../../../components/ui/LogoBadge'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import PasswordField from '../../../components/ui/PasswordField'
import { createPortal } from 'react-dom'

export default function AddUserModal({
  open,
  onClose,
  onSubmit,
  formData,
  setFormData,
  isSaving,
  mode = 'create',
}) {
  if (!open) return null

  const isEdit = mode === 'edit'
  const title = isEdit ? 'Edit User' : 'Create Account'
  const subtitle = isEdit
    ? 'Update access details for this admin or salesman account.'
    : 'Establish a new credential for administrative or sales operations.'
  const submitLabel = isEdit ? 'Save Changes' : 'Generate User'
  const busyLabel = isEdit ? 'Saving Changes...' : 'Establishing Account...'

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto bg-[var(--jsm-overlay-strong)] p-4 sm:items-center sm:p-6">
      <div className="my-4 w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[28px] border border-[var(--jsm-border-strong)] bg-[var(--jsm-surface)] p-6 text-primary shadow-[0_18px_40px_rgba(0,0,0,0.12)] md:p-8">
        <div className="flex flex-col items-center gap-4 border-b border-[var(--jsm-border)] pb-6 text-center">
          <LogoBadge
            src="/logo-dark.png"
            wrapperClassName="mx-auto h-16 w-16 bg-[var(--jsm-panel-bg)] shadow-[0_0_0_1px_rgba(229,180,99,0.08)]"
          />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-display uppercase tracking-tight text-heading">
              {title}
            </h2>
            <p className="text-sm text-muted">{subtitle}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-6 pt-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="field">
              <label className="field-label">Full Name</label>
              <input
                required
                type="text"
                className="input"
                placeholder="John Doe"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-label">Account Role</label>
              <select
                className="input"
                value={formData.role}
                onChange={(event) => setFormData({ ...formData, role: event.target.value })}
              >
                <option value="salesman">Salesman</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Email Address</label>
            <input
              required
              type="email"
              className="input"
              placeholder="Email address"
              value={formData.email}
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
            />
          </div>

          <div className="field">
            <label className="field-label">Phone Number</label>
            <input
              type="tel"
              className="input"
              placeholder="Optional phone number"
              value={formData.phone || ''}
              onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
            />
          </div>

          <PasswordField
            label={isEdit ? 'New Password (optional)' : 'Initial Password'}
            value={formData.password}
            onChange={(event) => setFormData({ ...formData, password: event.target.value })}
            placeholder={isEdit ? 'Leave blank to keep current password' : 'Create a secure password'}
            autoComplete={isEdit ? 'new-password' : 'new-password'}
            required={!isEdit}
          />

          <div className="flex gap-4 border-t border-[var(--jsm-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl surface-panel-faint py-4 text-[10px] font-bold uppercase tracking-widest text-muted transition-all hover:bg-[var(--jsm-surface-strong)] hover:text-heading"
              aria-label="Cancel user form"
            >
              Cancel
            </button>
            <button
              disabled={isSaving}
              type="submit"
              className="flex-[2] primary-luxury-button text-on-accent"
              aria-label={title}
            >
              {isSaving ? (
                <>
                  <LoadingSpinner />
                  {busyLabel}
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
