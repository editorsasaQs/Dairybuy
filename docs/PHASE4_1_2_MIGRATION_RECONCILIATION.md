# Phase 4.1.2 — Migration and GitHub Workflow Reconciliation

**Status:** Prepared on `chore/phase-4-1-2-migration-reconcile`  
**Environment inspected:** Dairybuy-dev only  
**Production:** Not accessed or modified  
**Database writes / migrations:** None

## 1. Migration ledger reconciliation

The three Phase 4 security migrations exist in `main` under filenames whose timestamps do not match the already-applied Dairybuy-dev migration ledger.

| Existing main filename | Applied Dairybuy-dev version | Canonical filename prepared on this branch |
|---|---:|---|
| `20261109133000_optimize_rls_auth_initplans.sql` | `20261108201234` | `20261108201234_optimize_rls_auth_initplans.sql` |
| `20261108203000_index_unindexed_foreign_keys.sql` | `20261108202047` | `20261108202047_index_unindexed_foreign_keys.sql` |
| `20261108202500_split_overlapping_rls_write_policies.sql` | `20261108203804` | `20261108203804_split_overlapping_rls_write_policies.sql` |

The migration history table on Dairybuy-dev reports the versions and names shown above. Its `statements[1]` SQL was read for each version and compared with the corresponding current `main` migration file:

- FK-index migration: exact byte-for-byte match.
- RLS write-policy split: exact byte-for-byte match.
- RLS initplan optimization: same SQL after trimming the final newline; no SQL statement difference.

The migration order in the database is therefore initplan optimization, FK indexes, then policy split. The canonical filenames prepared here reflect that applied order.

**Why this correction:** Supabase migration tracking is version-based. Keeping the newer filenames risks making already-applied changes appear as pending migrations. The canonical filenames now match the development ledger. The SQL bodies were not edited.

**Important:** This is a repository-only correction. No migration was executed, marked applied, repaired, or otherwise changed in Supabase. Before any future migration command, run a read-only migration-list comparison and confirm all 18 remote versions are represented locally with no unexpected pending versions.

## 2. GitHub Actions workflow hardening

The previous `.github/workflows/auth-pr-checks.yml` had `contents: write`, an explicit GitHub token on checkout, a lockfile regeneration step, and an automatic commit/push back to the checked-out branch.

That is unnecessary for a verification workflow and creates an avoidable write path during PR validation.

The version prepared on this branch:

- uses `contents: read`;
- checks out the exact PR head SHA (or push SHA);
- disables persisted checkout credentials;
- installs from the committed lockfile with `npm ci`;
- runs ESLint, TypeScript, unit tests, and the application build;
- never commits or pushes changes.

The existing Node 22 runtime and test commands are retained. The workflow remains a verification workflow; it does not deploy or apply database migrations.

## 3. Main branch protection and Vercel release risk

GitHub API inspection reported classic branch protection disabled for `main`. Ruleset access could not be verified through the available API response.

Vercel inspection found the Git-linked `dairy-buy` project currently maps the inspected `main` commit to a READY deployment with target `production`. The project has the production aliases `dairy-buy.vercel.app`, `dairy-buy-ecmdenmatrix.vercel.app`, and `dairy-buy-git-main-ecmdenmatrix.vercel.app`.

This means a merge to `main` may trigger a production-target deployment automatically. No Vercel settings were changed.

Recommended manual repository settings before any PR merge:
1. Protect `main`; require pull requests.
2. Require the Auth PR checks (and the broader application CI checks) to pass.
3. Require conversation resolution and at least one approval if available.
4. Block force pushes and branch deletion.
5. Ensure administrators do not bypass required checks during normal development.

Recommended Vercel control:
- Keep feature branches on Preview.
- Do not change production branch, project settings, aliases, or deployment settings without separate explicit approval.
- Treat every merge to `main` as a potential production release until Vercel auto-deploy behaviour is deliberately changed and separately approved.

## 4. Explicit non-actions

- No production deployment, database, domain, alias, or environment variable was modified.
- No Dairybuy-dev data or schema was modified.
- No migration was applied.
- No index was deleted.
- No PR was merged.
- Leaked Password Protection remains deferred.
- `payment_webhook_events` remains intentionally server-only with no client RLS policy.
- The 52 unused-index INFO findings remain for later evidence-based review.

## 5. Validation still required before merge

1. Review the branch diff and confirm the three migration renames only (no SQL body change).
2. Let GitHub Actions run on the draft PR; require lint, typecheck, unit tests, and build to pass.
3. Confirm the migration filenames align with the 18 applied Dairybuy-dev versions.
4. Review the main branch protection settings manually.
5. Obtain explicit approval before merging this PR.

