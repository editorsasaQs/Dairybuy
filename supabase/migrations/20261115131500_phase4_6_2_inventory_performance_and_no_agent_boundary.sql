-- Phase 4.6.2: foreign-key indexes, RLS init-plan fixes and no-agent RPC boundary.
BEGIN;

CREATE INDEX IF NOT EXISTS idx_cod_collection_adjustments_created_by
  ON public.cod_collection_adjustments(created_by);
CREATE INDEX IF NOT EXISTS idx_cod_collections_rejected_by_manager_id
  ON public.cod_collections(rejected_by_manager_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignment_orders_assigned_by
  ON public.delivery_assignment_orders(assigned_by);
CREATE INDEX IF NOT EXISTS idx_delivery_cash_handover_adjustments_created_by
  ON public.delivery_cash_handover_adjustments(created_by);
CREATE INDEX IF NOT EXISTS idx_delivery_cash_handovers_delivery_slot_id
  ON public.delivery_cash_handovers(delivery_slot_id);
CREATE INDEX IF NOT EXISTS idx_delivery_cash_handovers_reviewed_by
  ON public.delivery_cash_handovers(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_delivery_cash_handovers_submitted_by
  ON public.delivery_cash_handovers(submitted_by);
CREATE INDEX IF NOT EXISTS idx_inventory_receipt_items_product_variant_id
  ON public.inventory_receipt_items(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_orders_subscription_id
  ON public.orders(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_item_vendor_changes_created_by
  ON public.subscription_item_vendor_changes(created_by);
CREATE INDEX IF NOT EXISTS idx_subscription_item_vendor_changes_new_vendor_id
  ON public.subscription_item_vendor_changes(new_vendor_id);
CREATE INDEX IF NOT EXISTS idx_subscription_item_vendor_changes_old_vendor_id
  ON public.subscription_item_vendor_changes(old_vendor_id);
CREATE INDEX IF NOT EXISTS idx_subscription_item_vendor_changes_subscription_id
  ON public.subscription_item_vendor_changes(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_lifecycle_events_actor_id
  ON public.subscription_lifecycle_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_subscription_skip_records_created_by
  ON public.subscription_skip_records(created_by);

-- Customer or owner/admin can read subscription history. Staff roles are not
-- part of the launch interface or authorization model.
DROP POLICY IF EXISTS subscription_item_vendor_changes_read
  ON public.subscription_item_vendor_changes;
CREATE POLICY subscription_item_vendor_changes_read
  ON public.subscription_item_vendor_changes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id=subscription_item_vendor_changes.subscription_id
        AND (
          s.customer_id=(SELECT auth.uid())
          OR (SELECT private.is_admin_or_owner())
        )
    )
  );

DROP POLICY IF EXISTS subscription_lifecycle_events_read
  ON public.subscription_lifecycle_events;
CREATE POLICY subscription_lifecycle_events_read
  ON public.subscription_lifecycle_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id=subscription_lifecycle_events.subscription_id
        AND (
          s.customer_id=(SELECT auth.uid())
          OR (SELECT private.is_admin_or_owner())
        )
    )
  );

-- COD cash is recorded by owner/admin only. Replace the concrete function
-- definition instead of brittle pg_get_functiondef text substitutions. The
-- previous patch expected a subscription_deliveries query that never existed
-- in the Phase 4.5.1 function, causing fresh database migration to abort.
CREATE OR REPLACE FUNCTION private.record_cod_cash_collection(
  p_order_id uuid,
  p_amount_collected_paise integer,
  p_receipt_reference text DEFAULT NULL,
  p_collection_notes text DEFAULT NULL
)
RETURNS TABLE(
  collection_id uuid,
  order_id uuid,
  amount_collected_paise integer,
  collection_status text,
  was_replayed boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_existing public.cod_collections%ROWTYPE;
  v_collection_id uuid;
  v_status text;
  v_receipt text;
  v_notes text;
BEGIN
  IF v_actor IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only owner/admin can record COD cash'
      USING ERRCODE='42501';
  END IF;
  IF p_order_id IS NULL OR p_amount_collected_paise IS NULL
     OR p_amount_collected_paise<=0 THEN
    RAISE EXCEPTION 'Order and positive collected amount are required' USING ERRCODE='22023';
  END IF;
  IF p_receipt_reference IS NOT NULL AND length(p_receipt_reference)>120 THEN
    RAISE EXCEPTION 'Receipt reference must be 120 characters or fewer' USING ERRCODE='22023';
  END IF;
  IF p_collection_notes IS NOT NULL AND length(p_collection_notes)>500 THEN
    RAISE EXCEPTION 'Collection notes must be 500 characters or fewer' USING ERRCODE='22023';
  END IF;
  v_receipt:=NULLIF(pg_catalog.btrim(p_receipt_reference),'');
  v_notes:=NULLIF(pg_catalog.btrim(p_collection_notes),'');

  SELECT o.* INTO v_order
  FROM public.orders o
  WHERE o.id=p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE='P0002';
  END IF;

  -- Same actor + same amount retry is an idempotent replay. Any changed
  -- amount/actor must go through an owner/admin discrepancy workflow later.
  SELECT c.* INTO v_existing
  FROM public.cod_collections c
  WHERE c.order_id=p_order_id;
  IF FOUND THEN
    IF v_existing.collected_by_staff_id=v_actor
       AND v_existing.amount_collected_paise=p_amount_collected_paise THEN
      RETURN QUERY SELECT v_existing.id,v_existing.order_id,
        v_existing.amount_collected_paise,v_existing.status,true;
      RETURN;
    END IF;
    RAISE EXCEPTION 'A COD collection record already exists for this order'
      USING ERRCODE='23505';
  END IF;

  IF v_order.order_type NOT IN ('one_time','subscription') OR v_order.payment_method<>'cod' THEN
    RAISE EXCEPTION 'Only one-time COD orders accept cash collection records'
      USING ERRCODE='23514';
  END IF;
  IF v_order.status<>'delivered' THEN
    RAISE EXCEPTION 'COD cash can be recorded only after delivery is confirmed'
      USING ERRCODE='23514';
  END IF;

  SELECT p.* INTO v_payment
  FROM public.payments p
  WHERE p.order_id=p_order_id
  FOR UPDATE;
  IF NOT FOUND OR v_payment.gateway<>'cod' OR v_payment.status<>'pending'
     OR v_payment.amount_paise<>v_order.total_paise THEN
    RAISE EXCEPTION 'Pending COD payment does not match the order total'
      USING ERRCODE='23514';
  END IF;

  v_status:=CASE
    WHEN p_amount_collected_paise=v_order.total_paise THEN 'collected'
    ELSE 'disputed'
  END;

  INSERT INTO public.cod_collections(
    order_id,collected_by_staff_id,amount_collected_paise,
    collected_at,status,receipt_reference,collection_notes
  ) VALUES (
    p_order_id,v_actor,p_amount_collected_paise,pg_catalog.now(),
    v_status,v_receipt,v_notes
  ) RETURNING id INTO v_collection_id;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,old_values,new_values)
  VALUES (
    v_actor,'cod_collection.recorded','cod_collections',v_collection_id::text,NULL,
    pg_catalog.jsonb_build_object(
      'order_id',p_order_id,
      'amount_collected_paise',p_amount_collected_paise,
      'order_total_paise',v_order.total_paise,
      'status',v_status,
      'receipt_reference',v_receipt
    )
  );

  -- Deliberately do not mark the payment captured. Owner/admin verification
  -- remains a separate audited action.
  RETURN QUERY SELECT v_collection_id,p_order_id,
    p_amount_collected_paise,v_status,false;
END;
$function$;

DO $assertion$
DECLARE
  v_def text := pg_catalog.pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure
  );
