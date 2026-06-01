# Mobile Batch Workflow Implementation Plan

## 1. Executive Summary

The current mobile app is still item-centric: one QR scan or manual jewellery entry becomes one `Sale` record. That is correct for the existing release, but it is not yet enough for the new batch workflow.

Backend batch APIs are already implemented and validated. Admin can create, assign, review, finalize, reopen, and inspect revision history. The missing piece is the mobile batch experience.

The key implementation risk is orphan data. If mobile first creates a `Sale` and then links it to a batch in a second request, a network failure can leave an unbatched Sale behind. That risk is real with the current offline queue and retry behavior.

Safest practical direction:
- keep each jewellery item as an individual `Sale`
- make batch context part of the mobile submission path
- prefer a single backend request that creates the Sale and associates it with the selected batch
- keep existing standalone sale flow backward-compatible
- preserve duplicate QR handling, manual entry fallback, and offline safety

## 2. Current Mobile Architecture

### Stack
- Flutter 3.41.6
- Riverpod for state management
- Dio for HTTP
- flutter_secure_storage for JWT and offline queue persistence
- mobile_scanner for QR capture
- go_router for navigation

### App structure
- `mobile/lib/main.dart` owns routing and app bootstrap
- `mobile/lib/core/api/dio_client.dart` centralizes API access and auth header injection
- `mobile/lib/core/auth/token_storage.dart` stores JWT securely
- `mobile/lib/features/auth/*` handles login/session state
- `mobile/lib/features/scanner/*` handles QR capture
- `mobile/lib/features/sale_entry/*` handles parse review, manual edits, and sale submission
- `mobile/lib/features/history/*` handles sales history search/filtering

### Routing / navigation
Current routes:
- `/login`
- `/dashboard`
- `/scanner`
- `/sale-entry`
- `/sale-success`
- `/sales-history`

The app uses `go_router` with auth-based redirects:
- logged-out users go to `/login`
- logged-in users are redirected away from `/login` to `/dashboard`

### Auth/session behavior
- JWT is stored in `flutter_secure_storage`
- Dio automatically attaches `Authorization: Bearer <token>`
- 401 responses clear the token and route the user back to login
- role is available in mobile state through the auth session user object

### API wrapper pattern
- API calls are concentrated in repository classes
- `SaleRepository` is the main sales/scan repository
- `AuthRepository` handles login/session bootstrapping
- sale submission and QR parsing are already abstracted behind repository methods

## 3. Current Screens

| Screen | File path | Purpose | Key fields/actions | APIs called | Batch impact |
|---|---|---|---|---|---|
| Login | `mobile/lib/features/auth/presentation/login_screen.dart` | Authenticate user and store token | identifier/password, theme toggle, submit | `POST /api/v1/auth/login` | No change needed except eventual batch-aware landing |
| Dashboard | `mobile/lib/main.dart` (`DashboardScreen`) | Current landing page and quick summary | recent sales card, logout, theme toggle | recent sales query | Could become a shortcut hub for batch actions, but it is not batch-specific today |
| Scanner | `mobile/lib/features/scanner/presentation/scanner_screen.dart` | Scan QR and hand off parsed result | camera, torch, manual entry button | `POST /api/v1/suppliers/parse-qr` | Must eventually accept selected batch context |
| Sale Entry | `mobile/lib/features/sale_entry/presentation/sale_entry_screen.dart` | Review parsed QR or manually enter sale details | supplier, category, item code, metal, purity, weights, notes, duplicate confirm, save | `GET /api/v1/suppliers`, `GET /api/v1/business/overview`, `POST /api/v1/sales` | Needs batch context and batch-safe submission in the next phase |
| Sale Success | `mobile/lib/features/sale_entry/presentation/sale_success_screen.dart` | Confirm a saved sale | sale ref, duplicate badge, scan another | no new API | Should later return user to batch detail when a batch is active |
| Sales History | `mobile/lib/features/history/presentation/sales_history_screen.dart` | Search recent item sales | search, scope, sort, duplicates-only toggle | history query APIs | Not batch-specific, but may later need batch filters |
| Pending Queue Banner | `mobile/lib/features/sale_entry/presentation/widgets/pending_sales_banner.dart` | Show offline/pending entries inside sale entry | pending count, failed count, retry actions | offline queue + `POST /api/v1/sales` retry | Must preserve batch context once batch mode is added |

