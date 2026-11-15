# Phase 3.0 — Lovable Reference Audit (Dairybuy)

Audit input: `lacticious-breakfast-basket.zip`
Scope: all project functionality, UI, UX, assets, responsive patterns, accessibility, dependencies and architecture. The legacy project name/branding is explicitly excluded from adoption. Customer-facing identity remains **Dairybuy**.
Audit method: static source inspection and image-asset inspection of the supplied ZIP, compared with the current `main` branch source. No app was executed and no browser screenshots were available; runtime behaviour and visual pixel matching therefore remain unverified.
Status: audit completed; no application code, Supabase data, Vercel deployment or production configuration changed.

## 1. Executive decision

**Use this ZIP as a visual/interaction reference, not as an application or backend source.**

The strongest reusable elements are:
- Royal-blue + icy-white visual direction with warm accent colours.
- Fredoka / Nunito / Pacifico typography pairing (subject to font licensing/self-hosting and brand approval).
- More expressive homepage composition: hero, category tiles, marquee, breakfast feature, process steps and benefit cards.
- Playful card treatments, rounded shapes, product imagery and subtle float/wiggle motion.
- A more engaging catalogue presentation and clearer product discovery concepts.

Do not copy its demo ordering logic, hardcoded product/vendor catalogue, fake discounts, cart totals, order success states, vendor marketplace positioning, contact placeholders or legacy routing/runtime. Rebuild approved visual patterns inside the existing Next.js App Router and preserve current server-authoritative pricing, authentication, cart ownership and security boundaries.

## 2. Visual system and assets

### Reference theme
- Primary direction: royal blue / deep blue with white and pale ice surfaces.
- Accents: yellow/sun, mint, peach, coral and berry/pink.
- Large rounded cards, pill buttons, playful offset shadows and irregular rounded decorative shapes.
- Headings: Fredoka; body: Nunito; logo treatment: Pacifico.
- Motion utilities: floating, wiggle, slow spin and horizontal marquee.

### Current Dairybuy main branch
- Current approved token system: Plum, Saffron, Mint, Terracotta and Cream.
- Current typography: Fraunces + Sora.
- Current layout uses restrained cards, semantic token classes and Next.js local fonts.

### Recommendation
Migrate the Lovable visual language as a coherent design-system update, not a few isolated blue buttons. Rebuild tokens, typography, buttons, cards, chips, badges, navigation, drawers, section spacing and illustration/motion patterns together. Preserve semantic contrast tokens and visible keyboard focus. Audit font files/licences and self-host fonts; do not create a production dependency on remote font fetching.

### Asset review
The ZIP contains 14 image assets:
- Banana, bread, butter, combo, curd, egg, firni, ghee, hello, hero, jam, juice, milk and mistidoi.
- Most product images are square, pastel studio-style product shots; combo is landscape; hero is a lifestyle delivery image; hello is a portrait delivery-person image.
- The assets are visually consistent with the playful palette and are candidates for reuse after product/brand relevance and licensing/provenance confirmation.
- Do not reintroduce assets for products that are not in the current confirmed catalogue. Existing main-branch assets should be reconciled by content/hash before copying; do not overwrite current assets blindly.

## 3. Page-by-page audit

### Home page
Reference structure:
1. Sticky header with wordmark, desktop navigation and Order Now CTA.
2. Hero with bold Bengali/English headline, two CTAs, lifestyle image and decorative floating shapes.
3. Animated horizontal value marquee.
4. Category tile grid (11 categories/items).
5. Large order section/product grid.
6. Breakfast Box feature panel with image and ingredient chips.
7. Four-step "How it works" section.
8. Benefit/value cards including reusable bottles and delivery.
9. Vendor/partner recruitment CTA and numerical social-proof style tiles.
10. Contact form and footer.

Keep/adapt:
- Hero split layout and clear dual CTAs.
- Category discovery grid, but populate only confirmed categories/products.
- Breakfast Box visual treatment only if the bundle and its contents/pricing are confirmed and orderable.
- Process steps and benefit cards, rewritten to reflect Dairybuy's centrally managed service.
- Marquee only if it remains useful, accessible and can pause/disable motion.

Remove/rewrite:
- Vendor/partner recruitment and "grow with us" marketplace section: conflicts with Dairybuy's centrally managed model and no seller app.
- Fake social-proof counters ("local vendors", "delivery partners", "happy homes", "365 days") unless owner supplies evidence.
- "Repeat & enjoy rewards" unless an actual offers/rewards programme is approved and implemented.
- Unsupported product/category tiles such as eggs, banana, juice, jam and bread where not in the current confirmed catalogue.
- Contact form's fake alert-only submit and placeholder email/phone. Wire to an approved backend/contact channel or do not present as a functional form.

### Product discovery / order section
Reference includes product cards with image, vendor label, unit, MRP, discounted price, percentage-off badge and Add / quantity stepper; a cart drawer with subtotal, savings, delivery and a Place Order CTA.

