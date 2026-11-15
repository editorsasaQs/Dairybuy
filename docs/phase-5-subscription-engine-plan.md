# Phase 5 — Dairybuy subscription engine implementation plan

## Branch and baseline
- Base: `main` after the squash-merged Phase 4.5 COD reconciliation release.
- Branch: `feat/phase-5-subscription-engine`.
- Baseline merge commit: `815c51957e66d05b86e2c48e2c74a97bbe115821`.
- Phase 5 is a centrally managed Dairybuy subscription system; there is no seller marketplace or vendor app.

## Confirmed business contract
- Launch service areas remain limited to the configured Kolkata pilot areas; address serviceability is mandatory.
- Only milk can be subscribed to: standard cow/buffalo milk with customer-selected approved vendor, and canteen milk from the single configured canteen vendor.
- Non-milk grocery products are not subscription items.
- Plans are fixed 7-day or 30-day daily-delivery plans. No custom plan or auto-renew in this release.
- Quantities use the existing 0.5 L–10 L, 0.5 L increment rules; milk is delivered every scheduled day.
- Customer may change their selected milk vendor during an active subscription, with a future-effective date and immutable historical delivery snapshots.
- Customer can pause/resume, skip a future delivery date, and cancel subject to server-enforced cutoffs. The exact policy is defined below.
- Subscription payment is online-only. COD is prohibited for subscriptions.
- Subscription totals are authoritative server calculations in integer paise. A 30-day basket receives the existing flat ₹60 discount once per complete subscription basket; 7-day plans have no discount.
- Existing one-time order/COD payment behavior remains unchanged.

## Architecture audit findings
- Base schema already has `subscriptions`, `subscription_items`, `subscription_deliveries`, `subscription_skip_records`, `subscription_vendor_changes`, and `payments.subscription_id`.
- Existing price tables already store 7-day and 30-day plan price fields and the 30-day ₹60 discount constraint.
- Existing RLS policies are too broad to be trusted as the write boundary for subscription lifecycle operations; new writes must use narrow SECURITY DEFINER RPCs with empty search_path, explicit `auth.uid()` ownership checks, row locks, and authenticated-only wrappers.
- Subscription delivery rows currently do not link to an order, inventory reservation, or payment installment. These are additive Phase 5 schema changes.
- Existing one-time COD order/fulfillment flows must not be reused in a way that marks subscription payments as paid or allows subscription COD.

## Delivery and lifecycle policy for Phase 5
- A plan has 7 or 30 billable scheduled delivery days. Start date is the first delivery date; generation creates one unique delivery row per active scheduled day.
- Pause/skip only affects future, not-yet-assigned delivery dates. A skip consumes that plan day and does not create a make-up delivery. A pause suspends upcoming delivery generation; remaining plan days are shifted forward on resume so the customer receives the purchased number of delivery days.
- A customer cannot pause, skip, change vendor, or cancel a delivery after that delivery's configured cancellation cutoff or once assigned/out for delivery/delivered.
- Vendor changes are effective only from a future eligible delivery date. Existing delivery/order snapshots remain unchanged.
- Cancellation stops future deliveries; already delivered/fulfilled days remain in the delivery ledger. Refund calculation is not part of Phase 5 and no automatic refund or write-off is created.
- Daily generation is idempotent and unique by subscription/date/slot; it must never create duplicate delivery/order/reservation rows on retry.
- Payment state is separate from subscription state. A subscription cannot become active or generate deliveries until the full online payment is verified by a trusted server-side payment verification event. Client-supplied success flags are never trusted.
- Gateway integration, signed gateway webhook implementation, refunds and payout reconciliation remain Phase 6. Phase 5 will provide a fail-closed payment/activation contract and must not pretend to capture money.

## Implementation stages
### 5.1 — Schema and financial contract
- Add explicit duration, remaining delivery count, pause/resume state, payment status/reference, immutable per-line price/vendor snapshots, and delivery-to-order/reservation references where needed.
- Add strict constraints and indexes for fixed plans, valid milk-only items, unique daily delivery, no COD, non-negative balances, and referential integrity.
- Preserve existing historical rows; avoid destructive table rewrites.
- Add private lifecycle functions and authenticated wrappers with least-privilege grants.

### 5.2 — Subscription quote and creation
- Server-side quote validates active customer address/service area, slot, product variant, vendor approval/supply, milk type/volume, current effective vendor price, and exact 7/30-day totals.
- Creation is atomic/idempotent and snapshots selected items/prices/vendor and address/slot.
- 30-day ₹60 discount is applied once to the whole basket, not per item.
- Creation/payment intent remains pending until trusted online payment verification; no COD route.

### 5.3 — Lifecycle controls
- Implement pause, resume, skip, vendor change and cancellation with explicit cutoff checks, row locks, ownership checks and immutable audit records.
- Prevent edits to historical or already-assigned deliveries.
- Ensure pause/resume preserves remaining paid delivery days and cannot create duplicates.

### 5.4 — Daily delivery generation and operations
- Add idempotent scheduled generation for paid active subscriptions only.
- Link each generated delivery to immutable item/vendor/price/address snapshots and the stock reservation/fulfillment ledger.
- Integrate generated subscription deliveries with existing delivery assignment and fulfillment workflows without changing one-time COD semantics.
- Add owner/admin operational views and staff delivery visibility, with customer ownership isolation.

### 5.5 — Customer experience and verification
- Add customer plan quote/checkout, subscription list/detail, pause/resume/skip/vendor-change/cancel controls and delivery calendar.
- Add admin subscription operations and exception reporting.
- Add pgTAP security, pricing, idempotency, lifecycle/cutoff, inventory/concurrency tests and authenticated browser E2E.
- Require lint, typecheck, unit tests, build, fresh local Supabase migration + pgTAP, concurrency tests and all existing E2E jobs before merge.

## Explicit exclusions
- Online gateway vendor selection and live payment capture/webhook: Phase 6.
- Refunds, wallet, auto-renew, custom-duration plans, vendor portal, marketplace/seller workflows and live delivery tracking.
- No production Supabase changes, production deploy, DNS changes, or real-money payment calls in this phase.

## Critical release gate
The existing code has no trusted online payment gateway verification path. Therefore the subscription engine must remain fail-closed: it may calculate and persist pending subscription/payment intents, but it must not activate a paid subscription or generate deliveries until Phase 6 supplies a verified server-side payment transition. If the business requires subscriptions to be purchasable end-to-end before Phase 6, Phase 6 payment gateway work must be pulled forward and explicitly approved.
