# Current System Understanding

## 1. Executive Summary

This codebase is a production-in-progress jewellery QR system with three active surfaces:

- Admin panel: React 19 + Vite, used by admins for suppliers, users, settlement reporting, exceptions, and business settings.
- Mobile app: Flutter 3.41.6 + Riverpod + Dio, used by sales staff for login, QR scan, sale entry, history, and pending queue recovery.
- Backend: Node.js + Express + MongoDB + Mongoose, used for auth, supplier QR parsing, sale persistence, QR ingestion/correction, settlement reporting, business settings, and user management.

The live implementation is stronger than the older PRD/TRD in a few places:

- Settlement reporting is now centered on `Sale` records, with a legacy fallback to approved QR ingestions when no sales exist.
- Mobile has a lightweight pending queue with retry and persistence.
- QR parsing is safe-by-default: unknown formats do not block the user and partial results are returned.
- Admin now has a business-settings surface for categories, metal types, and settlement defaults.
- A centralized settlement calculation service now exists at `backend/src/services/settlementCalculation.service.js`.
- Sale creation now stores an audit snapshot (`calculationSnapshot`), an optional parser/display snapshot (`parsedSnapshot`), and a settlement-input snapshot (`settlementInputs`) so sale detail can explain how values were derived at the time of sale.
- The backend now also has the first batch/session foundation pieces: a `ScanBatch` model, optional batch fields on `Sale`, a lifecycle helper, and the Phase 2 batch API wiring (`/api/v1/batches`) for create/list/detail/items/submit/finalize/reopen/revisions/assignment. Admin batch review UI exists; mobile batch UI is still pending.

The biggest production risks are:

- Settlement reporting still has a legacy QR-ingestion fallback path.
- The batch workflow is now wired into backend routes and admin batch review UI, but mobile batch capture UI still remains pending. Item-level sales remain the only live mobile workflow.
- The admin API client now matches the backend sale-detail route.
- Documentation in `docs/PRD.md` and `docs/TRD.md` is partially outdated versus live code.
- The system has two reporting paths in parallel: legacy QR reporting and the newer settlement-report flow.
- The new settlement calculation service is wired into sale creation and QR parsing paths, while settlement reporting still keeps a partial legacy path for now.
- Sale detail now returns stored calculation audit data and settlement-input tracking, while sale list/export stay lightweight by excluding the large snapshot payloads.

## 2. Tech Stack

### Live stack from code

- Frontend/admin: React 19, Vite, Tailwind CSS, custom CSS variables, Zustand.
- Mobile: Flutter 3.41.6, Dart 3.x, Riverpod 2.x, Dio, flutter_secure_storage, mobile_scanner.
- Backend: Node.js, Express, MongoDB, Mongoose, JWT, bcrypt.
- PDF/print:
  - Live settlement preview is browser-side HTML/CSS in the admin panel.
  - Backend still contains Puppeteer-based settlement PDF generation plus a fallback buffer path.

### Important mismatch with docs

The live code currently uses:

- browser-side settlement print HTML for the admin preview/download flow
- backend fallback PDF buffer generation for settlement reports
- secure-storage-based pending queue on mobile rather than the older doc assumption of sqflite for offline queue persistence

## 3. Admin Panel Pages

### Admin page inventory

Route-level pages currently present:

1. Login
2. Dashboard
3. Sales
4. Suppliers
5. Supplier Form
6. Users
7. Business Settings
8. Settlement Reports
9. Exceptions
10. Exception Detail

### 3.1 Login

- File: `admin-panel/src/pages/auth/LoginPage.jsx`
- Purpose: authenticate admin users.
- Fields shown:
  - Email or phone identifier
  - Password
  - Theme toggle
- Buttons/actions:
  - Sign in
  - Theme toggle
- API calls:
  - `POST /api/v1/auth/login`
- State management:
  - local React state
  - auth Zustand store via API client side effects
- Validation:
  - identifier required
  - password required
  - backend role check for admin access
- Missing validation / risks:
  - no advanced client-side password rules
  - backend-only role rejection means a non-admin login still spends a request
- Production readiness:
  - mostly ready for real use

### 3.2 Dashboard

- File: `admin-panel/src/pages/dashboard/DashboardPage.jsx`
- Purpose: lightweight operational overview.
- Fields shown:
  - date range driven summary
  - total sales
  - total gross weight
  - total net weight
  - supplier ranking table
  - salesman ranking table
- Buttons/actions:
  - refresh
  - date-range presets/filters via page logic
- API calls:
  - `GET /api/v1/reports/summary`
- State management:
  - local React state for loading, refresh, error, hasLoadedOnce
- Validation:
  - no user form validation; internal date range only
- Missing validation / risks:
  - no drilldown consistency for source records
  - summary can feel analytics-like if overextended
- Production readiness:
  - usable and light enough for current scope

### 3.3 Sales

- File: `admin-panel/src/pages/sales/SalesPage.jsx`
- Purpose: operational ledger for searchable sales records.
- Fields shown:
  - search term
  - search scope
  - date range
  - duplicates-only toggle
  - sort order
  - table columns: ref, date, salesman, supplier, category, net weight, duplicate flag
- Buttons/actions:
  - refresh
  - export CSV
  - paging controls
- API calls:
  - `GET /api/v1/sales`
  - `GET /api/v1/sales/export`
- State management:
  - local React state for filters, loading, export state, refresh token, pagination
- Validation:
  - mostly backend-driven
  - basic filter guardrails only
- Missing validation / risks:
  - `getSaleDetail(id)` is available and now maps to `GET /api/v1/sales/:id`
  - no dedicated sale detail page
  - detail route returns `calculationSnapshot` and `parsedSnapshot` when stored; list/export intentionally exclude them for lighter payloads
