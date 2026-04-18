# Gemini Prompts
## Ready-to-use prompts for logic review and algorithm analysis

---

## General Setup (paste first in every Gemini session)

```
You are reviewing code for a Jewellery Sales Management System.

The project has 3 agents:
- Claude Code: built the backend, acts as supervisor
- Codex: built Flutter mobile app and React admin panel
- Gemini (you): reviews logic, algorithms, edge cases, and security

Your job is NOT to rewrite code. Your job is to:
1. Find logical gaps, edge cases, and missing validations
2. Suggest specific fixes (not rewrites)
3. Report back in the DELIVERY format

Read AGENTS.md for full project context before starting.
```

---

## Slice 2 — QR Parser Review (run this now against real QR samples)

```
[General Setup above]

SLICE 2 — QR PARSER REVIEW

Claude built the QR parser. Your job: find edge cases and gaps.

Real QR samples are in: qr-samples/ folder
Parser code is in: backend/src/services/qrParser.service.js

Read both before starting.

Review for:

1. DETECTION GAPS
   - Can detectSupplier() fail silently in ways that aren't obvious?
   - What happens if two suppliers have overlapping codes?
   - What if the QR string has leading/trailing whitespace or newlines?
   - What if the QR string is very long (>500 chars)?

2. DELIMITER PARSING GAPS
   - What if the delimiter appears inside a field value?
     e.g. "AA01|RING (size|6)|24.5|2.1|22.4" — pipe inside category name
   - What if weights have units attached? e.g. "24.5g" or "24.5 grams"
   - What if weights use comma as decimal separator? e.g. "24,5" (European format)
   - What if the QR has extra fields beyond the configured ones?
   - What if fields are in a different order than configured?

3. REAL QR SAMPLES
   - Paste each sample from qr-samples/ into your analysis
   - Does the current parser handle them correctly?
   - What mapping config would be needed for each?

4. MISSING VALIDATIONS
   - Should netWeight always be <= grossWeight? (it should — stone weight is part of gross)
   - Should grossWeight always be > 0?
   - Should category be validated against the supplier's configured categories list?

Report back:
- List of gaps found with specific line references
- Suggested fixes (concise — not full rewrites)
- Recommended mapping configs for each real QR sample found

DELIVERY FORMAT:
SLICE 2 GEMINI DELIVERY
Gaps found: [list with line numbers]
Suggested fixes: [concise descriptions]
QR sample analysis: [one line per sample — does it parse correctly?]
Recommended mapping configs: [per supplier]
```

---

## Slice 3 — Failure State + Contract Review

```
[General Setup above]

SLICE 3 — FAILURE STATE REVIEW

Codex is building the Flutter sale entry flow.
Claude is building the backend POST /sales endpoint.

Your job: review the failure states and contract before both start building,
so gaps are caught now not after the code is written.

Backend contract Claude will implement:

POST /api/v1/sales
Request: {
  supplierId: string,
  qrRaw: string,
  category: string,
  grossWeight: number,
  stoneWeight: number,
  netWeight: number,
  ratePerGram: number
}
Response 201: { success: true, data: { _id, totalValue, saleDate } }
Response 400: { success: false, error: "...", code: "VALIDATION_ERROR" }
Response 409: { success: false, error: "...", code: "DUPLICATE_QR", data: { previousSale: { saleDate, salesman } } }

Flutter flow:
1. Scan QR → call POST /suppliers/parse-qr → auto-fill form
2. Salesman enters ratePerGram → total calculated live
3. Save → POST /sales
4. On 409 → show warning with previous sale date → allow override

Review for:

1. CONTRACT GAPS
   - Is the request shape complete? What fields might be missing?
   - Should qrRaw be required? What if salesman enters manually (no QR)?
   - Should totalValue be calculated client-side or server-side? (hint: server-side is safer)
   - What validations should the backend enforce?
     - netWeight <= grossWeight?
     - stoneWeight < grossWeight?
     - ratePerGram > 0?
     - All weight fields > 0?

2. DUPLICATE QR LOGIC
   - Current plan: same QR hash + same calendar day = duplicate
   - Is this the right window? What if same item is sold to two customers on different days?
   - Should the duplicate check be: same hash + ever? same hash + same salesman? same hash + same day?
   - The 409 response includes previousSale info — is { saleDate, salesman } enough for the UI?

3. FLUTTER FAILURE STATES
   - What if parse-qr returns partial data (some fields null)?
     → Which fields should block save vs just warn?
   - What if supplier is not detected?
     → Manual supplier select is required — but what if no suppliers exist yet?
   - What if ratePerGram is 0 or negative?
     → Should the save button be disabled or show an error?
   - What if the network drops mid-save?
     → Retry logic needed — but how do we prevent duplicate saves on retry?
     → Suggestion: idempotency key?

4. EDGE CASES IN WEIGHTS
   - netWeight = grossWeight - stoneWeight (should we enforce this or allow manual override?)
   - What if all weights are 0? (e.g. admin testing) — block or allow?

Report back with specific recommendations. Claude will implement the fixes.

DELIVERY FORMAT:
SLICE 3 GEMINI DELIVERY
Contract gaps: [list]
Duplicate logic recommendation: [your recommendation + reasoning]
Failure states missing: [list]
Weight validation rules: [your recommendations]
Idempotency suggestion: [yes/no + how]
```

---

## Slice 4 — Aggregation Logic Review

```
[General Setup above]

SLICE 4 — AGGREGATION REVIEW

Claude will build MongoDB aggregation pipelines for:
1. Today's summary: total sales count, total weight, total revenue
2. Supplier-wise breakdown: name, total weight, total revenue
3. Salesman-wise breakdown: name, sales count, total revenue
4. GET /sales with filters: salesman, supplier, date range, pagination

Review for:

1. AGGREGATION CORRECTNESS
   - Should "today" use server timezone or shop timezone? (potential bug if server is UTC)
   - Should weight summary use netWeight or grossWeight? (netWeight is correct for revenue)
   - Should revenue use totalValue (stored) or recalculate netWeight × ratePerGram live?
     (stored is correct — rate might change)

2. FILTER EDGE CASES
   - What if date range is very large (e.g. full year, 10,000 sales)?
     → Pagination needed — what page size?
   - What if salesman filter is applied — should admin see all salesmen's data?
   - What if supplier is deleted — do historical sales still show the supplier name?
     → Need to decide: store supplier name at sale time vs reference

3. INDEX REQUIREMENTS
   - Which fields need MongoDB indexes for these queries to be fast?
   - Suggest: saleDate, salesman, supplier, qrHash

Report back with specific recommendations.

DELIVERY FORMAT:
SLICE 4 GEMINI DELIVERY
Timezone recommendation: [decision + reasoning]
Weight field to use: [netWeight / grossWeight + why]
Pagination recommendation: [page size + cursor vs offset]
Supplier name storage: [store at sale time vs reference + why]
Index recommendations: [list of fields]
```
