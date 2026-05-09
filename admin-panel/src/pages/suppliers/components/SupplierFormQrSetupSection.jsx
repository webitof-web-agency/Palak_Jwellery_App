export default function SupplierFormQrSetupSection({
  form,
  showAdvancedQr,
  setShowAdvancedQr,
  helperTextByStrategy,
  qrTemplates,
  getTemplateKey,
  strategyOptions,
  detectionTypeOptions,
  mappingFields,
  defaultFieldMap,
  onFormChange,
  onFieldMapChange,
  applyQrTemplate,
}) {
  return (
    <div className="surface-panel-soft panel-border rounded-2xl p-5 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b panel-border pb-4">
        <div>
          <span className="eyebrow">QR Setup</span>
          <h3 className="text-xl font-bold font-display text-heading mt-2">Choose a template first</h3>
          <p className="mt-2 text-sm text-muted max-w-2xl leading-relaxed">
            Start simple. Pick a template that matches the supplier QR, then open advanced fields only if you need to fine-tune split characters, prefixes, suffixes, or field positions.
          </p>
        </div>
        <span className="text-[10px] text-muted font-bold tracking-widest bg-white/5 px-2 py-1 rounded">
          {getTemplateKey(form) === 'custom' ? 'Custom' : 'Template applied'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {qrTemplates.map((template) => {
          const active = getTemplateKey(form) === template.key
          return (
            <button
              key={template.key}
              type="button"
              onClick={() => applyQrTemplate(template)}
              className={`text-left rounded-2xl border p-4 transition-all ${
                active
                  ? 'border-gold-500/50 bg-gold-500/10 shadow-lg shadow-gold-500/10'
                  : 'border-white/10 bg-white/5 hover:border-gold-500/30 hover:bg-white/10'
              }`}
              aria-label={`Use ${template.title} template`}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-[10px] uppercase tracking-widest font-bold text-muted">{template.badge}</span>
                {active ? (
                  <span className="text-[10px] uppercase tracking-widest font-bold text-gold-500">Active</span>
                ) : null}
              </div>
              <div className="font-display text-lg font-bold text-heading">{template.title}</div>
              <div className="mt-1 text-sm font-medium text-muted">{template.subtitle}</div>
              <p className="mt-3 text-sm text-muted leading-relaxed">{template.summary}</p>
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl surface-panel-faint panel-border p-4 text-sm text-muted leading-relaxed">
        <strong className="text-heading">How to think about it:</strong> a supplier may give you a fixed-slot QR, a label-based QR like
        <span className="text-primary font-semibold"> GW / GSW / NSW / NW / OW / KT</span>, or a token format where item number and design number are spelled out. Choose the closest template first, then fine-tune the advanced values only if the sample still does not parse correctly.
      </div>

      <button
        type="button"
        onClick={() => setShowAdvancedQr((current) => !current)}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-heading hover:bg-white/10 hover:border-gold-500/30 transition-all"
        aria-expanded={showAdvancedQr}
      >
        {showAdvancedQr ? 'Hide advanced QR fields' : 'Show advanced QR fields'}
      </button>

      {showAdvancedQr && (
        <div className="space-y-5">
          <div className="rounded-2xl surface-panel-faint panel-border p-4 text-sm text-muted">
            <strong className="text-heading">Advanced note:</strong> {helperTextByStrategy[form.strategy]}
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
      )}
    </div>
  )
}
