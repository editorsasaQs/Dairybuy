# Phase 4.4.6 — Order lifecycle and delivery assignment

Status: Stages 4.4.6.1 and 4.4.6.2 merged; Phase 4.4.6.3 scoped to customer/admin delivery completion. No delivery-agent interface or route assignment workflow.
Predecessor: Phase 4.4.5 (admin order operations and status lifecycle).
Branch for planning: `feat/phase-4-4-5-admin-order-management`

## Goal

Connect confirmed one-time COD orders to a safe, centrally managed delivery workflow. Support per-order assignment into a staff/date/slot/service-area route, preserve a reliable checkout address snapshot, and keep order, delivery and inventory states consistent.

This is not a marketplace. No seller app, customer live tracking, online payment, wallet, refund, subscription generation or COD cash reconciliation is included.

## Verified current schema facts

- `delivery_assignments` currently represents a staff/date/slot/service-area route and contains `route_order jsonb`, but has no direct `order_id` foreign key. The dev table has no rows and no status check constraint was found.
- `orders` references `customer_addresses` by `customer_address_id`; the order does not currently persist an immutable delivery-address snapshot.
- `order_items` already stores immutable product, variant, brand, pack-size and vendor-name snapshots.
- `delivery_status_enum` includes `scheduled`, `assigned`, `out_for_delivery`, `delivered`, `skipped` and `failed`. Do not assume every enum value is approved for customer order transitions.
- `create_cod_order` increments `inventory.reserved_stock` and records positive `order_reservation` movements for each reserved inventory row.
- `cancel_customer_cod_order` subtracts the outstanding reservation from `reserved_stock` and records negative `order_reservation_release` movements, guarded by the order row lock.
- The Phase 4.4.5 transition RPC currently updates only order status and order history. It does not consume or release inventory when an order reaches `delivered`; therefore a delivered order can leave stock reserved until Phase 4.4.6 defines and implements finalization.
- `inventory_movements` currently has no check constraint restricting movement_type values. Add an explicit supported movement contract in the next migration only after reconciling historical rows.
- Current effective admin authorization is owner/admin only. Manager and operations_staff remain denied by the current RBAC regression contract.
- Delivery windows are Morning 8 AM–11 AM and Evening 5 PM–9 PM; same-day cutoffs are 7 AM / 4 PM and cancellation deadlines are 7:30 AM / 4:30 PM in Asia/Kolkata.
- One-time COD is the only checkout/payment model in current scope. Delivered orders remain payment-pending until the separate COD collection workflow.

## Stage 4.4.6.1 — Delivery lifecycle and inventory audit (completed — static source review)

Audit findings: [Phase 4.4.6.1 audit report](./phase-4.4.6.1-audit-findings.md).

Important reconciliation before implementation:
- The base schema documents legacy movement type `order_fulfilled`, while an earlier planning draft proposed `order_fulfillment`. Do not choose a spelling until all inventory writers and historical movement rows are reconciled.
- `available_stock` is not decremented during checkout; checkout increments `reserved_stock` only. Delivery finalization must atomically consume the outstanding reservation and reduce on-hand stock exactly once, using a canonical ledger event.
- Address snapshots do not exist on orders. `customer_address_id` points to mutable customer data; any legacy reconstruction must be marked as reconstructed, not represented as the original checkout-time value.
- `delivery_assignments.staff_id` is only an auth-user FK and does not identify an approved delivery worker. No delivery-agent role or manager/operations permission is authorized.



1. Trace `create_cod_order`, reservation rows, inventory counters and `inventory_movements`: stock is reserved during atomic order creation, before the order is returned.
2. Trace customer cancellation: it releases the outstanding reservation exactly once under the order row lock.
3. Identify the missing terminal path: delivery completion currently leaves the reservation in place and does not reduce on-hand available_stock.
4. Inspect existing `delivery_assignments` constraints, statuses, staff identity source and route_order usage; do not assume JSONB is a normalized order relation.
5. Inspect order/item/address schemas and confirm which fields are immutable snapshots versus live references.
6. Record baseline invariants before proposing new migrations.

Verification:
- Read-only SQL inventory and reservation reconciliation queries.
- Assert no production project is queried or changed.
- Capture baseline counts/totals for disposable local tests only.

