# Technical Requirements Document (TRD)
## Jewellery Sales Management System
**Version:** 1.0  
**Date:** 2026-04-15  
**Author:** Shaurya Kumar  
**Status:** Draft

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   Flutter Mobile    │     │   React Admin Panel  │
│   (Android APK)     │     │   (Web Browser)      │
│                     │     │                      │
│  - Salesman UI      │     │  - Admin Dashboard   │
│  - QR Scanner       │     │  - Reports           │
│  - Sale Entry       │     │  - Supplier Mgmt     │
└────────┬────────────┘     └──────────┬───────────┘
         │                             │
         │         HTTPS / REST API    │
         └──────────────┬──────────────┘
                        │
             ┌──────────▼──────────┐
             │   Node.js + Express  │
             │   REST API Server    │
             │                      │
             │  - Auth (JWT)        │
             │  - Business Logic    │
             │  - QR Parse Engine   │
             │  - PDF Generator     │
             │  - Audit Logger      │
             └──────────┬───────────┘
                        │
             ┌──────────▼───────────┐
             │       MongoDB         │
             │                       │
             │  - Users              │
             │  - Sales              │
             │  - Suppliers          │
             │  - Audit Logs         │
             └───────────────────────┘
```

### 1.2 Deployment Architecture

```
VPS (Hetzner / DigitalOcean)
├── Nginx (reverse proxy + SSL termination)
│   ├── /api/*        → Node.js app (port 3000)
│   └── /*            → React admin build (static files)
├── Node.js app (PM2 process manager)
├── MongoDB (local instance or MongoDB Atlas)
└── Certbot (Let's Encrypt SSL)

Flutter APK → distributed directly (APK file / internal link)
```

---

## 2. Tech Stack

| Layer | Technology | Version | Reason |
|-------|-----------|---------|--------|
| Mobile App | Flutter | 3.x (stable) | MLKit scanning, native performance |
| Mobile Language | Dart | 3.x | Required by Flutter |
| Admin Panel | React + Vite | React 19 | Fast dev, component reuse |
| Admin Styling | Tailwind CSS | 3.x | Rapid UI, no custom CSS bloat |
| Backend | Node.js + Express | Node 20 LTS | Familiar JS ecosystem |
| Database | MongoDB | 7.x | Flexible schema for QR configs |
| ODM | Mongoose | 8.x | Schema validation + query helpers |
| Auth | JWT + bcrypt | - | Stateless, secure |
| PDF Generation | pdfkit | - | Server-side, no browser needed |
| QR Scanning | mobile_scanner | latest | MLKit-based, reliable on mid-range Android |
| State Mgmt (Flutter) | Riverpod | 2.x | Clean, testable, recommended for Flutter |
| HTTP Client (Flutter) | Dio | - | Interceptors for JWT injection |
| State Mgmt (React) | Zustand | - | Lightweight, simple |
| Charts (React) | Recharts | - | Easy, composable |
| Process Manager | PM2 | - | Keep Node.js alive on VPS |
| Reverse Proxy | Nginx | - | SSL + static file serving |

---

## 3. Project Folder Structure

### 3.1 Repository Structure
```
jwellery-app/
├── docs/
│   ├── PRD.md
│   └── TRD.md
├── backend/                  # Node.js API
├── admin-panel/              # React web app
├── mobile/                   # Flutter app
└── README.md
```

### 3.2 Backend Structure
```
backend/
├── src/
│   ├── config/
│   │   ├── db.js             # MongoDB connection
│   │   └── env.js            # Environment config
│   ├── models/
│   │   ├── User.js
│   │   ├── Sale.js
│   │   ├── Supplier.js
│   │   ├── Customer.js
│   │   ├── AuditLog.js
│   │   └── Settings.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── sales.routes.js
│   │   ├── suppliers.routes.js
│   │   ├── users.routes.js
│   │   ├── customers.routes.js
│   │   ├── reports.routes.js
│   │   └── settings.routes.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── sales.controller.js
│   │   ├── suppliers.controller.js
│   │   ├── users.controller.js
│   │   ├── customers.controller.js
│   │   ├── reports.controller.js
│   │   └── settings.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js      # JWT verification
│   │   ├── role.middleware.js      # Role-based access
│   │   └── audit.middleware.js     # Audit logging
│   ├── services/
│   │   ├── qrParser.service.js     # QR mapping engine
│   │   ├── pdf.service.js          # PDF generation
│   │   └── audit.service.js        # Audit log writer
│   └── app.js
├── .env
├── package.json
└── server.js
```

### 3.3 Admin Panel Structure
```
admin-panel/
├── src/
│   ├── api/                  # Axios API calls per module
│   ├── components/           # Reusable UI components
│   ├── pages/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── suppliers/
│   │   ├── users/
│   │   ├── customers/
│   │   ├── reports/
│   │   └── settings/
│   ├── store/                # Zustand stores
│   ├── hooks/                # Custom React hooks
│   └── App.jsx
├── index.html
├── vite.config.js
└── package.json
```

### 3.4 Flutter App Structure
```
mobile/
├── lib/
│   ├── main.dart
│   ├── core/
│   │   ├── api/              # Dio HTTP client + endpoints
│   │   ├── auth/             # JWT storage + refresh
│   │   └── constants/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── scanner/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   ├── sale_entry/
│   │   ├── dashboard/
│   │   └── history/
│   └── shared/
│       ├── widgets/
│       └── theme/
├── android/
├── pubspec.yaml
└── README.md
```

---

## 4. MongoDB Schema Design

### 4.1 Users Collection
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string (unique)",
  "passwordHash": "string",
  "role": "enum: ['admin', 'salesman']",
  "isActive": "boolean",
  "permissions": {
    "canEditSale": "boolean",
    "canCorrectQRFields": "boolean"
  },
  "createdBy": "ObjectId (ref: User)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 4.2 Suppliers Collection
```json
{
  "_id": "ObjectId",
  "name": "string",
  "code": "string (unique, used in QR detection)",
  "gst": "string",
  "address": "string",
  "paymentMode": "enum: ['cash', 'cheque', 'bank_transfer', 'other']",
  "qrMapping": {
    "strategy": "enum: ['delimiter', 'fixed_position', 'json']",
    "delimiter": "string (Strategy A only, e.g. '|')",
    "fieldMap": {
      "supplierCode": "number (index or position range or json key)",
      "category":     "number | string",
      "grossWeight":  "number | string",
      "stoneWeight":  "number | string",
      "netWeight":    "number | string"
    }
  },
  "categories": ["string"],
  "isActive": "boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

#### QR Mapping Examples per Strategy:

**Strategy A (delimiter):**
```json
"qrMapping": {
  "strategy": "delimiter",
  "delimiter": "|",
  "fieldMap": {
    "supplierCode": 0,
    "category": 1,
    "grossWeight": 2,
    "stoneWeight": 3,
    "netWeight": 4
  }
}
```

**Strategy B (fixed_position):**
```json
"qrMapping": {
  "strategy": "fixed_position",
  "fieldMap": {
    "supplierCode": [0, 5],
    "category": [5, 9],
    "grossWeight": [9, 14],
    "stoneWeight": [14, 18],
    "netWeight": [18, 23]
  }
}
```

**Strategy C (json):**
```json
"qrMapping": {
  "strategy": "json",
  "fieldMap": {
    "supplierCode": "sup",
    "category": "cat",
    "grossWeight": "gw",
    "stoneWeight": "sw",
    "netWeight": "nw"
  }
}
```

---

### 4.3 Sales Collection
```json
{
  "_id": "ObjectId",
  "qrRaw": "string (original QR string, for duplicate detection)",
  "qrHash": "string (SHA256 of qrRaw, indexed for fast lookup)",
  "salesman": "ObjectId (ref: User)",
  "supplier": "ObjectId (ref: Supplier)",
  "customer": "ObjectId (ref: Customer, optional)",
  "category": "string",
  "grossWeight": "number (grams)",
  "stoneWeight": "number (grams)",
  "netWeight": "number (grams)",
  "ratePerGram": "number",
  "totalValue": "number (netWeight × ratePerGram)",
  "wasManuallyEdited": "boolean",
  "editedFields": ["string"],
  "isLocked": "boolean (true after edit window expires)",
  "saleDate": "Date",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 4.4 Customers Collection
```json
{
  "_id": "ObjectId",
  "name": "string",
  "phone": "string",
  "gst": "string",
  "address": "string",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 4.5 AuditLogs Collection
```json
{
  "_id": "ObjectId",
  "user": "ObjectId (ref: User)",
  "action": "enum: ['create', 'update', 'delete', 'login', 'logout']",
  "resource": "string (e.g. 'sale', 'supplier', 'user')",
  "resourceId": "ObjectId",
  "before": "object (snapshot before change)",
  "after": "object (snapshot after change)",
  "ip": "string",
  "createdAt": "Date"
}
```

### 4.6 Settings Collection
```json
{
  "_id": "ObjectId",
  "key": "string (unique)",
  "value": "mixed",
  "updatedBy": "ObjectId (ref: User)",
  "updatedAt": "Date"
}
```
Settings keys:
- `default_rate_per_gram`
- `sale_edit_lock_hours`
- `duplicate_qr_window_hours`
- `company_name`
- `company_logo_url`
- `tax_percent`

---

## 5. API Design

### 5.1 Base URL
```
https://yourdomain.com/api/v1
```

### 5.2 Authentication
All protected routes require:
```
Authorization: Bearer <jwt_token>
```

### 5.3 API Endpoints

#### Auth
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/auth/login` | Public | Login, returns JWT |
| POST | `/auth/logout` | Auth | Invalidate session |
| POST | `/auth/reset-password` | Admin | Reset a user's password |
| GET | `/auth/me` | Auth | Get current user info |

#### Sales
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/sales` | Salesman | Create new sale |
| GET | `/sales` | Auth | List sales (filtered by role) |
| GET | `/sales/:id` | Auth | Get single sale detail |
| PUT | `/sales/:id` | Salesman (with permission) | Edit sale (within lock window) |
| GET | `/sales/check-qr` | Salesman | Check if QR already used |

#### Suppliers
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/suppliers` | Auth | List all suppliers |
| POST | `/suppliers` | Admin | Create supplier |
| PUT | `/suppliers/:id` | Admin | Update supplier |
| DELETE | `/suppliers/:id` | Admin | Delete supplier |
| POST | `/suppliers/parse-qr` | Auth | Test QR parsing with a supplier config |

#### Users
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/users` | Admin | List all users |
| POST | `/users` | Admin | Create user |
| PUT | `/users/:id` | Admin | Update user |
| PATCH | `/users/:id/status` | Admin | Activate/Deactivate |

#### Customers
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/customers` | Auth | List customers |
| POST | `/customers` | Auth | Create customer |
| PUT | `/customers/:id` | Auth | Update customer |

#### Reports
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/reports/supplier` | Admin | Supplier-wise report |
| GET | `/reports/category` | Admin | Category-wise report |
| GET | `/reports/salesman` | Admin | Salesman-wise report |
| GET | `/reports/export/pdf` | Admin | Download PDF report |

#### Settings
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/settings` | Admin | Get all settings |
| PUT | `/settings` | Admin | Update settings |
| POST | `/settings/logo` | Admin | Upload company logo |

---

## 6. QR Parse Engine

The QR Parse Engine (`qrParser.service.js`) is the most critical and fragile part of the system. Supplier QR formats will change without warning. The engine must never throw — it must always return a structured result.

### 6.1 Function Signature

```javascript
parseQR(rawQRString, supplierQRMappingConfig)
```

### 6.2 Return Shape (always returned, never throws)

```javascript
{
  success: boolean,           // true if at least one field parsed
  strategy: string,           // which strategy was used
  fields: {
    supplierCode: { value: string | null, parsed: boolean },
    category:     { value: string | null, parsed: boolean },
    grossWeight:  { value: number | null, parsed: boolean },
    stoneWeight:  { value: number | null, parsed: boolean },
    netWeight:    { value: number | null, parsed: boolean },
  },
  errors: [
    { field: string, reason: string }   // one entry per failed field
  ],
  raw: string                 // original QR string, always present
}
```

### 6.3 Strategy Routing

```
if strategy === 'delimiter'       → split by delimiter, pick by index
if strategy === 'fixed_position'  → substring by [start, end] ranges
if strategy === 'json'            → JSON.parse, pick by key names
```

### 6.4 Error Scenarios & Handling

| Scenario | Engine Behaviour |
|----------|-----------------|
| All fields parse successfully | `success: true`, all `parsed: true` |
| Some fields missing in QR | `success: true`, missing fields have `parsed: false`, error entry per missing field |
| Number field is non-numeric | `parsed: false`, error: `"grossWeight: expected number, got 'abc'"` |
| JSON strategy — invalid JSON | `success: false`, all `parsed: false`, error: `"Invalid JSON in QR"` |
| Delimiter strategy — too few parts | Partial parse: fill what's available, error for missing indices |
| Fixed position — QR string too short | Partial parse: fill what fits, error for out-of-range fields |
| Supplier config missing or null | `success: false`, error: `"No mapping config for supplier"` |
| Empty QR string | `success: false`, error: `"Empty QR"` |

### 6.5 Supplier Auto-Detection

Before parsing, supplier must be identified from the raw QR string. `startsWith` alone will break on real data — supplier codes may appear mid-string, have inconsistent casing, or vary by batch.

```javascript
detectSupplier(rawQRString, allSuppliers)
```

Detection priority order:
1. **Regex match** — each supplier can optionally define a `detectionRegex` (e.g. `/^SUP01/i`)
2. **Contains match** — check if `rawQRString.includes(supplier.code)` (case-insensitive)
3. **Prefix match** — fallback `startsWith` as last resort

```javascript
// Supplier schema includes optional detection config
detectionPattern: {
  type: 'regex' | 'contains' | 'prefix',   // default: 'contains'
  pattern: string                            // regex string or code string
}
```

Returns `{ supplier, matchType }` or `null` if no match.

**If `null` → Flutter shows manual supplier dropdown. Never auto-assume or crash.**

---

## 7. Security Requirements

| Area | Requirement |
|------|-------------|
| Passwords | bcrypt with salt rounds ≥ 12 |
| JWT | HS256, expiry 8 hours, refresh on activity |
| API | Rate limiting: 100 req/min per IP |
| Input | Sanitize all inputs (express-validator) |
| MongoDB | Never expose `_id` of other users; query-scope by role |
| HTTPS | Enforced via Nginx; HTTP → HTTPS redirect |
| CORS | Whitelist only admin panel domain + local Flutter dev |
| QR Hash | Store SHA256 of raw QR for fast duplicate detection without storing full raw string |

---

## 8. Flutter App — Key Technical Decisions

### 8.1 QR Scanning
- Package: `mobile_scanner` (MLKit-based)
- Camera opens in full-screen overlay
- Auto-detect + parse on first successful scan
- Vibrate + beep on successful scan
- Torch toggle button for low-light environments

### 8.2 Auth Token Storage
- Store JWT in `flutter_secure_storage` (encrypted keystore, not SharedPreferences)
- Auto-attach to all Dio requests via interceptor
- On 401 response → clear token → redirect to login

### 8.3 State Management
- Riverpod 2.x with `AsyncNotifierProvider`
- One provider per feature (auth, scanner, sales, dashboard)

### 8.4 Offline Handling (P2)
- Detect connectivity with `connectivity_plus`
- Queue failed sale submissions in local SQLite (`sqflite`)
- Auto-sync on reconnect

---

## 9. Build & Deployment

### 9.1 Flutter APK Build
```bash
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
# Distribute via direct download link on VPS or WhatsApp
```

### 9.2 Backend Deployment
```bash
# On VPS
git pull
npm install --production
pm2 restart jwellery-api
```

### 9.3 Admin Panel Deployment
```bash
npm run build
# Copy dist/ to /var/www/admin-panel/
# Nginx serves static files
```

### 9.4 Environment Variables (Backend)
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/jwellery
JWT_SECRET=<strong-random-secret>
JWT_EXPIRY=8h
BCRYPT_ROUNDS=12
CORS_ORIGIN=https://admin.yourdomain.com
MAX_UPLOAD_SIZE=5mb
```

---

## 10. Development Phases

> **Strategy:** Thin vertical slices, not horizontal layers. Each slice delivers something testable end-to-end. Never build a complete layer before touching the next one.

---

### Slice 1 — Walking Skeleton (Days 1–3)
Get the minimum possible thing running end-to-end. Proves the stack works.

**Backend:**
- [ ] Project setup, MongoDB connection, env config
- [ ] User model + login endpoint (JWT)
- [ ] One protected route (`GET /api/v1/me`) to verify auth works

**Admin Panel:**
- [ ] Vite + React + Tailwind setup
- [ ] Login page → calls backend → stores JWT → shows "logged in as X"

**Flutter:**
- [ ] Flutter project setup + Riverpod + Dio
- [ ] Login screen → calls backend → stores JWT in secure storage → shows home

✅ **Done when:** All three login flows work against the real backend.

---

### Slice 2 — Supplier Config + QR Test Tool (Days 4–7)
The most critical admin feature. Get real QR samples from the supplier NOW, before writing any more code.

> **⚠️ Build only delimiter strategy in this slice.** Fixed-position and JSON strategies are added in Slice 2b AFTER you have real QR samples in hand. Building all 3 now risks rewriting them when reality doesn't match assumptions.

**Backend:**
- [ ] Supplier model + CRUD endpoints
- [ ] QR Parse Engine — **delimiter strategy only**
- [ ] `POST /suppliers/parse-qr` — takes raw QR + supplier ID, returns parsed fields + errors
- [ ] Supplier auto-detection (see Section 6.5 — use regex/contains, not just prefix)

**Admin Panel:**
- [ ] Supplier list + add/edit form
- [ ] QR mapping config UI (delimiter strategy only for now)
- [ ] **QR Test Tool** — paste raw QR, hit Test, see parsed fields side-by-side with errors

**Slice 2b — After collecting real QR samples:**
- [ ] Add fixed-position strategy to parse engine
- [ ] Add JSON strategy to parse engine
- [ ] Expand config UI for strategies B and C

✅ **Done when:** Admin can add a supplier with delimiter mapping, paste a real QR string, and see what parses correctly.

---

### Slice 3 — Sale Entry on Mobile (Days 8–14)
The core salesman workflow. Must handle all failure states.

**Backend:**
- [ ] Sale model + `POST /sales` endpoint
- [ ] Duplicate QR detection (by QR hash)
- [ ] `GET /suppliers` — list active suppliers (for manual fallback)

**Flutter:**
- [ ] QR scanner screen (mobile_scanner)
- [ ] Call `parse-qr` API → receive parsed fields
- [ ] Sale entry form — auto-fill from parse, all fields editable
- [ ] Manual supplier selection if auto-detect fails
- [ ] Manual entry mode if scan fails entirely
- [ ] QR debug panel — show raw QR + parse errors when applicable
- [ ] Duplicate QR warning banner (soft warning, allow override)
- [ ] Confirmation screen → Save → success state

✅ **Done when:** Salesman can scan a real QR and save a sale. AND can save a sale when QR fails. Test on a real device.

---

### Slice 4 — Visibility (Days 15–18)
Give admin and salesman enough to verify "are sales being recorded correctly?"

**Backend:**
- [ ] `GET /sales` with filters (salesman, supplier, date)
- [ ] Today's summary aggregation (count, weight, revenue)

**Admin Panel:**
- [ ] Sales list table with filters (salesman, supplier, date)
- [ ] Today's summary row (sales count, total weight, total revenue)
- [ ] Sale detail view

**Flutter:**
- [ ] Salesman dashboard — today's count, weight, revenue
- [ ] Sale history list (basic, no filters yet)
- [ ] Sale detail view

✅ **Done when:** Admin opens browser and can see today's sales. Salesman opens app and sees their total for the day.

---

### ✅ Real-World Checkpoint — After Slice 3
**Do this before writing any more code:**
- Give the APK to a real salesman (or act as one yourself in the actual shop)
- Watch them complete 5–10 real sales
- Collect every QR code they scan — keep the raw strings
- Note every moment of confusion or friction
- Fix what you observe before moving to Slice 4

This is not optional. You will discover things here that no doc can predict.

---

### Slice 5 — User Management + Hardening (Days 19–21)
Operational basics before going live.

**Backend:**
- [ ] User CRUD (admin creates/edits/deactivates salesmen)
- [ ] Password reset by admin
- [ ] Role middleware on all routes
- [ ] Input validation (express-validator) on all endpoints
- [ ] Rate limiting

**Admin Panel:**
- [ ] User list + create/edit/deactivate form

✅ **Done when:** Admin can create a salesman account, deactivate it, reset the password.

---

### Phase 2 — Reports & History (After Phase 1 ships and is validated in real use)
- Reports API (supplier / category / salesman wise)
- Reports UI with date range filters
- PDF export
- Sale history filters on mobile
- Monthly charts on mobile + admin
- Customer management

### Phase 3 — Operations (Future)
- Full offline sale queuing + sync (sqflite local cache)
- Sale edit lock + permission flags per salesman
- Audit log
- Company settings (logo, tax, default rate)

---

### Minimal Offline Handling (Add in Slice 3, not Phase 3)
Full offline-first is Phase 3. But a basic safety net must be in Slice 3 so the app doesn't lose a sale on a bad network moment:

```
On save sale API call failure:
→ Show "No connection — retrying..." banner
→ Retry up to 3 times with 2s backoff
→ If all retries fail → store sale locally (sqflite, single table)
→ Show "1 sale pending sync" badge on dashboard
→ On next app open or network restore → auto-retry pending sales
→ On success → clear local queue
```

This is ~1 day of work. Not full offline. Just "don't lose a sale."

---

## 11. Open Technical Questions
- [ ] Will MongoDB be on the same VPS as Node.js or use MongoDB Atlas?
- [ ] Is there a maximum number of scans expected per day per salesman? (affects rate limiting)
- [ ] Should the APK be self-signed or do we need Play Store distribution?
- [ ] Should audit logs be queryable from admin panel in v1.0?
