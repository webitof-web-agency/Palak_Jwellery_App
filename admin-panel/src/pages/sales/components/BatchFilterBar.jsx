import { batchEntryModeOptions, batchSortOptions, batchStatusOptions, getName } from '../salesPage.utils'

const SelectField = ({ label, id, value, onChange, children }) => (
  <div className="field">
    <label className="field-label" htmlFor={id}>
      {label}
    </label>
    <select id={id} className="input" value={value} onChange={onChange} aria-label={label}>
      {children}
    </select>
  </div>
)

export default function BatchFilterBar({
  filters,
  suppliers = [],
  onFilterChange,
}) {
  const supplierOptions = Array.isArray(suppliers) ? suppliers : []

  return (
    <div className="space-y-5">
      <div className="rounded-2xl surface-panel-faint panel-border p-4 md:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold font-display text-heading">
                Batch workflow filters
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted">
              Search batches by ref, customer note, supplier, status, or revision date.
            </p>
          </div>

          <div className="rounded-xl surface-panel-soft panel-border px-3 py-2 text-sm text-muted">
            Batch export is planned for a later phase.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-5 items-end">
        <div className="field xl:col-span-2">
          <label className="field-label" htmlFor="batch-search">
            Search batches
          </label>
          <input
            id="batch-search"
            className="input"
            type="text"
            value={filters.q}
            onChange={(event) => onFilterChange('q', event.target.value)}
            placeholder="Search by batch ref, customer, or reference note"
            aria-label="Search batches"
          />
        </div>

        <SelectField
          label="Supplier"
          id="batch-supplier-filter"
          value={filters.supplier || ''}
          onChange={(event) => onFilterChange('supplier', event.target.value)}
        >
          <option value="">All suppliers</option>
          {supplierOptions.map((supplier) => (
            <option key={supplier._id} value={supplier._id}>
              {getName(supplier)}{supplier?.code ? ` (${supplier.code})` : ''}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Status"
          id="batch-status-filter"
          value={filters.status || ''}
          onChange={(event) => onFilterChange('status', event.target.value)}
        >
          {batchStatusOptions.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Entry mode"
          id="batch-entry-mode-filter"
          value={filters.entryMode || ''}
          onChange={(event) => onFilterChange('entryMode', event.target.value)}
        >
          {batchEntryModeOptions.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Sort order"
          id="batch-sort-filter"
          value={filters.sort || 'updatedAt:desc'}
          onChange={(event) => onFilterChange('sort', event.target.value)}
        >
          {batchSortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <div className="field">
          <label className="field-label" htmlFor="batch-start-date-filter">
            Date From
          </label>
          <input
            id="batch-start-date-filter"
            className="input"
            type="date"
            value={filters.startDate}
            onChange={(event) => onFilterChange('startDate', event.target.value)}
            aria-label="Filter batches from date"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="batch-end-date-filter">
            Date To
          </label>
          <input
            id="batch-end-date-filter"
            className="input"
            type="date"
            value={filters.endDate}
            onChange={(event) => onFilterChange('endDate', event.target.value)}
            aria-label="Filter batches to date"
          />
        </div>
      </div>
    </div>
  )
}