- Production readiness:
  - good operational ledger, but still somewhat basic

### 3.4 Suppliers

- File: `admin-panel/src/pages/suppliers/SuppliersPage.jsx`
- Purpose: manage supplier records and test QR parsing.
- Fields shown:
  - supplier cards
  - supplier stats
  - QR parse test panel
  - delete confirmation dialog
- Buttons/actions:
  - add supplier
  - edit supplier
  - delete supplier
  - refresh data
  - run supplier QR parse test
- API calls:
  - `GET /api/v1/suppliers`
  - `POST /api/v1/suppliers/parse-qr`
  - `DELETE /api/v1/suppliers/:id`
- State management:
  - local React state
- Validation:
  - backend enforces required name/code and active role checks for CRUD
- Missing validation / risks:
  - QR test is operationally useful but not a substitute for real fixture regression tests
- Production readiness:
  - useful and close to production-ready

### 3.5 Supplier Form

- File: `admin-panel/src/pages/suppliers/SupplierFormPage.jsx`
- Purpose: create or edit supplier QR mapping and supplier metadata.
- Fields shown:
  - supplier name
  - supplier code
  - GST
  - address
  - payment mode
  - category list
  - QR strategy
  - delimiter
  - detection type/pattern
  - field map for supplier code, category, gross, stone, net
  - active toggle
- Buttons/actions:
  - save
  - cancel
  - template preset selection
- API calls:
  - create/update supplier endpoints
- State management:
  - local React state
- Validation:
  - required name/code
  - backend duplicate code protection
  - payment mode enum enforcement
- Missing validation / risks:
  - no automated QR fixture preview/validation beyond manual test tool
- Production readiness:
  - mostly complete for supplier configuration

### 3.6 Users

- File: `admin-panel/src/pages/users/UsersPage.jsx`
- Purpose: admin user management.
- Fields shown:
  - search term
  - user cards/table rows
  - add-user modal
  - delete dialog
- Buttons/actions:
  - add user
  - edit user
  - toggle active status
  - delete/deactivate
- API calls:
  - `GET /api/v1/users`
  - `POST /api/v1/users`
  - `PATCH /api/v1/users/:id`
  - `PATCH /api/v1/users/:id/toggle-status`
  - `DELETE /api/v1/users/:id`
- State management:
  - local React state
- Validation:
  - backend-required fields and role checks
  - self-deactivation protection in backend
- Missing validation / risks:
  - password policy is simple
  - no dedicated user audit UI
- Production readiness:
  - functional for admin management

### 3.7 Business Settings

- File: `admin-panel/src/pages/business/BusinessSettingsPage.jsx`
- Purpose: manage settlement master data and defaults.
- Fields shown:
  - categories
  - metal types
  - default wastage percent
  - default stone rate
  - fine precision
  - settlement calculation mode
- Buttons/actions:
  - refresh
  - save settings
  - add/edit/delete business option
  - retry on error
- API calls:
  - `GET /api/v1/business/overview`
  - `GET /api/v1/business/options`
  - `POST /api/v1/business/options`
  - `PUT /api/v1/business/options/:id`
  - `DELETE /api/v1/business/options/:id`
  - `GET /api/v1/business/settings`
  - `PUT /api/v1/business/settings`
- State management:
  - local React state
- Validation:
  - kind restricted to category/metal_type in backend
  - duplicate name/code checks in backend
- Missing validation / risks:
  - this is lightweight CRUD, not a richer master-data admin module
- Production readiness:
  - useful and practical, but still minimal

### 3.8 Settlement Reports

- File: `admin-panel/src/pages/settlement-workflow/SettlementReportsPage.jsx`
- Purpose: settlement ledger / printable supplier settlement report.
- Fields shown:
  - search
  - supplier filter
  - date from / date to
  - summary cards:
    - finalized rows
    - gross weight
    - net weight
    - fine weight
    - stone amount
  - table:
    - supplier
    - category
    - metal
    - design code
    - gross
    - stone
    - wastage
    - net
    - purity
    - fine
    - stone amount
    - recorded
- Buttons/actions:
  - refresh
  - export CSV
  - open browser-side PDF preview / download
  - pagination controls
- API calls:
  - `GET /api/v1/reports/settlement/summary`
  - `GET /api/v1/reports/settlement`
  - `GET /api/v1/reports/settlement/export.csv`
- State management:
  - local React state for loading, pagination, export state, preview state
- Validation:
  - filters are basic; report query validation happens in backend
- Missing validation / risks:
  - report is sale-backed first, but still has a legacy QR-ingestion fallback in backend
  - browser-side print flow is separate from backend PDF fallback path
- Production readiness:
  - functional, but still has legacy/reporting-path debt

### 3.9 Exceptions

- File: `admin-panel/src/pages/settlement-workflow/ExceptionsPage.jsx`
- Purpose: exception handling center for malformed or review-required QR records.
- Fields shown:
  - search
  - supplier
  - settlement status
  - confidence threshold
  - date range
  - exception stats
  - exception table
- Buttons/actions:
  - refresh
  - approve
  - mark reviewed
  - export CSV/PDF
  - open detail page
- API calls:
  - `GET /api/v1/reports/qr/summary`
  - `GET /api/v1/reports/qr`
  - `GET /api/v1/reports/qr/export.csv`
  - `GET /api/v1/reports/qr/export.pdf`
  - approve/review flow via QR detail endpoints
- State management:
  - local React state
- Validation:
  - backend approval/correction lock handles the real rules
- Missing validation / risks:
  - still a legacy QR reporting surface under a renamed business label
- Production readiness:
  - useful for problem records, but conceptually still tied to legacy QR ops reporting

### 3.10 Exception Detail

