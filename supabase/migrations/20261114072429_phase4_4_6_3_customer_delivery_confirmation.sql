-- Phase 4.4.6.3: customer delivery confirmation, admin fallback and atomic inventory settlement.
-- Only the two supported interfaces can complete delivery: the order owner or owner/admin.
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
  v_is_admin boolean := false;
  v_allowed boolean := false;
  v_note text;
  v_inventory record;
  v_reserved integer;
  v_settled_rows integer := 0;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
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

  -- Serialize all competing customer/admin transitions on the order row.
  SELECT o.* INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  v_is_admin := private.is_admin_or_owner();
  IF NOT v_is_admin AND NOT (
    v_order.customer_id = v_actor
    AND p_next_status = 'delivered'
    AND p_note IS NULL
    AND v_order.status IN ('out_for_delivery', 'delivered')
  ) THEN
    RAISE EXCEPTION 'Not authorized to manage this order' USING ERRCODE = '42501';
  END IF;

  IF v_order.order_type <> 'one_time' OR v_order.payment_method <> 'cod' THEN
    RAISE EXCEPTION 'Only one-time COD orders can use this fulfillment workflow' USING ERRCODE = '23514';
  END IF;

  -- Repeated customer/admin completion is a no-op; inventory is never settled twice.
  IF v_order.status = p_next_status THEN
    RETURN QUERY SELECT v_order.id, v_order.status, v_order.status, true;
    RETURN;
  END IF;

  v_allowed := CASE v_order.status
    WHEN 'pending_confirmation' THEN p_next_status = 'confirmed' AND v_is_admin
    WHEN 'confirmed' THEN p_next_status = 'processing' AND v_is_admin
    WHEN 'processing' THEN p_next_status = 'out_for_delivery' AND v_is_admin
    WHEN 'out_for_delivery' THEN p_next_status = 'delivered'
    ELSE false
  END;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid order status transition: % -> %', v_order.status, p_next_status
      USING ERRCODE = '23514';
  END IF;

  IF p_next_status = 'delivered' THEN
    -- Reservation ledger is the source of truth. Consume each outstanding reservation
    -- once, decrementing both on-hand and reserved counters under deterministic row locks.
    FOR v_inventory IN
      SELECT i.id, i.available_stock, i.reserved_stock
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

      IF v_reserved < 0
         OR v_inventory.reserved_stock < v_reserved
         OR v_inventory.available_stock < v_reserved THEN
        RAISE EXCEPTION 'Order inventory reservation is inconsistent; delivery was not completed'
          USING ERRCODE = '23514';
      END IF;

      IF v_reserved > 0 THEN
        UPDATE public.inventory
        SET available_stock = available_stock - v_reserved,
            reserved_stock = reserved_stock - v_reserved,
            updated_at = pg_catalog.now()
        WHERE id = v_inventory.id;

        INSERT INTO public.inventory_movements(
          inventory_id, change_amount, movement_type, reference_id, notes, created_by
        ) VALUES (
          v_inventory.id, -v_reserved, 'order_fulfilled', p_order_id::text,
          'Order delivered; consume reserved stock', v_actor
        );
        v_settled_rows := v_settled_rows + 1;
      END IF;
    END LOOP;

    IF v_settled_rows = 0 THEN
      RAISE EXCEPTION 'Order inventory reservation is missing; delivery was not completed'
        USING ERRCODE = '23514';
    END IF;

    IF NOT v_is_admin THEN
      v_note := 'Customer confirmed delivery';
    END IF;
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

-- Delivery assignments are retained only as a legacy/admin-managed table. There is no
-- worker interface, worker role, route assignment flow or manager/operations access.
DROP POLICY IF EXISTS delivery_assignments_staff ON public.delivery_assignments;
CREATE POLICY delivery_assignments_owner_admin
ON public.delivery_assignments
FOR ALL
TO authenticated
USING ((SELECT private.is_admin_or_owner()))
WITH CHECK ((SELECT private.is_admin_or_owner()));

COMMENT ON FUNCTION public.transition_one_time_cod_order(uuid, public.order_status_enum, text) IS
'Owner/admin-only forward fulfillment transitions plus owner-customer delivery confirmation from out_for_delivery. Delivery settlement atomically consumes the order reservation exactly once; COD remains pending and no cash collection is recorded.';
