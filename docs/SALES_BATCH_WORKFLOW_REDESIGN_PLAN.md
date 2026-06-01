# Sales Batch Workflow Redesign Plan

## 1. Executive Summary

The current system is item-centric: every scanned jewellery piece becomes one `Sale` record. That is already good for auditability, duplicate protection, and detail-level verification, but it is not enough for a real shop workflow where multiple scans often belong to one customer/job/session.

The safest redesign is not to merge items into a single flat record. Instead:

- keep each jewellery item as its own auditable `Sale`
- add an optional parent `ScanBatch` / `BatchSession`
- let batches group related sales by supplier, salesman, workflow state, and revision
- preserve the existing sale detail, snapshots, duplicate handling, and settlement calculations
- add batch-level lifecycle and revision history on top of the existing item-level model

This plan is inspection-only. It does not change code. It documents:

- what the live sale flow does today
- what is missing for a batch/session workflow
- the minimal safe backend model to add later
- the API shape to plan for
- the admin/mobile/reporting impact
- the main risks and open questions

The recommended direction is:

1. add `batchId` and related metadata to `Sale`
2. add a `ScanBatch` model with embedded revision snapshots
3. keep batch exports/revisions traceable without breaking current item-level sales
4. phase in admin batch views before mobile batch capture

Phase 1 status:

- backend foundation code is now in place for `ScanBatch`, optional `Sale` batch metadata, and a batch lifecycle helper
- batch APIs, admin views, and mobile batch capture are still future phases

---

## 2. Current Sale Flow

### 2.1 Current `Sale` model

File checked:

- `backend/src/models/Sale.js`

Current live `Sale` is item-level and already stores a rich audit trail:

- `qrRaw`
- `qrHash`
- `idempotencyKey`
- `salesman`
- `supplier`
- `category`
- `itemCode`
- `metalType`
- `purity`
- `notes`
- `calculationSnapshot`
- `parsedSnapshot`
- `settlementInputs`
- `grossWeight`
- `stoneWeight`
- `netWeight`
- `ratePerGram`
- `totalValue`
- `isDuplicate`
- `wasManuallyEdited`
- `saleDate`

Important schema facts:

- `settlementInputs` already exists and tracks karat, purity source, wastage source, and override flags
- `calculationSnapshot` already stores the derived calculation audit
- `parsedSnapshot` already stores parser/display state
- this is a strong base for item-level audit continuity

### 2.2 Current `POST /api/v1/sales`

Files checked:

- `backend/src/controllers/sales.controller.js`
- `backend/src/routes/sales.routes.js`

Current behavior:

- accepts one sale at a time
- validates a supplier exists and resolves settlement inputs
- computes `parsedSnapshot`, `settlementInputs`, and `calculationSnapshot`
- stores one `Sale` document per request
- supports idempotency with `x-idempotency-key`
- supports duplicate QR detection using `qrHash`
- on duplicate without override, returns `409 DUPLICATE_QR` with `previousSale`
- on override, marks the saved sale as duplicate

Current route set:

- `GET /api/v1/sales/summary/today`
- `GET /api/v1/sales/export`
- `GET /api/v1/sales`
- `GET /api/v1/sales/:id`
- `POST /api/v1/sales`

### 2.3 Duplicate handling

Current duplicate behavior is item-centric:

- hash the raw QR
- if same QR hash exists and `overrideDuplicate` is false, return duplicate warning
- if user confirms override, save the item and mark `isDuplicate = true`

This is good for audit, but it is not batch-aware yet.

### 2.4 Current sales filters supported by backend

Current list/export query support is limited to:

- `page`
- `limit`
- `supplier`
- `salesman`
- `startDate`
- `endDate`
- `q`
- `searchScope`
- `duplicatesOnly`
- `sortBy`
- `sortOrder`

Current search scopes:

- all
- salesman
- supplier
- details

No current backend filter exists for:

- batch id
- batch status
- entry mode
- review-only
- manual-override-only
- revision

### 2.5 Current sales list response

List endpoint behavior:

- returns paginated sales
- includes supplier and salesman names
- excludes `calculationSnapshot`, `parsedSnapshot`, and `settlementInputs` to keep the list light
- returns `sales`, `total`, `page`, `pages`, `sortBy`, `sortOrder`

This is appropriate for an item ledger, but not enough for a batch overview.

### 2.6 Current export behavior

Current sales export:

- CSV only
- item-level rows only
- filtered by the same current sales query
- excludes audit snapshots

Settlement reporting export is separate from sales export.

### 2.7 Current settlement report dependency