Supporting UI pieces:
- supplier picker / selectors live under `mobile/lib/features/sale_entry/presentation/widgets/*`
- QR debug panel is part of sale entry and is currently developer-oriented

## 4. Current QR Sale Flow

Current flow:
1. User scans QR in `ScannerScreen`
2. Mobile calls `SaleRepository.parseQr(rawQr)`
3. Parse response is converted into `ParseQrResult`
4. App navigates to `SaleEntryScreen` with the parse result
5. Sale entry auto-fills available fields
6. User can edit fields manually
7. Duplicate QR can be confirmed explicitly
8. Submit calls `POST /api/v1/sales`
9. If saving fails, the sale is preserved in the pending queue and can be retried

### Current payload sent to `POST /api/v1/sales`
The mobile app currently sends:
- `supplierId`
- `category`
- `itemCode`
- `metalType`
- `purity`
- `notes`
- `grossWeight`
- `stoneWeight`
- `netWeight`
- `qrRaw`
- `displaySnapshot` when available
- `parsedSnapshot` when available
- `overrideDuplicate`
- `x-idempotency-key` header

### Parse snapshot handling
- `ParseQrResult` stores:
  - raw QR text
  - item code
  - category
  - purity
  - gross weight
  - stone weight
  - other weight
  - net weight
  - parse errors
  - supplier match info
  - `normalizedSnapshot`
  - `displaySnapshot`
- `displaySnapshot` and `parsedSnapshot` are already preserved in the sale payload
- purity auto-fill prefers normalized/display purity percent when available

### Current duplicate flow
- duplicate warnings are item-level
- the user can confirm and continue with `overrideDuplicate: true`
- duplicate handling is already part of the same sale submission path

### Batch integration gap
`POST /api/v1/sales` now accepts optional `batchId` in the request body.
The remaining mobile gap is to thread that batch context through the scanner, sale-entry flow, and offline queue.

## 5. Current Manual Entry Flow

Manual entry already exists:
- from the scanner screen, the user can choose manual entry instead of QR scan
- the app pushes `SaleEntryScreen` with an empty `ParseQrResult`
- the same sale-entry provider/repository flow is used
- manual sale and QR sale share the same underlying Sale creation path

Current manual entry characteristics:
- supplier can be selected manually
- weights and item details can be typed in
- the sale still submits as one `Sale` record
- pending queue also preserves manual entries

Batch implication:
- manual entry should remain available inside batch mode
- it should not become a separate batch architecture
- QR and manual items should remain child `Sale` records of the selected batch

## 6. Current Pending Queue / Offline Flow

The current offline queue is item/sale-centric.

### Storage and persistence
- queue is stored in `flutter_secure_storage`
- storage key: `pending_sale_queue_v1`
- queue items persist:
  - supplierId
  - supplierName
  - category
  - itemCode
  - metalType
  - purity
  - notes
  - grossWeight
  - stoneWeight
  - netWeight
  - qrRaw
  - overrideDuplicate
  - displaySnapshot
  - parsedSnapshot
  - parseSnapshot

### Retry behavior
- failed drafts stay in the queue
- the user can retry individual drafts
- `sale_entry_provider` replays the same create-sale payload
- duplicate retry is handled explicitly

### Current risk
If the app ever performs:
1. `POST /api/v1/sales`
2. then a second request to link that sale to a batch

an offline or network failure can create an orphan/unbatched `Sale`.

That is the main failure mode the batch workflow must avoid.

### Queue future needs
Once batch mode is added, the queue will likely need to preserve:
- `batchId`
- `batchRef`
- batch revision context
- maybe selected supplier lock

At the moment, the queue does not carry batch context.

## 7. Backend Contract Recommendation

### Available backend batch APIs

