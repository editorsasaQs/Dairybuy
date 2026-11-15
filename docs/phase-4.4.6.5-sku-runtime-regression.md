# Phase 4.4.6.5 — Milk SKU runtime regression (Stage A)

## Goal
Prove the Phase 4.4.6.4 inventory SKU fix through the real authenticated `public.create_cod_order` RPC, rather than relying only on SQL function-definition assertions.

## Runtime fixture
The pgTAP test uses the seeded Topsia service area, active morning delivery slot, approved Healthy Haryana cow-milk vendor, current 500 ml/1 L prices, and orderable cow-milk variants. It creates synthetic authenticated customers, owned addresses, active carts, and disposable inventory balances inside one transaction.

## Scenarios
A single customer order contains:
- 500 ml × 2 (selected 500 ml SKU)
- 1 L × 2 (selected 1 L SKU)
- 1.5 L × 2 (selected 1 L SKU with a 500 ml remainder per delivery)

Expected inventory reservation:
- 500 ml SKU: 4 packs (2 selected half-litre packs + 2 half-litre remainders)
- 1 L SKU: 4 packs (2 one-litre packs + 2 whole-litre components)

The test also verifies immutable order-line variant/volume snapshots, authoritative total, two exact reservation ledger movements, unchanged on-hand stock during reservation, converted cart, and pending COD payment.

A second authenticated customer then requests one additional 500 ml pack after that SKU's available stock is fully reserved. The real RPC must fail with SQLSTATE `23514`, and the transaction must leave no order or reservation movement for the losing customer.

## Verification
The test is wired into `.github/workflows/auth-pr-checks.yml` as a required database job step. It runs against the disposable local Supabase stack created by CI; it does not connect to Dairybuy-dev or production.

## Scope
This PR is test-only. It does not alter the already merged reservation migration, production code, hosted Supabase database, stock values, or deployment.
