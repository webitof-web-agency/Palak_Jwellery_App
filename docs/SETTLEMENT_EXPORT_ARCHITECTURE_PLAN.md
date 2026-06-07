# Settlement Export Architecture Plan

## 1. Executive Summary

The live code now supports scope-aware settlement exports for three scopes:

- `Session Reports`
- `Supplier Section Reports`
- `Item Ledger`

The report query layer, admin reporting UI, and the current backend item-ledger export paths are all live. The backend export architecture for supplier-section and session scopes is now implemented as official attachment downloads, while the existing browser-side item-ledger print preview remains as a compatibility convenience.

This document is now the live export architecture reference. It documents the verified paths, the remaining technical debt, and the follow-up items that remain intentionally deferred.

Recommended direction:

- keep item-ledger export compatibility intact
- add scope-aware export support for supplier-section and session reporting
- make backend-generated PDF the official export source
- keep browser-side print preview only as a convenience path until the UI is unified
- generate exports on demand in v1
- do not store PDF files unless a later requirement explicitly needs immutable artifacts

## 2. Verified Existing Export Paths

### 2.1 Item-ledger CSV export

Live path:

- `GET /api/v1/reports/settlement/export.csv`

Current behavior:

- protected by `authenticate` and `requireRole('admin')`
- uses `listSettlementRows(req.query)` to fetch item-ledger rows
- renders CSV via `buildSettlementCsv(rows)`
- response headers:
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="settlement-reports-YYYY-MM-DD.csv"`

Current filename logic:

- based on the current date only
- does not encode scope beyond the item-ledger semantics already implied by the route

### 2.2 Item-ledger PDF route

Live path:

- `GET /api/v1/reports/settlement/export.pdf`

Current behavior:

- protected by `authenticate` and `requireRole('admin')`
- uses `listSettlementRows(req.query)` to fetch item-ledger rows
- renders PDF via `buildSettlementPdfBuffer(rows, summary, meta)`
- response headers:
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline; filename="..."`

Current filename logic:

- derived from supplier/report date through `buildSettlementFileName(...)`
- the file name is built server-side before the response is sent

### 2.3 Browser-side HTML print preview

Live path:

- `admin-panel/src/pages/settlement-workflow/SettlementReportsPage.jsx`
- `admin-panel/src/pages/settlement-workflow/settlementReportPrint.js`

Current behavior:

- the admin UI currently builds HTML with `buildSettlementPrintHtml(...)`
- it opens the preview in a new window with `window.open(...)`
- if popup opening fails, it falls back to downloading the generated HTML blob
- the toolbar in the preview uses `window.print()` for manual PDF output

This is a real divergence from the backend PDF route:

- backend has an official PDF buffer path
- admin UI currently uses browser print preview for the visible item-ledger PDF experience

### 2.4 Backend Puppeteer path

Live path:

- `buildSettlementPdfBuffer(rows, summary, meta)` in `backend/src/services/settlementReports.service.js`

Current behavior:

- generates HTML first
- launches Puppeteer with `headless: true`
- opens a page, injects HTML, and calls `page.pdf(...)`
- closes the browser on success

This is the official backend PDF generation path for settlement reporting.

### 2.5 Fallback PDF-buffer path

Live path:

- `buildSettlementPdfFallbackBuffer(rows, summary, meta)` in `backend/src/services/settlementReports.service.js`

Current behavior:

- used only when Puppeteer PDF generation fails
- returns a raw PDF buffer
- keeps the export route resilient on the VPS

### 2.6 QR exception CSV/PDF exports

Live paths:

- `GET /api/v1/reports/qr/export.csv`
- `GET /api/v1/reports/qr/export.pdf`

Current behavior:

- protected by `authenticate` and `requireRole('admin')`
- CSV uses `buildCsvExport(...)` from `backend/src/services/qrReporting.service.js`
- PDF uses `buildPdfBuffer(...)` from the same service
- QR export filenames are timestamp-based:
  - `qr-report-<timestamp>.csv`
  - `qr-report-<timestamp>.pdf`

### 2.7 Current filter propagation

The admin API helper currently forwards these query keys:

- `scope`
- `page`
- `limit`
- `search`
- `supplier`
- `session`
- `customer`
- `assignedSalesman`
- `status`
- `category`
- `metalType`
- `startDate`
- `endDate`
- `sortBy`
- `sortOrder`

