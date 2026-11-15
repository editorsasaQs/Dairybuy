# Dairybuy Phase 4.3–4.4 Security Hardening

Applied to Supabase project `Dairybuy-dev` (`xdtdryvccuflkrogvtdo`) on 2026-11-06.

## Applied migrations

- `20261106000835_phase4_3_security_hardening.sql`
- `20261106000950_phase4_4_private_staff_helpers.sql`

These files reproduce the SQL recorded in Supabase migration history. No existing migration was edited or replayed.

## Phase 4.3 changes

- Removed all Data API privileges on `carts` and `cart_items` from `anon`.
- Kept authenticated SELECT/INSERT/UPDATE/DELETE for customer cart persistence.
- Revoked TRUNCATE, REFERENCES, TRIGGER and MAINTAIN from PUBLIC, anon and authenticated on cart tables.
- Restricted cart policies to authenticated users who own the cart, while preserving staff access through `is_staff()`.
- Changed `public_catalogue` to `security_invoker = true` while retaining its security barrier.
- Kept only SELECT on the public catalogue view for anon/authenticated.
- Granted anon/authenticated only the variant columns required by the safe catalogue projection; purchase and delivery cost columns remain unavailable.
- Fixed function search paths; changed `get_auth_uid()` to SECURITY INVOKER.
- Revoked direct API EXECUTE on `rls_auto_enable()`; the existing event trigger remains installed.

## Phase 4.4 changes

- Created a non-exposed `private` schema.
- Moved SECURITY DEFINER staff-role and permission implementations into `private`, with an empty search path and schema-qualified references.
- Kept the existing public helper function names as SECURITY INVOKER wrappers for compatibility with existing policies and RPC callers.
- The private helper functions are callable by database roles used by RLS, but the `private` schema is not listed in `supabase/config.toml` API schemas.

## Verification performed against live Supabase

- Anonymous query against `public.public_catalogue`: 22 rows returned.
- Owner identity: `is_owner`, `is_admin_or_owner`, `is_staff` all returned true; 12 products and 22 catalogue rows visible.
- Anonymous identity: all three helpers returned false; 12 active products and 22 catalogue rows remained visible.
- Cart isolation: a non-owner authenticated identity saw 0 rows for another customer's cart.
- Anonymous SELECT/INSERT on cart tables denied by privilege checks.
- Authenticated SELECT remained granted; TRUNCATE and TRIGGER privileges were false.
- Public variant selling price column remained readable; purchase price and delivery component columns remained unreadable.
- Direct anon/authenticated EXECUTE on `rls_auto_enable()` was false.
- Event-trigger smoke test: creating a temporary public table caused RLS to be enabled automatically.
- Security Advisor no longer reports the public SECURITY DEFINER function warnings or mutable search-path warnings.
- The 30-assertion Phase 4.3–4.4 pgTAP regression file passed against the live project.
- Local Supabase config now targets PostgreSQL 17 to match the remote PostgreSQL 17.11 project.

## Remaining dashboard action

Supabase Auth leaked-password protection is still disabled. This is an Auth dashboard setting, not changed by these SQL migrations. Enable it under Authentication → Security and verify the Security Advisor afterward.

## Intentionally not changed

- `payment_webhook_events` remains RLS-enabled with no policies (default deny) pending webhook access-path verification.
- No order creation, stock reservation, guest-cart database persistence, subscription, payment or delivery behavior was changed.
- No broad index cleanup was attempted; performance Advisor still reports pre-existing unindexed foreign keys and RLS init-plan/multiple-permissive-policy findings. Review those separately to avoid unnecessary schema changes.
