# Session-First Workflow and Reporting Plan

## 1. Executive Summary

The live code already supports a three-layer hierarchy:

- `CaptureSession` as the umbrella for one customer/request
- `ScanBatch` as one supplier-specific operational container
- `Sale` as the item-level auditable jewellery record

The product problem is not the backend shape. The problem is UX clarity. Normal shop users should not have to think in terms of both sessions and batches as separate mental models.

Recommendation:

- Keep the backend hierarchy intact.
- Merge the user-facing UX around a session-first flow.
- Keep a quick supplier-batch fallback only as a temporary advanced path during migration.
- Keep `Sale` as the item-level truth.
- Build reporting in layers: Session Reports, Supplier Section Reports, then the current Item Ledger.

This is Option B:

- keep backend hierarchy
- merge UX
- do not physically merge models unless a future product decision proves that necessary
- the admin settlement report page now also exposes live PDF/CSV download buttons for finalized session and supplier-section rows while keeping the item-ledger preview flow intact

## 2. Verified Live Architecture

### Backend hierarchy

`CaptureSession`

- optional umbrella for one customer/request
- fields confirmed in live code:
  - `sessionRef`
  - `customerName`
  - `customerPhone`
  - `referenceNote`
  - `assignedSalesmanId`
  - `status`
  - `batchIds`
  - `totals` with `supplierCount`, `itemCount`, `grossWeight`, `stoneWeight`, `otherWeight`, `netWeight`, `fineWeight`, `stoneAmount`
  - `warningsCount`
  - `reviewCount`
  - `duplicateCount`
  - `manualOverrideCount`
  - `createdBy`
  - `submittedAt`
  - `submittedBy`
  - `finalizedAt`
  - `finalizedBy`
  - `cancelledAt`
  - `cancelledBy`
  - `cancelReason`
- default status: `draft`
- timestamps enabled

`ScanBatch`

- one supplier-specific operational container
- fields confirmed in live code:
  - `batchRef`
  - `supplierId`
  - `supplierCode`
  - `sessionId`
  - `salesmanId`
  - `assignedSalesmanId`
  - `customerName`
  - `customerPhone`
  - `referenceNote`
  - `status`
  - `revision`
  - `entryMode`
  - `itemCount`
  - `totals`
  - `warningsCount`
  - `reviewCount`
  - `duplicateCount`
  - `manualOverrideCount`
  - `createdBy`
  - `submittedAt`
  - `submittedBy`
  - `finalizedAt`
  - `finalizedBy`
  - `reopenedAt`
  - `reopenedBy`
  - `reopenReason`
  - revision history / export metadata embedded in the batch document
- default status: `draft`
- one supplier per batch remains enforced

`Sale`

- item-level audit truth
- fields confirmed in live code:
  - `batchId`
  - `revisionAdded`
  - `entryMode`
  - `addedBy`
  - `addedAt`
  - `calculationSnapshot`
  - `parsedSnapshot`
  - `settlementInputs`
  - the usual item fields and weights
- old sales with `batchId = null` remain valid

### Live enforcement rules

- one supplier per `ScanBatch`
- one supplier may appear only once per `CaptureSession`
- `Sale` remains the saved item row, not a replacement for batch/session containers
- batch and session status transitions are explicit and lifecycle-driven
- reopened revisions are preserved in batch history
- session aggregates refresh best-effort from child batches
- explicit session submit/finalize remains manual
- old standalone batches with `sessionId = null` remain valid
- old unbatched sales with `batchId = null` remain valid

## 3. Stale / Conflicting Docs

The docs are mostly aligned now, but a few still mix historical wording with current live behavior.

- `docs/CURRENT_SYSTEM_UNDERSTANDING.md`
  - contains both current live-state notes and older historical phrasing
  - some sections still read like future planning even though the features are already live
- `docs/CAPTURE_SESSION_IMPACT_PLAN.md`
  - still mixes implementation status with planning language in a few places
  - some parts describe the session layer as if it were still only a concept, even though the backend and admin/mobile session screens exist
- `docs/MOBILE_BATCH_WORKFLOW_IMPLEMENTATION_PLAN.md`
  - mostly current, but still frames some reporting polish as next-step work
  - the live mobile session flow is now broader than the older wording suggests
- `docs/SALES_BATCH_WORKFLOW_REDESIGN_PLAN.md`
  - still interleaves current live `batchId` support with older recommendation text
  - should be read as a design history document, not a strict source of truth
- `docs/MEETING_BASED_REDESIGN_PLAN.md`
  - contains older future-first language and some encoding artifacts
  - useful for background, but not the best source for current live behavior

