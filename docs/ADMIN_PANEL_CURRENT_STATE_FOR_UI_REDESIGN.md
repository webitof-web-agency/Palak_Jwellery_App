# Admin Panel Current State for UI Redesign

## 1. Executive Summary
The admin panel is a route-based React 19 + Vite app with a shared layout shell, local component state, Zustand auth, and a small fetch wrapper around the REST API. The current implementation is functional, but the UX is split across too many technical layers for a non-technical jewellery shop owner.

The main pressure points are:
- Supplier editing still exposes QR parser internals too early.
- Business settings are global, but supplier-specific business rules now also exist in the backend.
- QR debug is better than before, but still reads like an internal tool rather than a business confirmation screen.
- Sale detail now carries calculation snapshots, parsed snapshots, and settlement inputs, but the UI does not yet present the audit trail clearly.
- Settlement reports still mix sale-backed rows with a legacy QR fallback path.

The safest next UI work is to simplify supplier edit first, then make QR debug business-readable, then polish sale detail and clean up the overlap between global business settings and supplier settings.

## 2. Admin Tech Stack and Structure

### Stack
- Framework: React 19 + Vite
- Routing: React Router DOM 7
- State: Zustand for auth/session, local `useState` and `useEffect` for most page state
- Data fetching: custom `request()` wrapper in `admin-panel/src/api/client.js`
- Styling: Tailwind utility classes plus shared UI components
- Charts: Recharts is installed, but dashboard/report pages shown here are mostly table and metric driven

### Structure
- There is no dedicated `admin-panel/src/routes` directory. Routing lives in `admin-panel/src/App.jsx`.
- `admin-panel/src/components/Layout.jsx` is the authenticated shell with sidebar navigation and a floating theme toggle.
- Pages are lazy loaded from `admin-panel/src/pages/*`.
- Common UI primitives are reused across pages:
  - `PageHeader`
  - `SectionCard`
  - `EmptyState`
  - `LoadingSpinner`
  - `MetricCard`
  - `TableSkeleton`
  - `FullScreenLoader`

### Route map
- `/login`
- `/dashboard`
- `/suppliers`
- `/suppliers/form`
- `/sales`
- `/settlement-reports`
- `/business-settings`
- `/users`
- `/exceptions`
- `/exceptions/:id`
- Redirects for legacy settlement workflow URLs

## 3. Admin Pages Inventory

### LoginPage
File: `admin-panel/src/pages/auth/LoginPage.jsx`

- Purpose: admin authentication only.
- Main sections:
  - marketing panel
  - login card
  - email/phone field
  - password field
  - submit button
  - theme toggle
