# Dairybuy Phase 4 — Database Schema & Data Dictionary

## 1. Overview

The Dairybuy Phase 4 database architecture is implemented on **Supabase PostgreSQL 15+** across four versioned SQL migration files located in `/supabase/migrations/`:

1. `20261031000000_phase4_schema.sql`: 34 normalized relational tables, PostgreSQL enums, composite unique constraints, check constraints, foreign keys, and indexes.
2. `20261031000001_phase4_seed.sql`: Initial seed data for Topsia service territory, pincodes, delivery slots, app configuration, 7 active product categories, products, all 16 confirmed non-milk variants, 6 approved vendors (5 milk + 1 canteen), confirmed historical vendor prices in integer paise, and initial inventory stock records.
3. `20261031000002_phase4_rls.sql`: Row-Level Security (RLS) policies on all 34 tables, Security Definer RBAC helper functions, and customer data isolation rules.
4. `20261101000000_phase4_1_confirmed_csv_catalogue.sql`: Disables previously seeded unconfirmed breakfast-staple products without deleting historical rows.

All monetary values are modeled as `integer` paise (`100 paise = ₹1.00`), strictly constrained with `CHECK (price >= 0)`.

---

## 2. PostgreSQL Enumerated Types

| Enum Name | Allowed Values | Usage |
| :--- | :--- | :--- |
| `user_role_type` | `customer`, `admin`, `operations`, `delivery`, `super_admin` | Multi-role identity assignment |
| `milk_type` | `cow`, `buffalo`, `canteen` | Permitted milk types |
| `milk_pack_size` | `500ml`, `1L` | Standard sealed milk sizes |
| `product_type` | `milk`, `packaged_dairy`, `sweets` | Catalogue classification |
| `order_status` | `placed`, `confirmed`, `procured`, `out_for_delivery`, `delivered`, `cancelled` | Fulfillment lifecycle |
| `subscription_frequency` | `daily`, `alternate_days`, `weekly`, `weekdays`, `custom` | Recurrence schedule |
| `subscription_status` | `active`, `paused`, `cancelled`, `completed`, `expired` | Subscription state |
| `payment_status` | `pending`, `authorized`, `captured`, `failed`, `refunded` | Financial settlement state |
| `payment_method` | `cod`, `upi`, `card`, `netbanking` | Payment mode |
| `inventory_movement_type` | `purchase_in`, `order_out`, `wastage`, `spoilage`, `reconciliation` | Stock audit tracking |

---

## 3. Data Dictionary: Tables by Domain

### Domain 1: Identity & Access Management

#### 1. `profiles`
Links directly to `auth.users(id)` via `ON DELETE CASCADE`.
- `id` (UUID, PK): References `auth.users.id`.
- `phone` (VARCHAR(15), UNIQUE, NOT NULL): E.164 formatted customer or staff mobile number.
- `full_name` (VARCHAR(255), NULL): Customer display name.
- `email` (VARCHAR(255), UNIQUE, NULL): Customer or staff email.
- `is_active` (BOOLEAN, DEFAULT true): Account active status.
- `created_at` / `updated_at` (TIMESTAMPTZ, NOT NULL).

#### 2. `user_roles`
Tracks role assignments for access control.
- `id` (UUID, PK, DEFAULT gen_random_uuid()).
- `user_id` (UUID, NOT NULL): FK to `profiles(id)`.
- `role` (user_role_type, NOT NULL, DEFAULT 'customer').
- `assigned_by` (UUID, NULL): FK to `profiles(id)`.
- `created_at` (TIMESTAMPTZ, NOT NULL).
- *Constraint*: `UNIQUE(user_id, role)` prevents duplicate role assignment.

#### 3. `staff_permissions`
Granular operational capability flags for admin and operations staff.
- `id` (UUID, PK).
- `user_id` (UUID, NOT NULL): FK to `profiles(id)`.
- `permission_key` (VARCHAR(100), NOT NULL): e.g. `manage_inventory`, `view_procurement`, `manage_service_areas`.
- `granted_by` (UUID, NULL): FK to `profiles(id)`.
- `created_at` (TIMESTAMPTZ, NOT NULL).
- *Constraint*: `UNIQUE(user_id, permission_key)`.

#### 4. `customer_addresses`
Physical delivery addresses in serviceable Kolkata areas.
- `id` (UUID, PK).
- `customer_id` (UUID, NOT NULL): FK to `profiles(id)`.
- `label` (VARCHAR(50), NOT NULL, DEFAULT 'Home'): Home, Work, Other.
- `address_line1` (TEXT, NOT NULL): Flat, floor, building name.
- `address_line2` (TEXT, NULL): Street, lane, landmark.
- `area` (VARCHAR(100), NOT NULL): e.g. 'Topsia'.
- `city` (VARCHAR(100), NOT NULL, DEFAULT 'Kolkata').
- `pincode` (VARCHAR(6), NOT NULL): 6-digit Indian PIN.
- `is_default` (BOOLEAN, DEFAULT false).
- `delivery_instructions` (TEXT, NULL): Bell instructions, gate codes.
- `created_at` / `updated_at` (TIMESTAMPTZ, NOT NULL).

