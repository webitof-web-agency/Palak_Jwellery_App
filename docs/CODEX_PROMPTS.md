# Codex Prompts
## Ready-to-use prompts for each slice

Copy the relevant prompt into Codex. Replace anything in [brackets].

---

## General Setup (paste this first in every Codex session)

```
Read AGENTS.md in the project root before doing anything.
Also read docs/PRD.md and docs/TRD.md for full context.

You are working on the Jewellery Sales Management System.
Claude Code is the supervisor and owns the backend.
Your job is frontend (React + Vite) and mobile (Flutter).

Rules:
- Only build what is in the brief below — nothing more
- Use only the approved packages listed
- All API base URLs from env vars — never hardcode
- Handle all states: loading, error, empty, success
- Report back using the DELIVERY format when done
```

---

## Slice 1 — React Login UI

```
[General Setup above]

SLICE 1 BRIEF — React Login UI

Your task: Build the React login page for the admin panel.

Project location: admin-panel/
Stack: React 19 + Vite + Tailwind CSS + Axios

Endpoint available:
- POST /api/v1/auth/login
- Request:  { email: string, password: string }
- Response: { success: true, data: { token: string, user: { id, name, email, role } } }
- Errors:   { success: false, error: "Invalid credentials", code: "INVALID_CREDENTIALS" }

What to build:
- admin-panel/src/pages/auth/LoginPage.jsx
- admin-panel/src/api/client.js  (Axios instance, base URL from VITE_API_BASE_URL)
- admin-panel/src/api/auth.api.js  (login function)
- admin-panel/src/store/authStore.js  (Zustand — store token + user, persist to localStorage)
- admin-panel/src/App.jsx  (basic router: /login and / protected route placeholder)

Approved packages:
- axios
- zustand
- react-router-dom v6

DO NOT build:
- Dashboard page (placeholder only)
- Registration page
- Forgot password
- Any charts or reports

On success: store token in localStorage via Zustand, redirect to /dashboard placeholder.
On error: show error message below the form.
Show loading spinner on the button while request is in flight.

Env vars needed:
- VITE_API_BASE_URL=http://localhost:3000

Report back with DELIVERY format when done.
```

---

## Slice 1 — Flutter Login Screen

```
[General Setup above]

SLICE 1 BRIEF — Flutter Login Screen

Your task: Build the Flutter login screen for the salesman mobile app.

Project location: mobile/
Flutter: 3.41.6, Dart 3.x
State: Riverpod 2.x
HTTP: Dio

Endpoint available:
- POST /api/v1/auth/login
- Request:  { email: string, password: string }
- Response: { success: true, data: { token: string, user: { id, name, email, role } } }
- Errors:   { success: false, error: "Invalid credentials" }

What to build:
- mobile/lib/core/api/dio_client.dart  (Dio instance, base URL from env/constants)
- mobile/lib/core/api/endpoints.dart   (URL constants)
- mobile/lib/core/auth/token_storage.dart  (flutter_secure_storage wrapper)
- mobile/lib/features/auth/data/auth_repository.dart  (login API call)
- mobile/lib/features/auth/presentation/login_screen.dart  (UI)
- mobile/lib/features/auth/presentation/auth_provider.dart  (Riverpod AsyncNotifierProvider)
- mobile/lib/main.dart  (app entry, router: login → dashboard placeholder)

Approved packages (add to pubspec.yaml):
- dio: ^5.0.0
- flutter_riverpod: ^2.0.0
- flutter_secure_storage: ^9.0.0
- go_router: ^13.0.0

DO NOT build:
- Dashboard screen (placeholder only)
- Any QR scanner yet
- Biometric auth

On success: save JWT to flutter_secure_storage, navigate to /dashboard placeholder.
On error: show SnackBar with error message.
Show CircularProgressIndicator on button while loading.
On 401 from any future request: clear token, redirect to login (set up interceptor now).

Report back with DELIVERY format when done.
```

---

## Slice 2 — React Supplier UI + QR Test Tool

