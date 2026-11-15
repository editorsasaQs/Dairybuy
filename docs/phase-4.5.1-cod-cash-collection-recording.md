# Phase 4.5.1 — COD cash collection recording

Status: implementation candidate; merge only after CI is green.

## Authorization

- A delivery staff member can record cash only when the owner/admin has explicitly linked the order to that staff member's delivery assignment.
- Owner/admin can record a collection as an operational fallback.
- Customers and unrelated staff cannot record cash.
- Assignment membership is normalized in `delivery_assignment_orders`; the legacy `route_order jsonb` is not parsed as an authorization source.

## Recording contract

- Only delivered, one-time COD orders whose order payment status is still pending are eligible.
- The collector is always derived from `auth.uid()`; the caller cannot impersonate another collector or supply a collection timestamp.
- Positive amount, UUID idempotency key and optional note (max 500 chars) are validated.
- One initial collection record is allowed per order. Same actor + same idempotency key + same assignment is a safe retry.
- A different retry key or second collection attempt is rejected; corrections/discrepancies belong to the owner/admin reconciliation stage.
- Collection writes a `cod_cash_collection_recorded` audit log entry.
- Recording cash does not mark `payments.status` or `orders.payment_status` captured/paid. Owner/admin reconciliation is a separate phase.

## Files

- Migration: `supabase/migrations/20261115150000_phase4_5_1_cod_cash_collection_recording.sql`
- Regression: `supabase/tests/database/phase4_5_1_cod_cash_collection_recording.test.sql`

## Verification

- pgTAP security/contract regression is wired into the database-RBAC workflow.
- Existing lint, typecheck, unit, build, database, concurrency and authenticated E2E checks remain mandatory.
- No remote Supabase project or production deployment is changed by this PR.
