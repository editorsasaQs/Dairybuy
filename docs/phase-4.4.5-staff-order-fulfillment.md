# Phase 4.4.5 — Staff order operations and fulfillment lifecycle

Status: Phase 4.4.5.1–4.4.5.4 completed and merged (PRs #66, #67, #68); full required CI regression passed.
Base commit: `ac375483d5448bb71dbfa37ab5222c6974a2c093` (PR #66 squash merge)
Merged to `main`; latest Phase 4.4.5 merge: `4b8af5f4403031e6b9b9c97018201478b3616c64`.

Completed: PR #66 adds the owner/admin-only atomic COD status transition RPC, forward-only state machine, audited history event, direct UPDATE policy removal, and 22 pgTAP assertions. CI `verify`, `database-rbac`, and `auth-e2e` passed. The migration is present in Dairybuy-dev and its RPC grants were verified.

## Goal

Give authorized Dairybuy operations staff a safe, auditable way to process one-time COD orders from confirmation through delivery. This is a centrally managed operation, not a marketplace.

This phase does not implement subscriptions, online payments, wallet, refunds, COD collection/reconciliation, live tracking, or a seller/delivery-agent app. It must not alter production data or promote a production deployment.

## Reconciled current database facts

- Phase 4.4.4 PR #65 is squash-merged; merge commit is `88ebb582223d9ff3af5765b1c2ff4d4a27f9d6c9`.
- `orders.status` uses `order_status_enum`: `draft`, `pending_confirmation`, `confirmed`, `processing`, `out_for_delivery`, `delivered`, `cancelled`, `failed`.
- `order_status_history` stores `from_status`, `to_status`, `changed_by`, `note`, and `created_at`.
- PR #66 removed all direct `orders` UPDATE RLS policies. Order status changes now go through the owner/admin-only transition RPC.
- `user_roles` includes `owner`, `admin`, `manager`, `operations_staff`, and `customer`.
- `staff_permissions` and its permission enum exist, but the current authorization hardening deliberately limits effective staff access to owner/admin. The existing RBAC regression suite explicitly asserts that legacy `manager` and `operations_staff` roles do not gain staff access or permissions. Phase 4.4.5 must preserve this security boundary; do not activate granular legacy roles or change the helper semantics without a separate owner-approved RBAC decision.
- `delivery_assignments` currently represents a staff/date/slot/service-area assignment and has no direct `order_id` foreign key. Do not assume it already provides order-level assignment.
- COD collection records exist as a separate `cod_collections` table, but collection/verification is outside this phase.
- Dairybuy-dev now contains the Phase 4.4.4 cancellation and Phase 4.4.5 transition migrations. The transition RPC and grants were verified after PR #66 merged. Do not reapply these migrations.

## Approved invariants to preserve

- COD-only checkout; do not add or enable online payment methods.
- Order totals, item snapshots, vendor snapshots and payment state remain immutable through fulfillment status updates.
- No staff status update may bypass the database authorization/state-transition contract.
- Every successful transition writes exactly one order status-history row in the same transaction.
- Customer cancellation remains governed by the existing atomic Phase 4.4.4 RPC and configured Asia/Kolkata cancellation deadline.
- Delivery windows remain Morning 8 AM–11 AM and Evening 5 PM–9 PM; cancellation deadlines remain 7:30 AM and 4:30 PM. Do not rewrite delivery-slot rows.
- No live tracking or seller/marketplace workflow.
- Production Supabase and production deployment remain untouched.

## Proposed status transition contract

Only implement these forward transitions in the first release:

| Current status | Allowed next status |
|---|---|
| `pending_confirmation` | `confirmed` |
| `confirmed` | `processing` |
| `processing` | `out_for_delivery` |
| `out_for_delivery` | `delivered` |

- No skipped steps, backward transitions, duplicate history events, or direct client-side status writes.
- `cancelled` and `failed` remain terminal for this phase.
- Do not introduce a staff-initiated `failed` or cancellation workflow until its business handling and customer communication are specified.
- Marking an order `delivered` does not mark COD as collected or paid. Payment remains pending until the separate COD collection phase verifies the collection.

## Stage 4.4.5.1 — RBAC baseline and database transition contract (completed in PR #66)

1. Preserve the verified owner/admin-only authorization model from Phase 4.2; do not widen manager/operations_staff access.
2. Trace effective grants, RLS policies, role helpers and the `orders_update_staff` policy on Dairybuy-dev and in migrations.
3. Ensure order status changes are possible only through the narrowly scoped database RPC; direct authenticated UPDATE must not bypass the transition matrix.
4. Keep customer ownership and customer cancellation boundaries unchanged.
5. Add pgTAP tests for anonymous, customer, manager, operations_staff, admin and owner. Manager and operations_staff must remain denied unless a separate RBAC change is approved.

Debug/verification:
- Inspect function ownership, SECURITY DEFINER search_path, EXECUTE grants and RLS policy composition.
- Test forged user IDs and role/permission escalation.
- Assert customers and legacy staff roles cannot directly update order status, prices, payment state or history.
- Assert only owner/admin can execute the fulfillment transition RPC.

## Stage 4.4.5.2 — Admin order queue and detail workflow

1. Add owner/admin-only server-rendered order queue and detail views using existing Next.js App Router and Supabase SSR patterns.
2. Filters: delivery date, slot, service area and order status; stable pagination and no-store responses.
3. Show order number, customer contact/address, delivery slot, immutable item/vendor snapshots, quantities, total, COD-pending state and status history.
4. The current schema stores only `customer_address_id`, not an immutable address snapshot. Until Phase 4.4.6 adds that snapshot, label this clearly as the current saved address and do not claim it is the historical checkout snapshot.
5. Keep customer account/order history separate from staff views.

Debug/verification:
- Unit tests for filter parsing, pagination boundaries, invalid dates/statuses and malformed IDs.
- Browser tests for owner/admin access, manager/operations_staff denial and customer denial.
- Mobile and desktop responsive checks; keyboard navigation and accessible headings.

## Stage 4.4.5.3 — Secure status-update UI

1. Add a server-authorized action that calls only `transition_one_time_cod_order`; never update `orders.status` directly from the client.
2. Derive the next allowed transition from the current status; no skipped, backward, cancelled or failed transitions.
3. Require explicit confirmation for dispatch/delivery actions and accept only a bounded optional note.
4. Display the server's authoritative resulting status and idempotent result; handle stale/concurrent updates as recoverable conflicts.
5. Keep payment status pending after delivery; do not mark COD collected.

Debug/verification:
- API/action tests for anonymous, customer, manager, operations_staff, admin and owner.
- E2E tests for each valid transition, invalid skip, repeat submission, concurrent/stale status and status-history event count.
- Assert totals, payment state, item snapshots and inventory remain unchanged.

## Stage 4.4.5.4 — Full regression and development integration

- Run lint, TypeScript, unit tests and production build.
- Run database RBAC/pgTAP and concurrency suites against disposable local Supabase.
- Run authenticated Playwright E2E against disposable local Supabase.
- Review migration drift and generated database types.
- Verify the PR #66 migration is present in Dairybuy-dev; do not reapply it.
- Run Supabase security/performance advisors and triage findings without weakening intentional RPC guards.
- Vercel Preview QA is required where build quota permits; the current PR preview reached Ready.
- Open a PR and merge only after all required gates pass.

## Stage 4.4.5.3 — Admin order queue and detail workflow

1. Add owner/admin-only server-side order queue and detail views using existing Next.js App Router patterns.
2. Filters: delivery date, slot, service area and order status; stable pagination and no-store responses.
3. Show order number, customer/address snapshot, delivery slot, item/vendor snapshots, quantities, total, COD-pending state and status history.
4. Expose only the next valid transition returned by the server; hide actions for unauthorized roles and terminal states.
5. Require confirmation for dispatch/delivery actions and show explicit success/error states.
6. Keep customer account/order history separate from staff views.

Debug/verification:
- Unit/API tests for permission boundaries, filters, pagination, malformed IDs and server errors.
- Browser tests for owner/admin access, manager/operations_staff denial and customer denial.
- Mobile and desktop responsive checks; keyboard and accessible status announcements.

## Stage 4.4.5.4 — Full regression and development integration

- Run lint, TypeScript, unit tests and production build.
- Run database RBAC/pgTAP and concurrency suites against disposable local Supabase.
- Run authenticated Playwright E2E against disposable local Supabase.
- Review migration drift and generated database types.
- Apply reviewed additive migrations to Dairybuy-dev only after CI is green; verify applied migration history and read-only business invariants.
- Vercel Preview QA is required where build quota permits. A preview quota/rate-limit error is not a code pass.
- Open a PR and merge only after all required gates pass.

## Explicitly deferred

- Per-order delivery-agent assignment and route ordering: requires a separate schema/product decision because current `delivery_assignments` is group-level and has no order FK.
- COD cash collection, manager verification, daily reconciliation and payment settlement: Phase 4.5.
- Subscription order generation and recurring fulfillment: Phase 5.
- Refunds, wallet and online payment gateways: not part of the current COD-only launch scope.


## Completion record — Phase 4.4.5 (2026-11-14)

- PR #66: owner/admin-only atomic transition RPC and direct order UPDATE policy removal; merged after database/RBAC regression.
- PR #67: owner/admin order queue and detail pages; merged after verify, database/RBAC and auth E2E checks.
- PR #68: secure next-step status action, confirmation for dispatch/delivery, bounded internal note, recoverable stale/invalid transition errors; merged as `4b8af5f4403031e6b9b9c97018201478b3616c64`.
- PR #68 final head `aa7ca1022dbc4b8f930c2bb3572dc657bc46e5c8` passed all three required jobs: verify (lint, TypeScript, unit tests, build), database-rbac (RBAC/pgTAP and concurrency suite), and auth-e2e (isolated Supabase/Mailpit browser checks).
- COD remains pending after delivery; no cash collection, inventory consumption, payment gateway, refund, subscription, live tracking or delivery-agent role was added in Phase 4.4.5.
- Delivery slots remain Morning 8–11 AM and Evening 5–9 PM; cancellation deadlines remain 7:30 AM and 4:30 PM.
