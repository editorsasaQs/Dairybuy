# Phase 3.2 report: business rule and UI finalisation

Base: `dairybuy-phase3_1-verified.zip` (unchanged architecture, pages, components, assets, design system). Business authority: Dairybuy Master Project Blueprint v1.1 and the client's `Milk_vendor_and_pricing.xlsx`. Environment: Node v22.22.2, npm 10.9.7, Next.js 16.4.3.

Before changing anything I confirmed the base: `npm ci` OK and 110 tests passing.

## Completed and tested

| # | Requirement | What changed | How it was verified |
|---|---|---|---|
| 1 | Remove marketplace messaging | Removed "Become a Vendor Partner", "Partner with Dairybuy", "Vendor Partnerships", "Vendor onboarding portal", "Grow with Dairybuy", "Partner Details", "Kolkata Partner Vendor" and the "connect neighbourhood producers" / "trusted local vendors" wording. Replaced by neutral managed-business copy on Home ("Managed by Dairybuy"), About (`#how-we-work`) and the footer ("How We Work"). Internal vendor data structures kept. | `source-rules.test.ts` (8 phrase checks; mutation-checked by injecting a violation and watching it fail); browser check of rendered text on /, /products, /milk, /about |
| 2 | Standard milk sizes | `MILK_SIZES` = 500 ml, 1 L. Removed `presetLitres`, the custom litre input, `MAX_CUSTOM_LITRES` (50 L), `normalizeLitres`. `MIN_MILK_LITRES` (500 ml) and `isValidLitres` kept; `isOrderableMilkQuantity` = minimum AND standard size. No bulk ordering. | `milk.test.ts` (45 tests: 1.5/2/2.5/3-9/50 L rejected, sub-500 ml rejected), `bag.test.ts`, UI source test (no `<select`, `type="number"`, "Custom quantity"); browser: no select/number input and no 1.5/2.5/9 L text on /milk |
| 3 | ₹4 delivery fee | One constant, `DELIVERY_FEE_INR` in `src/lib/business.ts`. Bag shows "Delivery fee ₹4 per delivery". "Calculated by address" removed. No FREE wording. No payment, checkout or subscription totals. | `business.test.ts`; `source-rules.test.ts` (no hardcoded ₹4 outside the config, no "free delivery"/"calculated by address"); browser: bag text on a real add-to-bag |
| 4 | Delivery slots | Morning 9 AM–12 PM and Evening 4 PM–7 PM from the same config, shown by `DeliveryInfo` (bag, milk summary, footer, About). Purely informational: no controls, states "no slot is reserved". | `business.test.ts`, `source-rules.test.ts` (no hardcoded windows; `DeliveryInfo` has no input/select/button), browser: text present and no inputs in the panel |
| 5 | Vendor mapping safety | `MilkVendor` now has `provisionalOptions` (dev data only) and `verifiedOptions` (empty). `isSelectableMilkOption` needs `mappingStatus === "verified"` AND a verified option. Nothing can be added to the bag. Milk page shows "Milk selection is temporarily unavailable" plus a per-vendor "pending vendor confirmation" note and a disabled "Unavailable for now" button. Prototype vendors stay separate and hidden. Canteen Milk Centre is its own single-vendor card with no vendor choice and `orderable: false`. | `vendors.test.ts` (28), `bag.test.ts` (51; includes a verified-vendor fixture and a "sneaky" fixture whose status is still pending); browser: 3 vendors each disabled, no Add buttons, canteen card has no buttons |
| 6 | Stale saved bags | `sanitizeStoredBagItems` drops provisional-vendor lines and non-standard sizes (1.5, 2.5, 9, 50 L). | `bag.test.ts`; browser: injected a saved bag with a Healthy Haryana 1 L line and a VIP Pure 2.5 L line plus bread, and only bread survived |
| 7 | Preservation | All pages, components and the 14 JPGs kept. No archive under `public/`. | Manifest check: 14/14 files match size and SHA-256. `source-rules.test.ts` checks 14 JPGs and no archives in `public/`. |

## Commands run and actual results (clean `rm -rf node_modules .next` first)

| Command | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | exit 0, 6 files, **175 tests passed** (baseline was 110 in 4 files) |
| `npm run build` | exit 0; routes `/`, `/about`, `/milk`, `/products`, `/_not-found` all static |
| `npm audit --omit=dev` | exit 0, 0 vulnerabilities |
| `npm audit` (all) | exit 1, 16 moderate, all dev-only, one advisory (`minimatch` < 11.0.1, GHSA-g3hv-75wg-m249) inside the ESLint 9 toolchain; the suggested fix downgrades ESLint to 4, so it was not applied |
| Browser run (headless Chromium via Playwright, against `next start` of the production build) | **58/58 checks passed** |

