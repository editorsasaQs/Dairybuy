# Dairybuy — Phase 4 / 4.1 Test Evidence

## 1. Historical Phase 4 report (not independently re-run in this package)

The Phase 4 handover supplied with the project reported:
- 13 Vitest files
- 180 tests passed
- TypeScript typecheck: 0 errors
- ESLint: 0 errors / 0 warnings
- Next.js production build: 12 routes compiled

These are recorded as prior project-reported results. They have **not** been independently re-executed during this consolidation, so they are not represented as fresh Phase 4.1 verification.

## 2. Phase 4.1 changes made in this package

- Added cart tests for Canteen-only, mixed Canteen + non-milk, mixed Canteen + regular milk, multiple items, and missing Canteen metadata.
- Tightened Canteen milk validation: dedicated vendor, `canteen` milk type and 500 ml / 1 L pack size are mandatory.
- Normalized Canteen base milk price in cart calculation and applies one order-level ₹4 fee per delivery run.
- Added schema test assertions for 34 tables, 34 RLS-enabled tables and the Phase 4.1 forward migration.
- Added CSV catalogue scope checks and removed unconfirmed breakfast staples from fresh seed and active storefront data.

## 3. Verification status in this packaging environment

| Check | Status | Evidence / limitation |
|---|---|---|
| Uploaded CSV arithmetic | PASS | 16 rows; purchase + sheet component equals final price for every row; duplicate final-price columns match |
| SQL table declarations | PASS (static inspection) | 34 `CREATE TABLE` declarations |
| RLS enable statements | PASS (static inspection) | 34 `ENABLE ROW LEVEL SECURITY` statements |
| RLS policy declarations | PASS (static inspection) | 62 `CREATE POLICY` declarations |
| API route files | PASS (static inspection) | 6 `route.ts` files |
| Migration files | PASS (static inspection) | 4 migration files after Phase 4.1 |
| `npm ci` | BLOCKED | Offline environment has no cached `@supabase/supabase-js` package; registry access unavailable |
| Vitest | NOT RUN | Dependencies could not be installed |
| TypeScript typecheck | NOT RUN | Project dependencies could not be installed |
| ESLint | NOT RUN | Project dependencies could not be installed |
| Next.js production build | NOT RUN | Project dependencies could not be installed |
| Supabase migration execution | NOT TESTED | No Supabase project credentials or local PostgreSQL/Docker environment supplied |
| Runtime RLS tests | NOT TESTED | No database runtime available |
| Browser / end-to-end QA | NOT RUN | Browser test environment not supplied |

## 4. Required next verification on a connected development machine

From the project root:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Then run all migrations against a disposable Supabase project/local Supabase instance and execute database-level RLS tests using separate customer, staff and admin accounts.

Do not deploy to production until these checks pass.
