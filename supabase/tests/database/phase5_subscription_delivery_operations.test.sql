-- Phase 5.4–5.6 subscription delivery generation, reservation and COD fulfilment security contract.
BEGIN;
SELECT extensions.plan(23);

SELECT extensions.ok(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders'
    AND column_name='subscription_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders'
    AND column_name='subscription_delivery_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders'
    AND column_name='subscription_discount_paise')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders'
    AND column_name='delivery_date'),
  'orders link one subscription delivery and preserve delivery date and discount allocation'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='subscription_deliveries' AND column_name='order_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='subscription_deliveries' AND column_name='subtotal_paise')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='subscription_deliveries' AND column_name='discount_paise')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='subscription_deliveries' AND column_name='total_paise'),
  'delivery ledger stores its unique order link and per-day prepaid value'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass
    AND conname='chk_order_subscription_link')
  AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass
    AND conname='chk_order_total_match')
  AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass
    AND conname='fk_orders_subscription_delivery')
  AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.subscription_deliveries'::regclass
    AND conname='fk_subscription_deliveries_order'),
  'subscription orders and delivery rows have financial and referential integrity constraints'
);
SELECT extensions.ok(
  to_regprocedure('private.generate_subscription_deliveries(date)') IS NOT NULL
  AND to_regprocedure('public.generate_subscription_deliveries(date)') IS NOT NULL,
  'private generator and service-role wrapper exist'
);
SELECT extensions.ok(
  to_regprocedure('private.assign_subscription_delivery(uuid,uuid)') IS NOT NULL
  AND to_regprocedure('public.assign_subscription_delivery(uuid,uuid)') IS NOT NULL
  AND to_regprocedure('private.start_subscription_delivery(uuid)') IS NOT NULL
  AND to_regprocedure('public.start_subscription_delivery(uuid)') IS NOT NULL,
  'delivery assignment and dispatch RPCs exist'
);
SELECT extensions.ok(
  to_regprocedure('private.complete_subscription_delivery(uuid)') IS NOT NULL
  AND to_regprocedure('public.complete_subscription_delivery(uuid)') IS NOT NULL
  AND to_regprocedure('private.fail_subscription_delivery(uuid,text)') IS NOT NULL
  AND to_regprocedure('public.fail_subscription_delivery(uuid,text)') IS NOT NULL,
  'delivery completion and failed-delivery RPCs exist'
);
SELECT extensions.ok(
  to_regprocedure('private.release_subscription_order_reservation(uuid,uuid,text)') IS NOT NULL,
  'private reservation release helper exists for skip and cancellation'
);
SELECT extensions.ok(
  has_function_privilege('service_role','public.generate_subscription_deliveries(date)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.generate_subscription_deliveries(date)','EXECUTE')
  AND NOT has_function_privilege('anon','public.generate_subscription_deliveries(date)','EXECUTE'),
  'only service role can invoke scheduled delivery generation'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.assign_subscription_delivery(uuid,uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.start_subscription_delivery(uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.complete_subscription_delivery(uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.fail_subscription_delivery(uuid,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.assign_subscription_delivery(uuid,uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.complete_subscription_delivery(uuid)','EXECUTE'),
  'delivery operations are authenticated-only RPCs'
);
SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc
   WHERE oid='private.generate_subscription_deliveries(date)'::regprocedure)
  AND (SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc
   WHERE oid='private.complete_subscription_delivery(uuid)'::regprocedure)
  AND (SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc
   WHERE oid='private.release_subscription_order_reservation(uuid,uuid,text)'::regprocedure),
  'privileged generator and stock settlement functions use SECURITY DEFINER and empty search_path'
);
SELECT extensions.ok(
  NOT has_function_privilege('authenticated','private.generate_subscription_deliveries(date)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.complete_subscription_delivery(uuid)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.release_subscription_order_reservation(uuid,uuid,text)','EXECUTE'),
  'authenticated clients cannot invoke private generation or stock helpers'
);
SELECT extensions.ok(
  position('auth.role()' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0
  AND position('service_role' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0
  AND position('payment_verified_at IS NOT NULL' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))=0
  AND position('gateway_payment_id IS NOT NULL' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))=0
  AND position('INSERT INTO public.payments(order_id,amount_paise,currency,gateway,status,method)' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0,
  'generator is service-role-only and creates a separate pending COD payment per delivery without online verification'
);
SELECT extensions.ok(
  position('FOR UPDATE OF s SKIP LOCKED' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0
  AND position('ON CONFLICT (subscription_id,delivery_date,delivery_slot_id) DO NOTHING' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0,
  'daily generation locks subscriptions and is idempotent under retries/concurrency'
);
SELECT extensions.ok(
  position('order_reservation' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0
  AND position('FOR UPDATE' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0
  AND position('safety_stock' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0,
  'generator reserves SKU pack inventory under row locks and preserves safety stock'
);
SELECT extensions.ok(
  position('floor(si.quantity_litres)' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0
  AND position('unit_quantity=0.5' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0
  AND position('unit_quantity=1' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0,
  'generator reserves exact 1 L and 500 ml pack counts for fractional milk volumes'
);
SELECT extensions.ok(
  position('THEN 200 ELSE 0' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0
  AND position('subtotal_paise,discount_paise,total_paise' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0,
  '30-day ₹60 basket discount is allocated as ₹2 per scheduled delivery day including skips'
);
SELECT extensions.ok(
  position('subscription_item_vendor_changes' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0
  AND position('vendor_name_snapshot' IN pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure))>0,
  'future-effective vendor changes and immutable vendor snapshots are applied per delivery date'
);
SELECT extensions.ok(
  position('address_snapshot' IN pg_get_functiondef('private.enforce_order_delivery_address_snapshot()'::regprocedure))>0
  AND position('order_type=''subscription''' IN pg_get_functiondef('private.enforce_order_delivery_address_snapshot()'::regprocedure))>0,
  'generated orders use the subscription checkout-time address snapshot'
);
SELECT extensions.ok(
  position('release_subscription_order_reservation' IN pg_get_functiondef('private.skip_subscription_delivery(uuid,date,text,uuid)'::regprocedure))>0
  AND position('release_subscription_order_reservation' IN pg_get_functiondef('private.cancel_subscription(uuid,text)'::regprocedure))>0,
  'customer skip and cancellation release any generated but undispatched inventory reservation'
);
SELECT extensions.ok(
  position('order_fulfilled' IN pg_get_functiondef('private.complete_subscription_delivery(uuid)'::regprocedure))>0
  AND position('reserved_stock=reserved_stock-v_reserved' IN pg_get_functiondef('private.complete_subscription_delivery(uuid)'::regprocedure))>0
  AND position('available_stock=available_stock-v_reserved' IN pg_get_functiondef('private.complete_subscription_delivery(uuid)'::regprocedure))>0,
  'delivery completion consumes reserved stock exactly once'
);
SELECT extensions.ok(
  position('order_reservation_release' IN pg_get_functiondef('private.fail_subscription_delivery(uuid,text)'::regprocedure))>0
  AND position('available_stock' IN pg_get_functiondef('private.fail_subscription_delivery(uuid,text)'::regprocedure))=0,
  'failed delivery releases reserved stock without consuming on-hand stock'
);
SELECT extensions.ok(
  position('o.order_type=''subscription''' IN pg_get_functiondef('public.audit_inventory_reservations()'::regprocedure))>0
  AND position('order_reservation_release' IN pg_get_functiondef('public.audit_inventory_reservations()'::regprocedure))>0,
  'owner/admin inventory reconciliation includes prepaid subscription reservation ledgers'
);
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.subscription_deliveries'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.orders'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.inventory'::regclass),
  'delivery, order and inventory tables retain RLS'
);

SELECT * FROM extensions.finish();
ROLLBACK;
