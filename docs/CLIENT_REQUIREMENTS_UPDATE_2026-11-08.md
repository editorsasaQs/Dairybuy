

## 12. Existing-system reconciliation — read-only audit on 8 November 2026

### Live Supabase state (project: Dairybuy-dev)

- Applied migrations currently list 12 entries, through `20261106113620_phase4_2_authenticated_cart_persistence`.
- Current active milk price rows are still the previous values:
  - Healthy Haryana: cow/buffalo 500 ml ₹42, 1 L ₹75.
  - VIP: cow ₹49/₹89, buffalo ₹59/₹109.
  - Ghosh: cow ₹59/₹109, buffalo ₹64/₹119.
  - Canteen: base ₹24/₹45 + ₹4 fee = customer total ₹28/₹49.
- Therefore the client-confirmed new price matrix is not yet present in the live database.
- Existing active service PIN rows include Topsia 700039, 700046, 700100 and 700105. Park Circus 700017 and 700019 are not present in the returned active PIN list. Reconcile exact service-area ownership before changing data.
- Schema currently has subscriptions, subscription items/deliveries, skip records and vendor-change records. It does not expose wallet, promotion, bottle-deposit or replacement-request tables in the inspected public schema. Design those only after a full table/RLS audit.

### Existing application code observations

- `src/app/api/vendors/milk/route.ts` and `src/app/api/canteen/route.ts` read live database data through `getDatabaseMilkCatalogue`.
- `src/lib/services/vendor-db-service.ts` reads `vendor_prices` and uses the current per-delivery price; canteen response separately exposes base price, delivery fee and customer total.
- `src/lib/services/pricing-service.ts` still defines a generic ₹4 order delivery fee and subscription-total helper that adds that fee per delivery. This conflicts with the new client statement that the listed milk prices include delivery unless the stored price model is reconciled carefully. Do not change this helper until one-time grocery delivery vs. milk delivery fee semantics are confirmed.
- `src/app/api/catalogue/route.ts` uses the public database catalogue view for non-milk product variants.

### Security Advisor snapshot

At 8 November 2026 audit time, the Security Advisor returned:
1. `payment_webhook_events`: RLS enabled but no policy (INFO). This may be intentional service-role-only access; verify grants and service-role-only write/read paths before deciding on a policy. Do not add a permissive client policy.
2. Leaked password protection disabled (WARN). Enable through Supabase Auth security settings after reviewing the impact on existing signups/password resets.

The earlier reported unindexed-FK and RLS-init warnings were not included in this latest Security Advisor response. Re-run performance and security advisors during the dedicated security remediation step; do not assume those findings are resolved.

### Safety decision

This was a read-only audit. No Supabase rows, schema, Auth settings, Vercel environment variables, or production deployment were modified.
