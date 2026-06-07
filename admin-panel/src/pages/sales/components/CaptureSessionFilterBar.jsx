import { sessionSortOptions, sessionStatusOptions, getName } from '../salesPage.utils'

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

export default function CaptureSessionFilterBar({
  filters,
  salesmen = [],
  onFilterChange,
}) {
  const salesmanOptions = Array.isArray(salesmen) ? salesmen : []

  return (
    <div className="space-y-5">
      <div className="rounded-2xl surface-panel-faint panel-border p-4 md:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold font-display text-heading">
                Capture session filters
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted">
              Search sessions by reference, customer details, assigned salesman, or review date.
            </p>
          </div>

          <div className="rounded-xl surface-panel-soft panel-border px-3 py-2 text-sm text-muted">
            Session export is planned for a later phase.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-5 items-end">
        <div className="field xl:col-span-2">
          <label className="field-label" htmlFor="session-search">
            Search sessions
          </label>
          <input
            id="session-search"
            className="input"
            type="text"
            value={filters.q}
            onChange={(event) => onFilterChange('q', event.target.value)}
            placeholder="Search by session ref, customer, or note"
            aria-label="Search sessions"
          />
        </div>

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

        <div className="field">
          <label className="field-label" htmlFor="session-start-date-filter">
            Date From
          </label>
          <input
            id="session-start-date-filter"
            className="input"
            type="date"
            value={filters.startDate}
            onChange={(event) => onFilterChange('startDate', event.target.value)}
            aria-label="Filter sessions from date"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="session-end-date-filter">
            Date To
          </label>
          <input
            id="session-end-date-filter"
            className="input"
            type="date"
            value={filters.endDate}
            onChange={(event) => onFilterChange('endDate', event.target.value)}
            aria-label="Filter sessions to date"
          />
        </div>
      </div>
    </div>
  )
}
