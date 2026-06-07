import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { buttonStyles, getName, batchStatusOptions, sessionStatusOptions, sessionSortOptions, batchSortOptions } from '../../sales/salesPage.utils'

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

const TextField = ({ label, id, value, onChange, placeholder, className = '', type = 'text' }) => (
  <div className={`field ${className}`.trim()}>
    <label className="field-label" htmlFor={id}>
      {label}
    </label>
    <input
      id={id}
      className="input"
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={label}
    />
  </div>
)

export default function SettlementReportsFiltersBar({
  scope = 'session',
  filters,
  suppliers = [],
  salesmen = [],
  onFilterChange,
  onResetFilters,
  onRefresh,
  onExportCsv,
  onExportPdf,
  isExporting,
  canExport = true,
  activeFilterCount = 0,
}) {
  const supplierOptions = Array.isArray(suppliers) ? suppliers : []
  const salesmanOptions = Array.isArray(salesmen) ? salesmen : []
  const isItemLedger = scope === 'item-ledger'
  const isSession = scope === 'session'

  return (
    <div className="space-y-5">
      <div className="rounded-2xl surface-panel-faint panel-border p-4 md:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold font-display text-heading">
                {isSession
                  ? 'Session report filters'
                  : isItemLedger
                    ? 'Item ledger filters'
                    : 'Supplier section filters'}
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted">
              {isSession
                ? 'Search finalized sessions by reference, customer, salesman, or date.'
                : isItemLedger
                  ? 'Search finalized item-ledger rows by supplier, item details, or date.'
                  : 'Search finalized supplier sections by ref, supplier, session, or date.'}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={onRefresh} className={buttonStyles.secondary}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-5 items-end md:grid-cols-2 ${
          isItemLedger
            ? 'xl:grid-cols-4'
            : isSession
              ? 'xl:grid-cols-6'
              : 'xl:grid-cols-7'
        }`}
      >
        <TextField
          label={isItemLedger ? 'Search ledger' : 'Search reports'}
          id={`${scope}-search`}
          value={filters.search || ''}
          onChange={(event) => onFilterChange('search', event.target.value)}
          placeholder={
            isSession
              ? 'Search by session ref, customer, phone, or note'
              : isItemLedger
                ? 'Search by supplier, category, item code, or notes'
                : 'Search by batch ref, supplier, session, or note'
          }
          className={isItemLedger ? 'xl:col-span-2' : 'xl:col-span-2'}
        />

        {isSession ? (
          <>
            <TextField
              label="Customer"
              id="session-customer-filter"
              value={filters.customer || ''}
              onChange={(event) => onFilterChange('customer', event.target.value)}
              placeholder="Customer name, phone, or reference note"
            />

            <SelectField
              label="Assigned salesman"
              id="session-salesman-filter"
              value={filters.assignedSalesman || ''}
              onChange={(event) => onFilterChange('assignedSalesman', event.target.value)}
            >
              <option value="">All salesmen</option>
              {salesmanOptions.map((user) => (
                <option key={user._id} value={user._id}>
                  {getName(user)}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Status"
              id="session-status-filter"
              value={filters.status || ''}
              onChange={(event) => onFilterChange('status', event.target.value)}
            >
              {sessionStatusOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Sort order"
              id="session-sort-filter"
              value={filters.sort || 'updatedAt:desc'}
              onChange={(event) => onFilterChange('sort', event.target.value)}
            >
              {sessionSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </>
        ) : isItemLedger ? (
          <>
            <SelectField
              label="Supplier"
              id="ledger-supplier-filter"
              value={filters.supplier || ''}
              onChange={(event) => onFilterChange('supplier', event.target.value)}
            >
              <option value="">All suppliers</option>
              {supplierOptions.map((supplier) => (
                <option key={supplier._id} value={supplier._id}>
                  {getName(supplier)}
                  {supplier?.code ? ` (${supplier.code})` : ''}
                </option>
              ))}
            </SelectField>

            <TextField
              label="Category"
              id="ledger-category-filter"
              value={filters.category || ''}
              onChange={(event) => onFilterChange('category', event.target.value)}
              placeholder="Optional category"
            />

          </>
        ) : (
          <>
            <SelectField
              label="Supplier"
              id="section-supplier-filter"
              value={filters.supplier || ''}
              onChange={(event) => onFilterChange('supplier', event.target.value)}
            >
              <option value="">All suppliers</option>
              {supplierOptions.map((supplier) => (
                <option key={supplier._id} value={supplier._id}>
                  {getName(supplier)}
                  {supplier?.code ? ` (${supplier.code})` : ''}
                </option>
              ))}
            </SelectField>

            <TextField
              label="Session / customer"
              id="section-session-filter"
              value={filters.session || ''}
              onChange={(event) => onFilterChange('session', event.target.value)}
              placeholder="Session ref, customer, or note"
            />

            <SelectField
              label="Assigned salesman"
              id="section-salesman-filter"
              value={filters.assignedSalesman || ''}
              onChange={(event) => onFilterChange('assignedSalesman', event.target.value)}
            >
              <option value="">All salesmen</option>
              {salesmanOptions.map((user) => (
                <option key={user._id} value={user._id}>
                  {getName(user)}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Status"
              id="section-status-filter"
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
              label="Sort order"
              id="section-sort-filter"
              value={filters.sort || 'updatedAt:desc'}
              onChange={(event) => onFilterChange('sort', event.target.value)}
            >
              {batchSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </>
        )}

        <TextField
          label="Date From"
          id={`${scope}-start-date-filter`}
          value={filters.startDate || ''}
          onChange={(event) => onFilterChange('startDate', event.target.value)}
          type="date"
        />

        <div className="field">
          <label className="field-label" htmlFor={`${scope}-end-date-filter`}>
            Date To
          </label>
          <div className="flex items-end gap-3">
            <input
              id={`${scope}-end-date-filter`}
              className="input flex-1"
              type="date"
              value={filters.endDate || ''}
              onChange={(event) => onFilterChange('endDate', event.target.value)}
              aria-label="Date To"
            />
            <button
              type="button"
              onClick={onResetFilters}
              className={buttonStyles.ghost}
              aria-label="Reset filters"
              disabled={activeFilterCount === 0}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted">
          {activeFilterCount > 0
            ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`
            : 'No filters applied'}
        </div>

        {isItemLedger ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onExportCsv}
              disabled={isExporting || !canExport}
              className={buttonStyles.primary}
              title={!canExport ? 'No rows to export' : 'Export settlement records as CSV'}
            >
              {isExporting ? (
                <>
                  <LoadingSpinner />
                  Exporting...
                </>
              ) : !canExport ? (
                'No data'
              ) : (
                'Export CSV'
              )}
            </button>
            <button
              type="button"
              onClick={onExportPdf}
              disabled={isExporting || !canExport}
              className={buttonStyles.secondary}
              title={!canExport ? 'No rows to export' : 'Preview PDF'}
            >
              {isExporting ? (
                <>
                  <LoadingSpinner />
                  Exporting...
                </>
              ) : !canExport ? (
                'No data'
              ) : (
                'Preview PDF'
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
