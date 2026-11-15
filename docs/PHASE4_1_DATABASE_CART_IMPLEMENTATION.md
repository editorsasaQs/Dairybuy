# Dairybuy Phase 4.1 — Database-backed cart validation

## Scope in this PR
- Replace the cart-validation API's local TypeScript catalogue and vendor-price lookups with request-scoped Supabase queries.
- Resolve every submitted variant against active products and orderable variants in the live database.
- Resolve milk pricing only from exactly one current vendor-price row for the selected vendor, variant and milk type.
- Require the vendor to be approved and ordering-enabled, and require an active vendor-product mapping.
- Require Canteen milk to use Canteen Milk Centre and the `canteen` milk type.
- Resolve non-milk prices from `product_variants.final_price_paise`.
- Resolve the per-order delivery fee from `app_settings.delivery_fee_paise`; validate the Canteen price breakdown against this configured fee.
- Ignore all client-reported prices and return no partial successful totals if any cart line fails validation.
- Keep all amounts in integer paise and disable HTTP caching for cart validation.

## Live Dairybuy-dev observations (read-only)
- Current vendor prices are held in `vendor_prices`, not in the standard milk variant's nullable `final_price_paise`.
- The current `app_settings.delivery_fee_paise` setting is 0 paise; the vendor CSV totals already include the delivery component, so do not add a second delivery charge.
- Fresh Punjab Milk and Kolkata Milk Centre have since been removed from the active vendor catalogue and development database by forward migration `20261112095741_remove_unpriced_milk_vendors`.
- The inventory rows currently report zero available stock. This PR does not make stock claims or reserve stock; stock reservation and checkout-time concurrency controls belong to order creation.
- The public catalogue view is marked SECURITY DEFINER by the Supabase advisor. The new cart validator deliberately queries RLS-protected base tables and does not use that view.

## Safety boundaries
- No live database writes, schema changes, migrations or seed changes are part of this PR.
- No guest-cart persistence or cart table writes are enabled.
- No service-role key is used.
- This API validates a submitted cart only; it does not create an order or reserve inventory.
- Checkout, address/slot validation, order creation and payments remain later Phase 4 sub-phases.

## Verification still required
- GitHub Actions CI must pass for lint, typecheck, unit tests and production build.
- Run authenticated/anonymous runtime tests against a disposable Supabase environment, including tampered prices, disabled vendors, inactive mappings, missing prices, duplicate current prices, Canteen fee mismatch and RLS behavior.
- The live project has migration history entries beyond the four migration files currently represented in the repository. Reconcile that migration-history drift before any schema migration is proposed.
