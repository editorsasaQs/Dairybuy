# Phase 5.5 — Customer subscription experience and delivery operations

## Included
- Authenticated customer subscription list with plan totals, item/vendor snapshots, next delivery, slot, and generated delivery calendar.
- Customer pause, resume, future skip, cancellation and future-effective approved milk-vendor change controls. Every mutation calls the existing ownership-checked database RPC; no direct table writes are added.
- Server-authoritative quote API and quote builder for fixed 7-day/30-day plans, active serviceable addresses, active delivery slots, approved milk vendors, milk type, volume and quantity. The database quote RPC remains the pricing authority.
- Quote output displays frozen item totals, ₹60 30-day basket discount and final amount.
- Owner/admin delivery queue with assignment, dispatch, completion and failure resolution.
- Assigned delivery-staff page showing only deliveries assigned to the signed-in staff account; staff may dispatch and complete through the database's assignment-checked RPCs.
- Account navigation links for customer subscriptions, admin operations and assigned staff deliveries.

## Payment safety
- The quote builder deliberately stops at quote display. It does not call the pending-payment-intent RPC and does not imply a purchase.
- No online gateway is approved or integrated in this phase. A pending intent is not a payment and no plan can become active without a trusted Phase 6 payment verification event.
- No COD, cash collection, wallet, refund or auto-renew functionality is exposed for subscriptions.

## Operational constraints
- Vendor change is future-effective only, requires the same milk type and current matching price under the existing database RPC.
- Skip/cancel actions call lifecycle RPCs; cutoff enforcement and stock release remain server-side.
- Admin and staff pages rely on Supabase RLS and database RPC authorization, not client-side role claims.

## Daily scheduler configuration\n- Vercel cron invokes `/api/cron/subscriptions` at 19:00 UTC (00:30 Asia/Kolkata) every day.\n- Configure `CRON_SECRET`, `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` in the Vercel project environment. The service-role key is read only in this server route and must never use a `NEXT_PUBLIC_` prefix.\n- The endpoint uses constant-time bearer-secret comparison, derives the Kolkata-local date on the server, and calls the service-role-only database generator. It fails closed when any secret is missing.\n- This repository change does not add or reveal production secrets and does not deploy or enable the schedule in Vercel.\n\n## Remaining release gates
- Full CI (lint, typecheck, unit, build, migrations, pgTAP, authenticated browser E2E) must pass on this branch.
- Phase 6 gateway choice, signed webhook/payment verification, activation, refunds and reconciliation require separate approval and implementation.
- The daily generator still requires a production scheduler invocation after service-role/cron secrets and deployment configuration are approved. No production secret or deployment is modified here.