- APIs:
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/me` is used elsewhere in the auth flow
- Data shown:
  - error message on login failure
  - admin-only guard message if the user is not admin
- Current problems:
  - none major for the current slice
  - mainly a generic auth screen, not part of the jewellery workflow problem
- Suitability for non-technical shop users:
  - yes, but only as a login gate

### DashboardPage
File: `admin-panel/src/pages/dashboard/DashboardPage.jsx`

- Purpose: operational overview.
- Main sections:
  - summary metrics
  - top suppliers table
  - top salesmen table
- APIs:
  - `GET /api/v1/reports/summary`
- Data shown:
  - total sales
  - total net weight
  - total gross weight
  - supplier leaderboard
  - salesman leaderboard
- Current problems:
  - it is summary-only and does not expose settlement audit detail
- Suitability for non-technical shop users:
  - acceptable as a daily overview

### SuppliersPage
File: `admin-panel/src/pages/suppliers/SuppliersPage.jsx`

- Purpose: supplier list, supplier actions, and QR test workspace.
- Main sections:
  - hero header
  - supplier stats cards
  - supplier list cards
  - supplier alerts
  - QR parse/test tool
- APIs:
  - `GET /api/v1/suppliers`
  - `DELETE /api/v1/suppliers/:id`
  - `POST /api/v1/suppliers/parse-qr`
- Data shown:
  - supplier name
  - supplier code
  - payment mode
  - active/inactive state
  - allowed categories
  - QR mapping pills for gross/stone/net/category
  - QR test results
- Current problems:
  - supplier list still exposes mapping concepts that are useful for setup but not friendly for a shop owner
  - QR test tool is on the same page as the list, which mixes operational actions with technical debugging
  - no visible businessSettings summary yet
- Suitability for non-technical shop users:
  - partially suitable for list and delete actions
  - not suitable as a final supplier configuration experience

### SupplierFormPage
File: `admin-panel/src/pages/suppliers/SupplierFormPage.jsx`

- Purpose: create/edit supplier setup.
- Main sections:
  - supplier summary sidebar
  - basic supplier profile
  - QR setup section
  - save/cancel actions
- Fields currently visible:
  - name
  - code
  - GST number
  - settlement mode
  - address
  - categories list
  - QR strategy
  - detection type
  - detection pattern
  - split character
  - supplier code position
  - category position
  - gross weight position
  - stone weight position
  - net weight position
  - active toggle
- APIs:
  - `POST /api/v1/suppliers`
  - `PUT /api/v1/suppliers/:id`
- Data shown:
  - basic supplier metadata
  - template preset guidance
  - advanced QR mapping controls
- Current problems:
  - technical parser settings are too prominent for a non-technical owner
  - the new supplier business settings model is not surfaced as a business-friendly form
  - no explicit UI for karat purity overrides, category-wise wastage, QR tolerance, or QR profile metadata
  - categories are still treated as plain strings rather than structured supplier business categories
- Suitability for non-technical shop users:
  - no, not in its current form

### SalesPage
File: `admin-panel/src/pages/sales/SalesPage.jsx`

- Purpose: operational sales ledger.
- Main sections:
  - header and summary
  - filter bar
  - sales table
  - sale detail modal
- APIs:
  - `GET /api/v1/sales`
  - `GET /api/v1/sales/export`
  - `GET /api/v1/sales/:id`
- Data shown:
  - ref
  - date
  - salesman
  - supplier
  - category
  - net weight
  - duplicate badge
- Current problems:
  - list view is lean, which is fine, but it does not show audit fields
  - detail modal is good, but it still does not clearly surface settlement input sources and override history
- Suitability for non-technical shop users:
  - partly suitable for viewing records
  - detail modal still needs simpler audit language

### BusinessSettingsPage
File: `admin-panel/src/pages/business/BusinessSettingsPage.jsx`

- Purpose: global business master data and global settlement defaults.
- Main sections:
  - categories panel
  - metal types panel
  - settlement settings panel
- Fields currently visible:
  - default wastage percent
  - default stone rate
  - fine precision
  - settlement calculation mode
- APIs:
  - `GET /api/v1/business/overview`
  - `GET /api/v1/business/settings`
  - `POST /api/v1/business/options`
  - `PUT /api/v1/business/options/:id`
  - `DELETE /api/v1/business/options/:id`
  - `PUT /api/v1/business/settings`
- Data shown:
  - global categories
  - global metal types
  - global settlement settings
- Current problems:
  - this page overlaps conceptually with supplier business settings now present in the backend
  - there is no visual separation between global defaults and supplier-specific rules
- Suitability for non-technical shop users:
  - acceptable for admin/master data
  - not enough to manage supplier-specific settlement behavior

### UsersPage
File: `admin-panel/src/pages/users/UsersPage.jsx`

- Purpose: admin and salesman user management.
- Main sections:
  - search
  - user table
  - add user modal
  - delete/deactivate dialog
- APIs:
  - `GET /api/v1/users`
  - `POST /api/v1/users`
  - `PATCH /api/v1/users/:id`
  - `DELETE /api/v1/users/:id`
  - `PATCH /api/v1/users/:id/toggle-status`
- Data shown:
  - user profile
  - role
  - status
  - joined date
- Current problems:
  - not part of the supplier/business redesign problem
- Suitability for non-technical shop users:
  - admin-only

### ExceptionsPage
File: `admin-panel/src/pages/settlement-workflow/ExceptionsPage.jsx`

- Purpose: review malformed/low-confidence QR workflow records.
- Main sections:
  - summary stats
  - filters
  - exception table
  - export actions
- APIs:
  - `GET /api/v1/reports/qr/summary`
  - `GET /api/v1/reports/qr`
  - `GET /api/v1/reports/qr/export.csv`
  - `GET /api/v1/reports/qr/export.pdf`
  - `PATCH /api/v1/qr/:id/approve`
  - `PATCH /api/v1/qr/:id/reviewed`
- Current problems:
  - operationally useful, but still technical
  - not the main non-technical owner workflow
- Suitability for non-technical shop users:
  - low

### ExceptionDetailPage
File: `admin-panel/src/pages/settlement-workflow/ExceptionDetailPage.jsx`

- Purpose: inspect and correct a single QR ingestion record.
- Main sections:
  - overview
  - raw parsed data
  - correction form
  - diff/comparison panels
  - validation/valuation panels
- APIs:
  - `GET /api/v1/qr/:id`
  - `PATCH /api/v1/qr/:id/corrections`
  - `PATCH /api/v1/qr/:id/approve`
  - `PATCH /api/v1/qr/:id/reviewed`
- Current problems:
  - very technical and inspector-oriented
  - not a business-friendly flow
- Suitability for non-technical shop users:
  - low

### SettlementReportsPage
File: `admin-panel/src/pages/settlement-workflow/SettlementReportsPage.jsx`

- Purpose: settlement ledger and export.
- Main sections:
  - summary cards
  - filters
  - table
  - pagination
  - CSV/PDF export
- APIs:
  - `GET /api/v1/reports/settlement/summary`
  - `GET /api/v1/reports/settlement`
  - `GET /api/v1/reports/settlement/export.csv`
  - `GET /api/v1/reports/settlement/export.pdf`
- Data shown:
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
- Current problems:
  - still too thin for the newer settlement audit model
  - does not show settlement inputs, stone components, computed net, selected net, or review flags
  - backend service still falls back to legacy QR ingestion if no sale-backed rows exist
- Suitability for non-technical shop users:
  - usable for a basic ledger
  - not enough for audit-level verification

## 4. Supplier List and Edit Current State

### Supplier list
File: `admin-panel/src/pages/suppliers/SuppliersPage.jsx`

- Supplier list shows:
  - supplier name
  - code
  - payment mode
  - active status
  - categories
  - QR mapping pills for gross/stone/net/category
- Actions:
  - add supplier
  - edit supplier
  - delete supplier
  - test QR parse
  - refresh
- Current problem:
  - list mixes business identity with technical mapping hints
  - QR test tool is embedded on the same screen, which is convenient for power users but not shop-owner friendly

### Supplier edit form
File: `admin-panel/src/pages/suppliers/SupplierFormPage.jsx`

Current fields:
- legal name
- unique code
- GST number
- settlement mode
- how to read the QR
- how to match the supplier
- supplier name/code/pattern
- registered address
- allowed categories
- split character
- field positions for supplier code, category, gross weight, stone weight, net weight
- active toggle

Current technical controls:
- QR strategy preset
- detection type
- detection pattern
- delimiter
- field mapping controls

Missing business-friendly supplier settings:
- category-wise wastage
- karat-wise purity override
- default wastage
- default stone rate
- stone/other weight rules
- QR net tolerance
- QR template/profile metadata
- structured category objects with color labels and ordering

### Supplier card/list affordances
File: `admin-panel/src/pages/suppliers/components/SupplierCard.jsx`

- Shows mapping pills for gross/stone/net/category.
- Good for debugging, but too technical as a permanent business card.

### Supplier sidebar and alerts
Files:
- `admin-panel/src/pages/suppliers/components/SupplierFormSidebar.jsx`
- `admin-panel/src/pages/suppliers/components/SupplierAlerts.jsx`

- Sidebar is a summary/checklist, not a structured business settings panel.
- Alerts are fine, but they do not help the user understand supplier rules.

### Verdict
- Business-friendly fields currently present:
  - supplier name
  - supplier code
  - GST
  - address
  - settlement mode
  - active
  - category list
- Too technical for shop-owner use:
  - strategy
  - detection type
  - detection pattern
  - delimiter
  - field map positions
- Missing for the new flow:
  - category-wise wastage
  - karat-wise purity override
  - default wastage
  - QR template/profile
  - stone/other weight rules
  - QR net tolerance
  - structured supplier categories

## 5. Business Settings Current State

File: `admin-panel/src/pages/business/BusinessSettingsPage.jsx`

### Current scope
- Global categories
- Global metal types
- Global settlement settings

### Current fields
- `default_wastage_percent`
- `default_stone_rate`
- `fine_precision`
- `settlement_calculation_mode`

### API model
- `GET /api/v1/business/overview` returns:
  - categories
  - metalTypes
  - settings
- `GET /api/v1/business/settings` returns key/value rows
- `PUT /api/v1/business/settings` saves global settlement settings

### Overlap / conflict
- Backend supplier business settings now also exist:
  - `Supplier.businessSettings.categories`
  - `Supplier.businessSettings.purityOverrides`
  - `Supplier.businessSettings.defaultWastagePercent`
  - `Supplier.businessSettings.defaultStoneRate`
  - `Supplier.businessSettings.qrNetTolerance`
- The current business page is global, while the new supplier settings are supplier-specific.
- This creates a conceptual overlap that the UI does not yet explain.

### What should stay global
- category master data if it is truly a company-wide catalog
- metal types
- global settlement defaults
- fine precision

### What should move to supplier settings
- supplier-specific categories
- category-wise wastage
- karat-wise purity override
- default wastage at supplier level
- QR template/profile
- QR net tolerance
- stone/other weight behavior

### Verdict
- The page is fine as a global admin/master-data screen.
- It is not the right place for supplier settlement behavior.

## 6. Sales Page and Sale Detail Current State

Files:
- `admin-panel/src/pages/sales/SalesPage.jsx`
- `admin-panel/src/pages/sales/components/SalesRecordsTable.jsx`
- `admin-panel/src/pages/sales/components/SalesFilterBar.jsx`
- `admin-panel/src/pages/sales/components/SaleDetailModal.jsx`

### Sales list
- Filters:
  - search query
  - search scope
  - date range
  - duplicates only
  - sort
- Columns:
  - Ref
  - Date
  - Salesman
  - Supplier
  - Category
  - Net Wt
  - Duplicate
  - Actions
- Export:
  - range export
  - export all
- API:
  - `GET /api/v1/sales`
  - `GET /api/v1/sales/export`

### Sale detail modal
- API:
  - `GET /api/v1/sales/:id`
- Displays:
  - sale ref
  - date
  - supplier
  - salesman
  - duplicate badge
  - needs review badge
  - item code
  - design code
  - category / color
  - metal type
  - karat / purity
  - stone weight
  - other weight
  - QR net weight
  - computed net weight
  - stone components
  - purity percent
  - wastage percent
  - settlement percent
  - fine weight
  - selected net weight
  - tolerance
  - net weight check
  - formula text
  - raw QR
  - parsed snapshot preview
  - warnings

### What is missing in the UI
- settlementInputs is stored in the backend, but the detail modal does not yet explain:
  - karat
  - puritySource
  - wastageSource
  - purityOverridden
  - wastageOverridden
  - originalPurityPercent
  - originalWastagePercent
- It also does not clearly separate:
  - source values
  - overridden values
  - final values

### Graceful handling of older sales
- yes, the modal handles missing snapshots with fallback text
- yes, the list remains lightweight

### Verdict
- Sales list is fine for browsing.
- Sale detail is close to useful, but it still needs audit labels for source and override tracking.

## 7. Supplier QR Test Tool Current State

File: `admin-panel/src/pages/suppliers/components/SupplierQrTool.jsx`

### Current behavior
- Raw QR input box
- Supplier selector or auto-detect
- Parse button
- Result card with:
  - parse status
  - supplier
  - template strategy
  - supplier
  - item code
  - gross
  - stone
  - net
  - warnings/review message

### API used
- `POST /api/v1/suppliers/parse-qr`
- Frontend helper: `testSupplierParse()` in `admin-panel/src/api/suppliers.api.js`

### Response shape expected
- `supplier`
- `matchType`
- `parseResult`
- `normalizedResult`
- `validatedResult`
- `valuation`

### What it already does well
- Reads `normalizedResult.display.*` first
- Falls back to older flat parse fields
- Handles manual supplier selection
- Shows review state

### What is still missing
- a business-readable calculation table
- explicit karat display in the summary panel
- explicit purity display in the summary panel
- an assumptions section
- a structured net weight check explanation
- clearer distinction between "parsed but needs review" and "business warning"
- the screen still feels like a debug tool rather than a confirmation tool

### Verdict
- Better than before, but still too technical for shop-owner use.

## 8. Settlement and Reporting Current State

Files:
- `admin-panel/src/pages/settlement-workflow/SettlementReportsPage.jsx`
- `admin-panel/src/pages/settlement-workflow/components/SettlementReportsTable.jsx`
- `admin-panel/src/pages/settlement-workflow/components/SettlementReportsSummary.jsx`
- `admin-panel/src/pages/settlement-workflow/settlementReportPrint.js`
- `admin-panel/src/pages/settlement-workflow/ExceptionsPage.jsx`
- `admin-panel/src/pages/settlement-workflow/ExceptionDetailPage.jsx`

### Settlement reports page
- Filters:
  - search
  - supplier
  - date range
- Summary cards:
  - finalized rows
  - gross weight
  - net weight
  - fine weight
  - stone amount
- Table columns:
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
  - recorded date
- Export:
  - CSV
  - PDF preview/print view

### Backend behavior
- `backend/src/services/settlementReports.service.js` first uses sale-backed rows.
- If no sale rows exist, it falls back to `QrIngestion`.
- This means the settlement layer is still mixed with a legacy fallback path.

### What is missing for the future report model
- stone components
- other weight
- QR net
- computed net
- selected net
- settlement percent
- warnings / review flag
- settlement input source tracking
- original purity/wastage before override

### Exceptions pages
- Good for ops review and corrections.
- Not the main shop-owner settlement screen.
- Still technical and correction-oriented.

### Verdict
- Current settlement pages are serviceable for a basic ledger.
- They are not yet a full audit report surface for the new settlement model.

## 9. Admin API Contract Mapping

### Auth
- Page: LoginPage
- APIs:
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/me`
- Response shape:
  - `success`, `data`, `message`
  - login returns user/session data
