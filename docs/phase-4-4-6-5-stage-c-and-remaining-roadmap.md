# Dairybuy — Phase 4.4.6.5 Stage C and remaining delivery roadmap

## Stage C: reservation reconciliation (this PR)
This stage adds a read-only owner/admin RPC, `public.audit_inventory_reservations()`, and a pgTAP regression test.

It reports:
- Inventory rows where `inventory.reserved_stock` differs from the net reservation ledger (`order_reservation + order_reservation_release + order_fulfilled`).
- Per one-time COD order/inventory ledger anomalies: negative balance, missing outstanding reservation for an active order, outstanding balance after cancellation/delivery, or duplicate reservation/release/fulfillment movement types.
- The current inventory counters, ledger balance, order status and explanatory detail.

The RPC is SECURITY DEFINER with an empty search path, requires the existing owner/admin guard, is executable only by authenticated callers (and denies non-owner/admin users inside the function), and is strictly read-only. It never changes stock or writes corrective movements.

### Explicit accounting boundary
This is a reservation-ledger audit, not a physical stocktake and not a full available-stock valuation. Initial inventory is seeded at zero and the current repository does not yet enforce all physical restock/spoilage/audit adjustments through a single movement RPC. Therefore it deliberately does not claim to reconcile `available_stock` to the movement ledger. A future stock-receiving/adjustment phase must make every on-hand change ledger-backed before that invariant can be safely asserted.

## Stage C acceptance gates
1. Fresh local Supabase migration succeeds.
2. pgTAP confirms clean active/delivered/cancelled ledgers produce zero findings.
3. pgTAP proves inventory-counter drift is detected.
4. pgTAP proves duplicate fulfillment is reported at order and inventory level.
5. Customer is denied; owner/admin can inspect.
6. Audit call never mutates inventory.
7. Full verify, database/concurrency and Auth E2E jobs pass.

## Remaining implementation sequence

### Phase 4.4.6.6 — Inventory reconciliation UI and operational audit
- Add an owner/admin-only admin page consuming the audit RPC.
- Show clean state, findings, affected SKU/service area, order reference, recorded counter and ledger balance.
- Link findings to the order detail screen.
- No auto-repair. Any stock correction requires an explicit audited stock-adjustment workflow and a human-confirmed physical count.
- Add empty/loading/error states, mobile layout, role-boundary tests and E2E coverage.

### Phase 4.6 — Physical stock receiving and adjustments
- Define opening balance and stock receiving from vendor/warehouse.
- Add atomic owner/admin RPCs for restock, spoilage, damage, stocktake adjustment and correction.
- Every on-hand quantity change must append an immutable movement with actor, reason, reference and timestamp.
- Deterministic row locking, idempotency keys, non-negative constraints and audit history.
- Reconcile available, reserved and safety stock with explicit formulas and pgTAP/concurrency coverage.

### Phase 4.7 — COD collection and settlement
- Record cash collected by authorized delivery/admin staff against an order.
- Enforce exact outstanding amount, one-time idempotency, actor/time, receipt/reference and audit history.
- Keep order delivery status separate from payment collection status.
- Daily cash handover and outstanding COD reconciliation; no online gateway in this phase.

### Phase 5 — Subscription engine
- 7-day and 30-day plans using the approved vendor-price plan fields.
- Daily delivery generation with idempotency and duplicate-day protection.
- Pause, skip, resume, expiry and cancellation rules.
- Customer-selected milk vendor, delivery address/slot and area validation.
- Subscription payment and delivery ledger, stock reservation policy, failure/retry handling.
- Customer self-service and admin operational views.

### Phase 6 — Online payment integration
- Select gateway only after business approval.
- Signed webhook verification, idempotent payment state transitions, refund reconciliation and COD/online separation.
- Never trust client-side payment success.

### Phase 7 — Production launch readiness
- Hostinger domain to Vercel DNS/SSL and production environment verification.
- Supabase production migration review, backups, RLS/security advisor, secrets and least privilege.
- Monitoring, error reporting, rate limits, data retention, privacy/legal pages and support workflows.
- End-to-end tests on real production-like staging, rollback plan and controlled Topsia pilot.

## Merge policy
Each stage ships on its own branch and PR. Do not merge until lint, typecheck, unit/build, local Supabase migration + pgTAP, real concurrency scripts and Auth E2E are green. Never auto-correct inventory based on an audit report.
