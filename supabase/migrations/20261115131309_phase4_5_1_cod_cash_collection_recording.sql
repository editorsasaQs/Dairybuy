-- Phase 4.5.1: authorized delivery assignment and COD cash collection recording.
-- Cash collection is recorded separately from payment settlement.
-- Only an assigned delivery agent or owner/admin may record received cash.
-- Owner/admin verification and reconciliation are implemented in later Phase 4.5 slices.

BEGIN;

ALTER TABLE public.cod_collections
  ADD COLUMN IF NOT EXISTS receipt_reference text,
  ADD COLUMN IF NOT EXISTS collection_notes text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cod_collections_one_record_per_order
  ON public.cod_collections(order_id);

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.cod_collections'::regclass
      AND conname='cod_collections_status_check'
  ) THEN
    ALTER TABLE public.cod_collections
      ADD CONSTRAINT cod_collections_status_check
      CHECK (status IN ('collected','verified','disputed'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.cod_collections'::regclass
      AND conname='cod_collections_receipt_reference_length'
  ) THEN
    ALTER TABLE public.cod_collections
      ADD CONSTRAINT cod_collections_receipt_reference_length
      CHECK (receipt_reference IS NULL OR length(receipt_reference) <= 120);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.cod_collections'::regclass
      AND conname='cod_collections_notes_length'
  ) THEN
    ALTER TABLE public.cod_collections
      ADD CONSTRAINT cod_collections_notes_length
      CHECK (collection_notes IS NULL OR length(collection_notes) <= 500);
  END IF;
END;
$constraints$;

-- Explicit normalized assignment-to-order link. The legacy route_order JSON
-- remains untouched; this relation is the authorization source for cash entry.
CREATE TABLE IF NOT EXISTS public.delivery_assignment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_assignment_id uuid NOT NULL
    REFERENCES public.delivery_assignments(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL
    REFERENCES public.orders(id) ON DELETE RESTRICT,
  assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_delivery_assignment_orders_order UNIQUE(order_id),
  CONSTRAINT uq_delivery_assignment_orders_pair UNIQUE(delivery_assignment_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_assignment_orders_assignment
  ON public.delivery_assignment_orders(delivery_assignment_id);

-- The new table is created with RLS by the repository's public-table event trigger.
-- No direct API table grants or policies are added: writes/reads happen inside
-- the narrowly authorized SECURITY DEFINER RPCs only.
REVOKE ALL ON TABLE public.delivery_assignment_orders
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.cod_collections
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.assign_cod_order_to_delivery(
  p_delivery_assignment_id uuid,
  p_order_id uuid
)
RETURNS TABLE(assignment_order_id uuid, order_id uuid, delivery_assignment_id uuid)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_assignment public.delivery_assignments%ROWTYPE;
  v_link uuid;
BEGIN
  IF v_actor IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only owner/admin can assign COD orders to delivery staff'
      USING ERRCODE='42501';
  END IF;
  IF p_delivery_assignment_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'Delivery assignment and order are required' USING ERRCODE='22023';
  END IF;

  SELECT o.* INTO v_order
  FROM public.orders o
  WHERE o.id=p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE='P0002';
  END IF;

  IF v_order.order_type<>'one_time' OR v_order.payment_method<>'cod' THEN
    RAISE EXCEPTION 'Only one-time COD orders can be assigned for cash collection'
      USING ERRCODE='23514';
  END IF;
  IF v_order.status NOT IN ('confirmed','processing','out_for_delivery') THEN
    RAISE EXCEPTION 'COD order must be confirmed or in fulfillment before assignment'
      USING ERRCODE='23514';
  END IF;

  SELECT da.* INTO v_assignment
  FROM public.delivery_assignments da
  WHERE da.id=p_delivery_assignment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery assignment not found' USING ERRCODE='P0002';
  END IF;
  IF v_assignment.status NOT IN ('assigned','in_progress')
     OR v_assignment.delivery_date<>v_order.delivery_date
     OR v_assignment.delivery_slot_id<>v_order.delivery_slot_id
     OR v_assignment.service_area_id<>v_order.service_area_id THEN
    RAISE EXCEPTION 'Delivery assignment does not match the order date, slot, area or active status'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO public.delivery_assignment_orders(
    delivery_assignment_id,order_id,assigned_by
  ) VALUES (p_delivery_assignment_id,p_order_id,v_actor)
  RETURNING id INTO v_link;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,old_values,new_values)
  VALUES (
    v_actor,'cod_order.delivery_assigned','delivery_assignment_orders',v_link::text,NULL,
    pg_catalog.jsonb_build_object(
      'order_id',p_order_id,
      'delivery_assignment_id',p_delivery_assignment_id,
      'staff_id',v_assignment.staff_id
    )
  );

  RETURN QUERY SELECT v_link,p_order_id,p_delivery_assignment_id;
END;
$function$;

REVOKE ALL ON FUNCTION private.assign_cod_order_to_delivery(uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.assign_cod_order_to_delivery(
  p_delivery_assignment_id uuid,
  p_order_id uuid
)
RETURNS TABLE(assignment_order_id uuid, order_id uuid, delivery_assignment_id uuid)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $wrapper$
  SELECT * FROM private.assign_cod_order_to_delivery(
    p_delivery_assignment_id,p_order_id
  );
$wrapper$;

REVOKE ALL ON FUNCTION public.assign_cod_order_to_delivery(uuid,uuid)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.assign_cod_order_to_delivery(uuid,uuid)
  TO authenticated;

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
  v_assignment_authorized boolean := false;
  v_collection_id uuid;
  v_status text;
  v_receipt text;
  v_notes text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
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

  IF v_order.order_type<>'one_time' OR v_order.payment_method<>'cod' THEN
    RAISE EXCEPTION 'Only one-time COD orders accept cash collection records'
      USING ERRCODE='23514';
  END IF;
  IF v_order.status<>'delivered' THEN
    RAISE EXCEPTION 'COD cash can be recorded only after delivery is confirmed'
      USING ERRCODE='23514';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.delivery_assignment_orders dao
    JOIN public.delivery_assignments da
      ON da.id=dao.delivery_assignment_id
    WHERE dao.order_id=p_order_id
      AND da.staff_id=v_actor
      AND da.status IN ('assigned','in_progress','completed')
  ) INTO v_assignment_authorized;

  IF NOT private.is_admin_or_owner() AND NOT v_assignment_authorized THEN
    RAISE EXCEPTION 'Only the assigned delivery staff or owner/admin can record this collection'
      USING ERRCODE='42501';
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
  -- is a separate audited action in the next Phase 4.5 implementation slice.
  RETURN QUERY SELECT v_collection_id,p_order_id,
    p_amount_collected_paise,v_status,false;
END;
$function$;

REVOKE ALL ON FUNCTION private.record_cod_cash_collection(uuid,integer,text,text)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.record_cod_cash_collection(
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
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $wrapper$
  SELECT * FROM private.record_cod_cash_collection(
    p_order_id,p_amount_collected_paise,p_receipt_reference,p_collection_notes
  );
$wrapper$;

REVOKE ALL ON FUNCTION public.record_cod_cash_collection(uuid,integer,text,text)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.record_cod_cash_collection(uuid,integer,text,text)
  TO authenticated;

COMMENT ON FUNCTION public.record_cod_cash_collection(uuid,integer,text,text) IS
'Records cash received for a delivered one-time COD order. Assigned delivery staff may record only their assigned orders; owner/admin may record any eligible order. Amount mismatches are flagged disputed. Payment remains pending until owner/admin verification.';

COMMIT;
