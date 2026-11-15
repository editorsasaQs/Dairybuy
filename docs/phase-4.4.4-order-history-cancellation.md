# Phase 4.4.4 — Customer order history and cancellation

## Scope
- Authenticated customer order-history list, ordered newest first, using RLS and explicit customer ownership.
- Reuse the existing order confirmation/detail route and immutable order-item snapshots.
- Add customer cancellation through a server route backed by an atomic, authenticated database RPC.
- Cancellation eligibility is evaluated in PostgreSQL using the order's delivery slot and delivery date in Asia/Kolkata.
- Cancellation is permitted through the exact configured cancellation deadline (inclusive): 07:30 for morning and 16:30 for evening.
- Only one-time COD orders are in scope. Pending COD payment remains pending; no refund, online payment, wallet, or collection workflow is invoked.

## Verified current database contract (Dairybuy-dev)
- Migration history contains Phase 4.4.1 and Phase 4.4.2; the transactional COD RPC migration is applied.
- `orders` has `customer_id`, `delivery_date`, `delivery_slot_id`, `status`, `payment_status`, `payment_method`, `total_paise`, `idempotency_key`.
- `order_items` contains immutable product, variant, brand, pack-size and vendor snapshots.
- `order_status_history` exists with `from_status`, `to_status`, `changed_by`, `note`, `created_at`; customer read is already scoped through the parent order.
- `inventory` uses `available_stock`, `reserved_stock`, `safety_stock`; order placement increments `reserved_stock`.
- Reservation movements use `movement_type='order_reservation'`, `reference_id=order UUID text`, and positive `change_amount`. Cancellation will write a matching negative `order_reservation_release` movement and decrement reserved stock, without changing available stock.
- Delivery-slot rows are the source of truth and must not be changed.
- Existing orders UPDATE policy is staff-only; customer cancellation must not use a direct browser update.

## Atomic cancellation contract
1. Derive customer identity only from `auth.uid()`.
2. Lock the owned order row. Unknown/foreign IDs return the same not-found response.
3. Treat an already-cancelled order as an idempotent success.
4. Require a one-time COD order in a cancellable pre-dispatch state (`pending_confirmation`, `confirmed`, or `processing`); reject terminal and dispatched states.
5. Load the configured slot deadline and compare the current Asia/Kolkata local timestamp to `delivery_date + cancellation_deadline_time`; exact deadline is allowed.
6. Lock affected inventory rows in deterministic ID order, derive reservation quantities from reservation movements, decrement `reserved_stock` exactly once, and append inverse release movements.
7. Update order status to `cancelled` and append one status-history row in the same transaction.
8. Leave COD payment rows/status unchanged because collection has not happened at customer cancellation stage.

## Stage / debug plan
### 4.4.4.1 — Read-only history
- Add `GET /api/orders` with authenticated ownership and stable pagination/order.
- Add `/account/orders` list with loading, empty, error and status states.
- Tests: anonymous 401, customer A cannot see customer B, stable newest-first ordering, no live catalogue price joins.

### 4.4.4.2 — Atomic cancellation
- Add private SECURITY DEFINER implementation and authenticated public wrapper.
- Add `POST /api/orders/[id]/cancel`; never accept customer ID, status, price, deadline, or inventory values from client.
- Add cancel action only when server-derived eligibility says it is available.
- Tests: morning/evening before, exactly-at and after deadlines; foreign ID; duplicate request; concurrent cancellation; insufficient/missing reservation fails atomically; delivered/out-for-delivery/failed/cancelled states rejected; payment remains pending COD; no available-stock change.

### 4.4.4.3 — Detail/history UX
- Link list items to existing owner-filtered `/orders/[id]` detail.
- Display immutable item snapshots and order-status history.
- Tests: snapshot persistence, history visibility and ownership, responsive mobile UI, keyboard/accessibility.

### Debug gates
- First run lint, TypeScript, unit tests and production build.
- Run database RBAC/pgtap tests against disposable local Supabase only.
- Run authenticated Playwright E2E with two customers and seeded inventory.
- Run concurrency test proving cancellation and dispatch/status update cannot both win.
- Review SQL grants, SECURITY DEFINER search_path, RLS, migration drift, payment invariants and delivery-window strings.
- Do not apply migrations to production or promote a production deployment. Apply to Dairybuy-dev only after migration and CI review.