File checked:

- `backend/src/services/settlementReports.service.js`

Current settlement reporting behavior:

- primary source is `Sale`
- legacy fallback is approved `QrIngestion` records only when no `Sale` rows exist
- settlement rows are finalized item rows, not batch rows

This means settlement reporting is still item-based and can be extended later to batch-aware reporting without breaking older data.

### 2.8 Current mobile submission behavior

Files checked:

- `mobile/lib/features/scanner/presentation/scanner_screen.dart`
- `mobile/lib/features/sale_entry/presentation/sale_entry_screen.dart`
- `mobile/lib/features/sale_entry/presentation/sale_entry_provider.dart`
- `mobile/lib/features/sale_entry/data/pending_sale_queue.dart`
- `mobile/lib/features/sale_entry/data/sale_repository.dart`

Current mobile flow:

1. scanner captures raw QR
2. parser result is loaded into sale entry
3. sale form is auto-filled where parsing succeeded
4. user manually edits fields if needed
5. submit calls `POST /api/v1/sales`
6. duplicate QR returns a 409 warning and can be confirmed
7. pending submissions are stored in secure storage and retried

Important mobile queue behavior:

- the pending queue is persisted in `flutter_secure_storage`
- pending records store:
  - supplierId
  - item fields
  - gross / stone / net
  - raw QR
  - display snapshot
  - parsed snapshot
  - parse snapshot
  - duplicate override state
- there is no batch/session concept yet
- offline recovery is item-level only

### 2.9 Current admin sales page structure

Files checked:

- `admin-panel/src/pages/sales/SalesPage.jsx`
- `admin-panel/src/pages/sales/components/SalesFilterBar.jsx`
- `admin-panel/src/pages/sales/components/SalesRecordsTable.jsx`
- `admin-panel/src/pages/sales/components/SaleDetailModal.jsx`
- `admin-panel/src/api/sales.api.js`

Current sales page is an item ledger with:

- search
- search scope
- date range
- duplicate-only toggle
- sort
- pagination
- export CSV
- detail modal

Current table already shows:

- ref
- date
- supplier
- item/design code
- karat
- gross
- stone
- net
- fine
- status badges

That is a solid item ledger, but it is not a batch operational view yet.

---

## 3. Business Requirements

The redesign goal is to support real shop workflows without losing auditability.

### Must keep

- each jewellery item remains a separate `Sale`
- every scanned piece remains traceable individually
- duplicate handling remains item-level
- calculation snapshots remain item-level
- manual override history remains item-level
- old single-item sales continue working

### Desired batch/session workflow

The system should support:

- one batch/session per job/customer/request
- many items inside the same batch
- reopening a finalized batch later
- adding more items to the reopened batch
- exporting current revision and keeping previous revision history

### Business outcome

The shop owner should be able to answer:

- what was scanned
- which items belong together
- who entered them
- whether the batch is open, submitted, finalized, or reopened
- what changed in a later revision
- what was exported for each revision

---

## 4. Proposed Batch Lifecycle

Recommended statuses:

- `draft`
- `open`
- `submitted`
- `finalized`
- `reopened`
- `cancelled`

For the first implementation pass, a new batch should default to `draft` because the record can exist before it is activated for actual scanning work. That keeps creation separate from operational use.

Recommended flow:

1. batch is created as `draft` or `open`
2. salesman adds items one by one
3. each item saves as its own `Sale`
4. batch is submitted
5. admin reviews and finalizes
6. if more items are needed later, admin reopens with a reason
7. batch revision increments
8. salesman adds new items only to the reopened batch
9. batch is submitted and finalized again
10. previous revision history remains available

### Batch rules

- finalized batch cannot be edited directly
- reopening requires a reason
- reopening creates a new revision
- previous revisions remain traceable
- child sale items retain their own audit snapshots

### Batch-level vs item-level state

Recommended split:

- batch status describes the workflow state of the group
- sale status remains item-level audit state such as duplicate/review/override

This avoids forcing item records into a batch-only lifecycle.

---

## 5. Permissions

### Salesman

For assigned open/reopened batches only:

- view assigned batch
- add QR-scanned item
- add manual item
- edit newly added item if current mobile flow supports it
- submit batch

For finalized batches:

- cannot add items
- cannot remove items
- cannot reopen
- cannot edit historical finalized items

### Admin

- create batch
- view all batches
- assign/reassign salesman if supported
- review batch
- finalize batch
- reopen finalized batch
- enter reopen reason
- view revision history
- export current revision
- view previous revision history

### Important security rule

Salesmen should only see batches assigned to them. They should not see all batches.