`UNCLEAR` items in the docs:

- whether a future customer-facing session reference should be shown externally
- whether draft preview PDFs should be considered official or only operational
- whether the normal mobile UI should eventually remove the word `Batch` entirely or keep it as a secondary technical label

## 4. Current Mobile UX

### Dashboard

The live mobile app exposes:

- `My Sessions`
- `My Batches`
- scanner routes
- sale entry routes
- sales history routes
- a backend fallback screen when connectivity/backend status fails

### Session flow

Live session screens exist:

- `My Sessions`
- `Create Session`
- `Session Detail`

Current session behavior:

- users can create a session
- users can add supplier batches to a session
- session detail shows the supplier batch list
- session submit is explicit
- admin finalize/cancel actions exist where allowed

### Batch flow

Live batch screens exist:

- `My Batches`
- `Create Batch`
- `Batch Detail`

Current batch behavior:

- batches are supplier-specific
- scan QR and manual add both exist in batch capture
- batch submit exists and is only enabled when items exist
- batch detail supports item capture, submit, and revision/history drill-down
- scanner launches sale entry with batch context

### Sale entry flow

Current sale entry behavior:

- scan-first flow is live
- manual edits are available before save
- restore action returns the form to the scanned state
- supplier mismatch in batch mode is blocked
- on success, the app returns to the batch detail screen when a batch context exists
- the existing no-internet fallback screen is used when the backend/network is not available
- the live app no longer uses the old queue/replay path

### Queue/replay status

The live mobile code does not use a pending queue or replay banner anymore.

That is good for v1 simplicity:

- fewer hidden states
- no orphan replay behavior
- clearer failure handling
- one network failure path through the fallback screen

## 5. Current Admin UX

The live admin sales area already exposes three views:

- Session View
- Batch View
- Item View

Current behavior:

- Batch View is still the default landing view
- Session View exists and is fully wired
- Item View remains the ledger/audit view
- admin can inspect session detail, batch detail, and sale detail

### Session View

Current session view supports:

- listing sessions
- filtering sessions
- create session
- open session detail
- add supplier batches to a session
- submit/finalize/cancel actions where allowed

### Batch View

Current batch view supports:

- listing supplier-specific batches
- filtering batches
- create batch
- open batch detail
- submit batch
- finalize/reopen batch
- revision history drill-down

### Item View

Current item view supports:

- sale list filtering
- sale detail audit modal
- parsed snapshot
- calculation snapshot
- settlement inputs

### Settlement workflow admin UX

The current settlement workflow page is now scope-aware in the admin UI, with live session, supplier-section, and item-ledger views backed by the backend query layer:

- it shows finalized rows for all three scopes
- it supports the relevant filters for each scope
- session and supplier-section summaries preserve aggregate item counts rather than row counts
- finalized session rows show `View session`, `Download PDF`, and `Download CSV`
- finalized supplier-section rows show `View section`, `Download PDF`, and `Download CSV`
- it supports CSV export in the item-ledger view
- it supports PDF export / preview in the item-ledger view
- it uses a frontend print-preview flow for the admin PDF button

## 6. Current Settlement Reporting

### Data source

Current settlement reporting is built from `Sale` first at the UI level for the default item-ledger view, and the backend now exposes scoped queries for item-ledger, session, and supplier-section reporting with dedicated admin UI tabs.

Fallback behavior:

- if there are no `Sale` rows, the backend falls back to legacy `QrIngestion` records
- it does not mix both sources in the same report path

### Report row behavior

Current settlement rows are item-ledger rows:

- each row represents one finalized sale item
- rows are not session summaries
- rows are not supplier-section summaries
- rows are not revision-aware in the sense needed for session-first reporting

### Current fields in the settlement table

Visible settlement fields include:

- supplier
- category
- metal
- design code / item code
- gross
- stone
- wastage
- net
- purity
- fine
- stone amount
- recorded timestamp

### CSV behavior

- backend CSV export exists
- it is generated from the settlement row list
- it is a finalized item-ledger export

### PDF behavior

- backend PDF export route exists and returns an inline PDF response
- the current admin page also has a frontend HTML print-preview flow
- the preview flow is the one the admin UI currently uses directly

### Filters

Current settlement report filters cover:

- search
- supplier
- category
- metal type
- date range

### Lineage visibility

Current settlement rows do not surface the full session/batch lineage directly.

They can be derived in backend logic if needed:

- `Sale.batchId` exists
- `ScanBatch.sessionId` exists

But the current report UI is not session-aware yet.

### Main current risks

