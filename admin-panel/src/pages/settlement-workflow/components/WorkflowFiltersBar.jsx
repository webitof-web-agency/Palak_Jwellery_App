import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { buttonStyles } from '../../sales/salesPage.utils'
import {
  confidenceOptions,
  valuationStatusOptions,
} from '../workflow.utils'

export default function WorkflowFiltersBar({
  mode = 'exceptions',
  filters,
  onFilterChange,
  onResetFilters,
  onRefresh,
  onExportCsv,
  onExportPdf,
  isExporting,
  canExport = true,
  activeFilterCount,
  pdfButtonLabel = 'Open PDF',
  title = 'Filters',
  description = 'Filter records by supplier, settlement status, confidence, and date.',
}) {
  const showExceptionFilters = mode !== 'settlement'

  return (
    <div className="space-y-5">
      <div className="rounded-2xl surface-panel-faint panel-border p-4 md:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold font-display text-heading">
                {title}
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted">
              {description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={onRefresh} className={buttonStyles.secondary}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 items-end ${showExceptionFilters ? 'xl:grid-cols-6' : 'xl:grid-cols-4'}`}>
        <div className="field xl:col-span-2">
          <label className="field-label" htmlFor="qr-search">
            Search
          </label>
          <input
            id="qr-search"
            className="input"
            type="search"
            value={filters.search}
            onChange={(event) => onFilterChange('search', event.target.value)}
            placeholder="Search supplier or design code"
            aria-label="Search records"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="qr-supplier">
            Supplier
          </label>
          <input
            id="qr-supplier"
            className="input"
            type="text"
            value={filters.supplier}
            onChange={(event) => onFilterChange('supplier', event.target.value)}
            placeholder="Supplier name"
            aria-label="Filter by supplier"
          />
        </div>

        {showExceptionFilters ? (
          <>
            <div className="field">
              <label className="field-label" htmlFor="qr-valuation-status">
                Settlement Status
              </label>
              <select
                id="qr-valuation-status"
                className="input"
                value={filters.valuationStatus}
                onChange={(event) => onFilterChange('valuationStatus', event.target.value)}
                aria-label="Filter by settlement status"
              >
                {valuationStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="qr-confidence">
                Confidence
              </label>
              <select
                id="qr-confidence"
                className="input"
                value={filters.confidenceThreshold}
                onChange={(event) => onFilterChange('confidenceThreshold', event.target.value)}
                aria-label="Filter by confidence"
              >
                {confidenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        <div className="field">
          <label className="field-label" htmlFor="qr-start">
            Date From
          </label>
          <input
            id="qr-start"
            className="input"
            type="date"
            value={filters.startDate}
            onChange={(event) => onFilterChange('startDate', event.target.value)}
            aria-label="Filter from date"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="qr-end">
            Date To
          </label>
          <div className="flex items-end gap-3">
            <input
              id="qr-end"
              className="input flex-1"
              type="date"
              value={filters.endDate}
              onChange={(event) => onFilterChange('endDate', event.target.value)}
              aria-label="Filter to date"
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
            title={!canExport ? 'No rows to export' : pdfButtonLabel}
          >
            {isExporting ? (
              <>
                <LoadingSpinner />
                Exporting...
              </>
            ) : !canExport ? (
              'No data'
            ) : (
              pdfButtonLabel
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
