# Phase 4.2 — Local RBAC Policy Regression Design

**Date:** 2026-11-09  
**Status:** Proposed — awaiting user approval  
**Scope:** Repository-only security regression coverage; all database execution is disposable and local.

## Intent

Strengthen Phase 4.2 authorization evidence by testing actual PostgreSQL row-level-security behavior for role assignment, not only policy metadata and application helper functions. The suite should catch a future migration that accidentally permits a customer or admin to escalate privileges, bypass the owner/admin boundary, or mutate their own role.

## Goals

- Exercise `public.user_roles` policies with SQL executed as the `authenticated` database role and realistic JWT claim settings.
- Cover owner, admin, and customer actors and the permitted/denied role-assignment operations.
- Explicitly cover admin self-role-change and owner-role grant restrictions.
- Keep every synthetic `auth.users` row and test mutation inside a transaction that rolls back.
- Run only in the existing disposable local Supabase CI job.
- Keep existing policy-definition, grants, helper-hardening, and legacy-role assertions.

## Non-goals

- No hosted Dairybuy-dev account creation or hosted Auth smoke tests.
- No changes to production application authorization behavior unless a failing policy test demonstrates an existing repository defect and the fix is separately scoped.
- No remote migration application, Supabase project setting changes, Production deployment, or domain changes.
- No admin dashboard or staff route implementation.
- No tests that depend on live customer data, real email delivery, or hosted credentials.

## Approaches considered

1. **Local-only SQL policy regression suite — selected.** Extend the existing pgTAP test and disposable local Supabase CI job. This exercises the real PostgreSQL policies with repeatable fixtures and does not touch hosted environments.
2. **Hosted Dairybuy-dev test accounts.** This could add hosted Auth confidence, but requires account lifecycle, credentials, cleanup, and remote writes. It is unnecessary for proving the database policy boundary and is intentionally deferred.
3. **Application-helper-only unit tests.** These are fast but cannot prove RLS policies actually enforce the same rules. Existing Vitest helper tests remain complementary, not a substitute.

## Design

### Test fixture and isolation

- Extend `supabase/tests/database/rbac_customer_admin_boundary.test.sql`.
- Create deterministic synthetic owner, admin, customer, and target users using the existing Auth trigger path.
- Add the required role rows using the privileged test setup before switching to `SET LOCAL ROLE authenticated`.
- For each actor, set both `request.jwt.claim.sub` and `request.jwt.claims` to the actor's authenticated identity.
- Execute each policy-sensitive statement under `authenticated`, not the migration owner or `service_role`.
- Use pgTAP assertions for expected success and expected RLS/privilege rejection. Ensure the outer transaction ends with `ROLLBACK`.
- Do not run this test against a remote project. CI must continue to start a fresh local Supabase stack without project ref, access token, DB password, or remote flags.

### Authorization matrix to pin

- **Owner:** can perform the role-management operations and assignments allowed by the database's owner policy, including granting the owner role.
- **Admin:** can manage only the roles permitted by the current admin policy; cannot grant or create an owner assignment and cannot change their own role.
- **Customer:** can read only their own role assignment and cannot insert, update, or delete role assignments.
- **Legacy roles:** `manager` and `operations_staff` remain non-staff and receive no operational permissions, preserving the existing assertions.
- **Anonymous:** cannot read or mutate role assignments, preserving existing grant assertions.

The test must reflect the current migration's exact policy semantics. If inspection of the installed policy definitions reveals a narrower rule than the summary above, preserve the narrower rule and document it rather than weakening the database contract.

### CI and documentation

- Keep the existing `database-rbac` job in `.github/workflows/auth-pr-checks.yml`; no hosted secrets or remote database steps are added.
- Update `docs/PHASE4_2_AUTHORIZATION_AUDIT.md` with the new local DML coverage, exact assertion count, and actual verification evidence after implementation.
- Remove stale statements about PR #38 being open and pgTAP not yet run; replace them with current facts and clearly separate local test evidence from hosted Auth verification.

## Constraints and safety

- Synthetic Auth fixtures are permitted only on a fresh disposable local Supabase database.
- Never run `supabase test db` against Dairybuy-dev or Production.
- Do not create hosted test users or clean up remote accounts.
- Do not apply migrations to Dairybuy-dev or Production.
- Do not merge a PR without separate explicit approval.
- Preserve the server-only `payment_webhook_events` policy exception; it is unrelated to this work.

## Acceptance criteria

1. The expanded pgTAP suite fails if customer role mutation is permitted.
2. It fails if an admin can grant an owner role or change their own role.
3. It fails if an owner is blocked from an operation explicitly allowed by the current owner policy.
4. It verifies allowed admin operations and owner operations against actual RLS execution, not only `pg_policies` text.
5. All fixtures are rolled back; repeated local runs are deterministic.
6. The existing local CI job executes the suite with no remote credentials or remote project reference.
7. The audit document records exact test and CI results, and states that hosted Auth testing remains unverified/deferred.

## Implementation choices left to the builder

- Use the existing pgTAP extension and assertion conventions in the current SQL test.
- Prefer focused assertions per actor and operation; update `extensions.plan(...)` to the exact assertion count.
- Do not add a new dependency or create a separate hosted test workflow.
- Follow TDD: introduce the new failing policy assertions, verify the expected failure against the disposable local stack, then make only the minimal test/CI/documentation changes required.
