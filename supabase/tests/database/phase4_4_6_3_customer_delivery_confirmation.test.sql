-- Phase 4.4.6.3: customer/admin delivery completion and inventory settlement.
BEGIN;
SELECT extensions.plan(21);

SELECT extensions.ok(
  to_regprocedure('public.transition_one_time_cod_order(uuid,public.order_status_enum,text)') IS NOT NULL,
  'shared order transition RPC exists'
);
SELECT extensions.ok(
  (SELECT prosecdef FROM pg_proc WHERE oid='private.transition_one_time_cod_order(uuid,public.order_status_enum,text)'::regprocedure),
  'private transition implementation is SECURITY DEFINER'
);
SELECT extensions.ok(
  (SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid='private.transition_one_time_cod_order(uuid,public.order_status_enum,text)'::regprocedure),
  'private transition implementation pins an empty search_path'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.transition_one_time_cod_order(uuid,public.order_status_enum,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.transition_one_time_cod_order(uuid,public.order_status_enum,text)','EXECUTE'),
  'only authenticated sessions can invoke the guarded public wrapper'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='delivery_assignments'
      AND policyname='delivery_assignments_owner_admin'
      AND cmd='ALL'
      AND qual ILIKE '%is_admin_or_owner%'
      AND with_check ILIKE '%is_admin_or_owner%'
  ),
  'legacy delivery assignment table is explicitly owner/admin-only'
);

INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES
 ('d1111111-1111-4111-8111-111111111111','authenticated','authenticated','phase4463-customer@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('d2222222-2222-4222-8222-222222222222','authenticated','authenticated','phase4463-other@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('d3333333-3333-4333-8333-333333333333','authenticated','authenticated','phase4463-manager@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('d4444444-4444-4444-8444-444444444444','authenticated','authenticated','phase4463-ops@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('d5555555-5555-4555-8555-555555555555','authenticated','authenticated','phase4463-admin@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);

UPDATE public.user_roles SET role='manager' WHERE user_id='d3333333-3333-4333-8333-333333333333';
UPDATE public.user_roles SET role='operations_staff' WHERE user_id='d4444444-4444-4444-8444-444444444444';
UPDATE public.user_roles SET role='admin' WHERE user_id='d5555555-5555-4555-8555-555555555555';

INSERT INTO public.customer_addresses
 (id,customer_id,service_area_id,address_type,recipient_name,phone,address_line1,city,state,pincode,is_default)
VALUES
 ('d1111111-0000-4000-8000-000000000001','d1111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000001','home','Delivery Test Customer','9000000011',
  '11 Test Road','Kolkata','West Bengal','700046',true),
 ('d2222222-0000-4000-8000-000000000001','d2222222-2222-4222-8222-222222222222',
  '00000000-0000-0000-0000-000000000001','home','Other Test Customer','9000000012',
  '12 Test Road','Kolkata','West Bengal','700046',true);

INSERT INTO public.orders
 (id,customer_id,customer_address_id,service_area_id,delivery_slot_id,order_type,status,
  subtotal_paise,delivery_fee_paise,total_paise,payment_status,payment_method,delivery_date)
VALUES
 ('d1111111-0000-4000-8000-000000000002','d1111111-1111-4111-8111-111111111111',
  'd1111111-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011','one_time','out_for_delivery',10000,0,10000,'pending','cod',
  (now() AT TIME ZONE 'Asia/Kolkata')::date + 1),
 ('d2222222-0000-4000-8000-000000000002','d2222222-2222-4222-8222-222222222222',
  'd2222222-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011','one_time','out_for_delivery',10000,0,10000,'pending','cod',
  (now() AT TIME ZONE 'Asia/Kolkata')::date + 1),
 ('d1111111-0000-4000-8000-000000000003','d1111111-1111-4111-8111-111111111111',
  'd1111111-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011','one_time','processing',10000,0,10000,'pending','cod',
  (now() AT TIME ZONE 'Asia/Kolkata')::date + 1),
 ('d1111111-0000-4000-8000-000000000004','d1111111-1111-4111-8111-111111111111',
  'd1111111-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011','one_time','out_for_delivery',10000,0,10000,'pending','cod',
  (now() AT TIME ZONE 'Asia/Kolkata')::date + 1);

UPDATE public.inventory
SET available_stock=20,reserved_stock=2,safety_stock=0
WHERE product_variant_id='milk-cow-500ml'
  AND service_area_id='00000000-0000-0000-0000-000000000001';
DO $inventory_fixture$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.inventory
    WHERE product_variant_id='milk-cow-500ml'
      AND service_area_id='00000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'Expected seeded milk-cow-500ml inventory row is missing';
  END IF;
END;
$inventory_fixture$;

INSERT INTO public.inventory_movements(inventory_id,change_amount,movement_type,reference_id,notes,created_by)
SELECT id,2,'order_reservation','d1111111-0000-4000-8000-000000000002',
  'Phase 4.4.6.3 test reservation','d1111111-1111-4111-8111-111111111111'
FROM public.inventory
WHERE product_variant_id='milk-cow-500ml'
  AND service_area_id='00000000-0000-0000-0000-000000000001';

SELECT set_config('request.jwt.claim.sub','d2222222-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claims','{"sub":"d2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
 $$SELECT * FROM public.transition_one_time_cod_order('d1111111-0000-4000-8000-000000000002','delivered',NULL)$$,
 '42501', NULL, 'a customer cannot confirm another customer order');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','d3333333-3333-4333-8333-333333333333',true);
SELECT set_config('request.jwt.claims','{"sub":"d3333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
 $$SELECT * FROM public.transition_one_time_cod_order('d1111111-0000-4000-8000-000000000002','delivered',NULL)$$,
 '42501', NULL, 'legacy manager cannot confirm delivery');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','d4444444-4444-4444-8444-444444444444',true);
SELECT set_config('request.jwt.claims','{"sub":"d4444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
 $$SELECT * FROM public.transition_one_time_cod_order('d1111111-0000-4000-8000-000000000002','delivered',NULL)$$,
 '42501', NULL, 'legacy operations staff cannot confirm delivery');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','d1111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claims','{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
 $delivery$SELECT * FROM public.transition_one_time_cod_order('d1111111-0000-4000-8000-000000000003','delivered',NULL)$delivery$,
 '42501', NULL, 'customer cannot confirm delivery before the order is out for delivery');
SELECT extensions.throws_ok(
 $delivery$SELECT * FROM public.transition_one_time_cod_order('d1111111-0000-4000-8000-000000000004','delivered',NULL)$delivery$,
 '23514', NULL, 'delivery fails closed when the order reservation ledger is missing');
SELECT extensions.is(
 (SELECT status::text FROM public.orders WHERE id='d1111111-0000-4000-8000-000000000004'),
 'out_for_delivery', 'failed inventory settlement leaves the order status unchanged');
SELECT extensions.is(
 (SELECT resulting_status::text FROM public.transition_one_time_cod_order(
  'd1111111-0000-4000-8000-000000000002','delivered',NULL)),
 'delivered', 'the order owner can confirm their out-for-delivery order');
SELECT extensions.ok(
 (SELECT was_already_applied FROM public.transition_one_time_cod_order(
  'd1111111-0000-4000-8000-000000000002','delivered',NULL)),
 'customer confirmation retry is idempotent');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','d5555555-5555-4555-8555-555555555555',true);
SELECT set_config('request.jwt.claims','{"sub":"d5555555-5555-4555-8555-555555555555","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(
 (SELECT was_already_applied FROM public.transition_one_time_cod_order(
  'd1111111-0000-4000-8000-000000000002','delivered',NULL)),
 'admin can safely retry an already customer-confirmed delivery');
RESET ROLE;

SELECT extensions.is(
 (SELECT status::text FROM public.orders WHERE id='d1111111-0000-4000-8000-000000000002'),
 'delivered', 'customer completion persists delivered order status');
SELECT extensions.is(
 (SELECT reserved_stock FROM public.inventory
  WHERE product_variant_id='milk-cow-500ml' AND service_area_id='00000000-0000-0000-0000-000000000001'),
 0, 'delivery settlement releases the two reserved packs');
SELECT extensions.is(
 (SELECT available_stock FROM public.inventory
  WHERE product_variant_id='milk-cow-500ml' AND service_area_id='00000000-0000-0000-0000-000000000001'),
 18, 'delivery settlement consumes the two physical packs');
SELECT extensions.is(
 (SELECT count(*)::integer FROM public.inventory_movements
  WHERE reference_id='d1111111-0000-4000-8000-000000000002' AND movement_type='order_fulfilled' AND change_amount=-2),
 1, 'one canonical fulfillment movement is written exactly once');
SELECT extensions.is(
 (SELECT count(*)::integer FROM public.order_status_history
  WHERE order_id='d1111111-0000-4000-8000-000000000002' AND to_status='delivered'),
 1, 'one delivered history event is recorded');
SELECT extensions.is(
 (SELECT payment_status::text FROM public.orders WHERE id='d1111111-0000-4000-8000-000000000002'),
 'pending', 'delivery completion does not mark COD cash collected');
SELECT extensions.is(
 (SELECT status::text FROM public.orders WHERE id='d2222222-0000-4000-8000-000000000002'),
 'out_for_delivery', 'another customer order remains unchanged');

SELECT * FROM extensions.finish();
ROLLBACK;
