# Capture Session Impact Plan

## 1. Executive Summary

Live code already has a working batch layer, the CaptureSession backend API layer now exists, the admin Sales page now has live session/batch/item views, and the admin settlement page now has live session, supplier-section, and item-ledger report views. Mobile now also has live capture-session screens, and the backend report query layer now supports item-ledger, session, and supplier-section scopes:

- `Sale` remains the item-level audit record.
- `ScanBatch` is the parent operational container for a single supplier.
- `CaptureSession` adds a higher-level umbrella for customer/request workflows, with live backend routes and controller/service wiring.
- `POST /api/v1/sales` accepts optional `batchId` and saves batch-aware sales directly.
- Admin already has batch create/review/finalize/reopen UI, plus live capture-session list/create/detail UI.
- Mobile already has batch detail, scanner, sale entry, online-only batch-aware capture, and live capture-session list/create/detail screens.

Based on the verified implementation, `ScanBatch` should remain the live operational unit for single-supplier work. The new `CaptureSession` layer exists as a higher-level umbrella for customer/request workflows, the backend APIs plus admin session UI are live, mobile session UI is live, and the admin/backend report UI and query foundation are now live while only any extra reporting polish or export expansion remains intentionally unwired.

The live batch services now best-effort refresh parent `CaptureSession` aggregates after batch changes, but session submit/finalize remains explicit and manual.

Recommendation:

- keep `ScanBatch` as the supplier-scoped working container
- keep `Sale` as the item-level audit record
- do **not** convert `ScanBatch` into a multi-supplier container
- use `CaptureSession` only as a parent umbrella over multiple supplier-specific `ScanBatch` records
- keep the new session layer backend API live, keep the admin session UI live, keep the mobile session UI live, and use the new backend report scopes and admin settlement page as the current foundation while deferring only remaining polish or export expansion until it is scheduled

## 2. Live Files Inspected

Backend:

- `backend/src/models/Sale.js`
- `backend/src/models/ScanBatch.js`
- `backend/src/controllers/sales.controller.js`
- `backend/src/controllers/batches.controller.js`
- `backend/src/routes/sales.routes.js`
- `backend/src/routes/batches.routes.js`
- `backend/src/services/batch.service.js`
- `backend/src/services/batchLifecycle.service.js`
- `backend/src/services/settlementReports.service.js`
- `backend/src/services/saleCalculationSnapshot.service.js`

Mobile:

- `mobile/lib/main.dart`
- `mobile/lib/features/batches/domain/batch_capture_context.dart`
- `mobile/lib/features/batches/domain/batch_models.dart`
- `mobile/lib/features/batches/presentation/batch_detail_screen.dart`
- `mobile/lib/features/batches/presentation/create_batch_screen.dart`
- `mobile/lib/features/batches/presentation/my_batches_screen.dart`
- `mobile/lib/features/scanner/presentation/scanner_screen.dart`
- `mobile/lib/features/scanner/presentation/scanner_launch_args.dart`
- `mobile/lib/features/sale_entry/presentation/sale_entry_screen.dart`
- `mobile/lib/features/sale_entry/presentation/sale_entry_launch_args.dart`
- `mobile/lib/features/sale_entry/presentation/sale_entry_provider.dart`
- `mobile/lib/features/sale_entry/data/sale_repository.dart`

Admin:

- `admin-panel/src/pages/sales/SalesPage.jsx`
- `admin-panel/src/pages/sales/components/SalesRecordsTable.jsx`
- `admin-panel/src/pages/sales/components/BatchRecordsTable.jsx`
- `admin-panel/src/pages/sales/components/BatchCreateModal.jsx`
- `admin-panel/src/pages/sales/components/BatchDetailModal.jsx`
- `admin-panel/src/pages/sales/components/SaleDetailModal.jsx`
- `admin-panel/src/pages/suppliers/SupplierFormPage.jsx`
- `admin-panel/src/pages/settlement-workflow/SettlementReportsPage.jsx`
- `admin-panel/src/pages/settlement-workflow/ExceptionsPage.jsx`
- `admin-panel/src/pages/settlement-workflow/ExceptionDetailPage.jsx`