---

## 6. Proposed Data Model

### 6.1 Recommended minimal model

The simplest safe design is:

1. add optional `batchId` to `Sale`
2. add a new `ScanBatch` collection
3. keep revisions embedded in `ScanBatch`

### 6.2 `Sale` additions

Recommended new optional fields on `Sale`:

- `batchId` `ObjectId | null`
- `revisionAdded` `Number | null`
- `entryMode` `String | null`
- `addedBy` `ObjectId | null`
- `addedAt` `Date | null`

Suggested `entryMode` values:

- `qr_scan`
- `manual`
- `qr_scan_with_manual_override`

### 6.3 Proposed `ScanBatch` model

Recommended fields:

- `_id`
- `batchRef`
- `supplierId`
- `supplierCode`
- `salesmanId`
- `assignedSalesmanId`
- `status`
- `revision`
- `entryMode`
- `itemCount`
- `totals`
- `warningsCount`
- `reviewCount`
- `createdAt`
- `updatedAt`
- `submittedAt`
- `finalizedAt`
- `reopenedAt`
- `reopenedBy`
- `reopenReason`
- `items`
- `revisions`

### 6.4 Embedded revision snapshot

Recommended simplest revision strategy:

- keep revision history embedded in `ScanBatch`
- each revision stores:
  - revision number
  - status
  - child sale ids
  - totals
  - finalizedAt
  - reopenedReason if applicable
  - export metadata if generated

Why this is the safest first step:

- one collection to query for batch history
- no extra join just to show revisions
- easier to keep revision totals and export metadata together
- preserves traceability without overengineering a separate revision collection

### 6.5 Do we need a separate `BatchRevision` model?

Recommended answer: not initially.

Use embedded revisions first unless the data volume or export history becomes too large.

### 6.6 Do we need a separate `BatchExport` model?

Recommended answer: only if actual generated export files or immutable export artifacts must be stored long-term.

For v1 batch history, export metadata can likely live inside the revision snapshot.

### 6.7 Suggested indexes

Recommended indexes later:

- `Sale.batchId`
- `Sale.salesman + saleDate`
- `Sale.supplier + saleDate`
- `ScanBatch.batchRef`
- `ScanBatch.supplierId + status`
- `ScanBatch.salesmanId + status`
- `ScanBatch.createdAt`

### 6.8 Why this model is safe

This model:

- preserves current item-level sale records
- does not force old sales into a batch
- allows old sales to continue working with `batchId = null`
- supports batch-level workflow without replacing the existing sale ledger

---

## 7. Revision and Export History

### Recommended revision strategy

Best current option:

- embed revision snapshots in `ScanBatch`
- store revision number and finalized snapshot per revision
- child `Sale` records keep `revisionAdded`

### Revision fields to preserve

Each revision should be able to store:

- revision number
- batch status
- child sale ids
- totals at time of finalization
- finalized timestamp
- reopen reason
- who reopened it
- export file metadata if generated

### Export strategy

Recommended behavior:

- export current finalized revision by default
- allow previous revision export from history
- keep previous revision traceable
- do not silently overwrite old revision export history

### Avoid duplicate counting across revisions

Rules to preserve:

- item-level sales remain unique records
- reopened batch adds only new items to the new revision
- old items remain linked to earlier revisions
- reports should be able to choose one revision or one final batch snapshot

### Export history display

Admin should later be able to see:

- revision 1 export
- revision 2 export
- timestamp
- who exported
- whether the export was PDF or CSV

---

## 8. Proposed APIs

### 8.1 Batch lifecycle APIs

Proposed routes to evaluate later:

- `POST /api/v1/batches`
- `GET /api/v1/batches`
- `GET /api/v1/batches/:id`
- `PATCH /api/v1/batches/:id`
- `POST /api/v1/batches/:id/items`
- `POST /api/v1/batches/:id/submit`
- `POST /api/v1/batches/:id/finalize`
- `POST /api/v1/batches/:id/reopen`
- `GET /api/v1/batches/:id/revisions`
- `GET /api/v1/batches/:id/export.csv`
- `GET /api/v1/batches/:id/export.pdf`

### 8.2 Sales APIs to extend

Current `GET /api/v1/sales` should eventually be able to support:

- `batchId`
- `status`
- `entryMode`
- `reviewOnly`
- `manualOverrideOnly`
- `duplicateOnly`
- `supplier`
- `salesman`
- date range

### 8.3 Auth/role plan

Recommended role rules:

- admin: all batch actions
- salesman: only assigned batch actions
- unauthenticated: nothing

