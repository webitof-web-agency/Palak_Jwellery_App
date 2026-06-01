Exact root cause
I could not reproduce a backend schema incompatibility with the new supplier sections.
The concrete problem was that backend/src/controllers/suppliers.controller.js was catching every non-duplicate failure and collapsing it into SERVER_ERROR, so the admin UI had no field-level detail to show.
I hardened that path so validation/cast errors now return safe details instead of a generic failure, and I verified the structured supplier payload now round-trips through a live save/update check.
Files changed
`backend/src/controllers/suppliers.controller.js`
`admin-panel/src/pages/suppliers/SupplierFormPage.jsx`
`backend/scripts/check-supplier-business-settings-save.js`
Admin payload normalization changes
No supplier payload shape change was required to fix the save path.
The existing submit payload is already structurally valid for:
legacy categories
structured businessSettings.categories
businessSettings.purityOverrides
businessSettings.defaultWastagePercent
businessSettings.defaultStoneRate
businessSettings.qrNetTolerance
businessSettings.netWeightRule
businessSettings.stoneWeightRule
businessSettings.otherWeightRule
qrProfile
old qrMapping / detection fields
I only changed the form’s error extraction so validation details from the backend are shown to the user instead of the generic message.
Backend validation/schema changes, if any
No Supplier schema changes were needed.
I added controller-side error mapping for:
Mongoose ValidationError
Mongoose CastError
The controller now returns:
400 VALIDATION_ERROR with safe details for field-level issues
500 SERVER_ERROR only for true unexpected failures
Duplicate key handling remains unchanged.
Error visibility/logging changes
The supplier controller now logs save failures server-side with:
operation name
supplier code/name/id context
error name/message/code
validation details
stack trace
The admin supplier form now prefers backend validation details when displaying save errors, so if a nested field is actually invalid, the user sees the path instead of just “Failed to update supplier”.
Test/script added, if any
Added `backend/scripts/check-supplier-business-settings-save.js`
It verifies a representative supplier with:
legacy categories
structured categories
purity overrides
qrProfile
old qrMapping
It creates, reloads, updates, and deletes a test supplier against the live database.
Validation results
node --check backend/src/controllers/suppliers.controller.js passed
node --check backend/scripts/check-supplier-business-settings-save.js passed
npx eslint src/pages/suppliers/SupplierFormPage.jsx passed
node backend/scripts/check-supplier-business-settings-save.js passed with JWT_SECRET='dummy'
git diff --check passed, with only line-ending warnings
No parser scripts were run, because supplier parser logic was not changed in this fix
Manual retest checklist
Open Supplier Edit in admin
Save an existing supplier without changing anything
Save after changing only basic info
Save after adding/removing structured categories
Save after editing purity overrides
Save after editing QR template/profile fields
If a save fails, confirm the UI now shows a field-level message such as businessSettings.categories[0].wastagePercent: ... instead of only SERVER_ERROR
What was intentionally not changed
Visual layout / tabs
Mobile
Reports
Parser logic
Supplier data model/schema
Backend business settings rules
Any supplier field removal or renaming
Any hardcoded business values
Remaining risks/open questions
The admin form was already structurally sound in my live save check, so if you still see a save failure, the new validation details should now reveal the exact field.
One internal nuance remains: direct Mongoose model creation can keep qrNetTolerance: null, while the API controller normalizes blank tolerance to 0.005. That is not a save blocker, but it is worth keeping in mind if future scripts bypass the controller.
prompt.md and other older UI worktree files are still dirty but unrelated to this fix.

Edited 3 files
+235
-4
Undo
Review
backend/src/controllers/suppliers.controller.js
admin-panel/src/pages/suppliers/SupplierFormPage.jsx
backend/scripts/check-supplier-business-settings-save.js
