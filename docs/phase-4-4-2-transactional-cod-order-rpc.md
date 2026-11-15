# Phase 4.4.2 — Transactional COD order creation

## Scope
This slice adds an authenticated one-time COD order RPC and a server route. It does not enable online payments, subscriptions, customer order history, cancellation, refunds, or staff cash reconciliation.

## Entry point
- `POST /api/orders`
- Requires a verified Supabase session.
- Request accepts address ID, delivery slot ID, delivery date, idempotency UUID, and optional delivery notes only.
- Customer identity is derived from `auth.uid()`.
- Client-supplied price, totals, customer ID, payment method/status, inventory amounts, and order status are ignored/rejected by omission.

## Transaction boundary
The database function validates the saved cart and calculates authoritative prices first, creates the order, then writes order-item snapshots, stock reservations/movements, a pending COD payment, and cart conversion in the same PostgreSQL transaction. A failure rolls back the entire operation.

## Business rules
- One-time orders only; order status `pending_confirmation`.
- COD only; payment method/gateway `cod`, payment status `pending`.
- No payment collection row is created at placement.
- Order-level delivery fee is zero.
- Address ownership and active service-area/pincode mapping are rechecked.
- Active delivery slot and same-day cutoff are rechecked in Asia/Kolkata.
- Current catalogue/vendor eligibility and prices are re-read from database rows.
- Milk uses 500 ml and 1 L reference variants; selected volume is 0.5–10 L in 0.5 L steps.
- Pack reservation is computed from total line litres (selected litres × quantity): whole 1 L packs plus at most one 500 ml pack.
- Non-milk stock reserves selected variant quantity.
- Stock is fail-closed and respects safety stock. No inventory is seeded or increased by this RPC.
- Required pack counts are aggregated by variant, then all inventory rows are locked once in ascending `inventory.id` order before any reservation update. This removes cart-line-dependent lock ordering and prevents opposite-order inventory deadlocks.
- Idempotency is customer-scoped and same-key retries return the original order.

## Security
- Private implementation uses SECURITY DEFINER with empty search_path and fully qualified object names.
- Only a public-schema wrapper is exposed to authenticated PostgREST clients.
- Private function execution is revoked from public/anon/authenticated/service_role; wrapper execution is granted only to authenticated.
- No direct customer table INSERT policies are added.
- No production database migration is permitted in this phase.

## Required verification before applying to Dairybuy-dev
1. SQL migration compiles and applies on an isolated disposable Supabase database.
2. Anonymous invocation rejected; authenticated customer can invoke only through wrapper.
3. Customer cannot place an order against another customer's address.
4. Same idempotency key returns same order and creates no duplicate items/payment/reservations.
5. Spoofed JSON fields cannot affect customer, prices, totals, COD method/status, stock, or order status.
6. Current/future slot cutoff behavior uses Asia/Kolkata; expired same-day cutoff rejected.
7. Inactive/out-of-area address, inactive slot, inactive product/vendor, missing/ambiguous price, empty cart and invalid volume rejected.
8. Insufficient stock and missing stock rows fail closed; all writes rollback.
9. Milk reservation examples: 0.5 L → 1 half pack; 1 L → 1 full pack; 1.5 L → 1 full + 1 half; 2.5 L → 2 full + 1 half. Multiply by cart quantity before pack conversion.
10. Non-milk quantity reserves same number of selected variant packs.
11. Deterministic inventory row locking is asserted by pgTAP. CI runs both a low-level PostgreSQL lock primitive race and an end-to-end concurrency harness against the actual authenticated `public.create_cod_order` RPC. The RPC harness creates two synthetic authenticated customers with independent addresses/carts, races them for one final stock pack, requires exactly one successful order and one rollback, checks order/item/payment/movement/cart atomicity, and retries the winning customer's idempotency key to verify replay without duplicates.
12. Cart conversion, order, order_items, payment, inventory and movement writes commit together.
13. No payment collection, refund, subscription or online gateway records are created.

## Rollout
This PR is code-only. Do not apply the migration to Dairybuy-dev until PR review and isolated SQL verification pass. Production remains untouched.
