# Dairybuy development database migration reconciliation

## Scope

This is a repository-only reconciliation for the connected Supabase development project:

- Project: `Dairybuy-dev`
- Project ref: `xdtdryvccuflkrogvtdo`
- Observed database status: `ACTIVE_HEALTHY`
- Latest applied migration at audit time: `20261114072429_phase4_4_6_3_customer_delivery_confirmation`

No hosted schema or migration history was changed by this work.

## Problem found

The GitHub `main` migration directory had seven historical migrations whose filenames no longer matched versions recorded in `supabase_migrations.schema_migrations`. Several SQL bodies had also drifted from the exact SQL already applied to Dairybuy-dev. A normal migration push would therefore interpret some already-applied changes as pending and could replay schema operations.

The seven canonical files in this branch are restored from the exact stored SQL for these already-applied versions:

| Applied version | Canonical migration |
|---|---|
| `20261113133627` | `phase4_3_1_address_defaults` |
| `20261113230818` | `phase_4_4_1_order_schema_contract` |
| `20261114014841` | `phase_4_4_2_transactional_cod_order_rpc` |
| `20261114035144` | `phase4_4_4_customer_order_cancellation` |
| `20261114040922` | `phase4_4_5_order_fulfillment_transition` |
| `20261114065440` | `phase4_4_6_2_immutable_delivery_address_snapshot` |
| `20261114072429` | `phase4_4_6_3_customer_delivery_confirmation` |

The SQL is sourced from the database's recorded migration statements, not reconstructed from memory. Phase 4.4.6.3 was already byte-for-byte identical; its filename is now aligned with the applied version.

## Forward changes preserved

Two later functional changes must remain available to an existing database without rewriting its applied history:

1. The selected milk SKU and deterministic inventory reservation logic is delivered by the existing forward migration `20261115100000_phase4_4_6_4_milk_inventory_sku_reservation.sql`.
2. The same migration now also replaces the existing order-address snapshot trigger function with a `FOR SHARE` lock on the owned customer address. This prevents a concurrent address edit from racing the immutable checkout-time snapshot.

The Phase 4.4.6.2 pgTAP regression now asserts that this lock remains present. The 4.4.4 and 4.4.5 differences were formatting/comments; the live functions already contain their row-lock and same-state idempotency behavior. The Phase 4.3.1 difference was commentary only; its customer profile row lock was already present in the database.

## Pending migrations after the reconciled baseline

These repository migrations are newer than the observed database ledger and are not yet applied to Dairybuy-dev:

- `20261115100000_phase4_4_6_4_milk_inventory_sku_reservation`
- `20261115130000_phase4_4_6_5_inventory_reservation_reconciliation`
- `20261115140000_phase4_5_1_cod_cash_collection_recording`
- `20261115160000_phase4_5_2_cod_cash_collection_review`
- `20261115170000_phase4_5_3_cod_reconciliation_financial_reports`
- `20261115180000_phase5_subscription_pending_payment_status`
- `20261115190000_phase5_subscription_quote_and_payment_intent`
- `20261115200000_phase5_subscription_lifecycle_controls`
- `20261115210000_phase5_subscription_delivery_generation_and_operations`
- `20261115220000_phase5_5_pause_reservation_release`

Apply them only after this branch passes the complete disposable-local Supabase migration/pgTAP, application CI, and authenticated E2E checks. Then verify the remote migration ledger and run Supabase security/performance advisors. Do not use a migration repair operation to mark these pending changes as applied.

## Environment and release boundary

- The Vercel project `dairy-buy` is Git-linked to `saifabedin/DairyBuy`, but its latest production-target deployment at audit time was still on the older Phase 4.4.6.3 commit.
- Its `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` point to `Dairybuy-dev`. The Vercel project is not currently connected to a separate active production Supabase project.
- The Vercel project reports `live=false`, has no `dairybuy.com` domain attached, and its default deployment domains are SSO protected. Treat this as a protected staging target, not a public production release.
- The Vercel project currently has no `CRON_SECRET`; the scheduled subscription generator must remain disabled until the correct development/production environment is selected and its secrets are configured.
- The existing `payment_webhook_events` table is intentionally server-only with RLS enabled and no client policies. This reconciliation does not expose it or change its grants.
- No production database, deployment, domain, alias, payment gateway, or real-money payment operation is changed by this branch.

## Next release gates

1. Pass CI and review this migration reconciliation PR.
2. Apply the ten pending migrations to Dairybuy-dev in order, then verify the applied ledger and advisors.
3. Deploy the reconciled main build to a protected Vercel Preview using the development database and server-only preview secrets; verify the customer/admin/staff flows and the cron endpoint with a non-production test.
4. Create/activate a separate production Supabase project and configure production-only environment variables before any public production deployment.
5. Select and configure the online payment gateway before Phase 6 webhook verification and paid subscription activation.
