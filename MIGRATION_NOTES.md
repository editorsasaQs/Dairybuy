# Dairybuy — migration notes

Source of truth for requirements: Dairybuy Master Project Blueprint v1.1.
Original prototype (TanStack Start, "Lacticious") is kept untouched in `source-original/` (outside this repo) and is never modified.

## Phase 1 — Next.js foundation (done)

Pinned versions (exact, `.npmrc` has `save-exact=true`):

| Package | Version | Why |
| --- | --- | --- |
| next / eslint-config-next | 16.4.3 | 16.3.8 (create-next-app default) has critical advisories (Image Optimization RCE, `use cache` RCE); 16.4.3 audits clean |
| react / react-dom | 19.2.8 | version pinned by Next's own scaffold |
| typescript | 5.9.3 | Next minimum is 5.1; TS 7 is untested with this toolchain |
| tailwindcss / @tailwindcss/postcss | 4.3.3 | same major as prototype |
| eslint | 9.39.5 | ESLint 10 breaks peer deps of eslint-plugin-react / import / jsx-a11y bundled in eslint-config-next. Note: npm marks 9.39.5 as deprecated; revisit when Next's plugins support ESLint 10 |
| @types/node | 22.20.5 | matches Node 22 runtime (Next needs >= 20.9) |
| @types/react / @types/react-dom | 19.2.18 / 19.2.7 | match React 19.2 |

Scripts: `dev`, `build`, `start`, `lint`, `typecheck` (`next typegen && tsc --noEmit`). Test script comes with the shared business-logic phase.

TypeScript strict flags carried over from the prototype: noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitReturns, noFallthroughCasesInSwitch, noImplicitOverride, noPropertyAccessFromIndexSignature, noUncheckedSideEffectImports.

## Phase 2 — Brand identity, design tokens, asset migration (done)

