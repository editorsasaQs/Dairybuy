# Production migration reconciliation — Dairybuy

Status: planning and validation in progress. No SQL has been applied to Dairybuy-production.

## Environments

- Production project: `Dairybuy-production`, ref `wjnzlacgihdihqnrbflx`, region `ap-south-1`.
- Development project: `Dairybuy-dev`, ref `xdtdryvccuflkrogvtdo`.
- Production migration ledger is empty. Security Advisor returned no initial lint findings.
- Development migration ledger contains 28 applied versions, ending at `20261114072429` (`phase4_4_6_3_customer_delivery_confirmation`).

## Baseline findings

The 34-table Phase 4 baseline and seed are the schema/data foundation. During reconciliation, the original repository baseline was found to include `public.rls_auto_enable()` and an event trigger that were not part of the SQL recorded in the development migration ledger. The branch now restores the baseline byte-for-byte from that ledger and moves the helper into its own ordered bootstrap migration.

The helper exists in Dairybuy-dev outside its recorded migration history and is referenced by later security hardening. A clean production install therefore needs the explicit bootstrap migration before the migration that alters/revokes that helper; it must not be silently embedded into an already-recorded historical migration.

The seed migration also sets delivery windows to 08:00–11:00 and 17:00–21:00. The approved Dairybuy operating windows are 09:00–12:00 and 16:00–19:00. A forward production migration must correct these values and preserve the 07:00/16:00 order cutoffs and 07:30/16:30 cancellation cutoffs.

The seed currently enables four PIN codes (700046, 700039, 700100, 700105) for the Topsia service-area row. This needs a final serviceability review before launch; do not expand coverage automatically.

Inventory seed rows start at zero. Production stock must remain zero until physically verified by operations.

## Migration ledger alignment

Development's 28 applied versions, in order:

1. 20261105152416 phase4_schema
2. 20261105170122 phase4_seed
3. 20261105170726 phase4_rls
4. 20261105170948 phase4_1_confirmed_csv_catalogue
5. 20261105171102 phase4_2_security_config_hardening
6. 20261105171227 phase5_auth_provisioning
7. 20261105192022 enable_pgtap_testing
8. 20261105203738 restrict_public_variant_cost_access
9. 20261105205145 public_catalogue_safe_view
10. 20261106000835 phase4_3_security_hardening
11. 20261106000950 phase4_4_private_staff_helpers
12. 20261106113620 phase4_2_authenticated_cart_persistence
13. 20261108184511 sensitive_table_grants_hardening
14. 20261108185748 rls_customer_isolation_hardening
15. 20261108192348 customer_admin_only_authorization
16. 20261108201234 optimize_rls_auth_initplans
17. 20261108202047 index_unindexed_foreign_keys
18. 20261108203804 split_overlapping_rls_write_policies
19. 20261110161353 phase2_csv_authoritative_pricing
20. 20261110162034 enforce_subscription_discount_policy
21. 20261112095741 remove_unpriced_milk_vendors
22. 20261113133627 phase4_3_1_address_defaults
23. 20261113230818 phase_4_4_1_order_schema_contract
24. 20261114014841 phase_4_4_2_transactional_cod_order_rpc
25. 20261114035144 phase4_4_4_customer_order_cancellation
26. 20261114040922 phase4_4_5_order_fulfillment_transition
27. 20261114065440 phase4_4_6_2_immutable_delivery_address_snapshot
28. 20261114072429 phase4_4_6_3_customer_delivery_confirmation

The reconciliation branch now restores the exact stored SQL for all 28 applied development migrations under their exact version IDs and canonical filenames. Byte-for-byte comparison against the development migration ledger has been completed for every one of those 28 entries. The baseline file no longer smuggles in the manual RLS event-trigger helper. A separately versioned bootstrap migration, `20261106000834_rls_auto_enable_bootstrap.sql`, now records that pre-existing dependency before `20261106000835_phase4_3_security_hardening.sql`. The branch currently contains 39 SQL files: 28 exact historical migrations, one explicit RLS bootstrap migration, and the 10 later unapplied migrations. Never replay modified SQL under a version already recorded in development.

## Unapplied repository migrations after the development ledger

The reconciliation branch retains these ten later migrations, in order:

1. 20261115100000 — Phase 4.4.6.4 milk SKU inventory reservation
2. 20261115130000 — Phase 4.4.6.5 inventory reservation reconciliation
3. 20261115140000 — Phase 4.5.1 COD cash collection recording
4. 20261115160000 — Phase 4.5.2 COD cash collection review
5. 20261115170000 — Phase 4.5.3–4.5.5 COD discrepancy, handover and reporting
6. 20261115180000 — Phase 5 pending-payment enum addition
7. 20261115190000 — Phase 5.1–5.2 subscription quote and online-payment intent
8. 20261115200000 — Phase 5.3 subscription lifecycle controls
9. 20261115210000 — Phase 5.4 subscription delivery generation and operations
10. 20261115220000 — Phase 5.5 pause/resume reservation release

These files are not yet in the development migration ledger. They require review and a clean-database test before production use.

## COD-only incompatibilities requiring redesign

The present Phase 5 SQL is not compatible with the approved COD-only launch:

- The subscription payment constraint explicitly prohibits COD and requires online/UPI/card for a subscription payment.
- The subscription checkout RPC creates a `pending_online` payment intent.
- Phase 5.4 generates deliveries only when a trusted online payment is captured and has a gateway payment ID.
- Generated subscription orders are marked `payment_method='online'` and `payment_status='captured'`.
- The COD collection/review/reporting migrations currently constrain their workflows to one-time orders, not subscription delivery orders.
- Existing Phase 5 pgTAP tests assert that subscription COD is prohibited and the scheduler requires captured gateway payment; those tests must be rewritten for the approved launch model.
- The current customer quote builder stops at quote display and does not create a subscription. A COD subscription confirmation path is still required.

No Razorpay, Cashfree, other gateway, webhook, wallet, or online refund path may be introduced.

## Proposed migration stages

1. Restore the exact 28-version development history in the repository and document any separately versioned bootstrap dependency.
2. Apply the ten later migrations only after reviewing their dependencies and RLS/grant behavior.
3. Add forward-only business-rule corrections: approved delivery windows; verified serviceability list; COD subscription payment lifecycle; daily COD order/payment/collection ledger; owner/admin reconciliation; no online payment objects or gateway state.
4. Add/update pgTAP tests for clean-install ordering, RLS, privilege boundaries, one-time COD, subscription COD, scheduler idempotency, inventory reservation/release, cash collection/reconciliation and reporting.
5. Validate the complete ordered migration chain against a disposable clean PostgreSQL/Supabase test database and run lint/typecheck/unit/build/database tests.
6. Only after the migration PR is reviewed and all checks pass, apply the validated sequence to the dedicated production database. Production deployment and Vercel environment changes remain separately gated.

## Required business decision before finalizing subscription COD schema

The existing 7-day/30-day quote computes a full-plan amount and applies the 30-day discount once. COD changes the cash-collection timing and the generated daily order/payment ledger. Do not guess whether the customer pays the full plan amount on the first delivery or pays each delivery separately. This decision controls subscription activation, order totals, COD collection records, pause/skip/cancel accounting and reporting.

## Safety boundaries

- No production migration has been applied.
- No production secrets or Vercel environment variables have been changed.
- No deployment or domain change has been made.
- Keep inventory at zero until verified physical stock is entered.
- Keep the production project separate from Dairybuy-dev.
