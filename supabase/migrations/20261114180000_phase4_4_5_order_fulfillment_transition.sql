-- Phase 4.4.5: atomic staff-only one-time COD fulfillment transitions.
-- Customer cancellation remains owned by the Phase 4.4.4 RPC.
CREATE OR REPLACE FUNCTION private.transition_one_time_cod_order(
  p_order_id uuid,
  p_next_status public.order_status_enum,
  p_note text DEFAULT NULL
)
RETURNS TABLE(
  order_id uuid,
  previous_status public.order_status_enum,
  resulting_status public.order_status_enum,
  was_already_applied boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_allowed boolean := false;
  v_note text;
BEGIN
  IF v_actor IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Not authorized to manage orders' USING ERRCODE = '42501';
  END IF;

  IF p_order_id IS NULL OR p_next_status IS NULL THEN
    RAISE EXCEPTION 'Order ID and next status are required' USING ERRCODE = '22023';
  END IF;

  IF p_next_status NOT IN ('confirmed', 'processing', 'out_for_delivery', 'delivered') THEN
    RAISE EXCEPTION 'Requested order status is not an allowed fulfillment target' USING ERRCODE = '22023';
  END IF;

  IF p_note IS NOT NULL AND pg_catalog.length(p_note) > 500 THEN
    RAISE EXCEPTION 'Order status note must be 500 characters or fewer' USING ERRCODE = '22023';
  END IF;
  v_note := NULLIF(pg_catalog.btrim(p_note), '');

  SELECT o.* INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.order_type <> 'one_time' OR v_order.payment_method <> 'cod' THEN
    RAISE EXCEPTION 'Only one-time COD orders can use this fulfillment workflow' USING ERRCODE = '23514';
  END IF;

  -- A repeated request for the already-applied target is an idempotent no-op.
  IF v_order.status = p_next_status THEN
    RETURN QUERY SELECT v_order.id, v_order.status, v_order.status, true;
    RETURN;
  END IF;

  v_allowed := CASE v_order.status
    WHEN 'pending_confirmation' THEN p_next_status = 'confirmed'
    WHEN 'confirmed' THEN p_next_status = 'processing'
    WHEN 'processing' THEN p_next_status = 'out_for_delivery'
    WHEN 'out_for_delivery' THEN p_next_status = 'delivered'
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid order status transition: % -> %', v_order.status, p_next_status
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.orders
  SET status = p_next_status,
      updated_at = pg_catalog.now()
  WHERE id = p_order_id;

  INSERT INTO public.order_status_history(order_id, from_status, to_status, changed_by, note)
  VALUES (p_order_id, v_order.status, p_next_status, v_actor, v_note);

  RETURN QUERY SELECT p_order_id, v_order.status, p_next_status, false;
END;
$function$;

REVOKE ALL ON FUNCTION private.transition_one_time_cod_order(uuid, public.order_status_enum, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.transition_one_time_cod_order(
  p_order_id uuid,
  p_next_status public.order_status_enum,
  p_note text DEFAULT NULL
)
RETURNS TABLE(
  order_id uuid,
  previous_status public.order_status_enum,
  resulting_status public.order_status_enum,
  was_already_applied boolean
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $wrapper$
  SELECT *
  FROM private.transition_one_time_cod_order(p_order_id, p_next_status, p_note);
$wrapper$;

REVOKE ALL ON FUNCTION public.transition_one_time_cod_order(uuid, public.order_status_enum, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.transition_one_time_cod_order(uuid, public.order_status_enum, text)
  TO authenticated;

-- Force all authenticated order status changes through the audited RPC.
DROP POLICY IF EXISTS orders_update_staff ON public.orders;
DROP POLICY IF EXISTS orders_update_staff_or_owner ON public.orders;

COMMENT ON FUNCTION public.transition_one_time_cod_order(uuid, public.order_status_enum, text) IS
'Owner/admin-only atomic forward state transition for one-time COD orders. Writes one status-history event; does not change totals, payment, inventory, or COD collection.';
