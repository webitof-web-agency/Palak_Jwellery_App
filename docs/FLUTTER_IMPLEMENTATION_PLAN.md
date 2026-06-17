# Flutter Implementation Plan

## 1. Executive Summary

This document translates the final Stitch/Figma V2 salesman flow into a native Flutter implementation plan.

The implementation must be manual Flutter widgets only.
- No generated HTML/CSS in the mobile app layer.
- No web-style preview reuse.
- No batch-first salesman MVP.

The redesigned salesman MVP is centered on a single scan-session workflow:
1. Dashboard
2. Customer Selection
3. Add New Customer Bottom Sheet
4. Customer Profile
5. Scan Session Setup State
6. Active Scan Session State
7. Finish Scan Confirmation
8. Sales Summary
9. My Sales / Scans
10. Back Confirmation Modal

This plan is about aligning the Flutter app to that flow and tightening the reusable architecture around it.

## 2. Final Mobile Flow

### 2.1 Primary Flow

1. Dashboard
2. Start Scan
3. Customer Selection
4. Add New Customer Bottom Sheet when needed
5. Customer Profile
6. Scan Session Setup State
7. Active Scan Session State
8. Finish Scan Confirmation
9. Sales Summary
10. My Sales / Scans
11. Back Confirmation Modal when leaving unsafe draft state

### 2.2 What Is De-Prioritized

These are not primary salesman MVP entry points:
- My Batches
- inventory concepts
- manual entry as a dashboard CTA
- batch detail as a first-class salesman entry point
- older batch-first language in the primary navigation

The app may still keep compatibility code where needed, but the MVP UX should not lead with those surfaces.

## 3. Current Flutter Baseline

The live Flutter app already contains:
- `mobile/lib/shared/theme/app_theme.dart`
- `mobile/lib/main.dart`
- `mobile/lib/features/sale_entry/*`
- `mobile/lib/features/scanner/*`
- `mobile/lib/features/sessions/*`
- `mobile/lib/features/batches/*`
- `mobile/lib/features/history/*`

The right approach is incremental refinement:
- keep the current Riverpod and GoRouter architecture
- reuse the existing scan/sale form logic where it already helps
- add reusable UI primitives before adding new screen-specific code
- move the flow toward a single scan-session mental model

## 4. Design System Tokens

### 4.1 Base Direction

Use the dark gold jewelry brand direction as the primary mobile visual language:
- background: deep navy / near-black
- surfaces: layered charcoal / navy cards
- primary accent: gold
- typography: Outfit for titles and Inter for body/data
- shape: rounded 12px cards, buttons, and inputs
- tone: minimal visual noise, premium, calm, high contrast

### 4.2 Tokens To Formalize

The Flutter theme should expose explicit token groups:

- `AppColors`
  - background
  - surface
  - surfaceAlt
  - surfaceStrong
  - border
  - borderStrong
  - textPrimary
  - textSecondary
  - textMuted
  - accent
  - accentSoft
  - success
  - warning
  - danger

- `AppSpacing`
  - xs
  - sm
  - md
  - lg
  - xl
  - screenPadding
  - sectionGap

- `AppRadius`
  - xs
  - sm
  - md
  - lg
  - pill

- `AppShadow`
  - card
  - elevated
  - modal

- `AppTypography`
  - display
  - heading
  - title
  - body
  - label
  - numeric

- `AppMotion`
  - fast
  - normal
  - slow

### 4.3 Token Use Rule

Do not hardcode colors, radii, or spacing inside feature widgets unless there is a true one-off need.

Use tokens for:
- headers
- cards
- buttons
- input borders
- status pills
- warning banners
- live totals
- custom override badges

## 5. Reusable Widget Architecture

Build the UI around reusable widgets rather than duplicated screen-specific markup.

### 5.1 Core Primitives

Recommended shared widgets:
- `AppCard`
- `SectionHeader`
- `PrimaryActionButton`
- `SecondaryActionButton`
- `TertiaryActionButton`
- `StatusPill`
- `InfoPill`
- `WarningBanner`
- `InlineErrorBanner`
- `LockedField`
- `TokenInput`
- `TokenDropdown`
- `MetricCard`
- `TotalsStrip`
- `BadgeRow`
- `DraftRecoveryBanner`
- `CustomerPickerTile`
- `CustomerBottomSheet`
- `ItemCard`
- `ScanStateHeader`
- `ReturnRequestChip`
- `CustomOverrideBadge`

### 5.2 Scan Session Widgets