- Includes:
  - auth token and user session from login
- Notes:
  - standard auth wrapper via `admin-panel/src/api/client.js`

### Dashboard
- Page: DashboardPage
- API:
  - `GET /api/v1/reports/summary`
- Response shape:
  - dashboard summary object with totals and rankings
- Includes:
  - no supplier businessSettings
  - no snapshots

### Suppliers
- Pages:
  - SuppliersPage
  - SupplierFormPage
  - SupplierQrTool
- APIs:
  - `GET /api/v1/suppliers`
  - `POST /api/v1/suppliers`
  - `PUT /api/v1/suppliers/:id`
  - `DELETE /api/v1/suppliers/:id`
  - `POST /api/v1/suppliers/parse-qr`
- Response shape:
  - list returns supplier array
  - parse returns supplier, matchType, parseResult, normalizedResult, validatedResult, valuation
- Includes:
  - `businessSettings` and `qrProfile` on supplier records from backend
  - `normalizedResult.display.*` on parse response
- Frontend/backend mismatch:
  - supplier form still does not expose the new supplier business settings model

### Sales
- Pages:
  - SalesPage
  - SaleDetailModal
- APIs:
  - `GET /api/v1/sales`
  - `GET /api/v1/sales/export`
  - `GET /api/v1/sales/summary/today`
  - `GET /api/v1/sales/:id`
