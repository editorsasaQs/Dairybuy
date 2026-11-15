-- Phase 4.4.5.1: owner/admin-only atomic order transition regression.
BEGIN;
SELECT extensions.plan(22);

SELECT extensions.ok(to_regprocedure('public.transition_one_time_cod_order(uuid,public.order_status_enum,text)') IS NOT NULL,
  'public fulfillment transition RPC exists');
SELECT extensions.ok(to_regprocedure('private.transition_one_time_cod_order(uuid,public.order_status_enum,text)') IS NOT NULL,
  'private fulfillment transition implementation exists');
SELECT extensions.ok((SELECT prosecdef FROM pg_proc WHERE oid='private.transition_one_time_cod_order(uuid,public.order_status_enum,text)'::regprocedure),
  'private implementation is SECURITY DEFINER');
SELECT extensions.ok((SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid='private.transition_one_time_cod_order(uuid,public.order_status_enum,text)'::regprocedure),
  'private implementation pins an empty search_path');
SELECT extensions.ok((SELECT prosecdef FROM pg_proc WHERE oid='public.transition_one_time_cod_order(uuid,public.order_status_enum,text)'::regprocedure),
  'public wrapper is SECURITY DEFINER');
SELECT extensions.ok(has_function_privilege('authenticated','public.transition_one_time_cod_order(uuid,public.order_status_enum,text)','EXECUTE'),
  'authenticated role can call the guarded wrapper');
SELECT extensions.ok(NOT has_function_privilege('anon','public.transition_one_time_cod_order(uuid,public.order_status_enum,text)','EXECUTE'),
  'anonymous role cannot call the wrapper');
SELECT extensions.ok(NOT has_function_privilege('authenticated','private.transition_one_time_cod_order(uuid,public.order_status_enum,text)','EXECUTE'),
  'authenticated role cannot call the private implementation');
SELECT extensions.ok(NOT EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND cmd='UPDATE'
), 'authenticated order updates have no direct RLS policy');

INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES
 ('a1111111-1111-4111-8111-111111111111','authenticated','authenticated','phase445-owner@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('a2222222-2222-4222-8222-222222222222','authenticated','authenticated','phase445-admin@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('a3333333-3333-4333-8333-333333333333','authenticated','authenticated','phase445-manager@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('a4444444-4444-4444-8444-444444444444','authenticated','authenticated','phase445-ops@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('a5555555-5555-4555-8555-555555555555','authenticated','authenticated','phase445-customer@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);

UPDATE public.user_roles SET role='owner' WHERE user_id='a1111111-1111-4111-8111-111111111111';
UPDATE public.user_roles SET role='admin' WHERE user_id='a2222222-2222-4222-8222-222222222222';
UPDATE public.user_roles SET role='manager' WHERE user_id='a3333333-3333-4333-8333-333333333333';
UPDATE public.user_roles SET role='operations_staff' WHERE user_id='a4444444-4444-4444-8444-444444444444';

INSERT INTO public.customer_addresses
 (id,customer_id,service_area_id,address_type,recipient_name,phone,address_line1,city,state,pincode,is_default)
VALUES
 ('a5555555-0000-4000-8000-000000000001','a5555555-5555-4555-8555-555555555555',
  '00000000-0000-0000-0000-000000000001','home','Phase 4.4.5 Test','9000000005',
  'Test address','Kolkata','West Bengal','700046',true);

INSERT INTO public.orders
 (id,customer_id,customer_address_id,service_area_id,delivery_slot_id,order_type,status,
  subtotal_paise,delivery_fee_paise,total_paise,payment_status,payment_method,delivery_date)
VALUES
 ('a5555555-0000-4000-8000-000000000002','a5555555-5555-4555-8555-555555555555',
  'a5555555-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011','one_time','pending_confirmation',
  10000,0,10000,'pending','cod',(now() AT TIME ZONE 'Asia/Kolkata')::date + 1);

UPDATE public.inventory
SET available_stock=20,reserved_stock=2,safety_stock=0
WHERE product_variant_id='milk-cow-500ml'
  AND service_area_id='00000000-0000-0000-0000-000000000001';
INSERT INTO public.inventory_movements(inventory_id,change_amount,movement_type,reference_id,notes,created_by)
SELECT id,2,'order_reservation','a5555555-0000-4000-8000-000000000002',
  'Phase 4.4.5 status transition test reservation','a5555555-5555-4555-8555-555555555555'
FROM public.inventory
WHERE product_variant_id='milk-cow-500ml'
  AND service_area_id='00000000-0000-0000-0000-000000000001';

SELECT set_config('request.jwt.claim.sub','a3333333-3333-4333-8333-333333333333',true);
SELECT set_config('request.jwt.claims','{"sub":"a3333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
 $$SELECT * FROM public.transition_one_time_cod_order('a5555555-0000-4000-8000-000000000002','confirmed',NULL)$$,
 '42501', NULL, 'manager role remains denied by the owner/admin-only boundary');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','a4444444-4444-4444-8444-444444444444',true);
SELECT set_config('request.jwt.claims','{"sub":"a4444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
 $$SELECT * FROM public.transition_one_time_cod_order('a5555555-0000-4000-8000-000000000002','confirmed',NULL)$$,
 '42501', NULL, 'operations_staff role remains denied by the owner/admin-only boundary');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','a5555555-5555-4555-8555-555555555555',true);
SELECT set_config('request.jwt.claims','{"sub":"a5555555-5555-4555-8555-555555555555","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
 $$SELECT * FROM public.transition_one_time_cod_order('a5555555-0000-4000-8000-000000000002','confirmed',NULL)$$,
 '42501', NULL, 'customer cannot transition an order');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','a2222222-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claims','{"sub":"a2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.is(
 (SELECT resulting_status::text FROM public.transition_one_time_cod_order(
  'a5555555-0000-4000-8000-000000000002','confirmed', 'Confirmed by admin')),
 'confirmed', 'admin can confirm a one-time COD order');
SELECT extensions.ok(
 (SELECT was_already_applied FROM public.transition_one_time_cod_order(
  'a5555555-0000-4000-8000-000000000002','confirmed', NULL)),
 'repeated target is an idempotent no-op');
SELECT extensions.throws_ok(
 $$SELECT * FROM public.transition_one_time_cod_order('a5555555-0000-4000-8000-000000000002','delivered',NULL)$$,
 '23514', NULL, 'skipped status transition is rejected');
SELECT extensions.is(
 (SELECT resulting_status::text FROM public.transition_one_time_cod_order(
  'a5555555-0000-4000-8000-000000000002','processing', NULL)),
 'processing', 'confirmed order can move to processing');
SELECT extensions.is(
 (SELECT resulting_status::text FROM public.transition_one_time_cod_order(
  'a5555555-0000-4000-8000-000000000002','out_for_delivery', NULL)),
 'out_for_delivery', 'processing order can move to out for delivery');
SELECT extensions.is(
 (SELECT resulting_status::text FROM public.transition_one_time_cod_order(
  'a5555555-0000-4000-8000-000000000002','delivered', NULL)),
 'delivered', 'out for delivery order can be marked delivered');
RESET ROLE;

SELECT extensions.is(
 (SELECT count(*)::integer FROM public.order_status_history
  WHERE order_id='a5555555-0000-4000-8000-000000000002'),
 4, 'exactly one history row exists for each successful transition');
SELECT extensions.is(
 (SELECT status::text FROM public.orders WHERE id='a5555555-0000-4000-8000-000000000002'),
 'delivered', 'final order state is delivered');
SELECT extensions.is(
 (SELECT payment_status::text FROM public.orders WHERE id='a5555555-0000-4000-8000-000000000002'),
 'pending', 'delivery transition does not mark COD as collected');
SELECT extensions.is(
 (SELECT total_paise FROM public.orders WHERE id='a5555555-0000-4000-8000-000000000002'),
 10000, 'delivery transition leaves the authoritative order total unchanged');

SELECT * FROM extensions.finish();
ROLLBACK;
