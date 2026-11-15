# Dairybuy Phase 4 — System Architecture & Backend Foundation

## 1. Executive Summary

Dairybuy Phase 4 establishes the complete, production-grade backend architecture, normalized Supabase PostgreSQL database schema, Row-Level Security (RLS) policies, server-side business rules, and API endpoints for Dairybuy.

All data structures, vendor catalogs, milk price records, and 16 non-milk product variants strictly mirror the owner-confirmed data from **"Milk vendor and pricing-1.xlsx"** and the **Dairybuy Master Project Blueprint v1.1**.

---

## 2. Confirmed Business Model

Dairybuy operates as a **centrally managed dairy delivery business**, deliberately distinguished from open gig marketplaces:

- **Centralized Operations**: Dairybuy staff purchase, aggregate, quality-check, and deliver all dairy and food items to customer doorsteps in Kolkata.
- **Strictly Non-Marketplace**: There is NO seller onboarding, NO vendor bidding, NO external merchant store front, and NO seller app.
- **Delivery Model**: Daily morning (08:00 - 11:00 IST) and evening (17:00 - 21:00 IST) delivery slots dispatched by Dairybuy delivery staff. Same-day order cutoffs are 07:00 and 16:00; cancellation is allowed through 07:30 and 16:30 respectively.
- **Tracking Model**: Scheduled delivery windows; NO battery-draining GPS live-tracking or turn-by-turn map animations.
- **Payment Architecture**: Cash on Delivery (COD) and direct UPI / digital gateway checkout per delivery or subscription term. NO customer wallet, stored value balances, or virtual points.
- **Service Territory**: Initial launch in **Topsia, Kolkata** (Pincodes `700046`, `700039`, `700100`, `700105`), expanding gradually into adjacent Kolkata zones under central admin configuration.
- **Timezone & Localization**: All dates, cutoffs, and delivery schedules operate in `Asia/Kolkata` (IST, UTC+05:30).
- **Currency & Money Representation**: Indian Rupee (`INR`), stored exclusively as **integer paise** (`1 INR = 100 paise`) in the database, API contracts, and calculations to prevent floating-point rounding errors.

---

## 3. Confirmed Milk Vendors & Ordering Policy

Dairybuy has **three approved regular milk vendors** supplying Cow Milk and Buffalo Milk, plus **one dedicated vendor** for Canteen Milk:

| Vendor Key | Vendor Name | Status | Cow Milk | Buffalo Milk | Workbook Pricing | Ordering Available |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `healthy-haryana` | Healthy Haryana Milk Centre | Approved | Yes | Yes | Confirmed | **Enabled** |
| `vip-pure` | VIP Pure Milk | Approved | Yes | Yes | Confirmed | **Enabled** |
| `ghosh-dairy` | Ghosh Dairy | Approved | Yes | Yes | Confirmed | **Enabled** |
| `canteen-milk-centre` | Canteen Milk Centre | Approved | Canteen Type | Canteen Type | Confirmed | **Enabled** |

### Ordering Policy Rules:
1. **Healthy Haryana Milk Centre**: Cow milk and buffalo milk are intentionally priced identically per workbook (500 ml ₹42, 1 L ₹75).
2. **VIP Pure Milk & Ghosh Dairy**: Buffalo milk prices are higher than cow milk per workbook.
3. **Removed unpriced vendors**: Fresh Punjab Milk and Kolkata Milk Centre are no longer active Dairybuy vendors. Their legacy seed rows are removed by the forward migration `20261112095741_remove_unpriced_milk_vendors`; do not re-enable or re-seed them.
4. **Canteen Milk Centre**: Operates under a separate single-vendor canteen arrangement. Only canteen milk products are supplied by this vendor.
5. **Pack Sizes**: Standard fresh milk is supplied strictly in **500 ml** (`0.5 L`) and **1 L** (`1.0 L`) sealed packs. Fractional or non-standard volumes (e.g. 250 ml, 750 ml) are strictly rejected.

---

## 4. Integer Paise Pricing Discipline & Delivery Fee Architecture

### Money Representation:
- In PostgreSQL: `integer` / `bigint` with `CHECK (price >= 0)` constraints.
- In TypeScript: `number` constrained to integers (e.g., `4200` for ₹42.00).
- Formatters: Format on presentation only via `formatPaise(paise)` producing clean `₹42`.

### The Two Delivery Components:
1. **Workbook Sheet Delivery Component (`sheetDeliveryComponentPaise`)**:
   - The workbook explicitly breaks down non-milk items into:
     $$\text{Final Selling Price} = \text{Purchase Price} + \text{Sheet Delivery Component}$$
   - *Example*: Red Cow Ghee 200 ml has Purchase ₹170, Component ₹9, Final Selling Price ₹179.
   - **Crucial Rule**: The sheet delivery component is **already incorporated into the product's final selling price**. It must **NEVER** be added again during customer checkout.
