# Phase 3 — Customer Experience & Storefront Plan

Base: `main` after Phase 2 merge
Planning branch: `phase3-customer-experience-commerce`
Status: Lovable source audit completed; owner confirmed Breakfast Box showcase and Contact section retention. Phase 3.1 design-token/shared-header foundation squash-merged to main (PR #42; all checks passed). Phase 3.2 homepage implementation is in progress on `phase3-2-homepage-discovery`; automated checks and Vercel Preview review pending.

## Goal

Deliver the customer-facing Dairybuy shopping experience on the existing Next.js + Supabase architecture. Improve the UI/UX using the owner's latest Lovable theme as the visual reference without replacing or weakening the production-oriented business logic, pricing authority, authentication, cart ownership, or database security.

## Mandatory design gate — Phase 3.0

The supplied `lacticious-breakfast-basket.zip` has now been statically audited against the current Dairybuy source. The legacy project name/branding is excluded from adoption. No runtime/browser execution was performed; visual and interaction acceptance must be confirmed in a Vercel Preview. Do not substitute an older archive.

Audit and report:
- Home page: hero, sections, background, colors, text, category placement, imagery, CTAs.
- Header/navigation and footer.
- Product catalogue: categories, filters, search, product cards, details and responsive states.
- Milk page: vendor/type selection, quantity controls, pricing presentation and unavailable states.
- Cart/bag drawer and all customer-facing empty/loading/error/success states.
- Typography, iconography, component styling, spacing, animation/motion and responsive layouts.
- Accessibility: keyboard navigation, focus, contrast, semantic controls and reduced motion.
- Identify every Lovable feature that is demo-only, hardcoded, simulated or incompatible with the current backend.

Deliver a page-by-page gap matrix with screenshots/reference locations where available, keep/change/adapt decisions, and an implementation sequence. No visual replacement before this audit is approved.

### Design direction already observed (not yet final approval to migrate)

A prior inspection described the newer Lovable reference as a Royal Blue / white-ice palette with Fredoka, Nunito and Pacifico typography, richer homepage composition, an 11-item product grid, animations/marquee and different navigation/layout from the current Plum / Cream / Saffron Dairybuy theme with Fraunces / Sora. Reconfirm all details from the reattached source; do not assume every prototype element is production-ready. Customer-facing brand must remain **Dairybuy**; never restore Lacticious naming or marketplace/seller onboarding.

## Owner confirmations

- **Breakfast Box: SHOW.** Include the Breakfast Box as a prominent editorial/promotional homepage feature using the supplied image and visual treatment. It is **not an orderable bundle** and must not have Add to Cart, a fabricated price, discount, ingredient guarantee or checkout action until the owner confirms its exact composition, pack sizes, availability and selling price.
- **Contact section: KEEP.** Retain a dedicated contact section in the homepage/footer information architecture. Do not invent phone, email, address or WhatsApp details. Do not ship an alert-only/fake-submit form. Until a real contact channel or approved backend form is provided, use a non-submitting presentation/placeholder treatment that clearly avoids implying messages are being sent.
- Reusable-bottle promises and marquee behaviour remain subject to confirmation; do not make unsupported operational claims. Any motion must respect `prefers-reduced-motion` and provide a pause/disable strategy where continuous.

## Phase 3.1 — Storefront visual migration

- Translate approved Lovable visual language into the existing Next.js App Router and semantic design tokens.
- Rework homepage, shared header/footer, product catalogue/cards, milk page and bag/cart UI.
- Preserve routes, app structure, assets where appropriate, responsive behaviour and accessibility.
- Do not copy prototype API calls, fake prices, fake order-success states, demo authentication, seller/marketplace flows or mock tracking.
- Keep all money/prices from the Phase 2 database-authoritative pricing services. Never hardcode product or vendor prices in UI components.
- Keep delivery-component pricing semantics and the single ₹60 discount per complete 30-day subscription basket intact.

## Phase 3.2 — Milk quantity and vendor selection UX

- Expose valid milk quantity range **0.5 L to 10 L**, in **0.5 L increments**.
- Provide a clear, mobile-friendly selector (preset chips/stepper/custom input as approved by design audit).
- Show the selected vendor, milk type, volume and database-authoritative final per-delivery price.
- Keep vendor selection constrained to approved/verified mappings; do not enable pending vendors or invent mappings.
- Validate client-side for usability and server/database-side for authority; stale cart values must be rejected/repriced safely.
- Ensure custom volumes use the Phase 2 pricing formula and do not add a second generic delivery fee.

## Phase 3.3 — Customer commerce screens and journeys

- Product browsing, categories, search/filter, product detail and add-to-cart experience.
- Cart review, edit quantity/remove, price breakdown, empty/loading/error states.
- Customer account order list and order detail presentation, aligned to the existing database schema.
- Cancellation/refund UI only where policy/status permits; actual cancellation/refund state transitions and payment effects are implemented in the later Order & Payment Management phase.
- Subscription plan discovery/selection UI may be designed and presented here, but subscription creation, renewal, pause/skip, vendor switching and delivery scheduling belong to Phase 4 and must not be faked.

## Phase 3.4 — Verification and handoff

- Unit tests for quantity selection, validation, price display and cart interactions.
- Browser E2E coverage for mobile/tablet/desktop customer journeys.
- Accessibility and responsive review at representative viewport widths.
- Verify no price duplication, no client-trusted totals, no unauthorized cart access and no marketplace copy.
- Run lint, TypeScript, unit tests, production build and relevant Supabase regression tests.
- Deploy only a Vercel Preview for review; no production deployment or domain switch without explicit approval.
- Open a PR; do not merge until the owner reviews the preview and explicitly approves.

## Renamed roadmap

| Phase | Name | Scope |
|---|---|---|
| 2 | CSV-Authoritative Pricing Foundation | Complete and merged |
| 3 | Customer Experience & Storefront | Lovable design audit/migration, milk quantity UX, catalogue, cart, customer order screens |
| 4 | Subscription & Delivery Lifecycle | 7/30-day subscription creation, daily delivery schedule, pause/skip, vendor/quantity changes, renewal and subscription history |
| 5 | Bottle Return & Deposit Operations | Bottle issue/return ledger, next-day subscription collection, one-time collection at delivery, lost/damaged occurrence policy and staff workflow |
| 6 | Checkout, Payments & Order Management | Checkout validation, payment gateway/UPI/COD, verification, order fulfilment, cancellation/refund policy and status transitions |
| 7 | Admin & Operations Completion | Role-based operational workflows, stock, dispatch, reporting and controls |
| 8 | QA, Security & Launch Readiness | Full regression, security review, performance, production readiness and launch |

## Bottle policy — preserve for Phase 5

Known rules from the owner:
- First lost/damaged bottle occurrence: no charge/refund.
- Second occurrence: refundable amount applies (exact amount and direction of charge/refund must be clarified before implementation).
- Subscription empty bottles are collected on the next day's delivery.
- One-time order empty bottles are collected by the delivery partner at delivery.

Do not invent deposit amounts, bottle sizes/types, customer liability, replacement fees, refund direction or exceptions. Confirm unresolved details before schema/policy implementation.

## Cross-phase constraints

- Dairybuy is a centrally managed business, not a marketplace. No seller app/onboarding.
- Preserve Phase 2 pricing and database changes already merged.
- Do not make production database, production environment, payment, or production deployment changes as part of Phase 3.
- Keep subscriptions, bottle ledger and cancellation/refund money movement behind their designated phase gates.
- If the latest Lovable ZIP is unavailable, pause visual migration and request the exact ZIP; do not guess from a previous archive.


## Phase 3 implementation execution checklist

### Gate A — Before visual coding
- [ ] Confirm current branch is based on the Phase 2 merged `main` and no unexpected commits are present.
- [ ] Map the actual current files for layout, global tokens, fonts, header/footer, homepage, catalogue, milk page, shared cart and customer account/order routes.
- [ ] Reconcile the 14 reference assets against existing Dairybuy assets by content hash; reuse only relevant approved assets and do not expose private archives.
- [ ] Verify font licensing and self-host approved font files. No build-time remote font dependency.
- [ ] Record current screenshots/baseline and existing test commands before changing shared UI.

### Gate B — Phase 3.1 design system and chrome
- [ ] Define semantic tokens for blue, ice, yellow, mint, peach/coral, surfaces, text, borders, focus and status colours.
- [ ] Select Fredoka/Nunito/Pacifico only after checking source/licensing; use Pacifico selectively for decorative brand accents, not body text.
- [ ] Update shared Button/Card/Badge/Chip/Input styles without changing their business behaviour.
- [ ] Restyle header while preserving mobile menu, route state, account entry, bag access, Escape close and keyboard operation.
- [ ] Restyle cart drawer while preserving shared cart state, persistence, ownership and backend validation.
- [ ] Restyle footer and keep contact information truthful.
- [ ] Add reduced-motion fallbacks, focus-visible states, semantic labels and adequate touch targets.
- [x] Verify typecheck, lint, unit tests, build, database-RBAC and auth E2E checks (PR #42; all passed).

### Gate C — Phase 3.2 homepage and discovery
- [x] Implement hero and CTAs with real Dairybuy routes/actions.
- [ ] Build categories only from currently confirmed catalogue categories and active product data.
- [x] Show Breakfast Box as editorial feature only; no price, add-to-cart or availability claim until confirmed.
- [ ] Keep how-it-works and benefits aligned to central Dairybuy collection/stock/delivery operations.
- [ ] Remove seller recruitment, unsupported products, fabricated counters, unimplemented rewards and false delivery claims.
- [x] Retain Contact section without invented contact data or fake form submission.
- [ ] Ensure motion is accessible and responsive.

### Gate D — Phase 3.3 product and milk experience
- [ ] Catalogue cards read current server/database-backed product variants and prices.
- [ ] Milk UI supports only 0.5 L–10 L in 0.5 L increments, subject to server-side validation and the approved pricing formula.
- [ ] Only verified vendor/type options can be selected; pending options remain disabled.
- [ ] No hardcoded MRP, fake discount, duplicated delivery fee or client-authoritative total.
- [ ] Add/update/remove flows continue through the existing shared cart contracts.

### Gate E — Phase 3.4 verification and review
- [ ] Browser E2E for home → catalogue/milk → cart on mobile and desktop.
- [ ] Viewport checks at 320, 360, 375, 390, 430, tablet and desktop widths.
- [ ] Accessibility checks for keyboard, focus, labels, contrast, reduced motion and drawer focus management.
- [ ] Regression checks for cart persistence/ownership, authoritative pricing and vendor eligibility.
- [ ] Run lint, typecheck, unit tests, production build and relevant backend/security regression suites.
- [ ] Create Vercel Preview only; no production deployment.
- [ ] Owner reviews preview and explicitly approves before PR merge.