| Endpoint | Current contract | Mobile relevance |
|---|---|---|
| `GET /api/v1/batches` | Paginated batch list with filters such as supplier, assigned salesman, status, entry mode, dates, q, sort | Mobile should use this for "My Batches" |
| `POST /api/v1/batches` | Create a batch with supplier and assigned salesman plus optional customer/reference fields | Mobile can use this for self-assigned batch creation |
| `GET /api/v1/batches/:id` | Full batch detail with totals, child items, current revision, and revision history | Mobile batch detail screen |
| `GET /api/v1/batches/:id/revisions` | Revision history view | Mobile history/read-only review |
| `POST /api/v1/batches/:id/items` | Adds sale items to an existing batch using `saleId` or `saleIds` | Useful for admin workflows; mobile should not rely on a two-step link if it can avoid it |
| `POST /api/v1/batches/:id/submit` | Submit a batch | Mobile submits assigned batch |
| `POST /api/v1/batches/:id/finalize` | Admin finalize | Admin only |
| `POST /api/v1/batches/:id/reopen` | Admin reopen with revision increment | Admin only |
| `PATCH /api/v1/batches/:id/assignment` | Admin assign/reassign salesman | Admin only |

### Recommendation
Recommended safest practical choice: **Option A**

`POST /api/v1/sales` with optional `batchId`

Why:
- preserves the existing sale creation flow
- keeps QR duplicate handling, idempotency, and sale snapshot behavior in one request
- avoids the orphan-sale risk of a two-step create-then-link flow
- keeps existing standalone sale support backward-compatible

Important implementation note:
- the backend must treat the batch-aware sale create path as one logical operation
- do not rely on a later linking step from mobile

### What not to do
- do not use a two-step `POST /sales` then `POST /batches/:id/items` mobile flow as the primary path
- do not depend on MongoDB transactions unless they are explicitly verified and part of the implementation

## 8. Proposed Mobile Batch Screens

### 1. My Batches
Recommended purpose:
- show batches assigned to the logged-in salesman
- let the salesman create a new batch when allowed

Suggested content:
- batch ref
- supplier
- customer/reference note
- status
- revision
- item count
- totals
- open action

Suggested filters:
- Open
- Reopened
- Submitted
- Finalized / history

### 2. Create Batch
Suggested fields:
- supplier required
- customer name optional
- customer phone optional
- reference note optional
- assigned salesman auto-set to current user

### 3. Batch Detail / Capture
Suggested content:
- batch ref
- supplier
- status
- revision
- item list
- totals
- scan QR
- manual add
- submit batch

### 4. Scanner with batch context
Suggested behavior:
- scanner receives selected batch context
- after scan, sale entry knows the selected batch
- if there is no selected batch, the app should not silently create a batch-linked sale

### 5. Existing Sale Entry with batch context
Suggested behavior:
- keep the current QR/manual flow
- preserve duplicate handling
- preserve offline queue
- attach batch context to the sale create path
- after save, return to batch detail rather than the generic success flow when batch mode is active

### 6. Reopened batch behavior
Suggested behavior:
- reopened batch becomes visible to the assigned salesman
- previous items remain visible
- newly added items are marked as current revision additions

## 9. UX Rules

Recommended rules for the mobile batch workflow:

- after login, show a batch-focused entry point for salesmen if batch mode is enabled; keep dashboard accessible as fallback/navigation
- scanning should require a selected batch when the user is working in batch mode
- supplier should not change after the first item has been added to a batch
- submitted and finalized batches should be read-only for the salesman
- reopened batches should allow adding new items again
- manual override badges should remain visible on item detail and batch summary
- duplicate warnings should remain item-level and should not block submission
- batch totals should refresh after each item add and after each submit/reopen event

Locked business rules:
- one batch = one supplier
- admin alone reopens finalized batches
- QR and manual item entry stay as separate entry methods but produce the same kind of item-level Sale record

## 10. Implementation Phases

### Phase M1: Mobile batch foundation
Files likely touched:
- `mobile/lib/features/batches/*` new feature folder
- `mobile/lib/features/sale_entry/data/sale_repository.dart`
- `mobile/lib/main.dart`
- `mobile/lib/features/auth/presentation/auth_notifier.dart` if role-gated navigation is needed

Backend changes required:
- none if only listing existing batches and creating self-assigned batches

Goals:
- batch repository/models
- assigned batch list
- create batch
- read-only batch detail

Risks:
- UI may drift into admin-like batch management if permissions are not kept tight

Checks:
- batch list loads assigned records
- create batch works for salesman
- read-only detail opens correctly

