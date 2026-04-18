Updated.

Files changed:

backend/src/config/env.js
backend/src/models/QrIngestion.js
backend/src/services/qrIngestion.service.js
backend/src/controllers/qr.controller.js
backend/src/scripts/test-qr-ingestion.js
What changed:

Added parsed.warnings: string[] to the ingestion layer.
Added warning checks for:
netWeight === 0 while grossWeight > 0
diamondWeight > grossWeight
unusually high values
unusually low values
Warnings do not block approval by default.
Added config toggle:
QR_WARNINGS_REQUIRE_REVIEW=true
when enabled, warnings push the record to needs_review
Persisted warnings in the ingestion model.
Included warnings in the normalized ingestion output returned by the API.
Extended the ingestion test harness with warning cases.
Updated logic:

parsed.errors still forces needs_review
parsed.warnings is visible in the API and UI
parsed.warnings only changes status if QR_WARNINGS_REQUIRE_REVIEW is enabled
Example behavior:

Valid Venzora QR with netWeight: 0
status: approved
warnings: ["netWeight is 0 while grossWeight is greater than 0"]
Suspicious QR with diamondWeight > grossWeight
status: approved
warnings:
netWeight is 0 while grossWeight is greater than 0
diamondWeight is greater than grossWeight
Validation:

Syntax checks passed on all changed files.
Test harness ran successfully and showed warnings without blocking approval.
If you want, I can next wire these warnings into the mobile/admin UI so the reviewer sees them before finalizing the QR.
