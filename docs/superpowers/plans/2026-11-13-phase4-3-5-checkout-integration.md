# Phase 4.3.5 — Authenticated Checkout Integration & Browser Coverage

Date: 2026-11-13
Status: Planned; no application behavior or database has been changed by this plan.

## Goal

Prove the merged read-only `POST /api/checkout/validate` flow against a disposable local Supabase stack and a real browser session before Phase 4.4 is allowed to create orders. Unit tests with mocked Supabase builders are not sufficient to prove RLS, cookie propagation, ownership isolation, or the actual database query shape.

## Scope

- Exercise the route through a real authenticated Supabase user session and Next.js server cookies.
- Use only disposable local Supabase in CI; never use Dairybuy-dev or production for automated test writes.
- Seed or create the minimum required service-area, pincode, delivery-slot, product, variant, vendor/mapping, cart and cart-line records using repository-owned test fixtures.
- Prove checkout validation is read-only.
- Keep payment provider work out of this phase. The current launch payment method is COD only; Razorpay and online payment methods are deferred.

## Non-goals

- No order or order-item creation.
- No payment intent, payment transaction, payment webhook, Razorpay SDK, keys, or signature validation.
- No refund, inventory reservation, subscription, or delivery-agent workflow.
- No production migration, production deployment, or remote database write.

## Approach

1. Extend the existing isolated Supabase + Mailpit + Playwright CI job rather than introducing a second environment. The existing job starts a local stack, validates loopback-only API URL, builds Next.js against it, starts the production server, and runs browser tests.
2. Add a focused checkout integration test harness that signs up and confirms users through the local Mailpit flow, then calls the real API using the browser's authenticated context. Use a second user to prove cross-customer address isolation.
3. Create deterministic fixtures in the disposable database. Prefer authenticated user-scoped writes where RLS permits; use repository-local seed/SQL setup only for catalogue/configuration data that customers cannot create. Never introduce a service-role key into application runtime or browser tests.
4. Assert database state before and after validation to prove that validation does not create or mutate orders, payments, refunds, inventory, carts, or cart lines.

## Required test cases

### Authentication and ownership

- Anonymous request returns 401 and does not disclose whether address/cart identifiers exist.
- Customer A can validate only their own address and active cart.
- Customer A submitting Customer B's address ID receives a field-level address error; no cart data is returned.
- Spoofed `customerId`, totals, prices, slot labels, and client-supplied payment fields are ignored; server identity and database rows remain authoritative.

### Serviceability and delivery rules

- Active DB-backed service-area/pincode mapping succeeds.
- Inactive, missing, malformed, and out-of-area PINs fail closed.
- Inactive or unknown delivery slot is rejected.
- The selected active slot's database times/cutoff are used; client labels/times cannot override them.
- Same-day cutoff boundary is tested for morning 07:00 and evening 16:00 in `Asia/Kolkata`, including just-before and exact cutoff.
- Invalid and past delivery dates are rejected.

### Cart and pricing

- Empty or missing active cart is rejected.
- Cart lines with missing/inactive product or variant are rejected.
- Milk lines require a supported milk type and valid quantity.
- Vendor-specific product lines are revalidated against current active vendor mapping and current price.
- A changed/stale price is reflected in the returned server total or rejected according to the existing database-cart service contract; browser-supplied totals are never used.
- Integer-paise totals are consistent with the database-cart service, with no duplicate generic delivery fee.

### Read-only guarantees

- Snapshot relevant row counts and cart values before the request.
- After valid and invalid validation attempts, assert no new order, order item, payment, refund, inventory movement, or subscription exists.
- Assert cart and cart-item rows are unchanged.
- On simulated database/configuration failure, route fails closed with 503 and no mutation.

## Implementation tasks

1. Inspect current migrations, RLS policies, seed data and generated database types for exact required columns, enum values, and FK dependencies. Record fixture strategy before writing tests.
2. Add a dedicated Playwright spec (suggested path: `e2e/checkout-validation.spec.ts`) with reusable local-user signup/confirmation helpers extracted without breaking existing auth coverage.
3. Add fixture setup/cleanup helpers that use only the disposable local Supabase URL. Explicitly assert loopback host before any test setup write.
4. Add the ownership, serviceability, slot/cutoff, cart/live-price, and no-write scenarios above.
5. Wire the new spec into the existing `auth-e2e` workflow job (or rename the job to reflect broader customer-flow coverage); preserve its local-only URL guard and always-stop cleanup.
6. Run the new spec first, then the full unit suite, lint, typecheck, production build, database-RBAC pgTAP and all existing browser auth tests.
7. Review the PR diff for secrets, service-role usage, accidental remote Supabase references, and any order/payment writes.
8. Create a preview deployment and smoke-test only the preview. Do not promote or deploy production.

## Acceptance gates

- All required cases above pass on the final PR head.
- CI uses only disposable local Supabase; logs prove the API URL is loopback-only.
- Existing auth browser tests remain green.
- No production or Dairybuy-dev database changes are made.
- No order/payment/refund/inventory/subscription writes are introduced by validation.
- COD-only policy remains documented: Razorpay and online methods are not available in the current launch scope.

## Next phase dependency

Phase 4.4 secure COD order creation/order history may begin only after Phase 4.3.5 is merged. Before implementation, inspect order/payment schema and define COD order status, payment status, cash collection by delivery agent, cancellation and idempotency behavior. Do not assume COD is paid when an order is placed. Online payment providers remain deferred unless the owner explicitly reopens that scope.
