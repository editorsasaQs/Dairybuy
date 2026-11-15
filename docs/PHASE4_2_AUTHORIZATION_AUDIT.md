# Phase 4.2 — Authentication & Authorization Alignment

**Scope:** Repository RBAC alignment, read-only Dairybuy-dev audit, and disposable-local regression tests.  
**Production:** Not accessed or modified.  
**Remote database:** No writes, migrations, grants, policies, or Auth settings changed.

## 1. Authentication foundation

Verified in the repository:
- Signup and password sign-in use Supabase Auth server actions.
- Signup provisioning creates a profile and default `customer` role through the Auth trigger.
- The auth callback exchanges the confirmation code and verifies persisted cookie identity.
- Next.js `proxy.ts` refreshes Supabase claims.
- Authenticated cart routes call `auth.getUser()` before loading or mutating a customer's saved cart.
- Customer addresses, profiles, carts, and orders have customer-scoped RLS policies.

The browser authentication E2E suite runs against disposable local Supabase + Mailpit; it is not a hosted Dairybuy-dev account smoke test.

## 2. Authorization contract

The current database authorization model supports `customer`, `admin`, and `owner`:
- `private.is_staff()` delegates to `private.is_admin_or_owner()`.
- `private.has_staff_permission()` also delegates to `private.is_admin_or_owner()`.
- Legacy `manager` and `operations_staff` enum values remain for data compatibility but grant no operational access.
- Role-management policies are authenticated-only and split into INSERT, UPDATE, and DELETE policies.
- Owner can manage role assignments under the policy allowlist.
- Admin can manage other users' `admin`/`customer` roles, cannot assign/promote to `owner`, and cannot change their own role.
- Customer role access remains limited to their own row; customers cannot mutate role assignments.

## 3. Repository changes merged in PR #38

PR #38 was squash-merged into `main` at `508c82e56a7cd452b90a1a57df2a0d37d1ebbe4c`:
- Application RBAC helper treats only admin/owner as effective staff.
- Legacy enum values remain visible for compatibility without granting permissions.
- Role-assignment helper matches the database allowlist and blocks admin self-role changes.
- Unit tests cover supported roles and assignment behavior.
- Local pgTAP tests cover policy metadata, helper security posture, grants, and legacy-role denial.
- Disposable local CI runs the database RBAC test and browser auth E2E tests.

## 4. Read-only Dairybuy-dev audit

The read-only audit previously confirmed:
- `public.is_staff()` is SECURITY INVOKER.
- Its private implementation is SECURITY DEFINER with an empty `search_path`.
- `public.has_staff_permission()` delegates to the private authorization helper.
- `handle_new_user()` is not executable by anon/authenticated clients; it runs via the Auth trigger.
- `user_roles` has RLS enabled.
- The dev project had one owner, three customers, and no admin account at the time of audit.
- The `ensure_rls` event trigger was enabled.
- No public foreign keys lacked leading indexes in the audit snapshot.

These are a point-in-time, read-only development audit; no remote account or policy was changed.

## 5. Additional real-policy DML regression coverage — PR #39

PR #39 adds synthetic Auth fixtures inside the existing pgTAP transaction and executes role-management DML under `SET LOCAL ROLE authenticated`.

Intended coverage:
- Owner INSERT of an owner assignment, UPDATE of another user's role, and DELETE of another user's role.
- Admin INSERT of admin/customer assignments.
- Admin denial when inserting or promoting a user to owner.
- Admin inability to update/delete an existing owner assignment.
- Admin inability to change their own role.
- Customer denial for role INSERT, UPDATE, and DELETE.
- Customer SELECT remains restricted to their own role row.
- Existing helper-hardening, policy-definition, grant, and legacy-role assertions remain in place.

**Current verification status (2026-11-09):**
- GitHub Actions run #165 (commit `18e40e2a2a36c18ca868efc5ad86cf7cd3081c28`) passed all three jobs: `verify`, `database-rbac`, and `auth-e2e`.
- The focused disposable-local pgTAP test `rbac_customer_admin_boundary.test.sql` passed all 35 assertions.
- The browser authentication E2E suite passed against disposable local Supabase + Mailpit. It is not a hosted Dairybuy-dev account smoke test.
- An exploratory full-suite run #163 failed in six other existing SQL test files: `cart_persistence.test.sql`, `cart_security_regression.test.sql`, `customer_admin_role_boundary.test.sql`, `phase4_security_hardening.test.sql`, `rls_customer_isolation_hardening.test.sql`, and `security_smoke.test.sql`. These reported stale legacy-manager expectations, cart fixture/selection errors, and helper/grant expectation mismatches. They are not represented as passing and remain separate follow-up work.
- The committed CI workflow is intentionally scoped to the focused RBAC regression file; it does not mask the broader failures or claim the entire database suite is green.
- The database job starts a fresh local Supabase stack without remote project credentials or a remote project reference. No command in this workflow targets Dairybuy-dev or Production.

## 6. Remaining risks and deferred checks

- Hosted Dairybuy-dev Auth smoke testing with a dedicated admin account remains deferred; no hosted test account was created.
- No actual admin account existed in the prior dev audit snapshot, so hosted admin workflow was not manually exercised.
- Leaked Password Protection remains deferred until an eligible Supabase plan is available.
- Future admin APIs/actions must verify database-backed role and permission on the server; client-side helpers are not an authorization boundary.
- Existing legacy role assignments should be reviewed before launch; this work does not rewrite existing user data.
- Admin dashboard route/workflow implementation is separate from Phase 4.2 policy tests.

## 7. Explicit non-actions

- No Supabase migration was applied to Dairybuy-dev or Production.
- No remote database rows, grants, RLS policies, or Auth settings were changed.
- No hosted test accounts were created or deleted.
- No Production deployment, Vercel project settings, aliases, or domain configuration were changed.
- PR #39 is for review only and will not be merged without separate explicit approval.
