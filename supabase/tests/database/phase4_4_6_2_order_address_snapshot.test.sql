-- Phase 4.4.6.2: immutable order delivery-address snapshot regression.
BEGIN;
SELECT extensions.plan(20);

SELECT extensions.ok(
  to_regprocedure('private.enforce_order_delivery_address_snapshot()') IS NOT NULL,
  'private address snapshot trigger function exists'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.orders'::regclass
      AND tgname = 'orders_delivery_address_snapshot_guard'
      AND NOT tgisinternal
  ),
  'orders insert/update snapshot guard trigger exists'
);
SELECT extensions.ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'private.enforce_order_delivery_address_snapshot()'::regprocedure),
  'snapshot trigger function is SECURITY DEFINER'
);
SELECT extensions.ok(
  (SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = 'private.enforce_order_delivery_address_snapshot()'::regprocedure),
  'snapshot trigger function pins an empty search_path'
);
SELECT extensions.ok(
  position('FOR SHARE' IN pg_get_functiondef('private.enforce_order_delivery_address_snapshot()'::regprocedure)) > 0,
  'snapshot trigger takes a share lock on the customer address during order creation'
);
SELECT extensions.ok(
  (SELECT is_nullable = 'NO' FROM information_schema.columns
   WHERE table_schema='public' AND table_name='orders' AND column_name='delivery_address_snapshot'),
  'snapshot column is NOT NULL'
);
SELECT extensions.ok(
  (SELECT is_nullable = 'NO' FROM information_schema.columns
   WHERE table_schema='public' AND table_name='orders' AND column_name='delivery_address_snapshot_source'),
  'snapshot provenance column is NOT NULL'
);
SELECT extensions.ok(
  (SELECT is_nullable = 'NO' FROM information_schema.columns
   WHERE table_schema='public' AND table_name='orders' AND column_name='delivery_address_snapshot_at'),
  'snapshot timestamp column is NOT NULL'
);
SELECT extensions.ok(
  (SELECT pg_get_constraintdef(oid) LIKE '%legacy_reconstructed%'
   FROM pg_constraint
   WHERE conrelid='public.orders'::regclass
     AND conname='orders_delivery_address_snapshot_source_check'),
  'source constraint explicitly permits legacy reconstructed provenance'
);

INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES
 ('c6666666-6666-4666-8666-666666666666','authenticated','authenticated','phase4462-a@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('c7777777-7777-4777-8777-777777777777','authenticated','authenticated','phase4462-b@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);

INSERT INTO public.customer_addresses
 (id,customer_id,service_area_id,address_type,recipient_name,phone,address_line1,address_line2,landmark,city,state,pincode,is_default)
VALUES
 ('c6666666-0000-4000-8000-000000000001','c6666666-6666-4666-8666-666666666666',
  '00000000-0000-0000-0000-000000000001','home','Snapshot Customer','9000000006',
  '12 Original Road',NULL,NULL,'Kolkata','West Bengal','700046',true);

INSERT INTO public.orders
 (id,customer_id,customer_address_id,service_area_id,delivery_slot_id,subtotal_paise,total_paise)
VALUES
 ('c6666666-0000-4000-8000-000000000002','c6666666-6666-4666-8666-666666666666',
  'c6666666-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',10000,10000);

SELECT extensions.is(
  (SELECT delivery_address_snapshot FROM public.orders WHERE id='c6666666-0000-4000-8000-000000000002'),
  pg_catalog.jsonb_build_object(
    'schema_version',1,
    'recipient_name','Snapshot Customer',
    'phone','9000000006',
    'address_line1','12 Original Road',
    'address_line2',NULL,
    'landmark',NULL,
    'city','Kolkata',
    'state','West Bengal',
    'pincode','700046',
    'service_area_id','00000000-0000-0000-0000-000000000001'
  ),
  'new order captures the exact versioned address snapshot'
);
SELECT extensions.is(
  (SELECT delivery_address_snapshot_source FROM public.orders WHERE id='c6666666-0000-4000-8000-000000000002'),
  'checkout',
  'new order snapshot provenance is checkout'
);
SELECT extensions.ok(
  (SELECT delivery_address_snapshot_at IS NOT NULL FROM public.orders WHERE id='c6666666-0000-4000-8000-000000000002'),
  'new order snapshot timestamp is recorded'
);
SELECT extensions.ok(
  (SELECT delivery_address_snapshot ? 'address_line2'
      AND delivery_address_snapshot->'address_line2' = 'null'::jsonb
      AND delivery_address_snapshot ? 'landmark'
      AND delivery_address_snapshot->'landmark' = 'null'::jsonb
   FROM public.orders WHERE id='c6666666-0000-4000-8000-000000000002'),
  'optional address fields are preserved explicitly as JSON null'
);

UPDATE public.customer_addresses
SET recipient_name='Edited Customer', address_line1='99 Edited Road'
WHERE id='c6666666-0000-4000-8000-000000000001';
SELECT extensions.is(
  (SELECT delivery_address_snapshot->>'recipient_name' FROM public.orders WHERE id='c6666666-0000-4000-8000-000000000002'),
  'Snapshot Customer',
  'later address-book edits do not rewrite the order recipient snapshot'
);
SELECT extensions.is(
  (SELECT delivery_address_snapshot->>'address_line1' FROM public.orders WHERE id='c6666666-0000-4000-8000-000000000002'),
  '12 Original Road',
  'later address-book edits do not rewrite the order street snapshot'
);

SELECT extensions.throws_ok(
  $$UPDATE public.orders
    SET delivery_address_snapshot = delivery_address_snapshot || '{"recipient_name":"Tampered"}'::jsonb
    WHERE id='c6666666-0000-4000-8000-000000000002'$$,
  '42501', NULL,
  'snapshot payload cannot be changed after order creation'
);
SELECT extensions.throws_ok(
  $$UPDATE public.orders SET delivery_address_snapshot_source='legacy_reconstructed'
    WHERE id='c6666666-0000-4000-8000-000000000002'$$,
  '42501', NULL,
  'snapshot provenance cannot be rewritten after order creation'
);
SELECT extensions.throws_ok(
  $$UPDATE public.orders SET delivery_address_snapshot_at=delivery_address_snapshot_at + interval '1 second'
    WHERE id='c6666666-0000-4000-8000-000000000002'$$,
  '42501', NULL,
  'snapshot capture timestamp cannot be rewritten after order creation'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.orders
    (id,customer_id,customer_address_id,service_area_id,delivery_slot_id,subtotal_paise,total_paise)
    VALUES ('c7777777-0000-4000-8000-000000000002','c7777777-7777-4777-8777-777777777777',
      'c6666666-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000011',10000,10000)$$,
  '23514', NULL,
  'order cannot snapshot another customer address'
);
SELECT extensions.ok(
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND cmd IN ('UPDATE','ALL')),
  'customers have no direct order update policy'
);

SELECT * FROM extensions.finish();
ROLLBACK;
