export default function SupplierFormBasicsSection({
  form,
  paymentModes,
  onFormChange,
}) {
  return (
    <section className="surface-panel-soft panel-border rounded-2xl p-5 md:p-6 space-y-5">
      <div>
        <span className="eyebrow">Basic Info</span>
        <h3 className="text-xl font-bold font-display text-heading mt-2">
          Supplier identity
        </h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Keep the supplier profile simple. These fields identify who the supplier is and how the sale is settled.
        </p>
      </div>

      <div className="form-grid">
        <label className="field">
          <span className="field-label">Legal Name</span>
          <input
            className="input"
            value={form.name}
            onChange={(event) => onFormChange('name', event.target.value)}
            placeholder="e.g. Ashok Jewellers"
            aria-label="Legal name"
          />
        </label>

        <label className="field">
          <span className="field-label">Unique Code</span>
          <input
            className="input"
            value={form.code}
            onChange={(event) => onFormChange('code', event.target.value)}
            placeholder="e.g. ASH01"
            aria-label="Unique code"
          />
        </label>

        <label className="field">
          <span className="field-label">GST Number</span>
          <input
            className="input"
            value={form.gst}
            onChange={(event) => onFormChange('gst', event.target.value)}
            placeholder="e.g. 29ABCDE..."
            aria-label="GST number"
          />
        </label>

        <label className="field">
          <span className="field-label">Settlement Mode</span>
          <select
            className="input"
            value={form.paymentMode}
            onChange={(event) => onFormChange('paymentMode', event.target.value)}
            aria-label="Settlement mode"
          >
            {paymentModes.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field mb-0">
        <span className="field-label">Registered Address</span>
        <textarea
          className="input input--textarea"
          rows="5"
          value={form.address}
          onChange={(event) => onFormChange('address', event.target.value)}
          placeholder="Physical storage or billing address"
          aria-label="Registered address"
        />
      </label>

      <div className="rounded-2xl surface-panel-faint panel-border p-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">
            Active supplier
          </div>
          <p className="mt-1 text-sm text-muted">
            Keep the supplier available for QR detection and sales entry.
          </p>
        </div>
        <label className="inline-flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-white/20 bg-white/5 text-gold-500 focus:ring-gold-500"
            checked={Boolean(form.isActive)}
            onChange={(event) => onFormChange('isActive', event.target.checked)}
            aria-label="Supplier active"
          />
          <span className="text-sm font-semibold text-heading">
            {form.isActive ? 'Yes' : 'No'}
          </span>
        </label>
      </div>
    </section>
  )
}
