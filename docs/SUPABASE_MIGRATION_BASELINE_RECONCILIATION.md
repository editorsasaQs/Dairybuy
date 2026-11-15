# Supabase Migration Baseline Reconciliation

- Project: `Dairybuy-dev` (`xdtdryvccuflkrogvtdo`)
- Source of truth: the live database's `supabase_migrations.schema_migrations.statements`.
- Each canonical migration file was reconstructed from the exact stored SQL statement, retrieved in bounded read-only chunks.
- No database schema, migration history, or application data was changed.

| Applied version | Name | Canonical file |
|---|---|---|
| `20261105152416` | `phase4_schema` | `supabase/migrations/20261105152416_phase4_schema.sql` |
| `20261105170122` | `phase4_seed` | `supabase/migrations/20261105170122_phase4_seed.sql` |
| `20261105170726` | `phase4_rls` | `supabase/migrations/20261105170726_phase4_rls.sql` |
| `20261105170948` | `phase4_1_confirmed_csv_catalogue` | `supabase/migrations/20261105170948_phase4_1_confirmed_csv_catalogue.sql` |
| `20261105171102` | `phase4_2_security_config_hardening` | `supabase/migrations/20261105171102_phase4_2_security_config_hardening.sql` |
| `20261105171227` | `phase5_auth_provisioning` | `supabase/migrations/20261105171227_phase5_auth_provisioning.sql` |
| `20261105192022` | `enable_pgtap_testing` | `supabase/migrations/20261105192022_enable_pgtap_testing.sql` |
| `20261105203738` | `restrict_public_variant_cost_access` | `supabase/migrations/20261105203738_restrict_public_variant_cost_access.sql` |
| `20261105205145` | `public_catalogue_safe_view` | `supabase/migrations/20261105205145_public_catalogue_safe_view.sql` |

The prior local filenames used timestamps that did not match the remote applied versions. Their contents also differed from the recorded SQL for several migrations (notably seed, RLS, catalogue cleanup, and security hardening). This branch replaces the stale active migration filenames with the exact applied baseline, preventing the CLI from interpreting those old timestamps as new pending migrations.

This is repository-only reconciliation. Do not run `db push`, reset, or reapply these migrations as part of this change.