The settlement controller passes `req.query` through to the report service, so export endpoints and list endpoints currently share the same filter payload.

The new scoped export routes are live and admin-only:

- `GET /api/v1/reports/settlement/sessions/:sessionId/export.csv`
- `GET /api/v1/reports/settlement/sessions/:sessionId/export.pdf`
- `GET /api/v1/reports/settlement/supplier-sections/:batchId/export.csv`
- `GET /api/v1/reports/settlement/supplier-sections/:batchId/export.pdf`

They return `Content-Disposition: attachment`.

### 2.8 Current authorization rules

All settlement and QR report routes are admin-only:

- `authenticate`
- `requireRole('admin')`

This should remain unchanged for export routes.

### 2.9 Existing technical debt and unsafe assumptions

- There are two item-ledger PDF experiences:
  - backend official PDF buffer route
  - browser-side print preview
- QR exports have their own independent PDF path, so there is no shared export renderer yet.
- Session and supplier-section report views are live, and their export surface is now unified through dedicated backend resource routes.
- Current item-ledger exports are not scope-aware beyond the existing route behavior.
- Historical export traceability is not yet represented as a formal export artifact model.

## 3. Stale / Conflicting Documentation

The following docs still contain wording that is stale, mixed, or historical relative to the live code:

- `docs/CURRENT_SYSTEM_UNDERSTANDING.md`
  - still has sections that read as if session and supplier-section reporting are future work, even though the live admin UI and backend query layer already support them
  - still contains historical language around queue/replay and older workflow assumptions
- `docs/SESSION_FIRST_WORKFLOW_AND_REPORTING_PLAN.md`
  - still mixes historical planning language with live-state wording
  - still contains some queue/replay and export-planning phrasing that should be cleaned up in a later targeted docs pass
- `docs/CAPTURE_SESSION_IMPACT_PLAN.md`
  - still has sections that read like the capture-session layer is only a future recommendation, while the live backend API layer and admin/mobile session UI already exist
- `docs/SALES_BATCH_WORKFLOW_REDESIGN_PLAN.md`
  - still mixes historical export and revision-planning language with live settlement/reporting behavior

Cleanup list for a later docs-only pass:

- remove any wording that claims session-report UI does not exist
- remove any wording that claims supplier-section-report UI does not exist
- update model inventories that omit `ScanBatch` or `CaptureSession`
- update mobile screen inventories that omit `My Sessions`, `My Batches`, or `Batch Detail`
- remove any queue/replay wording that no longer matches live mobile behavior

## 4. Locked Reporting Rules

These rules are fixed for the export architecture:

1. Official Session Reports are finalized-session only.
2. Official Supplier Section Reports are finalized-batch only.
3. Supplier Section Reports use the latest finalized revision only.
4. Item Ledger remains Sale-level audit.
5. Legacy QR fallback remains isolated:
   - only when no `Sale` rows exist
   - never mixed with `Sale` rows
6. Reopened supplier sections must not overwrite historical exports.
7. Combined official session reporting must not silently include open or reopened child changes.
8. PDF and CSV exports should be generated on demand in v1.
9. Do not store PDF files in v1 unless the live code or a later requirement explicitly needs it.
10. Draft preview export is deferred unless there is a clear product justification.
11. No OCR.
12. No offline export workflow.
13. No mobile export UI in this phase.
14. No new dependencies unless unavoidable.

## 5. Export Scopes

### 5.1 Item Ledger Export

Existing behavior should remain available.

CSV:

- item-level rows

PDF:

- item-level printable ledger

Notes:

- this remains the compatibility export
- the current browser preview can remain as a convenience, but the backend PDF route remains the official server-controlled path

### 5.2 Supplier Section Export

One finalized `ScanBatch` revision.

CSV:

- supplier-section summary
- item rows belonging to the selected finalized revision

PDF:

- supplier header
- session reference if linked
- supplier details
- revision
- finalized timestamp
- item table
- gross / stone / other / net / fine / stone amount totals
- warnings / review / duplicate / manual-override counts where useful
- calculation context where business-readable

Rules:

- support an explicit finalized revision when the business needs to revisit a historical export
- do not use an open or reopened revision as the official supplier-section export target

