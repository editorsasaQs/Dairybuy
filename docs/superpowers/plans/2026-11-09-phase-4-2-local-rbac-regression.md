# Phase 4.2 Local RBAC Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the actual `public.user_roles` RLS policies enforce owner, admin, and customer role-assignment boundaries on a disposable local Supabase database.

**Architecture:** Extend the existing pgTAP test with synthetic Auth fixtures and actor-specific JWT claims, then run the SQL statements as PostgreSQL's `authenticated` role. Preserve the existing local-only CI job and update the audit document with fresh test evidence.

**Tech Stack:** PostgreSQL, Supabase CLI 3.0.0, pgTAP (`extensions` schema), GitHub Actions, Markdown.

**Spec:** `docs/superpowers/specs/2026-11-09-phase-4-2-local-rbac-regression-design.md`

## Global Constraints

- Synthetic Auth fixtures are permitted only on a fresh disposable local Supabase database.
- Never run `supabase test db` against Dairybuy-dev or Production.
- Do not create hosted test users or clean up remote accounts.
- Do not apply migrations to Dairybuy-dev or Production.
- Do not merge a PR without separate explicit approval.
- Preserve the server-only `payment_webhook_events` policy exception; it is unrelated to this work.
- No new dependency or hosted test workflow.
- Keep all fixture creation and DML inside the test's outer transaction and finish with `ROLLBACK`.

## Review Focus

- **Admin attempts to grant owner:** INSERT and UPDATE must be denied; assert SQLSTATE/unchanged row under RLS.
- **Admin attempts self-role-change:** UPDATE must affect zero rows and leave the actor's role unchanged.
- **Customer attempts role mutation:** INSERT must be rejected; UPDATE and DELETE must affect zero rows.
- **Admin attempts to mutate an existing owner assignment:** UPDATE/DELETE must affect zero rows.
- **Owner allowed operations:** owner can insert, update, and delete supported role assignments, including assigning owner; prove each with returned/visible rows.

---

### Task 1: Add real owner/admin/customer RLS behavior tests

**Files:**
- Modify: `supabase/tests/database/rbac_customer_admin_boundary.test.sql`

**Interfaces:**
- Consumes: Existing migration-created policies `user_roles_manage_admin_owner_insert`, `user_roles_manage_admin_owner_update`, `user_roles_manage_admin_owner_delete`, and `user_roles_select_own`.
- Produces: A single pgTAP test suite that proves the current policy behavior using `SET LOCAL ROLE authenticated` and request JWT claim settings.

- [ ] **Step 1: Add deterministic fixtures before actor-level tests**

  Create synthetic Auth users for one owner, one admin, one customer, and dedicated target users (at least one target for each role transition). Let the existing Auth trigger create default customer role rows, then promote fixture actors/targets to their intended roles using the privileged test setup before switching to `authenticated`. Use stable UUIDs and `@test.invalid` email addresses. Keep all rows inside the existing transaction.

- [ ] **Step 2: Add failing owner behavior assertions**

  As the owner actor, execute an INSERT assigning an owner role to a target, an UPDATE changing a target role, and a DELETE of a target assignment. Assert each operation succeeds and its expected persisted row state is visible after resetting to the test role. Use a fresh target per destructive assertion so the cases do not depend on execution order.

- [ ] **Step 3: Run the focused suite and confirm the new assertions execute**

  Run only against a newly started disposable local Supabase stack:
  `supabase start`
  `supabase test db supabase/tests/database/rbac_customer_admin_boundary.test.sql`
  Expected: the new owner cases pass; any failure must be investigated as either a fixture/schema mismatch or a policy behavior mismatch. Do not point this command at a linked project.

- [ ] **Step 4: Add failing admin allow/deny assertions**

  As the admin actor, assert INSERT of `admin` and `customer` roles for other users succeeds. Assert INSERT of `owner` is rejected (expect RLS SQLSTATE `42501`). Assert UPDATE that would promote a target to `owner` is rejected by WITH CHECK (SQLSTATE `42501`). Assert UPDATE/DELETE against an existing owner assignment affect zero rows because the admin policy USING clause excludes owner rows. Assert UPDATE of the admin's own role affects zero rows. Confirm allowed target admin/customer changes persist.

- [ ] **Step 5: Add failing customer mutation assertions**

  As the customer actor, assert INSERT into `user_roles` is rejected (SQLSTATE `42501`). Assert UPDATE of the customer's own role and DELETE of the customer's own role affect zero rows. Verify the customer can still SELECT only their own role row and cannot see other fixture users' role rows.

