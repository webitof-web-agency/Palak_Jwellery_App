import LoadingSpinner from '../../../components/ui/LoadingSpinner'
const SupplierFormModal = ({
  open,
  title,
  description,
  submitLabel,
  onClose,
  onSubmit,
  form,
  onFormChange,
  onFieldMapChange,
  paymentModes,
  mappingFields,
  defaultFieldMap,
  isSaving,
  formError,
}) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-[var(--jsm-overlay)] backdrop-blur-md animate-fade-in duration-300">
      <div className="bg-[var(--jsm-surface)] w-full max-w-3xl overflow-hidden shadow-2xl animate-zoom-in duration-300 max-h-[90vh] flex flex-col rounded-[2rem] border panel-border relative">
        
        {/* Sticky Header */}
        <div className="p-6 md:px-8 md:pt-8 md:pb-6 border-b panel-border flex-shrink-0 flex items-start justify-between z-10">
          <div>
            <span className="eyebrow">Supplier Setup</span>
            <h2 className="text-2xl font-bold font-display gold-gradient-text tracking-tight uppercase">
              {title}
            </h2>
            {description ? <p className="mt-2 text-muted text-sm">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold uppercase tracking-widest text-heading hover:opacity-80 transition-colors p-2 bg-gold-600/10 rounded-lg"
          >
            Close
          </button>
        </div>

        <form className="flex flex-col min-h-0 overflow-hidden" onSubmit={onSubmit} noValidate>
          
          {/* Scrollable Form Body */}
          <div className="overflow-y-auto p-6 md:p-8 flex-1 space-y-8">
            
            <div className="form-grid">
              <label className="field">
                <span className="field-label">Legal Name</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={(event) => onFormChange('name', event.target.value)}
                  placeholder="e.g. Ashok Jewellers"
                />
              </label>

              <label className="field">
                <span className="field-label">Unique Code</span>
                <input
                  className="input"
                  value={form.code}
                  onChange={(event) => onFormChange('code', event.target.value)}
                  placeholder="e.g. ASH01"
                />
              </label>

              <label className="field">
                <span className="field-label">GST Number</span>
                <input
                  className="input"
                  value={form.gst}
                  onChange={(event) => onFormChange('gst', event.target.value)}
                  placeholder="e.g. 29ABCDE..."
                />
              </label>

              <label className="field">
                <span className="field-label">Settlement Mode</span>
                <select
                  className="input"
                  value={form.paymentMode}
                  onChange={(event) => onFormChange('paymentMode', event.target.value)}
                >
                  {paymentModes.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field">
              <span className="field-label">Registered Address</span>
              <textarea
                className="input input--textarea"
                rows="2"
                value={form.address}
                onChange={(event) => onFormChange('address', event.target.value)}
                placeholder="Physical storage or billing address"
              />
            </label>

            <label className="field">
              <span className="field-label">Active Categories</span>
              <input
                className="input"
                value={form.categories}
                onChange={(event) => onFormChange('categories', event.target.value)}
                placeholder="Ring, Necklace, Bracelet"
              />
            </label>

            <div className="surface-panel-soft panel-border rounded-2xl p-5 md:p-6 space-y-6">
              <div className="flex justify-between items-center border-b panel-border pb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-heading">
                  QR Delimiter Mapping
                </h3>
                <span className="text-[10px] text-muted font-bold tracking-widest bg-white/5 px-2 py-1 rounded">
                  LEGACY MODE
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                <label className="field mb-0">
                  <span className="field-label">Symbol</span>
                  <input
                    className="input"
                    value={form.delimiter}
                    onChange={(event) => onFormChange('delimiter', event.target.value)}
                    placeholder="|"
                  />
                </label>

                {mappingFields.map((item) => (
                  <label className="field mb-0" key={item.key}>
                    <span className="field-label">{item.label}</span>
                    <input
                      className="input"
                      inputMode="numeric"
                      value={form.fieldMap[item.key]}
                      onChange={(event) => onFieldMapChange(item.key, event.target.value)}
                      placeholder={defaultFieldMap[item.key]}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-5 surface-panel-faint panel-border rounded-2xl">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-primary">Mobile App Sync</span>
                <span className="text-[11px] text-muted font-bold uppercase mt-0.5">Enable supplier for scanning</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => onFormChange('isActive', event.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-7 surface-panel rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 dark:after:border-transparent dark:peer-checked:after:bg-gold-600 peer-checked:after:bg-heading peer-checked:after:border-transparent after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-heading/20 dark:peer-checked:bg-gold-600/20 border panel-border shadow-inner" />
              </label>
            </div>

            {formError ? (
              <p className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-4 rounded-xl font-bold" role="alert">
                {formError}
              </p>
            ) : null}

          </div>

          {/* Sticky Footer */}
          <div className="p-6 md:px-8 border-t panel-border flex-shrink-0 bg-[var(--jsm-surface)] z-10 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-muted hover:text-primary transition-all bg-white/5 hover:bg-white/10 rounded-2xl"
            >
              Cancel
            </button>
            <button
              disabled={isSaving}
              type="submit"
              className="flex-[2] primary-luxury-button text-sm"
            >
              {isSaving ? (
                <>
                  <LoadingSpinner />
                  Saving...
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

export default SupplierFormModal
