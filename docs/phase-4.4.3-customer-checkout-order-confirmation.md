# Phase 4.4.3 — Customer checkout and COD order confirmation

## Goal
Connect the existing authenticated checkout preview and the Phase 4.4.2 transactional COD order endpoint to a real customer journey. Customers can select a saved address, active DB delivery slot and delivery date, review the server-calculated amount, place a COD order, and view an owner-scoped confirmation.

## Scope
- Replace the Bag Drawer placeholder notice with navigation to /checkout.
- Add authenticated /checkout page and customer checkout component.
- Load saved addresses and active delivery slots from existing APIs.
- Use /api/checkout/validate for a fresh preview; show only server-returned pricing and delivery details.
- Submit only addressId, deliverySlotId, deliveryDate, idempotencyKey and optional notes to POST /api/orders.
- Keep one idempotency UUID during retries; clear it only after confirmed success.
- Redirect to /orders/[id], where RLS-scoped server reads show order, item snapshots, COD pending status, delivery slot and saved address.
- Show recoverable field/general errors; disable duplicate submissions while request is in flight.
- Add Playwright coverage against disposable local Supabase for checkout UI, COD submission, order confirmation ownership, and no online payment surfaces.

## Business and security invariants
- COD only; no Razorpay, UPI/card gateway, wallet, subscriptions, refund or collection workflow.
- auth.uid() remains authoritative; browser never supplies customer identity, prices, totals, status, payment method or stock.
- Database RPC remains the final authority for price, address serviceability, delivery cutoff, vendor eligibility and inventory.
- No order-level delivery fee; show the validated server total.
- Delivery windows remain 08:00–11:00 and 17:00–21:00, Asia/Kolkata.
- Do not change delivery-slot rows, stock quantities, production DB or production deployment.
- Order detail page filters by current authenticated customer and relies on existing RLS; guessed/foreign IDs return not found.

## Verification
1. Lint and TypeScript checks.
2. Unit tests for checkout client helpers where appropriate.
3. Existing auth and checkout-validation browser tests remain green.
4. New authenticated browser flow creates a deterministic test cart and submits a COD order against disposable local Supabase.
5. Assert one order, order items, pending COD payment, reservation movement, converted cart, and no COD collection / online payment rows.
6. Verify same-key retry returns the same order; foreign customer cannot view order detail.
7. Review diff for service-role keys, online gateway references, unintended data writes and delivery-window drift.

## Rollout
Code and CI only in this PR. No remote migration is required: Phase 4.4.2 migration is already applied to Dairybuy-dev. Preview only; no production promotion.
