# Product Requirements Document (PRD)
## Jewellery Sales Management System
**Version:** 1.1  
**Date:** 2026-04-15  
**Author:** Shaurya Kumar  
**Status:** Draft

> **v1.1 Change:** Scope trimmed to a true lean MVP. Features that don't directly answer "did we record the sale correctly?" moved to Phase 2/3.

---

## 1. Product Overview

### 1.1 Purpose
A mobile + web system that enables jewellery shop salesmen to record QR-based sales entries on-the-go, while giving administrators control over supplier configuration and basic sales visibility.

### 1.2 Problem Statement
Jewellery sales entry is currently manual — prone to human error in weight recording, category assignment, and supplier tracking. QR codes on jewellery pieces carry product information but are not being used for automated data entry.

### 1.3 Goals
- Reliably scan a QR and save a sale in under 60 seconds
- Handle QR failures gracefully — never block a sale because of a bad scan
- Give admin enough visibility to verify sales are being recorded correctly
- Support multiple suppliers each with their own QR format

### 1.4 Out of Scope (v1.0)
- iOS support
- Customer-facing app
- Payment processing / billing
- Inventory management
- Online catalogue
- Charts and analytics (Phase 2)
- PDF export (Phase 2)
- Customer management (Phase 2)
- Audit logs (Phase 3)

---

## 2. User Personas

### 2.1 Salesman (Mobile App User)
- Works on the shop floor
- Uses an Android phone (often mid-range)
- Scans QR codes on jewellery pieces
- Records weight, category, rate per gram
- Needs fast, simple UI — minimal taps per sale
- Not technically skilled; must not be blocked by app errors

### 2.2 Admin (Web Dashboard User)
- Shop owner or manager
- Uses a laptop/desktop browser
- Needs to configure suppliers and QR mappings
- Needs to verify sales are being recorded correctly
- Manages salesman accounts

---

## 3. Release Phases

### Phase 1 — MVP (Build this first, nothing else)
**Goal:** A salesman can scan a QR, fill in missing info, and save a sale. Admin can set up suppliers and see what was sold.

### Phase 2 — Reporting & History
Charts, reports, date filters, PDF export, customer management, sale history filters.

### Phase 3 — Operations
Audit logs, offline support, sale edit lock, advanced permissions, performance analytics.

---

## 4. MVP Features (Phase 1 only)

### 4.1 Authentication

| ID | Requirement | Notes |
|----|-------------|-------|
| AUTH-01 | Email/Password login | All users |
| AUTH-02 | JWT session | 8-hour expiry |
| AUTH-03 | Admin-only user creation | No self-registration |
| AUTH-04 | Role-based access: Admin vs Salesman | Enforced on every API route |

---

### 4.2 QR-Based Sale Entry (Mobile) — Core Feature

| ID | Requirement | Notes |
|----|-------------|-------|
| QR-01 | QR scanner using device camera | MLKit via mobile_scanner |
| QR-02 | Auto-detect supplier from QR content | Match by supplier code prefix/pattern |
| QR-03 | Support 3 QR mapping strategies (see 4.2.1) | Configured per supplier by admin |
| QR-04 | Auto-fill fields from QR: Category, Gross Weight, Stone Weight, Net Weight | Best-effort; partial fill is OK |
| QR-05 | Manual entry fallback — all fields editable if QR fails or is partial | Cannot block the sale |
| QR-06 | Manual supplier selection if auto-detect fails | Dropdown of active suppliers |
| QR-07 | Rate per gram — always manual input by salesman | No auto-fill |
| QR-08 | Auto-calculate: Total = Net Weight × Rate per gram | Live as user types |
| QR-09 | Confirmation screen before saving | Show all fields clearly |
| QR-10 | Save sale with: timestamp, salesman, supplier, all weight fields, rate, total | Core data |
| QR-11 | Duplicate QR — warn if same QR hash scanned on same calendar day; always allow override; save with `isDuplicate: true` flag | Never hard block — corrections and re-entries happen |
| QR-12 | QR debug panel — show raw QR string + which fields parsed vs failed | Visible on parse error |

#### 4.2.1 QR Mapping Strategies

Three strategies supported, configured per-supplier by admin:

**Strategy A — Delimiter-based**
Split QR string by a delimiter, map fields by index.
```
Raw:    SUP01|RING|24.5|2.1|22.4
Config: delimiter="|", supplierCode=0, category=1, grossWeight=2, stoneWeight=3, netWeight=4
```

**Strategy B — Fixed Position**
Extract fields by character position ranges `[start, end]`.
```
Raw:    SUP01RING02452122
Config: supplierCode=[0,5], category=[5,9], grossWeight=[9,14], stoneWeight=[14,17], netWeight=[17,22]
```

**Strategy C — JSON**
QR is a JSON string, map fields by key names.
```
Raw:    {"sup":"SUP01","cat":"RING","gw":24.5,"sw":2.1,"nw":22.4}
Config: supplierCode="sup", category="cat", grossWeight="gw", stoneWeight="sw", netWeight="nw"
```

#### 4.2.2 QR Error Handling (Critical)

The QR parser must never crash the app. It must return structured results:

| Scenario | System Behaviour |
|----------|-----------------|
| QR scanned, all fields parsed | Auto-fill all fields, salesman reviews |
| QR scanned, some fields missing | Fill what parsed, leave others blank, highlight missing in red, salesman fills manually |
| QR scanned, supplier not recognized | Show "Unknown supplier" warning, force manual supplier selection, all fields blank |
| QR scanned, parse fails entirely | Show raw QR string in debug panel, all fields blank, salesman fills manually |
| QR cannot be scanned (damaged, blur) | Tap "Enter manually" button, full manual entry |
| Duplicate QR detected | Show yellow warning banner with previous sale date, allow salesman to proceed or cancel |