---

### Domain 2: Serviceability & Operational Settings

#### 5. `service_areas`
Operational delivery zones centrally managed by Dairybuy.
- `id` (UUID, PK).
- `name` (VARCHAR(100), NOT NULL, UNIQUE): e.g. 'Topsia'.
- `city` (VARCHAR(100), NOT NULL, DEFAULT 'Kolkata').
- `is_active` (BOOLEAN, DEFAULT true): Whether orders are accepted.
- `created_at` / `updated_at` (TIMESTAMPTZ, NOT NULL).

#### 6. `service_area_pincodes`
Permitted 6-digit Kolkata pincodes linked to service areas.
- `id` (UUID, PK).
- `service_area_id` (UUID, NOT NULL): FK to `service_areas(id)`.
- `pincode` (VARCHAR(6), NOT NULL, UNIQUE): Seeded with `700046`, `700039`, `700100`, `700105`.
- `is_serviceable` (BOOLEAN, DEFAULT true).
- `created_at` (TIMESTAMPTZ, NOT NULL).

#### 7. `delivery_slots`
Delivery operational windows in `Asia/Kolkata`.
- `id` (UUID, PK).
- `name` (VARCHAR(50), NOT NULL): e.g. 'Morning Delivery', 'Evening Delivery'.
- `start_time` (TIME, NOT NULL): '08:00:00' or '17:00:00'.
- `end_time` (TIME, NOT NULL): '11:00:00' or '21:00:00'.
- `order_cutoff_time` (TIME, NOT NULL): 07:00 for morning or 16:00 for evening; `cancellation_deadline_time` is 07:30 or 16:30 respectively.
- `is_active` (BOOLEAN, DEFAULT true).
- `created_at` (TIMESTAMPTZ, NOT NULL).

#### 8. `app_settings`
Global system configuration key-value store.
- `key` (VARCHAR(100), PK): e.g. `standard_delivery_fee_paise`, `currency_code`, `timezone`.
- `value` (JSONB, NOT NULL): Stored values (e.g. `400`, `"INR"`, `"Asia/Kolkata"`).
- `description` (TEXT, NULL).
- `updated_at` (TIMESTAMPTZ, NOT NULL).

---

### Domain 3: Catalogue & Product Data

#### 9. `categories`
Product category definitions.
- `id` (VARCHAR(50), PK): `milk`, `ghee`, `butter`, `cheese`, `paneer`, `doi`, `sweets`, `curd`.
- `name` (VARCHAR(100), NOT NULL).
- `slug` (VARCHAR(100), NOT NULL, UNIQUE).
- `sort_order` (INTEGER, NOT NULL, DEFAULT 0).
- `created_at` (TIMESTAMPTZ, NOT NULL).

#### 10. `products`
Master product records.
- `id` (VARCHAR(100), PK): e.g. `milk-fresh`, `canteen-milk`, `ghee-red-cow`, `butter-amul`.
- `category_id` (VARCHAR(50), NOT NULL): FK to `categories(id)`.
- `name` (VARCHAR(255), NOT NULL).
- `brand` (VARCHAR(100), NOT NULL).
- `description` (TEXT, NULL).
- `product_type` (product_type, NOT NULL).
- `is_subscription_eligible` (BOOLEAN, NOT NULL, DEFAULT false): True for fresh milk only per owner confirmation.
- `created_at` / `updated_at` (TIMESTAMPTZ, NOT NULL).

#### 11. `product_variants`
Pack sizes, purchase prices, sheet delivery components, and final prices.
- `id` (VARCHAR(100), PK): e.g. `ghee-red-cow-200ml`, `butter-amul-100g`.
- `product_id` (VARCHAR(100), NOT NULL): FK to `products(id)`.
- `pack_size` (VARCHAR(50), NOT NULL): e.g. `200 ml`, `100 g`, `1 piece`.
- `purchase_price_paise` (INTEGER, NOT NULL, CHECK >= 0): Preserved workbook purchase cost.
- `sheet_delivery_component_paise` (INTEGER, NOT NULL, CHECK >= 0): Preserved sheet delivery component.
- `final_price_paise` (INTEGER, NOT NULL, CHECK >= 0): The final customer selling price.
- *Constraint*: `CHECK (final_price_paise = purchase_price_paise + sheet_delivery_component_paise)`.
- `is_active` (BOOLEAN, DEFAULT true).
- `created_at` / `updated_at` (TIMESTAMPTZ, NOT NULL).

#### 12. `product_images`
Product imagery mapped to `/images/products/`.
- `id` (UUID, PK).
- `product_id` (VARCHAR(100), NOT NULL): FK to `products(id)`.
- `image_url` (VARCHAR(500), NOT NULL).
- `alt_text` (VARCHAR(255), NULL).
- `is_primary` (BOOLEAN, DEFAULT true).

---