- Response shape:
  - list/export are lightweight
  - detail returns the sale plus `calculationSnapshot`, `parsedSnapshot`, `settlementInputs`
- Includes:
  - `calculationSnapshot`
  - `parsedSnapshot`
  - `settlementInputs`
- Frontend/backend mismatch:
  - UI shows snapshots, but not the full override-source audit trail yet

### Business
- Page: BusinessSettingsPage
- APIs:
  - `GET /api/v1/business/overview`
  - `GET /api/v1/business/options`
  - `POST /api/v1/business/options`
  - `PUT /api/v1/business/options/:id`
  - `DELETE /api/v1/business/options/:id`
  - `GET /api/v1/business/settings`
  - `PUT /api/v1/business/settings`
- Response shape:
  - overview returns categories, metalTypes, settings
  - settings endpoint returns key/value rows
- Includes:
  - global categories
  - global metal types
  - global settlement defaults
- Frontend/backend mismatch:
  - supplier-specific businessSettings are not surfaced here

### Settlement / QR reports
- Pages:
  - SettlementReportsPage
  - ExceptionsPage
  - ExceptionDetailPage
- APIs:
  - `GET /api/v1/reports/settlement/summary`
  - `GET /api/v1/reports/settlement`
  - `GET /api/v1/reports/settlement/export.csv`
  - `GET /api/v1/reports/settlement/export.pdf`
  - `GET /api/v1/reports/qr/summary`
  - `GET /api/v1/reports/qr`
  - `GET /api/v1/reports/qr/export.csv`
  - `GET /api/v1/reports/qr/export.pdf`
  - `GET /api/v1/qr/:id`
  - `PATCH /api/v1/qr/:id/corrections`
  - `PATCH /api/v1/qr/:id/approve`
  - `PATCH /api/v1/qr/:id/reviewed`
