-- Phase 4.5.1 COD cash recording: structural security and invariant checks.
BEGIN;
SELECT extensions.plan(16);

SELECT extensions.ok(
  to_regclass('public.delivery_assignment_orders') IS NOT NULL,
  'normalized delivery assignment to order mapping exists'
);
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.delivery_assignment_orders'::regclass),
  'assignment-order mapping has RLS enabled'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated','public.delivery_assignment_orders','SELECT')
  AND NOT has_table_privilege('authenticated','public.delivery_assignment_orders','INSERT')
  AND NOT has_table_privilege('authenticated','public.cod_collections','SELECT')
  AND NOT has_table_privilege('authenticated','public.cod_collections','INSERT'),
  'API users cannot bypass collection and assignment RPCs with direct table access'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
    AND indexname='uq_cod_collections_one_record_per_order'),
  'at most one cash collection record is stored per COD order'
);
SELECT extensions.ok(
  to_regprocedure('private.assign_cod_order_to_delivery(uuid,uuid)') IS NOT NULL
  AND to_regprocedure('public.assign_cod_order_to_delivery(uuid,uuid)') IS NOT NULL,
  'owner/admin assignment RPC and public wrapper exist'
);
SELECT extensions.ok(
  to_regprocedure('private.record_cod_cash_collection(uuid,integer,text,text)') IS NOT NULL
  AND to_regprocedure('public.record_cod_cash_collection(uuid,integer,text,text)') IS NOT NULL,
  'cash collection RPC and public wrapper exist'
);
SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='private.assign_cod_order_to_delivery(uuid,uuid)'::regprocedure),
  'private assignment RPC is SECURITY DEFINER with empty search_path'
);
SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure),
  'private collection RPC is SECURITY DEFINER with empty search_path'
);
SELECT extensions.ok(
  NOT has_function_privilege('authenticated','public.assign_cod_order_to_delivery(uuid,uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.assign_cod_order_to_delivery(uuid,uuid)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.assign_cod_order_to_delivery(uuid,uuid)','EXECUTE'),
  'delivery assignment RPC is not exposed in the no-agent launch boundary'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.record_cod_cash_collection(uuid,integer,text,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.record_cod_cash_collection(uuid,integer,text,text)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.record_cod_cash_collection(uuid,integer,text,text)','EXECUTE'),
  'only authenticated users can invoke the collection wrapper'
);
SELECT extensions.ok(
  position('private.is_admin_or_owner()' IN pg_get_functiondef(
    'private.assign_cod_order_to_delivery(uuid,uuid)'::regprocedure
  ))>0,
  'only owner/admin can assign an order to a delivery assignment'
);
SELECT extensions.ok(
  position('da.staff_id=v_actor' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure
  ))=0
  AND position('IF v_actor IS NULL OR NOT private.is_admin_or_owner()' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure
  ))>0,
  'cash collection is restricted to authenticated owner/admin and excludes delivery staff'
);
SELECT extensions.ok(
  position('v_order.status<>' || chr(39) || 'delivered' || chr(39) IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure
  ))>0,
  'cash can be recorded only after delivery is confirmed'
);
SELECT extensions.ok(
  position('v_status:=CASE' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure
  ))>0
  AND position('ELSE ' || chr(39) || 'disputed' || chr(39) IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure
  ))>0,
  'short/over collection amounts are flagged as disputed'
);
SELECT extensions.ok(
  position('cod_collection.recorded' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure
  ))>0
  AND position('public.audit_logs' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure
  ))>0,
  'cash collection creates an audit log entry'
);
SELECT extensions.ok(
  position('UPDATE public.payments' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure
  ))=0,
  'cash recording does not settle payment before owner/admin verification'
);

SELECT * FROM extensions.finish();
ROLLBACK;
