const KARAT_OPTIONS = ['9K', '14K', '18K', '20K', '22K', '24K']

export default function SupplierFormKaratPuritySection({
  form,
  onAddPurityOverride,
  onPurityOverrideChange,
  onRemovePurityOverride,
}) {
  const overrides = Array.isArray(form.businessSettings?.purityOverrides)
    ? form.businessSettings.purityOverrides
    : []

  return (
    <section className="surface-panel-soft panel-border rounded-2xl p-5 md:p-6 space-y-6">
      <div>
        <span className="eyebrow">Karat & Purity</span>
        <h3 className="text-xl font-bold font-display text-heading mt-2">
          Karat settlement values
        </h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Karat is the jewellery label like 18K. Purity % is the settlement value used in calculation. Supplier-specific purity overrides default values.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">
              Purity overrides
            </div>
            <p className="mt-1 text-sm text-muted">
              Add only the karats you want to override for this supplier. Blank purity values are allowed.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddPurityOverride}
            className="primary-luxury-button px-4 py-2.5 text-sm"
          >
            Add override row
          </button>
        </div>

        {overrides.length === 0 ? (
          <div className="rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-5 text-sm text-muted">
            No purity overrides configured yet.
          </div>
        ) : (
          <div className="space-y-3">
            {overrides.map((override, index) => (
              <div
                key={`${override?.karat || 'karat'}-${index}`}
                className="rounded-2xl panel-border surface-panel-faint p-4 space-y-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">
                    Override {index + 1}
                  </div>
                  <button
                    type="button"
                    className="text-xs font-bold uppercase tracking-widest text-heading hover:text-primary"
                    onClick={() => onRemovePurityOverride(index)}
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="field mb-0">
                    <span className="field-label">Karat</span>
                    <select
                      className="input"
                      value={override?.karat ?? ''}
                      onChange={(event) => onPurityOverrideChange(index, 'karat', event.target.value)}
                      aria-label={`Purity override ${index + 1} karat`}
                    >
                      <option value="">Select karat</option>
                      {KARAT_OPTIONS.map((karat) => (
                        <option key={karat} value={karat}>
                          {karat}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field mb-0">
                    <span className="field-label">Purity %</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={override?.purityPercent ?? ''}
                      onChange={(event) => onPurityOverrideChange(index, 'purityPercent', event.target.value)}
                      placeholder="Leave blank"
                      aria-label={`Purity override ${index + 1} purity percent`}
                    />
                  </label>

                  <label className="field mb-0">
                    <span className="field-label">Active</span>
                    <div className="rounded-2xl surface-panel-soft panel-border px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-sm text-muted">
                        Use this value when the matching karat appears in the supplier QR.
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-white/20 bg-white/5 text-gold-500 focus:ring-gold-500"
                        checked={override?.isActive !== false}
                        onChange={(event) => onPurityOverrideChange(index, 'isActive', event.target.checked)}
                        aria-label={`Purity override ${index + 1} active`}
                      />
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
