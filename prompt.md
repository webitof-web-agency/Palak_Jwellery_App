Codex response ->

1. Current reusable frontend architecture
- React 19 + Vite admin shell with `BrowserRouter`, lazy-loaded pages, and route-level auth guards.
- Zustand auth store with localStorage persistence.
- Shared UI primitives already exist: `PageHeader`, `SectionCard`, `EmptyState`, `TableSkeleton`, `MetricCard`, `PasswordField`, `LogoBadge`, `ThemeToggleButton`.
- Existing API layer uses one fetch wrapper with token injection and 401 auto-clear behavior.
- Modal and overlay patterns already exist through page-specific portals and modal shells.
- The frontend is operationally structured, not demo-based. The main gap is missing QR workflow pages, not missing infrastructure.

2. Existing reusable systems/components
- Routing/auth reuse:
  - `ProtectedRoute`, `AdminRoute`, `PublicRoute`, `HomeRedirect`
  - `Layout` sidebar shell with mobile drawer behavior
- Table/list patterns:
  - Users table
  - Sales table
  - Supplier cards/list
  - Skeleton + empty-state handling
- Filter/action patterns:
  - Sales filter bar with search/date/sort/export controls
  - Supplier QR test tool with supplier selector + parse action
  - Add/delete modal patterns for users and suppliers
- API reuse:
  - `request()` client wrapper
  - auth/sales/suppliers/reports/users API modules
- What should NOT be duplicated:
  - auth guard logic
  - API client/token handling
  - generic table skeletons
  - page headers and section cards
  - modal shell patterns

3. Current frontend gaps
- There is no QR Operations module in the admin panel.
- There is no QR review queue page.
- There is no QR detail page for a single ingestion record.
- There is no correction/edit flow for QR ingestion.
- There is no admin UI wired to the new QR reporting, CSV, or PDF endpoints.
- The dashboard is still sales-centric and does not show QR workflow readiness or validation/valuation visibility.
- The existing suppliers QR tool is a sample parser tester, not an operational review workflow.
- Existing reports API only exposes sales summaries, not QR reporting.

4. Proposed QR Operations module structure
- Use the existing admin shell and sidebar.
- Add a new top-level nav group or section for `QR Operations`.
- Break the module into:
  - Review Queue
  - QR Detail
  - Correction/Edit
  - Reports
  - Export actions
  - Warning and traceability panels
- Keep state local to the pages first, with optional shared filter state if the review queue and reports need synchronized filters.
- Reuse the sales table/filter patterns for list, search, sort, and export controls.
- Reuse the supplier modal pattern for correction/edit screens if a modal is faster than a full page.
- Prefer one API module for QR operations rather than scattering endpoints across existing sales and supplier APIs.

5. Suggested routes/pages
- `/qr-operations` - landing overview for QR workflow
- `/qr-operations/review` - queue of ingestions needing review
- `/qr-operations/ingestions/:id` - QR detail page
- `/qr-operations/ingestions/:id/edit` - correction/edit flow
- `/qr-operations/reports` - filtered QR reporting page
- `/qr-operations/reports/export` - CSV/PDF download triggers
- Optional later:
  - `/qr-operations/reports/:id` for report detail

6. Suggested reusable components
- `QrOperationsStats`
- `QrReviewQueueTable`
- `QrStatusBadge`
- `QrConfidenceBadge`
- `QrWarningList`
- `QrValidationPanel`
- `QrValuationPanel`
- `QrRawPayloadPanel`
- `QrParsedFieldsPanel`
- `QrTotalsCard`
- `QrExportToolbar`
- `QrFiltersBar`
- `QrDetailDrawer` or `QrDetailPage`
- `QrCorrectionForm`
- Reuse existing `TableSkeleton`, `EmptyState`, `SectionCard`, `PageHeader`, and existing modal shell patterns

7. Suggested implementation order
- Immediate:
  - add QR Operations routes and nav entry
  - add API wrappers for QR summary, list, detail, CSV, and PDF
  - build the QR review queue list
  - show status, confidence, validation warnings, valuation status, and valuation warnings in the list
- Short-term:
  - add the QR detail page
  - add correction/edit flow
  - add export buttons
  - add report filters shared between summary, list, and export
- Next:
  - wire dashboard cards to QR workflow metrics
  - add richer drill-down from dashboard to QR detail

8. Risks/problematic areas
- The biggest gap is not visuals; it is missing workflow surfaces.
- The current dashboard and reports APIs are still sales-oriented, so QR Operations needs its own admin surface.
- The frontend currently has no unified reporting state model, so filters may drift if reused poorly.
- The supplier QR tester is close to the needed UX pattern, but it is not the same as a queue/review workflow.
- Existing admin components are clean enough to reuse, but duplicating new QR cards, modals, and tables without a shared pattern will create drift fast.
- There is no evidence of fake or demo data in the current admin core flow; the issue is incompleteness, not mock logic.
