# Phase 4.2 — Authenticated Cart Persistence

## Audit findings

The pre-existing bag was stored only in `sessionStorage` under `dairybuy_phase3_bag_v1`. The existing `/api/cart/validate` endpoint recalculated prices but did not save cart rows. The live `carts` and `cart_items` tables had no unique active-cart or unique line-selection indexes; both tables were empty at the time of the audit.

The current catalogue uses slug IDs such as `ghee-red-cow` and `butter-amul`, not UUIDs. The former client bag validator incorrectly rejected several real catalogue IDs. This is corrected to accept safe non-milk slugs; the database-backed validator remains authoritative and rejects milk products without a vendor/type selection.

## Implementation in this branch

- Adds a migration with one active cart per authenticated customer and NULL-aware uniqueness for cart lines.
- Adds `public.sync_active_cart(jsonb)`, a SECURITY INVOKER RPC that derives the customer from `auth.uid()`, validates structural bounds, and replaces the complete cart snapshot in one database transaction. A private SECURITY DEFINER trigger independently checks active product/variant, milk/vendor eligibility, current vendor mapping, and exact database price so direct RPC calls cannot persist forged cart prices.
- Adds authenticated `GET /api/cart`, `PUT /api/cart`, and `DELETE /api/cart` handlers. All writes revalidate product, variant, vendor, milk type, availability and price using live database rows. Browser price fields are ignored.
- Adds a persistence service that loads cart lines and reconstructs display metadata from the catalogue.
- Adds one-time guest-to-account merge behavior, debounced server synchronization, account-switch isolation, and local fallback when the API is unavailable.
- Caps cart quantities at the existing database limit of 100.
- Adds unit and migration-contract tests.

## Important security boundary

The stored `unit_price_paise` is a cart display snapshot only. It is never trusted by checkout; checkout/order creation must recalculate from current catalogue and vendor pricing. The RPC is SECURITY INVOKER and only executable by authenticated users. Customer ownership is derived from the signed-in Supabase session, not a request-supplied customer ID.

## Not yet applied or production-ready

- The migration was applied to Dairybuy-dev on 2026-11-06 and recorded as version `20261106113620` (`phase4_2_authenticated_cart_persistence`).
- Live SQL regression suites passed: 20 cart-persistence assertions, 31 security smoke assertions, and 22 customer-auth isolation assertions (73 total). Each suite calls `extensions.finish(true)` so a failed assertion aborts the run.
- Migration indexes, RPC grants, SECURITY INVOKER/DEFINER modes, and trigger installation were independently queried after application.
- Browser QA is still required for guest add → sign in → merge → refresh → sign out → different account. A route-transition rehydration guard was added so cart writes pause until the server cookie session is rechecked after auth redirects.
- No order creation, payment, stock reservation, subscription, or live tracking is part of this phase.

## Acceptance criteria

1. A guest bag remains usable without authentication.
2. Signing in merges guest quantities into the signed-in customer's cart once; refresh does not double quantities.
3. A different account never receives the previous account's cached bag.
4. A signed-in customer's cart survives refresh and a second device.
5. Cart writes are atomic; duplicate active carts and duplicate line selections are prevented by database constraints.
6. Every save revalidates current product/variant/vendor availability and authoritative price.
7. One customer's session cannot read or mutate another customer's cart.
8. Invalid or unavailable lines are not persisted; quantity bounds are enforced server-side and in the database.
