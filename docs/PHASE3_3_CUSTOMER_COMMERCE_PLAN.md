# Phase 3.3 — Customer Commerce Journeys

Branch: `phase3-3-customer-commerce-journeys`
Base commit: `0fb2ca4ed80be9dad85036238b017d2c89eaff54`
Status: In progress

## Audit findings

- The catalogue is already database-backed through `GET /api/catalogue`, with active categories, products, variants and public final prices.
- Category filters and search already exist.
- Product cards currently add the cheapest/default variant directly; customers cannot select pack variants before adding.
- There is no product detail route.
- Milk and canteen milk require the dedicated `/milk` selection flow. Canteen milk must not be added as a plain grocery catalogue line because server validation requires its canteen vendor, milk type and volume.
- The shared bag already supports quantity changes/removal and authenticated persistence. Its hydrated non-milk line key currently omits the variant ID, so different pack variants of one product can collide.
- Account profile exists, but order history is intentionally not connected yet. Do not invent orders or cancellation/refund states; actual order creation/payment lifecycle is a later phase.

## Scope for this implementation

1. Add a database-backed product detail journey using the existing public catalogue API.
2. Let customers choose an active, priced, orderable non-milk variant and quantity before adding it to the bag.
3. Route standard milk and canteen milk cards to the existing milk selection page; never add milk through the generic catalogue action.
4. Use variant-specific catalogue bag keys and preserve those keys when authenticated carts hydrate, so pack variants remain distinct.
5. Keep catalogue search/categories, server-side cart validation, cart ownership, pricing authority and checkout gating intact.
6. Add focused unit tests for catalogue mapping and variant-specific cart identity.

## Explicitly out of scope

- No Supabase schema/migration/RLS changes.
- No price formulas, price seeds, vendor mappings or inventory changes.
- No checkout activation, order creation, payment gateway, refunds or cancellation transitions.
- No subscription creation, renewal, pause/skip or delivery scheduling.
- No production deployment or domain switch.

## Verification gate

Run lint, typecheck, unit tests, build and the existing database-RBAC/auth E2E workflows. Deploy only a Vercel Preview. Do not merge until the owner has reviewed the Preview and explicitly approves.
