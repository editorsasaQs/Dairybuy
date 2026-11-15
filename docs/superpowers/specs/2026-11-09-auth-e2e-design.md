# Dairybuy Phase 4.2 — Browser Authentication E2E Design

**Date:** 2026-11-09  
**Scope:** Local-only browser verification for the existing Next.js + Supabase Auth flow in PR #38.  
**Status:** Approved by user for implementation.

## Intent

Prove that the current customer authentication journey works in a real browser, including email confirmation, password sign-in, session persistence/refresh, sign-out, and protection of the customer account route. This supplements the already-passing Vitest and disposable-database pgTAP checks.

## Current implementation verified

- `src/app/auth/actions.ts`: `signUpAction`, `signInAction`, `signOutAction`.
- `src/app/auth/callback/route.ts`: exchanges the confirmation code and validates the resulting user.
- `src/app/account/page.tsx`: calls `auth.getUser()` and redirects unauthenticated visitors to `/login?next=/account`.
- `proxy.ts` and `src/lib/supabase/proxy.ts`: refresh Supabase session cookies.
- `supabase/config.toml`: local email confirmations are already enabled.
- No staff/admin dashboard route currently exists. Customer-vs-staff authorization remains covered by the existing RBAC pgTAP tests until a real staff route/API exists; do not invent a placeholder route solely for E2E.

## Design

1. Use pinned `@playwright/test` and Chromium against the production build served locally.
2. Start a fresh local Supabase stack in CI only. Do not link a project, pass a project ref, or use remote flags or hosted credentials.
3. Enable local SMTP capture and read confirmation messages from Mailpit's local API; never send real email.
4. Use a unique `example.test` address per test. Complete the actual confirmation link through the browser, then verify the account page.
5. Test invalid password handling, successful sign-in, logout, and unauthenticated account-route denial.
6. Set the disposable local Auth JWT expiry to 60 seconds and verify a previously authenticated browser session survives token expiry via the refresh path.
7. Keep the database pgTAP job separate. Both jobs use independent disposable local stacks.

## Goals

- Verify the real user-visible auth flow through browser, app server, Supabase Auth, local email, callback, and protected account page.
- Preserve lockfile reproducibility and Node 22 compatibility.
- Capture Playwright traces/screenshots on failure.

## Non-goals

- No production or Dairybuy-dev access.
- No Supabase hosted Auth settings, schema, migration, or data changes.
- No admin dashboard implementation, no new authorization routes, no payments/cart/subscription tests.
- No PR merge or Production deployment.

## Security constraints

- Never use a service-role/secret key in browser tests.
- Test only against the local Supabase URL emitted by `supabase status -o env`.
- Fail fast if the Supabase URL is not loopback.
- Use Mailpit only on the local runner.
- Stop the local Supabase stack even when tests fail.

## Acceptance criteria

- Signup email confirmation completes through Mailpit and redirects to the authenticated account page.
- Invalid credentials show an accessible error and do not authenticate.
- Valid login persists through a page reload; logout redirects to login; a later account visit is denied and redirects to login.
- After the 60-second local JWT expiry, a reload retains the authenticated session through refresh.
- Existing lint, typecheck, Vitest, build, and pgTAP checks remain green.
- E2E job runs on PR #38 without any hosted Supabase credentials or Production side effects.
