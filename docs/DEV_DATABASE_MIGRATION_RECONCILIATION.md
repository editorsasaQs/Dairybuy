# Dairybuy development database migration reconciliation

## Scope and current status

This reconciliation applies only to the connected Supabase development project:

- Project: `Dairybuy-dev`
- Project ref: `xdtdryvccuflkrogvtdo`
- Observed database status: `ACTIVE_HEALTHY`
- Migration ledger after reconciliation: **41 migrations**
- Latest applied migration: `20261115131405_phase4_6_1_physical_stock_ledger_receiving_adjustments`
- Pending migrations relative to the current repository: **0**

The original 28-migration baseline was retained. Thirteen forward migrations were applied in dependency order after the reconciled baseline. No migration repair operation was used.

## Historical filename and SQL reconciliation

The GitHub `main` migration directory had seven historical migrations whose filenames no longer matched versions recorded in `supabase_migrations.schema_migrations`. Several SQL bodies had also drifted from the exact SQL already applied to Dairybuy-dev. A normal migration push would therefore have replayed already-applied schema operations.

The seven canonical files were restored from the exact stored SQL for these already-applied versions:

| Applied version | Canonical migration |
|---|---|
| `20261113133627` | `phase4_3_1_address_defaults` |
| `20261113230818` | `phase_4_4_1_order_schema_contract` |
| `20261114014841` | `phase_4_4_2_transactional_cod_order_rpc` |
| `20261114035144` | `phase4_4_4_customer_order_cancellation` |
| `20261114040922` | `phase4_4_5_order_fulfillment_transition` |
| `20261114065440` | `phase4_4_6_2_immutable_delivery_address_snapshot` |
| `20261114072429` | `phase4_4_6_3_customer_delivery_confirmation` |

The SQL was sourced from the database's recorded migration statements, not reconstructed from memory.

## Forward migrations applied to Dairybuy-dev

All thirteen forward migrations were applied successfully, in order:

| Applied version | Migration |
|---|---|
| `20261115131246` | `phase4_4_6_4_milk_inventory_sku_reservation` |
| `20261115131304` | `phase4_4_6_5_inventory_reservation_reconciliation` |
| `20261115131309` | `phase4_5_1_cod_cash_collection_recording` |
| `20261115131315` | `phase4_5_2_cod_cash_collection_review` |
| `20261115131320` | `phase4_5_3_cod_reconciliation_financial_reports` |
| `20261115131325` | `phase5_subscription_pending_payment_status` |
| `20261115131330` | `phase5_subscription_quote_and_payment_intent` |
| `20261115131335` | `phase5_subscription_lifecycle_controls` |
| `20261115131351` | `phase5_subscription_delivery_generation_and_operations` |
| `20261115131354` | `phase5_5_pause_reservation_release` |
| `20261115131358` | `phase5_6_subscription_per_delivery_cod` |
| `20261115131401` | `phase5_7_admin_customer_delivery_confirmation` |
| `20261115131405` | `phase4_6_1_physical_stock_ledger_receiving_adjustments` |

The repository migration filenames are being aligned to these exact applied versions so that a future `supabase db push` sees the same ledger.

## Post-migration advisor findings

The Supabase advisors were run after the 13 migrations.

### Security

- Six RLS-enabled tables intentionally have no client policies and therefore remain default-deny: COD adjustment and delivery cash-handover audit tables, delivery assignment links, and payment webhook events.
- Twenty-nine authenticated SECURITY DEFINER RPCs are flagged. These are intended API entry points for customer or owner/admin workflows; each must retain its own ownership/role checks and empty search path. The linter does not infer those internal guards.
- Leaked-password protection is disabled in Supabase Auth. Enable it in the Auth password security settings before public production launch: [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

### Performance

- Fifteen foreign keys are missing covering indexes. This includes the new receipt-item SKU FK and older COD, handover, order and subscription relationships. Add and verify the indexes in a dedicated performance-hardening migration.
- Two existing RLS policies on subscription vendor-change and lifecycle-event tables should wrap `auth.uid()` in a scalar `SELECT` to avoid per-row re-evaluation.
- Sixty-one indexes are reported unused. This is a low-traffic development database; do not drop them based only on this observation.

## Environment and release boundary

- Vercel project `dairy-buy` is Git-linked to `saifabedin/DairyBuy`. Its last inspected deployment was protected and not a public production release.
- The Vercel project was observed pointing its Supabase URL variables at `Dairybuy-dev`; a separate active production Supabase project and production secrets are still required.
- The project had no configured `CRON_SECRET` at the last environment audit. Keep scheduled subscription generation disabled until the correct environment and secret are configured.
- No production database, production deployment, domain, alias, payment gateway or real-money payment operation was changed by this reconciliation.

## Next release gates

1. Merge this migration-filename synchronization PR so local and remote migration versions match exactly.
2. Implement Phase 4.6.2 owner/admin inventory receiving and adjustment UI, then integrate the physical-stock audit with the existing reservation audit.
3. Add the fifteen FK indexes and two RLS init-plan fixes in a reviewed performance-hardening migration; re-run advisors.
4. Deploy the reconciled build to a protected Vercel Preview using development-only secrets and verify customer/admin flows. No delivery-agent interface is in launch scope.
5. Create/activate a separate production Supabase project and configure production-only environment variables before any public deployment.
6. Select and configure the online payment gateway before Phase 6 webhook verification and online payment activation.
