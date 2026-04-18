# Agent Context
## Jewellery Sales Management System

> Universal project context file. Works with: Antigravity, Codex, Claude Code, Cursor, Gemini CLI.

---

## How You Operate

1. Check existing code before writing anything new
2. Use Sequential Thinking for complex tasks — plan first, code second
3. When something breaks — fix it, test it, tell me what you learned
4. Build incrementally — don't build everything at once — one slice at a time
5. Update your approach based on what works in this project

---

## Project Info

**Project Name:** Jewellery Sales Management System  
**Type:** Mobile App (Android) + Web Admin Panel + REST API  
**Status:** In development — Slice 1 (Walking Skeleton)  
**Docs:** See `docs/PRD.md` (product requirements) and `docs/TRD.md` (technical spec) — read these before starting any task

---

## Tech Stack

**Mobile App:** Flutter 3.41.6 (Dart) — Android APK only  
**Mobile State:** Riverpod 2.x  
**Mobile HTTP:** Dio (with JWT interceptor)  
**Mobile QR:** mobile_scanner (MLKit-based)  
**Mobile Storage:** flutter_secure_storage (JWT), sqflite (offline queue)  
**Admin Panel:** React 19 + Vite  
**Styling:** Tailwind CSS  
**Charts:** Recharts  
**Admin State:** Zustand  
**Backend:** Node.js + Express  
**Database:** MongoDB + Mongoose  
**Auth:** JWT + bcrypt (no third-party auth service)  
**PDF:** pdfkit (server-side)  
**Hosting:** VPS (Hetzner or DigitalOcean) — Nginx + PM2  

---

## Project Structure

```
JwelleryCustomApp/
├── docs/
│   ├── PRD.md              # Product requirements — read this first
│   └── TRD.md              # Technical spec — schemas, API, build plan
├── backend/                # Node.js + Express API
│   └── src/
│       ├── config/         # DB connection, env
│       ├── models/         # Mongoose models
│       ├── routes/         # Express route files
│       ├── controllers/    # Business logic
│       ├── middleware/      # Auth, role, audit
│       └── services/       # QR parser, PDF, audit
├── admin-panel/            # React + Vite web app
│   └── src/
│       ├── api/            # Axios calls per module
│       ├── components/     # Shared UI components
│       ├── pages/          # Route-level pages
│       ├── store/          # Zustand stores
│       └── hooks/          # Custom hooks
├── mobile/                 # Flutter Android app
│   └── lib/
│       ├── core/           # API client, auth, constants
│       ├── features/       # auth, scanner, sale_entry, dashboard, history
│       └── shared/         # Widgets, theme
└── AGENTS.md
```

---

## Current Build Slice

We are building in thin vertical slices. Check current status before starting:

**Slice 1 — Walking Skeleton** ← current  
- Backend: login endpoint + JWT + `GET /api/v1/me`  
- Admin panel: login page → calls backend → stores JWT  
- Flutter: login screen → calls backend → stores JWT in secure storage  
- Done when: all 3 login flows work against the real backend

**Slice 2 — Supplier Config + QR Test Tool**  
- Supplier CRUD + delimiter-based QR parser + QR test tool in admin panel  
- Other QR strategies (fixed-position, JSON) added AFTER collecting real QR samples

**Slice 3 — Sale Entry on Mobile**  
- QR scanner → parse → auto-fill form → save sale  
- All failure states handled (partial parse, unknown supplier, scan failure)

**Slice 4 — Visibility**  
- Sales list in admin + today's summary + salesman dashboard

**Slice 5 — User Management + Hardening**  
- User CRUD, role middleware, input validation, rate limiting

See `docs/TRD.md` for full slice detail.

---

## Key Domain Rules

- **QR Parser never throws** — always returns structured result with parsed fields + error list
- **Every QR failure has a fallback** — partial fill, manual supplier select, or full manual entry
- **Duplicate QR** = same QR hash + same calendar day → soft warning, always allow override, save `isDuplicate: true`
- **Salesman is never blocked** — any error state must have a manual entry path
- **Supplier auto-detection** uses regex → contains → prefix (in that order), never just `startsWith`
- **Sale edit lock** is Phase 2 — don't implement in Phase 1
- **Audit logs** are Phase 3 — don't implement in Phase 1

---

## API Design

**Base URL:** `https://yourdomain.com/api/v1`  
**Auth:** `Authorization: Bearer <jwt_token>` on all protected routes  
**Response format always:**
```json
{ "success": true, "data": {}, "message": "" }
{ "success": false, "error": "message", "code": "ERROR_CODE" }
```

Key endpoints (see TRD for full list):
- `POST /auth/login` — public
- `GET /auth/me` — protected
- `POST /sales` — salesman only
- `GET /sales` — auth (filtered by role)
- `POST /suppliers/parse-qr` — test QR parsing
- `GET /reports/*` — admin only

---

## Available MCP Tools

| Tool | When to Use |
|---|---|
| **Context7** | Before writing any library-specific code — fetch latest docs |
| **Figma MCP** | When a Figma URL is provided — read design, implement |
| **Filesystem** | Always check existing code before writing new code |
| **Sequential Thinking** | Complex multi-step features — plan before coding |

---

## Coding Standards

### General
- Read existing code before writing anything new
- Ask before adding new dependencies
- Write for readability — code is read more than written
- No hardcoded secrets — use environment variables
- Always provide `.env.example` with dummy values

### Backend (Node.js + Express)
- `async/await` only — no `.then()` chains
- Always validate input before hitting the database (express-validator)
- try/catch on all async functions — pass to error middleware
- Never log passwords, tokens, or sensitive data
- Always paginate list endpoints — never return unlimited results
- Use `.lean()` for read-only Mongoose queries
- Never return `passwordHash` in any response

### Frontend (React + Vite)
- Functional components + hooks only — no class components
- Handle all states: loading, error, empty, success
- Mobile-first responsive — test at 375px, 768px, 1280px
- Minimum 44px touch targets

### Flutter
- Riverpod `AsyncNotifierProvider` for all async state
- JWT stored in `flutter_secure_storage` — never SharedPreferences
- Dio interceptor attaches JWT to every request automatically
- On 401 → clear token → redirect to login
- Every screen handles: loading, error, empty states

### Git
- Commit format: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Never commit `.env` files
- Commit messages explain WHY, not just what

---

## Deployment (VPS)

- **Don't auto-deploy** — prepare scripts for manual review and run
- Backend: PM2 process manager, Nginx reverse proxy
- Admin panel: static build served by Nginx
- Flutter: APK file distributed directly (not Play Store in v1)
- SSL: Let's Encrypt via Certbot

---

## What I Don't Want

- Don't over-engineer — simplest solution that works
- Don't add libraries without asking
- Don't generate tests unless specifically asked
- Don't implement Phase 2/3 features during Phase 1 (reports, charts, audit logs, PDF, offline sync)
- Don't build everything at once — one slice at a time
- Don't make UI that looks generic — aim for clean, functional quality

---

## How to Start Every Task

1. Read `docs/PRD.md` and `docs/TRD.md` if unfamiliar with the project
2. Check which **Build Slice** is currently active (listed above)
3. Check existing code before writing anything new
4. Identify task type and use appropriate approach
5. Build incrementally — show progress, get confirmation, continue
6. Never assume — if unclear, ask ONE focused question

---

## When the Prompt is Vague

Ask ONE focused question before starting:

- "add auth" → "Which part — login route, JWT middleware, or Flutter login screen?"
- "fix the scanner" → "What error are you seeing and on which device?"
- "make it look better" → "Which screen and what specifically — spacing, colors, or layout?"

One question only. Then proceed.