- [ ] **Step 6: Verify the red/green behavior against local Supabase**

  Run the focused pgTAP test on the disposable local stack. For each new policy assertion, confirm the expected operation is being attempted under `authenticated` and that the failure is due to RLS (not malformed fixtures, enum casts, missing grants, or a SQL syntax error). Keep denied UPDATE/DELETE checks as row-count/state assertions because RLS USING filters can silently affect zero rows rather than raise an exception.

- [ ] **Step 7: Update the pgTAP plan count and run the complete database test suite**

  Set `extensions.plan(N)` to the exact number of assertions after additions. Run:
  `supabase test db`
  Expected: all database tests pass, including existing RLS policy split and RBAC tests. Stop the local stack with `supabase stop --no-backup`.

- [ ] **Step 8: Commit the test changes**

  ```bash
  git add supabase/tests/database/rbac_customer_admin_boundary.test.sql
  git commit -m "test: cover real role-management RLS boundaries"
  ```

### Task 2: Refresh Phase 4.2 authorization audit evidence

**Files:**
- Modify: `docs/PHASE4_2_AUTHORIZATION_AUDIT.md`

**Interfaces:**
- Consumes: Final pgTAP assertion count and fresh local test output from Task 1; current merged PR #38 state and prior local auth E2E evidence.
- Produces: Accurate Phase 4.2 audit with explicit distinction between local policy tests and hosted Auth verification.

- [ ] **Step 1: Replace stale status statements**

  Remove the statements that PR #38 remains open and pgTAP has not been run. Record the merged PR #38 commit `508c82e56a7cd452b90a1a57df2a0d37d1ebbe4c` and distinguish it from this new regression-test branch.

- [ ] **Step 2: Document actual policy DML coverage**

  List the owner-allowed operations, admin allowed/denied operations, customer denied operations, and self-role-change protection that the test actually exercises. Include the exact assertion count only after it is confirmed by test output.

- [ ] **Step 3: Record verification boundaries**

  State that tests run on disposable local Supabase only; hosted Dairybuy-dev Auth testing remains deferred/unverified. Reaffirm that no remote DB, Auth settings, Production deployment, domain, or live customer data was changed.

- [ ] **Step 4: Review the document against the test output**

  Confirm every claimed behavior has a matching pgTAP assertion and every reported command was freshly executed.

- [ ] **Step 5: Commit the audit update**

  ```bash
  git add docs/PHASE4_2_AUTHORIZATION_AUDIT.md
  git commit -m "docs: record phase 4.2 RLS regression evidence"
  ```

### Task 3: Validate CI remains local-only and prepare review handoff

**Files:**
- Inspect: `.github/workflows/auth-pr-checks.yml`
- No workflow modification unless a concrete coverage gap is found.

**Interfaces:**
- Consumes: Existing `database-rbac` job and completed SQL regression suite.
- Produces: Verified local-only workflow configuration and a review-ready branch/PR proposal; no merge.

- [ ] **Step 1: Verify the workflow safety boundary**

  Confirm the database job starts Supabase CLI 3.0.0 with `supabase start`, runs `supabase test db`, and stops the stack. Confirm no project ref, access token, database password, remote flag, or hosted credentials are supplied.

- [ ] **Step 2: Run the repository verification commands**

  Run the database suite on disposable local Supabase and the repository checks used by the existing workflow: `npm ci`, `npm run typecheck`, `npm test -- --reporter=dot`, `npm run build`. Run the workflow's configured ESLint command as written. Report each command's actual exit status; do not infer one from another.

- [ ] **Step 3: Inspect the final diff**

  Confirm only the intended pgTAP test and audit documentation changed (plus a workflow change only if explicitly justified). Confirm no migration, application runtime code, secrets, hosted account, or remote DB change is present.

- [ ] **Step 4: Commit any justified workflow-only change**

  If no workflow change is needed, do not create a no-op commit. If a real gap is found, document it and add only the minimal local-only fix, then re-run the affected workflow checks.

- [ ] **Step 5: Prepare PR and stop before merge**

  Create a PR targeting `main` with test results, changed-file summary, and safety statement. Do not merge it; wait for separate explicit approval.

---

## Completion checklist

- [ ] Real RLS DML cases cover owner, admin, and customer.
- [ ] Admin owner-role escalation and self-role-change are denied.
- [ ] Customer role mutation is denied and own-role read remains scoped.
- [ ] Existing legacy-role and policy-hardening assertions remain intact.
- [ ] Exact pgTAP plan count matches actual assertions.
- [ ] Full local database suite passes on disposable local Supabase.
- [ ] Workflow contains no remote database credentials or remote target.
- [ ] Typecheck, unit tests, build, and configured lint command have fresh results.
- [ ] Audit document matches observed test evidence.
- [ ] PR is prepared but not merged; separate approval required.
