# Phase 4.4.6.5 — Delivery lifecycle concurrency (Stage B)

## Scope
This is a test-only change. It executes the existing production COD order, customer cancellation, and customer/admin delivery transition RPCs using independent PostgreSQL sessions against the disposable local Supabase database in CI.

## Scenario 1: customer confirmation vs admin fallback
1. Create a real COD order using `public.create_cod_order`.
2. Advance it through confirmed, processing, and out_for_delivery using the admin RPC.
3. Race the owning customer and admin, each calling `public.transition_one_time_cod_order(..., 'delivered', NULL)`.
4. Assert both requests are idempotently successful, but only one `order_fulfilled` movement and one delivered history event exist.
5. Assert the one reserved pack is consumed exactly once and COD remains pending.

## Scenario 2: customer cancellation vs dispatch
1. Create a second real COD order and advance it to processing.
2. Race the customer cancellation RPC against the admin processing -> out_for_delivery transition.
3. The order-row lock must serialize the outcome:
   - If cancellation wins, the order is cancelled, one reservation-release movement is written, and dispatch fails.
   - If dispatch wins, the order becomes out_for_delivery, reservation remains intact, and cancellation fails.
4. Assert no double release, no conflicting status history, and stock counters match the winning state.

## Safety
- All operations run against the disposable local CI database.
- No hosted Supabase project, production data, or live inventory is accessed.
- The test creates two orders through the actual COD RPC, not hand-written order rows.
- This stage changes no production migration or application behavior.
