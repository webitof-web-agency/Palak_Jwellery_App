import { createPortal } from "react-dom";
import PasswordField from "../../../components/ui/PasswordField"

export default function AddUserModal({
  open,
  onClose,
  onSubmit,
  formData,
  setFormData,
  isSaving,
}) {
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-start sm:items-center justify-center overflow-y-auto p-4 sm:p-6 bg-[var(--jsm-overlay-strong)] backdrop-blur-2xl saturate-150">
      <div className="w-full max-w-2xl my-4 max-h-[calc(100vh-2rem)] overflow-y-auto p-8 md:p-10 rounded-[28px] border border-[var(--jsm-border-strong)] bg-[color-mix(in_srgb,var(--jsm-surface)_84%,transparent)] backdrop-blur-3xl shadow-[0_24px_80px_rgba(0,0,0,0.18)] animate-zoom-in duration-300 text-primary">
        <h2 className="text-2xl font-bold font-display text-heading uppercase tracking-tight mb-2">
          Create Account
        </h2>
        <p className="text-muted text-sm mb-8">
          Establish a new credential for administrative or sales operations.
        </p>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <label className="field-label">Email Identity</label>
            <input
              required
              type="email"
              className="input"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
            />
          </div>

          <PasswordField
            label="Initial Password"
            value={formData.password}
            onChange={(event) => setFormData({ ...formData, password: event.target.value })}
            placeholder="Create a secure password"
            autoComplete="new-password"
            required
          />

          <div className="flex gap-4 pt-4 border-t panel-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-heading transition-all surface-panel-faint hover:bg-[var(--jsm-surface-strong)] rounded-2xl"
              aria-label="Cancel creating user"
            >
              Cancel
            </button>
            <button
              disabled={isSaving}
              type="submit"
              className="flex-[2] primary-luxury-button text-on-accent"
              aria-label="Create user"
            >
              {isSaving ? 'Establishing Account...' : 'Generate user'}
            </button>
          </div>
        </form>
      </div>
    </div>
    ,
    document.body,
  )
}