- no session report view yet in the admin UI, even though the backend session report query now exists
- no supplier-section report view yet in the admin UI, even though the backend supplier-section report query now exists
- no revision-aware aggregation across reopened batches
- risk of double counting if reopened work produces multiple finalized item rows and the report layer does not dedupe by latest finalized revision
- report preview and backend PDF export are not yet a single unified user journey

## 7. Arguments Against Session-First UX

### Real risks

- Single-supplier work can take extra clicks if Session becomes mandatory too early
- Migration can confuse users if both batch and session terms stay visible without a clear hierarchy
- Revision coordination is harder when one session contains multiple supplier sections
- Settlement reporting becomes more complex because the report layer must become revision-aware
- Admin and mobile workflows must agree on what is final vs what is still in progress
- Forcing a session for every small job could slow down operators who only need one supplier batch

### Manageable risks

- Quick Supplier Batch can remain as an advanced fallback during migration
- Legacy screens can stay visible until the new hierarchy is stable
- Labels can be changed without changing the backend hierarchy
- Report complexity can be handled incrementally with query layers and revision rules

### Non-issues

- One supplier per `ScanBatch` is already enforced
- `Sale.batchId` already exists
- session screens already exist in admin and mobile
- the old offline queue/replay path is gone, so the failure model is simpler

## 8. Arguments For Session-First UX

- Matches how shop owners think: one customer/request, then supplier-wise sections underneath
- Supports combined request-level reporting
- Makes supplier-wise totals clearer
- Keeps item-level audit drill-down intact through `Sale`
- Reduces the mental split between "session" and "batch" for normal users
- Better fits multi-supplier work requests
- Makes later settlement/report history cleaner if the report layer is built on the same hierarchy
- Gives a strong top-level request summary while preserving supplier-specific detail below it

## 9. Options Compared

### Option A: Physically merge CaptureSession and ScanBatch

What it means:

- one model would hold multiple suppliers and items directly

Why not:

- would break the one-supplier-per-batch rule
- would make revision handling harder
- would weaken the current clean separation between request container and supplier container
- would be disruptive to existing records and live APIs

Recommendation:

- reject this option

### Option B: Keep backend hierarchy but merge UX

What it means:

- `CaptureSession` stays the umbrella
- `ScanBatch` stays the supplier section
- `Sale` stays the item truth
- the UX makes sessions primary and batches secondary/sectional

Why this is best:

- preserves the live backend
- keeps migration low-risk
- supports session-first mental modeling
- lets reporting evolve cleanly
- keeps legacy records valid

Recommendation:

- choose this option

### Option C: Keep both separate in UX and backend

What it means:

- sessions stay sessions
- batches stay batches
- item ledger stays separate

Why it is weaker:

- users still have to think in two operational concepts
- the current product remains split between two workflows
- it does not actually simplify the shop-owner experience

Recommendation:

- acceptable only as a temporary fallback, not as the end state

## 10. Recommended Product Direction

Recommended direction:

- keep the backend hierarchy as-is
- make the primary user-facing language session-first
- use supplier section terminology in normal user-facing surfaces where it reduces confusion
- keep quick batch as an advanced fallback during migration
- keep the current item ledger intact
- do not physically merge models

Practical wording strategy:

- mobile primary labels: `Session`, `Supplier Section`, `Items`
- admin technical labels: `Session`, `Batch`, `Item`
- item-level audit remains a first-class concept in both apps

What to do with existing quick batches:

- keep them readable
- treat them as legacy/advanced fallback entries
- do not delete or rewrite them

What to do with old unbatched sales:

- keep them readable in the item ledger
- do not backfill them into sessions destructively

Should Session become mandatory for new mobile work?

- not immediately
- make Session the default workflow
- keep Quick Supplier Batch as fallback until the new flow is stable

Should admin Batch View remain?

- yes, but it should become a technical drill-down and supplier-section surface rather than the primary mental model

Should My Batches remain visible on mobile?

- yes during migration
- later it can be demoted into an advanced or legacy section if the new session-first flow proves stable

Should the word `Batch` be replaced with `Supplier Section` in normal mobile UI?

- yes, in primary user-facing text
- keep `Batch` as a technical/backend term where needed

## 11. Recommended Mobile UX

### Recommended option

Choose:

- Session-first default with advanced quick batch fallback

Why:

- it simplifies the normal path without forcing a hard cutover
- it preserves operational safety for single-supplier work
- it gives a clear migration path

### Recommended dashboard

Primary actions:

- My Sessions
- Create Session

Secondary/advanced actions:

- My Batches
- Scanner
- Sales History

