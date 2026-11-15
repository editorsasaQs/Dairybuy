# Phase 5.6 — Subscription COD per delivery

## Decision and financial boundary

Dairybuy subscriptions use per-delivery COD. The plan total is an operational schedule and pricing quote, not a prepaid balance or a single COD collection.

- Checkout validates the authoritative server-side quote and creates an active COD subscription with one subscription-scoped pending COD agreement row.
- No online gateway, payment intent, gateway ID, captured payment or payment verification timestamp is fabricated.
- The scheduler creates one fulfilment order and one order-scoped pending COD payment for each delivery date.
- Every delivery is financially independent. Cash collection and verification affect only the matching daily order/payment.
- Owner/admin records cash only after marking the delivery complete, then verifies, rejects or resolves the collection. Customers can confirm receipt after the delivery is marked out for delivery.
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
- Owner/admin can dispatch or directly mark a delivery delivered, record the cash received for that delivery, and verify/reject/resolve the collection.
- Customer subscription dashboard exposes a receipt-confirmation action only while a delivery is out for delivery. Owner/admin subscription operations expose dispatch, completion, failure and per-delivery COD reconciliation.
- The existing secret-protected Kolkata-date scheduler remains the only path to generate daily subscription fulfilment.

## Tests and release gates

- `supabase/tests/database/phase5_6_subscription_per_delivery_cod.test.sql` checks the database contract, SECURITY DEFINER boundary, generator and cash lifecycle extensions.
- Authenticated browser regression uses a specific confirmation-message selector rather than an ambiguous generic status locator.
- CI runs the new pgTAP test alongside the existing Phase 4.5 COD, Phase 5 lifecycle, delivery, inventory and concurrency regressions.
- The migration must be replayed on a fresh local Supabase stack before merge. The follow-up Phase 5.7 migration enforces the two-interface delivery workflow: owner/admin operations plus customer receipt confirmation; there is no delivery-agent UI. The follow-up Phase 5.7 migration enforces the two-interface delivery workflow: owner/admin operations plus customer receipt confirmation; there is no delivery-agent UI.
- Development migration ledger/schema reconciliation remains required before applying to Dairybuy-dev.
- Production remains untouched until separate approval for ordered production migrations.