### 5.3 Session Combined Export

One finalized `CaptureSession`.

CSV:

- session summary
- supplier-section breakdown
- item rows grouped by supplier section

PDF:

- session header
- optional customer/reference details
- overall totals
- supplier summary table
- supplier-wise sections
- item rows under each supplier
- final totals
- finalized timestamp

Rules:

- block the current official combined export while any child supplier section has pending changes
- do not silently include open or reopened child revisions in the official combined output

## 6. Revision-Safe Export Rules

Recommended answers to the key revision questions:

1. Is current official session export blocked until a reopened child revision is finalized?
   - Yes.
   - The current official combined session export should be blocked while any child supplier section has pending changes.

2. Can the old finalized combined export remain downloadable?
   - Only if it is still represented by a reproducible finalized snapshot or later stored export metadata.
   - In v1, the plan should favor on-demand regeneration from finalized snapshots rather than storing binary artifacts.

3. Should the export endpoint return a clear conflict code while changes are pending?
   - Yes.
   - Use a specific export conflict code so the admin UI can explain why the download is blocked.

4. Should supplier-section export still allow historical finalized revisions?
   - Yes.
   - Historical finalized revisions are useful for audit and traceability.

5. Should the export route accept explicit revision number?
   - Yes, for supplier-section exports.
   - Session combined exports should derive from the current finalized state of all child supplier sections instead of an arbitrary child revision selector.

6. How should latest finalized revision be selected?
   - Use the highest revision that is explicitly finalized.
   - If the batch root is finalized but the embedded revisions do not contain a finalized snapshot, use the synthesized finalized root snapshot only if the live code already supports that fallback rule.

7. How do we prevent double counting across revisions?
   - Use only one selected finalized revision per supplier section.
   - Exclude any reopened or open revision from official export totals.
   - Never aggregate both the current revision and a historical finalized revision together.

8. Do we need export metadata immediately?
   - Not immediately for v1.
   - Export metadata is useful later, but on-demand export generation is the right default first step.

## 7. Recommended API Routes

Recommended route strategy:

- keep the existing item-ledger export endpoints for compatibility
- use dedicated resource routes for session and supplier-section exports
- use explicit revision targeting only where it matters, which is the supplier-section export

Recommended route set:

- `GET /api/v1/reports/settlement/export.csv?scope=item-ledger`
- `GET /api/v1/reports/settlement/export.pdf?scope=item-ledger`
- `GET /api/v1/reports/settlement/sessions/:sessionId/export.csv`
- `GET /api/v1/reports/settlement/sessions/:sessionId/export.pdf`
- `GET /api/v1/reports/settlement/supplier-sections/:batchId/export.csv?revision=...`
- `GET /api/v1/reports/settlement/supplier-sections/:batchId/export.pdf?revision=...`

Why this strategy is the cleanest:

- item-ledger compatibility is preserved
- resource identity is explicit for session and supplier-section exports
- revision targeting is available only where it is actually needed
- the API surface stays understandable without forcing every export into one overloaded query string
- the live implementation already follows this strategy

Recommended response headers:

- CSV:
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="..."`
- PDF:
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="..."`

Note:

- the current backend item-ledger route uses `inline` for PDF because the admin UI has a browser preview path
- new official session and supplier-section export routes should be treated as download-oriented artifacts

## 8. Service Design

Keep the code split into four layers:

### 8.1 Query / validation layer

Recommended helpers:

- `buildItemLedgerExportData(filters)`
- `buildSupplierSectionExportData(batchId, revision?)`
- `buildSessionExportData(sessionId)`
- `assertSessionExportable(session, batches)`
- `assertSupplierSectionExportable(batch, revision?)`

Responsibilities:

- validate IDs and revision selection
- enforce finalized-only rules
- enforce pending-change conflict checks
- load the exact export scope rows

### 8.2 Rendering layer

Recommended helpers:

- `renderItemLedgerCsv(data)`
- `renderSupplierSectionCsv(data)`
- `renderSessionCsv(data)`
- `renderItemLedgerPdf(data)`
- `renderSupplierSectionPdf(data)`
- `renderSessionPdf(data)`

Responsibilities:

- turn validated export data into CSV or PDF bytes
- keep rendering logic isolated from query logic
- preserve stable headers and filenames

