# Phase 5.7 — Owner/admin-managed deliveries and customer receipt confirmation

## Product interface boundary

Dairybuy launch has exactly two interfaces:
1. Customer app/website.
2. Owner/admin operations dashboard.

There is no delivery-agent app or staff-facing delivery/cash-handover page in this release. Legacy `/delivery/subscriptions` and `/delivery/cash-handover` URLs redirect to the account page.

## Delivery lifecycle

- Owner/admin may dispatch a scheduled subscription delivery without assigning a delivery agent.
- Owner/admin may mark a scheduled, assigned or dispatched delivery delivered directly. The server performs the valid dispatch transition first when necessary, then atomically completes fulfilment.
- Owner/admin may mark a scheduled, assigned or dispatched delivery failed; outstanding stock reservations are released by the trusted database function.
- A customer may confirm receipt only for their own subscription delivery after it has been marked out for delivery.
- All completion paths use the same database function to update the order and delivery status, consume the reservation exactly once, append the fulfilment movement, and update subscription completion counts.
- Customer confirmation cannot dispatch a delivery or confirm another customer's delivery.

## Per-delivery COD

- Each generated subscription delivery has its own pending COD payment.
- Owner/admin records the actual cash received after delivery is marked delivered.
- Exact cash match can be verified; a mismatch is disputed.
- Owner/admin can reject or resolve a disputed/rejected collection with a reason and corrected amount.
- Payment settlement remains separate from delivery completion.
- One-time COD flow remains unchanged.

## Security and tests

- Admin API rejects non-owner/admin users for all delivery operations.
- Customer receipt confirmation is ownership-checked inside the SECURITY DEFINER function, not trusted from client-supplied IDs.
- Database functions retain empty search_path and least-privilege wrappers.
- pgTAP covers dispatch authorization, customer ownership, scheduled failure and authenticated-only grants.
- CI includes the Phase 5.7 regression alongside the full Phase 4.5/5.6 database, concurrency, build and authenticated E2E suites.

## Release boundary

This is application/database implementation only. The development migration is applied after the ordered migration baseline is reconciled. Production database, domain, Vercel deployment and payment gateway remain untouched.