The scan-session UI should be made from small pieces:
- customer header block
- supplier lock block
- karat selector
- purity lock / custom override block
- wastage lock / custom override block
- live totals card
- supplier-wise item chips
- item cards
- warning banners
- finish confirmation footer

### 5.3 History and Summary Widgets

Re-use list and card primitives for:
- scan history rows
- summary totals
- share/download placeholders
- item tables

## 6. Navigation Flow

### 6.1 Route Model

Keep GoRouter, but align routes to the V2 flow:
- `/dashboard`
- `/customers`
- `/customers/new`
- `/customers/:customerId`
- `/scan-session`
- `/scan-session/confirm`
- `/summary/:sessionId`
- `/sales-scans`
- `/back-confirmation`

### 6.2 Navigation Rules

- Dashboard must show `Start Scan` as the primary CTA.
- No `My Batches` CTA in the salesman MVP.
- No dashboard manual-entry CTA as a primary action.
- Customer selection should be the first meaningful step after starting a scan.
- Scan setup and active scanning are two states of the same scan-session flow.
- Final save returns to summary or history, not to a batch screen.

## 7. Customer Model

### 7.1 Required Data

Customer details are required in the V2 flow:
- name
- phone
- area / location

Email is optional.

### 7.2 Selection Flow

Customer selection should support:
- search
- recent customers
- add new customer
- view customer profile

### 7.3 Customer Profile

Customer profile should show:
- name
- phone
- area / location
- optional email
- recent scan-session references
- any relevant notes

## 8. Scan Session State

### 8.1 One Screen, Two States

The scan session is one screen with two states:
- `unlocked setup`
- `locked active scanning`

### 8.2 Setup State

Before scanning starts, the user sets and locks:
- supplier
- karat
- purity
- wastage

### 8.3 Active Scanning State

After locking:
- scanning begins
- live item cards appear
- totals update in real time
- supplier-wise item count chips are visible
- the locked values remain visible as context

### 8.4 State Model

Create a dedicated session draft state that tracks:
- customer
- supplier
- karat
- selected purity
- original purity
- selected wastage
- original wastage
- parse result
- warnings
- override flags
- live totals
- per-supplier item counts
- save status

### 8.5 Riverpod Structure

Use Riverpod providers for:
- auth session
- backend status
- theme preset
- customer lookup
- supplier lookup
- karat options
- scan-session draft
- scan history
- summary data

## 9. Override Rules

### 9.1 Supplier, Karat, Purity, Wastage

The user must lock supplier, karat, purity, and wastage before active scanning begins.

Purity and wastage may be overridden, but the UI must always show:
- `Custom` badge
- original value
- selected value
- source of the override

### 9.2 Visible Badge Rules

Show badges for:
- `Parsed`
- `Custom`
- `Locked`
- `Warning`
- `Duplicate`
- `Needs Review`

### 9.3 Admin Approval Rule

The salesman can request a return/deletion.
Admin approves the request later.

This should be reflected as a pending review state, not as an immediate destructive action.

## 10. Live Totals While Scanning

### 10.1 Totals To Show

Update these live as the session evolves:
- gross weight
- stone weight
- other weight, if relevant
- net weight
- purity percent
- wastage percent
- fine weight
- stone amount, if relevant

### 10.2 Supplier-Wise Chips

Show supplier-wise item count chips in active scanning.

### 10.3 UX Rule

The totals strip should always answer:
- what has been scanned
- what is locked
- what remains in the session
- what the final math looks like

## 11. Warning States

### 11.1 Required Warnings

Handle these at minimum:
- partial parse
- unknown supplier
- duplicate QR
- supplier mismatch
- missing required customer details
- locked state violation
- backend unavailable
- save failed

### 11.2 Presentation

Use:
- inline hints for normal guidance
- amber banners for caution
- red banners for blocking issues
- small chips for metadata

Warnings must tell the user the next action.

## 12. Final Save Flow

### 12.1 Sequence

1. User starts a scan session
2. Customer is selected or created
3. Supplier and locks are set
4. User scans items
5. Live totals update
6. User taps `Finish`
7. Confirmation screen shows the final state
8. User confirms save
9. Draft is cleared after successful save

### 12.2 Save Rules

- save must be idempotent
- duplicate QR should warn, not hard-block
- failed save should preserve the draft
- submit should be explicit
- success should go to summary, then history

## 13. Screen-by-Screen Plan

### 13.1 Dashboard

The dashboard should contain:
- `Start Scan` primary CTA
- customer / scan-session entry shortcuts
- My Sales / Scans shortcut
- today summary card
- draft recovery banner if needed

### 13.2 Customer Selection