```
[General Setup above]

SLICE 2 BRIEF — React Supplier Management + QR Test Tool

Your task: Build the supplier management pages for the admin panel.

Endpoints available:
- GET    /api/v1/suppliers          → { success: true, data: [Supplier] }
- POST   /api/v1/suppliers          → { success: true, data: Supplier }
- PUT    /api/v1/suppliers/:id      → { success: true, data: Supplier }
- DELETE /api/v1/suppliers/:id      → { success: true, message: "Deleted" }
- POST   /api/v1/suppliers/parse-qr → { success: true, data: ParseResult }

Supplier shape:
{
  _id, name, code, gst, address, paymentMode,
  qrMapping: { strategy: "delimiter", delimiter: string, fieldMap: { category, grossWeight, stoneWeight, netWeight } },
  categories: [string],
  isActive: boolean
}

ParseResult shape:
{
  success: boolean,
  fields: { category, grossWeight, stoneWeight, netWeight },  // null if not parsed
  errors: [{ field: string, reason: string }],
  raw: string
}

What to build:
- admin-panel/src/pages/suppliers/SuppliersPage.jsx   (list + add/edit/delete)
- admin-panel/src/pages/suppliers/SupplierForm.jsx    (add/edit form)
- admin-panel/src/pages/suppliers/QRTestTool.jsx      (paste QR → see parse result)
- admin-panel/src/api/suppliers.api.js

QR Test Tool behaviour:
- Textarea to paste raw QR string
- Select which supplier config to test against (dropdown)
- "Test Parse" button → POST /suppliers/parse-qr
- Show result: table of fields (parsed value + green/red indicator per field)
- Show raw errors below the table
- This is a CORE feature, not optional — make it clear and usable

DO NOT build:
- Reports
- Charts
- Customer management

All requests need Authorization header — use the Axios client from Slice 1 (it should attach JWT automatically).

Report back with DELIVERY format when done.
```

---

## Slice 3 — Flutter QR Scanner + Sale Entry

```
[General Setup above]

SLICE 3 BRIEF — Flutter QR Scanner + Sale Entry

Your task: Build the QR scanning and sale entry flow in Flutter.

Endpoints available:
- POST /api/v1/suppliers/parse-qr
  Request:  { rawQR: string, supplierId: string }
  Response: {
    success: boolean,
    fields: { category: string|null, grossWeight: number|null, stoneWeight: number|null, netWeight: number|null },
    errors: [{ field: string, reason: string }],
    raw: string
  }

- GET /api/v1/suppliers
  Response: { success: true, data: [{ _id, name, code, isActive }] }

- POST /api/v1/sales
  Request:  { supplierId, category, grossWeight, stoneWeight, netWeight, ratePerGram, qrRaw }
  Response: { success: true, data: { _id, totalValue, saleDate } }
  Error 409: { success: false, code: "DUPLICATE_QR", message: "...", previousSale: { saleDate } }

What to build:
- mobile/lib/features/scanner/presentation/scanner_screen.dart
- mobile/lib/features/sale_entry/presentation/sale_entry_screen.dart
- mobile/lib/features/sale_entry/presentation/sale_entry_provider.dart
- mobile/lib/features/sale_entry/data/sale_repository.dart

Scanner screen behaviour:
- Full screen camera with mobile_scanner
- Torch toggle button
- "Enter Manually" button (bypasses scanner)
- On successful scan → call parse-qr → navigate to sale entry with parsed data

Sale entry screen behaviour:
- Show all fields: Supplier (auto or dropdown), Category, Gross Weight, Stone Weight, Net Weight, Rate per Gram
- Pre-fill whatever parsed successfully (highlight unparsed fields in red/amber)
- All fields editable — never lock a field
- Live calculation: Total = Net Weight × Rate per Gram
- If supplier not detected → show supplier dropdown (required)
- "QR Debug" expandable panel showing: raw QR string + parse errors
- On 409 DUPLICATE_QR → yellow warning banner "This QR was scanned on [date]. Save anyway?" with Yes/Cancel
- On save success → show success screen with total, back to dashboard

CRITICAL: Every failure state must have a path forward. No dead ends.
- Parse fails entirely → all fields blank, show debug panel, salesman fills manually
- Supplier not found → dropdown required
- Network error on save → retry button (max 3 retries)

Approved packages (add to pubspec.yaml):
- mobile_scanner: ^5.0.0
- dio (already added in Slice 1)
- flutter_riverpod (already added)

DO NOT build:
- Offline queue / sqflite (Phase 3)
- Sale history
- Dashboard updates (just navigate back, dashboard refreshes on focus)

Report back with DELIVERY format when done.
```

