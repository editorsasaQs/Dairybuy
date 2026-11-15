# Phase 4.4.6.4 — Milk inventory SKU reservation

## Change
The COD order RPC now derives inventory requirements per validated cart line and preserves the selected milk SKU.

- 500 ml × 2 reserves 2 units of the 500 ml variant.
- 1 L × 2 reserves 2 units of the 1 L variant.
- 1.5 L × 2 reserves 2 units of the 1 L variant and 2 units of the 500 ml variant.
- Non-milk products continue to reserve their selected variant quantity.

Previously, aggregation multiplied litres by quantity before splitting into whole and half litres. That could convert two selected 500 ml units into one 1 L inventory unit, even though the order item retained the 500 ml variant.

## Safety invariants retained
- Requirements are aggregated by variant before reservation.
- Inventory rows are locked once in deterministic inventory.id order.
- Insufficient stock and missing inventory rows fail the transaction.
- Order, payment, inventory movements, reservation, and cart conversion remain within the existing transaction.
- This is a forward migration; the previously applied migration is not edited.

## Regression coverage
The inventory lock-order pgTAP test now checks that the production function uses per-line whole-litre quantities and 500 ml remainder quantities, and rejects the previous volume-times-quantity aggregation.

## Deployment
Apply the new migration through the normal reviewed Supabase migration workflow. This PR does not apply changes to a live Supabase project.