### 8.3 Controller layer

Responsibilities:

- parse query/path params
- call the correct builder
- set headers
- handle conflict and not-found responses
- keep auth rules unchanged

### 8.4 Frontend preview layer

Responsibilities:

- keep browser-side print preview only for the existing item-ledger convenience flow
- do not duplicate the official backend PDF logic for the new scoped exports

This separation avoids over-abstracting while still keeping the responsibilities clear.

## 9. PDF Strategy

Recommended option: **Option C - backend PDF generation + optional frontend preview**

Why this is the best fit:

- the backend already has a Puppeteer path plus a fallback buffer path
- official settlement output should be server-controlled for consistency and auditability
- browser print output varies across environments, printers, fonts, and page settings
- the VPS deployment is a better place to standardize the final PDF than the user browser
- the browser preview is still useful as a convenience and review step

Recommended split:

- official exports:
  - backend-generated PDF
  - download-oriented
- preview convenience:
  - frontend HTML preview can remain for item-ledger review until the UI is unified

Important note:

- do not make the browser preview the source of truth for official session or supplier-section exports

## 10. CSV Structure

The CSV should remain machine-readable.

### 10.1 Supplier Section CSV

Recommended columns:

- `session_ref`
- `session_customer`
- `batch_ref`
- `supplier`
- `revision`
- `finalized_at`
- `sale_ref`
- `item_code`
- `design_code`
- `category`
- `metal`
- `karat`
- `purity`
- `wastage`
- `gross`
- `stone`
- `other`
- `net`
- `fine`
- `stone_amount`
- `duplicate_flag`
- `review_flag`
- `manual_override_flag`

### 10.2 Session CSV

Recommended columns:

- `session_ref`
- `customer_reference`
- `supplier`
- `batch_ref`
- `revision`
- `sale_ref`
- `item_code`
- `design_code`
- `category`
- `metal`
- `karat`
- `purity`
- `wastage`
- `gross`
- `stone`
- `other`
- `net`
- `fine`
- `stone_amount`
- `duplicate_flag`
- `review_flag`
- `manual_override_flag`

### 10.3 CSV layout recommendation

- keep item rows machine-readable
- do not mix summary rows into the main CSV body
- keep totals in the PDF, in API summary metadata, or in a separate response payload if needed later
- do not introduce a second summary CSV unless a real product need appears

### 10.4 Metal column note

The CSV can keep a `metal` column as a legacy audit field if the data exists, but the UI should not depend on it for core interpretation.

## 11. Admin UI Integration Plan

The Session Reports and Supplier Section Reports download actions are live in the admin panel.

### 11.1 Session Reports row actions

Recommended actions:

- `Download PDF`
- `Download CSV`
- `View details`

### 11.2 Supplier Section Reports row actions

Recommended actions:

- `Download PDF`
- `Download CSV`
- `View section`

### 11.3 Item Ledger actions

Recommended behavior:

- preserve the current item-ledger export controls
- keep the current item-ledger preview flow until the backend PDF path is used consistently

### 11.4 Loading and error behavior

Recommended UI states:

- show a spinner or progress state while the export is generating
- disable the export buttons while a request is in flight
- show a clear conflict message when the export is blocked by pending changes
- show a clear not-found or forbidden message when the user cannot export the requested resource

### 11.5 Filename behavior

Recommended naming pattern:

- session:
  - prefer the server-provided filename
  - fallback: `settlement-session-<sessionRef-or-id>.csv`
  - fallback: `settlement-session-<sessionRef-or-id>.pdf`
- supplier section:
  - prefer the server-provided filename
  - fallback: `settlement-section-<batchRef-or-id>.csv`
  - fallback: `settlement-section-<batchRef-or-id>.pdf`
- item ledger:
  - keep the existing item-ledger naming style for compatibility

### 11.6 Visibility rules

Recommended visibility:

- show official export actions only on finalized rows
- if the row is not finalized, keep the action hidden rather than rendering fake disabled buttons
- for session combined export, explicitly explain pending child changes

## 12. Error Codes

Recommended safe export errors:

- `INVALID_ID`
  - user-facing message: `The selected report target is invalid.`
- `NOT_FOUND`
  - user-facing message: `The requested session or supplier section could not be found.`
