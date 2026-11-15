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

-- COD cash is recorded by owner/admin. The physical delivery agent has no
-- product interface and cannot submit cash collections or handover batches.
DO $patch$
DECLARE
  v_def text;
  v_next text;
  v_assignment_block text;
BEGIN
  v_def:=pg_catalog.pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure
  );
  v_assignment_block:=E'  SELECT EXISTS (\n    SELECT 1 FROM public.delivery_assignment_orders dao\n    JOIN public.delivery_assignments da ON da.id=dao.delivery_assignment_id\n    WHERE dao.order_id=p_order_id AND da.staff_id=v_actor\n      AND da.status IN (''assigned'',''in_progress'',''completed'')\n  ) OR EXISTS (\n    SELECT 1 FROM public.subscription_deliveries sd\n    WHERE sd.order_id=p_order_id AND sd.assigned_staff_id=v_actor\n      AND sd.status=''delivered''\n  ) INTO v_assignment_authorized;\n\n  IF NOT private.is_admin_or_owner() AND NOT v_assignment_authorized THEN\n    RAISE EXCEPTION ''Only the assigned delivery staff or owner/admin can record this collection''\n      USING ERRCODE=''42501'';\n  END IF;';
  v_next:=pg_catalog.replace(v_def,v_assignment_block,
    E'  IF NOT private.is_admin_or_owner() THEN\n    RAISE EXCEPTION ''Only owner/admin can record COD cash'' USING ERRCODE=''42501'';\n  END IF;');
  v_next:=pg_catalog.replace(v_next,'  v_assignment_authorized boolean := false;\n','');
  IF v_next=v_def
     OR pg_catalog.strpos(v_next,'v_assignment_authorized')>0
     OR pg_catalog.strpos(v_next,'Only owner/admin can record COD cash')=0 THEN
    RAISE EXCEPTION 'COD collection owner/admin authorization patch did not match expected function source';
  END IF;
  EXECUTE v_next;
END;
$patch$;

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
