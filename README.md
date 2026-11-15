# Dairybuy

Customer web app for Dairybuy, a centrally managed dairy delivery business in Kolkata. Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.

## Setup

Requires Node.js 20.9 or newer (22 recommended, see `.nvmrc`) and npm.

```bash
npm ci
npm run dev
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run typecheck` | Generate route types and run `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests (vitest) |
| `npm run build` | Production build |

Project history, pinned versions and open items are in `MIGRATION_NOTES.md`. Vendor evidence is in `docs/VENDOR_VERIFICATION.md`. Phase 3.2 results are in `docs/PHASE3_2_REPORT.md`. Business rules (₹4 delivery fee, delivery windows, milk sizes) live in `src/lib/business.ts`.

Do not place archives, backups or private files under `public/`; everything there is served to the internet.


## Phase 4.1 consolidated source

- Confirmed non-milk catalogue source: `data/confirmed-product-catalogue.csv`.
- Raw owner upload and Master Project Blueprint are retained in `project-documents/`.
- See `docs/PHASE4_1_AUDIT_REPORT.md` and `docs/PHASE4_1_KNOWN_LIMITATIONS.md` before running or deploying.
- AppDeploy Operations Dashboard source is preserved separately in `integrations/appdeploy-operations-dashboard/`.
- The current API data services are still local TypeScript datasets; Supabase database integration is not yet active.