### 8.4 Request/response shape plan

Keep the current response envelope:

- `{ success: true, data, message }`
- `{ success: false, error, code }`

For batch APIs, include:

- batch metadata
- current revision
- child sale list
- totals
- status
- revision history summary

### 8.5 Failure cases to design for

- invalid batch id
- batch not found
- salesman not assigned to batch
- batch already finalized
- reopen without reason
- duplicate item in same batch
- attempt to add item to finalized batch
- stale revision conflict

### 8.6 Idempotency and duplicate behavior

Keep current idempotency on `POST /sales`.

For batch APIs later:

- item creation inside batch should also support idempotency
- duplicate QR should still be item-level and should not break the batch

---

## 9. Admin Sales Page Changes

### 9.1 What current UI already has

Current sales page already has:

- search
- date range
- search scope
- duplicate-only toggle
- export
- pagination
- detail modal

### 9.2 Recommended future filters

Potentially add:

- supplier dropdown
- status filter
- entry mode filter
- needs-review filter
- manual override filter
- batch id filter

### 9.3 Batch view vs item view

Recommended admin views:

#### Batch View

Default operational view.

Suggested columns:

- batch ref
- date
- supplier
- salesman
- items count
- gross total
- stone total
- net total
- fine total
- status
- revision
- needs review count
- actions

#### Item View

Audit/debug view.

Suggested columns:

- sale ref
- batch ref
- date
- supplier
- item/design code
- karat
- gross
- stone
- net
- fine
- entry mode
- duplicate
- needs review
- manual override
- actions

### 9.4 Action set to plan for

- view batch
- view item details
- export PDF
- export CSV
- reopen batch
- finalize batch

### 9.5 Files likely touched later

- `admin-panel/src/pages/sales/SalesPage.jsx`
- `admin-panel/src/pages/sales/components/SalesFilterBar.jsx`
- `admin-panel/src/pages/sales/components/SalesRecordsTable.jsx`
- `admin-panel/src/pages/sales/components/SaleDetailModal.jsx`
- `admin-panel/src/api/sales.api.js`
- `admin-panel/src/pages/settlement-workflow/*`

### 9.6 Risk level

- filter additions: medium
- batch view toggle: medium
- reopen/finalize actions: high
- revision history UI: high

---

## 10. Mobile Impact

### Current mobile behavior

The current mobile flow is item-by-item:

- scan QR
- parse
- fill form
- submit one sale
- store pending queue locally if needed

### Future batch flow on mobile

Later mobile flow should become:

1. select or open assigned batch
2. add QR-scanned item
3. add manual item if needed
4. review item list
5. submit batch
6. show assigned reopened batches
7. add more items after admin reopen

### Offline queue implications

Current offline queue is item-level. Future batch support should:

- keep pending item drafts
- attach drafts to a batch id when available
- preserve retry and duplicate handling
- not lose item-level snapshots

### Failure recovery

Mobile must still support:

- partial parse
- duplicate QR warning
- manual entry fallback
- offline retry

### Important mobile rule

Do not replace item-level sale capture with a single batch-only submission. Batch should contain many item drafts or item submissions.

---

## 11. Settlement Report Impact

### Current state

Settlement reports currently:

- use `Sale` first
- fall back to approved QR ingestion only when no sales exist
- render finalized item rows

### Future batch-aware settlement approach

Recommended report behavior:

- default to latest finalized revision for a batch
- allow historical revision selection
- avoid double counting across revisions
- keep item-level rows available for audit

### Reporting columns to plan for later

- supplier
- date
- ref
- batch ref
- item/design code
- category
- metal type
- karat
- gross weight
- stone components
- stone total
- other weight
- QR net
- computed net
- selected net
- purity percent
- wastage percent
- settlement percent
- fine weight
- stone amount
- warnings / review flag

### Avoiding duplicate counting

Rules:

- one item sale counts once in its chosen revision
- historical revisions remain viewable
- batch finalization should define the report snapshot

---

## 12. Backward Compatibility

### Existing sales

Existing `Sale` records must remain valid.

Recommended compatibility stance:

- `batchId = null` for old sales
- item detail page keeps working
- sale list keeps working
- settlement reporting keeps working
- current CSV export keeps working

### Existing POST /sales

Keep existing single-sale API behavior working.

The batch system should be additive, not a rewrite.

### Existing admin screens

Current sales and detail pages should continue to function for item-level audit.

### Existing mobile flow

Current mobile sale entry should continue to submit one sale at a time until batch support is deliberately added later.

### Customer concept

