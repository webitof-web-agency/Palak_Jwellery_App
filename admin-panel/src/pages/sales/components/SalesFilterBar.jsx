import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { buttonStyles, sortOptions } from "../salesPage.utils";

export default function SalesFilterBar({
  filters,
  onFilterChange,
  onExport,
  isExporting,
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl surface-panel-faint panel-border p-4 md:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold font-display text-heading">
                Search and filters
              </h3>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted hover:text-primary hover:border-gold-500/30 hover:bg-white/10"
                title="Search looks across salesman, supplier, category, item code, and notes. Use the dropdown to narrow the search."
                aria-label="Search help"
              >
                i
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">
              Search the sales ledger by salesman, supplier, category, item code, or notes.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-heading">
            <input
              type="checkbox"
              checked={filters.duplicatesOnly}
              onChange={(event) => onFilterChange("duplicatesOnly", event.target.checked)}
              aria-label="Show duplicate entries only"
              className="h-4 w-4 rounded border-white/20 bg-transparent text-gold-500 focus:ring-gold-500"
            />
            Duplicate entries only
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-5 items-end">
        <div className="field xl:col-span-2">
          <label className="field-label" htmlFor="sales-search">
            Search sales
          </label>
          <input
            id="sales-search"
            className="input"
            type="text"
            value={filters.q}
            onChange={(event) => onFilterChange("q", event.target.value)}
            placeholder="Search by salesman, supplier, category, item, or note"
            aria-label="Search sales"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="search-scope-filter">
            Search in
          </label>
          <select
            id="search-scope-filter"
            className="input"
            value={filters.searchScope}
            onChange={(event) => onFilterChange("searchScope", event.target.value)}
            aria-label="Search scope"
          >
            <option value="all">All matches</option>
            <option value="salesman">Salesman only</option>
            <option value="supplier">Supplier only</option>
            <option value="details">Entry details</option>
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="start-date-filter">
            Date From
          </label>
          <input
            id="start-date-filter"
            className="input"
            type="date"
            value={filters.startDate}
            onChange={(event) => onFilterChange("startDate", event.target.value)}
            aria-label="Filter sales from date"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="end-date-filter">
            Date To
          </label>
          <input
            id="end-date-filter"
            className="input"
            type="date"
            value={filters.endDate}
            onChange={(event) => onFilterChange("endDate", event.target.value)}
            aria-label="Filter sales to date"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sort-filter">
            Sort Order
          </label>
          <select
            id="sort-filter"
            className="input"
            value={filters.sort}
            onChange={(event) => onFilterChange("sort", event.target.value)}
            aria-label="Sort sales records"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted">
          Export the filtered range or the complete ledger.
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => onExport("filtered")}
            disabled={isExporting}
            className={buttonStyles.primary}
            aria-label="Export filtered sales as CSV"
          >
            {isExporting ? (
              <>
                <LoadingSpinner />
                Exporting...
              </>
            ) : (
              'Export Range'
            )}
          </button>
          <button
            type="button"
            onClick={() => onExport("all")}
            disabled={isExporting}
            className={buttonStyles.secondary}
            aria-label="Export all sales as CSV"
          >
            {isExporting ? (
              <>
                <LoadingSpinner />
                Exporting...
              </>
            ) : (
              'Export All'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
