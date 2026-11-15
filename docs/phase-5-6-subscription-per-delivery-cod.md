# Phase 5.6 — Subscription COD per delivery

## Decision and financial boundary

Dairybuy subscriptions use per-delivery COD. The plan total is an operational schedule and pricing quote, not a prepaid balance or a single COD collection.

- Checkout validates the authoritative server-side quote and creates an active COD subscription with one subscription-scoped pending COD agreement row.
- No online gateway, payment intent, gateway ID, captured payment or payment verification timestamp is fabricated.
- The scheduler creates one fulfilment order and one order-scoped pending COD payment for each delivery date.
- Every delivery is financially independent. Cash collection and verification affect only the matching daily order/payment.
- Delivery staff can record cash only for their assigned, completed subscription delivery. Owner/admin can review, verify or reject.
- Exact cash amount is required for verification. A mismatch is disputed and remains pending until owner/admin discrepancy reconciliation.
- Staff cash handover and owner/admin financial reports include subscription COD collections, with assignment/date/slot/area scoping.
- One-time COD collection, review, discrepancy and handover authorization remain in place.

## Database implementation

Migration: `20261115230000_phase5_6_subscription_per_delivery_cod.sql`

It forward-patches the previously introduced online-only subscription checkout and generator using guarded source transformations. The migration aborts if the expected source fragments are not present. It:
1. permits COD on the subscription-level plan marker while retaining online-method validation for any separately scoped online subscription record;
2. permits subscription fulfilment orders to be COD/pending (or legacy online/captured);
3. activates subscriptions through the existing authenticated idempotent checkout RPC as COD;
4. removes the online-verification prerequisite from the address snapshot and daily generator;
5. creates a pending COD payment for each generated delivery order in the same transaction as its order, items and stock reservations;
6. extends COD collection, review, discrepancy correction, cash handover, staff unhanded-cash queue and admin financial report to subscription deliveries.

The daily payment is order-scoped (`payments.order_id`); the subscription agreement marker remains subscription-scoped (`payments.subscription_id`). The schema's exactly-one-parent constraint is preserved.

## Application integration

- `POST /api/subscriptions/checkout` uses the authenticated Supabase session and the existing quote/checkout RPC. Client cannot set the subscription status or financial state.
- Subscription quote UI now explains per-delivery COD and can activate a subscription.
- Assigned delivery staff can record cash after marking their subscription delivery delivered.
- Owner/admin subscription operations can verify or reject that delivery's COD collection.
- The existing secret-protected Kolkata-date scheduler remains the only path to generate daily subscription fulfilment.

## Tests and release gates

- `supabase/tests/database/phase5_6_subscription_per_delivery_cod.test.sql` checks the database contract, SECURITY DEFINER boundary, generator and cash lifecycle extensions.
- Authenticated browser regression uses a specific confirmation-message selector rather than an ambiguous generic status locator.
- CI runs the new pgTAP test alongside the existing Phase 4.5 COD, Phase 5 lifecycle, delivery, inventory and concurrency regressions.
- The migration must be replayed on a fresh local Supabase stack before merge.
- Development migration ledger/schema reconciliation remains required before applying to Dairybuy-dev.
- Production remains untouched until separate approval for ordered production migrations.
