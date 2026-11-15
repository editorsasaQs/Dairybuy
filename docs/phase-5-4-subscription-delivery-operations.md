# Phase 5.4 — Paid subscription delivery generation and operations

## Implemented
- A service-role-only, date-scoped generator creates one daily subscription delivery and one linked fulfilment order for each eligible subscription.
- Generation is fail-closed: the subscription must be active, have a server-set payment verification timestamp, and have a captured non-COD gateway payment with a gateway payment ID.
- Subscription/date/slot uniqueness, subscription row locks with `SKIP LOCKED`, and atomic transactions protect retries and concurrent scheduler runs.
- Generated orders use the subscription's checkout-time address snapshot, not a subsequently edited saved address.
- Each order snapshots item/product/variant/vendor values and the vendor effective on that delivery date.
- The prepaid 30-day ₹60 basket discount is allocated as ₹2 per purchased delivery day. The daily delivery ledger records gross, discount and net value, including skipped days.
- Inventory is reserved atomically per selected 1 L and 500 ml SKU pack count, in deterministic SKU order, with safety stock preserved and immutable movement ledger entries.
- Owner/admin can assign deliveries to an active staff role. Assigned staff or owner/admin can dispatch and complete; only owner/admin can mark a delivery failed.
- Completion consumes reserved stock once. Failure releases reservations without consuming on-hand stock. Customer skip and cancellation release stock for generated but undispatched deliveries.
- The owner/admin inventory reservation reconciliation now includes subscription orders without treating them as COD.
- Added authenticated RPC types and a dedicated pgTAP regression suite to CI.

## Operational rules
- Scheduler calls `public.generate_subscription_deliveries(p_delivery_date)` using the service-role credential, once per Kolkata delivery date. The function is not executable by anon or authenticated users.
- It processes subscriptions whose `next_delivery_date` exactly matches the requested date. Paused, cancelled, pending-payment, unverified or uncaptured-payment subscriptions are never generated.
- A stock shortfall or missing inventory row aborts the whole subscription delivery transaction; no partial order or reservation is retained.
- A failed delivery is surfaced as an operational exception and releases its reservation. This phase does not invent a make-up delivery or refund policy; owner/admin resolution is required.
- No COD, cash collection, payment capture, refund, wallet or production deployment is introduced.

## Next
Phase 5.5: customer subscription quote/checkout and history/calendar UI, admin delivery operations and exception views, then full authenticated browser E2E and lifecycle regression.