- `FORBIDDEN`
  - user-facing message: `You do not have permission to export this report.`
- `SESSION_NOT_FINALIZED`
  - user-facing message: `Finalize the session before exporting the official combined report.`
- `SESSION_HAS_PENDING_CHANGES`
  - user-facing message: `One or more supplier sections still have pending changes. Finalize them first.`
- `BATCH_NOT_FINALIZED`
  - user-facing message: `Finalize the supplier section before exporting it.`
- `REVISION_NOT_FOUND`
  - user-facing message: `The selected revision could not be found.`
- `REVISION_NOT_FINALIZED`
  - user-facing message: `Select a finalized revision to export.`
- `EXPORT_FAILED`
  - user-facing message: `The export could not be generated. Try again.`
- `SERVER_ERROR`
  - user-facing message: `Something went wrong while preparing the export.`

## 13. Validation Plan

Recommended validation scripts:

- `backend/scripts/check-supplier-section-export.js`
- `backend/scripts/check-session-export.js`
- existing item-ledger regression coverage
- reopened-revision regression coverage
- no-double-count regression coverage
- legacy fallback regression coverage

Validation status:

- both new export smoke scripts pass against the live backend
- the existing session, batch, sale, settlement, and parser regression scripts remain green
- backend PDF generation still falls back to the raw PDF buffer in this Windows environment when Puppeteer cannot spawn Chrome

Recommended test cases:

1. finalized supplier section exports
2. open supplier section rejected
3. explicit finalized historical revision exports
4. missing revision rejected
5. finalized session exports
6. open session rejected
7. reopened child blocks current session export
8. no double count across revisions
9. CSV headers stay stable
10. CSV zero values are preserved
11. PDF response content type is correct
12. filename is safe and deterministic
13. authorization is enforced
14. legacy item-ledger export remains unchanged
15. QR fallback gate remains unchanged

Recommended validation order:

- validate query selection first
- validate row shaping second
- validate header/filename behavior third
- validate PDF byte generation and fallback last

## 14. Implementation Phases

### Phase 1: Architecture lock

- approve the export scope model
- approve the route strategy
- approve the PDF strategy
- approve the CSV column model
- approve the revision safety rules

### Phase 2: Backend export helpers

- add export builders for item-ledger, supplier-section, and session
- add export validators for finalized-only and pending-change checks
- add conflict/error handling for export blocking
- keep item-ledger compatibility intact

### Phase 3: Official backend PDF and CSV wiring

- wire the supplier-section export routes
- wire the session export routes
- preserve the item-ledger export route
- keep backend PDF as the official export source

### Phase 4: Admin integration

- add row actions for session and supplier-section exports
- keep existing item-ledger controls
- add loading and error states
- add clear labels for pending-change blocks

### Phase 5: Metadata and history, only if needed

- add export metadata if the business wants persistent traceability
- add immutable file storage only if compliance requires it
- keep on-demand generation as the default

## 15. Risks

- browser preview and backend PDF can diverge if both are treated as official paths
- reopened revisions can double count if the export selector is not revision-aware
- historical export traceability becomes harder if export metadata is not captured later
- the VPS Puppeteer path can fail if font or browser dependencies are unstable
- keeping item-ledger, session, and supplier-section exports in the same product can confuse users unless the UI language stays consistent
- the `metal` field can become misleading if the QR source data is not trustworthy
- QR fallback isolation must stay strict so legacy records are never mixed with `Sale` rows

## 16. Open Product Questions

1. Should official downloads use `attachment` for all new export routes, or should any of them remain `inline` for preview compatibility?
2. Should historical finalized exports be stored as metadata only, or should immutable export files be persisted later?
3. Should the item-ledger PDF preview remain browser-based in v1, or should it eventually be moved to the backend PDF route exclusively?
4. Should supplier-section exports accept explicit historical revision selection in the admin UI from day one?
5. Should current official session export be blocked while child supplier sections are pending, or should a clearly labeled preview-only export be allowed?
6. Should the `metal` column remain in CSV exports as a legacy audit field, or should it be removed from exports later if no workflow depends on it?
7. Should session and supplier-section exports be exposed immediately in the current admin report page, or only after the export backend is finalized?
8. Should combined session exports include a separate supplier-summary footer, or is the supplier-wise section breakdown enough for v1?
