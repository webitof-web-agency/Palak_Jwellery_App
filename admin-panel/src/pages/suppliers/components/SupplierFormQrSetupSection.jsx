import { Link } from 'react-router-dom'

export default function SupplierFormQrSetupSection({
  form,
  qrTemplates,
  getTemplateKey,
  applyQrTemplate,
  onQrProfileChange,
}) {
  const activeTemplateKey = getTemplateKey(form)

  return (
    <section className="surface-panel-soft panel-border rounded-2xl p-5 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="eyebrow">QR Template & Test</span>
          <h3 className="text-xl font-bold font-display text-heading mt-2">
            Pick a template, then test it
          </h3>
          <p className="mt-2 text-sm text-muted leading-relaxed max-w-2xl">
            Start with the closest QR template. Use the supplier list QR sample checker to verify parsing without exposing parser internals here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted font-bold tracking-widest surface-panel-soft border panel-border px-2 py-1 rounded">
            {activeTemplateKey === 'custom' ? 'Custom' : 'Template applied'}
          </span>
          <Link
            to="/suppliers"
            className="primary-luxury-button px-4 py-2.5 text-sm"
          >
            Open QR sample checker
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {qrTemplates.map((template) => {
          const active = activeTemplateKey === template.key

          return (
            <button
              key={template.key}
              type="button"
              onClick={() => applyQrTemplate(template)}
              className={`text-left rounded-2xl border p-4 transition-all ${
                active
                  ? 'surface-panel-soft panel-border border-gold-500/50 shadow-lg shadow-gold-500/10'
                  : 'surface-panel-faint panel-border hover:border-gold-500/30 hover:bg-gold-500/5'
              }`}
              aria-label={`Use ${template.title} template`}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-[10px] uppercase tracking-widest font-bold text-muted">
                  {template.badge}
                </span>
                {active ? (
                  <span className="text-[10px] uppercase tracking-widest font-bold text-gold-500">
                    Active
                  </span>
                ) : null}
              </div>
              <div className="font-display text-lg font-bold text-heading">
                {template.title}
              </div>
              <div className="mt-1 text-sm font-medium text-muted">
                {template.subtitle}
              </div>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                {template.summary}
              </p>
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl surface-panel-faint panel-border p-4 text-sm text-muted leading-relaxed">
        <strong className="text-heading">Test QR Parsing:</strong> the actual sample checker stays on the Suppliers page so the QR result can be confirmed without mixing it into supplier settings.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="field mb-0">
          <span className="field-label">Profile key</span>
          <input
            className="input"
            value={form.qrProfile?.profileKey || ''}
            onChange={(event) => onQrProfileChange('profileKey', event.target.value)}
            placeholder="e.g. yug-18k-v1"
            aria-label="QR profile key"
          />
        </label>

        <label className="field mb-0">
          <span className="field-label">Version</span>
          <input
            className="input"
            value={form.qrProfile?.version || ''}
            onChange={(event) => onQrProfileChange('version', event.target.value)}
            placeholder="e.g. 1.0"
            aria-label="QR profile version"
          />
        </label>

        <label className="field mb-0">
          <span className="field-label">Description</span>
          <input
            className="input"
            value={form.qrProfile?.description || ''}
            onChange={(event) => onQrProfileChange('description', event.target.value)}
            placeholder="Short internal note"
            aria-label="QR profile description"
          />
        </label>
      </div>
    </section>
  )
}