BEGIN
  IF pg_catalog.strpos(v_def,'IF v_actor IS NULL OR NOT private.is_admin_or_owner()')=0
     OR pg_catalog.strpos(v_def,'v_assignment_authorized')>0
     OR pg_catalog.strpos(v_def,'Only the assigned delivery staff')>0 THEN
    RAISE EXCEPTION 'COD collection function did not reach the owner/admin-only authorization boundary';
  END IF;
END;
$assertion$;

-- No staff assignment or staff cash-handover RPC is exposed to authenticated users.
REVOKE ALL ON FUNCTION public.assign_cod_order_to_delivery(uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.assign_subscription_delivery(uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_my_unhanded_cod_collections()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.submit_delivery_cash_handover(uuid[],integer,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION private.assign_cod_order_to_delivery(uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.assign_subscription_delivery(uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.get_my_unhanded_cod_collections()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.submit_delivery_cash_handover(uuid[],integer,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

COMMENT ON FUNCTION public.record_cod_cash_collection(uuid,integer,text,text) IS
  'Owner/admin-only cash recording for delivered one-time or subscription COD orders. Cash verification and payment capture remain separate audited actions.';
COMMENT ON POLICY subscription_item_vendor_changes_read ON public.subscription_item_vendor_changes IS
  'Customers can read their own subscription vendor history; owner/admin can read all. Staff access is not part of launch.';
COMMENT ON POLICY subscription_lifecycle_events_read ON public.subscription_lifecycle_events IS
  'Customers can read their own subscription lifecycle events; owner/admin can read all. Staff access is not part of launch.';

COMMIT;
