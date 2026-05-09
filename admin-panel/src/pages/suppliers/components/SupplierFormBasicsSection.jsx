export default function SupplierFormBasicsSection({
  form,
  paymentModes,
  onFormChange,
  onAddCategory,
  onRemoveCategory,
}) {
  return (
    <>
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

        <label className="field">
          <span className="field-label">How to read the QR</span>
          <select
            className="input"
            value={form.strategy}
            onChange={(event) => onFormChange('strategy', event.target.value)}
            aria-label="How to read the QR"
          >
            <option value="delimiter">Delimiter / positional</option>
            <option value="key_value">Key-value label format</option>
            <option value="venzora">Venzora token format</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">How to match the supplier</span>
          <select
            className="input"
            value={form.detectionType}
            onChange={(event) => onFormChange('detectionType', event.target.value)}
            aria-label="How to match the supplier"
          >
            <option value="regex">Regex</option>
            <option value="contains">Contains</option>
            <option value="prefix">Prefix</option>
          </select>
        </label>
      </div>

      <label className="field mb-0">
        <span className="field-label">Supplier name, code, or pattern</span>
        <input
          className="input"
          value={form.detectionPattern}
          onChange={(event) => onFormChange('detectionPattern', event.target.value)}
          placeholder={
            form.detectionType === 'regex'
              ? 'e.g. ^JFC\\d+'
              : form.detectionType === 'prefix'
                ? 'e.g. USV'
                : 'e.g. SWMS'
          }
          aria-label="Supplier name, code, or pattern"
        />
      </label>

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

      <div className="surface-panel-faint panel-border rounded-2xl p-5 flex flex-col gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">
            Allowed Categories
          </div>
          <p className="mt-2 text-sm text-muted">
            Maintain business categories here. Salesman will get a dropdown with manual fallback.
          </p>
        </div>
        <div className="flex gap-3">
          <input
            className="input"
            value={form.categoryDraft}
            onChange={(event) => onFormChange('categoryDraft', event.target.value)}
            placeholder="Add category"
            aria-label="Add supplier category"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onAddCategory()
              }
            }}
          />
          <button
            type="button"
            onClick={onAddCategory}
            className="luxury-button bg-white/5 text-on-accent hover:bg-white/10 border border-white/10"
            aria-label="Add supplier category"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {form.categories.length === 0 ? (
            <span className="text-sm text-muted">No categories configured yet.</span>
          ) : (
            form.categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => onRemoveCategory(category)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-on-accent hover:border-gold-500/30 hover:bg-gold-600/10"
                aria-label={`Remove category ${category}`}
              >
                {category} x
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )
}
