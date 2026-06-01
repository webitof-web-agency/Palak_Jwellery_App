# Meeting Based Redesign Plan

## 1. Executive Summary

The product direction is shifting from a technically exposed QR configuration system toward a business-friendly jewellery settlement workflow.

Current live behavior is technically capable, but the presentation is too developer-centric for a shop owner or non-technical operator. The redesign direction is:

- keep QR parsing, validation, correction, and review infrastructure
- hide parser internals from normal supplier settings
- make supplier setup feel like business configuration, not parser engineering
- make mobile feel like a batch capture and settlement preparation tool
- make reporting feel like supplier-wise and overall settlement analysis, not QR diagnostics

The main business shift is:

- from “configure delimiters and parser maps”
- to “manage suppliers, categories, karat purity, wastage, and settlement rules”

OCR is intentionally out of scope for mobile v1.

## 2. Current Problems

The current implementation has these visible issues:

- the supplier edit page is too technical for a non-technical jewellery shop owner
- Yug detection and validation need stronger business-aware rules
- QR values can be inconsistent across suppliers and cannot always be trusted blindly
- calculation fields are not explained clearly enough in the operator flow
- reports need supplier-wise, overall, category-wise, karat-wise, and item-wise structure
- mobile currently feels like single-item entry instead of batch-assisted capture
- OCR should not be added to mobile v1

Specific UX gaps:

- delimiter / strategy / regex / field-map controls should not be normal business inputs
- purity values need to be configurable by karat and by supplier
- wastage needs to be category-aware for suppliers like Yug
- item list preview and batch finalization are missing from the mobile flow
- report outputs need clearer settlement meaning

## 3. New Supplier Settings Model

The supplier model should be split into business-facing settings and hidden technical parser settings.

### 3.1 Business-facing supplier settings

- supplier basic info
  - name
  - code
  - active status
  - contact / notes if needed
- supplier categories
  - e.g. White, Green, Purple/Orange, Skyblue
- category-wise wastage
  - each category can carry its own wastage percent
- karat purity configuration
  - default values for 9K, 14K, 18K, 20K, 22K, 24K
  - supplier-specific override per karat
- stone weight rules
  - whether stone is captured from QR
  - whether stone components are summed
- other weight rules
  - whether other weight is present
  - whether it is deducted from net
- stone amount rules
  - charged from QR, derived, or manually entered
- report defaults
  - default filters
  - default grouping
  - export preference

### 3.2 Hidden / developer-controlled settings

These should not be exposed as the main supplier form:

- delimiter
- parser strategy
- regex / contains / prefix rules
- field-map index mapping
- parser profile version
- fallback parser behavior
- internal learning / template metadata

Recommended UI split:

- normal business settings tab
- advanced developer tab

Normal admin users should mostly see business controls.
Advanced parser controls should be hidden behind an admin/developer gate.

Backend foundation note:

- live code now supports `Supplier.businessSettings` and `Supplier.qrProfile`
- helper logic exists in `backend/src/services/supplierBusinessSettings.service.js`
- sale creation now stores a calculation audit snapshot (`Sale.calculationSnapshot`), optional parsed snapshot (`Sale.parsedSnapshot`), and a settlement-input snapshot (`Sale.settlementInputs`)
- `Sale.settlementInputs` tracks karat, purity percent, wastage percent, source labels, and override flags
- `Sale.calculationSnapshot` is built from resolved settlement inputs, not raw UI fields alone
- sale detail returns those stored snapshots for verification/debugging
- the first batch/session foundation now exists in backend code: `ScanBatch`, optional `Sale.batchId` metadata, a batch lifecycle helper, and the backend batch API surface; admin batch review UI exists and mobile batch UI remains next-phase work
- exact category wastage and karat purity values are still pending business confirmation and should remain placeholder-safe

## 4. Purity and Wastage Rules

### 4.1 Global karat defaults

The system should support default purity values for:

- 9K
- 14K
- 18K
- 20K
- 22K
- 24K

These defaults should be configurable globally.

### 4.2 Supplier override

Each supplier may override the default karat purity.

Examples:

- Yug 18K may use 75.15%
- Venzora 18K may use 75.50%

This means the system must not hardcode one universal purity for a karat.

### 4.3 Category wastage

Wastage may vary by supplier category.

For example, Yug categories may use different wastage:

- White
- Green
- Purple/Orange
- Skyblue

### 4.4 Calculation formula

The settlement formula should be represented clearly in UI and backend:

```text
netWeight = grossWeight - stoneWeight - otherWeight (if otherWeight exists)
settlementPercent = purityPercent + wastagePercent
fineWeight = netWeight × settlementPercent / 100
```

Example:

- grossWeight = 10g
- stoneWeight = 1g
- netWeight = 9g
- purity = 76%
- wastage = 10%
- settlementPercent = 86%
- fineWeight = 9 × 86 / 100 = 7.74g