Visual patterns worth adapting:
- Product image cards with clear name/pack-size hierarchy.
- Add button that becomes a quantity stepper.
- Cart drawer with item editing and an understandable price summary.
- Responsive grid that changes density across breakpoints.

Critical functional problems:
- Product catalogue and prices are hardcoded in `OrderNow.tsx`.
- Milk prices, MRP, discounts and vendor options are fabricated demo values.
- Several non-milk products and pack sizes do not match the currently owner-confirmed 16-variant catalogue.
- "FREE" delivery is hardcoded.
- Savings and total are calculated from untrusted client-side demo values.
- Cart exists only in component state and is not persistent, authenticated or server-validated.
- Clicking Place Order sets `placed=true`, clears the cart and displays "Order placed!" without creating an order, payment, delivery slot or backend record.

Decision: reuse card/stepper/drawer interaction concepts only. All data, displayed prices, discount logic, availability and cart validation must come from the current Dairybuy server/database contracts. A button must never claim an order was placed unless the backend confirms it.

### Milk page
Reference includes:
- Back link, title and explanatory copy.
- All/Cow/Buffalo filters.
- Vendor cards with milk-type options.
- Quantity dropdown from 500 ml through 9 L, plus custom quantity input up to 50 L.
- Per-litre MRP/discount display and Add button.
- Side cart with savings, free delivery and fake order-success state.

Critical functional problems:
- Vendor prices and MRPs are hardcoded in `src/lib/milk.ts`.
- Four prototype vendors are shown; current Dairybuy business authority only permits verified vendor records and keeps pending vendors disabled.
- Quantity allows 250 ml and 250 ml increments in custom input; this conflicts with current owner-approved minimum 500 ml and Phase 3 plan of 0.5 L increments up to 10 L.
- Price calculation multiplies demo per-litre values and rounds to rupees; it does not use current database-authoritative vendor/pack prices or the approved price model.
- The milk cart is local state and independent from the shared persistent cart.
- It displays "FREE" delivery and can show a false "Order placed!" state.
- No service-area, slot, cutoff, authentication or backend validation.

Decision: preserve the page concept, vendor/type filters and card hierarchy, but rebuild the quantity UI as 500 ml–10 L in 500 ml increments. Use verified vendors only, authoritative server pricing, shared cart ownership and server-side validation. Do not show unavailable vendor options as addable.

### About page
Reference has a two-column image and brand-story layout with claims about local vendors/farms, reusable bottles and morning/evening delivery.

Adapt:
- Strong visual story layout and photography.
- Explain Dairybuy's central collection, quality/stock management and delivery model.
- Only use sourcing, quality, reusable-bottle and delivery claims confirmed by the owner.
- Do not imply that customers transact with independent sellers or that a marketplace is operating.

### Shared header and footer
Reference header:
- Sticky header, wordmark, desktop nav, Order Now CTA.
- No mobile-specific navigation implementation is visible in `SiteChrome.tsx`; nav is simply hidden below md, leaving only the CTA.
- The vendor nav item conflicts with no seller onboarding and should become a customer-relevant link (e.g. Milk / Catalogue / How it works).

Current Dairybuy header already has:
- Responsive mobile menu, account entry, shared bag access, active route states and Escape close.
- These behaviours must be preserved while adopting the new visual style.

Reference footer is minimal. Current footer has more useful customer links and delivery information. Keep the current information architecture, restyle it to the new palette, and avoid inventing contact details.

## 4. Interaction and accessibility audit

Positive:
- Uses semantic buttons for most interactions, visible labels for quantity inputs, aria-labels on increment/decrement controls, image alt text, and responsive grid classes.
- The UI has deliberate hover/transition treatments and consistent card/button patterns.

Gaps / requirements for migration:
- Infinite marquee has no visible pause control and no reduced-motion handling.
- Floating, wiggle and spin animations need `prefers-reduced-motion` fallbacks.
- Mobile navigation is missing in the reference header.
- Cart overlay uses click-to-close behaviour but does not implement a complete focus trap/focus restoration pattern.
- Contact form uses an alert rather than accessible inline success/error feedback and real submission.
- Product buttons need explicit disabled/loading/error states tied to backend response.
- Ensure every control is keyboard operable, has a visible focus indicator, and uses a sufficiently large touch target.
- Ensure responsive layouts are checked at 320/360/375/390/430 px, tablet and desktop, including drawers and long vendor/product names.
- Check contrast of pastel accent text and disabled controls against WCAG AA; do not assume decorative pastel combinations are accessible.

## 5. Technical architecture and dependency audit

Reference project:
- TanStack Start / TanStack Router, Vite, React 19, Tailwind 4.
- Lovable-specific Vite/TanStack config and Nitro server wrapper.
- Bun lockfile and a large shadcn/Radix UI component collection.
- A small Vitest suite focused mainly on demo milk pricing and route smoke tests.
- No Supabase client, database integration, authenticated cart, server-side price validation, payment flow or real order creation is present in the inspected source.

