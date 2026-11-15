-- Phase 5.7: owner/admin-managed delivery with customer receipt confirmation.
-- There is no delivery-agent interface in the launch scope.
BEGIN;

DO $patch$
DECLARE v_def text; v_next text;
BEGIN
  v_def:=pg_catalog.pg_get_functiondef('private.start_subscription_delivery(uuid)'::regprocedure);
  v_next:=pg_catalog.replace(v_def,
    'IF NOT private.is_admin_or_owner() AND NOT (v_delivery.assigned_staff_id=v_actor AND private.is_staff()) THEN',
    'IF NOT private.is_admin_or_owner() THEN');
  v_next:=pg_catalog.replace(v_next,
    E'  IF v_delivery.status<>''assigned'' THEN RAISE EXCEPTION ''Delivery must be assigned before dispatch'' USING ERRCODE=''23514''; END IF;\n  SELECT o.* INTO v_order FROM public.orders o WHERE o.id=v_delivery.order_id FOR UPDATE;\n  IF v_order.status<>''confirmed'' THEN RAISE EXCEPTION ''Subscription order is not confirmed'' USING ERRCODE=''23514''; END IF;',
    E'  IF v_delivery.status NOT IN (''scheduled'',''assigned'') THEN RAISE EXCEPTION ''Only scheduled or assigned deliveries can be dispatched'' USING ERRCODE=''23514''; END IF;\n  SELECT o.* INTO v_order FROM public.orders o WHERE o.id=v_delivery.order_id FOR UPDATE;\n  IF v_delivery.status=''scheduled'' THEN\n    IF v_order.status<>''pending_confirmation'' THEN RAISE EXCEPTION ''Scheduled subscription order is not pending confirmation'' USING ERRCODE=''23514''; END IF;\n    UPDATE public.orders SET status=''confirmed'',updated_at=pg_catalog.now() WHERE id=v_order.id;\n    INSERT INTO public.order_status_history(order_id,from_status,to_status,changed_by,note) VALUES(v_order.id,''pending_confirmation'',''confirmed'',v_actor,''Owner/admin prepared subscription delivery'');\n    UPDATE public.subscription_deliveries SET status=''assigned'',assigned_staff_id=v_actor,assigned_at=pg_catalog.now() WHERE id=p_delivery_id;\n    v_delivery.status:=''assigned''; v_order.status:=''confirmed'';\n  END IF;\n  IF v_order.status<>''confirmed'' THEN RAISE EXCEPTION ''Subscription order is not confirmed'' USING ERRCODE=''23514''; END IF;');
  IF v_next=v_def
     OR pg_catalog.strpos(v_next,'IF NOT private.is_admin_or_owner() THEN')=0
     OR pg_catalog.strpos(v_next,'v_delivery.status=''scheduled''')=0
     OR pg_catalog.strpos(v_next,'Owner/admin prepared subscription delivery')=0 THEN
    RAISE EXCEPTION 'Admin-managed subscription dispatch patch did not match expected source';
  END IF;
  EXECUTE v_next;

  v_def:=pg_catalog.pg_get_functiondef('private.complete_subscription_delivery(uuid)'::regprocedure);
  v_next:=pg_catalog.replace(v_def,
    'IF NOT private.is_admin_or_owner() AND NOT (v_delivery.assigned_staff_id=v_actor AND private.is_staff()) THEN',
    'IF NOT private.is_admin_or_owner() AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id=v_delivery.subscription_id AND s.customer_id=v_actor) THEN');
  IF v_next=v_def OR pg_catalog.strpos(v_next,'s.customer_id=v_actor')=0
     OR pg_catalog.strpos(v_next,'private.is_staff()')>0 THEN
    RAISE EXCEPTION 'Customer receipt confirmation authorization patch did not match expected source';
  END IF;
  EXECUTE v_next;

  v_def:=pg_catalog.pg_get_functiondef('private.fail_subscription_delivery(uuid,text)'::regprocedure);
  v_next:=pg_catalog.replace(v_def,
    'IF v_delivery.status NOT IN (''assigned'',''out_for_delivery'') THEN',
    'IF v_delivery.status NOT IN (''scheduled'',''assigned'',''out_for_delivery'') THEN');
  IF v_next=v_def OR pg_catalog.strpos(v_next,'''scheduled'',''assigned'',''out_for_delivery''')=0 THEN
    RAISE EXCEPTION 'Admin scheduled delivery failure patch did not match expected source';
  END IF;
  EXECUTE v_next;
END;
$patch$;

COMMENT ON FUNCTION public.start_subscription_delivery(uuid) IS
  'Owner/admin-only dispatch transition. Admin may dispatch a scheduled delivery without assigning a delivery agent; delivery status is then visible to the subscription owner for receipt confirmation.';
COMMENT ON FUNCTION public.complete_subscription_delivery(uuid) IS
  'Owner/admin may mark a subscription delivery complete; the owning customer may confirm receipt after it is out for delivery. Inventory fulfilment and order/delivery status transitions are atomic.';
COMMENT ON FUNCTION public.fail_subscription_delivery(uuid,text) IS
  'Owner/admin-only failure resolution for scheduled, assigned or dispatched subscription deliveries; releases outstanding reservations atomically.';

COMMIT;