### 4.5 Fine weight vs money amount

These must be explained separately:

- fine weight = grams of fine content after purity + wastage calculation
- money amount = settlement money, which may depend on rate, buyer/supplier rules, or a later settlement model

Do not conflate fine weight with currency amount.

## 5. Yug Supplier Redesign

Yug needs a supplier-specific business interpretation, not just a parser map.

### 5.1 Yug categories

At minimum:

- White
- Green
- Purple / Orange
- Skyblue

### 5.2 Yug QR structure

Yug packing lists / invoices may include:

- Gross Wt
- SS Wt
- MS Wt
- Ot. Wt
- Sp.Wt
- Net Wt
- SS Amt
- MS Amt
- Sp. Amt
- Ot. Amt

Live parser hardening should treat Yug as a structural positional format, not a single item-prefix family. In the current codebase, Yug detection is based on a strong slash-delimited signature and the real fixture set, not only on prefixes like `SWMS` or `SWNK`.

### 5.3 Yug calculation logic

The parser and validation layer should treat Yug as a business-specific rule set:

```text
stoneWeight = SS Wt + MS Wt + Sp.Wt
otherWeight = Ot. Wt
computedNetWeight = grossWeight - stoneWeight - otherWeight
```

Current live parser fixture mapping for Yug also uses:

- `[0]` batch / serial id
- `[1]` secondary internal id
- `[2]` karat
- `[3]` gross weight
- `[4]` stone component 1
- `[5]` QR net weight
- `[6]` stone amount
- `[7]` item / design code
- `[8]` size
- `[9]` metal type
- `[10]` lot code
- `[11]` other weight
- `[13]` color / category
- `[14]` stone component 2

If QR net exists:

- compare computedNetWeight against QR netWeight
- if the mismatch is beyond tolerance, mark warning/review

### 5.4 Yug trust rules

Yug QR values should not be blindly trusted.

Recommended behavior:

- parse all fields
- compute derived weights
- compare against QR net
- surface warnings if mismatch exceeds tolerance
- allow manual correction before save

### 5.6 Adinath calculation logic

Adinath should be treated as a structural slash-delimited format with blank segments tolerated.

Recommended behavior:

- first numeric segment is gross weight
- last segment is item/design code
- numeric segment immediately before the item code is QR net weight
- numeric segments between gross and QR net are stone components
- stone components should be summed into stoneWeight
- computedNetWeight = grossWeight - stoneWeight
- computed net must be compared against QR net and flagged if the mismatch exceeds tolerance

### 5.5 What mobile should show for Yug

Mobile should show:

- supplier name
- category
- raw parsed weight breakdown
- gross weight
- SS / MS / Sp / Ot weights
- computed stone weight total
- computed net weight
- QR net weight if present
- warning indicator if mismatch exists

### 5.6 Normalized display contract

Future admin/mobile screens should use the normalized display contract from the parser output instead of raw parser internals.

Backward-compatible flat aliases still exist in the live backend, but the preferred contract is:

- `display.supplier`
- `display.item`
- `display.weights`
- `display.amounts`
- `display.calculation`
- `display.warnings`
- `display.requiresReview`
- `display.rawQr`

This lets the UI stay display-friendly without depending on parser implementation details like field indices or supplier-specific raw mapping objects.

## 6. Mobile UI Redesign

The mobile app should become a batch-oriented capture workflow.

### Proposed screens

1. Supplier selection / scanner screen
2. Scan result review screen
3. Calculation preview section
4. Manual correction fields
5. Temporary scanned item list
6. Batch preview screen
7. Batch submit success screen
8. Pending queue / error recovery

### 6.1 Supplier selection / scanner screen

Purpose:
- select supplier first
- then scan QR

Fields:
- supplier picker
- camera preview
- last selected category / karat if applicable

Buttons:
- start scan
- manual entry
- torch toggle
- back

Validations:
- supplier should be selected or auto-detected before finalization

Failure handling:
- if QR fails, allow manual continuation
- do not block the flow

API calls:
- parse QR with supplier hint
- load supplier list / overview

### 6.2 Scan result review screen

Purpose:
- show parsed item data immediately after scan

Fields:
- raw QR
- supplier
- item/design code
- category
- karat
- gross weight
- stone weight breakdown
- other weight
- QR net weight
- computed net weight
- purity
- wastage

Buttons:
- accept
- edit
- rescan
- save to batch

Validations:
- net mismatch warning
- missing field warning
- invalid weight warning

Failure handling:
- allow manual correction even if parse is partial

### 6.3 Calculation preview section

Purpose:
- explain how settlement values were derived

Fields:
- gross weight
- stone weight total
- other weight
- computed net
- purity percent
- wastage percent
- settlement percent
- fine weight

