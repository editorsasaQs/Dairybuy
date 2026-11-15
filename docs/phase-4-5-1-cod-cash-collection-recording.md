# Phase 4.5.1 — COD cash collection recording

## Authorization rule (confirmed)
- Delivery staff may record cash only for an order linked to their own active/completed delivery assignment.
- Owner/admin may assign orders to delivery assignments and may record eligible collections.
- Customers and unassigned staff cannot read or write collection/assignment records directly.
- Only owner/admin verification in a later Phase 4.5 slice may settle the COD payment.

## This implementation slice
- Adds a normalized `delivery_assignment_orders` relation rather than trusting free-form `delivery_assignments.route_order` JSON.
- Adds an owner/admin-only `assign_cod_order_to_delivery` RPC. It checks order type, COD method, order lifecycle, assignment date, slot, service area and assignment status.
- Adds `record_cod_cash_collection`. It requires a delivered one-time COD order and a matching pending COD payment.
- Delivery staff are authorized only through the explicit assignment relation; owner/admin can record an eligible order.
- A matching amount is stored as `collected`; short/over collection is stored as `disputed`.
- Same actor + same amount retry is idempotent. A different amount/actor cannot overwrite the first record.
- Every assignment and collection write appends an audit log.
- Recording cash does not mark the payment captured. Financial settlement waits for owner/admin verification.

## Deliberately not included
- Owner/admin verify/reject/close workflow.
- Cash handover batches, daily reconciliation and financial reporting.
- UI for assignment or collection recording.
- Online gateway, wallet, refunds or subscription payment.

## Verification
The pgTAP regression asserts table isolation, function security, role boundaries, delivered-order requirement, discrepancy classification, audit logging and the payment-settlement boundary. CI also runs the existing full lint/typecheck/unit/build, database/RBAC/concurrency and Auth E2E suites.

No hosted Supabase project or production data is modified by this migration. Apply only after PR review and successful isolated local CI.
