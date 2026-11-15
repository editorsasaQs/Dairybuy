-- Dairybuy: add indexes for the 32 foreign-key columns flagged by Supabase Advisor.
-- Each index is on the referencing-side FK column; existing indexes were checked first.
-- IF NOT EXISTS makes this safe if an equivalent index is added before this migration.
BEGIN;

CREATE INDEX IF NOT EXISTS idx_app_settings_updated_by ON public.app_settings (updated_by);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_variant_id ON public.cart_items (product_variant_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_vendor_id ON public.cart_items (vendor_id);
CREATE INDEX IF NOT EXISTS idx_cod_collections_collected_by_staff_id ON public.cod_collections (collected_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_cod_collections_order_id ON public.cod_collections (order_id);
CREATE INDEX IF NOT EXISTS idx_cod_collections_verified_by_manager_id ON public.cod_collections (verified_by_manager_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_service_area_id ON public.customer_addresses (service_area_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_delivery_slot_id ON public.delivery_assignments (delivery_slot_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_service_area_id ON public.delivery_assignments (service_area_id);
CREATE INDEX IF NOT EXISTS idx_inventory_service_area_id ON public.inventory (service_area_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_by ON public.inventory_movements (created_by);
CREATE INDEX IF NOT EXISTS idx_order_items_product_variant_id ON public.order_items (product_variant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_vendor_id ON public.order_items (vendor_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_by ON public.order_status_history (changed_by);
CREATE INDEX IF NOT EXISTS idx_orders_customer_address_id ON public.orders (customer_address_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_slot_id ON public.orders (delivery_slot_id);
CREATE INDEX IF NOT EXISTS idx_orders_service_area_id ON public.orders (service_area_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON public.refunds (payment_id);
CREATE INDEX IF NOT EXISTS idx_service_area_pincodes_service_area_id ON public.service_area_pincodes (service_area_id);
CREATE INDEX IF NOT EXISTS idx_staff_permissions_granted_by ON public.staff_permissions (granted_by);
CREATE INDEX IF NOT EXISTS idx_subscription_deliveries_assigned_staff_id ON public.subscription_deliveries (assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_subscription_deliveries_delivery_slot_id ON public.subscription_deliveries (delivery_slot_id);
CREATE INDEX IF NOT EXISTS idx_subscription_items_product_variant_id ON public.subscription_items (product_variant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_items_vendor_id ON public.subscription_items (vendor_id);
CREATE INDEX IF NOT EXISTS idx_subscription_vendor_changes_new_vendor_id ON public.subscription_vendor_changes (new_vendor_id);
CREATE INDEX IF NOT EXISTS idx_subscription_vendor_changes_old_vendor_id ON public.subscription_vendor_changes (old_vendor_id);
CREATE INDEX IF NOT EXISTS idx_subscription_vendor_changes_subscription_id ON public.subscription_vendor_changes (subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_address_id ON public.subscriptions (customer_address_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_delivery_slot_id ON public.subscriptions (delivery_slot_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_service_area_id ON public.subscriptions (service_area_id);
CREATE INDEX IF NOT EXISTS idx_vendor_prices_product_variant_id ON public.vendor_prices (product_variant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_products_product_id ON public.vendor_products (product_id);

COMMIT;