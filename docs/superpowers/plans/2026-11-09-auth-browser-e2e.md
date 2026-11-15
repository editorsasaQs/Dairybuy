# Dairybuy Auth Browser E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add repeatable Chromium E2E coverage for Dairybuy's real local Supabase signup, email confirmation, login, session refresh, logout, and protected account flow.

**Architecture:** A dedicated GitHub Actions job starts an isolated Supabase CLI v3 local stack with Mailpit, builds and serves the Next.js app against loopback-only local credentials, then runs Playwright. Existing pgTAP stays a separate disposable-stack job; no hosted database or production credentials are used.

**Tech Stack:** Node 22, Next.js 16, Supabase CLI 3.0.0, Supabase local Auth + Mailpit, Playwright Test 1.65.0, Chromium.

**Spec:** `docs/superpowers/specs/2026-11-09-auth-e2e-design.md`

## Global Constraints

- Use Node `22.x`.
- Pin `@playwright/test` to `1.65.0`; commit `package-lock.json`.
- Supabase CLI remains pinned to `3.0.0`.
- All E2E traffic must target loopback URLs from the local Supabase CLI status output.
- Never use a hosted Supabase project ref, hosted API URL, service-role key, secret key, or Production data.
- Keep email confirmation enabled and capture email in local Mailpit only.
- Keep PR #38 open and unmerged; do not change Vercel Production settings or domain aliases.
- No admin route exists yet; do not invent one. RBAC database boundary remains covered by pgTAP.

## Review Focus

- Mailpit API returns no matching confirmation message or delayed email: test waits with a bounded timeout and reports the missing recipient.
- Confirmation link points to an unexpected host or unsafe redirect: only navigate the loopback confirmation URL and assert final origin/path.
- Expired access token cannot refresh: explicitly test after the 60-second JWT expiry and verify account identity after reload.
- A local environment variable accidentally points to a hosted project: assert Supabase URL hostname is loopback before app startup and fail closed.
- Auth state leaks between tests: use unique test emails and isolated Playwright browser contexts; do not reuse storage state.

---

### Task 1: Playwright foundation and browser auth tests

**Files:**
- Modify: `package.json` — add `test:e2e` script and pinned dev dependency.
- Modify: `package-lock.json` — generated lockfile update.
- Create: `playwright.config.ts` — Chromium-only, serial auth tests, trace/screenshot on failure, local base URL.
- Create: `e2e/auth.spec.ts` — actual signup/confirmation, invalid credentials, login/logout/account protection, and token-refresh tests.
- Modify: `supabase/config.toml` — explicitly enable local SMTP capture and set local JWT expiry to 60 seconds.

**Interfaces:**
- Playwright config uses `PLAYWRIGHT_BASE_URL`, defaulting to `http://127.0.0.1:3000`.
- Mailpit API base defaults to `http://127.0.0.1:54324`.
- Supabase local app configuration uses `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL`.
- Tests use unique `@example.test` addresses and never require service-role credentials.

- [ ] **Step 1: Write failing auth browser tests first.** Cover:
  - Signup sends a confirmation email; test reads its confirmation link from Mailpit, completes it, and lands on `/account`.
  - Invalid login displays `role=alert` and remains on `/login`.
  - Valid login survives reload; logout returns to `/login`; visiting `/account` again redirects to login.
  - After local JWT expiry (60 seconds), reload still shows the authenticated account.
- [ ] **Step 2: Run the new E2E command before implementation/config exists.** Expected: fail because the Playwright script/config is not yet present (not a test syntax/runtime error).
- [ ] **Step 3: Add pinned Playwright dependency, script, config, and local Auth SMTP/JWT settings.** Keep tests serial because the disposable local Auth service is shared within the job.
- [ ] **Step 4: Install Chromium and run E2E against a local production build + local Supabase stack.** Expected: all four browser tests pass; no request leaves loopback hosts.
- [ ] **Step 5: Run `npm test -- --reporter=dot`, `npm run lint`, `npm run typecheck`, and `npm run build`.** Expected: all existing checks remain green.
- [ ] **Step 6: Commit** as `test: add browser coverage for Supabase auth flows`.

### Task 2: Isolated CI E2E job

**Files:**
- Modify: `.github/workflows/auth-pr-checks.yml` — add a dedicated `auth-e2e` job.

**Interfaces:**
- Uses the same checkout discipline as other jobs: exact PR head SHA, `persist-credentials: false`, `contents: read`.
- Supabase local status output supplies `API_URL` and `ANON_KEY`; map only these to public Next.js env vars.
- E2E app runs on `127.0.0.1:3000`; local Supabase API/Mailpit use their CLI loopback ports.

- [ ] **Step 1: Add the workflow job with Node 22, Supabase CLI 3.0.0, and Docker-backed local stack.**
- [ ] **Step 2: Start local stack and source `supabase status -o env`; reject any non-loopback API URL before exporting app env.**
- [ ] **Step 3: Run `npm ci`, install Chromium with OS dependencies, build, start the app, wait for health, and run `npm run test:e2e`.**
- [ ] **Step 4: Upload Playwright report/trace artifacts on failure and stop the stack with `if: always()`.**
- [ ] **Step 5: Run the full workflow and inspect every job/log.** Expected: verify, database-rbac, and auth-e2e all pass; E2E logs show all four tests passed.
- [ ] **Step 6: Commit** as `ci: run auth browser tests on disposable Supabase`.

### Task 3: Evidence and documentation

**Files:**
- Modify: `docs/PHASE4_2_AUTHORIZATION_AUDIT.md` — update browser E2E status, test coverage, and explicit limits.

**Interfaces:**
- Documentation must distinguish automated browser coverage from pgTAP database authorization coverage.
- No claim of admin-route E2E until an actual staff route/API exists.

- [ ] **Step 1: Update the audit report to list exact E2E flows and remaining gaps.**
- [ ] **Step 2: Re-run full CI and verify final commit SHA matches all successful checks.**
- [ ] **Step 3: Commit** as `docs: record Phase 4.2 auth E2E verification`.

## Completion gate

Do not mark complete unless the final PR head has passing verify, database-rbac, auth-e2e, and Vercel Preview checks. Keep PR #38 draft/open until the user separately authorizes review-ready status or merge.
