# Phase 4.3 — Address, Serviceability, Delivery Slots & Checkout Validation

Status: Phase 4.3.1 (PR #47), 4.3.2 (PR #48), 4.3.3 (PR #49), and 4.3.4 (PR #50) are merged. PR #50 passed lint, typecheck, unit tests, production build, disposable Supabase Auth E2E, and database-RBAC pgTAP. Phase 4.3.5 authenticated checkout integration/browser coverage remains next. The address-default migration was applied to Dairybuy-dev only; no delivery-slot migration is needed; production remains untouched.

## Owner-confirmed delivery contract (authoritative)

The following delivery windows are FINAL. Do not change, replace, or display any alternate windows.

| Slot | Delivery window | Same-day order cutoff | Cancellation deadline |
|---|---|---|---|
| Morning | **8:00 AM–11:00 AM** | **7:00 AM** | **7:30 AM** |
| Evening | **5:00 PM–9:00 PM** | **4:00 PM** | **4:30 PM** |

Timezone for all server-side comparisons and API responses: `Asia/Kolkata`.

- The two approved delivery windows above are the only active windows. Do not introduce alternate delivery windows in UI, tests, seed updates, or future migrations.
- Current `Dairybuy-dev.public.delivery_slots` rows already match the final windows, cutoffs and cancellation deadlines. Keep the existing slot IDs and values; **no delivery-slot data migration is required**.
- Historical seed and hardening migrations are immutable. Do not rewrite them to change slot timing.
- Cancellation is allowed through the stated deadline; after the deadline it is rejected. Confirm the intended date/slot eligibility with the existing order rules before implementing order cancellation in Phase 4.4.

## Verified current database facts

- `customer_addresses` already exists with: `id`, `customer_id`, `service_area_id`, `address_type`, `recipient_name`, `phone`, `address_line1`, `address_line2`, `landmark`, `city`, `state`, `pincode`, `is_default`, timestamps.
- RLS is enabled with customer-scoped SELECT/INSERT/UPDATE/DELETE policies. SELECT also allows staff through `is_staff()`.
- `customer_id` references `auth.users(id)`; `service_area_id` references `service_areas(id)` and becomes NULL if the area is deleted.
- Existing indexes cover `customer_id` and `service_area_id`; partial unique index `uq_customer_addresses_one_default` now enforces at most one default address per customer.
- No duplicate default-address customers were found before migration; the dev database currently has no address rows.
- Active service area: Topsia, Kolkata. Active pincodes: `700039`, `700046`, `700100`, `700105`.
- `delivery_slots` already contains active Morning `08:00–11:00`, Evening `17:00–21:00`, cutoffs `07:00`/`16:00`, cancellation deadlines `07:30`/`16:30`.
- Existing read-only endpoints: `GET /api/service-areas/check` and `GET /api/delivery-slots`. Existing DB-backed service functions are `service-area-db-service.ts` and `delivery-config-service.ts`.
- Phase 4.3.1 address management (PR #47) and Phase 4.3.2 serviceability hardening (PR #48) are merged. Authenticated cross-customer address API integration coverage remains a separate outstanding test item.
- Migration `20261113133627_phase4_3_1_address_defaults` was applied to Dairybuy-dev. Function is SECURITY DEFINER, owned by postgres, executable by authenticated/service_role, and not granted to PUBLIC/anon. Production has not been changed.

## Workstream 4.3.1 — Address CRUD

Implemented in PR #47:
- `GET /api/addresses`: list only the authenticated customer's addresses.
- `POST /api/addresses`: validate payload, normalize pincode/phone, resolve active service area from DB, derive `customer_id` from `auth.getUser()`, never trust client-supplied customer or service-area IDs.
- `PATCH /api/addresses/[id]`: update only an address owned by the authenticated customer; recompute service area from the submitted pincode.
- `DELETE /api/addresses/[id]`: delete only an owned address; protect the currently selected checkout address in the later checkout flow.
- `POST /api/addresses/[id]/default`: atomic default selection using per-customer row lock and partial unique index.
- [x] Add address management to the account page.
- [ ] Add a reusable address selector for checkout in the checkout workstream.
- [ ] Add API/RLS integration and browser E2E coverage.
- Do not add map/geocoding requirements or infer address coordinates.

## Workstream 4.3.2 — Serviceability

- Reuse the DB-backed service-area catalogue; do not hardcode launch pincodes in new server validation.
- Validate Indian PIN as exactly six digits.
- Require an active service-area row and active pincode mapping.
- Derive `service_area_id` server-side from pincode; reject client-supplied mismatches.
- On service-area query failure, fail closed with 503; do not treat a DB outage as serviceable.
- Keep only currently active Topsia pincodes serviceable until owner-approved expansion.
- [x] Add unit coverage for active/inactive area and pincode mapping, ASCII six-digit validation, and unknown pincode rejection.
- [x] Add database-query failure tests proving serviceability errors propagate rather than falling back to hardcoded data.
- [x] Add public API tests for valid/inactive pincode, malformed input, missing Supabase configuration, and database outage (503).
- [x] Reject malformed PIN values in the address service before making a database query.
- [ ] Add authenticated address API integration tests for spoofed IDs and cross-customer ownership.

## Workstream 4.3.3 — Delivery slots and server clock

- Keep the two current DB slot rows unchanged: Morning 08:00–11:00; Evening 17:00–21:00.
- Keep same-day order cutoffs at 07:00 and 16:00; cancellation deadlines at 07:30 and 16:30.
- Keep `GET /api/delivery-slots` as the customer-safe source of active slot IDs, labels and time rules.
- [x] Implement shared server-side time helpers using `Intl.DateTimeFormat`; business comparisons explicitly use `Asia/Kolkata`, not the runtime timezone or UTC date slicing.
- [x] Add deterministic tests with injected/fixed clock around just-before, exact-deadline and just-after boundaries for both morning and evening rules.
- [x] Wire `GET /api/delivery-slots` to the shared timezone constant and add API tests for DB-backed rules, `no-store`, and fail-closed 503 behavior.
- [x] Complete full CI validation and Vercel Preview deployment (PR #49; final head `afbaab2f116f263cd3d88d911f98dcb7c1023ba3`).
- Do not silently reinterpret the cutoff as delivery start time. Cutoff and cancellation deadline are separate fields.

## Workstream 4.3.4 — Checkout validation (no order creation)

Implemented and merged in PR #50 (`1c9d5788c7c81e8b9a86e35f8ff141c70f2dcd25`):
- [x] Authenticate via server Supabase client and `auth.getUser()`.
- [x] Load the selected address by both address ID and authenticated customer ID.
- [x] Revalidate current active serviceability and derive service area from DB-backed pincode mapping.
- [x] Load selected active delivery slot from DB; ignore browser-supplied labels/times.
- [x] Validate delivery date against the DB-configured slot cutoff using the approved `Asia/Kolkata` server clock.
- [x] Load the authenticated customer's persisted active cart and re-run DB-authoritative product/vendor/price validation.
- [x] Return a server-calculated checkout summary in integer paise and normalized address/slot details.
- [x] Return field-level validation errors; fail closed on Supabase/configuration errors.
- [x] Add route tests for auth, malformed selection, server-calculated preview, field errors and DB failure.
- [x] Add direct service-level tests for ownership, serviceability, stale prices and slot/date boundaries.
- [x] Verify lint, typecheck, unit tests, production build, disposable Supabase Auth E2E, database-RBAC pgTAP, and Vercel Preview on the final PR head.
- [ ] Phase 4.3.5: add authenticated checkout integration/browser coverage against disposable local Supabase, including real RLS/ownership and no-write assertions.

This endpoint only validates and previews checkout. It must not create orders, reserve inventory, initiate payments, or mutate the cart. Phase 4.4 owns COD order creation and order history. Payment provider integrations are not part of the current launch scope.

## Payment policy (owner-confirmed, authoritative)

- **Only Cash on Delivery (COD) is available for the current launch.**
- Razorpay and all online payment methods are deferred; do not add Razorpay SDKs, API keys, payment-order creation, signatures, webhooks, or online-payment UI in the current implementation phases.
- Phase 4.4 must create an order with COD as its only accepted payment method, after reviewing the existing database payment enums/constraints and order schema.
- Checkout must reject any client-supplied payment method other than COD. The server must set/validate the payment method; never trust a browser-calculated payment state.
- Payment collection/settlement state must follow the existing schema and explicit business rules; do not mark COD as paid at order creation. Define delivery-agent cash collection and status transitions before implementing them.
- Keep a future payment-provider extension possible without implementing or exposing Razorpay now.

## Database migration strategy

- No slot timing migration: current DB already matches owner-confirmed values.
- Phase 4.3.1 default-address migration has been applied and verified on Dairybuy-dev only. Do not reapply it; preserve the historical migration file as committed.
- Never rewrite historical migrations. Add new timestamped forward migrations only after SQL review and tests.
- Production remains untouched; no production migration or deployment is authorized by this plan.

## Test matrix

- Anonymous address list/create/update/delete: 401.
- Customer A cannot read/update/delete Customer B address: 404/403 without data leakage.
- Spoofed `customer_id` and `service_area_id`: ignored/rejected; server derives both.
- Valid active Topsia PINs: accepted.
- Invalid format, inactive PIN, outside-area PIN: rejected.
- DB outage during serviceability lookup: fail closed.
- Concurrent set-default requests: at most one default per customer.
- Slot endpoint returns only active DB rows and timezone `Asia/Kolkata`.
- Morning cutoff 06:59:59 accepted; 07:00:00 and later rejected for same-day morning ordering.
- Evening cutoff 15:59:59 accepted; 16:00:00 and later rejected for same-day evening ordering.
- Cancellation deadline boundary: allow through 07:30:00 / 16:30:00, reject after.
- Invalid/inactive slot ID, mismatched address owner, stale cart price, inactive vendor/product, missing address/slot: rejected.
- Checkout validation never inserts orders, payments, refunds or inventory movements.
- Current payment selection is COD only; Razorpay/UPI/card online flows are deferred and must not appear as available methods.

## Completion gates

Lint, typecheck, all unit tests, production build, database-RBAC, auth E2E, new address/serviceability/checkout E2E, and preview smoke tests must pass on the final PR head. Review migration diff and RLS behavior before any shared DB application. No production deployment without explicit approval.
