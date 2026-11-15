-- Phase 5.7 owner/admin-managed dispatch and customer receipt confirmation.
BEGIN;
SELECT extensions.plan(7);

SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='private.start_subscription_delivery(uuid)'::regprocedure),
  'dispatch remains SECURITY DEFINER with an empty search_path'
);
SELECT extensions.ok(
  strpos(pg_get_functiondef('private.start_subscription_delivery(uuid)'::regprocedure),
    'IF NOT private.is_admin_or_owner() THEN')>0
  AND strpos(pg_get_functiondef('private.start_subscription_delivery(uuid)'::regprocedure),
    'private.is_staff()')=0,
  'only owner/admin can dispatch subscription deliveries'
);
SELECT extensions.ok(
  strpos(pg_get_functiondef('private.start_subscription_delivery(uuid)'::regprocedure),
    'v_delivery.status=''scheduled''')>0
  AND strpos(pg_get_functiondef('private.start_subscription_delivery(uuid)'::regprocedure),
    'Owner/admin prepared subscription delivery')>0,
  'owner/admin can dispatch a scheduled delivery without assigning a delivery agent'
);
SELECT extensions.ok(
  strpos(pg_get_functiondef('private.complete_subscription_delivery(uuid)'::regprocedure),
    's.customer_id=v_actor')>0
  AND strpos(pg_get_functiondef('private.complete_subscription_delivery(uuid)'::regprocedure),
    'private.is_staff()')=0,
  'only owner/admin or the subscription-owning customer can complete/confirm receipt'
);
SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='private.complete_subscription_delivery(uuid)'::regprocedure)
  AND has_function_privilege('authenticated','public.complete_subscription_delivery(uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.complete_subscription_delivery(uuid)','EXECUTE'),
  'customer/admin receipt confirmation remains a hardened authenticated RPC'
);
SELECT extensions.ok(
  strpos(pg_get_functiondef('private.fail_subscription_delivery(uuid,text)'::regprocedure),
    'v_delivery.status NOT IN (''scheduled'',''assigned'',''out_for_delivery'')')>0,
  'owner/admin can resolve a failed scheduled delivery before dispatch'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.start_subscription_delivery(uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.start_subscription_delivery(uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.fail_subscription_delivery(uuid,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.fail_subscription_delivery(uuid,text)','EXECUTE'),
  'dispatch and failure wrappers remain authenticated-only; role checks stay inside trusted functions'
);

SELECT * FROM extensions.finish();
ROLLBACK;