2. **Order-Level Standard Delivery Fee (`deliveryFeePaise = 400`)**:
   - A flat 400 paise delivery charge applies per delivery run to cover door delivery logistics.
   - For Canteen Milk, the workbook defines: Milk Price ₹24 + Delivery Fee ₹4 = Per-delivery customer total ₹28 (500 ml) and ₹45 + ₹4 = ₹49 (1 L).
   - The delivery fee is **never added twice**.

---

## 5. Technology Stack

- **Application Framework**: Next.js 16.4.3 (App Router, Turbopack, React 19, TypeScript 5.8).
- **Styling**: Tailwind CSS v4, Lucide React icons, mobile-first responsive architecture.
- **Database**: Supabase PostgreSQL 15+ with normalized relations, foreign key constraints, composite unique indexes, check constraints, and Row-Level Security (RLS).
- **Authentication**: Supabase Auth (Phone OTP, SMS verification, Staff email/password) with automated trigger populating `public.profiles` and `public.user_roles`.
- **RBAC**: Multi-role model (`customer`, `admin`, `operations`, `delivery`, `super_admin`) enforced via PostgreSQL RLS Security Definer functions and Next.js middleware.
- **Operations Dashboard**: AppDeploy operations dashboard MVP (Prototype `4407f953-c6ff-4a24-aa0b-66ef7205d972`), sharing the unified Supabase PostgreSQL database.

---

## 6. Directory Structure & Architecture Boundaries

```
/app/applet/
├── docs/                                # Technical Architecture & Handover Documentation
│   ├── PHASE4_ARCHITECTURE.md           # System overview & business model
│   ├── PHASE4_DATABASE_SCHEMA.md        # 34-table data dictionary & constraints
│   ├── PHASE4_PRICING_CATALOGUE.md      # Confirmed milk & 16 non-milk pricing matrix
│   ├── PHASE4_RLS_SECURITY.md           # RLS policies & privilege escalation defense
│   ├── PHASE4_API_REFERENCE.md          # REST API contracts & sample payloads
│   ├── PHASE4_TEST_REPORT.md            # Comprehensive Vitest test run & coverage
│   └── APPDEPLOY_DASHBOARD_INTEGRATION.md # Operations dashboard integration blueprint
├── supabase/
│   ├── config.toml                      # Supabase CLI project configuration
│   └── migrations/
│       ├── 20261031000000_phase4_schema.sql # 34 normalized tables & indexes
│       ├── 20261031000001_phase4_seed.sql   # Confirmed vendors, products, Topsia seed
│       ├── 20261031000002_phase4_rls.sql    # RLS policies & security functions
│       └── 20261101000000_phase4_1_confirmed_csv_catalogue.sql # Disable unconfirmed legacy products
├── src/
│   ├── app/
│   │   ├── api/                         # Server-Authoritative API Endpoints
│   │   │   ├── catalogue/route.ts       # Non-milk categories & 16 variants
│   │   │   ├── vendors/milk/route.ts    # 5 milk vendors & confirmed prices
│   │   │   ├── canteen/route.ts         # Canteen Milk single-vendor contract
│   │   │   ├── cart/validate/route.ts   # Server-side cart recomputation
│   │   │   ├── service-areas/check/route.ts # Topsia serviceability check
│   │   │   └── health/route.ts          # Backend health & uptime monitor
│   │   ├── layout.tsx                   # Root Next.js layout & metadata
│   │   ├── page.tsx                     # Customer storefront home page
│   │   ├── milk/page.tsx                # Milk vendor selection page
│   │   └── products/page.tsx            # Non-milk grocery catalogue page
│   ├── components/
│   │   ├── bag/                         # Bag Drawer, Context & summary
│   │   ├── milk/                        # Milk vendor selector & canteen card
│   │   └── ui/                          # Button, Card, Toast components
│   └── lib/
│       ├── services/                    # Server-side TypeScript business logic
│       │   ├── pricing-service.ts       # Paise arithmetic, formatting, equations
│       │   ├── vendor-service.ts        # Approved vendors, ordering availability
│       │   ├── catalogue-service.ts     # 16 confirmed non-milk variants
│       │   ├── service-area-service.ts  # Pincode verification (Topsia)
│       │   ├── validation-service.ts    # Line item & order constraint validation
│       │   ├── cart-service.ts          # Server cart recomputation
│       │   └── auth-service.ts          # RBAC & staff permissions
│       └── supabase/
│           ├── client.ts                # Client-safe Supabase browser client
│           ├── server.ts                # Server-safe Supabase client (service role)
│           └── types.ts                 # Full database TypeScript types
└── public/
    └── images/products/                 # 14 original product image assets
```


## Phase 4.1 implementation-status note

The current API routes for catalogue, vendors, Canteen and cart validation use local TypeScript data/services. The Supabase schema, migrations, RLS policies and client wrappers are present, but those API/data services are not yet querying Supabase. Do not interpret the presence of Supabase environment variables as proof of database integration. See `PHASE4_1_AUDIT_REPORT.md`.
