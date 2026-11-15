-- Phase 4.6.1 physical stock receiving, adjustments and immutable ledger.
BEGIN;
SELECT extensions.plan(26);

SELECT extensions.ok(
  to_regclass('public.inventory_receipts') IS NOT NULL
  AND to_regclass('public.inventory_receipt_items') IS NOT NULL
  AND to_regclass('public.inventory_stock_adjustments') IS NOT NULL,
  'vendor receipts, receipt items and stock adjustment audit tables exist'
);
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.inventory_receipts'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.inventory_receipt_items'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.inventory_stock_adjustments'::regclass),
  'all stock audit tables have RLS enabled'
);
SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='private.receive_inventory_stock(varchar,uuid,text,text,jsonb,uuid)'::regprocedure),
  'vendor receiving RPC is SECURITY DEFINER with empty search_path'
);
SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='private.adjust_inventory_stock(uuid,text,integer,text,text,uuid)'::regprocedure),
  'stock adjustment RPC is SECURITY DEFINER with empty search_path'
);
SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='private.audit_inventory_stock()'::regprocedure),
  'physical stock audit RPC is SECURITY DEFINER with empty search_path'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.receive_inventory_stock(varchar,uuid,text,text,jsonb,uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.adjust_inventory_stock(uuid,text,integer,text,text,uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.audit_inventory_stock()','EXECUTE')
  AND NOT has_function_privilege('anon','public.receive_inventory_stock(varchar,uuid,text,text,jsonb,uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.adjust_inventory_stock(uuid,text,integer,text,text,uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.audit_inventory_stock()','EXECUTE'),
  'stock RPC wrappers are authenticated-only'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated','public.inventory','INSERT')
  AND NOT has_table_privilege('authenticated','public.inventory','UPDATE')
  AND NOT has_table_privilege('authenticated','public.inventory','DELETE')
  AND NOT has_table_privilege('authenticated','public.inventory_movements','INSERT')
  AND NOT has_table_privilege('authenticated','public.inventory_movements','UPDATE')
  AND NOT has_table_privilege('authenticated','public.inventory_movements','DELETE')
  AND NOT has_table_privilege('authenticated','public.inventory_receipts','INSERT')
  AND NOT has_table_privilege('authenticated','public.inventory_stock_adjustments','INSERT')
  AND NOT has_table_privilege('anon','public.inventory','INSERT')
  AND NOT has_table_privilege('anon','public.inventory_movements','INSERT'),
  'anonymous and authenticated users cannot mutate stock counters, movements or receipt audit tables directly'
);

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES
 ('d4610000-1111-4111-8111-111111111111','authenticated','authenticated',
  'phase461-admin@test.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('d4610000-2222-4222-8222-222222222222','authenticated','authenticated',
  'phase461-customer@test.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);
UPDATE public.user_roles SET role='admin' WHERE user_id='d4610000-1111-4111-8111-111111111111';

INSERT INTO public.vendors(id,name,code,vendor_type,is_approved,ordering_enabled)
VALUES('phase461-test-vendor','Phase 4.6 Test Vendor','P46TEST','milk_vendor',true,false)
ON CONFLICT (id) DO UPDATE SET is_approved=true,ordering_enabled=false;

INSERT INTO public.inventory(product_variant_id,service_area_id,available_stock,reserved_stock,safety_stock)
VALUES('ghee-red-cow-200ml','00000000-0000-0000-0000-000000000001',0,0,0)
ON CONFLICT (product_variant_id,service_area_id)
DO UPDATE SET available_stock=0,reserved_stock=0,safety_stock=0,updated_at=pg_catalog.now();

SELECT set_config('request.jwt.claim.sub','d4610000-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claims','{"sub":"d4610000-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;

SELECT extensions.is(
  (SELECT total_units FROM public.receive_inventory_stock(
    'phase461-test-vendor','00000000-0000-0000-0000-000000000001',
    'P46-INV-001','Morning vendor collection',
    '[{"product_variant_id":"ghee-red-cow-200ml","quantity":5,"unit_cost_paise":2500}]'::jsonb,
    'd4610000-0000-4000-8000-000000000001'
  )),5,'vendor receipt atomically adds the received SKU quantity'
);
SELECT extensions.is(
  (SELECT total_cost_paise FROM public.receive_inventory_stock(
    'phase461-test-vendor','00000000-0000-0000-0000-000000000001',
    'P46-INV-001','Morning vendor collection',
    '[{"product_variant_id":"ghee-red-cow-200ml","quantity":5,"unit_cost_paise":2500}]'::jsonb,
    'd4610000-0000-4000-8000-000000000001'
  )),12500::bigint,'receipt stores authoritative unit purchase cost and total cost in paise'
);
SELECT extensions.ok(
  (SELECT was_replayed FROM public.receive_inventory_stock(
    'phase461-test-vendor','00000000-0000-0000-0000-000000000001',
    'P46-INV-001','Morning vendor collection',
    '[{"product_variant_id":"ghee-red-cow-200ml","quantity":5,"unit_cost_paise":2500}]'::jsonb,
    'd4610000-0000-4000-8000-000000000001'
  )), 'same receipt idempotency key returns a replay'
);
SELECT extensions.is(
  (SELECT available_stock FROM public.inventory
   WHERE product_variant_id='ghee-red-cow-200ml' AND service_area_id='00000000-0000-0000-0000-000000000001'),
  5,'receipt retry does not add the same physical stock twice'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.inventory_movements
   WHERE movement_type='stock_receipt' AND change_amount=5),
  1,'one immutable stock receipt movement is recorded for the receipt line'
);
SELECT extensions.is(
  (SELECT line_total_paise FROM public.inventory_receipt_items ri
   JOIN public.inventory_receipts r ON r.id=ri.receipt_id
   WHERE r.vendor_reference='P46-INV-001' AND ri.product_variant_id='ghee-red-cow-200ml'),
  12500::bigint,'receipt item preserves per-SKU purchase cost'
);

SELECT extensions.is(
  (SELECT quantity_delta FROM public.adjust_inventory_stock(
    (SELECT id FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml'
      AND service_area_id='00000000-0000-0000-0000-000000000001'),
    'spoilage',2,'Expired stock removed','P46-SPOIL-001',
    'd4610000-0000-4000-8000-000000000002'
  )),-2,'spoilage records a negative on-hand movement'
);
SELECT extensions.ok(
  (SELECT was_replayed FROM public.adjust_inventory_stock(
    (SELECT id FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml'
      AND service_area_id='00000000-0000-0000-0000-000000000001'),
    'spoilage',2,'Expired stock removed','P46-SPOIL-001',
    'd4610000-0000-4000-8000-000000000002'
  )), 'same adjustment idempotency key returns a replay'
);
SELECT extensions.is(
  (SELECT available_stock FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml'
    AND service_area_id='00000000-0000-0000-0000-000000000001'),
  3,'spoilage retry does not decrement on-hand stock twice'
);
SELECT extensions.is(
  (SELECT quantity_delta FROM public.adjust_inventory_stock(
    (SELECT id FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml'
      AND service_area_id='00000000-0000-0000-0000-000000000001'),
    'stocktake_adjustment',3,'Physical count found three extra units','P46-COUNT-001',
    'd4610000-0000-4000-8000-000000000003'
  )),3,'positive stocktake adjustment increases physical on-hand stock'
);
SELECT extensions.is(
  (SELECT quantity_delta FROM public.adjust_inventory_stock(
    (SELECT id FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml'
      AND service_area_id='00000000-0000-0000-0000-000000000001'),
    'damage',1,'One damaged unit removed','P46-DAMAGE-001',
    'd4610000-0000-4000-8000-000000000004'
  )),-1,'damage adjustment decreases physical on-hand stock'
);

RESET ROLE;
UPDATE public.inventory SET reserved_stock=4
WHERE product_variant_id='ghee-red-cow-200ml' AND service_area_id='00000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claim.sub','d4610000-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claims','{"sub":"d4610000-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
 $$SELECT * FROM public.adjust_inventory_stock(
   (SELECT id FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml'
     AND service_area_id='00000000-0000-0000-0000-000000000001'),
   'spoilage',2,'Attempted reserved stock removal',NULL,
   'd4610000-0000-4000-8000-000000000005'
 )$$,
 '23514',NULL,'negative adjustment cannot consume units already reserved for customer orders'
);
RESET ROLE;
UPDATE public.inventory SET reserved_stock=0
WHERE product_variant_id='ghee-red-cow-200ml' AND service_area_id='00000000-0000-0000-0000-000000000001';

SET LOCAL ROLE authenticated;
SELECT extensions.is(
 (SELECT count(*)::integer FROM public.audit_inventory_stock()
  WHERE inventory_id=(SELECT id FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml'
    AND service_area_id='00000000-0000-0000-0000-000000000001')),
 0,'physical and reservation movement ledgers reconcile after receipt and adjustments'
);
RESET ROLE;
SELECT extensions.throws_ok(
 $UPDATE public.inventory_movements SET notes='tampered' WHERE movement_type='stock_receipt'$,
 '55000',NULL,'inventory movement rows cannot be edited after creation'
);

SELECT set_config('request.jwt.claim.sub','d4610000-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claims','{"sub":"d4610000-2222-4222-8222-222222222222","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
 $$SELECT * FROM public.receive_inventory_stock(
   'phase461-test-vendor','00000000-0000-0000-0000-000000000001',NULL,NULL,
   '[{"product_variant_id":"ghee-red-cow-200ml","quantity":1,"unit_cost_paise":2500}]'::jsonb,
   'd4610000-0000-4000-8000-000000000006'
 )$$,
 '42501',NULL,'customer cannot receive or alter physical stock'
);
SELECT extensions.throws_ok(
 $$SELECT * FROM public.adjust_inventory_stock(
   (SELECT id FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml'
     AND service_area_id='00000000-0000-0000-0000-000000000001'),
   'damage',1,'Customer stock adjustment attempt',NULL,
   'd4610000-0000-4000-8000-000000000007'
 )$$,
 '42501',NULL,'customer cannot adjust physical stock'
);
SELECT extensions.throws_ok(
 $$SELECT * FROM public.audit_inventory_stock()$$,
 '42501',NULL,'customer cannot inspect owner/admin stock audit'
);
RESET ROLE;

UPDATE public.inventory SET available_stock=6
WHERE product_variant_id='ghee-red-cow-200ml' AND service_area_id='00000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claim.sub','d4610000-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claims','{"sub":"d4610000-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.is(
 (SELECT count(*)::integer FROM public.audit_inventory_stock()
  WHERE audit_type='on_hand_balance' AND inventory_id=(SELECT id FROM public.inventory
    WHERE product_variant_id='ghee-red-cow-200ml' AND service_area_id='00000000-0000-0000-0000-000000000001')),
 1,'read-only stock audit detects physical on-hand counter drift'
);
SELECT extensions.is(
 (SELECT available_stock FROM public.inventory WHERE product_variant_id='ghee-red-cow-200ml'
  AND service_area_id='00000000-0000-0000-0000-000000000001'),
 6,'stock audit reports drift without automatically repairing inventory'
);

SELECT * FROM extensions.finish();
ROLLBACK;
