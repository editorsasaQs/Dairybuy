# Supabase Phase 4.3–4.4 Migration Reconciliation

## Why this document exists

A live-database audit on 2026-11-06 found two migrations already recorded in the Supabase project migration history but missing from the GitHub `main` migration directory. The SQL was recovered from `supabase_migrations.schema_migrations.statements`, then copied into this repository without reapplying it.

## Canonical applied migrations

| Version | Name | Purpose |
| --- | --- | --- |
| `20261106000835` | `phase4_3_security_hardening` | Restricts anonymous cart access, removes non-DML cart privileges, preserves authenticated owner/staff RLS, enables `security_invoker` on the public catalogue view, limits public variant column reads, pins function search paths, and revokes API execution of the RLS event-trigger helper. |
| `20261106000950` | `phase4_4_private_staff_helpers` | Moves privileged staff-role checks into the non-public `private` schema; keeps public compatibility wrappers as `SECURITY INVOKER` functions with fixed search paths. |

## Exactness verification

The migration SQL was compared using Git's blob SHA-1 algorithm:

```
20261106000835  fcc87db41d1ac9e87cff76181dde41c98cd8ebc8
20261106000950  9f7c760abb8ed6dd53505c443f55df3aab229b2f
```

The hashes above were calculated independently from the live database's stored SQL and matched the GitHub blobs for the files in this branch.

## Read-only verification performed

- Database reports PostgreSQL 17.11.
- Both migrations are present in the live migration history.
- `public.public_catalogue` has both `security_barrier=true` and `security_invoker=true`.
- An `anon` role query successfully read 22 rows from `public.public_catalogue`.
- `anon` cannot SELECT or INSERT into carts; neither `anon` nor `authenticated` has cart TRUNCATE.
- `anon` cannot read `product_variants.purchase_price_paise`, but can read `final_price_paise`.
- Public staff helper wrappers are not SECURITY DEFINER; their private implementations are SECURITY DEFINER, check `auth.uid()` for NULL, use an empty search path, and access role tables via schema-qualified names.
- Cart and cart-item tables currently contain zero rows.

## Scope and safety notes

- This PR synchronizes already-applied migrations into Git. It does not apply or reapply SQL.
- Guest carts remain in client-side session storage; this work does not enable guest-cart persistence.
- Authenticated cart CRUD remains governed by the existing owner/staff RLS policies.
- No cart uniqueness constraints, cart API writes, order creation, stock reservation, or subscription behavior are introduced here.
- The Supabase Security Advisor still reports leaked-password protection disabled and the intentionally policy-less `payment_webhook_events` table. These require separate product/configuration review.
- Performance Advisor findings (including unindexed foreign keys and multiple permissive policies) are not silently changed by this migration sync.

## Follow-up

Keep the GitHub migration directory and Supabase migration history in lockstep. Do not run `db push` or reapply these two migrations; they are already present in the remote history.


## Additional regression coverage (2026-11-06)

- Updated `src/lib/services/__tests__/database-schema.test.ts` to use the canonical Supabase migration version IDs instead of the retired local filenames.
- Added `supabase/tests/database/cart_security_regression.test.sql` with 14 pgTAP assertions covering anonymous cart denial, cart TRUNCATE denial, public/private price columns, catalogue view security-invoker mode, public/private staff helper behavior, event-trigger helper execution denial, customer cart isolation, and manager operational visibility.
- Executed the new regression SQL against Dairybuy-dev inside a transaction. All 14 assertions passed; synthetic auth users and cart fixtures were rolled back.
- Also executed the existing database smoke suite (31 assertions) and customer isolation suite (22 assertions) against Dairybuy-dev; all assertions passed.
- GitHub Actions on commit `62ef898018b4096d11e7684037150ae679d78a4c` passed lint, TypeScript, unit tests and production build. A fresh run is being triggered for the final PR head after adding the regression SQL and workflow path filter.

## Remaining follow-ups (not blockers for migration-history synchronization)

1. Enable Supabase Auth leaked-password protection in the project's Auth security settings before production.
2. Review the intentionally default-deny `payment_webhook_events` table and document its service-role-only writer/reader path.
3. Review remaining RLS advisor warnings and indexes deliberately; do not bulk-rewrite policies or drop unused indexes without query-plan and role-behavior checks.
4. Implement authenticated cart persistence and atomic active-cart/line upsert as a separate Phase 4.2 completion task. Guest carts remain sessionStorage-only.
5. Perform browser/API end-to-end QA with actual customer and staff accounts before production launch.


## Reconciliation note (2026-11-06)

- The Phase 4.3 and 4.4 migration files are kept byte-for-byte identical to the SQL already recorded in `Dairybuy-dev`; do not edit or replay them.
- Both regression suites are retained: `phase4_security_hardening.test.sql` (30 assertions) and `cart_security_regression.test.sql` (14 assertions). They were executed against the live development project in rolled-back transactions.
- The local Supabase CI workflow from the earlier draft is intentionally not included yet. A fresh local `supabase start` currently fails while replaying Phase 4.3 because `public.rls_auto_enable()` exists in the remote project but is not created by any migration in the repository. That platform/project bootstrap dependency must be versioned or explicitly handled before enabling local database CI. The migration SQL itself is preserved unchanged.
- The auth/unit CI remains enabled and is extended to trigger when `supabase/config.toml` changes.
