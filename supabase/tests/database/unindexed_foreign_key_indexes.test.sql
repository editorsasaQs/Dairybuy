-- Verify every Advisor-flagged FK column has a valid, ready, non-partial btree index.
BEGIN;
SELECT extensions.plan(32);
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='updated_by'
  WHERE ns.nspname='public' AND tbl.relname='app_settings'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND i.indkey[0] = a.attnum
), 'app_settings.updated_by indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='product_variant_id'
  WHERE ns.nspname='public' AND tbl.relname='cart_items'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'cart_items.product_variant_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='vendor_id'
  WHERE ns.nspname='public' AND tbl.relname='cart_items'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'cart_items.vendor_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='collected_by_staff_id'
  WHERE ns.nspname='public' AND tbl.relname='cod_collections'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'cod_collections.collected_by_staff_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='order_id'
  WHERE ns.nspname='public' AND tbl.relname='cod_collections'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'cod_collections.order_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='verified_by_manager_id'
  WHERE ns.nspname='public' AND tbl.relname='cod_collections'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'cod_collections.verified_by_manager_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='service_area_id'
  WHERE ns.nspname='public' AND tbl.relname='customer_addresses'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'customer_addresses.service_area_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='delivery_slot_id'
  WHERE ns.nspname='public' AND tbl.relname='delivery_assignments'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'delivery_assignments.delivery_slot_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='service_area_id'
  WHERE ns.nspname='public' AND tbl.relname='delivery_assignments'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'delivery_assignments.service_area_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='service_area_id'
  WHERE ns.nspname='public' AND tbl.relname='inventory'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'inventory.service_area_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='created_by'
  WHERE ns.nspname='public' AND tbl.relname='inventory_movements'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'inventory_movements.created_by indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='product_variant_id'
  WHERE ns.nspname='public' AND tbl.relname='order_items'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'order_items.product_variant_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='vendor_id'
  WHERE ns.nspname='public' AND tbl.relname='order_items'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'order_items.vendor_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='changed_by'
  WHERE ns.nspname='public' AND tbl.relname='order_status_history'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'order_status_history.changed_by indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='customer_address_id'
  WHERE ns.nspname='public' AND tbl.relname='orders'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'orders.customer_address_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='delivery_slot_id'
  WHERE ns.nspname='public' AND tbl.relname='orders'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'orders.delivery_slot_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='service_area_id'
  WHERE ns.nspname='public' AND tbl.relname='orders'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'orders.service_area_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='payment_id'
  WHERE ns.nspname='public' AND tbl.relname='refunds'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'refunds.payment_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='service_area_id'
  WHERE ns.nspname='public' AND tbl.relname='service_area_pincodes'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'service_area_pincodes.service_area_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='granted_by'
  WHERE ns.nspname='public' AND tbl.relname='staff_permissions'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'staff_permissions.granted_by indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='assigned_staff_id'
  WHERE ns.nspname='public' AND tbl.relname='subscription_deliveries'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'subscription_deliveries.assigned_staff_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='delivery_slot_id'
  WHERE ns.nspname='public' AND tbl.relname='subscription_deliveries'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'subscription_deliveries.delivery_slot_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='product_variant_id'
  WHERE ns.nspname='public' AND tbl.relname='subscription_items'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'subscription_items.product_variant_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='vendor_id'
  WHERE ns.nspname='public' AND tbl.relname='subscription_items'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'subscription_items.vendor_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='new_vendor_id'
  WHERE ns.nspname='public' AND tbl.relname='subscription_vendor_changes'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'subscription_vendor_changes.new_vendor_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='old_vendor_id'
  WHERE ns.nspname='public' AND tbl.relname='subscription_vendor_changes'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'subscription_vendor_changes.old_vendor_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='subscription_id'
  WHERE ns.nspname='public' AND tbl.relname='subscription_vendor_changes'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'subscription_vendor_changes.subscription_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='customer_address_id'
  WHERE ns.nspname='public' AND tbl.relname='subscriptions'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'subscriptions.customer_address_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='delivery_slot_id'
  WHERE ns.nspname='public' AND tbl.relname='subscriptions'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'subscriptions.delivery_slot_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='service_area_id'
  WHERE ns.nspname='public' AND tbl.relname='subscriptions'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'subscriptions.service_area_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='product_variant_id'
  WHERE ns.nspname='public' AND tbl.relname='vendor_prices'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'vendor_prices.product_variant_id indexed');
SELECT extensions.ok(EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid=i.indrelid
  JOIN pg_namespace ns ON ns.oid=tbl.relnamespace
  JOIN pg_attribute a ON a.attrelid=tbl.oid AND a.attname='product_id'
  WHERE ns.nspname='public' AND tbl.relname='vendor_products'
    AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts >= 1
    AND (i.indkey::smallint[])[0] = a.attnum
), 'vendor_products.product_id indexed');
SELECT * FROM extensions.finish();
ROLLBACK;