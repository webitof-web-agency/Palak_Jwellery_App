import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { buttonStyles, getName } from '../../sales/salesPage.utils'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active only' },
  { value: 'cancelled', label: 'Cancelled only' },
  { value: 'all', label: 'All statuses' },
]

const SelectField = ({ label, id, value, onChange, children, className = '' }) => (
  <div className={`field ${className}`.trim()}>
    <label className="field-label" htmlFor={id}>
      {label}
    </label>
    <select id={id} className="input" value={value} onChange={onChange} aria-label={label}>
      {children}
    </select>
  </div>
)

const TextField = ({ label, id, value, onChange, placeholder, className = '', type = 'text', inputMode }) => (
  <div className={`field ${className}`.trim()}>
    <label className="field-label" htmlFor={id}>
      {label}
    </label>
    <input
      id={id}
      className="input"
      type={type}
      inputMode={inputMode}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={label}
    />
  </div>
)

export default function SalesSessionReportsFiltersBar({
  mode = 'session',
  filters,
  suppliers = [],
  salesmen = [],
  onFilterChange,
  onResetFilters,
  onRefresh,
  activeFilterCount = 0,
  isExportingCsv = false,
  isExportingPdf = false,
  exportError = '',
  onExportCsv,
  onExportPdf,
}) {
  const showCategory = mode === 'category'
  const showKarat = mode === 'karat'
  const showWastage = mode === 'wastage'
  const isExporting = isExportingCsv || isExportingPdf

  return (
    <div className="space-y-5">
      <div className="rounded-2xl surface-panel-faint panel-border p-4 md:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-bold font-display text-heading">Synced mobile sales filters</h3>
            <p className="mt-1 text-sm text-muted">
              Review mobile-synced CaptureSession sales using read-only grouped report modes.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={onRefresh} className={buttonStyles.secondary} disabled={isExporting}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-6">
        <TextField
          label="Customer"
          id="v2-customer-filter"
          value={filters.customer || ''}
          onChange={(event) => onFilterChange('customer', event.target.value)}
          placeholder="Name, phone, area, or email"
          className="xl:col-span-2"
        />

        <SelectField
          label="Salesman"
          id="v2-salesman-filter"
          value={filters.salesman || ''}
          onChange={(event) => onFilterChange('salesman', event.target.value)}
        >
          <option value="">All salesmen</option>
          {salesmen.map((user) => (
            <option key={user._id} value={user._id}>
              {getName(user)}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Supplier / Company"
          id="v2-supplier-filter"
          value={filters.supplier || ''}
          onChange={(event) => onFilterChange('supplier', event.target.value)}
        >
          <option value="">All suppliers</option>
          {suppliers.map((supplier) => (
            <option key={supplier._id} value={supplier.name || supplier.code || supplier._id}>
              {getName(supplier)}
              {supplier?.code ? ` (${supplier.code})` : ''}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Status"
          id="v2-status-filter"
          value={filters.status || 'active'}
          onChange={(event) => onFilterChange('status', event.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <div className="field">
          <span className="field-label">Warnings only</span>
          <label className="input flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={Boolean(filters.warningsOnly)}
              onChange={(event) => onFilterChange('warningsOnly', event.target.checked)}
            />
            <span className="text-sm text-primary">Show only warning rows</span>
          </label>
        </div>

        <TextField
          label="Date From"
          id="v2-start-date-filter"
          value={filters.startDate || ''}
          onChange={(event) => onFilterChange('startDate', event.target.value)}
          type="date"
        />

        <TextField
          label="Date To"
          id="v2-end-date-filter"
          value={filters.endDate || ''}
          onChange={(event) => onFilterChange('endDate', event.target.value)}
          type="date"
        />

        {showCategory ? (
          <TextField
            label="Category"
            id="v2-category-filter"
            value={filters.category || ''}
            onChange={(event) => onFilterChange('category', event.target.value)}
            placeholder="Orange, Ring, Pendant..."
          />
        ) : null}

        {showKarat ? (
          <TextField
            label="Karat"
            id="v2-karat-filter"
            value={filters.karat || ''}
            onChange={(event) => onFilterChange('karat', event.target.value)}
            placeholder="14K, 18K, 22K"
          />
        ) : null}

        {showWastage ? (
          <TextField
            label="Wastage"
            id="v2-wastage-filter"
            value={filters.wastage || ''}
            onChange={(event) => onFilterChange('wastage', event.target.value)}
            placeholder="10.00"
            inputMode="decimal"
          />
        ) : null}

        <div className="field">
          <span className="field-label">Reset filters</span>
          <button
            type="button"
            onClick={onResetFilters}
            className={buttonStyles.ghost}
            disabled={activeFilterCount === 0 || isExporting}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted">
          {activeFilterCount > 0
            ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`
            : 'No filters applied'}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className={buttonStyles.secondary}
            disabled={isExporting}
            onClick={onExportCsv}
            title="Download the current V2 synced sales report as CSV"
          >
            {isExportingCsv ? (
              <>
                <LoadingSpinner />
                Exporting CSV...
              </>
            ) : (
              'Download CSV'
            )}
          </button>
          <button
            type="button"
            className={buttonStyles.secondary}
            disabled={isExporting}
            onClick={onExportPdf}
            title="Download the current V2 synced sales report as PDF"
          >
            {isExportingPdf ? (
              <>
                <LoadingSpinner />
                Exporting PDF...
              </>
            ) : (
              'Download PDF'
            )}
          </button>
        </div>
      </div>

      {exportError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100">
          {exportError}
        </div>
      ) : null}
    </div>
  )
}
