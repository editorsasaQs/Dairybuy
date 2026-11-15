-- Phase 5.1–5.6 subscription quote and per-delivery COD checkout contract.
BEGIN;
SELECT extensions.plan(16);

SELECT extensions.ok(
  (SELECT enumlabel='pending_payment' FROM pg_enum
   WHERE enumtypid='public.subscription_status_enum'::regtype AND enumlabel='pending_payment'),
  'subscription has a distinct pending-payment state'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='subscriptions' AND column_name='duration_days')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='subscriptions' AND column_name='idempotency_key')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='subscriptions' AND column_name='payment_verified_at')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='subscriptions' AND column_name='address_snapshot'),
  'subscription duration, idempotency, payment verification and address snapshots are persisted'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='subscription_items' AND column_name='product_name_snapshot')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='subscription_items' AND column_name='vendor_name_snapshot')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='subscription_items' AND column_name='line_total_paise'),
  'subscription items preserve product, vendor and full-plan price snapshots'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
    AND indexname='uq_subscriptions_customer_idempotency')
  AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
    AND indexname='uq_subscription_payment_intent'),
  'subscription checkout and payment intent are idempotent'
);
SELECT extensions.ok(
  to_regprocedure('private.build_subscription_quote(uuid,uuid,date,public.subscription_plan_enum,jsonb)') IS NOT NULL
  AND to_regprocedure('public.quote_subscription(uuid,uuid,date,public.subscription_plan_enum,jsonb)') IS NOT NULL,
  'private quote implementation and public quote wrapper exist'
);
SELECT extensions.ok(
  to_regprocedure('private.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)') IS NOT NULL
  AND to_regprocedure('public.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)') IS NOT NULL,
  'private subscription intent implementation and public wrapper exist'
);
SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc
   WHERE oid='private.build_subscription_quote(uuid,uuid,date,public.subscription_plan_enum,jsonb)'::regprocedure)
  AND (SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc
   WHERE oid='private.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)'::regprocedure),
  'private subscription functions are SECURITY DEFINER with empty search_path'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.quote_subscription(uuid,uuid,date,public.subscription_plan_enum,jsonb)','EXECUTE')
  AND NOT has_function_privilege('anon','public.quote_subscription(uuid,uuid,date,public.subscription_plan_enum,jsonb)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.build_subscription_quote(uuid,uuid,date,public.subscription_plan_enum,jsonb)','EXECUTE'),
  'quote wrapper is authenticated-only and private implementation is closed'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)','EXECUTE'),
  'checkout intent wrapper is authenticated-only and private implementation is closed'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated','public.subscriptions','INSERT')
  AND NOT has_table_privilege('authenticated','public.subscriptions','UPDATE')
  AND NOT has_table_privilege('authenticated','public.subscription_items','INSERT')
  AND NOT has_table_privilege('authenticated','public.subscription_items','UPDATE')
  AND NOT has_table_privilege('authenticated','public.payments','INSERT')
  AND NOT has_table_privilege('authenticated','public.payments','UPDATE'),
  'authenticated clients cannot directly write subscriptions, items or payments'
);
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.subscriptions'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.subscription_items'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.subscription_deliveries'::regclass),
  'subscription tables retain row-level security'
);
SELECT extensions.ok(
  position('''active'',p_start_date' IN pg_get_functiondef(
    'private.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)'::regprocedure))>0
  AND position('''cod'',''pending'',''cod''' IN pg_get_functiondef(
    'private.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)'::regprocedure))>0
  AND position('pending_online' IN pg_get_functiondef(
    'private.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)'::regprocedure))=0,
  'subscription checkout activates the COD plan agreement without online payment or client-set payment state'
);
SELECT extensions.ok(
  position('Only fixed 7-day and 30-day' IN pg_get_functiondef(
    'private.build_subscription_quote(uuid,uuid,date,public.subscription_plan_enum,jsonb)'::regprocedure))>0
  AND position('30_day' IN pg_get_functiondef(
    'private.build_subscription_quote(uuid,uuid,date,public.subscription_plan_enum,jsonb)'::regprocedure))>0,
  'quote limits plans to fixed 7/30 days and applies the basket discount policy'
);
SELECT extensions.ok(
  position('standard_milk' IN pg_get_functiondef(
    'private.build_subscription_quote(uuid,uuid,date,public.subscription_plan_enum,jsonb)'::regprocedure))>0
  AND position('canteen-milk-centre' IN pg_get_functiondef(
    'private.build_subscription_quote(uuid,uuid,date,public.subscription_plan_enum,jsonb)'::regprocedure))>0,
  'quote enforces approved standard/canteen milk vendor rules'
);
SELECT extensions.ok(
  position('p_start_date < v_local::date + 1' IN pg_get_functiondef(
    'private.build_subscription_quote(uuid,uuid,date,public.subscription_plan_enum,jsonb)'::regprocedure))>0
  AND position('service_area_pincodes' IN pg_get_functiondef(
    'private.build_subscription_quote(uuid,uuid,date,public.subscription_plan_enum,jsonb)'::regprocedure))>0,
  'quote validates next-day start and active service-area coverage'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payments'::regclass
    AND conname='chk_subscription_payment_cod_or_online'
    AND pg_get_constraintdef(oid) LIKE '%gateway%'
    AND pg_get_constraintdef(oid) LIKE '%method%'
    AND pg_get_constraintdef(oid) LIKE '%cod%'),
  'subscription payment constraint permits the COD plan agreement marker'
);

SELECT * FROM extensions.finish();
ROLLBACK;
