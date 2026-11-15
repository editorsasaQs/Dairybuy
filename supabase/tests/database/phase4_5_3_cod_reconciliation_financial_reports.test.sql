-- Phase 4.5.3–4.5.5 COD discrepancy, handover and reporting security contract.
BEGIN;
SELECT extensions.plan(18);

SELECT extensions.ok(
  to_regclass('public.cod_collection_adjustments') IS NOT NULL,
  'COD discrepancy adjustments are persisted in a separate evidence ledger'
);
SELECT extensions.ok(
  to_regclass('public.delivery_cash_handovers') IS NOT NULL
  AND to_regclass('public.delivery_cash_handover_items') IS NOT NULL,
  'cash handover batches and collection links exist'
);
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.cod_collection_adjustments'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.delivery_cash_handovers'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.delivery_cash_handover_items'::regclass),
  'all new financial tables have RLS enabled'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated','public.cod_collection_adjustments','SELECT')
  AND NOT has_table_privilege('authenticated','public.cod_collection_adjustments','INSERT')
  AND NOT has_table_privilege('authenticated','public.delivery_cash_handovers','SELECT')
  AND NOT has_table_privilege('authenticated','public.delivery_cash_handover_items','INSERT'),
  'authenticated API roles cannot bypass financial RPC boundaries'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
    AND indexname='idx_cod_collection_adjustments_collection_created')
  AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
    AND indexname='idx_delivery_cash_handovers_staff_date')
  AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
    AND indexname='idx_delivery_cash_handover_items_handover'),
  'financial history and handover lookup indexes exist'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.delivery_cash_handover_items'::regclass
    AND conname='delivery_cash_handover_items_collection_id_key'),
  'one collection cannot be included in more than one handover'
);
SELECT extensions.ok(
  to_regprocedure('private.resolve_cod_collection_discrepancy(uuid,integer,text,text)') IS NOT NULL
  AND to_regprocedure('public.resolve_cod_collection_discrepancy(uuid,integer,text,text)') IS NOT NULL,
  'private discrepancy implementation and public wrapper exist'
);
SELECT extensions.ok(
  to_regprocedure('private.submit_delivery_cash_handover(uuid[],integer,uuid)') IS NOT NULL
  AND to_regprocedure('public.submit_delivery_cash_handover(uuid[],integer,uuid)') IS NOT NULL,
  'staff handover submission RPC and wrapper exist'
);
SELECT extensions.ok(
  to_regprocedure('private.review_delivery_cash_handover(uuid,text,text)') IS NOT NULL
  AND to_regprocedure('public.review_delivery_cash_handover(uuid,text,text)') IS NOT NULL,
  'owner/admin handover review RPC and wrapper exist'
);
SELECT extensions.ok(
  to_regprocedure('private.get_admin_cod_financial_report(date,date,uuid,uuid)') IS NOT NULL
  AND to_regprocedure('public.get_admin_cod_financial_report(date,date,uuid,uuid)') IS NOT NULL,
  'owner/admin COD financial reporting RPC and wrapper exist'
);
SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc
   WHERE oid='private.resolve_cod_collection_discrepancy(uuid,integer,text,text)'::regprocedure)
  AND (SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc
   WHERE oid='private.submit_delivery_cash_handover(uuid[],integer,uuid)'::regprocedure)
  AND (SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc
   WHERE oid='private.review_delivery_cash_handover(uuid,text,text)'::regprocedure),
  'financial write implementations are SECURITY DEFINER with empty search_path'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.resolve_cod_collection_discrepancy(uuid,integer,text,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.resolve_cod_collection_discrepancy(uuid,integer,text,text)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.resolve_cod_collection_discrepancy(uuid,integer,text,text)','EXECUTE'),
  'only authenticated users can call the discrepancy wrapper and private implementation remains closed'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.submit_delivery_cash_handover(uuid[],integer,uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.submit_delivery_cash_handover(uuid[],integer,uuid)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.submit_delivery_cash_handover(uuid[],integer,uuid)','EXECUTE'),
  'only authenticated users can invoke staff handover wrapper'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.review_delivery_cash_handover(uuid,text,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.review_delivery_cash_handover(uuid,text,text)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.review_delivery_cash_handover(uuid,text,text)','EXECUTE'),
  'only authenticated users can invoke the owner/admin-guarded handover review wrapper'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.get_admin_cod_financial_report(date,date,uuid,uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.get_admin_cod_financial_report(date,date,uuid,uuid)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.get_admin_cod_financial_report(date,date,uuid,uuid)','EXECUTE'),
  'only authenticated users can invoke the owner/admin-guarded report wrapper'
);
SELECT extensions.ok(
  position('private.is_admin_or_owner()' IN pg_get_functiondef(
    'private.resolve_cod_collection_discrepancy(uuid,integer,text,text)'::regprocedure))>0
  AND position('FOR UPDATE' IN pg_get_functiondef(
    'private.resolve_cod_collection_discrepancy(uuid,integer,text,text)'::regprocedure))>0,
  'discrepancy correction checks owner/admin and locks financial rows'
);
SELECT extensions.ok(
  position('p_corrected_amount_paise=v_order.total_paise' IN pg_get_functiondef(
    'private.resolve_cod_collection_discrepancy(uuid,integer,text,text)'::regprocedure))>0
  AND position('private.review_cod_cash_collection' IN pg_get_functiondef(
    'private.resolve_cod_collection_discrepancy(uuid,integer,text,text)'::regprocedure))>0,
  'only exact corrected cash can invoke final COD verification; no partial settlement'
);
SELECT extensions.ok(
  position('v_expected' IN pg_get_functiondef(
    'private.submit_delivery_cash_handover(uuid[],integer,uuid)'::regprocedure))>0
  AND position('expected_amount_paise' IN pg_get_functiondef(
    'private.review_delivery_cash_handover(uuid,text,text)'::regprocedure))>0
  AND position('Only owner/admin' IN pg_get_functiondef(
    'private.review_delivery_cash_handover(uuid,text,text)'::regprocedure))>0,
  'handover expected cash is server-computed and acceptance is owner/admin-only'
);

SELECT * FROM extensions.finish();
ROLLBACK;
