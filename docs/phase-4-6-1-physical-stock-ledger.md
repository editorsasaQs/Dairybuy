# Phase 4.6.1 — physical stock ledger and receiving

## Accounting model

`inventory.available_stock` is physical on-hand stock. `inventory.reserved_stock` is a subset of that on-hand quantity allocated to customer orders. Free stock is `available_stock - reserved_stock`; safety stock remains a separate ordering threshold.

| Event | available_stock | reserved_stock | Movement |
|---|---:|---:|---|
| Vendor receipt | +quantity | unchanged | `stock_receipt` |
| Order reservation | unchanged | +quantity | `order_reservation` |
| Reservation release | unchanged | -quantity | `order_reservation_release` |
| Delivery fulfilled | -quantity | -quantity | `order_fulfilled` |
| Spoilage/damage | -quantity | unchanged | `spoilage` / `damage` |
| Stocktake correction | signed delta | unchanged | `stocktake_adjustment` |

This keeps reservations from being mistaken for physical stock consumption. Fulfilment is the point where physical on-hand stock is consumed.

## Database objects

Migration: `20261115131405_phase4_6_1_physical_stock_ledger_receiving_adjustments.sql`

- `inventory_receipts`: vendor, service area, receipt number, receiving actor, timestamp, reference, notes, idempotency key and totals.
- `inventory_receipt_items`: SKU-level received quantity, purchase unit cost and line total.
- `inventory_stock_adjustments`: immutable spoilage, damage and stocktake correction records with actor, reason, evidence and idempotency key.
- `inventory_movements`: append-only physical and reservation ledger. Updates/deletes are rejected by a trigger.

## Trusted operations

- `receive_inventory_stock`: owner/admin only, 1–100 unique SKU lines, approved vendor, active service area, positive quantities, non-negative unit cost, idempotent receipt. Locks inventory rows in deterministic SKU order and writes receipt, counters and movements in one transaction.
- `adjust_inventory_stock`: owner/admin only. Spoilage/damage quantities are positive inputs converted to negative deltas; stocktake accepts a signed delta. Any negative adjustment that would consume reserved stock is rejected. Replays do not double-apply.
- `audit_inventory_stock`: owner/admin-only read-only reconciliation of physical on-hand and reserved ledgers. It never repairs stock.

Direct authenticated writes to `inventory` and `inventory_movements` are revoked. Admin read access is protected by RLS; no staff inventory interface exists.

## Release gates

- Fresh local Supabase migration replay.
- pgTAP for receipt totals, purchase cost, idempotency, spoilage, damage, positive/negative stocktake, reserved-stock protection, immutable movements, role boundaries and audit drift detection.
- Existing order-reservation and concurrency tests remain green.
- All 13 forward migrations after the reconciled baseline have passed full CI and are applied to Dairybuy-dev. Repository filenames are being aligned to the exact remote migration versions before any future CLI push.
