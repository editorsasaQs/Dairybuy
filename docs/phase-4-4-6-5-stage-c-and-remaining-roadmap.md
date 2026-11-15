# Dairybuy — implementation status and remaining roadmap

## Completed: Phase 4.4.6.5 — reservation reconciliation

The owner/admin-only `public.audit_inventory_reservations()` RPC and pgTAP regression are implemented.

It reports:
- Inventory rows where `inventory.reserved_stock` differs from the net reservation ledger (`order_reservation + order_reservation_release + order_fulfilled`).
- Per-order reservation anomalies, including negative balances, missing outstanding reservations, residual balances after terminal states and duplicate movement types.
- The affected SKU, service area, order status, counters and explanatory detail.

The RPC is SECURITY DEFINER with an empty search path, guarded by the owner/admin role check, authenticated-only, read-only and never auto-repairs stock.

## Completed: Phase 4.4.6.6 — owner/admin inventory audit UI

The page at `/admin/inventory/audit` consumes the reservation audit RPC and displays clean state/findings with SKU, service area, order reference and counter/ledger differences. It has role protection, loading/error/empty states and no automatic stock correction.

## Completed: Phase 4.5 — COD collection and reconciliation

- 4.5.1: order-scoped cash collection, assignment/owner authorization, idempotency and audit history.
- 4.5.2: owner/admin verification or rejection; exact cash match is required before payment capture.
- 4.5.3: discrepancy correction, cash handover ledger and financial reporting.

One-time COD and subscription delivery COD remain separate order-scoped payment records.

## Completed: Phase 5 / 5.6 / 5.7 — subscription lifecycle and per-delivery COD

- 7-day and 30-day subscription quote/checkout with server-authoritative pricing.
- Pause, resume, skip, cancel and vendor-change controls.
- Daily delivery generation, stock reservation and failure/release handling.
- Each subscription delivery has its own pending COD payment; the plan total is not prepaid.
- Owner/admin can dispatch, mark delivered/failed, record cash, verify/reject and resolve discrepancies.
- Customers can confirm receipt for their own dispatched delivery.
- Launch has exactly two interfaces: customer and owner/admin. There is no delivery-agent UI.

## Phase 4.6 — physical stock receiving and adjustments

### Phase 4.6.1 — immutable stock ledger and database operations (completed and applied to Dairybuy-dev)
- Vendor receipt headers and per-SKU receipt lines, including received quantity and purchase cost.
- Atomic owner/admin stock receiving, with idempotency and immutable `stock_receipt` movements.
- Audited spoilage, damage and stocktake adjustments with signed movements.
- Negative adjustments cannot consume units already reserved for customer orders.
- Direct client stock writes are revoked; stock changes flow through trusted SECURITY DEFINER RPCs.
- A read-only physical-stock audit reconciles `available_stock` to stock receipt/adjustment/fulfilment movements and `reserved_stock` to reservation movements.

### Phase 4.6.2 — owner/admin inventory receiving and adjustment UI
- Build the inventory dashboard with stock on hand, reserved, free and safety quantities.
- Add vendor receipt form with SKU lines, quantity, unit cost, reference and notes.
- Add spoilage, damage and stocktake adjustment controls with reason/evidence and idempotent retries.
- Show receipt and adjustment history. No staff-facing inventory interface.

### Phase 4.6.3 — combined inventory audit and operational safeguards
- Extend the existing inventory audit page to show physical on-hand and reserved-ledger findings together.
- Add low-stock/safety-stock warnings and SKU/service-area filters.
- Add role, no-negative-stock, idempotency, immutability, audit and concurrency tests.
- Never auto-repair inventory from an audit finding; corrections require a physical count and an explicit adjustment.

## Phase 6 — online payments (deferred)
The launch checkout remains COD. Add UPI/card gateway only after the business selects a provider and supplies the required account/configuration. Implement signed webhook verification, idempotent settlement, refunds and COD/online separation. Never trust client-side payment success.

## Phase 7 — production launch readiness
- Apply ordered migrations to the dedicated production Supabase project only after review.
- Configure separate production Vercel environment variables, cron secret, backups, monitoring and rollback.
- Connect `dairybuy.com`, verify DNS/SSL and public deployment protection.
- Run a production-like Topsia pilot with the customer and owner/admin interfaces only.

## Merge and deployment policy
Each stage ships on its own branch/PR. Required gates: lint, TypeScript, unit/build, fresh local Supabase migration + pgTAP, concurrency and authenticated E2E. Apply to Dairybuy-dev only after migration baseline reconciliation. Production remains untouched until a separate launch approval.
