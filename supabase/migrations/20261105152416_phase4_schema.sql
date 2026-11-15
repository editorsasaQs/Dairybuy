-- =============================================================================
-- DAIRYBUY - PHASE 4 DATABASE SCHEMA (CORRECTED REVIEW COPY)
-- Migration: 20261031000000_phase4_schema.sql
-- Framework: Supabase PostgreSQL (Postgres 15+)
-- Currency: INR stored as integer paise (1 INR = 100 paise)
-- Timezone: Asia/Kolkata
-- =============================================================================

-- Static-review corrected copy. Original migration remains unchanged.
-- Not executed against PostgreSQL or Supabase.

-- Enable essential extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- ENUM TYPES
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM (
        'owner',
        'admin',
        'manager',
        'operations_staff',
        'customer'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE staff_permission_enum AS ENUM (
        'manage_catalogue',
        'manage_pricing',
        'manage_vendors',
        'manage_inventory',
        'assign_deliveries',
        'manage_staff',
        'manage_customers',
        'view_reports'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE milk_type_enum AS ENUM ('cow', 'buffalo', 'canteen');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE product_type_enum AS ENUM ('standard_milk', 'canteen_milk', 'grocery_dairy');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE order_type_enum AS ENUM ('one_time', 'subscription');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE order_status_enum AS ENUM (
        'draft',
        'pending_confirmation',
        'confirmed',
        'processing',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'failed'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status_enum AS ENUM ('active', 'paused', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE subscription_plan_enum AS ENUM ('7_day', '30_day', 'custom');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE delivery_status_enum AS ENUM (
        'scheduled',
        'assigned',
        'out_for_delivery',
        'delivered',
        'skipped',
        'failed'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_enum AS ENUM (
        'pending',
        'authorized',
        'captured',
        'failed',
        'refunded',
        'partially_refunded'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- -----------------------------------------------------------------------------
-- 1. IDENTITY & ACCESS CONTROL
-- -----------------------------------------------------------------------------

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(150),
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User roles (never stored in user-editable profile metadata)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role_enum NOT NULL DEFAULT 'customer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Explicit staff permissions (granular RBAC)
CREATE TABLE IF NOT EXISTS public.staff_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission staff_permission_enum NOT NULL,
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_staff_permissions_user_permission UNIQUE (user_id, permission)
);
CREATE INDEX IF NOT EXISTS idx_staff_permissions_user ON public.staff_permissions(user_id);

-- -----------------------------------------------------------------------------
-- 2. SERVICEABILITY & LOGISTICS CONFIGURATION
-- -----------------------------------------------------------------------------

-- Service areas (Launch area: Topsia, Kolkata)
CREATE TABLE IF NOT EXISTS public.service_areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Kolkata',
    state VARCHAR(100) NOT NULL DEFAULT 'West Bengal',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service area pincodes (e.g. Topsia 700046, 700039)
CREATE TABLE IF NOT EXISTS public.service_area_pincodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_area_id UUID NOT NULL REFERENCES public.service_areas(id) ON DELETE CASCADE,
    pincode VARCHAR(6) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_area_pincodes_pincode ON public.service_area_pincodes(pincode);

-- Delivery slots (Morning 9 AM-12 PM, Evening 4 PM-7 PM)
CREATE TABLE IF NOT EXISTS public.delivery_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slot_code VARCHAR(30) UNIQUE NOT NULL,
    label VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    order_cutoff_time TIME NOT NULL,
    cancellation_deadline_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- App settings (central business configuration, e.g. delivery fee = 400 paise)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customer delivery addresses
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_area_id UUID REFERENCES public.service_areas(id) ON DELETE SET NULL,
    address_type VARCHAR(20) NOT NULL DEFAULT 'home', -- 'home', 'work', 'other'
    recipient_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    landmark TEXT,
    city VARCHAR(100) NOT NULL DEFAULT 'Kolkata',
    state VARCHAR(100) NOT NULL DEFAULT 'West Bengal',
    pincode VARCHAR(6) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON public.customer_addresses(customer_id);

-- -----------------------------------------------------------------------------
-- 3. CATALOGUE ARCHITECTURE
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
    id VARCHAR(100) PRIMARY KEY,
    category_id VARCHAR(50) NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    subtitle TEXT,
    description TEXT,
    product_type product_type_enum NOT NULL DEFAULT 'grocery_dairy',
    requires_vendor_selection BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Constraint: Only standard milk requires vendor selection; canteen has single arrangement
    CONSTRAINT chk_milk_vendor_selection CHECK (
        (product_type = 'standard_milk' AND requires_vendor_selection = TRUE) OR
        (product_type != 'standard_milk' AND requires_vendor_selection = FALSE)
    )
);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON public.products(product_type);

-- Product variants (exact sizes and prices in integer paise)
CREATE TABLE IF NOT EXISTS public.product_variants (
    id VARCHAR(100) PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_name VARCHAR(150) NOT NULL,
    brand VARCHAR(100),
    pack_size VARCHAR(50) NOT NULL, -- e.g. '500 ml', '1 L', '100 g', '200 g', '1 piece'
    pack_unit VARCHAR(20) NOT NULL, -- 'ml', 'L', 'g', 'piece'
    unit_quantity NUMERIC(10, 2) NOT NULL,
    purchase_price_paise INTEGER, -- Purchase cost in paise (nullable for standard milk which varies by vendor)
    sheet_delivery_component_paise INTEGER DEFAULT 0, -- Delivery component from workbook (included in final price)
    final_price_paise INTEGER, -- Final single-quantity daily sale price in paise (inclusive of component)
    is_orderable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Constraint: Final price must equal purchase price + sheet delivery component when both are set
    CONSTRAINT chk_price_component_sum CHECK (
        purchase_price_paise IS NULL OR
        sheet_delivery_component_paise IS NULL OR
        final_price_paise IS NULL OR
        final_price_paise = purchase_price_paise + sheet_delivery_component_paise
    ),
    -- Constraint: Milk standard pack sizes must be either 500 ml or 1 L
    CONSTRAINT chk_milk_pack_sizes CHECK (
        pack_size NOT IN ('500 ml', '1 L') OR unit_quantity IN (0.5, 1.0)
    )
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);

CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(100) NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_images_product_url
ON public.product_images(product_id, image_url);

-- -----------------------------------------------------------------------------
-- 4. VENDORS & MULTI-VENDOR MILK PRICING
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendors (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    vendor_type VARCHAR(50) NOT NULL DEFAULT 'milk_vendor', -- 'milk_vendor', 'canteen_vendor'
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    ordering_enabled BOOLEAN NOT NULL DEFAULT FALSE, -- Disabled for Fresh Punjab & Kolkata Milk Centre
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supported products and milk types per vendor
CREATE TABLE IF NOT EXISTS public.vendor_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id VARCHAR(100) NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    product_id VARCHAR(100) NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    milk_type milk_type_enum NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vendor_products UNIQUE (vendor_id, product_id, milk_type)
);
CREATE INDEX IF NOT EXISTS idx_vendor_products_vendor ON public.vendor_products(vendor_id);

-- Vendor pricing with historical versioning & effective dates (Never overwrite!)
CREATE TABLE IF NOT EXISTS public.vendor_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id VARCHAR(100) NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
    product_variant_id VARCHAR(100) NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    milk_type milk_type_enum NOT NULL,
    price_per_delivery_paise INTEGER NOT NULL CHECK (price_per_delivery_paise >= 0),
    plan_7_day_paise INTEGER CHECK (plan_7_day_paise >= 0),
    plan_30_day_paise INTEGER CHECK (plan_30_day_paise >= 0),
    delivery_fee_paise INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_paise >= 0), -- 400 for canteen, 0 for regular milk lines
    total_customer_delivery_paise INTEGER NOT NULL CHECK (total_customer_delivery_paise >= 0),
    effective_from TIMESTAMPTZ NOT NULL DEFAULT '2026-01-01 00:00:00+05:30',
    effective_to TIMESTAMPTZ, -- NULL means currently active
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Constraint: Total customer per delivery = price + delivery fee
    CONSTRAINT chk_total_delivery_sum CHECK (
        total_customer_delivery_paise = price_per_delivery_paise + delivery_fee_paise
    )
);
CREATE INDEX IF NOT EXISTS idx_vendor_prices_lookup
ON public.vendor_prices(vendor_id, product_variant_id, milk_type, is_current);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_prices_effective_version
ON public.vendor_prices(vendor_id, product_variant_id, milk_type, effective_from); 
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_prices_one_current
ON public.vendor_prices(vendor_id, product_variant_id, milk_type)
WHERE is_current = TRUE AND effective_to IS NULL;

-- -----------------------------------------------------------------------------
-- 5. INVENTORY MANAGEMENT
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_variant_id VARCHAR(100) NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    service_area_id UUID REFERENCES public.service_areas(id) ON DELETE SET NULL,
    available_stock INTEGER NOT NULL DEFAULT 0 CHECK (available_stock >= 0),
    reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
    safety_stock INTEGER NOT NULL DEFAULT 10 CHECK (safety_stock >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_variant_area UNIQUE (product_variant_id, service_area_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE RESTRICT,
    change_amount INTEGER NOT NULL, -- positive for restock, negative for deduction
    movement_type VARCHAR(50) NOT NULL, -- 'restock', 'order_reservation', 'order_fulfilled', 'spoilage', 'audit_adjustment'
    reference_id VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_inventory ON public.inventory_movements(inventory_id);

-- -----------------------------------------------------------------------------
-- 6. COMMERCE: CARTS, ORDERS, SUBSCRIPTIONS & PAYMENTS
-- -----------------------------------------------------------------------------

-- Carts
CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'converted', 'abandoned'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_carts_customer ON public.carts(customer_id);

-- Cart items (validates milk vs non-milk rules)
CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    product_variant_id VARCHAR(100) NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    vendor_id VARCHAR(100) REFERENCES public.vendors(id) ON DELETE RESTRICT,
    milk_type milk_type_enum,
    quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 100),
    unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.cart_items(cart_id);

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    customer_address_id UUID NOT NULL REFERENCES public.customer_addresses(id) ON DELETE RESTRICT,
    service_area_id UUID NOT NULL REFERENCES public.service_areas(id) ON DELETE RESTRICT,
    delivery_slot_id UUID NOT NULL REFERENCES public.delivery_slots(id) ON DELETE RESTRICT,
    order_type order_type_enum NOT NULL DEFAULT 'one_time',
    status order_status_enum NOT NULL DEFAULT 'draft',
    subtotal_paise INTEGER NOT NULL CHECK (subtotal_paise >= 0),
    delivery_fee_paise INTEGER NOT NULL DEFAULT 400 CHECK (delivery_fee_paise >= 0), -- standard ₹4 delivery fee
    total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
    payment_status payment_status_enum NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(30) DEFAULT 'cod', -- 'online', 'cod'
    delivery_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_order_total_match CHECK (total_paise = subtotal_paise + delivery_fee_paise)
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders(created_at);

-- Order items
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_variant_id VARCHAR(100) NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    vendor_id VARCHAR(100) REFERENCES public.vendors(id) ON DELETE RESTRICT,
    milk_type milk_type_enum,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
    total_price_paise INTEGER NOT NULL CHECK (total_price_paise >= 0),
    CONSTRAINT chk_order_item_calc CHECK (total_price_paise = unit_price_paise * quantity)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- Order status audit history
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    from_status order_status_enum,
    to_status order_status_enum NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(order_id);

-- Subscriptions (recurrent 7-day, 30-day, or custom milk routines)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    customer_address_id UUID NOT NULL REFERENCES public.customer_addresses(id) ON DELETE RESTRICT,
    service_area_id UUID NOT NULL REFERENCES public.service_areas(id) ON DELETE RESTRICT,
    delivery_slot_id UUID NOT NULL REFERENCES public.delivery_slots(id) ON DELETE RESTRICT,
    plan_type subscription_plan_enum NOT NULL,
    status subscription_status_enum NOT NULL DEFAULT 'active',
    start_date DATE NOT NULL,
    end_date DATE,
    next_delivery_date DATE,
    auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON public.subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

CREATE TABLE IF NOT EXISTS public.subscription_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    product_variant_id VARCHAR(100) NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    vendor_id VARCHAR(100) REFERENCES public.vendors(id) ON DELETE RESTRICT,
    milk_type milk_type_enum,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_per_delivery_paise INTEGER NOT NULL CHECK (price_per_delivery_paise >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscription_items_sub ON public.subscription_items(subscription_id);

-- Daily individual subscription delivery events
CREATE TABLE IF NOT EXISTS public.subscription_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    delivery_date DATE NOT NULL,
    delivery_slot_id UUID NOT NULL REFERENCES public.delivery_slots(id) ON DELETE RESTRICT,
    status delivery_status_enum NOT NULL DEFAULT 'scheduled',
    assigned_staff_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    delivered_at TIMESTAMPTZ,
    delivery_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sub_date_slot UNIQUE (subscription_id, delivery_date, delivery_slot_id)
);
CREATE INDEX IF NOT EXISTS idx_sub_deliveries_date ON public.subscription_deliveries(delivery_date, status);

CREATE TABLE IF NOT EXISTS public.subscription_skip_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    skip_date DATE NOT NULL,
    reason TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_subscription_skip_date UNIQUE (subscription_id, skip_date)
);

CREATE TABLE IF NOT EXISTS public.subscription_vendor_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    old_vendor_id VARCHAR(100) NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
    new_vendor_id VARCHAR(100) NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
    effective_from DATE NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_subscription_vendor_change_diff CHECK (old_vendor_id <> new_vendor_id)
);

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE RESTRICT,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    gateway VARCHAR(30) NOT NULL DEFAULT 'cod', -- 'razorpay', 'cod'
    gateway_payment_id VARCHAR(100),
    gateway_order_id VARCHAR(100),
    status payment_status_enum NOT NULL DEFAULT 'pending',
    method VARCHAR(30) DEFAULT 'cod',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_payment_exactly_one_parent
        CHECK (num_nonnulls(order_id, subscription_id) = 1)
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON public.payments(subscription_id);

CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    reason TEXT,
    gateway_refund_id VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gateway_event_id VARCHAR(150) NOT NULL UNIQUE,
    gateway VARCHAR(30) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cod_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    collected_by_staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    amount_collected_paise INTEGER NOT NULL CHECK (amount_collected_paise > 0),
    verified_by_manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'collected' -- 'collected', 'verified', 'disputed'
);

CREATE TABLE IF NOT EXISTS public.delivery_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    delivery_date DATE NOT NULL,
    delivery_slot_id UUID NOT NULL REFERENCES public.delivery_slots(id) ON DELETE RESTRICT,
    service_area_id UUID NOT NULL REFERENCES public.service_areas(id) ON DELETE RESTRICT,
    route_order JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'assigned', -- 'assigned', 'in_progress', 'completed'
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_lookup ON public.delivery_assignments(staff_id, delivery_date);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'order_update', 'delivery_reminder', 'system'
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS trg_customer_addresses_updated_at ON public.customer_addresses;
CREATE TRIGGER trg_customer_addresses_updated_at BEFORE UPDATE ON public.customer_addresses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER trg_product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS trg_vendors_updated_at ON public.vendors;
CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS trg_inventory_updated_at ON public.inventory;
CREATE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();