UNCLEAR from the inspected code:

- there is no current customer module in the live paths reviewed
- batch customer fields should remain optional text fields until a real customer model exists

### Supplier vs customer terminology

Keep them separate:

- supplier is a product source / business supplier
- customer is the buyer/job owner for the batch

Do not mix these terms in the data model.

---

## 13. Implementation Phases

### Phase 1: Backend batch model foundation

Scope:

- add `ScanBatch` model
- add optional `batchId` and batch metadata to `Sale`
- add status transition helper/service

Files likely touched:

- `backend/src/models/ScanBatch.js`
- `backend/src/models/Sale.js`
- `backend/src/services/batch.service.js`
- `backend/src/controllers/*` only if required for lookup or helper wiring

Risk:

- medium

Tests to plan:

- batch creation
- sale linked to batch
- old sale compatibility

### Phase 2: Batch APIs

Scope:

- create/list/detail/update batch routes
- submit/finalize/reopen flow
- revision snapshots

Files likely touched:

- `backend/src/routes/batches.routes.js`
- `backend/src/controllers/batches.controller.js`
- `backend/src/services/batch.service.js`
- request validation middleware

Risk:

- high

Tests to plan:

- status transitions
- permission checks
- revision increment behavior
- duplicate prevention

### Phase 3: Admin sales filters and batch view

Scope:

- batch/item toggle
- supplier/status/entry-mode filters
- batch list view
- batch detail modal/page

Files likely touched:

- `admin-panel/src/pages/sales/SalesPage.jsx`
- `admin-panel/src/pages/sales/components/SalesFilterBar.jsx`
- `admin-panel/src/pages/sales/components/SalesRecordsTable.jsx`
- `admin-panel/src/pages/sales/components/SaleDetailModal.jsx`

Risk:

- medium

Tests to plan:

- list rendering
- filters
- modal data handling

### Phase 4: Finalize/reopen/revision/export flow

Scope:

- admin batch finalize
- reopen with reason
- revision history
- current export versus historical export

Files likely touched:

- batch detail page/modal
- batch API client
- export helpers

Risk:

- high

Tests to plan:

- export snapshot correctness
- reopen audit trail
- finalization lock behavior

### Phase 5: Mobile batch scan flow

Scope:

- open/assigned batch picker
- add items to batch
- batch submit
- offline queue batch tagging

Files likely touched:

- `mobile/lib/features/scanner/*`
- `mobile/lib/features/sale_entry/*`
- pending queue data/provider files

Risk:

- high

Tests to plan:

- offline retry
- duplicate item handling
- reopened batch continuation

### Phase 6: Reporting integration

Scope:

- settlement report revisions
- batch-aware exports
- historical reporting

Files likely touched:

- `backend/src/services/settlementReports.service.js`
- admin settlement pages
- report export helpers

Risk:

- high

Tests to plan:

- no double counting
- latest revision default
- historical revision selection

---

## 14. Risks

### Functional risks

- accidental merge of multiple items into one flat sale record
- duplicate counting across revisions
- batch status changes becoming too complex too early
- mixing supplier and customer concepts

### Data model risks

- over-normalizing revision history too early
- creating too many collections before behavior is stable
- needing migration work for old sales if `batchId` is not optional

### UX risks

- batch view may hide item-level audit if not paired with item view
- admin may need both operational and audit modes
- mobile batch capture could become too heavy if UI is not staged carefully

### Reporting risks

- current settlement reports are item-first, so batch aggregation must not break existing totals
- revision-aware exports must avoid showing stale and current rows together by mistake

### Technical risks

- adding batch lifecycle without clear ownership rules
- expanding permissions without reusing existing auth/role patterns
- trying to retrofit batch logic into the current item-only `POST /sales` too aggressively

---

## 15. Open Questions

1. Should a batch be tied to a supplier only, a salesman only, or both?
2. Do we need a customer text field only, or should a real customer module be designed first?
3. Should `ScanBatch` revisions be embedded, or do we expect enough historical data to justify a separate revision collection later?
4. Should exports be stored as metadata only, or should generated files be persisted?
5. Should batch finalization create an immutable snapshot of child sale ids, or should the latest linked sales always define the current view?
6. Should mobile allow creating a brand-new batch, or only adding to assigned/open batches?
7. Should old item sales without a batch remain visible in the batch view as `unbatched`, or stay only in the item ledger?

UNCLEAR items based on inspected files:

- no customer module was found in the reviewed backend/admin/mobile paths
- no batch or revision model currently exists
- no batch routes exist in `backend/src/routes/sales.routes.js`