Docs reviewed for conflicts:

- `docs/CURRENT_SYSTEM_UNDERSTANDING.md`
- `docs/MEETING_BASED_REDESIGN_PLAN.md`
- `docs/SALES_BATCH_WORKFLOW_REDESIGN_PLAN.md`
- `docs/MOBILE_BATCH_WORKFLOW_IMPLEMENTATION_PLAN.md`
- `docs/ADMIN_PANEL_CURRENT_STATE_FOR_UI_REDESIGN.md`

## 3. Verified Current Architecture

### 3.1 Item-level truth remains `Sale`

The live `Sale` model still holds the audit truth for each jewellery item:

- QR raw payload
- duplicate state
- parsed snapshot
- calculation snapshot
- settlement inputs
- sale date
- supplier/salesman linkage
- optional `batchId`
- batch metadata like `revisionAdded`, `entryMode`, `addedBy`, `addedAt`

That means the item ledger is still the source of record.

### 3.2 `ScanBatch` is already a single-supplier operational container

The live `ScanBatch` schema requires a supplier and an assigned salesman.

Verified fields:

- `batchRef`
- `supplierId` required
- `supplierCode`
- `salesmanId`
- `assignedSalesmanId` required
- `status`
- `revision`
- `entryMode`
- `itemCount`
- `totals`
- `warningsCount`
- `reviewCount`
- `duplicateCount`
- `manualOverrideCount`
- `submittedAt`, `finalizedAt`, `reopenedAt`
- embedded `revisions[]`

This is already a session-like record, but scoped to one supplier.

### 3.3 Backend sale creation already supports batch-aware capture

`POST /api/v1/sales` now accepts optional `batchId`.

When present, live code:

- validates the batch id
- loads the batch
- checks permissions and batch mutability
- checks supplier match
- stores `batchId` on the new sale
- stores batch provenance metadata on the sale
- refreshes batch aggregates after save
- returns a batch summary in the response

Standalone sale creation still works when `batchId` is absent.

### 3.4 Mobile batch capture already exists for assigned batches

The mobile app already has:

- batch list
- batch create
- batch detail
- batch revision history
- batch capture notice
- scan item from batch detail
- manual add from batch detail
- threaded batch context into scanner and sale entry
- batch-aware live submit context

So the current mobile workflow already treats `ScanBatch` as the capture container.

### 3.5 Admin batch review already exists

The admin panel already has:

- batch list / batch view toggle in Sales
- session list / batch view / item view toggle in Sales
- session create modal
- session detail modal with child batches, totals, and actions
- create batch modal
- batch detail modal
- submit/finalize/reopen actions
- revision history visibility
- item-level sale detail audit modal

There is now a separate parent session UI in admin. The existing batch and item views remain available.

## 4. Stale / Conflicting Doc Statements

The live code conflicts with some older doc wording.

### 4.1 `docs/CURRENT_SYSTEM_UNDERSTANDING.md`

Stale phrasing that should be treated as historical unless it says the batch flow is partially live:

- older wording that implied mobile batch capture was still pending
- older wording that implied batch/session foundation was only a future idea

### 4.2 `docs/MEETING_BASED_REDESIGN_PLAN.md`

Stale or mixed wording includes:

- descriptions that still frame batch/session support as future-only
- mentions that mobile batch UI remains next-phase work without reflecting the current partial implementation
- statements that imply a separate batch/session layer is still to be invented from scratch

### 4.3 `docs/SALES_BATCH_WORKFLOW_REDESIGN_PLAN.md`

Stale or mixed wording includes:

- early sections that describe `ScanBatch` as proposed rather than implemented
- references to batch/session behavior that do not reflect the live `batchId` support in `POST /api/v1/sales`
- any language that suggests admin batch review UI does not exist yet