- Response shape:
  - settlement rows and summary
  - QR exception records and workflow detail
- Includes:
  - mixed sale-backed and legacy QR ingestion data at backend layer
- Frontend/backend mismatch:
  - reports do not yet expose the newer audit columns

### Users
- Page: UsersPage
- APIs:
  - `GET /api/v1/users`
  - `POST /api/v1/users`
  - `PATCH /api/v1/users/:id`
  - `DELETE /api/v1/users/:id`
  - `PATCH /api/v1/users/:id/toggle-status`
- Response shape:
  - user list and user mutations
- Includes:
  - no sales/supplier audit fields

## 10. Field Mapping Matrix

Legend:
- present = currently shown or returned directly
- partial = available but not fully surfaced or only on some screens
- missing = not shown in that UI path
- legacy = still available from older data shape

| Field | Backend model | Backend API response | Admin supplier UI | Admin QR debug UI | Admin sale detail UI | Admin settlement report UI | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| supplier | Supplier, Sale | supplier object, parse response, sale detail, settlement rows | present | present | present | present | shown as supplier name/code |
| supplier code | Supplier | supplier.code, supplier object | present | present | partial | partial | sale detail shows supplier object only |
| item/design code | Supplier parse, Sale, settlement rows | normalizedResult.display.item, sale.itemCode, report row code | missing | present | present | present | supplier UI does not show it |
| category | Supplier, Sale, settlement rows | supplier.categories, sale.category, parse display item.category, report row category | partial | partial | present | present | supplier UI only has plain category list |
| colorCategory | Parser display, Sale parsedSnapshot | parse display item.colorCategory, sale parsedSnapshot | missing | partial | present | missing | mostly parser-only today |
| metalType | Supplier/business, Sale, settlement rows | sale.metalType, report row metal_type, parse display item.metalType | missing | partial | present | present | business setting has metal types globally |
| karat | Supplier parse, Sale settlementInputs, Sale detail | parse display item.karat, sale.settlementInputs.karat, sale detail | missing | partial | present | missing | QR debug and sale detail both need clearer display |
| purityPercent | Supplier.businessSettings, Sale.settlementInputs, Sale.calculationSnapshot | normalizedResult.purityPercent, sale.settlementInputs.purityPercent, calculationSnapshot.purityPercent | missing | missing/partial | present | present | sale detail shows it, QR debug summary does not yet make it prominent |
| originalPurityPercent | Sale.settlementInputs | sale.settlementInputs.originalPurityPercent | missing | missing | missing | missing | audit field not surfaced yet |
| puritySource | Sale.settlementInputs | sale.settlementInputs.puritySource | missing | missing | missing | missing | audit field not surfaced yet |
| purityOverridden | Sale.settlementInputs | sale.settlementInputs.purityOverridden | missing | missing | missing | missing | audit field not surfaced yet |
| wastagePercent | Supplier.businessSettings, Sale.settlementInputs, Sale.calculationSnapshot | normalizedResult / sale detail / settlement rows | missing | missing/partial | present | present | supplier UI does not show supplier-specific wastage rules |
| originalWastagePercent | Sale.settlementInputs | sale.settlementInputs.originalWastagePercent | missing | missing | missing | missing | audit field not surfaced yet |
| wastageSource | Sale.settlementInputs | sale.settlementInputs.wastageSource | missing | missing | missing | missing | audit field not surfaced yet |
| wastageOverridden | Sale.settlementInputs | sale.settlementInputs.wastageOverridden | missing | missing | missing | missing | audit field not surfaced yet |
| grossWeight | Parser, Sale, settlement rows | parse display.weights.grossWeight, sale.grossWeight, row.gross_weight | missing | present | present | present | supplier UI only shows mapping position, not the business value |
| stoneWeight | Parser, Sale, settlement rows | parse display.weights.stoneWeight, sale.stoneWeight, row.stone_weight | missing | present | present | present | QR debug and sale detail show it |
| stoneComponents | Parser display, Sale parsedSnapshot | parse display.weights.stoneComponents, sale parsedSnapshot.weights.stoneComponents | missing | partial | present | missing | not in settlement report yet |
| otherWeight | Parser, Sale, settlement rows | parse display.weights.otherWeight, sale settlement/calculation, row.other_weight | missing | partial | present | partial | often shown in exception workflow, not in main settlement table |
| qrNetWeight | Parser display, Sale parsedSnapshot | parse display.weights.qrNetWeight, sale parsedSnapshot, calculationSnapshot | missing | partial | present | missing | not surfaced in settlement table |
| computedNetWeight | Parser display, Sale calculationSnapshot | parse display.weights.computedNetWeight, calculationSnapshot.computedNetWeight | missing | partial | present | missing | not surfaced in settlement table |
| selectedNetWeight | Parser display, Sale calculationSnapshot | parse display.weights.selectedNetWeight, calculationSnapshot.selectedNetWeight | missing | partial | present | missing | not surfaced in settlement table |
| settlementPercent | Sale.calculationSnapshot | calculationSnapshot.settlementPercent | missing | missing | present | present | settlement table still shows purity and wastage separately only |
| fineWeight | Sale.calculationSnapshot, settlement rows | calculationSnapshot.fineWeight, row.fine_weight | missing | missing | present | present | shown in settlement pages |
| stoneAmount | Sale.calculationSnapshot, settlement rows | calculationSnapshot / row.stone_amount | missing | present | present | present | QR debug shows it only indirectly if parse result includes it |
| rawQr | Sale.qrRaw, parse result | sale.qrRaw, parsedSnapshot.rawQr, parse response raw | missing | present | present | missing | debug and sale detail show it; settlement report does not |
| warnings | Parser, Sale.calculationSnapshot, QR workflow | parse display warnings, calculationSnapshot.warnings, validation warnings | missing | present | present | partial | exceptions pages are strongest here |
| requiresReview | Parser, Sale.calculationSnapshot, QR workflow | parse display.requiresReview, calculationSnapshot.requiresReview | missing | present | present | partial | settlement report does not show it yet |

