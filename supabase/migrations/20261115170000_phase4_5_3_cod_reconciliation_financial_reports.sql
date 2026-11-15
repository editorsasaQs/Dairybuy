-- Phase 4.5.3–4.5.5: COD discrepancy correction, staff cash handover and financial reporting.
-- All money is integer paise. This migration is additive and never mutates hosted projects.
BEGIN;

CREATE TABLE IF NOT EXISTS public.cod_collection_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.cod_collections(id) ON DELETE RESTRICT,
  old_amount_paise integer NOT NULL CHECK (old_amount_paise > 0),
  new_amount_paise integer NOT NULL CHECK (new_amount_paise > 0),
  reason text NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(reason)) BETWEEN 5 AND 500),
  evidence_reference text CHECK (evidence_reference IS NULL OR pg_catalog.length(evidence_reference) <= 200),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cod_collection_adjustments_amount_changed CHECK (old_amount_paise <> new_amount_paise)
);
CREATE INDEX IF NOT EXISTS idx_cod_collection_adjustments_collection_created
  ON public.cod_collection_adjustments(collection_id, created_at DESC);
REVOKE ALL ON TABLE public.cod_collection_adjustments FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.delivery_cash_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_number text NOT NULL UNIQUE,
  idempotency_key uuid NOT NULL UNIQUE,
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  business_date date NOT NULL,
  delivery_slot_id uuid NOT NULL REFERENCES public.delivery_slots(id) ON DELETE RESTRICT,
  service_area_id uuid NOT NULL REFERENCES public.service_areas(id) ON DELETE RESTRICT,
  expected_amount_paise bigint NOT NULL CHECK (expected_amount_paise > 0),
  received_amount_paise bigint NOT NULL CHECK (received_amount_paise >= 0),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','accepted','disputed')),
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  review_note text CHECK (review_note IS NULL OR pg_catalog.length(review_note) <= 500),
  CONSTRAINT delivery_cash_handovers_review_state CHECK (
    (status = 'submitted' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status IN ('accepted','disputed') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_delivery_cash_handovers_staff_date
  ON public.delivery_cash_handovers(staff_id, business_date DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_cash_handovers_area_date
  ON public.delivery_cash_handovers(service_area_id, business_date DESC);

CREATE TABLE IF NOT EXISTS public.delivery_cash_handover_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES public.delivery_cash_handovers(id) ON DELETE RESTRICT,
  collection_id uuid NOT NULL UNIQUE REFERENCES public.cod_collections(id) ON DELETE RESTRICT,
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_delivery_cash_handover_item UNIQUE(handover_id, collection_id)
);
CREATE INDEX IF NOT EXISTS idx_delivery_cash_handover_items_handover
  ON public.delivery_cash_handover_items(handover_id);
REVOKE ALL ON TABLE public.delivery_cash_handovers, public.delivery_cash_handover_items
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.resolve_cod_collection_discrepancy(
  p_order_id uuid,
  p_corrected_amount_paise integer,
  p_reason text,
  p_evidence_reference text DEFAULT NULL
)
RETURNS TABLE(collection_id uuid, order_id uuid, collection_status text,
  payment_status public.payment_status_enum, was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_collection public.cod_collections%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_existing public.cod_collection_adjustments%ROWTYPE;
  v_reason text := NULLIF(pg_catalog.btrim(p_reason),'');
  v_evidence text := NULLIF(pg_catalog.btrim(p_evidence_reference),'');
  v_payment_count integer;
BEGIN
  IF v_actor IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only owner/admin can resolve COD discrepancies' USING ERRCODE='42501';
  END IF;
  IF p_order_id IS NULL OR p_corrected_amount_paise IS NULL OR p_corrected_amount_paise <= 0
     OR v_reason IS NULL OR pg_catalog.length(v_reason) < 5 OR pg_catalog.length(v_reason) > 500
     OR (p_evidence_reference IS NOT NULL AND pg_catalog.length(p_evidence_reference) > 200) THEN
    RAISE EXCEPTION 'Valid order, positive amount, reason and evidence are required' USING ERRCODE='22023';
  END IF;

  SELECT o.* INTO v_order FROM public.orders o WHERE o.id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE='P0002'; END IF;
  IF v_order.order_type <> 'one_time' OR v_order.payment_method <> 'cod' OR v_order.status <> 'delivered' THEN
    RAISE EXCEPTION 'Only delivered one-time COD orders can be adjusted' USING ERRCODE='23514';
  END IF;

  SELECT c.* INTO v_collection FROM public.cod_collections c
  WHERE c.order_id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COD collection not found' USING ERRCODE='P0002'; END IF;

  SELECT count(*)::integer INTO v_payment_count FROM public.payments p WHERE p.order_id=p_order_id;
  IF v_payment_count <> 1 THEN RAISE EXCEPTION 'Exactly one COD payment is required' USING ERRCODE='23514'; END IF;
  SELECT p.* INTO v_payment FROM public.payments p WHERE p.order_id=p_order_id FOR UPDATE;
  IF v_payment.gateway <> 'cod' OR v_payment.amount_paise <> v_order.total_paise THEN
    RAISE EXCEPTION 'COD payment does not match authoritative order total' USING ERRCODE='23514';
  END IF;

  SELECT a.* INTO v_existing FROM public.cod_collection_adjustments a
  WHERE a.collection_id=v_collection.id AND a.new_amount_paise=p_corrected_amount_paise
    AND a.reason=v_reason AND COALESCE(a.evidence_reference,'')=COALESCE(v_evidence,'')
  ORDER BY a.created_at DESC LIMIT 1;
  IF FOUND AND v_collection.amount_collected_paise=p_corrected_amount_paise THEN
    RETURN QUERY SELECT v_collection.id,p_order_id,v_collection.status,v_payment.status,true;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.delivery_cash_handover_items hi
      JOIN public.delivery_cash_handovers h ON h.id=hi.handover_id
      WHERE hi.collection_id=v_collection.id AND h.status IN ('submitted','accepted')) THEN
    RAISE EXCEPTION 'Collection cannot be adjusted after cash handover submission' USING ERRCODE='23514';
  END IF;

  IF v_collection.status NOT IN ('disputed','rejected') OR v_payment.status <> 'pending'
     OR v_order.payment_status <> 'pending' THEN
    RAISE EXCEPTION 'Only unresolved disputed/rejected collections with pending payment can be adjusted' USING ERRCODE='23514';
  END IF;

  SELECT a.* INTO v_existing FROM public.cod_collection_adjustments a
  WHERE a.collection_id=v_collection.id AND a.new_amount_paise=p_corrected_amount_paise
    AND a.reason=v_reason AND COALESCE(a.evidence_reference,'')=COALESCE(v_evidence,'')
  ORDER BY a.created_at DESC LIMIT 1;
  IF FOUND AND v_collection.amount_collected_paise=p_corrected_amount_paise THEN
    RETURN QUERY SELECT v_collection.id,p_order_id,v_collection.status,v_payment.status,true;
    RETURN;
  END IF;

  INSERT INTO public.cod_collection_adjustments(
    collection_id,old_amount_paise,new_amount_paise,reason,evidence_reference,created_by
  ) VALUES (
    v_collection.id,v_collection.amount_collected_paise,p_corrected_amount_paise,v_reason,v_evidence,v_actor
  );

  UPDATE public.cod_collections SET amount_collected_paise=p_corrected_amount_paise,
    status=CASE WHEN p_corrected_amount_paise=v_order.total_paise THEN 'collected' ELSE 'disputed' END,
    verified_by_manager_id=NULL, verified_at=NULL,
    rejected_by_manager_id=NULL, rejected_at=NULL, rejection_reason=NULL
  WHERE id=v_collection.id;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,old_values,new_values)
  VALUES (v_actor,'cod_collection.adjusted','cod_collections',v_collection.id::text,
    pg_catalog.jsonb_build_object('amount_collected_paise',v_collection.amount_collected_paise,'status',v_collection.status),
    pg_catalog.jsonb_build_object('amount_collected_paise',p_corrected_amount_paise,
      'status',CASE WHEN p_corrected_amount_paise=v_order.total_paise THEN 'collected' ELSE 'disputed' END,
      'reason',v_reason,'evidence_reference',v_evidence));

  IF p_corrected_amount_paise=v_order.total_paise THEN
    PERFORM * FROM private.review_cod_cash_collection(p_order_id,'verify',v_reason);
    RETURN QUERY SELECT v_collection.id,p_order_id,'verified'::text,'captured'::public.payment_status_enum,false;
  ELSE
    RETURN QUERY SELECT v_collection.id,p_order_id,'disputed'::text,'pending'::public.payment_status_enum,false;
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION private.resolve_cod_collection_discrepancy(uuid,integer,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.resolve_cod_collection_discrepancy(
  p_order_id uuid,p_corrected_amount_paise integer,p_reason text,p_evidence_reference text DEFAULT NULL
)
RETURNS TABLE(collection_id uuid,order_id uuid,collection_status text,
  payment_status public.payment_status_enum,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $wrapper$
  SELECT * FROM private.resolve_cod_collection_discrepancy(
    p_order_id,p_corrected_amount_paise,p_reason,p_evidence_reference
  );
$wrapper$;
REVOKE ALL ON FUNCTION public.resolve_cod_collection_discrepancy(uuid,integer,text,text)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.resolve_cod_collection_discrepancy(uuid,integer,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.submit_delivery_cash_handover(
  p_collection_ids uuid[], p_received_amount_paise integer, p_idempotency_key uuid
)
RETURNS TABLE(handover_id uuid,handover_number text,expected_amount_paise bigint,
  received_amount_paise bigint,handover_status text,was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_existing public.delivery_cash_handovers%ROWTYPE;
  v_first public.orders%ROWTYPE;
  v_collection public.cod_collections%ROWTYPE;
  v_expected bigint := 0;
  v_count integer := 0;
  v_slot uuid;
  v_area uuid;
  v_date date;
  v_handover_id uuid;
  v_number text;
  v_collection_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_collection_ids IS NULL OR cardinality(p_collection_ids)<1 OR cardinality(p_collection_ids)>200
     OR p_received_amount_paise IS NULL OR p_received_amount_paise<0 OR p_idempotency_key IS NULL
     OR cardinality(p_collection_ids)<>(SELECT count(DISTINCT u.collection_id)::integer FROM unnest(p_collection_ids) AS u(collection_id)) THEN
    RAISE EXCEPTION 'Valid unique collection IDs, received amount and idempotency key are required' USING ERRCODE='22023';
  END IF;
  SELECT h.* INTO v_existing FROM public.delivery_cash_handovers h WHERE h.idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_existing.staff_id=v_actor THEN
      RETURN QUERY SELECT v_existing.id,v_existing.handover_number,v_existing.expected_amount_paise,
        v_existing.received_amount_paise,v_existing.status,true;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Handover idempotency key belongs to another staff member' USING ERRCODE='42501';
  END IF;

  FOREACH v_collection_id IN ARRAY p_collection_ids LOOP
    SELECT c.* INTO v_collection FROM public.cod_collections c
      WHERE c.id=v_collection_id;
    IF NOT FOUND OR v_collection.collected_by_staff_id<>v_actor THEN
      RAISE EXCEPTION 'Every collection must belong to the authenticated delivery staff' USING ERRCODE='42501';
    END IF;
    SELECT o.* INTO v_first FROM public.orders o WHERE o.id=v_collection.order_id FOR UPDATE;
    IF NOT FOUND OR v_first.order_type<>'one_time' OR v_first.payment_method<>'cod'
       OR v_first.status<>'delivered' THEN
      RAISE EXCEPTION 'Only delivered one-time COD collections can be handed over' USING ERRCODE='23514';
    END IF;
    SELECT c.* INTO v_collection FROM public.cod_collections c
      WHERE c.id=v_collection_id FOR UPDATE;
    IF v_collection.collected_by_staff_id<>v_actor THEN
      RAISE EXCEPTION 'Collection ownership changed during handover submission' USING ERRCODE='42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.delivery_assignment_orders dao
      JOIN public.delivery_assignments da ON da.id=dao.delivery_assignment_id
      WHERE dao.order_id=v_first.id AND da.staff_id=v_actor
        AND da.delivery_date=v_first.delivery_date
        AND da.delivery_slot_id=v_first.delivery_slot_id
        AND da.service_area_id=v_first.service_area_id
    ) THEN RAISE EXCEPTION 'Collection is not linked to the staff delivery assignment' USING ERRCODE='42501'; END IF;

    IF v_count=0 THEN
      v_date:=v_first.delivery_date; v_slot:=v_first.delivery_slot_id; v_area:=v_first.service_area_id;
    ELSIF v_date<>v_first.delivery_date OR v_slot<>v_first.delivery_slot_id OR v_area<>v_first.service_area_id THEN
      RAISE EXCEPTION 'A handover batch must use one delivery date, slot and service area' USING ERRCODE='22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.delivery_cash_handover_items i WHERE i.collection_id=v_collection.id) THEN
      RAISE EXCEPTION 'A collection has already been submitted in a handover batch' USING ERRCODE='23505';
    END IF;
    v_expected:=v_expected+v_collection.amount_collected_paise;
    v_count:=v_count+1;
  END LOOP;

  v_handover_id:=gen_random_uuid();
  v_number:='DBH-'||to_char(clock_timestamp() AT TIME ZONE 'Asia/Kolkata','YYYYMMDD')||'-'||upper(substr(replace(v_handover_id::text,'-',''),1,8));
  INSERT INTO public.delivery_cash_handovers(id,handover_number,idempotency_key,staff_id,business_date,
    delivery_slot_id,service_area_id,expected_amount_paise,received_amount_paise,submitted_by,status)
  VALUES(v_handover_id,v_number,p_idempotency_key,v_actor,v_date,v_slot,v_area,v_expected,
    p_received_amount_paise,v_actor,'submitted');

  INSERT INTO public.delivery_cash_handover_items(handover_id,collection_id,amount_paise)
  SELECT v_handover_id,c.id,c.amount_collected_paise
  FROM public.cod_collections c WHERE c.id=ANY(p_collection_ids);

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,old_values,new_values)
  VALUES(v_actor,'cod_cash_handover.submitted','delivery_cash_handovers',v_handover_id::text,NULL,
    pg_catalog.jsonb_build_object('handover_number',v_number,'staff_id',v_actor,
      'expected_amount_paise',v_expected,'received_amount_paise',p_received_amount_paise,
      'collection_count',v_count,'status','submitted'));

  RETURN QUERY SELECT v_handover_id,v_number,v_expected,p_received_amount_paise,'submitted'::text,false;
END;
$function$;
REVOKE ALL ON FUNCTION private.submit_delivery_cash_handover(uuid[],integer,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.submit_delivery_cash_handover(
  p_collection_ids uuid[],p_received_amount_paise integer,p_idempotency_key uuid
)
RETURNS TABLE(handover_id uuid,handover_number text,expected_amount_paise bigint,
  received_amount_paise bigint,handover_status text,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $wrapper$
  SELECT * FROM private.submit_delivery_cash_handover(p_collection_ids,p_received_amount_paise,p_idempotency_key);
$wrapper$;
REVOKE ALL ON FUNCTION public.submit_delivery_cash_handover(uuid[],integer,uuid)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.submit_delivery_cash_handover(uuid[],integer,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.review_delivery_cash_handover(
  p_handover_id uuid,p_decision text,p_note text DEFAULT NULL
)
RETURNS TABLE(handover_id uuid,handover_status text,was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_actor uuid:=auth.uid();
  v_handover public.delivery_cash_handovers%ROWTYPE;
  v_note text:=NULLIF(pg_catalog.btrim(p_note),'');
BEGIN
  IF v_actor IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only owner/admin can review cash handovers' USING ERRCODE='42501';
  END IF;
  IF p_handover_id IS NULL OR p_decision IS NULL OR p_decision NOT IN ('accept','dispute')
     OR (p_decision='dispute' AND (v_note IS NULL OR pg_catalog.length(v_note)<5))
     OR (p_note IS NOT NULL AND pg_catalog.length(p_note)>500) THEN
    RAISE EXCEPTION 'Valid handover decision and reason are required' USING ERRCODE='22023';
  END IF;
  SELECT h.* INTO v_handover FROM public.delivery_cash_handovers h
    WHERE h.id=p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Handover not found' USING ERRCODE='P0002'; END IF;
  IF v_handover.status = (CASE WHEN p_decision='accept' THEN 'accepted' ELSE 'disputed' END) THEN
    RETURN QUERY SELECT v_handover.id,v_handover.status,true; RETURN;
  END IF;
  IF v_handover.status<>'submitted' THEN
    RAISE EXCEPTION 'Handover has already been reviewed with a different decision' USING ERRCODE='23514';
  END IF;
  IF p_decision='accept' AND v_handover.received_amount_paise<>v_handover.expected_amount_paise THEN
    RAISE EXCEPTION 'Cash received must exactly match the expected handover amount' USING ERRCODE='23514';
  END IF;
  UPDATE public.delivery_cash_handovers SET status=CASE WHEN p_decision='accept' THEN 'accepted' ELSE 'disputed' END,
    reviewed_by=v_actor,reviewed_at=now(),review_note=v_note WHERE id=v_handover.id;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,old_values,new_values)
  VALUES(v_actor,'cod_cash_handover.'||CASE WHEN p_decision='accept' THEN 'accepted' ELSE 'disputed' END,
    'delivery_cash_handovers',v_handover.id::text,
    pg_catalog.jsonb_build_object('status',v_handover.status),
    pg_catalog.jsonb_build_object('status',CASE WHEN p_decision='accept' THEN 'accepted' ELSE 'disputed' END,
      'expected_amount_paise',v_handover.expected_amount_paise,
      'received_amount_paise',v_handover.received_amount_paise,'note',v_note));
  RETURN QUERY SELECT v_handover.id,
    CASE WHEN p_decision='accept' THEN 'accepted' ELSE 'disputed' END,false;
END;
$function$;
REVOKE ALL ON FUNCTION private.review_delivery_cash_handover(uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.review_delivery_cash_handover(
  p_handover_id uuid,p_decision text,p_note text DEFAULT NULL
)
RETURNS TABLE(handover_id uuid,handover_status text,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $wrapper$
  SELECT * FROM private.review_delivery_cash_handover(p_handover_id,p_decision,p_note);
$wrapper$;
REVOKE ALL ON FUNCTION public.review_delivery_cash_handover(uuid,text,text)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.review_delivery_cash_handover(uuid,text,text) TO authenticated;


-- A disputed handover can be corrected only by an owner/admin after recount.
CREATE TABLE IF NOT EXISTS public.delivery_cash_handover_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES public.delivery_cash_handovers(id) ON DELETE RESTRICT,
  old_received_amount_paise bigint NOT NULL CHECK (old_received_amount_paise >= 0),
  new_received_amount_paise bigint NOT NULL CHECK (new_received_amount_paise >= 0),
  reason text NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(reason)) BETWEEN 5 AND 500),
  evidence_reference text CHECK (evidence_reference IS NULL OR pg_catalog.length(evidence_reference) <= 200),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (old_received_amount_paise <> new_received_amount_paise)
);
CREATE INDEX IF NOT EXISTS idx_cash_handover_adjustments_batch
  ON public.delivery_cash_handover_adjustments(handover_id,created_at DESC);
REVOKE ALL ON TABLE public.delivery_cash_handover_adjustments FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.correct_delivery_cash_handover(
  p_handover_id uuid,p_corrected_received_amount_paise bigint,p_reason text,p_evidence_reference text DEFAULT NULL
)
RETURNS TABLE(handover_id uuid,handover_status text,expected_amount_paise bigint,
  received_amount_paise bigint,was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_actor uuid:=auth.uid();
  v_handover public.delivery_cash_handovers%ROWTYPE;
  v_reason text:=NULLIF(pg_catalog.btrim(p_reason),'');
  v_evidence text:=NULLIF(pg_catalog.btrim(p_evidence_reference),'');
  v_existing public.delivery_cash_handover_adjustments%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only owner/admin can correct a cash handover' USING ERRCODE='42501';
  END IF;
  IF p_handover_id IS NULL OR p_corrected_received_amount_paise IS NULL
     OR p_corrected_received_amount_paise<0 OR v_reason IS NULL
     OR pg_catalog.length(v_reason)<5 OR pg_catalog.length(v_reason)>500
     OR (p_evidence_reference IS NOT NULL AND pg_catalog.length(p_evidence_reference)>200) THEN
    RAISE EXCEPTION 'Valid corrected cash amount, reason and evidence are required' USING ERRCODE='22023';
  END IF;
  SELECT h.* INTO v_handover FROM public.delivery_cash_handovers h
    WHERE h.id=p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Handover not found' USING ERRCODE='P0002'; END IF;
  SELECT a.* INTO v_existing FROM public.delivery_cash_handover_adjustments a
    WHERE a.handover_id=v_handover.id AND a.new_received_amount_paise=p_corrected_received_amount_paise
      AND a.reason=v_reason AND COALESCE(a.evidence_reference,'')=COALESCE(v_evidence,'')
    ORDER BY a.created_at DESC LIMIT 1;
  IF FOUND AND v_handover.received_amount_paise=p_corrected_received_amount_paise THEN
    RETURN QUERY SELECT v_handover.id,v_handover.status,v_handover.expected_amount_paise,
      v_handover.received_amount_paise,true;
    RETURN;
  END IF;
  IF v_handover.status<>'disputed' THEN
    RAISE EXCEPTION 'Only disputed handovers can be corrected' USING ERRCODE='23514';
  END IF;
  INSERT INTO public.delivery_cash_handover_adjustments(
    handover_id,old_received_amount_paise,new_received_amount_paise,reason,evidence_reference,created_by
  ) VALUES(v_handover.id,v_handover.received_amount_paise,p_corrected_received_amount_paise,
    v_reason,v_evidence,v_actor);
  UPDATE public.delivery_cash_handovers SET received_amount_paise=p_corrected_received_amount_paise,
    status='submitted',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL
    WHERE id=v_handover.id;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,old_values,new_values)
  VALUES(v_actor,'cod_cash_handover.corrected','delivery_cash_handovers',v_handover.id::text,
    pg_catalog.jsonb_build_object('received_amount_paise',v_handover.received_amount_paise,'status',v_handover.status),
    pg_catalog.jsonb_build_object('received_amount_paise',p_corrected_received_amount_paise,
      'status','submitted','reason',v_reason,'evidence_reference',v_evidence));
  RETURN QUERY SELECT v_handover.id,'submitted'::text,v_handover.expected_amount_paise,
    p_corrected_received_amount_paise,false;
END;
$function$;
REVOKE ALL ON FUNCTION private.correct_delivery_cash_handover(uuid,bigint,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.correct_delivery_cash_handover(
  p_handover_id uuid,p_corrected_received_amount_paise bigint,p_reason text,p_evidence_reference text DEFAULT NULL
)
RETURNS TABLE(handover_id uuid,handover_status text,expected_amount_paise bigint,
  received_amount_paise bigint,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $wrapper$
  SELECT * FROM private.correct_delivery_cash_handover(
    p_handover_id,p_corrected_received_amount_paise,p_reason,p_evidence_reference
  );
$wrapper$;
REVOKE ALL ON FUNCTION public.correct_delivery_cash_handover(uuid,bigint,text,text)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.correct_delivery_cash_handover(uuid,bigint,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.get_my_unhanded_cod_collections()
RETURNS TABLE(collection_id uuid,order_id uuid,order_number text,business_date date,
  service_area_id uuid,service_area_name text,delivery_slot_id uuid,delivery_slot text,
  amount_collected_paise integer,collection_status text,collected_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  RETURN QUERY
  SELECT c.id,o.id,o.order_number::text,o.delivery_date,o.service_area_id,sa.name::text,
    o.delivery_slot_id,ds.label::text,c.amount_collected_paise,c.status,c.collected_at
  FROM public.cod_collections c
  JOIN public.orders o ON o.id=c.order_id
  JOIN public.service_areas sa ON sa.id=o.service_area_id
  JOIN public.delivery_slots ds ON ds.id=o.delivery_slot_id
  JOIN public.delivery_assignment_orders dao ON dao.order_id=o.id
  JOIN public.delivery_assignments da ON da.id=dao.delivery_assignment_id
  WHERE c.collected_by_staff_id=auth.uid() AND da.staff_id=auth.uid()
    AND da.delivery_date=o.delivery_date AND da.delivery_slot_id=o.delivery_slot_id
    AND da.service_area_id=o.service_area_id AND o.status='delivered'
    AND o.order_type='one_time' AND o.payment_method='cod'
    AND NOT EXISTS (SELECT 1 FROM public.delivery_cash_handover_items hi WHERE hi.collection_id=c.id)
  ORDER BY o.delivery_date DESC,c.collected_at DESC;
END;
$function$;
REVOKE ALL ON FUNCTION private.get_my_unhanded_cod_collections() FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.get_my_unhanded_cod_collections()
RETURNS TABLE(collection_id uuid,order_id uuid,order_number text,business_date date,
  service_area_id uuid,service_area_name text,delivery_slot_id uuid,delivery_slot text,
  amount_collected_paise integer,collection_status text,collected_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $wrapper$
  SELECT * FROM private.get_my_unhanded_cod_collections();
$wrapper$;
REVOKE ALL ON FUNCTION public.get_my_unhanded_cod_collections() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_my_unhanded_cod_collections() TO authenticated;

CREATE OR REPLACE FUNCTION private.get_admin_cod_financial_report(
  p_from_date date,p_to_date date,p_service_area_id uuid DEFAULT NULL,p_staff_id uuid DEFAULT NULL
)
RETURNS TABLE(
  order_id uuid,order_number text,business_date date,service_area_id uuid,service_area_name text,
  delivery_slot text,staff_id uuid,staff_name text,collection_id uuid,collection_status text,
  amount_collected_paise integer,order_total_paise integer,variance_paise integer,
  collected_at timestamptz,handover_id uuid,handover_number text,handover_status text,
  handover_expected_paise bigint,handover_received_paise bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only owner/admin can view COD financial reports' USING ERRCODE='42501';
  END IF;
  IF p_from_date IS NULL OR p_to_date IS NULL OR p_from_date>p_to_date
     OR p_to_date-p_from_date>366 THEN
    RAISE EXCEPTION 'A valid date range of at most 367 days is required' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  SELECT o.id,o.order_number::text,o.delivery_date, o.service_area_id,sa.name::text,
    ds.label::text,c.collected_by_staff_id,COALESCE(pr.full_name,au.email,'Not recorded')::text,
    c.id,COALESCE(c.status,'not_recorded'),COALESCE(c.amount_collected_paise,0),o.total_paise,
    (COALESCE(c.amount_collected_paise,0)-o.total_paise),c.collected_at,
    h.id,h.handover_number,h.status,h.expected_amount_paise,h.received_amount_paise
  FROM public.orders o
  JOIN public.service_areas sa ON sa.id=o.service_area_id
  JOIN public.delivery_slots ds ON ds.id=o.delivery_slot_id
  LEFT JOIN public.cod_collections c ON c.order_id=o.id
  LEFT JOIN public.profiles pr ON pr.id=c.collected_by_staff_id
  LEFT JOIN auth.users au ON au.id=c.collected_by_staff_id
  LEFT JOIN public.delivery_cash_handover_items hi ON hi.collection_id=c.id
  LEFT JOIN public.delivery_cash_handovers h ON h.id=hi.handover_id
  WHERE o.order_type='one_time' AND o.payment_method='cod' AND o.status='delivered'
    AND o.delivery_date BETWEEN p_from_date AND p_to_date
    AND (p_service_area_id IS NULL OR o.service_area_id=p_service_area_id)
    AND (p_staff_id IS NULL OR c.collected_by_staff_id=p_staff_id)
  ORDER BY o.delivery_date DESC,c.collected_at DESC,c.id;
END;
$function$;
REVOKE ALL ON FUNCTION private.get_admin_cod_financial_report(date,date,uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.get_admin_cod_financial_report(
  p_from_date date,p_to_date date,p_service_area_id uuid DEFAULT NULL,p_staff_id uuid DEFAULT NULL
)
RETURNS TABLE(
  order_id uuid,order_number text,business_date date,service_area_id uuid,service_area_name text,
  delivery_slot text,staff_id uuid,staff_name text,collection_id uuid,collection_status text,
  amount_collected_paise integer,order_total_paise integer,variance_paise integer,
  collected_at timestamptz,handover_id uuid,handover_number text,handover_status text,
  handover_expected_paise bigint,handover_received_paise bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $wrapper$
  SELECT * FROM private.get_admin_cod_financial_report(p_from_date,p_to_date,p_service_area_id,p_staff_id);
$wrapper$;
REVOKE ALL ON FUNCTION public.get_admin_cod_financial_report(date,date,uuid,uuid)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_cod_financial_report(date,date,uuid,uuid) TO authenticated;

COMMENT ON TABLE public.delivery_cash_handover_adjustments IS 'Append-only recount evidence for disputed cash handovers; corrections require owner/admin review.';
COMMENT ON TABLE public.cod_collection_adjustments IS
'Append-only owner/admin evidence ledger for COD cash count corrections. No write-off or refund is performed.';
COMMENT ON TABLE public.delivery_cash_handovers IS
'Delivery staff cash handover batches. Acceptance confirms cash received at office, not COD payment settlement.';
COMMENT ON FUNCTION public.get_admin_cod_financial_report(date,date,uuid,uuid) IS
'Owner/admin-only one-time COD collection and cash handover detail report. Date range is based on delivery_date (Kolkata business date).';

COMMIT;