- File: `admin-panel/src/pages/settlement-workflow/ExceptionDetailPage.jsx`
- Purpose: inspect, correct, validate, and approve a problematic QR ingestion record.
- Fields shown:
  - raw QR panel
  - parsed panel
  - warning list
  - validation panel
  - valuation panel
  - diff table
  - value grid
  - correction panel
- Editable fields:
  - gross weight
  - stone weight
  - other weight
  - net weight
  - purity percent
  - wastage percent
  - stone amount
  - other amount
- Buttons/actions:
  - save corrections
  - approve
  - mark reviewed
- API calls:
  - `GET /api/v1/qr/:id`
  - `PATCH /api/v1/qr/:id/corrections`
  - `PATCH /api/v1/qr/:id/approve`
  - `PATCH /api/v1/qr/:id/reviewed`
  - `PATCH /api/v1/qr/:id/finalize`
- State management:
  - local React state
- Validation:
  - backend lock and admin-only correction permissions
- Missing validation / risks:
  - manual correction path is powerful and must be handled carefully in production
- Production readiness:
  - strong for exception review, but sensitive and workflow-heavy

## 4. Mobile App Screens

### Mobile screen inventory

User-facing screens:

1. LoginScreen
2. DashboardScreen
3. ScannerScreen
4. SaleEntryScreen
5. SaleSuccessScreen
6. SalesHistoryScreen

Support screens/widgets:

7. BackendFallbackScreen
8. Boot/loading screen in `main.dart`

### 4.1 LoginScreen

- File: `mobile/lib/features/auth/presentation/login_screen.dart`
- Purpose: mobile user authentication.
- Fields shown:
  - email or phone identifier
  - password
- Buttons/actions:
  - sign in
  - theme toggle
- QR flow:
  - none
- Manual override/edit flow:
  - none
- Submit/finalize/review flow:
  - authenticates and enters app shell on success
- API calls:
  - `POST /api/v1/auth/login`
- Offline/network handling:
  - basic request error handling through auth repository/notifier
- Error handling:
  - snack bar error display
- Missing real-shop failure handling:
  - no password recovery flow in-app
- Production readiness:
  - good enough for v1

### 4.2 DashboardScreen

- File: `mobile/lib/main.dart`
- Purpose: lightweight landing screen for logged-in users.
- Fields shown:
  - summary cards
  - recent activity / quick actions
- Buttons/actions:
  - navigate to scanner, sale entry, history, logout
- API calls:
  - typically summary and recent sales via repository/notifier paths
- Offline/network handling:
  - depends on providers; boot status and auth gates work
- Error handling:
  - basic loading/error states
- Missing real-shop failure handling:
  - no deep exception management
- Production readiness:
  - acceptable as a simple hub

### 4.3 ScannerScreen

- File: `mobile/lib/features/scanner/presentation/scanner_screen.dart`
- Purpose: QR capture.
- Fields shown:
  - camera preview
  - torch toggle
  - manual entry
  - back button
- QR scan flow:
  - scans QR
  - stops camera
  - parses QR via sale repository
  - routes to sale entry with parse result
  - on parse failure, still proceeds with an empty parse result
- Manual override/edit flow:
  - manual entry path exists
- Submit/finalize/review flow:
  - scanner itself does not submit
- API calls:
  - `POST /api/v1/suppliers/parse-qr`
- Offline/network handling:
  - parse errors do not block user
- Error handling:
  - safe fallback to empty parse result
  - app pause/resume stops and restarts camera
- Missing real-shop failure handling:
  - very low risk on scan failure, but camera/device issues still rely on device behavior
- Production readiness:
  - strong for real scanning

### 4.4 SaleEntryScreen

- File: `mobile/lib/features/sale_entry/presentation/sale_entry_screen.dart`
- Purpose: finish a sale from parsed QR data or manual entry.
- Fields shown:
  - supplier
  - category
  - item/design number
  - metal type
  - purity
  - gross weight
  - stone weight
  - net weight
  - notes
- QR scan flow:
  - arrives from scanner with parse result
- Manual override/edit flow:
  - custom category toggle
  - custom metal toggle
  - manual edits to numeric fields
- Submit/finalize/review flow:
  - validates
  - submits through sale entry provider
  - routes to success screen on success
- API calls:
  - `POST /api/v1/sales`
- Offline/network handling:
  - relies on pending queue and retry provider
- Error handling:
  - local validation for required/weight sanity checks
- Missing real-shop failure handling:
  - no rich inventory lookup or customer linkage
- Production readiness:
  - important and operationally sound, but still minimal

### 4.5 SaleSuccessScreen

- File: `mobile/lib/features/sale_entry/presentation/sale_success_screen.dart`
- Purpose: confirm sale creation success.
- Fields shown:
  - success message
  - sale reference
  - duplicate warning if applicable
- Buttons/actions:
  - back to dashboard
  - scan another
- API calls:
  - none
- Offline/network handling:
  - none required
- Production readiness:
  - fine

### 4.6 SalesHistoryScreen

- File: `mobile/lib/features/history/presentation/sales_history_screen.dart`
- Purpose: browse recent sales on mobile.
- Fields shown:
  - search
  - search scope
  - sort
  - duplicates-only toggle
  - pagination
  - pending sales banner
- Buttons/actions:
  - refresh
  - clear search
  - page navigation
- API calls:
  - `GET /api/v1/sales`
- Offline/network handling:
  - pending queue banner helps visible recovery
- Error handling:
  - provider-level states and empty/error handling
- Missing real-shop failure handling:
  - no full offline history cache
- Production readiness:
  - useful for operator verification

### 4.7 BackendFallbackScreen

- File: `mobile/lib/core/system/backend_fallback_screen.dart`
- Purpose: show backend unavailable state.
- Buttons/actions:
  - retry