Buttons:
- none required beyond edit/accept

Validations:
- formula should be visible and consistent

### 6.4 Manual correction fields

Purpose:
- allow quick operator correction

Fields:
- category
- karat
- gross weight
- stone weight component fields
- other weight
- purity percent
- wastage percent
- notes / warning reason

Buttons:
- save changes
- cancel

Failure handling:
- never lock the item due to parse inconsistency

### 6.5 Temporary scanned item list

Purpose:
- support multiple-item scanning in one session

Fields:
- item reference
- supplier
- category
- gross/net/fine summary
- warning badge

Buttons:
- edit item
- remove item
- add another item

Validations:
- duplicate item warning
- per-item warning display

### 6.6 Batch preview screen

Purpose:
- review the batch before submit/finalize

Fields:
- all scanned items
- totals
- supplier summary
- category summary
- net / fine summary

Buttons:
- submit batch
- edit batch
- cancel batch

Failure handling:
- if a single item has a warning, show it clearly without stopping the whole batch unless business rules require it

### 6.7 Batch submit success screen

Purpose:
- confirm batch saved

Fields:
- batch reference
- item count
- totals

Buttons:
- scan more
- go to history

### 6.8 Pending queue / error recovery

Purpose:
- preserve scanned items if submission fails

Fields:
- pending batch items
- retry status
- error message

Buttons:
- retry
- discard after confirmation

## 7. Admin Panel Redesign

The admin panel should be split into business settings and advanced parser settings.

### Pages to update

- Supplier list
- Supplier business settings
- Advanced parser settings
- Business settings
- Settlement reports
- Exceptions / review
- Sale detail

### Supplier edit layout

Recommended tabs:

1. Business Settings
2. Categories & Wastage
3. Karat Purity
4. QR Template
5. Advanced Developer

### 7.1 Business Settings tab

Contains:

- supplier name
- code
- active status
- contact / notes

### 7.2 Categories & Wastage tab

Contains:

- supplier categories
- category-specific wastage

### 7.3 Karat Purity tab

Contains:

- global karat defaults
- supplier-specific purity overrides

### 7.4 QR Template tab

Contains:

- template profile selection
- preview of supported QR format

### 7.5 Advanced Developer tab

Contains:

- parser strategy
- delimiter
- regex
- field mapping
- internal template versioning

This tab should be hidden from normal business users unless explicitly enabled.

## 8. Reporting Redesign

Reports should be designed as settlement analysis, not QR debug output.

### Report types

- supplier-wise settlement report
- overall settlement report
- category summary
- karat summary
- item detail report

### Export formats

- PDF export
- CSV export

### Required columns

- supplier
- date
- ref
- item/design code
- category
- metal type
- karat
- gross weight
- SS weight
- MS weight
- SP weight
- other weight
- stone weight total
- net weight
- purity percent
- wastage percent
- settlement percent
- fine weight
- stone amount
- other amount
- notes / warnings

### Reporting behavior

- supplier-wise report should group by supplier and category
- overall report should aggregate all suppliers
- item-wise detail should preserve row-level traceability
- karat-wise summary should compare settlement percent by karat

## 9. Backend Changes Needed

This section describes required backend direction. A standalone calculation service now exists, sale creation stores a calculation snapshot, and QR parsing already uses the live settlement helpers. Settlement reporting still keeps a partial legacy path, so downstream wiring is not fully unified yet.

### Proposed backend changes

- use the centralized settlement calculation service at `backend/src/services/settlementCalculation.service.js`
- the service should expose:
  - `normalizeNumber(value, fallback = 0)`
  - `calculateNetWeight({ grossWeight, stoneWeight, otherWeight })`
  - `calculateSettlementPercent({ purityPercent, wastagePercent })`
  - `calculateFineWeight({ netWeight, purityPercent, wastagePercent })`
  - `validateQrNetWeight({ grossWeight, stoneWeight, otherWeight, qrNetWeight, tolerance })`
  - `calculateSettlementSnapshot({ grossWeight, stoneWeight, otherWeight, qrNetWeight, purityPercent, wastagePercent, tolerance })`
  - `calculateYugWeightBreakdown({ grossWeight, ssWeight, msWeight, spWeight, otWeight, qrNetWeight, tolerance })`
- the service should return warnings instead of throwing for normal bad jewellery data
- supplier settings schema should be split into business settings and parser profile
- calculation service should accept:
  - grossWeight
  - stoneWeight
  - otherWeight
  - purityPercent
  - wastagePercent
- sale creation should resolve and store:
  - karat
  - category
  - purityPercent
  - originalPurityPercent
  - puritySource
  - purityOverridden
  - wastagePercent
  - originalWastagePercent
  - wastageSource
  - wastageOverridden