Browser checks covered: banned phrases and "FREE" on all four pages, footer fee and windows on all pages, the /milk unavailable state (3 vendors disabled, no Add buttons, no select/number inputs, canteen separate), the bag (₹4 line, informational windows, checkout notice says nothing was submitted), stale-bag cleanup, About `#how-we-work`, footer links, hero image load, no console errors and no 4xx/5xx responses, and no horizontal overflow plus a fitting bag drawer at **375, 390, 768 and 1280 px**. I looked at the 390 px milk page and the 375 px bag screenshots by eye; the other screenshots were checked only through the overflow measurements.

## Completed but not fully tested

- **The "verified vendor" add-to-bag UI** (`VendorOptionRow`: size picker 500 ml / 1 L and Add button) cannot render today because every vendor is pending. Its rules are covered by unit tests with fixtures, but the component itself has never been rendered or clicked. Test it the moment the first vendor is verified.
- **Tablet and desktop visual polish** of the new notices was judged from overflow measurements and not reviewed by eye.
- **Contrast** of the new notice and disabled-button text was not measured with an automated tool. The disabled "Unavailable for now" button is exempt from WCAG contrast rules but is deliberately low-emphasis.

## Pending (needs the client, or a later phase)

- Vendor-to-milk-type mapping for Healthy Haryana Milk Centre, VIP Pure Milk and Ghosh Dairy, and the Healthy Haryana buffalo-equals-cow price check.
- Whether the sheet's per-delivery prices also apply to **one-time** orders (the sheet is a subscription-plan sheet). Until then no milk price is shown or imported.
- Whether Fresh Punjab Milk and Kolkata Milk Centre are approved vendors.
- Canteen milk: full rules (blueprint says the client explanation is pending). The card stays closed even though the blueprint quotes ₹24 / ₹45 plus ₹4.
- Non-milk product prices (still `null`, so the bag cannot show item totals).
- Real slot selection and availability, order cutoffs, checkout, payments, subscriptions, location checks, auth, admin dashboard (all later phases, none started).
- Bulk ordering, if wanted, needs a separate decision.

## Unverified or judgement calls

- **Reading of the sheet.** `Milk_vendor_and_pricing.xlsx` lists all three vendors, including Ghosh Dairy, under both cow and buffalo. The blueprint says the mapping still has to be verified, so I recorded this in `docs/VENDOR_VERIFICATION.md` but did **not** change the data, import prices or enable anything.
- **"Continue to Checkout" button** (existing, in the bag and milk summary) was left as it was. It only opens a notice that nothing was submitted. You may prefer a different label.
- **Existing copy I did not rewrite:** a few non-marketplace claims written in earlier phases remain (for example the About card about "mindful packaging" and the home step "Fresh batches, mindful handling"). They are not in the Blueprint, so they may need review. I changed only copy tied to the Phase 3.2 rules.
- **"Approved vendors"** wording comes from the blueprint ("Dairybuy staff collect milk from approved vendors"). Whether each named vendor is formally approved is the client's call.

## Files

Created: `src/lib/business.ts`, `src/components/delivery/DeliveryInfo.tsx`, `src/lib/business.test.ts`, `src/lib/source-rules.test.ts`, `docs/PHASE3_2_REPORT.md`.

Modified: `src/lib/milk.ts`, `src/lib/bag.ts`, `src/lib/catalogue.ts` (one subtitle), `src/components/milk/MilkVendorSelector.tsx`, `src/components/bag/BagDrawer.tsx`, `src/components/layout/SiteFooter.tsx`, `src/app/page.tsx`, `src/app/about/page.tsx`, `src/app/milk/page.tsx`, `src/lib/milk.test.ts`, `src/lib/vendors.test.ts`, `src/lib/bag.test.ts`, `docs/VENDOR_VERIFICATION.md`, `MIGRATION_NOTES.md`, `README.md`.

Not changed: `package.json`, `package-lock.json`, assets, fonts, design tokens, `layout.tsx`, `products` page.

## Private backup

`dairybuy-private-source-archives.zip` was **not** modified and is not re-delivered: `sha256sum -c SHA256SUMS.txt` still reports all three archives OK. The project itself contains no ZIP files. (The separate `dairybuy.zip` upload still has the archives under `public/assets/aistudio/`; it was not used as the base.)

Stopped after Phase 3.2. No further phase started.