## 11. Current UX Problems

### Supplier UX
- `admin-panel/src/pages/suppliers/SupplierFormPage.jsx`
  - the QR setup section exposes delimiter, detection type, detection pattern, and field indexes too early
  - supplier business settings are not shown as first-class business fields
- `admin-panel/src/pages/suppliers/components/SupplierFormQrSetupSection.jsx`
  - reads like a parser tuning screen, not a supplier business settings screen
- `admin-panel/src/pages/suppliers/components/SupplierCard.jsx`
  - QR mapping pills are useful for debugging but too technical for a normal supplier card
- `admin-panel/src/pages/suppliers/components/SupplierQrTool.jsx`
  - still feels like a developer tool even though it is supposed to help business users confirm a QR

### Global vs supplier settings
- `admin-panel/src/pages/business/BusinessSettingsPage.jsx`
  - global categories and settlement defaults overlap conceptually with the new supplier businessSettings model
  - the UI does not explain which values are global and which are supplier-specific

### Sale detail UX
- `admin-panel/src/pages/sales/components/SaleDetailModal.jsx`
  - shows the calculation snapshot, but not the settlement input audit trail
  - does not clearly label source versus override versus resolved values

### Settlement/report UX
- `admin-panel/src/pages/settlement-workflow/SettlementReportsPage.jsx`
  - table is still ledger-oriented and missing audit columns
