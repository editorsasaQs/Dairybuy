# Dairybuy — Consolidation & Phase 4.1 Audit Report

**Audit basis:** latest Phase 4 source ZIP, Phase 3.2 source ZIP, older Phase 1/2 snapshots, AppDeploy Operations Dashboard ZIP, Master Project Blueprint v1.1, and owner-uploaded `Milk vendor and pricing - updated.csv`.

## 1. Canonical project selection

- Canonical customer application: latest supplied `dairybuy (1).zip` (Phase 4 backend source).
- Phase 3.2 ZIP and earlier `dairybuy.zip`, Phase 2 and Phase 1 ZIPs are retained under `project-history/original-uploads/` as source snapshots.
- AppDeploy Operations Dashboard is retained as a separate project under `integrations/appdeploy-operations-dashboard/`. It is not merged into the Next.js app because it is a separate Vite/TanStack application.
- Master Project Blueprint v1.1 and the raw/normalized CSV are included in `project-documents/` and `data/`.
- The Phase 4 source ZIP did not contain a `.git` directory. No Git history was fabricated or reconstructed. The original snapshots are preserved for provenance.

## 2. Updated CSV reconciliation

The uploaded CSV has a two-row header layout. After skipping its first descriptive row, it contains **16 product records** and these columns:
- Category
- Product / Brand
- Pack size
- Purchase price (Rs)
- Delivery (Rs)
- FINAL PRICE (Rs)
- Final price in your sheet (Rs)

Counts: Ghee 4, Butter 5, Cheese 4, Doi 2, Sweets 1.

All rows pass both arithmetic checks:
- `purchase price + sheet delivery component = final customer price`
- `FINAL PRICE = Final price in your sheet`

The CSV is a non-milk catalogue sheet. It does not contain cow/buffalo vendor prices. Existing confirmed milk-vendor pricing from the Phase 4 project is therefore retained; no new milk prices were inferred.

### Catalogue changes applied

- Kept the 16 CSV-backed non-milk variants.
- Updated brand spelling to **Ashirvaad** exactly as supplied in the CSV.
- Updated Firni pack label to **1 piece**.
- Removed unconfirmed Bread, Eggs, Banana, Fruit Juice and Jam from the active customer-facing catalogue.
- Removed those unconfirmed products from fresh database seed data.
- Added a forward-only migration to deactivate those old records in an existing database without deleting historical rows.
- Removed the Breakfast Box homepage promotion because its contents included unconfirmed products.
- Updated homepage, product catalogue and About copy to match the confirmed list.
- Existing image assets were preserved. The CSV contains no image URLs or product-photo references, so no new image source was invented.

## 3. Static source counts

| Item | Verified count |
|---|---:|
| PostgreSQL `CREATE TABLE` declarations | 34 |
| RLS `ENABLE ROW LEVEL SECURITY` statements | 34 |
| `CREATE POLICY` declarations | 62 |
| Next.js API route files | 6 |
| Supabase migration files after Phase 4.1 | 4 |
| Confirmed non-milk CSV variants | 16 |
| Approved regular milk vendors | 5 |
| Enabled regular milk vendors with supplied prices | 3 |
| Separate Canteen Milk Centre | 1 |

The prior Phase 4 report's 31-table figure was inaccurate; the source contains 34 table declarations.

## 4. Cart pricing correction

The original cart service applied one 400-paise order-level fee, while the Canteen vendor dataset stores milk base price separately from its included 400-paise fee. The original validator did not require Canteen vendor/type/pack metadata, allowing a fallback path to use the already fee-inclusive variant price and then add another fee.

Changes:
- Canteen milk now requires `canteen-milk-centre`, milk type `canteen`, and a valid 500 ml or 1 L pack.
- The server cart calculation uses the Canteen base milk price (₹24 / ₹45) and represents the delivery charge once at order level.
- Mixed Canteen + regular milk and Canteen + non-milk carts use one delivery charge per cart/delivery run.
- Added tests for Canteen-only, mixed carts, multiple products and missing Canteen metadata.

The new tests are present in source but could not be executed in this environment (see verification section).

## 5. Important implementation limitation: Supabase is not yet wired into catalogue APIs

The current API routes for catalogue, vendors, Canteen and cart validation import local TypeScript datasets/services. They do not query Supabase tables. Supabase client wrappers and migrations exist, but the API/data services are not yet database-backed.

The health endpoint was corrected so it no longer reports that the backend is connected merely because environment variables exist. It now explicitly reports that database integration is inactive and the catalogue source is local code-defined data.

This means Phase 4 is a database schema/security foundation plus local API/service implementation—not a verified live Supabase-backed commerce backend yet.

## 6. AppDeploy dashboard status

The supplied dashboard ZIP is preserved separately. No AppDeploy account access, Supabase credentials, deployment status verification, dashboard-to-backend connection or production changes were performed. Integration remains a later approved task.

## 7. Verification performed in this environment

- Read and reconciled all uploaded source archives and documents.
- Inspected current Next.js source, catalogue data, API routes, migration SQL and RLS SQL.
- Counted tables, RLS enable statements, policies, API route files and migrations from source.
- Checked the 16 CSV rows and their price equations.
- Added source tests for the catalogue scope and cart fee cases.
- Inspected archive contents and retained source snapshots.

## 8. Verification blocked / not performed

`npm ci --offline` was attempted and failed because the npm cache does not contain `@supabase/supabase-js`; the environment cannot access the package registry.

Therefore:
- Vitest suite: not run after edits.
- TypeScript typecheck: not run after edits.
- ESLint: not run after edits.
- Next.js production build: not run after edits.
- SQL migrations: not executed against PostgreSQL/Supabase.
- RLS runtime tests: not executed.
- Browser/E2E tests: not run.
- Live Supabase integration: not tested.

Do not treat the historical 180-pass report from Phase 4 as a fresh Phase 4.1 test result.

## 9. Required next technical steps

1. On a machine with network access, run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
2. Apply all four migrations to a disposable Supabase project or local Supabase stack.
3. Run RLS tests with separate customer, staff and admin accounts.
4. Replace local catalogue/vendor/cart service data with Supabase-backed server queries and server-side authorization.
5. Connect the separate AppDeploy dashboard to the same backend only after owner approval.
6. Complete checkout, payments, subscriptions and delivery operations in their planned later phases; do not activate them based on this package alone.

**Production deployment is not approved by this package.**
