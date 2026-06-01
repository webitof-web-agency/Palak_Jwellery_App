export default function SupplierFormDeveloperSection({
  form,
  showAdvancedSettings,
  setShowAdvancedSettings,
  helperTextByStrategy,
  strategyOptions,
  detectionTypeOptions,
  mappingFields,
  defaultFieldMap,
  onFormChange,
  onFieldMapChange,
}) {
  return (
    <section className="surface-panel-soft panel-border rounded-2xl p-5 md:p-6 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="eyebrow">Advanced Developer Settings</span>
          <h3 className="text-xl font-bold font-display text-heading mt-2">
            Technical parser controls
          </h3>
          <p className="mt-2 text-sm text-muted leading-relaxed max-w-3xl">
            Only change these if you understand the supplier QR format. Legacy suppliers may still depend on these settings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvancedSettings((current) => !current)}
          className="rounded-2xl border panel-border surface-panel-soft px-4 py-3 text-sm font-bold text-heading hover:bg-gold-500/10 hover:border-gold-500/30 transition-all"
          aria-expanded={showAdvancedSettings}
        >
          {showAdvancedSettings ? 'Hide advanced fields' : 'Show advanced fields'}
        </button>
      </div>

      {showAdvancedSettings ? (
        <div className="space-y-5">
          <div className="rounded-2xl surface-panel-faint panel-border p-4 text-sm text-muted">
            <strong className="text-heading">Advanced note:</strong>{' '}
            {helperTextByStrategy[form.strategy]}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <label className="field mb-0">
              <span className="field-label">How to read the QR</span>
              <select
                className="input"
                value={form.strategy}
                onChange={(event) => onFormChange('strategy', event.target.value)}
                aria-label="How to read the QR"
              >
                {strategyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field mb-0">
              <span className="field-label">How to match the supplier</span>
              <select
                className="input"
                value={form.detectionType}
                onChange={(event) => onFormChange('detectionType', event.target.value)}
                aria-label="How to match the supplier"
              >
                {detectionTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

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
              <span className="field-label">Split character</span>
              <input
                className="input"
                value={form.delimiter}
                onChange={(event) => onFormChange('delimiter', event.target.value)}
                placeholder="|"
                aria-label="Split character"
                disabled={form.strategy !== 'delimiter'}
              />
            </label>
          </div>

          <div className="rounded-2xl surface-panel-faint panel-border p-4 text-sm text-muted leading-relaxed">
            Use positions only if the supplier QR is fixed by slot. If the supplier prints labels like GW, GSW, NSW, NW, OW, or KT, keep this section simple and let the template do the heavy lifting.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-5">
            {mappingFields.map((item) => (
              <label className="field mb-0" key={item.key}>
                <span className="field-label">{item.label}</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={form.fieldMap[item.key]}
                  onChange={(event) => onFieldMapChange(item.key, event.target.value)}
                  placeholder={defaultFieldMap[item.key]}
                  aria-label={item.label}
                  disabled={form.strategy !== 'delimiter'}
                />
                <span className="mt-2 text-[11px] text-muted leading-relaxed">
                  {item.key === 'grossWeight'
                    ? 'Use a field position, or an advanced value like idx: 1 - prefix: GW.'
                    : item.key === 'stoneWeight'
                      ? 'For combined stone fields, you can use sum: 5 + 2.'
                      : item.key === 'netWeight'
                        ? 'For a direct value, use idx: 4. For labelled values, keep the template simple.'
                        : item.key === 'category'
                          ? 'Business category can still be suggested from the supplier, but the salesman can override it.'
                          : 'Use the supplier code position or a prefixed value if the supplier prints extra text.'}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
