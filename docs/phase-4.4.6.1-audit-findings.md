# Phase 4.4.6.1 — Delivery lifecycle and inventory audit findings

Status: Static source audit completed against the merged `main` branch after PR #68.
Scope: Repository migrations, SQL RPC definitions, existing pgTAP/concurrency tests and schema definitions.
Environment safety: No remote Supabase query, migration, seed, production deployment or data mutation was performed in this audit.

## Confirmed current contracts

### Order creation and reservation

- `private.create_cod_order` validates the authenticated customer, serviceability, slot cutoff, authoritative prices and required inventory.
- It aggregates required stock by product variant, locks inventory rows in deterministic `inventory.id` order, and checks `available_stock - reserved_stock - safety_stock`.
- It increments only `inventory.reserved_stock` at order creation. It does not decrement `available_stock`.
- It writes positive `inventory_movements.change_amount` rows with `movement_type = 'order_reservation'` and the order UUID string as `reference_id`.
- The order and item/vendor display snapshots are created in the same transaction. The address itself is not snapshotted.

### Cancellation and reservation release

- `private.cancel_customer_cod_order` locks the owned order row, checks one-time COD, pending payment, allowed cancellable status and the Asia/Kolkata slot cancellation deadline.
- It then locks affected inventory rows in `inventory.id` order.
- Outstanding reservation is calculated from the signed sum of `order_reservation` and `order_reservation_release` movements for the order and inventory row.
- It subtracts that outstanding amount from `reserved_stock` and writes a negative `order_reservation_release` movement.
- The order status change and one history row are committed atomically with the reservation release.
- The function does not decrement `available_stock`.

### Inventory ledger semantics that must be preserved

- The base schema defines `available_stock` and `reserved_stock` as separate non-negative counters; checkout availability is calculated as `available_stock - reserved_stock - safety_stock`.
- The base schema comment documents legacy movement types as `restock`, `order_reservation`, `order_fulfilled`, `spoilage`, and `audit_adjustment`.
- The active checkout/cancellation RPCs use `order_reservation` and `order_reservation_release`. There is no database CHECK constraint constraining `movement_type`.
- The Phase 4.4.6 planning note previously proposed `order_fulfillment`, which differs from the base schema's documented `order_fulfilled`. Do not introduce either spelling until the canonical ledger event name is explicitly selected and tested.
- No merged delivery-finalization function currently consumes a reservation or decrements `available_stock`. The Phase 4.4.5 delivered transition only changes order status and writes order history. Thus delivered orders currently retain their reservation; this is a known gap to solve in 4.4.6.4.

## Delivery assignment model

- The base `delivery_assignments` table is route-level: `staff_id`, `delivery_date`, `delivery_slot_id`, `service_area_id`, `route_order jsonb`, free-text `status`, `assigned_at`, and `completed_at`.
- It has no normalized order-to-route relation or `order_id` foreign key. The JSONB route order is not a relational integrity boundary.
- The schema's `staff_id` references any `auth.users` row. It does not itself prove the user is an approved delivery worker.
- Existing effective staff authorization is owner/admin only. `manager` and `operations_staff` remain explicitly denied by RBAC tests. Do not create a delivery-agent role, grant new permissions, or use arbitrary auth users as delivery staff without a separate approval and identity design.

## Immutable address snapshot gap

- `orders.customer_address_id` references the mutable `customer_addresses` row.
- Address fields currently available to snapshot: `recipient_name`, `phone`, `address_line1`, `address_line2`, `landmark`, `city`, `state`, `pincode`, and `service_area_id`.
- `create_cod_order` validates customer ownership and serviceability using the address row but only persists `customer_address_id` and `service_area_id` on the order.
- Later edits to the customer address can therefore change what the existing admin/customer order pages resolve as the address. There is no immutable checkout-time address snapshot or provenance marker.
- Legacy backfill must not pretend that the current address row is the historical address at checkout. Any legacy snapshot must be explicitly marked as reconstructed from the currently linked address, with timestamp/provenance, or left unavailable if the linked row is missing.

## Phase 4.4.6 implementation gates

1. **4.4.6.2 Address snapshot:** define a stable versioned snapshot shape, capture it atomically from the customer-owned address during order creation, make it immutable to customer updates, and explicitly mark legacy reconstructed snapshots. Update all order detail views to prefer the snapshot.
2. **4.4.6.3 Assignment model:** add normalized route-order membership with unique active assignment protection, date/slot/area integrity, stable stop sequence, actor audit and atomic assign/reassign/unassign operations. Do not rely on JSONB alone.
3. **Staff identity approval:** before any delivery-user selection UI or delivery-agent role, decide who can be assigned. Current role model cannot distinguish delivery workers from ordinary customers without an approved identity/permission change. Keep operations owner/admin-only until resolved.
4. **4.4.6.4 Inventory finalization:** first reconcile all inventory writers, opening stock/restock and adjustment semantics, legacy movements and reservation balances. Define the exact atomic finalization contract and canonical movement type. Then decrement the reserved and on-hand counters exactly once, with row locks and ledger uniqueness/idempotency. Never infer success from order status alone.
5. **4.4.6.5 Delivery board:** build only after the assignment and inventory RPC contracts are stable.

## Explicitly out of scope

- Production Supabase, production deployment or customer data.
- Online payments, wallet, refunds or COD cash collection/reconciliation.
- Subscription generation or seller/marketplace workflows.
- Customer live GPS tracking or a delivery-agent app.
- Enabling manager/operations_staff or adding delivery-agent access without explicit approval.

## Test requirements before any migration is merged

- Address snapshot: customer ownership, exact field capture, null optional fields, later address edits, legacy provenance and RLS immutability.
- Assignment: wrong date/slot/area, duplicate active assignment, unassign/reassign, route order sequence, unauthorized roles and concurrent races.
- Inventory: successful delivery, repeated delivery, duplicate movement, cancellation-vs-delivery race, negative/over-reserved protection, reconciliation of per-order movement sums and aggregate counters.
- Regression: existing order creation/cancellation, deterministic inventory lock order, role boundary, COD pending after delivery, unchanged totals and item/vendor snapshots.
