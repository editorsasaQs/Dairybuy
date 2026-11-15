-- Phase 4.5.1 COD cash collection recording security and contract regression.
BEGIN;
SELECT extensions.plan(17);

SELECT extensions.ok(
  to_regclass('public.delivery_assignment_orders') IS NOT NULL,
  'normalized delivery assignment to order relation exists'
);
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.delivery_assignment_orders'::regclass),
  'delivery assignment order mapping has RLS enabled'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon','public.delivery_assignment_orders','SELECT')
  AND has_table_privilege('authenticated','public.delivery_assignment_orders','INSERT')
  AND NOT has_table_privilege('authenticated','public.delivery_assignment_orders','UPDATE'),
  'only authenticated admin-policy mediated insert/select/delete is granted on assignment mapping'
);
SELECT extensions.ok(
  to_regprocedure('private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)') IS NOT NULL
  AND to_regprocedure('public.record_cod_cash_collection(uuid,integer,uuid,uuid,text)') IS NOT NULL,
  'private implementation and public RPC wrapper exist'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon','public.record_cod_cash_collection(uuid,integer,uuid,uuid,text)','EXECUTE')
  AND has_function_privilege('authenticated','public.record_cod_cash_collection(uuid,integer,uuid,uuid,text)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)','EXECUTE'),
  'only authenticated callers can execute public RPC; private implementation stays inaccessible'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated','public.cod_collections','INSERT')
  AND NOT has_table_privilege('authenticated','public.cod_collections','UPDATE')
  AND NOT has_table_privilege('authenticated','public.cod_collections','DELETE'),
  'clients cannot directly mutate COD collection records'
);
SELECT extensions.ok(
  (SELECT prosecdef FROM pg_proc
   WHERE oid='private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure)
  AND (SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc
   WHERE oid='private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure),
  'private collection RPC is SECURITY DEFINER with empty search_path'
);
SELECT extensions.ok(
  position('FOR UPDATE' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) > 0
  AND position('pg_advisory_xact_lock' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) > 0,
  'collection RPC serializes and locks competing attempts per order'
);
SELECT extensions.ok(
  position('da.staff_id = v_actor' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) > 0
  AND position('dao.order_id = p_order_id' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) > 0,
  'delivery staff authorization is bound to their own explicitly assigned order'
);
SELECT extensions.ok(
  position('v_order.status <> ''delivered''' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) > 0
  AND position('v_order.payment_status <> ''pending''' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) > 0,
  'only delivered and still-unpaid COD orders can record cash'
);
SELECT extensions.ok(
  position('v_existing.idempotency_key = p_idempotency_key' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) > 0
  AND to_regclass('public.uq_cod_collections_order') IS NOT NULL,
  'one collection per order and safe same-key retry are enforced'
);
SELECT extensions.ok(
  position('cod_cash_collection_recorded' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) > 0,
  'successful collection writes an audit event'
);
SELECT extensions.ok(
  position('UPDATE public.payments' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) = 0
  AND position('UPDATE public.orders' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) = 0,
  'cash recording does not prematurely settle payment or mutate order status'
);
SELECT extensions.ok(
  position('p_amount_collected_paise <= 0' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) > 0
  AND position('pg_catalog.length(p_collection_note) > 500' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) > 0,
  'cash amount and collector note inputs are validated'
);
SELECT extensions.ok(
  (SELECT count(*) = 3 AND bool_and(roles @> ARRAY['authenticated']::name[])
   FROM pg_policies
   WHERE schemaname='public' AND tablename='delivery_assignment_orders'
     AND policyname IN (
       'delivery_assignment_orders_admin_select',
       'delivery_assignment_orders_admin_insert',
       'delivery_assignment_orders_admin_delete'
     )),
  'assignment-to-order mapping is admin/owner managed'
);
SELECT extensions.ok(
  position('v_is_admin' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) > 0
  AND position('private.is_admin_or_owner()' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) > 0,
  'owner/admin fallback authorization is explicit'
);
SELECT extensions.ok(
  position('order_total_paise' IN pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)'::regprocedure
  )) > 0,
  'RPC returns collected amount alongside authoritative order total for later reconciliation'
);

SELECT * FROM extensions.finish();
ROLLBACK;
