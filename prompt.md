codex response- Files changed
`backend/src/models/Sale.js`
`backend/src/controllers/sales.controller.js`
`backend/src/services/saleCalculationSnapshot.service.js`
`backend/scripts/check-sale-settlement-inputs.js`
`backend/scripts/check-sale-calculation-snapshot.js`
`docs/CURRENT_SYSTEM_UNDERSTANDING.md`
`docs/MEETING_BASED_REDESIGN_PLAN.md`
Settlement input model added
Added optional Sale.settlementInputs.
Fields added: karat, category, purityPercent, originalPurityPercent, puritySource, purityOverridden, wastagePercent, originalWastagePercent, wastageSource, wastageOverridden, supplierId, supplierCode, resolvedAt.
All fields are optional and backward-compatible.
Old sales remain valid.
Purity resolution behavior
Priority now is explicit purityPercent, legacy numeric/percent purity or purity_percent, parsed QR purityPercent, supplier override for karat, global karat fallback, then null.
Karat is kept separate from purityPercent.
18K is not treated as 75 unless it is explicitly resolved through the purity fallback path.
If the request purity differs from the resolved base purity, the sale stores purityOverridden = true and originalPurityPercent.
Wastage resolution behavior
Priority now is explicit wastagePercent, supplier category wastage, supplier default wastage, global settlement fallback, then null.
If the request wastage differs from the resolved base wastage, the sale stores wastageOverridden = true and originalWastagePercent.
wastageSource records where the resolved value came from.
Override tracking behavior
puritySource and wastageSource now record origin strings such as request, parsed_qr, supplier_override, supplier_category, supplier_default, global_default, manual_override, and unknown.
originalPurityPercent and originalWastagePercent preserve the backend-resolved baseline before a user override.
Manual overrides are allowed and do not block sale creation.
Calculation snapshot integration
buildSaleCalculationSnapshot() now consumes settlementInputs.
calculationSnapshot.purityPercent and calculationSnapshot.wastagePercent come from the resolved settlement inputs.
Sale now stores both settlementInputs and calculationSnapshot.
GET /api/v1/sales/:id includes settlementInputs, calculationSnapshot, and parsedSnapshot.
GET /api/v1/sales and export stay lightweight and exclude those snapshots.
Sale detail response changes
Sale detail now returns settlementInputs if present.
The sale list and CSV export intentionally do not include it.
Script/test results
node --check backend/src/models/Sale.js passed
node --check backend/src/controllers/sales.controller.js passed
node --check backend/src/services/saleCalculationSnapshot.service.js passed
node backend/scripts/check-sale-settlement-inputs.js passed: Sale settlement input checks passed (5/5)
node backend/scripts/check-sale-calculation-snapshot.js passed: Sale calculation snapshot checks passed (4/4)
node backend/scripts/check-settlement-calculation.js passed: Settlement calculation checks passed.
node backend/scripts/check-yug-parser-fixtures.js passed: Yug parser fixture checks passed (11/11)
node backend/scripts/check-utsav-parser-fixtures.js passed: Utsav parser fixture checks passed (5/5)
node backend/scripts/check-adinath-parser-fixtures.js passed: Adinath parser fixture checks passed (6/6)
node backend/scripts/check-venzora-parser-fixtures.js passed: Venzora parser fixture checks passed (3/3)
npm run test:precision passed: QR precision tests passed (7/7)
git diff --check passed with only CRLF warnings
Validation results
Backend syntax checks passed for all changed backend JS files.
The new settlement-input script passed.
The sale calculation snapshot script passed.
Existing precision and parser regression checks still passed.
I did not run Flutter tooling, per your instruction.
backend/package.json does not define a lint script, so there was no backend lint command to run.
What was intentionally not changed
Mobile UI
Admin UI
Reports
OCR
Batch flow
Parser architecture
Sale creation behavior beyond adding settlement audit tracking
Existing parser fixtures and supplier logic beyond validation compatibility
Remaining risks/open questions
Older clients that still send freeform purity text may not map cleanly to purityPercent unless the value is numeric or percentage-shaped.
The new settlementInputs are stored and returned, but no UI consumes them yet.
Supplier-specific business defaults still depend on current configuration quality.
Sale list/export intentionally omit settlementInputs, so detail view remains the place for audit inspection.

CURRENT_SYSTEM_UNDERSTANDING.md
Document · MD
Open in

MEETING_BASED_REDESIGN_PLAN.md
Document · MD
Open in

Edited 8 files
+554
-115
Undo
Review
backend/src/services/saleCalculationSnapshot.service.js
backend/src/controllers/sales.controller.js
backend/src/models/Sale.js

Show 5 more files
