# Phase 4.5.3–4.5.5 — COD discrepancy, cash handover and financial reports

## Scope and financial invariants
- One-time COD only. Online gateway, wallet, subscription payment, payment refunds, cash refunds, write-offs and production deployment are excluded.
- All amounts are integer paise; report dates use the order delivery date (Kolkata business date).
- A COD payment is captured only through the existing owner/admin verification RPC when net cash retained exactly matches the authoritative order total.
- An adjustment is an evidence-backed recount/correction, not a waiver, write-off or refund. If the corrected amount remains different from the order total, the collection stays disputed and payment stays pending.
- Cash handover acceptance confirms physical cash received by the office; it does not itself settle the order payment.

## Implemented database surfaces
- `cod_collection_adjustments`: append-only old/new amount, reason, evidence reference, actor and timestamp.
- `resolve_cod_collection_discrepancy`: owner/admin-only, locks order/collection/payment, permits unresolved disputed/rejected COD collections only, records the adjustment and invokes the existing exact-match verification flow only when corrected net cash equals order total. Replays are idempotent.
- `delivery_cash_handovers` and `delivery_cash_handover_items`: staff/date/slot/area batch with server-computed expected total, physically received total, one-time collection linking and idempotency key.
- `submit_delivery_cash_handover`: authenticated staff can submit only their own assigned delivered COD collections; mixed date/slot/area batches and duplicate handovers are rejected.
- `review_delivery_cash_handover`: owner/admin accept/dispute; acceptance requires exact received-versus-expected cash.
- `delivery_cash_handover_adjustments` and `correct_delivery_cash_handover`: owner/admin recount correction for disputed handovers, with append-only evidence and re-review.
- `get_my_unhanded_cod_collections`: staff-scoped inbox of collections not yet assigned to a handover.
- `get_admin_cod_financial_report`: owner/admin-only detail report with delivery date, staff, area, slot, collection status, cash/order variance and handover status.

## Implemented application surfaces
- `/delivery/cash-handover`: staff collection selection and physical cash handover submission (₹ input converted to paise server-side).
- `/admin/orders/[id]`: discrepancy recount/correction form for disputed/rejected COD records.
- `/admin/finance/cod`: date/area/staff filtered financial dashboard, collection ledger, handover review, disputed batch recount and CSV export.
- `/admin/orders`: link to COD financial reporting.

## Security and regression
- New public tables inherit repository RLS bootstrap and have direct API grants revoked.
- RPC wrappers are authenticated-only; private implementations are inaccessible to API roles and use SECURITY DEFINER with empty search_path.
- CI adds a local disposable Supabase pgTAP contract test for new tables, RLS/grants, function hardening, ownership boundaries, exact-match settlement gate and staff handover/report RPC presence.
- The CI database job applies migrations only to a loopback local Supabase stack. No hosted Supabase project is targeted.

## Known release gate
This implementation branch must pass local migration application, pgTAP, lint, TypeScript, unit tests, Next.js build and the existing auth E2E workflow before merge. The pgTAP contract test includes structural/security assertions; it is not a substitute for authenticated end-to-end cash lifecycle fixtures. Production rollout still requires a separate approval and manual financial acceptance testing with controlled test accounts.
