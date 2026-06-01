const fieldBase = 'input'

export default function SupplierFormCategoriesSection({
  form,
  onFormChange,
  onAddLegacyCategory,
  onRemoveLegacyCategory,
  onAddStructuredCategory,
  onStructuredCategoryChange,
  onRemoveStructuredCategory,
  onBusinessSettingsChange,
}) {
  const structuredCategories = Array.isArray(form.businessSettings?.categories)
    ? form.businessSettings.categories
    : []

  const legacyCategories = Array.isArray(form.categories) ? form.categories : []

  return (
    <section className="surface-panel-soft panel-border rounded-2xl p-5 md:p-6 space-y-6">
      <div>
        <span className="eyebrow">Categories & Wastage</span>
        <h3 className="text-xl font-bold font-display text-heading mt-2">
          Business categories
        </h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Use structured categories for supplier-specific wastage rules. Legacy quick categories are still kept for older workflows.
        </p>
      </div>

      <div className="rounded-2xl surface-panel-faint panel-border p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">
              Default wastage percent
            </div>
            <p className="mt-1 text-sm text-muted">
              Optional fallback wastage for this supplier when a category does not have its own wastage value.
            </p>
          </div>
          <label className="field m-0 w-full md:w-48">
            <span className="field-label">Default wastage %</span>
            <input
              className={fieldBase}
              type="number"
              min="0"
              step="0.01"
              value={form.businessSettings?.defaultWastagePercent ?? ''}
              onChange={(event) => onBusinessSettingsChange('defaultWastagePercent', event.target.value)}
              placeholder="e.g. 9"
              aria-label="Default wastage percent"
            />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">
              Structured categories
            </div>
            <p className="mt-1 text-sm text-muted">
              Name, code, label, wastage, and ordering can be configured per category.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddStructuredCategory}
            className="primary-luxury-button px-4 py-2.5 text-sm"
          >
            Add category row
          </button>
        </div>

        {structuredCategories.length === 0 ? (
          <div className="rounded-2xl border border-dashed panel-border surface-panel-faint px-4 py-5 text-sm text-muted">
            No structured categories yet. Add one to configure wastage by category.
          </div>
        ) : (
          <div className="space-y-3">
            {structuredCategories.map((category, index) => (
              <div
                key={`${category?.code || category?.name || 'category'}-${index}`}
                className="rounded-2xl panel-border surface-panel-faint p-4 space-y-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">
                    Category {index + 1}
                  </div>
                  <button
                    type="button"
                    className="text-xs font-bold uppercase tracking-widest text-red-400 hover:text-red-300"
                    onClick={() => onRemoveStructuredCategory(index)}
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <label className="field mb-0">
                    <span className="field-label">Name</span>
                    <input
                      className="input"
                      value={category?.name ?? ''}
                      onChange={(event) => onStructuredCategoryChange(index, 'name', event.target.value)}
                      placeholder="e.g. White"
                      aria-label={`Category ${index + 1} name`}
                    />
                  </label>

                  <label className="field mb-0">
                    <span className="field-label">Code</span>
                    <input
                      className="input"
                      value={category?.code ?? ''}
                      onChange={(event) => onStructuredCategoryChange(index, 'code', event.target.value)}
                      placeholder="e.g. WHITE"
                      aria-label={`Category ${index + 1} code`}
                    />
                  </label>

                  <label className="field mb-0">
                    <span className="field-label">Color label</span>
                    <input
                      className="input"
                      value={category?.colorLabel ?? ''}
                      onChange={(event) => onStructuredCategoryChange(index, 'colorLabel', event.target.value)}
                      placeholder="e.g. white"
                      aria-label={`Category ${index + 1} color label`}
                    />
                  </label>

                  <label className="field mb-0">
                    <span className="field-label">Wastage %</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={category?.wastagePercent ?? ''}
                      onChange={(event) => onStructuredCategoryChange(index, 'wastagePercent', event.target.value)}
                      placeholder="Leave blank"
                      aria-label={`Category ${index + 1} wastage percent`}
                    />
                  </label>

                  <label className="field mb-0">
                    <span className="field-label">Sort order</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      value={category?.sortOrder ?? ''}
                      onChange={(event) => onStructuredCategoryChange(index, 'sortOrder', event.target.value)}
                      placeholder="Auto"
                      aria-label={`Category ${index + 1} sort order`}
                    />
                  </label>

                  <label className="field mb-0">
                    <span className="field-label">Active</span>
                    <div className="rounded-2xl surface-panel-soft panel-border px-4 py-3 flex items-center justify-between gap-3">
                      <span className="text-sm text-muted">
                        Keep this category available for settlement and supplier selection.
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-white/20 bg-white/5 text-gold-500 focus:ring-gold-500"
                        checked={category?.isActive !== false}
                        onChange={(event) => onStructuredCategoryChange(index, 'isActive', event.target.checked)}
                        aria-label={`Category ${index + 1} active`}
                      />
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl surface-panel-faint panel-border p-4 space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">
            Legacy quick categories
          </div>
          <p className="mt-1 text-sm text-muted">
            These are still stored for backward compatibility and older flows.
          </p>
        </div>

        <div className="flex gap-3">
          <input
            className="input"
            value={form.categoryDraft}
            onChange={(event) => onFormChange('categoryDraft', event.target.value)}
            placeholder="Add legacy category"
            aria-label="Add supplier category"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onAddLegacyCategory()
              }
            }}
          />
          <button
            type="button"
            onClick={onAddLegacyCategory}
            className="primary-luxury-button px-4 py-2.5 text-sm"
            aria-label="Add supplier category"
          >
            Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {legacyCategories.length === 0 ? (
            <span className="text-sm text-muted">No legacy categories configured yet.</span>
          ) : (
            legacyCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => onRemoveLegacyCategory(category)}
              className="rounded-full border panel-border surface-panel-soft px-3 py-1 text-xs font-bold text-heading hover:border-gold-500/30 hover:bg-gold-500/10"
              aria-label={`Remove category ${category}`}
            >
                {category} x
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