**The app must never show an unhandled error or be stuck. Every failure state has an explicit fallback.**

---

### 4.3 Salesman Dashboard (Mobile)

| ID | Requirement | Notes |
|----|-------------|-------|
| DASH-01 | Today's total sales amount | Simple number, no chart |
| DASH-02 | Today's total weight sold (grams) | Simple number |
| DASH-03 | Quick list of today's sales (last 5) | Tap to view detail |

---

### 4.4 Sale History (Mobile)

| ID | Requirement | Notes |
|----|-------------|-------|
| HIST-01 | List of all sales by logged-in salesman | Newest first |
| HIST-02 | View full detail of a single sale | All fields |

---

### 4.5 Admin — Sales View (Web)

| ID | Requirement | Notes |
|----|-------------|-------|
| ASALES-01 | List all sales across all salesmen | Newest first |
| ASALES-02 | Filter by salesman | Dropdown |
| ASALES-03 | Filter by supplier | Dropdown |
| ASALES-04 | Filter by date | Date picker |
| ASALES-05 | View full detail of a single sale | All fields |
| ASALES-06 | Today's totals: sales count, weight, revenue | Simple summary row |

---

### 4.6 Supplier Management (Web) — Core Feature

| ID | Requirement | Notes |
|----|-------------|-------|
| SUP-01 | Add / Edit / Delete supplier | |
| SUP-02 | Fields: Name, Code, GST, Address, Payment Mode | Code used for QR auto-detect |
| SUP-03 | Select QR mapping strategy (A / B / C) | |
| SUP-04 | Configure field mapping for chosen strategy | Dynamic form based on strategy |
| SUP-05 | Category list per supplier | Simple comma-separated or list |
| SUP-06 | **QR Test Tool** — paste a raw QR string, see exactly what parses | Must-have, not optional |
| SUP-07 | Active / Inactive toggle | Inactive suppliers hidden from salesman |

> **Note on SUP-06:** The QR test tool is a first-class feature. Supplier QR formats will change without warning. Admin must be able to debug and fix mapping configs without developer help.

---

### 4.7 User Management (Web)

| ID | Requirement | Notes |
|----|-------------|-------|
| USR-01 | Create salesman account | Admin only |
| USR-02 | Edit salesman name / email | |
| USR-03 | Activate / Deactivate account | Deactivated users cannot login |
| USR-04 | Admin can set/reset password | Simple — admin sets new password directly |

---

## 5. Phase 2 Features (Do not build until Phase 1 ships)

- Supplier-wise / category-wise / salesman-wise reports
- Date-range report filters
- Charts and analytics (admin dashboard)
- PDF export
- Monthly performance chart (mobile)
- Customer management + sale linkage
- Sale history filters (date, supplier)
- Sale edit window + edit permissions per salesman

---

## 6. Phase 3 Features (Future)

- Offline sale queuing + sync
- Audit log (action history with before/after)
- Sale edit lock enforcement
- Advanced role permissions
- Company settings (logo, tax, default rate)
- Multi-branch support

---

## 7. User Flows

### 7.1 Salesman — QR Sale Entry (Happy Path)
```
Dashboard → Tap "New Sale"
→ Camera opens
→ Scan QR
→ Supplier auto-detected
→ Fields auto-filled (Category, Gross, Stone, Net Weight)
→ Salesman types Rate per gram
→ Total calculated automatically
→ Review screen → Tap "Save"
→ Back to dashboard, count updated
```

### 7.2 Salesman — QR Sale Entry (Failure Path)
```
Dashboard → Tap "New Sale"
→ Camera opens
→ Scan QR → Parse fails / partial

If partial parse:
→ Filled fields shown, missing fields highlighted red
→ Salesman fills missing fields manually
→ Rate per gram → Save

If supplier not found:
→ Warning shown
→ Salesman selects supplier from dropdown
→ All fields blank, fill manually
→ Rate per gram → Save

If QR cannot be scanned:
→ Tap "Enter Manually"
→ Select supplier → fill all fields manually
→ Rate per gram → Save
```

### 7.3 Admin — Configure New Supplier
```
Suppliers → Add Supplier
→ Name, Code, GST, Address, Payment Mode
→ Select QR strategy
→ Configure field mapping
→ Add categories
→ Paste sample QR string into Test Tool
→ Verify parsed output matches expected
→ Fix mapping if wrong → re-test
→ Save
```

---

## 8. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| QR Performance | Scan-to-parse result under 1 second on mid-range Android |
| Failure Handling | Every QR error state has an explicit UI flow — no dead ends |
| Usability | Salesman completes a sale in under 60 seconds including manual corrections |
| Security | JWT on all protected routes, role check on every endpoint |
| Availability | API uptime 99.5% on VPS |
| Scalability | Up to 50 salesmen, 20 suppliers in Phase 1 |

---

## 9. Open Questions (Resolve before building Phase 2)
- [ ] Is wifi reliable in the shop, or do we need offline-first queuing?
- [ ] Should duplicate QR be a hard block or a soft warning?
- [ ] What is the sale edit lock window? (2 hours? end of day? no lock in Phase 1?)
- [ ] Will PDFs be downloaded or emailed?
- [ ] Multi-branch needed in future?
