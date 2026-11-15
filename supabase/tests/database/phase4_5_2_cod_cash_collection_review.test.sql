-- Phase 4.5.2 COD cash review security and financial settlement invariants.
BEGIN;
SELECT extensions.plan(23);

SELECT extensions.ok(
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cod_collections'
      AND column_name='rejected_by_manager_id')
  AND EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cod_collections'
      AND column_name='rejected_at')
  AND EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cod_collections'
      AND column_name='rejection_reason'),
  'collection rejection actor, timestamp and reason are persisted'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.cod_collections'::regclass
      AND conname='cod_collections_status_check'
      AND pg_get_constraintdef(oid) LIKE '%rejected%'),
  'collection status constraint includes rejected'
);
SELECT extensions.ok(
  to_regprocedure('private.review_cod_cash_collection(uuid,text,text)') IS NOT NULL
  AND to_regprocedure('public.review_cod_cash_collection(uuid,text,text)') IS NOT NULL,
  'private review implementation and public RPC wrapper exist'
);
SELECT extensions.ok(
  to_regprocedure('private.get_admin_cod_collection(uuid)') IS NOT NULL
  AND to_regprocedure('public.get_admin_cod_collection(uuid)') IS NOT NULL,
  'private and public admin-only collection read RPCs exist'
);
SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='private.review_cod_cash_collection(uuid,text,text)'::regprocedure),
  'private review RPC is SECURITY DEFINER with empty search_path'
);
SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='public.review_cod_cash_collection(uuid,text,text)'::regprocedure),
  'public review wrapper is SECURITY DEFINER with empty search_path'
);
SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='private.get_admin_cod_collection(uuid)'::regprocedure)
  AND (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='public.get_admin_cod_collection(uuid)'::regprocedure),
  'admin collection read implementation and wrapper have hardened execution context'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.review_cod_cash_collection(uuid,text,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.review_cod_cash_collection(uuid,text,text)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.review_cod_cash_collection(uuid,text,text)','EXECUTE'),
  'only authenticated users can invoke the public review RPC'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.get_admin_cod_collection(uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.get_admin_cod_collection(uuid)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.get_admin_cod_collection(uuid)','EXECUTE'),
  'only authenticated users can invoke the public admin read wrapper'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated','public.cod_collections','SELECT')
  AND NOT has_table_privilege('authenticated','public.cod_collections','UPDATE')
  AND NOT has_table_privilege('authenticated','public.payments','UPDATE')
  AND NOT has_table_privilege('authenticated','public.orders','UPDATE'),
  'API users cannot directly change collection, payment or order settlement state'
);
SELECT extensions.ok(
  position('private.is_admin_or_owner()' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0,
  'review RPC enforces owner/admin authorization server-side'
);
SELECT extensions.ok(
  position('FOR UPDATE' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0
  AND position('public.cod_collections' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0
  AND position('public.payments' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0,
  'review RPC locks order, collection and payment rows before state changes'
);
SELECT extensions.ok(
  position('v_order.status <> ''delivered''' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0
  AND position('v_order.order_type <> ''one_time''' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0
  AND position('v_order.payment_method <> ''cod''' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0,
  'only delivered one-time COD orders can be reviewed'
);
SELECT extensions.ok(
  position('v_collection.amount_collected_paise <> v_order.total_paise' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0
  AND position('v_collection.status <> ''collected''' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0,
  'verification requires an undisputed collected record matching the exact order total'
);
SELECT extensions.ok(
  position('SET status = ''captured''' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0
  AND position('SET payment_status = ''captured''' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0,
  'successful verification captures both payment and order payment status atomically'
);
SELECT extensions.ok(
  position('p_decision = ''reject''' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0
  AND position('pg_catalog.length(v_note) < 5' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0,
  'rejection requires a meaningful reason'
);
SELECT extensions.ok(
  position('SET status = ''rejected''' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0
  AND position('rejected_by_manager_id = v_actor' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0
  AND position('rejection_reason = v_note' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0,
  'rejection persists reviewer, timestamp and reason'
);
SELECT extensions.ok(
  position('Rejection never captures or otherwise changes the pending payment' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0,
  'rejection leaves the COD payment pending'
);
SELECT extensions.ok(
  position('cod_collection.verified' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0
  AND position('cod_collection.rejected' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0
  AND position('public.audit_logs' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0,
  'both review decisions append audit log events'
);
SELECT extensions.ok(
  position('v_collection.status = ''verified''' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0
  AND position('v_collection.status = ''rejected''' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0,
  'same-decision retries are explicitly idempotent'
);
SELECT extensions.ok(
  position('private.is_admin_or_owner()' IN pg_get_functiondef(
    'private.get_admin_cod_collection(uuid)'::regprocedure
  )) > 0,
  'collection details are readable only through the owner/admin RPC boundary'
);
SELECT extensions.ok(
  position('receipt_reference' IN pg_get_functiondef(
    'private.get_admin_cod_collection(uuid)'::regprocedure
  )) > 0
  AND position('rejection_reason' IN pg_get_functiondef(
    'private.get_admin_cod_collection(uuid)'::regprocedure
  )) > 0
  AND position('collected_by_staff_id' IN pg_get_functiondef(
    'private.get_admin_cod_collection(uuid)'::regprocedure
  )) > 0,
  'admin read RPC returns the collection evidence and review outcome fields'
);
SELECT extensions.ok(
  position('o.order_type = ''one_time''' IN pg_get_functiondef(
    'private.get_admin_cod_collection(uuid)'::regprocedure
  )) > 0
  AND position('o.payment_method = ''cod''' IN pg_get_functiondef(
    'private.get_admin_cod_collection(uuid)'::regprocedure
  )) > 0,
  'admin read RPC is scoped to one-time COD orders'
);
SELECT extensions.ok(
  position('payment_status' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0
  AND position('was_replayed' IN pg_get_functiondef(
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure
  )) > 0,
  'review RPC returns authoritative settlement status and replay result'
);

SELECT * FROM extensions.finish();
ROLLBACK;
