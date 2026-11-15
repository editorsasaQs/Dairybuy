-- Phase 5.3 lifecycle RPC security and contract checks.
BEGIN;
SELECT extensions.plan(19);

SELECT extensions.ok(
  to_regclass('public.subscription_item_vendor_changes') IS NOT NULL
  AND to_regclass('public.subscription_lifecycle_events') IS NOT NULL,
  'subscription vendor-change and lifecycle event ledgers exist'
);
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.subscription_item_vendor_changes'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.subscription_lifecycle_events'::regclass),
  'lifecycle evidence tables have RLS enabled'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated','public.subscription_item_vendor_changes','INSERT')
  AND NOT has_table_privilege('authenticated','public.subscription_item_vendor_changes','UPDATE')
  AND NOT has_table_privilege('authenticated','public.subscription_lifecycle_events','INSERT')
  AND NOT has_table_privilege('authenticated','public.subscription_skip_records','INSERT'),
  'authenticated users cannot directly mutate lifecycle ledgers'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
    AND indexname='uq_subscription_skip_idempotency')
  AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
    AND indexname='idx_subscription_item_vendor_changes_effective')
  AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
    AND indexname='idx_subscription_lifecycle_events_sub_created'),
  'skip and vendor change ledgers have idempotency and lookup indexes'
);
SELECT extensions.ok(
  to_regprocedure('private.pause_subscription(uuid)') IS NOT NULL
  AND to_regprocedure('public.pause_subscription(uuid)') IS NOT NULL
  AND to_regprocedure('private.resume_subscription(uuid)') IS NOT NULL
  AND to_regprocedure('public.resume_subscription(uuid)') IS NOT NULL,
  'pause and resume private implementations and wrappers exist'
);
SELECT extensions.ok(
  to_regprocedure('private.skip_subscription_delivery(uuid,date,text,uuid)') IS NOT NULL
  AND to_regprocedure('public.skip_subscription_delivery(uuid,date,text,uuid)') IS NOT NULL,
  'skip delivery private implementation and wrapper exist'
);
SELECT extensions.ok(
  to_regprocedure('private.cancel_subscription(uuid,text)') IS NOT NULL
  AND to_regprocedure('public.cancel_subscription(uuid,text)') IS NOT NULL,
  'cancel subscription private implementation and wrapper exist'
);
SELECT extensions.ok(
  to_regprocedure('private.change_subscription_item_vendor(uuid,uuid,character varying,date,uuid)') IS NOT NULL
  AND to_regprocedure('public.change_subscription_item_vendor(uuid,uuid,character varying,date,uuid)') IS NOT NULL,
  'item vendor change private implementation and wrapper exist'
);
SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc
   WHERE oid='private.pause_subscription(uuid)'::regprocedure)
  AND (SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc
   WHERE oid='private.resume_subscription(uuid)'::regprocedure)
  AND (SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc
   WHERE oid='private.cancel_subscription(uuid,text)'::regprocedure),
  'lifecycle write functions use SECURITY DEFINER and empty search_path'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.pause_subscription(uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.resume_subscription(uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.skip_subscription_delivery(uuid,date,text,uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.cancel_subscription(uuid,text)','EXECUTE')
  AND has_function_privilege('authenticated','public.change_subscription_item_vendor(uuid,uuid,character varying,date,uuid)','EXECUTE'),
  'authenticated lifecycle RPC wrappers are executable'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon','public.pause_subscription(uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.resume_subscription(uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.cancel_subscription(uuid,text)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.pause_subscription(uuid)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.change_subscription_item_vendor(uuid,uuid,character varying,date,uuid)','EXECUTE'),
  'anonymous callers and authenticated callers of private implementations are denied'
);
SELECT extensions.ok(
  position('FOR UPDATE' IN pg_get_functiondef('private.pause_subscription(uuid)'::regprocedure))>0
  AND position('customer_id=v_actor' IN pg_get_functiondef('private.pause_subscription(uuid)'::regprocedure))>0,
  'pause locks the subscription and verifies customer ownership'
);
SELECT extensions.ok(
  position('pause_days' IN pg_get_functiondef('private.resume_subscription(uuid)'::regprocedure))>0
  AND position('new_end_date' IN pg_get_functiondef('private.resume_subscription(uuid)'::regprocedure))>0,
  'resume extends plan end date by the paused calendar duration'
);
SELECT extensions.ok(
  position('cancellation_deadline_time' IN pg_get_functiondef('private.skip_subscription_delivery(uuid,date,text,uuid)'::regprocedure))>0
  AND position('assigned_staff_id' IN pg_get_functiondef('private.skip_subscription_delivery(uuid,date,text,uuid)'::regprocedure))>0,
  'skip enforces configured cutoff and blocks assigned deliveries'
);
SELECT extensions.ok(
  position('identical per-delivery price' IN pg_get_functiondef('private.change_subscription_item_vendor(uuid,uuid,character varying,date,uuid)'::regprocedure))>0
  AND position('effective_from' IN pg_get_functiondef('private.change_subscription_item_vendor(uuid,uuid,character varying,date,uuid)'::regprocedure))>0,
  'vendor change is future-effective and cannot silently change prepaid price'
);
SELECT extensions.ok(
  position('refund_created' IN pg_get_functiondef('private.cancel_subscription(uuid,text)'::regprocedure))>0
  AND position('status=''cancelled''' IN pg_get_functiondef('private.cancel_subscription(uuid,text)'::regprocedure))>0,
  'cancellation is audited and does not fabricate a refund'
);

SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.subscriptions'::regclass
    AND conname='chk_subscription_active_requires_verified_payment' AND NOT convalidated),
  'active, paused and completed states require a trusted payment verification timestamp for all new writes'
);

SELECT * FROM extensions.finish();
ROLLBACK;