### Domain 4: Vendors & Procurement Pricing

#### 13. `vendors`
Approved vendor entities.
- `id` (VARCHAR(100), PK): `healthy-haryana`, `vip-pure`, `ghosh-dairy`, `canteen-milk-centre` in the active catalogue. Legacy seed IDs `fresh-punjab` and `kolkata-centre` are removed by the forward migration `20261112095741_remove_unpriced_milk_vendors`.
- `name` (VARCHAR(255), NOT NULL).
- `is_approved` (BOOLEAN, NOT NULL, DEFAULT true).
- `ordering_enabled` (BOOLEAN, NOT NULL, DEFAULT false): Enabled for the 3 confirmed regular vendors and Canteen Milk Centre.
- `is_canteen_vendor` (BOOLEAN, NOT NULL, DEFAULT false): True only for `canteen-milk-centre`.
- `created_at` / `updated_at` (TIMESTAMPTZ, NOT NULL).

#### 14. `vendor_products`
Many-to-many relationship linking vendors to products.
- `id` (UUID, PK).
- `vendor_id` (VARCHAR(100), NOT NULL): FK to `vendors(id)`.
- `product_id` (VARCHAR(100), NOT NULL): FK to `products(id)`.
- `milk_type` (milk_type, NULL): `cow`, `buffalo`, `canteen`.
- *Constraint*: `UNIQUE(vendor_id, product_id, milk_type)`.

#### 15. `vendor_prices`
Complete historical price table preserving effective dates.
- `id` (UUID, PK).
- `vendor_id` (VARCHAR(100), NOT NULL): FK to `vendors(id)`.
- `milk_type` (milk_type, NOT NULL).
- `pack_size` (milk_pack_size, NOT NULL): `500ml` or `1L`.
- `price_per_delivery_paise` (INTEGER, NOT NULL, CHECK >= 0).
- `plan_7_day_paise` (INTEGER, NOT NULL, CHECK >= 0).
- `plan_30_day_paise` (INTEGER, NOT NULL, CHECK >= 0).
- `delivery_fee_paise` (INTEGER, NOT NULL, DEFAULT 400).
- `effective_from` (TIMESTAMPTZ, NOT NULL, DEFAULT now()).
- `effective_to` (TIMESTAMPTZ, NULL): NULL indicates currently active price.
- `is_current` (BOOLEAN, NOT NULL, DEFAULT true).
- *Rule*: Historical records are never overwritten; price changes insert new rows and set `effective_to` on old rows.

---

### Domain 5: Inventory & Stock Control

#### 16. `inventory`
Real-time stock ledger per product variant.
- `id` (UUID, PK).
- `product_variant_id` (VARCHAR(100), NOT NULL, UNIQUE): FK to `product_variants(id)`.
- `stock_quantity` (INTEGER, NOT NULL, DEFAULT 0, CHECK >= 0).
- `reserved_quantity` (INTEGER, NOT NULL, DEFAULT 0, CHECK >= 0).
- `reorder_threshold` (INTEGER, NOT NULL, DEFAULT 10).
- `updated_at` (TIMESTAMPTZ, NOT NULL).

#### 17. `inventory_movements`
Full audit trail of all stock changes.
- `id` (UUID, PK).
- `product_variant_id` (VARCHAR(100), NOT NULL): FK to `product_variants(id)`.
- `movement_type` (inventory_movement_type, NOT NULL).
- `quantity` (INTEGER, NOT NULL): Positive for receipts, negative for dispatches.
- `reference_id` (VARCHAR(100), NULL): Order ID or procurement PO number.
- `recorded_by` (UUID, NULL): FK to `profiles(id)`.
- `created_at` (TIMESTAMPTZ, NOT NULL).

---

### Domain 6: Commerce, Subscriptions & Fulfillment

#### 18. `carts` & 19. `cart_items`
Persistent customer shopping bags with line item validation.
- Prevents vendor selection on non-milk items.
- Enforces standard pack sizes on milk items.

#### 20. `orders` & 21. `order_items` & 22. `order_status_history`
Server-authoritative customer orders.
- All monetary totals calculated and sealed server-side in paise.
- Full state transition audit trail (`order_status_history`).

#### 23. `subscriptions` & 24. `subscription_items` & 25. `subscription_deliveries` & 26. `subscription_skip_records` & 27. `subscription_vendor_changes`
Comprehensive recurring dairy delivery engine.
- Supports 7-day and 30-day milk plans.
- Tracks daily fulfillment runs (`subscription_deliveries`).
- Allows advance customer skip dates (`subscription_skip_records`).
- Preserves audit log of vendor switches (`subscription_vendor_changes`).

#### 28. `payments` & 29. `refunds` & 30. `payment_webhook_events` & 31. `cod_collections`
Financial settlement infrastructure.
- Idempotent webhook event logging.
- Cash-on-delivery collection reconciliation per delivery agent.

#### 32. `delivery_assignments` & 33. `notifications` & 34. `audit_logs`
Operations dashboard and staff execution logs.
