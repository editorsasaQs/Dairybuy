# Dairybuy — Consolidated Project Package

This archive consolidates the latest customer-facing Next.js project, Phase 4.1 catalogue corrections, the AppDeploy dashboard source, project documents and historical source ZIP snapshots.

## Start here

1. Read `docs/PHASE4_1_AUDIT_REPORT.md`.
2. Read `docs/PHASE4_1_KNOWN_LIMITATIONS.md`.
3. Review `data/confirmed-product-catalogue.csv`.
4. Read `project-documents/Dairybuy — Master Project Blueprint v1.1 (1).docx`.
5. Install and verify the Next.js project using the commands in `README.md`.

## Folder layout

- Root: canonical Next.js customer website and current Phase 4/4.1 code.
- `src/`: existing customer frontend, API routes and service logic.
- `supabase/migrations/`: schema, seed, RLS and Phase 4.1 catalogue migration.
- `data/`: normalized confirmed CSV used for reconciliation.
- `project-documents/`: original owner-uploaded CSV and project blueprint.
- `integrations/appdeploy-operations-dashboard/`: separate AppDeploy dashboard source project. It is not merged into the Next.js application.
- `project-history/original-uploads/`: original ZIP uploads retained as source snapshots.

## Product catalogue scope

The latest owner CSV confirms 16 non-milk variants across Ghee, Butter, Cheese, Doi and Sweets. It does not confirm Bread, Eggs, Banana, Fruit Juice or Jam. Those five items are disabled/removed from active catalogue data. Existing image assets are retained but no new image URLs are inferred.

Milk vendor pricing is not included in the new CSV; the previously owner-confirmed milk vendor prices remain unchanged.

## Important status

This is a consolidated development package, **not a production-ready release**. Current API data services still use local TypeScript datasets; they are not yet connected to Supabase queries. Migrations, RLS runtime behavior, automated tests, lint, typecheck and production build require verification in a network-enabled development environment. No production deployment, payment processing or AppDeploy connection has been performed.