## Stage 4.4.6.2 — Immutable delivery-address snapshot (implementation in progress)

1. Add a versioned JSONB snapshot on `orders` for recipient name, phone, address lines, landmark, city, state, pincode and service area, plus source and capture timestamp.
2. Backfill existing orders from their currently linked customer-owned address and mark them `legacy_reconstructed`; never label reconstructed data as the original checkout-time address.
3. A database BEFORE INSERT trigger locks and revalidates the customer-owned address/serviceability, then captures the snapshot in the same transaction as order creation. This also closes the address-edit race between checkout validation and order insertion.
4. A database BEFORE UPDATE trigger rejects changes to the snapshot, provenance or capture timestamp. Existing order RLS remains read-only for customers.
5. Update customer order detail, admin order detail and admin order queue to read only the immutable snapshot; remove mutable address-book joins.
6. Extend pgTAP, unit and authenticated COD RPC concurrency coverage for capture, ownership, provenance, immutability and address-edit isolation.

Verification gates:
- `verify`: lint, TypeScript, unit tests and production build.
- `database-rbac`: new snapshot pgTAP test plus existing RBAC, inventory, cancellation, status and concurrency regressions.
- `auth-e2e`: existing isolated customer auth/checkout browser suite.
- Apply the additive migration to Dairybuy-dev only after required CI passes; production remains untouched.

## Stage 4.4.6.3 — Customer delivery confirmation and admin fallback

Scope is intentionally limited to the two approved interfaces:
- Customer interface: the authenticated order owner may confirm receipt only while the one-time COD order is `out_for_delivery`.
- Owner/admin interface: existing admin fulfillment action may mark the order delivered if the customer does not confirm.
- Both actions use the same row-locked RPC and write exactly one order-status history event.
- Delivery completion consumes the outstanding reservation and decrements both `available_stock` and `reserved_stock` in the same transaction. The canonical ledger movement is `order_fulfilled`, as documented by the base schema.
- Repeated completion is idempotent; no duplicate inventory movement or history event is written.
- COD remains pending; delivery completion never marks cash as collected.
- The legacy `delivery_assignments` table is explicitly owner/admin-only.

Explicitly excluded:
- Delivery-agent interface, login, role, app or account management.
- Route assignment, worker selection, GPS/live tracking or customer map tracking.
- Manager/operations access.

Verification:
- pgTAP checks customer ownership, status gating, owner/admin fallback, manager/operations denial, idempotency, inventory counters and ledger movement, COD pending state, and assignment-table RLS.
- Existing lint, typecheck, unit, build, database RBAC and authenticated browser checks remain required.
- Apply only to Dairybuy-dev after all required CI jobs pass.

## Stage 4.4.6.4 — Delivery lifecycle concurrency and reconciliation

1. Verify the customer/admin completion race: order-row locking must permit exactly one state transition, one inventory settlement and one delivered history event.
2. Reconcile any pre-existing delivered orders against reservation movements before a production rollout. The current Dairybuy-dev audit found no orders; production is not queried or changed.
3. Verify all inventory-writing paths and the canonical `order_fulfilled` movement remain consistent with the base schema.
4. Keep COD payment pending after delivery; cash collection remains a separate owner/admin process.
5. Do not introduce delivery-agent, route assignment, manager or operations workflows.

Verification:
- Separate-session concurrency test for competing customer/admin completion requests.
- Assert available and reserved stock conservation, one fulfillment movement and one delivered status-history event.
- Existing lint, TypeScript, unit, build, database RBAC and authenticated browser checks remain required.

## Stage 4.4.6.5 — Final two-interface delivery readiness

- Review customer order detail and owner/admin order queue/detail for the same delivery state.
- Ensure both interfaces refresh after completion and display delivery history consistently.
- Keep only customer and owner/admin interfaces in scope; no delivery-agent or separate route board.
- Apply additive migrations to Dairybuy-dev only after CI passes; production DB and deployment remain untouched.

## Explicit exclusions

- Customer live GPS tracking or map tracking.
- Delivery-agent app or new delivery-agent role until explicitly approved.
- Online payment, wallet, refunds and COD cash reconciliation (separate Phase 4.5).
- Subscription generation and recurring delivery (Phase 5).
- Seller/marketplace workflows.