### Phase M2: Batch-aware sale creation
Files likely touched:
- `mobile/lib/features/scanner/presentation/scanner_screen.dart`
- `mobile/lib/features/sale_entry/presentation/sale_entry_screen.dart`
- `mobile/lib/features/sale_entry/presentation/sale_entry_provider.dart`
- `mobile/lib/features/sale_entry/data/sale_repository.dart`
- `mobile/lib/features/sale_entry/data/pending_sale_queue.dart`

Backend changes required:
- thread optional `batchId` through sale creation now that the backend already supports it

Goals:
- selected batch context flows into QR/manual sale entry
- sale save remains one request
- duplicate handling still works

Risks:
- orphan Sale records if the contract is still two-step

Checks:
- scan into batch
- manual entry into batch
- save sale and keep batch link

### Phase M3: Totals, submit, reopen continuation
Files likely touched:
- new mobile batch detail widgets
- batch repository/service
- sale success routing

Backend changes required:
- none if batch detail/submit/reopen already exist and are consumable by mobile

Goals:
- batch totals refresh
- submit batch
- reopened batches continue from the correct revision

Risks:
- stale totals if the app does not re-fetch batch detail after changes

Checks:
- submit changes status
- reopened revision increments
- current revision items are clearly marked

### Phase M4: Offline queue batch context and orphan prevention
Files likely touched:
- `mobile/lib/features/sale_entry/data/pending_sale_queue.dart`
- `mobile/lib/features/sale_entry/presentation/pending_sale_queue_provider.dart`
- `mobile/lib/features/sale_entry/presentation/sale_entry_provider.dart`

Backend changes required:
- none if single-request batch-aware sale create is already in place

Goals:
- preserve batch context in queued drafts
- retry stays idempotent
- offline flow does not create orphan items

Risks:
- queue schema versioning
- retry mismatch after batch reopen/revision changes

Checks:
- retry draft keeps batch context
- failed queued item can be retried safely
- no duplicate link occurs

## 11. Risks

Main risks to call out early:
- orphan Sale records if mobile uses a two-step link flow
- duplicate linking if the same draft is replayed without batch-aware idempotency
- batch context loss in the offline queue
- supplier changes after first scan if the UI does not lock supplier properly
- user confusion if batch mode and legacy standalone sale mode are mixed too loosely
- stale batch totals if the batch detail is not refreshed after item save
- reopened batch revision handling if current revision markers are not visible enough

## 12. Open Questions

1. Does mobile currently have a home screen suitable for My Batches?
   - Yes, `DashboardScreen` exists, but it is not batch-specific. It can act as a fallback hub, not the final batch UX.

2. Can supplier be selected before scanning today?
   - Yes. Sale entry already supports supplier selection and auto-detection.

3. Does current `POST /sales` return enough data to link item safely?
   - It returns the created Sale summary, id, ref, duplicate flag, and core fields. It is enough for item creation, and now also supports batch-aware sale creation when `batchId` is supplied.

4. Should `POST /sales` accept optional `batchId` directly?
   - Yes. The backend already supports it, so mobile should use that one-request path.

5. Can the pending queue preserve batch context safely?
   - Yes, but not yet. The queue schema will need `batchId`/`batchRef`/revision fields added.

6. What happens if an offline user creates a batch before network exists?
   - Not currently supported in the mobile app. Defer offline batch creation for v1.

7. Should offline batch creation be supported in v1 or deferred?
   - Deferred.

8. Should scan start be blocked until batch is selected?
   - In batch mode, yes. That is the cleanest way to keep item sales attached to the correct supplier batch.

9. Should manual standalone Sale remain possible?
   - Yes, as a legacy/non-batch fallback unless the product later decides to fully migrate to batch-first sales.

10. Should salesman be able to create unbatched Sale in the new workflow?
   - Prefer no in batch mode. Keep a legacy standalone path only if the business explicitly wants it.

## 13. Batch-aware sale create update

- `POST /api/v1/sales` now accepts optional `batchId`.
- Standalone sale support remains unchanged when `batchId` is absent.
- The mobile batch workflow should use the one-request create path instead of a create-then-link flow.
- The backend validates batch access, batch status, and supplier consistency before creation.
- The backend stores batch metadata on the Sale and refreshes batch totals server-side.
- If aggregate refresh fails after the Sale is stored, the API returns success with a warning so mobile does not retry into a duplicate Sale.