- API calls:
  - health check via backend boot logic
- Production readiness:
  - good safety net

### 4.8 Boot/loading screen

- File: `mobile/lib/main.dart`
- Purpose: app bootstrap / backend availability gate.
- Production readiness:
  - good as a guardrail

## 5. Backend Modules and APIs

### 5.1 Backend structure

- Entry points:
  - `backend/src/app.js`
  - `backend/server.js`
- Main folders:
  - `config`
  - `controllers`
  - `middleware`
  - `models`
  - `routes`
  - `services`
- Middleware:
  - auth
  - role
- Major service families:
  - QR parsing/normalization/validation/valuation/correction
  - reporting
  - settlement reporting
  - business settings

### 5.2 API inventory

Total backend APIs found in route files: **44**

#### Auth

| Method | Path | Request | Response | Auth | Used by | DB | Risks |
|---|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | `email` or `phone`, `password` | JWT + safe user object | Public | Admin login, mobile login | User | brute force / credential errors |
| GET | `/api/v1/auth/me` | none | current authenticated user | Bearer | Admin + mobile shell checks | User | stale token / inactive user |
| POST | `/api/v1/auth/reset-password` | `userId`, `newPassword` | success payload | Admin only | Admin users page | User | privileged action needs care |

#### Suppliers

| Method | Path | Request | Response | Auth | Used by | DB | Risks |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/suppliers` | optional query filters | supplier list | Bearer | Admin suppliers page, mobile selector | Supplier | no public read |
| POST | `/api/v1/suppliers/parse-qr` | `raw`/`rawQr`/`qrRaw`/`qr`/`string`, optional `supplierId` | parse + normalize + validate + valuation output | Bearer | Supplier test tool, mobile parse preview, scanner flow | Supplier + parser services | parse ambiguity |
| POST | `/api/v1/suppliers` | supplier form payload | created supplier | Admin only | Supplier form | Supplier | duplicate code |
| PUT | `/api/v1/suppliers/:id` | supplier form payload | updated supplier | Admin only | Supplier form | Supplier | stale mapping edits |
| DELETE | `/api/v1/suppliers/:id` | none | success | Admin only | Suppliers page | Supplier | accidental deletion |

#### Sales

| Method | Path | Request | Response | Auth | Used by | DB | Risks |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/sales/summary/today` | none | today summary | Auth | Mobile dashboard | Sale | date handling |
| GET | `/api/v1/sales/export` | query filters + scope | CSV | Auth | Admin sales export | Sale | large export |
| GET | `/api/v1/sales` | pagination + filters | paginated sales | Auth | Admin sales page, mobile history | Sale | inconsistent filters |
| POST | `/api/v1/sales` | supplierId, category, itemCode, metalType, purity, notes, grossWeight, stoneWeight, netWeight, qrRaw, overrideDuplicate | created sale | Salesman/admin auth depending on role rules | Mobile sale entry | Sale | duplicates, invalid weights |

#### Reports

| Method | Path | Request | Response | Auth | Used by | DB | Risks |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/reports/summary` | date range | admin summary | Admin only | Admin dashboard | Sale | summary drift |
| GET | `/api/v1/reports/summary/me` | none | salesman summary | Auth | Mobile dashboard | Sale | role assumptions |
| GET | `/api/v1/reports/qr/summary` | workflow filters | QR summary | Admin only | Exceptions page | QrIngestion | legacy ops drift |
| GET | `/api/v1/reports/qr/export.csv` | filters | CSV | Admin only | Exceptions export | QrIngestion | legacy export path |
| GET | `/api/v1/reports/qr/export.pdf` | filters | PDF buffer | Admin only | Exceptions export | QrIngestion | fallback PDF path |
| GET | `/api/v1/reports/qr/:id` | id | detail row | Admin only | Exception detail page | QrIngestion | ObjectId validation |
| GET | `/api/v1/reports/qr` | filters | paginated QR rows | Admin only | Exceptions page | QrIngestion | duplicated reporting concepts |
| GET | `/api/v1/reports/settlement/summary` | settlement filters | settlement totals | Admin only | Settlement reports page | Sale with legacy fallback | legacy fallback |
| GET | `/api/v1/reports/settlement/export.csv` | settlement filters | CSV | Admin only | Settlement export | Sale with legacy fallback | export size |
| GET | `/api/v1/reports/settlement/export.pdf` | settlement filters | PDF | Admin only | Settlement preview/print | Sale with legacy fallback | browser/back-end split |
| GET | `/api/v1/reports/settlement` | settlement filters | paginated settlement rows | Admin only | Settlement reports page | Sale with legacy fallback | empty-state confusion |

#### Business

| Method | Path | Request | Response | Auth | Used by | DB | Risks |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/business/overview` | none | categories + metal types + settings | Auth | Admin settings, mobile selectors | BusinessOption + SettlementSetting | stale cache |
| GET | `/api/v1/business/options` | kind filter | option list | Auth | Admin settings, mobile | BusinessOption | basic CRUD only |
| POST | `/api/v1/business/options` | `kind`, `name`, `code`, `isActive`, `sortOrder` | created option | Admin only | Admin settings | BusinessOption | duplicates |
| PUT | `/api/v1/business/options/:id` | partial option payload | updated option | Admin only | Admin settings | BusinessOption | concurrent edits |
| DELETE | `/api/v1/business/options/:id` | none | success | Admin only | Admin settings | BusinessOption | accidental deletion |
| GET | `/api/v1/business/settings` | none | settings list | Auth | Admin settings | SettlementSetting | defaults vs DB merge |
| PUT | `/api/v1/business/settings` | array or single setting | success | Admin only | Admin settings | SettlementSetting | inconsistent payloads |

#### Users

