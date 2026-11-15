# Dairybuy — Backend Status After Phase 4.2

Last reviewed: 13 November 2026. Development project: `Dairybuy-dev`.

## Implemented

1. Customer catalogue, milk-vendor catalogue and serviceability APIs read from Supabase using request-scoped server clients.
2. Cart validation recalculates all line prices from active database products, variants, vendor approvals, active vendor-product mappings and current vendor-price rows. Browser-supplied prices are ignored.
3. Authenticated cart persistence uses the `sync_active_cart(jsonb)` RPC; customer ownership is derived from `auth.uid()`, and the database validates price/vendor snapshots.
4. RLS, customer isolation, staff authorization, foreign-key indexes, RLS init-plan optimization and overlapping write-policy cleanup have migrations in the development database.
5. Fresh Punjab Milk and Kolkata Milk Centre have been removed from the active vendor catalogue and development database by `20261112095741_remove_unpriced_milk_vendors`. The old seed migration is retained as immutable history; the forward migration removes its legacy rows.

## Verified development database snapshot

- Active vendors: 4 total (3 regular milk vendors plus Canteen Milk Centre).
- Inventory: 22 rows; all 22 currently have zero available stock.
- Orders, subscriptions, payments, refunds and delivery assignments: 0 rows each.
- One active cart line exists for a customer and Healthy Haryana buffalo milk; it is unrelated to the two removed vendors.
- The removed vendor IDs have zero rows in `vendors`, `vendor_products` and `vendor_prices`.
- `app_settings.delivery_fee_paise=0`; vendor CSV totals already include the delivery component, so do not double-charge.

## Remaining before customer checkout

1. Phase 4.3: server-authoritative address, service-area, delivery-slot, cutoff and checkout validation. The current DB slots are Morning 8–11 AM and Evening 5–9 PM; the owner-approved customer slots are Morning 9 AM–12 PM and Evening 4–7 PM. Reconcile this mismatch before enabling checkout. The existing order cutoff (7 AM / 4 PM) and cancellation deadlines (7:30 AM / 4:30 PM) match the agreed rules.
2. Phase 4.4: atomic one-time order creation, idempotency protection, immutable price/address/slot/item snapshots (the current orders table references a mutable customer address), order history, stock reservation and cancellation rules.
3. Phase 4.5: payment gateway integration, payment signature/webhook verification, COD collection and reconciliation, refund workflow.
4. Later subscription phase: 7/30-day prepaid plans, daily delivery schedule, pause/skip, vendor changes, renewals and subscription delivery history.
5. Operations dashboard integration: connect the existing prototype to the same Supabase project with role-based procurement, inventory, dispatch, order status and COD workflows.
6. Before launch, populate real stock through audited inventory movements; current stock is zero for all 22 rows.

## Current advisor findings

- Security: one informational finding — `payment_webhook_events` has RLS enabled without policies. Its table grants currently show access only for `postgres` and `service_role`; keep it private to trusted server-side webhook processing and do not add a customer-facing policy merely to silence the advisor.
- Security: leaked-password protection is disabled in Supabase Auth; enable before production launch.
- Performance: 46 indexes are currently reported unused. The development database has no order/delivery workload yet; do not drop these indexes without workload evidence.
- Earlier unindexed foreign-key, RLS init-plan and overlapping-policy findings have corresponding hardening migrations in the development migration history.

## Verification and release gates

- PR #44 (Phase 3.3 customer commerce journey) was reviewed and squash-merged to `main` on 13 November 2026. Merge commit: `77ad9fe94a094ef827eee3fac4ea4c27c068b527`.
- PR #45 (vendor removal) remains open pending latest-head CI verification and final review. Its Vercel Preview for commit `077e756f3352aa688af700539e5bf1d3862e692d` is Ready; latest documentation updates will require a fresh build.
- No production deployment or domain switch has been performed.
- Run lint, typecheck, unit tests, build, database-RBAC and auth E2E against the final PR head before merge.
- Validate the live preview's catalogue/vendor/cart APIs and customer flows. A Vercel log query with no matching records is not proof that all runtime paths work.
