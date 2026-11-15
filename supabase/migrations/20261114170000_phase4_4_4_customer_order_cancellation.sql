-- Phase 4.4.4: atomic customer cancellation for uncollected one-time COD orders.
CREATE OR REPLACE FUNCTION private.cancel_customer_cod_order(p_order_id uuid)
RETURNS TABLE(order_id uuid, resulting_status public.order_status_enum, was_already_cancelled boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_customer uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_slot public.delivery_slots%ROWTYPE;
  v_local timestamp without time zone;
  v_deadline timestamp without time zone;
  v_inventory record;
  v_reserved integer;
BEGIN
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order ID is required' USING ERRCODE = '22023';
  END IF;

  SELECT o.* INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id AND o.customer_id = v_customer
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN QUERY SELECT v_order.id, v_order.status, true;
    RETURN;
  END IF;

  IF v_order.order_type <> 'one_time'
     OR v_order.payment_method <> 'cod'
     OR v_order.payment_status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending cash-on-delivery orders can be cancelled here' USING ERRCODE = '23514';
  END IF;

  IF v_order.status NOT IN ('pending_confirmation', 'confirmed', 'processing') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled' USING ERRCODE = '23514';
  END IF;

  IF v_order.delivery_date IS NULL THEN
    RAISE EXCEPTION 'Order delivery date is unavailable' USING ERRCODE = '23514';
  END IF;

  SELECT ds.* INTO v_slot
  FROM public.delivery_slots ds
  WHERE ds.id = v_order.delivery_slot_id;
  IF NOT FOUND OR v_slot.cancellation_deadline_time IS NULL THEN
    RAISE EXCEPTION 'Order cancellation deadline is not configured' USING ERRCODE = '23514';
  END IF;

  v_local := pg_catalog.now() AT TIME ZONE 'Asia/Kolkata';
  v_deadline := v_order.delivery_date + v_slot.cancellation_deadline_time;
  IF v_local > v_deadline THEN
    RAISE EXCEPTION 'The cancellation deadline for this delivery slot has passed' USING ERRCODE = '23514';
  END IF;

  -- Lock reservation rows deterministically. The order row lock serializes
  -- duplicate cancellations; this inventory lock serializes stock release.
  FOR v_inventory IN
    SELECT i.id, i.reserved_stock
    FROM public.inventory i
    WHERE i.id IN (
      SELECT DISTINCT im.inventory_id
      FROM public.inventory_movements im
      WHERE im.reference_id = p_order_id::text
        AND im.movement_type IN ('order_reservation', 'order_reservation_release')
    )
    ORDER BY i.id
    FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(im.change_amount), 0)::integer INTO v_reserved
    FROM public.inventory_movements im
    WHERE im.inventory_id = v_inventory.id
      AND im.reference_id = p_order_id::text
      AND im.movement_type IN ('order_reservation', 'order_reservation_release');

    IF v_reserved < 0 OR v_inventory.reserved_stock < v_reserved THEN
      RAISE EXCEPTION 'Order inventory reservation is inconsistent; cancellation was not applied' USING ERRCODE = '23514';
    END IF;

    IF v_reserved > 0 THEN
      UPDATE public.inventory
      SET reserved_stock = reserved_stock - v_reserved,
          updated_at = pg_catalog.now()
      WHERE id = v_inventory.id;

      INSERT INTO public.inventory_movements(
        inventory_id, change_amount, movement_type, reference_id, notes, created_by
      ) VALUES (
        v_inventory.id, -v_reserved, 'order_reservation_release', p_order_id::text,
        'Customer cancellation: release reserved stock', v_customer
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_movements im
    WHERE im.reference_id = p_order_id::text
      AND im.movement_type = 'order_reservation'
  ) THEN
    RAISE EXCEPTION 'Order inventory reservation is missing; cancellation was not applied' USING ERRCODE = '23514';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled', updated_at = pg_catalog.now()
  WHERE id = p_order_id AND customer_id = v_customer;

  INSERT INTO public.order_status_history(order_id, from_status, to_status, changed_by, note)
  VALUES (p_order_id, v_order.status, 'cancelled', v_customer, 'Customer cancelled before delivery-slot deadline');

  RETURN QUERY SELECT p_order_id, 'cancelled'::public.order_status_enum, false;
END;
$function$;

REVOKE ALL ON FUNCTION private.cancel_customer_cod_order(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancel_customer_cod_order(p_order_id uuid)
RETURNS TABLE(order_id uuid, resulting_status public.order_status_enum, was_already_cancelled boolean)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $wrapper$
  SELECT * FROM private.cancel_customer_cod_order(p_order_id);
$wrapper$;

REVOKE ALL ON FUNCTION public.cancel_customer_cod_order(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_customer_cod_order(uuid) TO authenticated;

COMMENT ON FUNCTION public.cancel_customer_cod_order(uuid) IS
'Atomically cancels an owned, pending one-time COD order through its Asia/Kolkata slot deadline; releases reserved inventory and appends order status history. No refund or COD collection is created.';