- parser result validation service should compare computed net against QR net and produce review flags
- batch sale API should support multiple scanned items in one session
- report query should support supplier-wise, overall, category-wise, karat-wise, and item-wise filters
- sale detail should continue to exist and be used for verification/debugging
- sale creation should store `calculationSnapshot` and optional `parsedSnapshot` for auditability
- this calculation service is not yet wired everywhere; that is intentional for this phase
- supplier business settings are now supported at the schema/helper level, but exact business values are still pending confirmation

### Migration / backfill risk

- old supplier records may need a compatibility layer
- old sales records may not have the new batch/calculation snapshot fields
- report logic must not silently reinterpret old data

## 10. Database Changes Needed

Proposed model changes only.

### Supplier

Add support for:

- category settings
- category-specific wastage
- karat purity overrides
- parser profile version
- QR template selection

### Sale

Add support for:

- calculation snapshot
- parsed weight breakdown
- fine weight snapshot
- settlement percent
- warning flags
- settlement input snapshot with karat / purity / wastage source tracking
- batch/group identifier

### QR ingestion

Add support for:

- item-level warning fields
- tolerance mismatch fields
- supplier-specific validation notes

### Batch session

If implemented later, add a batch/session identifier for multi-item scan sessions.

## 11. API Changes Needed

Proposed APIs:

- GET supplier settings overview
- PUT supplier business settings
- POST parse QR with supplier hint
- POST sales batch
- GET sale detail
- GET supplier-wise report
- GET overall report

Suggested shape:

- supplier overview should return business settings plus hidden parser profile metadata separately
- parse QR should accept supplier hint but still handle unknowns safely
- batch sale should return per-item results and a batch summary

## 12. OCR Decision

OCR should not be added to mobile v1.

Reason:

- OCR is too error-prone for jewellery decimals and fine weight interpretation
- mobile v1 should stay QR/manual verification focused
- OCR is better treated later as an admin-side packing-list import workflow

If OCR is introduced later:

- require manual review
- treat it as assistive extraction only
- never let OCR auto-finalize without review

## 13. Implementation Phases

### Phase 1: docs and schema planning

- finalize business rules
- define supplier data structure
- define karat defaults and overrides
- define report columns and batch flow

### Phase 2: calculation service

- centralize net / fine calculation
- define tolerance checks
- define warning/review flags
- keep the service reusable for mobile sale entry, QR validation, sale creation, and reports later

### Phase 3: Yug parser hardening with fixtures

- collect Yug real samples
- validate SS / MS / Sp / Ot breakdown
- test mismatch tolerance

### Phase 4: supplier settings UI simplification

- hide parser internals
- expose business tabs only
- add advanced developer tab

### Phase 5: mobile batch scan UI

- supplier-first scanning
- temporary list
- batch preview
- final submit

### Phase 6: reporting redesign

- supplier-wise / overall / karat-wise / category-wise reports
- PDF and CSV exports

### Phase 7: optional admin OCR/import research

- research-only phase
- admin-side only
- manual review mandatory

## 14. Risks

- changing parser logic can break existing suppliers
- changing supplier schema can break old records or existing configuration
- batch scanning can create duplicate sales if idempotency is not defined clearly
- calculation mismatch can hurt trust if the formula is not displayed clearly
- non-technical admins can misconfigure suppliers if technical controls are exposed too early
- Yug-specific logic may need fixture-based testing before deployment

## 15. Open Questions

Questions to confirm with the business owner:

- exact wastage values for each Yug category
- exact purity percent per supplier and karat
- whether stone amount is charged from QR or entered manually
- whether other weight is deducted in all categories
- whether batch submission should create one settlement group or separate sales
- whether reports should show company-provided net or computed net
- what tolerance is allowed for QR net mismatch
- whether stone amount should be supplier-provided, QR-derived, or manual by default
- whether settlement money amount is needed in v1 or only fine weight
- exact category wastage values remain `UNCLEAR` until business confirms them

### Suggested business decisions to confirm

- if supplier QR net disagrees with computed net, should the record auto-review or auto-reject?
- should purity overrides be editable by admin only or also by senior shop owner?
- should batch preview be mandatory before submit?
- should Yug categories be fixed or configurable?

### Unclear items

If any of the above is not yet confirmed by the business, mark it `UNCLEAR` in implementation specs and keep the code path manual-review safe.

## 16. Batch-aware sale create update

- `POST /api/v1/sales` now accepts optional `batchId` for the mobile batch workflow.
- Standalone sale support remains unchanged when `batchId` is absent.
- The batch-aware sale path validates:
  - batch existence
  - item-update permission
  - batch status
  - supplier consistency
- The sale stores batch metadata at creation time instead of relying on a second link request.
- Batch aggregates are refreshed server-side after sale creation.
- If aggregate refresh fails after the sale is safely stored, the API returns success with a warning instead of forcing a duplicate-prone retry.