| Method | Path | Request | Response | Auth | Used by | DB | Risks |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/users` | optional `q` | user list (safe fields only) | Admin only | Users page | User | admin access only |
| POST | `/api/v1/users` | name, email, phone, password, role, permissions | created user | Admin only | Add user modal | User | password policy minimal |
| PATCH | `/api/v1/users/:id` | partial user payload | updated user | Admin only | Edit user flow | User | permission drift |
| DELETE | `/api/v1/users/:id` | none | soft delete/deactivate | Admin only | Delete dialog | User | self-delete blocked |
| PATCH | `/api/v1/users/:id/toggle-status` | none | toggled status | Admin only | Users page | User | self-deactivation blocked |

#### QR

| Method | Path | Request | Response | Auth | Used by | DB | Risks |
|---|---|---|---|---|---|---|---|
| POST | `/api/v1/qr/ingest` | raw QR string | raw + parsed + validated + valued ingestion | Bearer auth required | mobile scanner to ingestion flow, admin exception tooling | QrIngestion | partial parse semantics |
| GET | `/api/v1/qr/:id` | id | ingestion record | Auth/admin flow | Exception detail | QrIngestion | ObjectId validation |
| PATCH | `/api/v1/qr/:id/finalize` | final payload | finalized ingestion | Auth/admin logic | Exception detail | QrIngestion | workflow locking |
| PATCH | `/api/v1/qr/:id/corrections` | correction fields + note | updated ingestion | Admin only | Exception detail | QrIngestion | manual overwrite risk |
| PATCH | `/api/v1/qr/:id/approve` | none | approved ingestion | Admin only | Exception detail / exceptions page | QrIngestion | approval lock |
| PATCH | `/api/v1/qr/:id/reviewed` | none | reviewed ingestion | Admin only | Exceptions page | QrIngestion | status-only change |

#### System

| Method | Path | Request | Response | Auth | Used by | DB | Risks |
|---|---|---|---|---|---|---|---|
| GET | `/` | none | status page | Public | health/status checks | none | none |
| GET | `/api/v1/health` | none | health JSON | Public | backend boot checks, mobile boot checks | none | environment issues |

## 6. QR Parsing Architecture

### 6.1 Overall flow

1. Raw QR arrives from mobile scanner or admin supplier test tool.
2. Supplier detection tries regex, contains, prefix, then supplier-configured parsing hints.
3. Parser chooses a strategy:
   - delimiter
   - key_value
   - venzora
4. Parsed output is normalized into a standard weight-based shape.
5. Validation runs against settlement/business rules.
6. Valuation derives fine weight and stone amount using business settings and supplier-provided values where present.
7. QR ingestion record is stored with raw text, parsed result, warnings, validation, valuation, corrections, final snapshot, status, and confidence.
8. Ingestion can remain in parsed / needs_review / approved states.

### 6.2 Supplier detection flow

Live detection logic is implemented in:

- `backend/src/services/qrParser.detection.js`
- `backend/src/services/qrParser.service.js`
- `backend/src/controllers/suppliers.controller.js`

Detection order observed in code:

1. Venzora-like raw strings
2. Utsav-like raw strings
3. Yug delimiter or key-value-like raw strings
4. Adinath-like raw strings
5. Supplier-configured regex
6. Supplier-configured contains
7. Supplier-configured prefix

Yug is no longer detected only by item-code prefixes such as `SWMS` or `SWNK`.
Current live parser support also uses a structural Yug signature:

- slash-delimited positional shape
- numeric batch / internal IDs at the start
- karat token such as `18K`
- numeric gross / QR net fields
- item code in the designated position
- metal type token like `Y+W` / `R+W`
- color/category token like `WHITE`, `GREEN`, `PURPAL`, or `SKYBLUE`

Adinath uses a different structural rule set:

- slash-delimited with blank segments tolerated
- first numeric field is gross weight
- last segment is the item/design code
- numeric field immediately before the item code is the QR net weight
- numeric fields between gross and QR net are stone components
- computed net must match QR net within tolerance for a clean parse

Live Yug parsing fixture coverage is checked by:

- `backend/scripts/check-yug-parser-fixtures.js`

Live Adinath parsing fixture coverage is checked by:

- `backend/scripts/check-adinath-parser-fixtures.js`

### 6.3 Parser layer

Supported parsing strategies:

- delimiter
- key_value
- venzora

The parser returns a structured result even on failure. It does not throw in normal scanner flows.

### 6.4 Normalization layer

Normalization maps parsed fields into a common business shape:

- supplier
- design_code
- gross_weight
- stone_weight
- other_weight
- net_weight
- purity_percent
- wastage_percent
- fine_weight
- stone_amount
- confidence
- status

Live normalization also exposes a display-friendly contract alongside the legacy flat fields. The current code keeps backward-compatible aliases, but future UI should prefer the nested `display` object over parser internals.

Display contract shape now includes:

- `display.supplier` with `id`, `name`, `code`, `confidence`
- `display.item` with `itemCode`, `designCode`, `size`, `lotCode`, `category`, `colorCategory`, `metalType`, `karat`
- `display.weights` with `grossWeight`, `stoneWeight`, `stoneComponents[]`, `otherWeight`, `qrNetWeight`, `computedNetWeight`, `selectedNetWeight`
- `display.amounts` with `stoneAmount`, `otherAmount`
- `display.calculation` with `netFormula`, `fineFormula`, `mismatch`, `tolerance`, `explanation`
- `display.warnings`
- `display.requiresReview`
- `display.rawQr`

Backward-compatible aliases are still returned for existing consumers:

- `supplier`
- `design_code`
- `gross_weight`
- `stone_weight`
- `other_weight`
- `net_weight`
- `purity_percent`
- `category`
- `wastage_percent`
- `fine_weight`
- `stone_amount`
- `confidence`
- `status`
- `rawQr`
- `warnings`
- `requiresReview`
- `calculation`
- `display`

### 6.5 Ingestion layer

The ingestion layer stores:

- raw QR string
- parsed fields
- fallback metadata
- validation warnings
- valuation warnings
- corrections
- final snapshot
- workflow status

### 6.6 Supported suppliers currently implemented

Supported by live parser / seed / detection rules:

- Yug / YUG
- Aadinath / Adinath
- Utsav / USV / UTSAV
- Venzora / VENZORA
- ZAR / Zar

### 6.7 Field mapping by supplier

- Yug:
  - structural slash-delimited positional parser
  - item prefixes are treated as hints only, not a sole match rule
  - normalized output keeps both legacy flat fields and the display contract
  - positional mapping uses the live Yug fixture convention:
    - `[0]` batch/serial id
    - `[1]` secondary internal id
    - `[2]` karat
    - `[3]` gross weight
    - `[4]` stone component 1
    - `[5]` QR net weight
    - `[6]` stone amount
    - `[7]` item/design code
    - `[8]` size
    - `[9]` metal type
    - `[10]` lot/batch code
    - `[11]` other weight
    - `[13]` category / color label
    - `[14]` stone component 2
  - stoneWeight = field[4] + field[14]
  - otherWeight = field[11]
  - computedNet = grossWeight - stoneWeight - otherWeight
  - QR net mismatch above tolerance sets warning / review flags
  - display labels should use neutral names such as `Stone Component 1` and `Stone Component 2`
- Aadinath:
  - structural slash-delimited parser
  - blank segments are ignored
  - stone components are summed between gross and QR net
  - computed net is validated against QR net
- Utsav:
  - prefix-based labels like `GWT-`, `SWT-`, `NWT-`
  - tolerant of partials
  - `CL-*` is treated as an additional stone component / colour stone weight and included in stone total and net validation
- Venzora:
  - special strategy
  - tokenized branded format with `18KT`, `G...`, `L...`, `N...`, `Rs...`, and `CH-*`
  - zero stone weight and zero stone amount are valid values
  - internal item id is preserved separately from business-facing `CH-*` design code
- ZAR:
  - minimal pattern support
  - item/design heavy, with manual weights remaining important

### 6.8 Weight logic

Business rule enforced in live code:

- Net weight is generally `gross weight - stone weight`
- Trusted supplier net weight may override the derived result when validation allows
- Manual override always exists in mobile and exception review

### 6.9 Unknown supplier behavior

Unknown QR does not block the user.

Observed behavior:

- parser returns a partial structure
- warnings include unknown format signals
- mobile can still proceed to manual sale entry
- admin can review/approve later if the QR enters ingestion

Yug parse/normalize output now also carries a `calculationBreakdown` object for admin and mobile display, including:

- raw QR
- stone component breakdown
- other weight
- computed net
- selected net
- mismatch
- tolerance
- warnings
- requiresReview

### 6.10 Status values

Observed status vocabulary across QR ingestion:

- parsed
- needs_review
- approved

Root/document status in `QrIngestion` also includes:

- parsed
- needs_review
- approved

### 6.11 Safe failure

The parser is designed to fail safely:

- partial result instead of hard failure
- warning lists instead of exceptions for normal unknown QR cases
- manual entry paths exist on mobile

## 7. Database Models

### 7.1 Models found

Live backend models present:

1. User
2. Supplier
3. Sale
4. QrIngestion
5. BusinessOption
6. SettlementSetting

### 7.2 User

- Purpose: auth, role, permissions, created-by relationships.
- Important fields:
  - name
  - email
  - phone
  - passwordHash
  - role
  - isActive
  - permissions
  - createdBy
- Relationships:
  - createdBy -> User
- Risk:
  - no audit log model in live code despite docs mentioning it

### 7.3 Supplier

- Purpose: supplier configuration and QR parsing hints.
- Important fields:
  - name
  - code
  - gst
  - address
  - paymentMode
  - qrMapping
  - learnedPatterns
  - detectionPattern
  - categories
  - businessSettings
  - qrProfile
  - isActive
- Relationships:
  - referenced by Sale
  - referenced by QrIngestion final snapshots / parsing context
- Risk:
  - parser configuration can become stale if not regression-tested
  - businessSettings exists now, but exact category wastage and karat purity values are still operator-owned and mostly placeholder-safe

### 7.4 Sale

- Purpose: business operational record and settlement source of truth.
- Important fields:
  - qrRaw
  - qrHash
  - idempotencyKey
  - salesman
  - supplier
  - category
  - itemCode
  - metalType
  - purity
  - settlementInputs
  - notes
  - grossWeight
  - stoneWeight
  - netWeight
  - ratePerGram
  - totalValue
  - isDuplicate
  - wasManuallyEdited
  - saleDate
  - calculationSnapshot (stored audit snapshot for detail views)
  - parsedSnapshot (optional stored parser/display snapshot)
  - settlementInputs (resolved karat/purity/wastage audit snapshot)
- Relationships:
  - salesman -> User
  - supplier -> Supplier
- Risk:
  - sale detail now returns stored calculation audit data, but there is still no finalized immutable settlement snapshot table
  - list/export intentionally exclude large snapshot payloads to stay lightweight

### 7.5 QrIngestion

- Purpose: raw QR parsing, review, correction, approval, and legacy reporting.
- Important fields:
  - raw
  - parsed
  - validation
  - fallback
  - corrections
  - final
  - valuation
  - status
  - confidence
  - reviewedBy / reviewedAt
  - approvedBy / approvedAt
  - learning
- Relationships:
  - supplier context
  - user review/approval relationships
- Risk:
  - this model still powers a lot of legacy reporting and can overlap with settlement meaning

### 7.6 BusinessOption

- Purpose: lightweight categories and metal types.
- Important fields:
  - kind
  - name
  - code
  - isActive
  - sortOrder
- Risk:
  - not a full master-data/ERP taxonomy, intentionally lightweight

### 7.7 SettlementSetting

- Purpose: settlement defaults and calculation settings.
- Important fields:
  - key
  - label
  - value
  - description
  - isActive
- Risk:
  - values are partially fallback-driven, especially on first boot

### 7.8 Missing / not found in live code

These are mentioned in older docs but not present as live models in the current backend `models` folder:

- Customer
- AuditLog
- Inventory
- Settings (legacy name)

UNCLEAR if these are planned later or intentionally removed; files checked:

- `backend/src/models/*.js`
- `docs/PRD.md`
- `docs/TRD.md`

## 8. End-to-End Flow Mapping

| Flow | Current status | Files involved | APIs involved | Key fields | Failure cases | Manual test needed |
|---|---|---|---|---|---|---|
| Admin login | Working | `admin-panel/src/pages/auth/LoginPage.jsx`, `admin-panel/src/api/auth.api.js`, `backend/src/controllers/auth.controller.js` | `POST /auth/login`, `GET /auth/me` | identifier, password, JWT, role | wrong password, inactive user, non-admin access | yes |
| Mobile login | Working | `mobile/lib/features/auth/presentation/login_screen.dart`, `mobile/lib/features/auth/data/auth_repository.dart`, `mobile/lib/features/auth/presentation/auth_notifier.dart`, `backend/src/controllers/auth.controller.js` | `POST /auth/login`, `GET /auth/me` | identifier, password, token, user role | 401, network errors, inactive user | yes |
| QR scan and parse | Working / partial | `mobile/lib/features/scanner/presentation/scanner_screen.dart`, `mobile/lib/features/sale_entry/data/sale_repository.dart`, `backend/src/controllers/suppliers.controller.js` | `POST /suppliers/parse-qr` | raw QR, parsed fields, warnings, confidence | unknown supplier, parse failure, camera lifecycle issues | yes |
| Manual product entry | Working | `mobile/lib/features/sale_entry/presentation/sale_entry_screen.dart`, `mobile/lib/features/sale_entry/presentation/sale_entry_provider.dart` | `POST /sales` | supplier, category, metal, purity, weights, notes | invalid weights, missing supplier, duplicate QR | yes |
| Product review/finalization | Working | `admin-panel/src/pages/settlement-workflow/ExceptionDetailPage.jsx`, `backend/src/controllers/qr.controller.js` | `GET /qr/:id`, `PATCH /qr/:id/corrections`, `PATCH /qr/:id/approve`, `PATCH /qr/:id/reviewed`, `PATCH /qr/:id/finalize` | correction fields, approval state, warnings | approval lock, data overwrite risk | yes |
| Sale creation | Working | `mobile/lib/features/sale_entry/presentation/sale_entry_provider.dart`, `backend/src/controllers/sales.controller.js` | `POST /sales` | sale weights, supplier, category, item, duplicate flag | duplicate QR, invalid weights, idempotency mismatch | yes |
| Settlement/report preview | Working but layered | `admin-panel/src/pages/settlement-workflow/SettlementReportsPage.jsx`, `admin-panel/src/pages/settlement-workflow/settlementReportPrint.js`, `backend/src/services/settlementReports.service.js` | `GET /reports/settlement/*`, CSV export | supplier, gross, stone, net, purity, wastage, fine | legacy fallback, empty rows due to filters | yes |
| Supplier config management | Working | `admin-panel/src/pages/suppliers/*`, `backend/src/controllers/suppliers.controller.js` | supplier CRUD + parse-qr | mapping, detection, payment mode | duplicate code, stale mapping | yes |
| Inventory lookup/update | Not present | no live inventory model found | none | none | UNCLEAR in docs vs live code | yes, if added later |

## 9. Field Mapping Matrix

| Field | Admin UI | Mobile UI | Backend DTO / Request | Database model | Mismatch / note |
|---|---|---|---|---|---|
| supplier | Supplier pages, settlement reports, exceptions | sale entry, history, selectors | supplierId, supplier, supplierCode | Supplier, Sale, QrIngestion | consistent, but naming differs by context |
| design/item code | supplier form mapping, settlement reports, exception detail | sale entry, scanner parse result | itemCode, design_code, designCode | Sale, QrIngestion | some code fields are snake_case in ingestion and camelCase in UI |
| category | supplier form config, settlement reports, sales page | sale entry, parse result, selectors | category | Sale, Supplier.categories, QrIngestion.final.category | mostly consistent |
| metal type | business settings, sales page, settlement reports | sale entry selector | metalType | Sale, BusinessOption | consistent, but settlement reports use a lightweight view |
| karat | supplier QR debug, parser preview, sale detail audit | sale entry parse result, settlement inputs | karat | Sale, QrIngestion | distinct from purity percent and now tracked separately |
| purity percent | exception detail, settlement reports, sales page | sale entry, parse result, settlement inputs | purityPercent, purity_percent | Sale, QrIngestion | derived from karat/settings or request and can be overridden |
| wastage percent | settlement settings, exception detail, settlement reports | sale entry, settlement inputs | wastagePercent, wastage_percent | Sale, Supplier.businessSettings, SettlementSetting | source may be supplier category/default or global fallback |
| gross weight | sale page, settlement reports, exception detail | sale entry, parse result | grossWeight, gross_weight | Sale, QrIngestion | snake/camel split is a recurring source of drift |
| stone weight | sale page, settlement reports, exception detail | sale entry, parse result | stoneWeight, stone_weight | Sale, QrIngestion | consistent conceptually, naming varies |
| other weight | exception detail only, maybe hidden in future sale UI | not prominent in mobile sale entry | other_weight | QrIngestion | frontend mostly ignores it today |
| net weight | sale page, settlement reports, exception detail | sale entry, parse result | netWeight, net_weight | Sale, QrIngestion | core field; must remain visible |
| stone amount / charge | settlement reports, exception detail, business settings defaults | not a main mobile input | stoneAmount, stone_amount | QrIngestion, SettlementSetting | partially derived, partially supplier-provided |
| QR raw text | exception detail, supplier test tool | scanner -> parse preview | qrRaw, raw, rawQR | Sale, QrIngestion | mobile preserves raw QR in sale path too |
| parse status | exceptions, detail panels | parse result warnings | status, confidence, parse errors | QrIngestion | sale flow does not store parse status as a first-class UI state |
| review status | exceptions | not visible as a first-class sale field | reviewedAt, approvedAt, status | QrIngestion | settlement report hides review semantics by design |
| salesman / user | dashboard, sales page, users page | mobile login/session, sale history | salesman / createdBy / user | User, Sale | naming varies by endpoint |
| customer | not present | not present | not present | not present | UNCLEAR in docs, absent in live code |
| sale / settlement data | sales, settlement reports, dashboard | sale creation, history, summary | Sale payloads, settlement rows | Sale | settlement is sale-backed with legacy fallback |
| settlement inputs | sale detail audit, future settlement UI | sale creation, future scan flow | settlementInputs | Sale | tracks karat, purity source, wastage source, override flags |

## 10. Production Readiness

### Ready for real shop testing

- Mobile login and auth persistence.
- QR scanning with safe partial parsing.
- Manual sale entry when QR fails.
- Pending sale queue with retry and visible status.
- Supplier configuration and test parsing.
- Sales list and settlement report browsing.
- Exception review and correction for bad scans.

### Risky

- Settlement reports still have a legacy QR-ingestion fallback if no sales rows exist.
- Browser-side print flow and backend fallback PDF path are both in play.
- Admin/client field naming is not always consistent (`snake_case` vs `camelCase`).
- Some legacy route names and API filenames still carry QR-ops terminology.

### Missing

- Inventory model and real inventory update workflow.
- Customer model / customer-facing workflow.
- Audit log model and UI.
- Stronger settlement snapshot persistence.

### What can break during live QR scanning

- Unknown or malformed supplier format can still produce partial data, but users must manually finish the sale.
- Camera lifecycle / device permissions can interrupt scanning.
- Parser changes can break supplier-specific mappings if not regression tested against real QR samples.

### What can break during sale / settlement

- Duplicate QR handling if operators rescan the same piece.
- Settlement report empty states if filters are too narrow or the dataset is still only legacy-QR-backed.
- PDF/browser preview behavior if browser settings block blob downloads or print dialogs.

### Immediate before-demo fixes

- Confirm settlement report behavior with real sales rows.
- Verify all common supplier QR samples against live parser.
- Check the PDF/print preview path on the target browser.
- Fix any remaining admin route naming or legacy wording if the client will see code-driven labels.

### Can wait

- Audit logs.
- Full inventory management.
- Customer management.
- Advanced analytics / charts.

## 11. Critical Gaps

1. Settlement reports still have a legacy QR-ingestion fallback path, so the business ledger is not fully isolated from old QR reporting.
2. The admin sale-detail method is now backed by `GET /api/v1/sales/:id` and returns stored calculation audit snapshots.
3. The docs in `docs/PRD.md` and `docs/TRD.md` still need a final pass for full parity with the live settlement-report / business-settings / browser-print implementation.
4. The codebase still has duplicate concepts for legacy QR reporting and newer settlement reporting.
5. Live code uses secure storage for the mobile pending queue, which differs from the earlier document assumption of sqflite-based offline storage.
6. Inventory/customer/audit-log features are not present in live code despite being named in older docs.
7. Centralized settlement calculation wiring is now in place for sale creation and QR parsing, while settlement reports still keep a partial legacy path.
8. Supplier business settings are now supported at the schema/helper level, but exact business values still need owner confirmation.

## 13. Batch-aware sale creation update

- `POST /api/v1/sales` now accepts optional `batchId`.
- If `batchId` is absent, standalone sale behavior remains supported.
- If `batchId` is present, the backend validates:
  - batch exists
  - actor can add items
  - batch status is open for item updates
  - sale supplier matches the batch supplier
- The sale is created with batch metadata already attached:
  - `batchId`
  - `revisionAdded`
  - `addedBy`
  - `addedAt`
  - `entryMode`
- Batch totals/counts are refreshed after sale creation through a server-side aggregate helper.
- If aggregate refresh fails after the sale is stored, the API still returns success with a warning so the client does not retry into a duplicate sale.
- Mobile batch workflow should use this one-request path rather than creating a sale first and linking it later.

## 12. Recommended Next Steps

1. Remove the settlement report legacy fallback, or make it explicitly labelled as legacy-only if it must stay.
2. Wire the new settlement calculation service into the safest downstream touchpoints in the next phase.
3. Verify the new backend `GET /api/v1/sales/:id` route against admin and salesman access patterns, including the stored calculation snapshots.
4. Align `docs/PRD.md` and `docs/TRD.md` with live code so future work does not follow stale assumptions.
5. Build a finalized immutable settlement snapshot view only if the business needs one later; the current sale detail already carries audit data.
6. Run real supplier QR fixtures through the parser and record any mismatches as regression cases.
7. Decide whether customer/inventory/audit features are out-of-scope for v1 and keep them explicitly absent.
8. Confirm exact supplier category wastage and karat purity overrides before wiring them into settlement logic.
