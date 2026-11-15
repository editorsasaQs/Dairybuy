-- Phase 4.6.2 FK performance and two-interface authorization boundary.
BEGIN;
SELECT extensions.plan(9);

SELECT extensions.is(
  (SELECT count(*)::integer FROM pg_indexes
   WHERE schemaname='public' AND indexname IN (
    'idx_cod_collection_adjustments_created_by',
    'idx_cod_collections_rejected_by_manager_id',
    'idx_delivery_assignment_orders_assigned_by',
    'idx_delivery_cash_handover_adjustments_created_by',
    'idx_delivery_cash_handovers_delivery_slot_id',
    'idx_delivery_cash_handovers_reviewed_by',
    'idx_delivery_cash_handovers_submitted_by',
    'idx_inventory_receipt_items_product_variant_id',
    'idx_orders_subscription_id',
    'idx_subscription_item_vendor_changes_created_by',
    'idx_subscription_item_vendor_changes_new_vendor_id',
    'idx_subscription_item_vendor_changes_old_vendor_id',
    'idx_subscription_item_vendor_changes_subscription_id',
    'idx_subscription_lifecycle_events_actor_id',
    'idx_subscription_skip_records_created_by'
   )),15,'all fifteen previously unindexed foreign keys now have covering indexes'
);

SELECT extensions.ok(
  (SELECT qual LIKE '%auth.uid()%' AND qual LIKE '%SELECT%' AND qual NOT LIKE '%private.is_staff%'
   FROM pg_policies WHERE schemaname='public' AND tablename='subscription_item_vendor_changes'
     AND policyname='subscription_item_vendor_changes_read')
  AND
  (SELECT qual LIKE '%auth.uid()%' AND qual LIKE '%SELECT%' AND qual NOT LIKE '%private.is_staff%'
   FROM pg_policies WHERE schemaname='public' AND tablename='subscription_lifecycle_events'
     AND policyname='subscription_lifecycle_events_read'),
  'subscription history RLS policies use init-plan auth checks and exclude staff access'
);

SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc WHERE oid='private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure)
  AND strpos(pg_get_functiondef('private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure),
    'IF v_actor IS NULL OR NOT private.is_admin_or_owner()')>0
  AND strpos(pg_get_functiondef('private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure),
    'v_assignment_authorized')=0,
  'COD cash recording is owner/admin-only before order lookup and remains hardened'
);

SELECT extensions.ok(
  has_function_privilege('authenticated','public.record_cod_cash_collection(uuid,integer,text,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.record_cod_cash_collection(uuid,integer,text,text)','EXECUTE'),
  'owner/admin cash-recording RPC remains authenticated-only'
);

SELECT extensions.ok(
  NOT has_function_privilege('authenticated','public.assign_cod_order_to_delivery(uuid,uuid)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.assign_subscription_delivery(uuid,uuid)','EXECUTE'),
  'delivery assignment RPCs are no longer exposed to authenticated staff or clients'
);

SELECT extensions.ok(
  NOT has_function_privilege('authenticated','public.get_my_unhanded_cod_collections()','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.submit_delivery_cash_handover(uuid[],integer,uuid)','EXECUTE'),
  'staff cash queue and cash handover RPCs are not exposed without a staff interface'
);

SELECT extensions.ok(
  has_function_privilege('authenticated','public.start_subscription_delivery(uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.complete_subscription_delivery(uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.fail_subscription_delivery(uuid,text)','EXECUTE'),
  'owner/admin dispatch, customer/admin receipt confirmation and admin failure RPCs remain available'
);

SELECT extensions.ok(
  has_function_privilege('authenticated','public.get_admin_cod_financial_report(date,date,uuid,uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.review_delivery_cash_handover(uuid,text,text)','EXECUTE')
  AND has_function_privilege('authenticated','public.correct_delivery_cash_handover(uuid,bigint,text,text)','EXECUTE'),
  'owner/admin COD financial reporting and legacy handover review remain available'
);

SELECT extensions.ok(
  (SELECT count(*)=2 FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('subscription_item_vendor_changes','subscription_lifecycle_events')
    AND policyname IN ('subscription_item_vendor_changes_read','subscription_lifecycle_events_read')
    AND qual NOT LIKE '%private.is_staff%'),
  'both subscription history policies now enforce the customer and owner/admin interface boundary'
);

SELECT * FROM extensions.finish();
ROLLBACK;
