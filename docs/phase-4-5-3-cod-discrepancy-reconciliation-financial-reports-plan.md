# Phase 4.5.3–4.5.5 — COD discrepancy, cash reconciliation and financial reports

## Delivery contract
- Scope is one-time COD only. No online gateway, wallet, subscription payment, refunds, cash refunds, or production/hosted database changes.
- All monetary values are integer paise. All reporting date boundaries are interpreted in Asia/Kolkata.
- Direct API table access remains revoked. All writes and sensitive reads use SECURITY DEFINER RPCs with an empty search_path and server-side owner/admin checks.
- Collection evidence is append-only. A financial discrepancy is never silently overwritten or auto-settled.
- COD payment is captured only when an authorized review confirms that net cash retained for the order exactly equals the authoritative order total. A short/over amount remains pending until the physical cash evidence is corrected and reviewed. No partial capture, write-off, or refund is introduced.

## Stage A — Phase 4.5.3 discrepancy resolution
1. Add immutable COD collection adjustment records (old/new amount, reason, evidence/reference, actor, timestamp, review state); retain the original collection row as the initial record.
2. Add owner/admin-only adjustment/review RPC with row locks on order, collection and payment; validate delivered one-time COD order, exactly one matching COD payment, positive paise amount, bounded reason/evidence, and a currently disputed/rejected collection.
3. Preserve the previous value in the adjustment ledger; update the current collection amount/status only through this RPC. Require net cash retained to equal order total before the final verify/capture transition. Rejection/review does not create a partial payment, waiver, or refund.
4. Add audit events for proposed correction, approval/rejection, and final settlement; make retries idempotent and prevent conflicting concurrent decisions.
5. Add owner/admin UI on order detail to inspect discrepancy history and submit/review a correction with reason and evidence.
6. Add runtime pgTAP scenarios, not only function-definition assertions: authorization, short/excess correction, exact settlement, no partial settlement, audit, idempotency, invalid lifecycle, and concurrency.

## Stage B — Phase 4.5.4 cash handover and reconciliation
1. Add cash handover batches keyed by delivery staff, Kolkata business date, delivery slot and service area, with submitted/accepted/disputed state and expected/received paise totals.
2. Add a handover-to-collection join table. A collection can belong to at most one accepted/submitted handover; each linked collection must belong to the same delivery staff/date/slot/area scope. Keep partial handover possible by allowing a batch to include a selected subset of that staff's unhanded collections.
3. Add staff submission RPC (authenticated assigned delivery staff only) and owner/admin accept/dispute RPC. Compute expected cash from linked collection rows inside the database; never trust client totals.
4. Require received amount to equal computed expected amount for acceptance. A mismatch is recorded as disputed; no payment/order settlement is inferred from a handover.
5. Add immutable batch event/audit trail, row locks, idempotency keys, duplicate prevention and race-condition tests.
6. Add owner/admin handover queue/detail UI showing staff, area, slot, linked orders, expected, received, variance and review history.

## Stage C — Phase 4.5.5 financial reporting
1. Add owner/admin-only read RPCs for date-range (Asia/Kolkata), delivery-area and staff filters.
2. Report daily COD totals split into recorded, verified/captured, disputed, rejected and pending; never double count a collection.
3. Report staff-wise collections and handovers, submitted/accepted/disputed batches, expected/received/variance, and outstanding collections not yet handed over.
4. Provide date-range filtering and CSV export with paise-to-INR formatting; exports include order number, collection reference, collector, timestamps, status, amounts, handover reference and variance, but exclude customer PII not needed for reconciliation.
5. Add report accuracy tests for empty ranges, boundary dates, multiple staff/areas, partial handovers, rejected/disputed records, and aggregate totals.
6. Add admin financial reports page with summary cards, tables, filters and export.

## Cross-cutting implementation and release gates
- Migration names use monotonic timestamp ordering after the merged Phase 4.5.2 migration.
- Update generated Supabase database types, docs and CI workflow.
- Add isolated local Supabase pgTAP tests and TypeScript/lint/build checks. Add concurrency shell tests for duplicate correction and duplicate handover submission.
- Verify RLS, grants, function ownership, SECURITY DEFINER/search_path, indexes on foreign keys and query plans for reporting filters.
- Keep all fixtures in local disposable Supabase transactions; do not run migrations against Dairybuy-dev, staging, or production from this workflow.
- Deliver one combined feature branch and PR for review. Merge only after all CI jobs are green. No Vercel production deployment.
