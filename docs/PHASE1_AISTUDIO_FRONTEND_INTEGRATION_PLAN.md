# Dairybuy — Phase 1: AI Studio Frontend Integration Plan

**Date:** 2026-11-18  
**Status:** Planning / gated implementation  
**Target branch:** `chore/aistudio-frontend-import-2026-11-18`  
**Protected baseline:** `main`  
**Source archive:** latest Google AI Studio export supplied in ChatGPT (`untitled.zip`)

## Objective

Integrate the latest AI Studio customer-facing redesign into the canonical Dairybuy application without creating a second backend, a parallel database, or a second checkout/order system. The existing Dairybuy Supabase schema, RPCs, authentication, pricing, inventory, COD operations, subscriptions, and service-area rules remain authoritative.

## Phase 1 scope — source intake and compatibility foundation

1. Preserve the current canonical application and branch from the current `main` baseline.
2. Extract the supplied archive into an isolated import workspace and inventory every route, component, API route, migration, asset, dependency, and environment variable.
3. Compare the AI Studio export with the canonical Next.js application. Classify files as:
   - reusable presentation components;
   - routes that need adaptation to existing app conventions;
   - API code that must be replaced or rewritten against existing contracts;
   - mock/local-only code that must not be treated as production functionality;
   - incompatible migrations that must be excluded from execution.
4. Create a route and component mapping for homepage, catalogue, product detail, milk/vendor selection, cart, checkout, login/signup, customer account, subscriptions, wallet, and admin.
5. Establish the single-backend contract: all customer/admin views must use the existing Dairybuy Supabase project and authoritative database objects. No new Supabase project, duplicate auth, duplicate order model, or client-side authoritative pricing.
6. Produce a compatibility report covering dependencies, environment variables, schema mismatches, RLS/RPC assumptions, and deployment implications.
7. Run static checks and build checks after the safe integration skeleton is prepared. Record failures; do not hide or waive them.

## Explicit exclusions / safety gates

- Do not merge this branch into `main` during Phase 1.
- Do not deploy to Production or change the production domain.
- Do not apply the AI Studio migration `20261118_wallet_and_customer_experience.sql`. It must first be reconciled against the existing migration ledger and schema.
- Do not create new wallet tables or subscription/order tables until the existing data model and intended business rules are reconciled.
- Do not add Razorpay, Cashfree, or any online payment gateway in this phase.
- Do not replace existing COD order creation, pricing, inventory, role authorization, or RLS with AI Studio API implementations.
- Do not commit secrets, service-role keys, access tokens, or populated `.env` files.

## Known compatibility risks from initial archive review

The export is a Next.js 15.4.9 / React 19 project. Initial review found API/schema assumptions that do not match the existing Dairybuy database, including `orders.user_id` vs `orders.customer_id`, `addresses` vs `customer_addresses`, `subscriptions.user_id` vs `subscriptions.customer_id`, JSON order items vs normalized `order_items`, and role lookup through `profiles.role` rather than the existing `user_roles` model. Checkout must be reconciled with the existing authoritative COD order RPC. These are integration blockers, not reasons to mutate the database to fit the export.

## Phase 1 deliverables

- Complete archive file manifest and route/component inventory.
- Current-app vs AI Studio route mapping.
- API and Supabase schema compatibility matrix.
- Asset/dependency/environment-variable inventory.
- Explicit migration disposition (keep, rewrite, or reject) with no unreviewed migration execution.
- A tested integration skeleton on this branch.
- A Phase 2 implementation plan with ordered tasks and acceptance criteria.

## Acceptance criteria

Phase 1 is complete only when:
- every archive route and API route has a documented disposition;
- every reused UI route is mapped to the canonical application;
- no duplicate backend or competing source of truth is introduced;
- schema/API mismatches have concrete remediation decisions;
- migration safety review is documented;
- lint/typecheck/build results are recorded;
- the branch is reviewable without changing `main`, Dev data, or Production.

## Next phase preview

Phase 2 will implement the approved customer UI integration incrementally, starting with the shared design system/layout and public storefront routes. Account, checkout, subscription, wallet, and admin integrations will follow only after their API contracts are mapped to existing Dairybuy services and database objects.
