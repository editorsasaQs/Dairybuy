# Dairybuy Phase 4 — Row-Level Security (RLS) & Security Architecture

> **Verification caveat:** This document describes the intended RLS policy design and the SQL definitions present in the project. During Phase 4.1 consolidation, the 34 RLS enable statements and 62 policy declarations were statically counted, but the migrations were not executed against PostgreSQL/Supabase and runtime role-isolation tests were not run. Treat policy behavior as unverified until database-level tests pass.

## 1. Security Philosophy & Overview

Dairybuy Phase 4 implements a **zero-trust, server-authoritative security model** built directly on Supabase PostgreSQL Row-Level Security (RLS).

Key Tenets:
1. **Never Trust the Client**: Client requests can never dictate unit prices, discounts, subtotal equations, stock reserves, or user roles.
2. **Total Customer Isolation**: Customers can read and modify only their own data. Cross-tenant leakage is physically prevented at the database engine level.
3. **Strict Privilege Escalation Prevention**: User role assignments (`user_roles`) and permissions (`staff_permissions`) cannot be inserted or modified by regular customers.
4. **Operations & Admin Boundary**: Internal staff access (operations, delivery, admin) requires verified role records checked via PostgreSQL `SECURITY DEFINER` functions.

---

## 2. PostgreSQL Security Functions (Security Definer)

Defined in `/supabase/migrations/20261031000002_phase4_rls.sql`:

### 1. `public.is_admin_or_owner()`
Checks whether the executing authenticated user (`auth.uid()`) holds either the `admin` or `super_admin` role in `public.user_roles`:
```sql
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
END;
$$;
```

### 2. `public.is_staff()`
Checks whether the executing user holds any authorized staff role (`admin`, `operations`, `delivery`, `super_admin`):
```sql
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'operations', 'delivery', 'super_admin')
  );
END;
$$;
```

### 3. `public.has_staff_permission(required_perm VARCHAR)`
Verifies specific capability keys in `public.staff_permissions` or grants access if user is `admin`/`super_admin`:
```sql
CREATE OR REPLACE FUNCTION public.has_staff_permission(required_perm VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_or_owner() THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.staff_permissions
    WHERE user_id = auth.uid()
      AND permission_key = required_perm
  );
END;
$$;
```

---

## 3. Table-by-Table Policy Matrix

RLS is enabled on **all 34 tables** (`ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`).

### 1. Identity & RBAC Tables
| Table | Public / Anon | Customer | Staff / Operations | Admin / Super Admin |
| :--- | :---: | :---: | :---: | :---: |
| `profiles` | Denied | Read/Update Own Profile | Read All | Full Access |
| `user_roles` | Denied | Read Own Roles Only | Read All Roles | Insert/Update/Delete (No Customer Escalation) |
| `staff_permissions` | Denied | Denied | Read Own | Full Access |
| `customer_addresses` | Denied | Read/Write Own Addresses | Read All (for delivery) | Full Access |

### 2. Serviceability & Catalogue Tables
| Table | Public / Anon | Customer | Staff / Operations | Admin / Super Admin |
| :--- | :---: | :---: | :---: | :---: |
| `service_areas` | Read Active | Read Active | Read All | Full Access |
| `service_area_pincodes`| Read Active | Read Active | Read All | Full Access |
| `delivery_slots` | Read Active | Read Active | Read All | Full Access |
| `app_settings` | Read Public Keys | Read Public Keys | Read All | Full Access |
| `categories` | Read All | Read All | Read All | Full Access |
| `products` | Read All | Read All | Read All | Full Access |
| `product_variants` | Read Active | Read Active | Read All | Full Access |
| `product_images` | Read All | Read All | Read All | Full Access |

### 3. Vendor & Pricing Tables
| Table | Public / Anon | Customer | Staff / Operations | Admin / Super Admin |
| :--- | :---: | :---: | :---: | :---: |
| `vendors` | Read Approved | Read Approved | Read All | Full Access |
| `vendor_products` | Read Approved | Read Approved | Read All | Full Access |
| `vendor_prices` | Read Current | Read Current | Read All | Full Access (Insert New, Archive Old) |

### 4. Inventory Tables
| Table | Public / Anon | Customer | Staff / Operations | Admin / Super Admin |
| :--- | :---: | :---: | :---: | :---: |
| `inventory` | Denied | Read Stock Status | Read & Update Stock | Full Access |
| `inventory_movements` | Denied | Denied | Insert & Read | Full Access |

### 5. Commerce, Subscriptions & Orders
| Table | Public / Anon | Customer | Staff / Operations | Admin / Super Admin |
| :--- | :---: | :---: | :---: | :---: |
| `carts` & `cart_items` | Session Cart | Manage Own Cart | Read All | Full Access |
| `orders` & `order_items`| Denied | Create & Read Own Orders | Read & Update Status | Full Access |
| `order_status_history` | Denied | Read Own Orders | Insert Status Change | Full Access |
| `subscriptions` & items | Denied | Manage Own Subscriptions | Read & Manage All | Full Access |
| `subscription_deliveries`| Denied | Read Own Scheduled | Mark Completed/Skipped | Full Access |
| `payments` & `refunds` | Denied | Read Own Payment Recs | Manage Collections | Full Access |
| `cod_collections` | Denied | Denied | Record Cash Handover | Reconcile & Close |
| `audit_logs` | Denied | Denied | Denied (Append Only via Trigger) | Read All |

---

## 4. Key Attack Vectors & Enforced Defenses

### Attack Vector 1: Client Manipulating Item Prices in Bag
- **Threat**: Attacker sends `{ productId: 'ghee-red-cow-200ml', unitPriceInr: 1 }` to checkout.
- **Defense**: Server-authoritative recalculation in `src/lib/services/cart-service.ts` and `src/app/api/cart/validate/route.ts`. The server ignores client-submitted price fields entirely, looks up `product_variants.final_price_paise` (17,900 paise = ₹179), and asserts exact totals.

### Attack Vector 2: Ordering Disabled Milk Vendors
- **Threat**: Attacker submits a removed or unknown vendor ID for a milk order.
- **Defense**: The server resolves milk vendors only from the active approved-vendor catalogue and rejects unknown/removed vendor IDs. Database foreign keys and `ordering_enabled = true` constraints prevent order placement.

### Attack Vector 3: Adding Vendor Selection to Non-Milk Items
- **Threat**: Attacker tries to submit butter or ghee with a vendor ID.
- **Defense**: `validateCartItem()` detects `productRequiresVendorSelection = false` and throws validation error if `vendorId` or `milkType` is supplied. Non-milk variants are strictly centrally sourced.

### Attack Vector 4: Self-Promoting to Administrator
- **Threat**: Authenticated customer attempts `INSERT INTO user_roles (user_id, role) VALUES (auth.uid(), 'admin')`.
- **Defense**: PostgreSQL RLS policy `user_roles_modify_admin` evaluates `public.is_admin_or_owner()`. Since the caller is not already an admin, the query is rejected with `42501 (insufficient_privilege)`.

### Attack Vector 5: Out-of-Area Delivery Tampering
- **Threat**: Attacker enters an unserviced PIN (e.g. `110001` New Delhi) to bypass territory limits.
- **Defense**: `isPincodeServiceable()` asserts against the seeded Topsia Kolkata list (`700046`, `700039`, `700100`, `700105`). Unmatched pincodes are rejected before order or address creation.
