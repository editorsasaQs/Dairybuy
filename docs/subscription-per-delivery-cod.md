# Subscription COD — per-delivery financial model

Status: approved design; implementation must remain forward-only and must not be applied to production until the clean-install and regression gates pass.

## Decision

Dairybuy subscriptions use **per-delivery cash on delivery**. A 7-day or 30-day plan is an operational delivery commitment, not a prepaid balance and not a single cash receivable.

## State model

- Subscription checkout is created through the existing authenticated, customer-scoped, idempotent RPC.
- The quote remains authoritative: serviceability, milk SKU/volume, vendor, current vendor price, delivery slot, fixed plan duration, discount and address/slot snapshots are validated server-side.
- Checkout creates the subscription in `active` state with a COD payment method and a pending subscription-level payment record representing the COD collection mode / plan agreement. It must not mark the subscription-level amount as captured.
- Activation is a server-side transaction. Client input must never be able to set active status, payment verification timestamps, payment status or delivery dates directly.
- Each generated delivery creates exactly one fulfilment order and exactly one order-scoped COD payment for that day's authoritative amount. The order starts with `payment_method='cod'`, `payment_status='pending'`; the payment starts with `gateway='cod'`, `method='cod'`, `status='pending'`.
- Delivery generation is idempotent per subscription/date/slot and is permitted for an active COD subscription without any online payment, gateway ID or captured-payment prerequisite.
- A delivery agent may record cash only for a delivered subscription order assigned to that agent. Owner/admin may record eligible collections.
- A collection amount equal to the order total is recorded as collected; a mismatch is disputed. Recording cash does not settle the payment.
- Owner/admin verification atomically marks the collection verified and captures that delivery's COD payment and order payment status. Rejection leaves payment pending and is audited.
- A later delivery has its own order, payment and collection lifecycle. Verifying one delivery must never settle another delivery or the subscription's aggregate plan amount.

## Existing workflow preservation

- One-time COD checkout, assignment, collection, verification, discrepancy correction, cash handover and financial reporting must retain their current semantics.
- Shared COD RPCs must accept both `one_time` and `subscription` orders only when the matching order/payment/assignment relationship is valid.
- Subscription assignment authorization is based on `subscription_deliveries.assigned_staff_id` and its linked fulfilment order; one-time assignment authorization remains based on `delivery_assignment_orders`.
- Subscription COD cash handover/reporting must be represented explicitly. Do not silently include subscription deliveries in one-time-only reports or one-time assignment batches.
- Subscription lifecycle operations (pause, resume, skip, cancel, vendor change) remain available and must not create, capture, refund or write off COD payments.
- No Razorpay, Cashfree, online payment intent, wallet, refund, webhook or gateway dependency is in this scope.

## Migration redesign requirements

1. Treat the corrected baseline SQL as a historical starting point only. Reconcile every migration file against the development migration ledger and actual schema before selecting the production sequence.
2. Rebuild a deterministic clean-install sequence with all required objects created before dependent functions, policies, triggers and grants.
3. Replace the online-only subscription payment constraint and paid-only order constraint with explicit COD subscription semantics. Preserve the one-time order constraints.
4. Replace the online-only subscription checkout RPC with a COD activation transaction while preserving its public function signature where practical, or update every application caller and contract test together.
5. Replace the paid-only subscription delivery generator. Ensure it inserts the daily order, order items, stock reservations and order-scoped pending COD payment in one transaction.
6. Extend collection recording and review authorization for assigned subscription deliveries without weakening one-time COD authorization.
7. Add subscription COD cash handover and owner/admin reporting/reconciliation, with separate scoping and date/area/staff filters.
8. Reconcile the pause/reservation release path with COD delivery rows and ensure skipped/unassigned deliveries do not strand stock.
9. Add RLS, grants, indexes, FK indexes, idempotency, race-condition and audit tests.
10. Keep all production migrations unapplied until the exact ordered sequence passes clean-install validation and regression tests.

## Required acceptance tests

### Checkout and activation
- Authenticated customer can create a valid 7-day and 30-day COD subscription.
- Same idempotency key replays the same subscription and payment record; concurrent duplicate requests do not create duplicates.
- Unauthenticated, non-serviceable address, inactive slot, invalid milk/vendor/SKU, stale/ambiguous price, invalid quantity, unsupported plan and invalid start date are rejected.
- Subscription is active only through the trusted checkout RPC; direct customer writes remain denied.
- No gateway payment ID, online payment intent or captured state is fabricated.

### Daily delivery generation
- Active COD subscription generates exactly one delivery order for the due Kolkata date.
- Generated order has COD + pending payment state and one matching pending COD payment.
- No captured online payment, gateway ID or payment verification timestamp is required.
- Re-running the generator creates no duplicate delivery, order, payment, inventory reservation or movement.
- Paused, cancelled, completed, not-yet-started, expired and skipped subscriptions do not generate an order.
- Insufficient inventory rolls back the complete generation transaction.
- One delivery's cash collection does not affect any other delivery.

### Cash collection and settlement
- Only assigned staff or owner/admin can record cash for a delivered subscription order.
- Unassigned staff, other customers and non-admin users cannot read or mutate another customer's financial records.
- Exact amount is collected; short/over collection is disputed.
- Recording never captures payment.
- Owner/admin verify captures only the linked daily order/payment and is idempotent.
- Owner/admin rejection is audited and leaves payment pending.
- Duplicate collection, changed amount/actor retry and concurrent review attempts are handled safely.

### Regression and security
- Existing one-time COD tests continue to pass unchanged.
- Existing order creation, cancellation, inventory, delivery, cash handover and financial report semantics remain intact.
- Subscription COD collections cannot be inserted into one-time-only handover batches.
- RLS and SECURITY DEFINER search_path/grants are tested for customer, staff, admin, owner and service role.
- No payment gateway, wallet or refund paths are invoked.

## Release gates

- Fresh database migration replay from the selected baseline.
- Development-schema reconciliation and migration-ledger comparison.
- SQL lint / migration validation.
- Automated database tests for every acceptance case above.
- Existing CI green.
- Production project remains unchanged until explicit deployment approval.