### Recommended create flow

Session-first:

1. Create Session
2. Add first Supplier Section
3. Scan or manually add items
4. Add another Supplier Section if needed
5. Submit session when all sections are ready

### Recommended session detail

Session detail should show:

- session header
- customer/reference summary
- overall totals
- supplier section cards
- add supplier section action
- open supplier section action
- submit session action

### Recommended supplier section flow

Supplier section should still support:

- scan QR
- manual add
- batch submit
- item-level drill-down
- back navigation that returns to session detail after save

### No-internet behavior

Keep the existing no-internet fallback screen.

Do not reintroduce:

- local queue replay
- silent pending items
- background sync dashboard

### Legacy visibility

Keep legacy batch surfaces visible during migration:

- My Batches
- batch detail
- batch submit flow

But make them secondary to sessions in the normal path.

## 12. Recommended Admin UX

### Recommended default

Default admin landing view for sales management should become:

- Session View

Keep:

- Batch View
- Item View

### How to position each view

Session View:

- primary operational overview
- combined request tracking
- supplier section grouping

Batch View:

- technical supplier-section drill-down
- legacy/advanced support
- revision and batch state work

Item View:

- ledger truth
- item-level audit
- sale detail drill-down

### Labels

Recommended labels:

- `Session View`
- `Supplier Sections` or `Batch View` as a technical alias
- `Item View`

My recommendation:

- keep backend/admin code using `Batch`
- surface `Supplier Section` in user-facing labels where it reduces confusion

### Legacy records

Old standalone batches:

- keep visible
- group them as legacy or unassigned when possible

Old unbatched sales:

- keep them in Item View
- do not try to force them into session reports retroactively

### Drill-downs

Recommended drill-down path:

Session -> Supplier Section -> Sale Detail

This keeps the high-level request visible while preserving item-level audit.

## 13. Settlement Reporting Hierarchy

Recommended reporting hierarchy:

1. Session Reports
2. Supplier Section Reports
3. Item Ledger

### 13.1 Session Reports

Purpose:

- combined customer/request report
- one row per session

Row fields:

- session ref
- customer name
- customer phone
- reference note
- assigned salesman
- supplier count
- item count
- gross total
- stone total
- other total
- net total
- fine total
- stone amount total
- warnings count
- review count
- duplicate count
- manual override count
- status
- finalized at

Filters:

- date range
- customer
- assigned salesman
- status
- search

Actions:

- open combined detail
- export CSV
- export PDF
- drill into supplier sections

Status rules:

- official session reports should be finalized only
- open sessions can exist operationally but should not be treated as official settlement records

### 13.2 Supplier Section Reports

Purpose:

- supplier-wise section report inside a session
- one row per supplier section / batch

Row fields:

- batch ref
- session ref
- supplier
- assigned salesman
- revision
- item count
- gross total
- stone total
- other total
- net total
- fine total
- stone amount
- warnings count
- review count
- duplicate count
- manual override count
- status
- finalized at

Filters:

- session
- supplier
- status
- date range
- search

Actions:

- open supplier section detail
- export CSV
- export PDF
- drill into item ledger rows

Status rules:

- use the latest finalized revision of that supplier section
- do not overwrite history when reopened

### 13.3 Item Ledger

Purpose:

- current sale-level truth
- detailed audit and settlement trace

Row fields:

- supplier
- category
- metal
- design code / item code
- gross
- stone
- wastage
- net
- purity
- fine
- stone amount
- recorded timestamp

Filters:

- search
- supplier
- category
- metal type
- date range

Actions:

- open Sale Detail
- export CSV
- export PDF

Legacy behavior:

- if no `Sale` rows exist, the backend falls back to approved `QrIngestion` rows
- this fallback should remain readable for older records

## 14. Revision-Safe Reporting Rules

Recommended rules:

- The final report should use the latest finalized revision of each child `ScanBatch`
- A reopened supplier section must not overwrite historical exports
- Combined final session reporting should be blocked while any child supplier section has pending changes
- A draft preview may be allowed if it is clearly watermarked as preview only
- No double counting should occur across reopened revisions
- Legacy unbatched sales should remain readable in the item ledger
- Export metadata should be stored first; permanent export file storage can come later if the business needs it

Recommended export storage strategy:

- generate exports on demand first
- store metadata initially
- store files later only if audit/compliance requires it

## 15. Migration and Backward Compatibility

No destructive migration is recommended.

Keep these records valid:

- existing `CaptureSession` documents
- existing standalone `ScanBatch` documents with `sessionId = null`
- existing `Sale` documents with `batchId = null`
- old finalized settlement rows
- existing CSV exports
- existing PDF preview behavior
- current admin and mobile deep links

