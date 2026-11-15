-- Phase 4.5.1: secure recording of delivered one-time COD cash.
-- Delivery staff may record only orders explicitly linked to their own active route.
-- Owner/admin may record as an operational fallback. Verification/reconciliation
-- is deliberately deferred to Phase 4.5.2; this RPC never marks payment captured.

BEGIN;

CREATE TABLE IF NOT EXISTS public.delivery_assignment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_assignment_id uuid NOT NULL
    REFERENCES public.delivery_assignments(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL
    REFERENCES public.orders(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT uq_delivery_assignment_orders_order UNIQUE (order_id),
  CONSTRAINT uq_delivery_assignment_orders_pair
    UNIQUE (delivery_assignment_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_assignment_orders_assignment
  ON public.delivery_assignment_orders(delivery_assignment_id);

ALTER TABLE public.delivery_assignment_orders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.delivery_assignment_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.delivery_assignment_orders TO authenticated;
GRANT ALL ON TABLE public.delivery_assignment_orders TO service_role;

DROP POLICY IF EXISTS delivery_assignment_orders_admin_select ON public.delivery_assignment_orders;
CREATE POLICY delivery_assignment_orders_admin_select
  ON public.delivery_assignment_orders FOR SELECT TO authenticated
  USING ((SELECT public.is_admin_or_owner()));

DROP POLICY IF EXISTS delivery_assignment_orders_admin_insert ON public.delivery_assignment_orders;
CREATE POLICY delivery_assignment_orders_admin_insert
  ON public.delivery_assignment_orders FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin_or_owner())
    AND assigned_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS delivery_assignment_orders_admin_delete ON public.delivery_assignment_orders;
CREATE POLICY delivery_assignment_orders_admin_delete
  ON public.delivery_assignment_orders FOR DELETE TO authenticated
  USING ((SELECT public.is_admin_or_owner()));

ALTER TABLE public.cod_collections
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS delivery_assignment_id uuid
    REFERENCES public.delivery_assignments(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS collection_note text;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.cod_collections
    GROUP BY order_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Phase 4.5.1 preflight failed: duplicate COD collection rows exist per order; reconcile before migration';
  END IF;
END;
$preflight$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cod_collections_order
  ON public.cod_collections(order_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cod_collections_idempotency
  ON public.cod_collections(order_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cod_collections_collected_by_date
  ON public.cod_collections(collected_by_staff_id, collected_at DESC);

COMMENT ON TABLE public.delivery_assignment_orders IS
  'Owner/admin-managed normalized order membership for delivery routes. A delivery staff member may record COD only for an order linked to their own assignment.';
COMMENT ON COLUMN public.cod_collections.idempotency_key IS
  'Client-generated UUID used only to safely retry the initial cash-recording request.';
COMMENT ON COLUMN public.cod_collections.delivery_assignment_id IS
  'Route assignment under which the collector received cash; NULL only for owner/admin fallback recording.';
COMMENT ON COLUMN public.cod_collections.collection_note IS
  'Collector-supplied factual note; verification/discrepancy decisions are separate owner/admin actions.';

-- Collection records are server/RPC managed. No client-side direct INSERT/UPDATE/DELETE.
REVOKE ALL ON TABLE public.cod_collections FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.cod_collections TO service_role;
GRANT ALL ON TABLE public.cod_collections TO service_role;

CREATE OR REPLACE FUNCTION private.record_cod_cash_collection(
  p_order_id uuid,
  p_amount_collected_paise integer,
  p_idempotency_key uuid,
  p_delivery_assignment_id uuid DEFAULT NULL,
  p_collection_note text DEFAULT NULL
)
RETURNS TABLE(
  collection_id uuid,
  order_id uuid,
  amount_collected_paise integer,
  order_total_paise integer,
  was_replayed boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_is_admin boolean;
  v_order public.orders%ROWTYPE;
  v_existing public.cod_collections%ROWTYPE;
  v_assignment public.delivery_assignments%ROWTYPE;
  v_collection_id uuid;
  v_note text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_is_admin := private.is_admin_or_owner();

  IF p_order_id IS NULL OR p_idempotency_key IS NULL
     OR p_amount_collected_paise IS NULL OR p_amount_collected_paise <= 0 THEN
    RAISE EXCEPTION 'Order, positive cash amount and idempotency key are required'
      USING ERRCODE = '22023';
  END IF;

  IF p_collection_note IS NOT NULL AND pg_catalog.length(p_collection_note) > 500 THEN
    RAISE EXCEPTION 'Collection note must be 500 characters or fewer'
      USING ERRCODE = '22023';
  END IF;
  v_note := NULLIF(pg_catalog.btrim(p_collection_note), '');

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('cod-collection:' || p_order_id::text, 0)
  );

  SELECT o.* INTO v_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.order_type <> 'one_time'
     OR v_order.payment_method <> 'cod'
     OR v_order.status <> 'delivered'
     OR v_order.payment_status <> 'pending' THEN
    RAISE EXCEPTION 'Only delivered, unpaid one-time COD orders can record cash'
      USING ERRCODE = '23514';
  END IF;

  SELECT c.* INTO v_existing
  FROM public.cod_collections AS c
  WHERE c.order_id = p_order_id;

  IF FOUND THEN
    IF v_existing.idempotency_key = p_idempotency_key
       AND v_existing.collected_by_staff_id = v_actor
       AND v_existing.amount_collected_paise = p_amount_collected_paise
       AND v_existing.delivery_assignment_id IS NOT DISTINCT FROM p_delivery_assignment_id
       AND v_existing.collection_note IS NOT DISTINCT FROM v_note THEN
      RETURN QUERY SELECT v_existing.id, v_existing.order_id,
        v_existing.amount_collected_paise, v_order.total_paise, true;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Cash collection has already been recorded for this order'
      USING ERRCODE = '23505';
  END IF;

  IF NOT v_is_admin THEN
    IF p_delivery_assignment_id IS NULL THEN
      RAISE EXCEPTION 'Assigned delivery route is required for delivery staff'
        USING ERRCODE = '42501';
    END IF;

    SELECT da.* INTO v_assignment
    FROM public.delivery_assignment_orders AS dao
    JOIN public.delivery_assignments AS da
      ON da.id = dao.delivery_assignment_id
    WHERE dao.order_id = p_order_id
      AND dao.delivery_assignment_id = p_delivery_assignment_id
      AND da.staff_id = v_actor
      AND da.status IN ('assigned', 'in_progress', 'completed')
      AND da.delivery_date = v_order.delivery_date
      AND da.delivery_slot_id = v_order.delivery_slot_id
      AND da.service_area_id = v_order.service_area_id
    FOR SHARE OF da;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order is not assigned to this delivery staff member'
        USING ERRCODE = '42501';
    END IF;
  ELSIF p_delivery_assignment_id IS NOT NULL THEN
    SELECT da.* INTO v_assignment
    FROM public.delivery_assignment_orders AS dao
    JOIN public.delivery_assignments AS da
      ON da.id = dao.delivery_assignment_id
    WHERE dao.order_id = p_order_id
      AND dao.delivery_assignment_id = p_delivery_assignment_id
      AND da.delivery_date = v_order.delivery_date
      AND da.delivery_slot_id = v_order.delivery_slot_id
      AND da.service_area_id = v_order.service_area_id
    FOR SHARE OF da;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Provided delivery assignment does not match this order'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  INSERT INTO public.cod_collections(
    order_id,
    collected_by_staff_id,
    amount_collected_paise,
    collected_at,
    status,
    idempotency_key,
    delivery_assignment_id,
    collection_note
  )
  VALUES (
    p_order_id,
    v_actor,
    p_amount_collected_paise,
    pg_catalog.now(),
    'collected',
    p_idempotency_key,
    p_delivery_assignment_id,
    v_note
  )
  RETURNING id INTO v_collection_id;

  INSERT INTO public.audit_logs(
    user_id, action, table_name, record_id, old_values, new_values
  )
  VALUES (
    v_actor,
    'cod_cash_collection_recorded',
    'cod_collections',
    v_collection_id::text,
    NULL,
    pg_catalog.jsonb_build_object(
      'order_id', p_order_id,
      'amount_collected_paise', p_amount_collected_paise,
      'delivery_assignment_id', p_delivery_assignment_id,
      'status', 'collected'
    )
  );

  -- Deliberately do not update payments.status or orders.payment_status here.
  RETURN QUERY SELECT v_collection_id, p_order_id,
    p_amount_collected_paise, v_order.total_paise, false;
END;
$function$;

REVOKE ALL ON FUNCTION private.record_cod_cash_collection(uuid,integer,uuid,uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_cod_cash_collection(
  p_order_id uuid,
  p_amount_collected_paise integer,
  p_idempotency_key uuid,
  p_delivery_assignment_id uuid DEFAULT NULL,
  p_collection_note text DEFAULT NULL
)
RETURNS TABLE(
  collection_id uuid,
  order_id uuid,
  amount_collected_paise integer,
  order_total_paise integer,
  was_replayed boolean
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $wrapper$
  SELECT * FROM private.record_cod_cash_collection(
    p_order_id,
    p_amount_collected_paise,
    p_idempotency_key,
    p_delivery_assignment_id,
    p_collection_note
  );
$wrapper$;

REVOKE ALL ON FUNCTION public.record_cod_cash_collection(uuid,integer,uuid,uuid,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_cod_cash_collection(uuid,integer,uuid,uuid,text)
  TO authenticated;

COMMENT ON FUNCTION public.record_cod_cash_collection(uuid,integer,uuid,uuid,text) IS
'Records one initial cash-on-delivery collection for a delivered one-time COD order. Assigned delivery staff may record only their linked route order; owner/admin may record as fallback. Idempotent; amount discrepancies remain pending for separate owner/admin reconciliation and payment is not marked captured.';

COMMIT;