- `backend/src/services/settlementReports.service.js`
  - fallback to legacy QR ingestion means the report layer is still mixed-mode

### Exception workflow UX
- `admin-panel/src/pages/settlement-workflow/ExceptionDetailPage.jsx`
  - valuable for ops, but too technical for owner-first workflows

### Cross-cutting problems
- supplier settings and business settings are split across UI screens in a way that does not match the new backend model
- QR debug output is not yet a true business confirmation view
- report tables do not yet show the newer settlement audit columns

## 12. Recommended UI Change Plan

### Phase 1: Supplier Edit UI simplification
Files likely touched:
- `admin-panel/src/pages/suppliers/SupplierFormPage.jsx`
- `admin-panel/src/pages/suppliers/components/SupplierFormBasicsSection.jsx`
- `admin-panel/src/pages/suppliers/components/SupplierFormQrSetupSection.jsx`
- `admin-panel/src/pages/suppliers/components/SupplierFormSidebar.jsx`
- `admin-panel/src/pages/suppliers/components/SupplierCard.jsx`
- `admin-panel/src/pages/suppliers/components/SupplierAlerts.jsx`
- `admin-panel/src/api/suppliers.api.js`

APIs needed:
- existing supplier create/update/list
- existing supplier parse endpoint

Goal:
- split supplier edit into business tabs:
  - Basic Info
  - Categories and Wastage
  - Karat and Purity
  - QR Template and Test
  - Advanced Developer Settings