### 4.4 `docs/MOBILE_BATCH_WORKFLOW_IMPLEMENTATION_PLAN.md`

Stale or mixed wording includes:

- statements that batch context is not threaded through mobile yet
- statements that `POST /api/v1/sales` does not accept `batchId`
- older wording that still implied offline retry handling instead of live network failure handling

### 4.5 `docs/ADMIN_PANEL_CURRENT_STATE_FOR_UI_REDESIGN.md`

This doc is mostly aligned with the current admin flow, but any supplier-form or sales-page wording that predates the current structured settings and batch review UI should be treated as historical.

## 5. Is `CaptureSession` Recommended?

### Short answer

**Not for the current live workflow.**

### Why not

Because the live `ScanBatch` already covers the current operational need:

- one supplier
- one assigned salesman
- one revision chain
- one batch ref
- one set of totals
- one mobile capture context
- one admin review lifecycle

Adding `CaptureSession` now would duplicate most of the same semantics without solving a live gap.

### When `CaptureSession` would make sense later

A parent `CaptureSession` becomes useful only if the business wants a higher-level umbrella for:

- one customer/job/visit spanning multiple suppliers
- multiple `ScanBatch` records under one session
- session-level revision or export history across batches
- multi-day or multi-stage capture workflows that cannot fit into one supplier batch

That is a different product shape than the current codebase uses.

## 6. Recommended Model Direction

### Current model

Keep the current two-level structure:

- `Sale` = item-level audit record
- `ScanBatch` = supplier-scoped operational container

### Added foundation

The backend now has an optional `CaptureSession` foundation:

- `CaptureSession`
  - owns session identity and customer/job context
  - can contain one or more `ScanBatch` records
- keep `ScanBatch` as the supplier-specific unit of work inside the session
- keep `Sale` attached to `ScanBatch`, not directly to `CaptureSession`

### Why this layered model is safer

It preserves the current audit path:

- item truth stays in `Sale`
- supplier workflow stays in `ScanBatch`
- umbrella workflow, if ever needed, stays in `CaptureSession`

## 7. Why Multi-Supplier `ScanBatch` Is Rejected

A single `ScanBatch` that mixes multiple suppliers would break the current design in several ways:

- supplier-specific pricing and settlement rules become ambiguous
- assignment to one salesman no longer matches supplier ownership cleanly
- batch validation becomes weaker because supplier checks can no longer be enforced
- batch-level revision history becomes harder to interpret
- admin review actions become less predictable
- mobile capture context becomes more confusing for the salesperson
- reports and exports would need custom supplier partitioning inside one batch
- the current backend and UI already assume one supplier per batch

So the safest answer is:

- do not make `ScanBatch` multi-supplier
- if multi-supplier grouping is needed, add a parent `CaptureSession` above it instead

## 8. Mobile UX Recommendation

### Current best fit

The current mobile UX should stay batch-centric, not session-centric, for now.

The current batch flow already gives the operator a clear sequence:

- pick or create a batch
- scan or add items for that batch
- review the batch detail
- submit when ready

### If `CaptureSession` is added later

The mobile UI would need a top-level session selector/creator before batch capture:

- create or open session
- choose supplier batch inside the session
- capture items into that batch
- optionally switch suppliers while staying inside the session

### Recommended UX now

- keep `My Batches` as the primary entry point
- keep batch detail as the capture hub
- do not introduce a session-first mobile screen until there is a confirmed multi-supplier requirement

## 9. Admin UX Recommendation

### Current best fit

The admin panel should continue to treat `ScanBatch` as the main operational grouping.

Current useful admin actions already are:

- create batch
- assign salesman
- review items
- submit
- finalize
- reopen
- inspect revision history

### If `CaptureSession` is added later

Admin would need a higher-level hierarchy:

- session list
- session detail
- session-level summary cards
- session containing multiple batches
- per-batch drilldown inside the session

### Recommendation now

- keep admin batch review as-is
- do not add a session layer to admin until the business needs cross-supplier grouping

