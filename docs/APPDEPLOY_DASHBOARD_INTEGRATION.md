# Dairybuy Phase 4 — AppDeploy Operations Dashboard Integration Plan

## 1. Context & Prototype Reference

In earlier exploration phases, an operations dashboard prototype was developed under AppDeploy / Lovable (Prototype App ID: `4407f953-c6ff-4a24-aa0b-66ef7205d972`, TanStack Start / Vite).

The active production customer website and unified backend reside in AI Studio (Applet ID: `c60d2295-7ad2-47d7-b0c7-146dd74ecd4b`).

This document defines the architectural bridge ensuring that the operations dashboard and the customer storefront operate seamlessly as **one unified system** with zero duplication or state divergence.

---

## 2. Unified Database Strategy (Single Source of Truth)

Both the Customer Storefront (`c60d2295-7ad2-47d7-b0c7-146dd74ecd4b`) and the Operations Dashboard (`4407f953-c6ff-4a24-aa0b-66ef7205d972`) share the **exact same Supabase PostgreSQL database**:

```
                              ┌────────────────────────────────────────┐
                              │       Shared Supabase Database         │
                              │  (PostgreSQL 15+ & Row-Level Security) │
                              └──────────────────┬─────────────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        │                                                 │
                        ▼                                                 ▼
        ┌───────────────────────────────┐                 ┌───────────────────────────────┐
        │  Dairybuy Customer Storefront │                 │  AppDeploy Operations Portal  │
        │      (Next.js App Router)     │                 │     (Role-Based Dashboard)    │
        │   App ID: c60d2295...         │                 │   App ID: 4407f953...         │
        └───────────────────────────────┘                 └───────────────────────────────┘
                        │                                                 │
               Customers place orders,                           Staff manage procurement,
               subscribe & view bag                              inventory, deliveries & COD
```

### Shared Tables:
1. `public.orders`, `public.order_items`, `public.order_status_history`: Orders placed on the customer site appear immediately in the operations dashboard for morning/evening dispatch.
2. `public.inventory`, `public.inventory_movements`: Stock changes made by operations staff update customer availability in real time.
3. `public.vendor_prices`: The dashboard reads active vendor prices for Healthy Haryana, VIP Pure, Ghosh Dairy and the dedicated Canteen Milk Centre arrangement. Removed vendor IDs must not be re-created.
4. `public.user_roles`, `public.staff_permissions`: Centralized RBAC ensures delivery boys, operations personnel, and administrators have identical permissions across apps.

---

## 3. Operations Dashboard Workflows

The Operations Dashboard will interface with the following core modules:

### Module 1: Procurement & Milk Aggregation
- **View**: Aggregates daily demand by vendor (`Healthy Haryana`, `VIP Pure Milk`, `Ghosh Dairy`, `Canteen Milk Centre`) and milk type (`Cow`, `Buffalo`, `Canteen`) for 500 ml and 1 L packs.
- **Action**: Generates daily procurement manifests for Dairybuy collection agents before the morning (04:30 IST) and evening (16:00 IST) runs.

### Module 2: Delivery Run Sheet & Bagging
- **View**: Groups active customer orders and subscription deliveries by Topsia delivery beats.
- **Action**: Generates driver packing lists for morning (05:00 - 08:00 IST) and evening (17:00 - 20:00 IST) slots.
- **Status Updates**: Dispatches transitions `confirmed` $\rightarrow$ `procured` $\rightarrow$ `out_for_delivery` $\rightarrow$ `delivered`.

### Module 3: Cash on Delivery (COD) Reconciliation
- **View**: Lists pending cash payments for completed morning/evening delivery runs.
- **Action**: Delivery staff hand over collected cash; operations manager reconciles and creates `cod_collections` entries, closing payment records.

### Module 4: Price & Vendor Governance
- **View**: Displays approved vendors and active pricing tables.
- **Action**: Administrators maintain prices only for the currently approved vendors; vendor changes must follow the owner-approved catalogue and audit trail.

---

## 4. Rollout Strategy & Owner Sign-off

- The operations dashboard must connect using standard Supabase environment credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- In Phase 4, the database schema, seed data, and RLS policies are fully prepared to support the dashboard.
- Phase 5 will implement the operational connection and live testing upon owner review and approval.
