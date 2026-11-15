# Phase 4.4.1 — Order schema contract

## Confirmed inventory conversion

Owner confirmed pack-based inventory:

- Milk inventory is counted separately for each sellable 500 ml and 1 L product variant.
- For a selected volume, reserve the minimum combination of whole 1 L packs plus at most one 500 ml pack.
- Examples: 0.5 L = one 500 ml pack; 1.0 L = one 1 L pack; 1.5 L = one 1 L + one 500 ml; 2.5 L = two 1 L + one 500 ml.
- The reservation must resolve the matching 500 ml and 1 L variants for the same milk product (cow/buffalo/canteen). It must not reserve 1.5 units of the 1 L row.
- Non-milk stock remains an integer count of the selected sellable variant, multiplied by cart quantity.
- All stock remains unavailable when verified physical inventory is zero. No seed stock changes are permitted.

## Migration contract

The migration is additive and legacy-safe:

- Adds nullable `orders.delivery_date` and `orders.idempotency_key`; existing orders remain valid.
- Adds a partial unique index on customer + non-null idempotency key.
- Adds a database-generated order number default backed by a sequence (collision-safe under concurrent inserts).
- Adds order-item display snapshots and backfills them from the current catalogue/vendor rows without changing order money or quantity.
- Keeps existing order-number uniqueness and the money immutability trigger.
- No customer INSERT policies are added.
- No inventory data is changed and no reservation is performed by this migration.

## Operational decisions

- New order status: `pending_confirmation`.
- New COD payment status: `pending`; no payment capture at order placement.
- Order-level delivery fee: zero; vendor pricing already includes the applicable product delivery component.
- Delivery date is local `Asia/Kolkata`; existing delivery slot rows remain the source of truth.
- No online payments, subscriptions, cancellation, COD cash collection or production rollout in this slice.

## Verification gates

Before applying to Dairybuy-dev:
1. Review SQL function privileges/default execution behavior on a disposable Supabase database.
2. Run migration twice to verify additive/idempotent behavior.
3. Verify legacy order rows retain NULL delivery date/idempotency and all snapshots backfill where joins exist.
4. Verify generated order numbers are unique under concurrent inserts and sequence permission is adequate.
5. Run schema diff, lint/typecheck and database/RBAC CI.
6. Only after PR review, apply to Dairybuy-dev; never production in this phase.
