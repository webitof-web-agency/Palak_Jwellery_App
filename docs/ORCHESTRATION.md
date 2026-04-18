# Multi-Agent Orchestration Guide
## Jewellery Sales Management System

---

## Agent Roles

| Agent | Role | Strengths |
|-------|------|-----------|
| **Claude Code** | Supervisor + Backend + Inspector | Filesystem access, runs commands, inspects ALL output, owns backend + contracts, final say |
| **Codex** | Flutter + React UI | Fast code generation, Dart widgets, React components, boilerplate |
| **Gemini** | Logic + Algorithms + Review | QR parsing edge cases, algorithm design, backend logic review, security analysis |

### Who owns what

| Task type | Agent |
|-----------|-------|
| Backend API, models, middleware | Claude |
| JWT, auth, security logic | Claude |
| Cross-agent conflict resolution | Claude |
| API contract definition | Claude |
| Flutter screens + widgets | Codex |
| React UI components + forms | Codex |
| UI polish, design consistency | Codex |
| QR parser design + edge cases | Gemini |
| Algorithm review (parser, reports) | Gemini |
| Backend logic review | Gemini |
| PDF generation design | Gemini |

---

## Ownership Per Slice

| Slice | Claude | Codex | Gemini |
|-------|--------|-------|--------|
| **1** | Auth routes, JWT, User model | React login, Flutter login | — |
| **2** | Supplier model, QR parser, CRUD | React supplier UI, QR test tool | QR parser edge case review |
| **3** | Sale model, POST /sales, duplicate detection | Flutter scanner + sale entry form | Review parser failure states + contract gaps |
| **4** | Aggregation pipelines, GET /sales | React dashboard + Flutter list | Review aggregation logic |
| **5** | Rate limiting, validation | User management UI | Security + validation review |

---

## 3-Agent Workflow Per Slice

```
1. Claude builds backend → defines API contract
2. Claude issues BRIEF to Codex (Flutter/React) + BRIEF to Gemini (logic review)
3. Codex and Gemini work in parallel
4. Both deliver back to user
5. User pastes both deliveries to Claude
6. Claude inspects both, fixes gaps, resolves conflicts
7. Claude marks slice done → next slice
```

---

## Inspection Loop (agents check each other)

```
Codex builds UI
  → Claude inspects: do contracts match? are states handled? no scope creep?
  → Gemini inspects: are failure states logically complete? any edge cases missed?

Gemini reviews parser/logic
  → Claude applies fixes to actual code files
  → Claude verifies fix works in real environment

Claude builds backend
  → Gemini reviews: security gaps? logic errors? missing validations?
  → Codex reviews: does the response shape work for the UI it built?
```

---

## Brief Format (Claude → Codex or Gemini)

```
SLICE [N] BRIEF — [Agent name]

Context: [what Claude already built]

Endpoints available:
- METHOD /path
  Request:  { field: type }
  Response: { field: type }
  Errors:   { code: reason }

Your task:
- [specific task]
- File path: [where to put it]

DO NOT build:
- [out of scope items]

Approved packages only:
- [package@version]

Inspect and report any gaps in:
- [what to look for — for Gemini reviews]
```

---

## Delivery Format (Codex/Gemini → Claude)

```
SLICE [N] DELIVERY — [Agent name]

Files created/changed:
- path/to/file

API contracts assumed:
- POST /endpoint → { shape }

Gaps found / assumptions made:
- [list]

How to test:
- [steps]
```

---

## Anti-Drift Rules (enforced by Claude at every sync)

1. No Phase 2/3 features during Phase 1 slices
2. No unapproved packages
3. API contracts must match exactly — field names, error codes, response shape
4. One slice at a time — no slice starts until previous is verified
5. No hardcoded URLs — all from env vars / constants
6. QR parser never throws — always returns structured result

---

## Parallel Work Windows

```
Slice 3:
  [Claude]  Sale model + POST /sales + duplicate   ─────────┐
  [Codex]   Flutter scanner + sale entry form       ─────────┤ sync → Claude inspects both
  [Gemini]  Review parser failure states + gaps     ─────────┘

Slice 4:
  [Claude]  Aggregation pipelines + GET /sales      ─────────┐
  [Codex]   React dashboard + Flutter sales list    ─────────┤ sync
  [Gemini]  Review aggregation logic correctness    ─────────┘

Slice 5:
  [Claude]  Rate limiting + validation              ─────────┐
  [Codex]   User management UI                      ─────────┤ sync
  [Gemini]  Security + input validation review      ─────────┘
```

---

## Token Efficiency Rules

| Task | Context needed | Why |
|------|---------------|-----|
| Codex: Flutter screen | Minimal — brief + prior screen pattern | Widgets repeat |
| Codex: React form | Minimal — just API contract | Pure UI |
| Gemini: Parser review | Parser file + TRD section + real QR samples | Needs real data |
| Gemini: Logic review | Specific file only | Focused analysis |
| Claude: Schema design | Full — needs all related models | Relationships |
| Claude: Auth/middleware | Full — global impact | Security is cross-cutting |

**Rule:** Give each agent only what it needs. Don't dump the full TRD into every prompt.