The customer selection screen should:
- search customers
- show recent customers
- allow creating a new customer
- open customer profile

### 13.3 Add New Customer Bottom Sheet

Required inputs:
- name
- phone
- area / location
- email optional

### 13.4 Customer Profile

Show customer details and provide the link back to the scan-session flow.

### 13.5 Scan Session Setup State

This is the unlocked setup state of the single scan-session screen.

### 13.6 Active Scan Session State

This is the locked active state:
- live totals
- supplier-wise count chips
- scanned item cards
- warnings and override badges

### 13.7 Finish Scan Confirmation

The confirmation screen should:
- summarize totals
- show warnings
- show customer and locked values
- confirm the final save

### 13.8 Sales Summary

Sales Summary should show:
- customer
- totals
- share/download placeholders
- filters
- item list/table

### 13.9 My Sales / Scans

This is the read-only history surface for finalized or saved scan sessions.

### 13.10 Back Confirmation Modal

Protect unsaved setup or scanning state with a clear discard/continue choice.

## 14. Draft Recovery

### 14.1 Goal

If the app is closed or backgrounded mid-session, the salesman should be able to resume the draft.

### 14.2 What To Persist

Persist a compact draft snapshot with:
- customer
- supplier
- karat
- original purity and wastage
- selected purity and wastage
- raw QR
- scanned items
- live totals
- override flags
- current state
- last updated timestamp

### 14.3 Storage Recommendation

Use a lightweight local persistence approach for v1.
The payload should stay compact and structured.
Clear it only after confirmed final save.

### 14.4 Recovery UX

If a draft exists:
- show a resume banner
- show last updated time
- allow discard
- do not block starting a new session

## 15. Mapping To Existing Flutter Files

The current app should be extended, not rewritten.

Likely touch points:
- `mobile/lib/shared/theme/app_theme.dart`
- `mobile/lib/main.dart`
- `mobile/lib/features/sale_entry/*`
- `mobile/lib/features/scanner/*`
- `mobile/lib/features/sessions/*`
- `mobile/lib/features/history/*`
- shared widgets under `mobile/lib/shared/widgets/*`

## 16. Slice-by-Slice Implementation Task List

### Slice 1: Theme tokens + shared widgets
- formalize spacing, radius, shadow, and typography tokens
- add reusable card/button/input/pill widgets
- add warning and override badge primitives

### Slice 2: Dashboard redesign
- replace legacy primary actions with `Start Scan`
- remove `My Batches` from salesman MVP UI
- add scan-session and history shortcuts
- add draft recovery banner area

### Slice 3: Customer selection + add customer bottom sheet
- build the customer search screen
- build customer profile screen
- add the required customer bottom sheet fields
- wire recent customers and create-new flow

### Slice 4: Scan session state model and setup lock
- introduce a dedicated scan-session draft model
- split setup and active scanning states
- lock supplier, karat, purity, and wastage before scanning

### Slice 5: Active scanner UI + scanned item cards + live totals
- build active scanning state UI
- show live totals and supplier-wise item count chips
- render scanned item cards
- surface warnings and custom badges

### Slice 6: Finish confirmation + save flow
- add finish confirmation screen
- confirm totals and warnings before save
- keep save idempotent and preserve draft on failure

### Slice 7: Sales summary + share/download placeholder
- build sales summary screen
- add customer, totals, filters, and item list
- show share/download placeholders without implementing export logic yet

### Slice 8: My sales/scans history
- refine the history list
- keep it read-only
- ensure it reflects saved scan sessions clearly

### Slice 9: Draft recovery + back confirmation
- persist the active scan draft
- restore it on app launch/resume
- add back confirmation modal for unsafe exit

### Slice 10: Warnings, duplicate handling, override badges
- normalize duplicate warnings
- show `Custom` badges for purity and wastage overrides
- show supplier mismatch and lock-state warnings clearly
- add admin-request labels for return/deletion

## 17. Risks

- If batch terminology stays visible too often, the new scan-session flow will feel inconsistent.
- Draft recovery can become intrusive if it restores too aggressively.
- Locking supplier/karat/purity/wastage must be obvious or users will think the app is broken.
- Too many chips and badges can overwhelm small screens if the hierarchy is not strict.

## 18. Open Product Questions

- Should `Sales Summary` be a separate screen or a modal-style review stage?
- Should customer profile be editable in place, or only through the add-customer sheet?
- Should return/deletion requests be shown in history immediately, or only after admin approval?
- Should the dashboard offer one universal `Start Scan` action, or separate entry points for setup and resume?
- Should draft recovery auto-restore on app start, or ask for confirmation first?