## 10. Reporting Recommendation

### Current reporting fit

Reporting is still sale-backed and item-level first.

That works well because:

- `Sale` already stores snapshots and settlement inputs
- item-level reports remain audit-friendly
- batch totals can be derived from item rows when needed

### If `CaptureSession` is added later

Reporting should stay item-first and only add session rollups as a second lens:

- item rows remain the source of record
- batch rollups aggregate the sale rows inside each batch
- session rollups aggregate the batches inside a session

### Recommendation now

- do not redesign reporting around `CaptureSession`
- keep settlement reporting anchored on `Sale` and current batch summaries

## 11. Live Capture Session API Surface

The backend now has a live `CaptureSession` API layer:

- `POST /api/v1/capture-sessions`
- `GET /api/v1/capture-sessions`
- `GET /api/v1/capture-sessions/:id`
- `POST /api/v1/capture-sessions/:id/refresh`
- `POST /api/v1/capture-sessions/:id/batches`
- `POST /api/v1/capture-sessions/:id/batches/attach`
- `POST /api/v1/capture-sessions/:id/submit`
- `POST /api/v1/capture-sessions/:id/finalize`
- `POST /api/v1/capture-sessions/:id/cancel`

Batch mutation behavior:

- batch create/add/submit/finalize/reopen operations now best-effort refresh parent session aggregates
- explicit `POST /api/v1/capture-sessions/:id/refresh` remains available for manual reconciliation
- batch changes do **not** auto-submit or auto-finalize the session; those lifecycle steps remain explicit
- `POST /api/v1/capture-sessions/:id/batches/attach` is admin-only and still requires supplier and assignment compatibility

Relationship to current APIs:

- `POST /api/v1/sales` continues to accept optional `batchId`
- `ScanBatch` remains the supplier-scoped parent of `Sale`
- `CaptureSession` owns child batches as an umbrella, not as a replacement for `ScanBatch`

Important constraint:

Do not move sale creation to a session-only contract unless the business explicitly wants session-first capture.

## 12. Implementation Phases

### Phase 0: Backend session API is live

- create/list/detail session APIs
- create supplier batch inside a session
- attach an existing compatible batch when safe
- submit/finalize/cancel session APIs
- explicit refresh endpoint for aggregates

### Phase 1: Keep the current supplier batch workflow

- batch create
- batch capture on mobile
- batch review in admin
- sale-level audit in detail views
- settlement reporting remains sale-backed

### Phase 2: Add remaining mobile session reporting only after the model is stable

- mobile session entry points are live
- session reporting / rollups by session

Admin session drilldowns are already live in Sales.

## 13. Main Risks

- duplicating batch semantics with a second container too early
- confusing operators with both session and batch concepts before the business need is proven
- weakening supplier-based validation by making one batch cover too many responsibilities
- adding reporting complexity before the operational workflow is settled
- creating migration overhead for no immediate user benefit

## 14. Open Questions Requiring Product Decision

- Do we actually need one container per customer/job, or is one supplier batch enough for the real shop workflow?
- The live backend session layer currently allows multiple distinct suppliers inside one session and rejects duplicate suppliers within that session; is that the intended business boundary?
- Should mobile remain batch-first, or do we want a session-first landing screen?
- Should admin see sessions, or should batch remain the only operational grouping?
- Is the long-term reporting unit the batch or the session?
- Do we need cross-supplier settlement in one workflow, or are supplier-specific batches the right business boundary?

## 15. Bottom Line

Current live code already implements a usable capture container, and the backend now also includes a live CaptureSession API layer:

- `Sale` for the item
- `ScanBatch` for the supplier-scoped work unit
- admin review around the batch
- mobile capture around the batch

So the current recommendation is:

- **keep `CaptureSession` API, admin UI, and mobile session UI live while reporting remains scheduled for a later phase**
- **do not make `ScanBatch` multi-supplier**
- **keep the present batch architecture for single-supplier work**