---

## Slice 4 — React Dashboard + Sales List

```
[General Setup above]

SLICE 4 BRIEF — React Dashboard + Sales List

Endpoints available:
- GET /api/v1/sales?salesman=&supplier=&from=&to=&page=1&limit=20
  Response: { success: true, data: { sales: [Sale], total, page, pages } }

- GET /api/v1/reports/summary?from=&to=
  Response: {
    success: true,
    data: {
      totalSales: number,
      totalWeight: number,
      totalRevenue: number,
      bySupplier: [{ name, weight, revenue }],
      bySalesman: [{ name, salesCount, revenue }]
    }
  }

Sale shape:
{ _id, salesman: { name }, supplier: { name }, category, netWeight, ratePerGram, totalValue, saleDate, isDuplicate }

What to build:
- admin-panel/src/pages/dashboard/DashboardPage.jsx  (today's summary cards + top suppliers table)
- admin-panel/src/pages/sales/SalesPage.jsx          (filterable table of all sales)
- admin-panel/src/pages/sales/SaleDetailModal.jsx    (all fields of one sale)
- admin-panel/src/api/sales.api.js
- admin-panel/src/api/reports.api.js

Dashboard: show 3 summary cards (total sales count, total weight in grams, total revenue).
Below: top 5 suppliers table (name, weight, revenue) for today.
NO charts yet — just tables and numbers.

Sales list: table with columns: Date, Salesman, Supplier, Category, Net Weight, Rate, Total, flag if isDuplicate.
Filters: salesman dropdown, supplier dropdown, date range picker.
Pagination: previous/next, show "X of Y results".

DO NOT build:
- Charts / graphs (Phase 2)
- PDF export (Phase 2)
- Reports page (Phase 2)

Report back with DELIVERY format when done.
```

---

## Slice 4 — Flutter Salesman Dashboard + History

```
[General Setup above]

SLICE 4 BRIEF — Flutter Dashboard + Sale History

Endpoints available:
- GET /api/v1/sales?page=1&limit=20
  (filtered to logged-in salesman server-side)
  Response: { success: true, data: { sales: [Sale], total } }

- GET /api/v1/reports/summary/me
  Response: { success: true, data: { todaySales: number, todayWeight: number, todayRevenue: number } }

What to build:
- mobile/lib/features/dashboard/presentation/dashboard_screen.dart  (replace placeholder)
- mobile/lib/features/history/presentation/history_screen.dart
- mobile/lib/features/history/presentation/sale_detail_screen.dart

Dashboard: 3 summary cards (today's sales count, weight, revenue). List of last 5 sales with tap to detail. FAB to new sale.
History: full list of salesman's sales, newest first. Tap → detail screen.
Sale detail: all fields displayed cleanly. Read-only.

DO NOT build:
- History filters (Phase 2)
- Charts (Phase 2)
- Edit sale (Phase 2)

Report back with DELIVERY format when done.
```

---

## Slice 5 — React User Management

```
[General Setup above]

SLICE 5 BRIEF — React User Management

Endpoints available:
- GET    /api/v1/users              → { success: true, data: [User] }
- POST   /api/v1/users              → create user
- PUT    /api/v1/users/:id          → update user
- PATCH  /api/v1/users/:id/status   → { isActive: boolean }
- POST   /api/v1/users/:id/reset-password → { password: string }

User shape:
{ _id, name, email, role: "salesman"|"admin", isActive, createdAt }

What to build:
- admin-panel/src/pages/users/UsersPage.jsx   (list + actions)
- admin-panel/src/pages/users/UserForm.jsx    (create/edit modal)
- admin-panel/src/api/users.api.js

List: table with columns: Name, Email, Role, Status (Active/Inactive badge), Created date, Actions.
Actions per row: Edit, Activate/Deactivate toggle, Reset Password.
Reset password: prompt admin to enter new password → POST to reset endpoint.
Create: modal form — name, email, role (dropdown), password.

DO NOT build:
- Permission flags (Phase 2)
- Activity logs
- Bulk actions

Report back with DELIVERY format when done.
```
