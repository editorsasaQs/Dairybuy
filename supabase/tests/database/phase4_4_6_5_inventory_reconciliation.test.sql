-- Phase 4.4.6.5 Stage C: reservation ledger reconciliation audit.
BEGIN;
SELECT extensions.plan(13);

SELECT extensions.ok(to_regprocedure('public.audit_inventory_reservations()') IS NOT NULL,
  'read-only inventory reservation audit RPC exists');
SELECT extensions.ok((SELECT prosecdef FROM pg_proc WHERE oid='public.audit_inventory_reservations()'::regprocedure),
  'audit RPC is SECURITY DEFINER');
SELECT extensions.ok((SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid='public.audit_inventory_reservations()'::regprocedure),
  'audit RPC pins an empty search_path');
SELECT extensions.ok(has_function_privilege('authenticated','public.audit_inventory_reservations()','EXECUTE'),
  'authenticated role can call guarded audit RPC');
SELECT extensions.ok(NOT has_function_privilege('anon','public.audit_inventory_reservations()','EXECUTE'),
  'anonymous role cannot call audit RPC');

INSERT INTO auth.users
 (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES
 ('c1111111-1111-4111-8111-111111111111','authenticated','authenticated','phase4465-audit-admin@test.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('c2222222-2222-4222-8222-222222222222','authenticated','authenticated','phase4465-audit-customer@test.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);
UPDATE public.user_roles SET role='admin' WHERE user_id='c1111111-1111-4111-8111-111111111111';

INSERT INTO public.customer_addresses
 (id,customer_id,service_area_id,address_type,recipient_name,phone,address_line1,city,state,pincode,is_default)
VALUES
 ('c2222222-0000-4000-8000-000000000001','c2222222-2222-4222-8222-222222222222',
  '00000000-0000-0000-0000-000000000001','home','Audit Customer','9000000555',
  '55 Audit Road','Kolkata','West Bengal','700046',true);

INSERT INTO public.orders
 (id,customer_id,customer_address_id,service_area_id,delivery_slot_id,order_type,status,
  subtotal_paise,delivery_fee_paise,total_paise,payment_status,payment_method,delivery_date)
VALUES
 ('c2222222-0000-4000-8000-000000000010','c2222222-2222-4222-8222-222222222222',
  'c2222222-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011','one_time','processing',17900,0,17900,'pending','cod',
  (now() AT TIME ZONE 'Asia/Kolkata')::date + 1),
 ('c2222222-0000-4000-8000-000000000011','c2222222-2222-4222-8222-222222222222',
  'c2222222-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011','one_time','delivered',17900,0,17900,'pending','cod',
  (now() AT TIME ZONE 'Asia/Kolkata')::date + 1),
 ('c2222222-0000-4000-8000-000000000012','c2222222-2222-4222-8222-222222222222',
  'c2222222-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011','one_time','cancelled',17900,0,17900,'pending','cod',
  (now() AT TIME ZONE 'Asia/Kolkata')::date + 1);

UPDATE public.inventory
SET available_stock=20,reserved_stock=2,safety_stock=0
WHERE product_variant_id='ghee-red-cow-200ml'
  AND service_area_id='00000000-0000-0000-0000-000000000001';

INSERT INTO public.inventory_movements(inventory_id,change_amount,movement_type,reference_id,notes,created_by)
SELECT id,2,'order_reservation','c2222222-0000-4000-8000-000000000010','Audit active order reservation','c2222222-2222-4222-8222-222222222222'::uuid
FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml' AND service_area_id='00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT id,1,'order_reservation','c2222222-0000-4000-8000-000000000011','Audit delivered order reservation','c2222222-2222-4222-8222-222222222222'::uuid
FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml' AND service_area_id='00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT id,-1,'order_fulfilled','c2222222-0000-4000-8000-000000000011','Audit delivered order fulfillment','c2222222-2222-4222-8222-222222222222'::uuid
FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml' AND service_area_id='00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT id,1,'order_reservation','c2222222-0000-4000-8000-000000000012','Audit cancelled order reservation','c2222222-2222-4222-8222-222222222222'::uuid
FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml' AND service_area_id='00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT id,-1,'order_reservation_release','c2222222-0000-4000-8000-000000000012','Audit cancelled order release','c2222222-2222-4222-8222-222222222222'::uuid
FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml' AND service_area_id='00000000-0000-0000-0000-000000000001';

SELECT set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claims','{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.is((SELECT count(*)::integer FROM public.audit_inventory_reservations()),0,
  'consistent active, delivered and cancelled order ledgers produce no audit findings');

RESET ROLE;
UPDATE public.inventory SET reserved_stock=3
WHERE product_variant_id='ghee-red-cow-200ml' AND service_area_id='00000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT extensions.is((SELECT count(*)::integer FROM public.audit_inventory_reservations() WHERE audit_type='inventory_balance'),1,
  'audit detects inventory reserved counter drift against the movement ledger');
SELECT extensions.is((SELECT max(recorded_reserved_stock) FROM public.audit_inventory_reservations() WHERE audit_type='inventory_balance'),3,
  'inventory finding reports the recorded reserved counter');
RESET ROLE;

UPDATE public.inventory SET reserved_stock=2
WHERE product_variant_id='ghee-red-cow-200ml' AND service_area_id='00000000-0000-0000-0000-000000000001';
INSERT INTO public.inventory_movements(inventory_id,change_amount,movement_type,reference_id,notes,created_by)
SELECT id,-1,'order_fulfilled','c2222222-0000-4000-8000-000000000011','Deliberate duplicate settlement fixture','c2222222-2222-4222-8222-222222222222'::uuid
FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml' AND service_area_id='00000000-0000-0000-0000-000000000001';

SET LOCAL ROLE authenticated;
SELECT extensions.is((SELECT count(*)::integer FROM public.audit_inventory_reservations()
  WHERE audit_type='order_ledger' AND order_id='c2222222-0000-4000-8000-000000000011'),1,
  'audit identifies a delivered order with a duplicate fulfillment movement');
SELECT extensions.is((SELECT min(ledger_reserved_stock) FROM public.audit_inventory_reservations()
  WHERE audit_type='order_ledger' AND order_id='c2222222-0000-4000-8000-000000000011'),-1,
  'order finding reports negative reservation ledger balance');
SELECT extensions.is((SELECT count(*)::integer FROM public.audit_inventory_reservations()
  WHERE audit_type='inventory_balance'),1,
  'global inventory drift is also reported after duplicate settlement');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','c2222222-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claims','{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok($$SELECT * FROM public.audit_inventory_reservations()$$,
 '42501',NULL,'customer cannot run the owner/admin inventory audit');
RESET ROLE;

SELECT extensions.is((SELECT reserved_stock FROM public.inventory
 WHERE product_variant_id='ghee-red-cow-200ml' AND service_area_id='00000000-0000-0000-0000-000000000001'),
 2,'audit is read-only and never repairs or mutates inventory counters');

SELECT * FROM extensions.finish();
ROLLBACK;