Risk:
- medium/high because this is the main supplier configuration screen

What to test:
- supplier create/edit roundtrip
- legacy supplier load
- QR test still works
- old QR mapping still saves correctly

### Phase 2: QR debug business-readable result
Files likely touched:
- `admin-panel/src/pages/suppliers/components/SupplierQrTool.jsx`
- `admin-panel/src/pages/suppliers/suppliersPage.utils.js`

APIs needed:
- `POST /api/v1/suppliers/parse-qr`

Goal:
- show parsed fields table
- show calculation explanation
- show assumptions
- show review state clearly
- hide raw parse warnings unless review is needed

Risk:
- medium, mostly presentation and field extraction

What to test:
- Adinath
- Yug
- Utsav
- Venzora
- manual supplier selection

### Phase 3: Sale detail audit polish
Files likely touched:
- `admin-panel/src/pages/sales/components/SaleDetailModal.jsx`
- `admin-panel/src/pages/sales/SalesPage.jsx`
- maybe `admin-panel/src/pages/sales/components/SalesRecordsTable.jsx` if a badge or summary field is added

APIs needed:
- `GET /api/v1/sales/:id`

Goal:
- display settlementInputs
- display override tracking
- display source of purity and wastage
- make calculationSnapshot easier to read

Risk:
- low/medium because the data already exists

What to test:
- new QR-based sale
- manual sale
- old sale without snapshots

### Phase 4: Business Settings cleanup
Files likely touched:
- `admin-panel/src/pages/business/BusinessSettingsPage.jsx`
- `admin-panel/src/api/business.api.js`

APIs needed:
- `GET /api/v1/business/overview`
- `GET /api/v1/business/settings`
- supplier business settings support if a dedicated UI path is added later

Goal:
- keep global defaults here
- avoid overlap with supplier-specific settings

Risk:
- medium because of overlap with existing supplier fields

What to test:
- categories and metal types still save
- settlement defaults still persist
- no conflict with supplier-level settings

### Phase 5: Settlement report redesign
Files likely touched:
- `admin-panel/src/pages/settlement-workflow/SettlementReportsPage.jsx`
- `admin-panel/src/pages/settlement-workflow/components/SettlementReportsTable.jsx`
- `admin-panel/src/pages/settlement-workflow/components/SettlementReportsSummary.jsx`
- `admin-panel/src/pages/settlement-workflow/settlementReportPrint.js`
- `backend/src/services/settlementReports.service.js`

APIs needed:
- `GET /api/v1/reports/settlement/summary`
- `GET /api/v1/reports/settlement`
- `GET /api/v1/reports/settlement/export.csv`
- `GET /api/v1/reports/settlement/export.pdf`

Goal:
- add supplier-wise and overall audit columns
- show stone components, other weight, QR net, computed net, selected net, settlement percent, warnings
- remove dependence on the legacy QR fallback eventually

Risk:
- high because this touches ledger/report output and legacy compatibility

What to test:
- sale-backed rows
- legacy fallback path
- CSV export
- PDF preview
- summary totals

## 13. Risks
- Supplier form changes can easily break the existing QR mapping workflow if the technical controls are removed too aggressively.
- Business settings and supplier settings overlap at the data model level now, so the UI can confuse users unless the split is made explicit.
- Settlement reports still rely on a legacy fallback path in backend service logic.
- Sale detail can become too dense if every audit field is shown without grouping.
- QR debug can remain confusing if it exposes raw parse warnings at the same level as business decisions.

## 14. Open Questions
- Should supplier categories live only on the supplier record, or should they also sync from the global business category master?
- Which of the global settlement settings should remain global forever versus per supplier?
- Should the QR debug screen show raw parser output by default, or only when manual review is needed?
- Should sale detail show source/original/override values inline or in a separate audit accordion?
- Should settlement reports eventually stop using legacy QR fallback entirely, or keep it as a hidden fallback for old records?
- Should `qrProfile` be editable in the first supplier redesign phase, or only shown as read-only metadata at first?