- Tokens live in `src/app/globals.css` in three layers: brand primitives (`--brand-*`), semantic tokens (`--background`, `--primary`, …), and a Tailwind 4 `@theme inline` block that exposes them as utilities. Components use semantic utilities, never raw hex.
- Approved palette applied exactly: Plum #2A1740, Saffron #F5A524, Mint #6FD1A8, Terracotta #C2512F, Cream #FBF5EA.
- Contrast decisions: terracotta on cream is only 4.29:1, so terracotta is used as a background with white text (4.65:1) and text uses a darker derived `--brand-terracotta-ink` (#A8432A, 5.5:1). The focus ring is plum because saffron is only 1.9:1 on cream. Primary buttons are plum on saffron (7.9:1).
- Fonts: Fraunces (headings) and Sora (body/UI), self-hosted variable latin-subset woff2 under `src/app/fonts/` via `next/font/local` (source: `@fontsource-variable/*` 5.3.0, OFL-1.1, licences included). Chosen over `next/font/google` because the build environment cannot reach fonts.googleapis.com; this also removes the build-time network dependency. One file per family, no per-weight downloads.
- Metadata and viewport are set in `src/app/layout.tsx`. No address, phone, FSSAI or social links were invented.
- Brand components: `Wordmark` (typographic placeholder, not a final logo), `Container`, `Button` (primary/secondary).
- Assets: 14 original JPGs copied byte-identical to `public/images/` (products 11, banners 2, original 1). See `docs/ASSET_MANIFEST.md` and `docs/asset-manifest.json`. `hello.jpg` purpose is unconfirmed for the new site. `categories/` was not created (no category imagery exists).
- The home page is a brand-foundation preview only; the real homepage migrates in a later phase.

## Phase 3 — Customer UI migration (done)

- Ported customer-facing screens from the original Lovable prototype (`source-original/`, TanStack Start) into the Next.js 16.4.3 App Router using the Phase 2 Milkyway Kolkata design tokens (`src/app/globals.css`), `Fraunces` + `Sora` local variable fonts, and semantic components (`Container`, `Wordmark`, `Button`):
  - `/` (`src/app/page.tsx`) — Customer homepage with hero (`hero.jpg`), featured dairy & breakfast essentials grid, curated Breakfast Box showcase (`combo.jpg`), 4-step fulfilment overview, and vendor partnership callout.
  - `/products` (`src/app/products/page.tsx` + `CatalogueBrowser`) — Full 11-item product catalogue with interactive category filters (`All Essentials`, `Fresh Milk`, `Curd & Bengali Classics`, `Ghee & Butter`, `Morning Essentials`) and client-side search.
  - `/milk` (`src/app/milk/page.tsx` + `MilkVendorSelector`) — Milk vendor selection across the three active regular vendors (Healthy Haryana Milk Centre, VIP Pure Milk and Ghosh Dairy), plus the dedicated single-vendor Canteen Milk Centre flow. Standard milk volume is 500 ml–10 L in 500 ml increments.
  - `/about` (`src/app/about/page.tsx`) — Dairybuy story, neighbourhood sourcing commitments, and vendor partnership overview (`#vendors`). Uses `/images/original/hello.jpg` provisionally until final brand photography is confirmed.
  - Shared chrome & selection state (`SiteHeader`, `SiteFooter`, `BagContext`, `BagDrawer`) — Responsive navigation with mobile menu, accessible slide-over selection bag synced across `/`, `/products`, and `/milk`, and inverse high-contrast footer (`Wordmark` `tone="inverse"`).
- Added `lucide-react` (`1.65.0`, pinned exact via `.npmrc`) for UI icons.
- Brand & business-rule hygiene:
  - Replaced all legacy `Lacticious` branding, copy, and fabricated contact placeholders (`hello@lacticious.com`, `+91 00000 00000`) with `Dairybuy`.
  - Removed all unverified prototype demo prices, `% OFF` discount tags, hardcoded `FREE` delivery claims, `window.alert` form handlers, and fake `"Order placed!"` checkout states.
  - Note: `Dairybuy Master Project Blueprint v1.1` was not included in the Phase 3 archive bundle; product/vendor `priceInr` fields are typed `number | null` and set to `null` ("Rate confirmed at checkout") so zero prices or business rules are invented prior to blueprint/backend integration.


## Phase 3.1 — Audit fixes (done)

Fixes from the independent ZIP review. No pages, components, assets, design tokens or working features were removed.

1. **Source archives are no longer public.** Three ZIPs (`4407f953-…zip` original prototype, `dairybuy-next-phase1`, `dairybuy-next-phase2`) were under `public/assets/aistudio/` and therefore downloadable from the deployed site. They were moved byte-for-byte (SHA-256 verified before and after) to a private backup outside the project, and `public/assets/` was removed. After the build, `/assets/aistudio/*.zip` returns 404. `.gitignore` now also ignores `/private-backups/`. Never put archives or backups under `public/`.
2. **500 ml minimum.** `MIN_CUSTOM_LITRES` is `0.5` (was `0.25`). One rule (`isValidLitres`) is shared by the preset list, the custom quantity input (`min`, error text, disabled button), the add handler and the bag. `addItem` rejects any milk line below 500 ml, and a bag restored from `sessionStorage` is re-validated, so a 250 ml line saved before this fix is discarded.
3. **Active vendor list**: Healthy Haryana Milk Centre, VIP Pure Milk and Ghosh Dairy are the three customer-selectable regular vendors. Fresh Punjab Milk and Kolkata Milk Centre were removed from the active code and database by migration `20261112095741_remove_unpriced_milk_vendors`. Canteen Milk Centre remains a dedicated single-vendor flow without customer vendor choice.
4. **ESLint pinned exactly** to `9.39.5`, the version resolved in `package-lock.json`. `package.json` and the lock root specs are identical.
5. **Lockfile repaired.** `package-lock.json` had no `lucide-react` entry, so `npm ci` failed on the uploaded ZIP (`Missing: lucide-react@1.65.0 from lock file`). Lock regenerated; no existing package changed version. vitest was added with npm 11 because npm 10.9.7 crashes (`edgesOut`) resolving its peer set; the result installs cleanly with `npm ci` on npm 10.9.7.
6. **Restored empty files.** `tsconfig.json` (0 bytes) restored from the Phase 1 strict config, `.gitignore` (0 bytes) restored, and the empty stray `bun.lock` removed because the project uses npm.
7. **Tests added** (vitest 4.1.12, `npm run test`): `src/lib/milk.test.ts` (quantity validation), `vendors.test.ts` (vendor selection), `catalogue.test.ts` (filtering and data integrity), `bag.test.ts` (business rules at the bag boundary). Pure logic now lives in `src/lib/` (`getVisibleOptions`, `filterCatalogueProducts`, `isAddableBagItem`, `sanitizeStoredBagItems`) and the components call it.

### Open items carried from 3.1

- Items about marketplace messaging, 9 L / 50 L quantities and the missing ₹4 fee and slots were **resolved in Phase 3.2** (below).
- Vendor-to-milk-type mapping and the Healthy Haryana buffalo vs cow price check are still pending client verification.
- `npm audit`: 0 production vulnerabilities; 16 moderate dev-only findings from one advisory (`minimatch` < 11.0.1, GHSA-g3hv-75wg-m249) inside the ESLint 9 toolchain. ESLint 10 is not usable yet (peer conflicts with eslint-config-next's plugins).
- `lucide-react@1.65.0` was published one day before this audit; consider a longer-settled version.
- `metadata.json` is an AI Studio leftover; `dev`/`start` bind `0.0.0.0`; the `build` script uses `NODE_ENV=production` inline, which does not work in Windows cmd.

## Phase 3.2 — Business rule & UI finalisation (done)

Built from `dairybuy-phase3.1-verified`; architecture, pages, components, assets and design system preserved. Authority: Dairybuy Master Project Blueprint v1.1. Full detail and test results: `docs/PHASE3_2_REPORT.md`.

1. **Not a marketplace.** Removed "Become a Vendor Partner", "Partner with Dairybuy", "Vendor Partnerships", "Vendor onboarding portal", "Grow with Dairybuy" and "Kolkata Partner Vendor". Home, About and footer now describe a centrally managed business: staff collect milk from approved vendors and manage orders and delivery. Internal vendor concepts (`milkVendors`, `provisionalOptions`, `verifiedOptions`, unverified prototype vendors) are kept for the future admin dashboard.
2. **Standard milk sizes only.** 500 ml and 1 L (`MILK_SIZES`). Removed `presetLitres` (1.5–9 L), the custom litre input and the 50 L maximum. The shared 500 ml minimum (`MIN_MILK_LITRES`, `isValidLitres`) stays; `isOrderableMilkQuantity` also requires a standard size. A saved bag with other sizes is cleaned on load. No bulk ordering.
3. **₹4 delivery fee** in one place, `src/lib/business.ts` (`DELIVERY_FEE_INR`). Shown in the bag as "Delivery fee ₹4 per delivery". "Calculated by address" removed everywhere. No FREE wording. No totals or subscription maths (catalogue prices are still unconfirmed).
4. **Delivery windows** (Morning 9 AM–12 PM, Evening 4 PM–7 PM) from the same config, shown by the new informational `DeliveryInfo` component in the bag, milk summary, footer and About. It has no controls and states that no slot is reserved.
5. **Vendor mapping safety.** Every vendor is `pending-verification` with empty `verifiedOptions`; nothing can be added to the bag. The milk page says milk selection is temporarily unavailable pending vendor confirmation. Provisional pairings are never labelled verified. Prototype vendors stay separate. Canteen Milk Centre is a separate single-vendor card (`orderable: false`).
6. **Tests:** 110 → 175 (added `business.test.ts`, `source-rules.test.ts`; rewrote the milk, vendor and bag tests for the new rules). `source-rules.test.ts` scans the source for banned copy, hardcoded fee/slots, archives under `public/`, and the 14 JPGs.
7. **Private archives** stay outside `public/` (a test enforces this). The private backup ZIP was not changed (its three archives still match `SHA256SUMS.txt`).