Recommended migration handling:

- do not backfill old data into new containers destructively
- keep legacy records readable
- group old standalone batches and old unbatched sales as legacy/unassigned where helpful

## 16. Implementation Phases

### Phase P1: Product decision lock

Goal:

- approve session-first wording
- approve supplier-section terminology
- approve legacy fallback visibility
- approve reporting hierarchy

Likely files:

- docs only
- maybe shared label constants later

Risks:

- terminology churn

Tests:

- documentation review
- no runtime test required

Rollout:

- product sign-off first

### Phase P2: Backend report query foundation

Goal:

- add session-report query
- add supplier-section-report query
- add item-ledger query as the base
- make revision selectors explicit

Likely files:

- backend report services
- backend report controllers/routes

Risks:

- double counting reopened revisions
- mismatched filters

Tests:

- service-level regression checks
- report-row correctness checks

Rollout:

- keep old item-ledger endpoint live while new queries are added

### Phase P3: Admin reporting redesign

Goal:

- add Session Reports
- add Supplier Section Reports
- keep Item Ledger
- improve drill-down

Likely files:

- admin settlement pages
- table components
- filters
- detail modals

Risks:

- user confusion if labels change too fast
- row-level lineage not obvious

Tests:

- UI smoke tests
- empty/loading/error states
- row drill-down checks

Rollout:

- ship behind the existing Settlement Reports page structure

### Phase P4: Export layer

Goal:

- session combined CSV/PDF
- supplier-section CSV/PDF
- revision-safe metadata

Likely files:

- backend export helpers
- admin preview/export integration

Risks:

- preview/export mismatch
- historical revision ambiguity

Tests:

- export file snapshots
- metadata integrity checks

Rollout:

- on-demand exports first
- metadata only at first

### Phase P5: Mobile UX simplification

Goal:

- make sessions the primary mobile workflow
- rename normal batch language to supplier section
- keep quick batch fallback during migration

Likely files:

- mobile session screens
- mobile batch screens
- dashboard navigation
- labels and helper text

Risks:

- over-forcing the session flow too early
- confusing users if both terms are shown equally

Tests:

- manual mobile QA
- route/back-stack checks
- no-internet fallback checks

Rollout:

- keep legacy batch entry visible until session-first usage is stable

## 17. Risks

Main risks:

- forcing sessions onto simple one-supplier jobs too early
- confusing users if `Batch` and `Supplier Section` are shown as equal terms
- double counting across reopened revisions if report queries are not revision-aware
- having settlement reports stay item-ledger-only for too long
- preview/export divergence between frontend HTML preview and backend PDF export
- failing to surface lineage from session -> batch -> sale in reporting

Current technical risks:

- settlement rows do not yet expose full session/batch lineage in the current UI
- the current settlement report is still item-ledger centric
- docs still contain historical wording in places and should not be treated as the source of truth

## 18. Open Product Questions

Recommended answers or current status:

1. Should every new mobile workflow create a Session?
   - Recommended: yes for the primary flow, but keep an advanced quick batch fallback during migration.

2. Should Quick Supplier Batch remain visible?
   - Yes, as an advanced fallback.

3. Should My Batches remain in the normal dashboard?
   - Yes during migration, then consider demoting it later.

4. Should normal mobile UI avoid the word Batch?
   - Yes, primary labels should use Session and Supplier Section.

5. Should admin default to Session View?
   - Yes.

6. Should Settlement Reports default to Session Reports?
   - Yes, once those views are implemented.

7. Should open sessions appear in settlement reports or only finalized sessions?
   - Only finalized sessions should appear in official settlement reports.

8. Should draft preview PDF be supported?
   - Yes, if it is clearly watermark-marked as preview only.

9. Should combined report wait until all supplier sections are finalized?
   - Yes.

10. Should old standalone batches appear under a Legacy / Unassigned group?
   - Yes.

11. Should old unbatched sales remain only in Item Ledger?
   - Yes.

12. Should combined reports include stone amount?
   - Yes.

13. Should combined report include supplier-wise calculation rules?
   - Yes, at least as report metadata and line-item context.

14. Should exports be generated on demand or stored?
   - On demand first, with metadata stored initially.

15. Should session reference be shown to customer?
   - UNCLEAR. Keep it internal until a customer-facing use case is confirmed.

16. Should customer name remain optional?
   - Yes, the live models already allow it.

17. Should one-supplier session be visually simpler than multi-supplier session?
   - Yes.