Current Dairybuy:
- Next.js App Router, React 19, Tailwind 4.
- Existing Supabase-backed Phase 2 pricing/cart foundations and security boundaries.
- Existing customer routes and shared UI architecture.
- Current main branch is the source of truth.

Decision:
- Do not migrate TanStack Start, Vite, Nitro, Lovable config, generated route tree or Bun lockfile into Dairybuy.
- Do not replace Next.js or the existing lockfile.
- Rebuild only approved components and page composition in the current app architecture.
- Reuse Radix/shadcn-style primitives only where the current app needs them; avoid copying the entire unused UI component directory and dependency tree.
- Keep CSRF, authentication, ownership checks, RLS and server-side authoritative pricing intact.

## 6. Main-branch vs reference differences to resolve

| Area | Lovable reference | Current Dairybuy main | Decision |
|---|---|---|---|
| Framework | TanStack Start / Vite | Next.js App Router | Keep Next.js |
| Palette | Royal blue / ice + warm accents | Plum / cream / saffron | Adopt audited Lovable direction as new token system after visual approval |
| Fonts | Fredoka / Nunito / Pacifico | Fraunces / Sora | Audit/self-host and migrate |
| Home layout | Rich multi-section playful homepage | Cleaner hero, catalogue, process, managed-business section | Expand using reference structure, remove marketplace claims |
| Catalogue | 11 hardcoded items with fake prices | Confirmed 16 non-milk variants plus database-backed milk pricing model | Keep current data authority; rebuild visual cards |
| Milk | Fake vendor prices, 0.25 L custom step | Verified/pending vendor gating and approved quantity constraints | Keep current business rules |
| Cart | Local-only demo cart | Shared cart foundation with persistence/security | Preserve current backend/cart ownership |
| Checkout | Fake client-side success | Checkout is separately gated | No fake order success |
| Navigation | Desktop-only, vendor nav | Responsive menu, account and bag | Preserve current functionality, restyle |
| Contact | Alert-only form and placeholders | No fake contact details | Only wire real approved channel |
| Motion | Float, wiggle, spin, marquee | Restrained | Selectively adopt with reduced-motion support |

## 7. Phase 3 implementation breakdown (updated)

### Phase 3.0 — Design and asset specification
- Audit completed from the ZIP source.
- Next: owner approves the design direction and any visual exceptions.
- Create a component/page migration matrix and asset map.
- Verify image licensing/provenance and fonts; self-host approved fonts.

### Phase 3.1 — Design-system and shared chrome
- Update semantic tokens, typography, buttons, cards, chips, badges, shadows and radii.
- Restyle responsive header, mobile menu, bag drawer and footer.
- Add reduced-motion and focus/accessibility treatments.
- No business logic or database changes.

### Phase 3.2 — Homepage and product discovery
- Rebuild hero, categories, catalogue discovery, breakfast feature (only if confirmed), how-it-works and benefit sections.
- Remove marketplace, fabricated metrics, unsupported products and unimplemented rewards claims.
- Keep content aligned to the centrally managed Dairybuy model.

### Phase 3.3 — Milk and catalogue experience
- Restyle product catalogue and milk selection.
- Quantity selector: 500 ml to 10 L, in 500 ml increments.
- Vendor/type selection only from approved, verified data.
- Database/server-authoritative prices and shared cart.
- No fake MRP/discount values.

### Phase 3.4 — Customer journey polish and verification
- Cart, account/order screen visual consistency, loading/empty/error states.
- Test responsive behaviour, accessibility, interactions, unit tests, E2E, lint, typecheck and build.
- Vercel Preview only; owner reviews before merge.
- No production deployment without explicit approval.

## 8. Owner confirmations and remaining decisions

Confirmed by owner:
1. **Breakfast Box: show.** Retain it as an editorial/promotional homepage feature. It is not approved as a sellable bundle yet: no Add to Cart, price, discount, availability or ingredient claims until composition, pack sizes, availability and selling price are confirmed.
2. **Contact section: keep.** Retain the section, but do not invent contact details or ship an alert-only/fake-submit form. A real contact channel or approved backend form is still required before enabling message submission.

Still unresolved:
3. Whether reusable bottles should be described as a current customer-facing promise; defer unsupported bottle claims until the owner confirms the operational wording and Phase 5 policy.
4. Whether continuous marquee motion is desired. If used, it must support reduced motion and a pause/disable strategy.

## 9. Audit limitations
- This was a static source and asset audit of the supplied ZIP and a source comparison against current `main`.
- The ZIP was not installed or run. No pixel-perfect screenshots, browser interaction, Lighthouse, axe scan or runtime security test was performed.
- The report distinguishes observed source behaviour from items requiring runtime verification.
- No application source, branch main, Supabase, Vercel or production settings were modified by this audit.
