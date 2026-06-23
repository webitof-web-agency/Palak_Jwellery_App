# Mobile Aayra Parser Checklist

Use this checklist on the mobile app after scanning an Aayra QR.

## 1. Parse mapping
- Open the locked scan session screen.
- Scan an Aayra QR.
- Confirm the item appears with:
  - item code
  - supplier
  - gross weight
  - stone weight
  - other weight = 0 when backend does not send it
  - net weight
  - raw QR preserved in saved session data

## 2. Locked supplier behavior
- Lock the same supplier that the QR belongs to.
- Scan again.
- Confirm no supplier mismatch badge appears.

## 3. Supplier mismatch behavior
- Lock a different supplier.
- Scan the Aayra QR.
- Confirm supplier mismatch warning appears.

## 4. Review warning
- Scan a QR that backend marks as requires review.
- Confirm the item shows a review / warning badge.
- Confirm the warning item is included in the review flow.

## 5. Session persistence
- Save the session.
- Reopen the saved session summary.
- Confirm the raw QR and warning state are still present in saved data.
