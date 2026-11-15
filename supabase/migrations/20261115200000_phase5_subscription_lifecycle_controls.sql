-- Phase 5.3: subscription lifecycle controls and evidence-backed vendor changes.
BEGIN;

ALTER TABLE public.subscription_skip_records
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_skip_idempotency
  ON public.subscription_skip_records(subscription_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.subscription_item_vendor_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
  subscription_item_id uuid NOT NULL REFERENCES public.subscription_items(id) ON DELETE RESTRICT,
  old_vendor_id varchar(100) NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  new_vendor_id varchar(100) NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  effective_from date NOT NULL,
  idempotency_key uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (old_vendor_id<>new_vendor_id),
  UNIQUE(subscription_item_id,effective_from),
  UNIQUE(subscription_item_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_subscription_item_vendor_changes_effective
  ON public.subscription_item_vendor_changes(subscription_item_id,effective_from DESC);

CREATE TABLE IF NOT EXISTS public.subscription_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type varchar(40) NOT NULL CHECK (event_type IN (
    'paused','resumed','delivery_skipped','cancelled','vendor_change_scheduled'
  )),
  effective_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscription_lifecycle_events_sub_created
  ON public.subscription_lifecycle_events(subscription_id,created_at DESC);

ALTER TABLE public.subscription_item_vendor_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_lifecycle_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscription_item_vendor_changes_read ON public.subscription_item_vendor_changes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.subscriptions s
      WHERE s.id=subscription_item_vendor_changes.subscription_id
        AND (s.customer_id=auth.uid() OR private.is_admin_or_owner() OR private.is_staff()))
  );
CREATE POLICY subscription_lifecycle_events_read ON public.subscription_lifecycle_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.subscriptions s
      WHERE s.id=subscription_lifecycle_events.subscription_id
        AND (s.customer_id=auth.uid() OR private.is_admin_or_owner() OR private.is_staff()))
  );
REVOKE ALL ON TABLE public.subscription_item_vendor_changes,
  public.subscription_lifecycle_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.subscription_item_vendor_changes,
  public.subscription_lifecycle_events TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON TABLE public.subscription_skip_records FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.pause_subscription(p_subscription_id uuid)
RETURNS TABLE(subscription_id uuid,subscription_status public.subscription_status_enum,was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_actor uuid:=auth.uid(); v_sub public.subscriptions%ROWTYPE; v_today date; v_slot public.delivery_slots%ROWTYPE; v_local_time time;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT s.* INTO v_sub FROM public.subscriptions s
    WHERE s.id=p_subscription_id AND (s.customer_id=v_actor OR private.is_admin_or_owner()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found' USING ERRCODE='P0002'; END IF;
  IF v_sub.status='paused' THEN
    RETURN QUERY SELECT v_sub.id,v_sub.status,true; RETURN;
  END IF;
  IF v_sub.status<>'active' THEN
    RAISE EXCEPTION 'Only active, payment-verified subscriptions can be paused' USING ERRCODE='23514';
  END IF;
  v_today:=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_local_time:=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::time;
  SELECT ds.* INTO v_slot FROM public.delivery_slots ds WHERE ds.id=v_sub.delivery_slot_id;
  IF v_sub.next_delivery_date<=v_today AND v_local_time>=v_slot.cancellation_deadline_time THEN
    RAISE EXCEPTION 'The current delivery cutoff has passed; pause starts with a future delivery' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.subscription_deliveries d
    WHERE d.subscription_id=v_sub.id AND d.delivery_date>=v_today
      AND d.status IN ('assigned','out_for_delivery')) THEN
    RAISE EXCEPTION 'A delivery already assigned or out for delivery cannot be paused' USING ERRCODE='23514';
  END IF;
  UPDATE public.subscriptions SET status='paused',paused_at=v_today,updated_at=pg_catalog.now()
    WHERE id=v_sub.id;
  INSERT INTO public.subscription_lifecycle_events(subscription_id,actor_id,event_type,effective_date,metadata)
    VALUES(v_sub.id,v_actor,'paused',v_today,pg_catalog.jsonb_build_object('previous_status',v_sub.status));
  RETURN QUERY SELECT v_sub.id,'paused'::public.subscription_status_enum,false;
END;
$function$;

CREATE OR REPLACE FUNCTION private.resume_subscription(p_subscription_id uuid)
RETURNS TABLE(subscription_id uuid,subscription_status public.subscription_status_enum,new_end_date date,was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_actor uuid:=auth.uid(); v_sub public.subscriptions%ROWTYPE; v_today date; v_pause_days integer;
  v_new_end date; v_new_next date;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT s.* INTO v_sub FROM public.subscriptions s
    WHERE s.id=p_subscription_id AND (s.customer_id=v_actor OR private.is_admin_or_owner()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found' USING ERRCODE='P0002'; END IF;
  IF v_sub.status='active' THEN
    RETURN QUERY SELECT v_sub.id,v_sub.status,v_sub.end_date,true; RETURN;
  END IF;
  IF v_sub.status<>'paused' OR v_sub.paused_at IS NULL THEN
    RAISE EXCEPTION 'Only paused subscriptions can be resumed' USING ERRCODE='23514';
  END IF;
  v_today:=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_pause_days:=greatest(0,v_today-v_sub.paused_at);
  v_new_end:=v_sub.end_date+v_pause_days;
  v_new_next:=greatest(COALESCE(v_sub.next_delivery_date,v_today)+v_pause_days,v_today+1);
  UPDATE public.subscriptions SET status='active',paused_at=NULL,end_date=v_new_end,
    next_delivery_date=v_new_next,updated_at=pg_catalog.now() WHERE id=v_sub.id;
  INSERT INTO public.subscription_lifecycle_events(subscription_id,actor_id,event_type,effective_date,metadata)
    VALUES(v_sub.id,v_actor,'resumed',v_today,pg_catalog.jsonb_build_object(
      'paused_at',v_sub.paused_at,'pause_days',v_pause_days,'old_end_date',v_sub.end_date,'new_end_date',v_new_end));
  RETURN QUERY SELECT v_sub.id,'active'::public.subscription_status_enum,v_new_end,false;
END;
$function$;

CREATE OR REPLACE FUNCTION private.skip_subscription_delivery(
  p_subscription_id uuid,p_skip_date date,p_reason text,p_idempotency_key uuid
)
RETURNS TABLE(subscription_id uuid,skip_date date,was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_actor uuid:=auth.uid(); v_sub public.subscriptions%ROWTYPE; v_slot public.delivery_slots%ROWTYPE;
  v_today date; v_local_time time; v_existing public.subscription_skip_records%ROWTYPE;
  v_delivery public.subscription_deliveries%ROWTYPE; v_reason text:=NULLIF(pg_catalog.btrim(p_reason),'');
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_subscription_id IS NULL OR p_skip_date IS NULL OR p_idempotency_key IS NULL
     OR (p_reason IS NOT NULL AND pg_catalog.length(p_reason)>300) THEN
    RAISE EXCEPTION 'Subscription, skip date and idempotency key are required' USING ERRCODE='22023';
  END IF;
  SELECT s.* INTO v_sub FROM public.subscriptions s
    WHERE s.id=p_subscription_id AND (s.customer_id=v_actor OR private.is_admin_or_owner()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found' USING ERRCODE='P0002'; END IF;
  SELECT r.* INTO v_existing FROM public.subscription_skip_records r
    WHERE r.subscription_id=v_sub.id AND (r.skip_date=p_skip_date OR r.idempotency_key=p_idempotency_key)
    LIMIT 1;
  IF FOUND THEN
    IF v_existing.skip_date<>p_skip_date OR
       (v_existing.idempotency_key IS NOT NULL AND v_existing.idempotency_key<>p_idempotency_key) THEN
      RAISE EXCEPTION 'Skip date already has a different request' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT v_sub.id,p_skip_date,true; RETURN;
  END IF;
  IF v_sub.status<>'active' OR p_skip_date<v_sub.start_date OR p_skip_date>v_sub.end_date THEN
    RAISE EXCEPTION 'Only future dates within an active subscription can be skipped' USING ERRCODE='23514';
  END IF;
  v_today:=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_local_time:=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::time;
  IF p_skip_date<v_today THEN RAISE EXCEPTION 'Past deliveries cannot be skipped' USING ERRCODE='23514'; END IF;
  SELECT ds.* INTO v_slot FROM public.delivery_slots ds WHERE ds.id=v_sub.delivery_slot_id;
  IF p_skip_date=v_today AND v_local_time>=v_slot.cancellation_deadline_time THEN
    RAISE EXCEPTION 'The delivery skip cutoff has passed' USING ERRCODE='23514';
  END IF;
  SELECT d.* INTO v_delivery FROM public.subscription_deliveries d
    WHERE d.subscription_id=v_sub.id AND d.delivery_date=p_skip_date FOR UPDATE;
  IF FOUND AND (v_delivery.status<>'scheduled' OR v_delivery.assigned_staff_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Assigned or in-progress deliveries cannot be skipped' USING ERRCODE='23514';
  END IF;
  INSERT INTO public.subscription_skip_records(subscription_id,skip_date,reason,idempotency_key,created_by)
    VALUES(v_sub.id,p_skip_date,v_reason,p_idempotency_key,v_actor);
  IF v_delivery.id IS NOT NULL THEN
    UPDATE public.subscription_deliveries SET status='skipped',delivery_notes='Customer skipped this delivery'
      WHERE id=v_delivery.id;
  END IF;
  INSERT INTO public.subscription_lifecycle_events(subscription_id,actor_id,event_type,effective_date,metadata)
    VALUES(v_sub.id,v_actor,'delivery_skipped',p_skip_date,pg_catalog.jsonb_build_object('reason',v_reason));
  RETURN QUERY SELECT v_sub.id,p_skip_date,false;
END;
$function$;

CREATE OR REPLACE FUNCTION private.cancel_subscription(p_subscription_id uuid,p_reason text DEFAULT NULL)
RETURNS TABLE(subscription_id uuid,subscription_status public.subscription_status_enum,was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_actor uuid:=auth.uid(); v_sub public.subscriptions%ROWTYPE; v_today date; v_slot public.delivery_slots%ROWTYPE; v_local_time time; v_reason text:=NULLIF(pg_catalog.btrim(p_reason),'');
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_reason IS NOT NULL AND pg_catalog.length(p_reason)>300 THEN
    RAISE EXCEPTION 'Cancellation reason is too long' USING ERRCODE='22023';
  END IF;
  SELECT s.* INTO v_sub FROM public.subscriptions s
    WHERE s.id=p_subscription_id AND (s.customer_id=v_actor OR private.is_admin_or_owner()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found' USING ERRCODE='P0002'; END IF;
  IF v_sub.status='cancelled' THEN RETURN QUERY SELECT v_sub.id,v_sub.status,true; RETURN; END IF;
  IF v_sub.status NOT IN ('active','paused') THEN
    RAISE EXCEPTION 'Only active or paused subscriptions can be cancelled' USING ERRCODE='23514';
  END IF;
  v_today:=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_local_time:=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::time;
  SELECT ds.* INTO v_slot FROM public.delivery_slots ds WHERE ds.id=v_sub.delivery_slot_id;
  IF v_sub.next_delivery_date<=v_today AND v_local_time>=v_slot.cancellation_deadline_time THEN
    RAISE EXCEPTION 'The current delivery cutoff has passed; cancellation applies to future deliveries only' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.subscription_deliveries d
    WHERE d.subscription_id=v_sub.id AND d.delivery_date=v_today
      AND d.status IN ('assigned','out_for_delivery')) THEN
    RAISE EXCEPTION 'A delivery already assigned or out for delivery cannot be cancelled today' USING ERRCODE='23514';
  END IF;
  UPDATE public.subscription_deliveries SET status='skipped',delivery_notes='Subscription cancelled'
    WHERE subscription_id=v_sub.id AND delivery_date>=v_today AND status='scheduled'
      AND assigned_staff_id IS NULL;
  UPDATE public.subscriptions SET status='cancelled',cancelled_at=pg_catalog.now(),paused_at=NULL,
    next_delivery_date=NULL,updated_at=pg_catalog.now() WHERE id=v_sub.id;
  INSERT INTO public.subscription_lifecycle_events(subscription_id,actor_id,event_type,effective_date,metadata)
    VALUES(v_sub.id,v_actor,'cancelled',v_today,pg_catalog.jsonb_build_object('reason',v_reason,'refund_created',false));
  RETURN QUERY SELECT v_sub.id,'cancelled'::public.subscription_status_enum,false;
END;
$function$;

CREATE OR REPLACE FUNCTION private.change_subscription_item_vendor(
  p_subscription_id uuid,p_subscription_item_id uuid,p_new_vendor_id varchar,
  p_effective_from date,p_idempotency_key uuid
)
RETURNS TABLE(subscription_id uuid,subscription_item_id uuid,old_vendor_id varchar,
  new_vendor_id varchar,effective_from date,was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_actor uuid:=auth.uid(); v_sub public.subscriptions%ROWTYPE; v_item public.subscription_items%ROWTYPE;
  v_product public.products%ROWTYPE; v_vendor public.vendors%ROWTYPE; v_old_vendor varchar;
  v_half public.product_variants%ROWTYPE; v_one public.product_variants%ROWTYPE;
  v_half_base integer; v_half_fee integer; v_half_total integer; v_one_base integer; v_one_fee integer;
  v_one_total integer; v_expected integer; v_count bigint; v_existing public.subscription_item_vendor_changes%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_subscription_id IS NULL OR p_subscription_item_id IS NULL OR p_new_vendor_id IS NULL
     OR p_effective_from IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Subscription, item, new vendor, effective date and idempotency key are required' USING ERRCODE='22023';
  END IF;
  SELECT s.* INTO v_sub FROM public.subscriptions s
    WHERE s.id=p_subscription_id AND (s.customer_id=v_actor OR private.is_admin_or_owner()) FOR UPDATE;
  IF NOT FOUND OR v_sub.status<>'active' THEN
    RAISE EXCEPTION 'Only an active owned subscription can change vendor' USING ERRCODE='23514';
  END IF;
  IF p_effective_from<(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date+1
     OR p_effective_from>v_sub.end_date THEN
    RAISE EXCEPTION 'Vendor change must take effect on a future subscription delivery date' USING ERRCODE='23514';
  END IF;
  SELECT i.* INTO v_item FROM public.subscription_items i
    WHERE i.id=p_subscription_item_id AND i.subscription_id=v_sub.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription item not found' USING ERRCODE='P0002'; END IF;
  SELECT c.* INTO v_existing FROM public.subscription_item_vendor_changes c
    WHERE c.subscription_item_id=v_item.id AND c.idempotency_key=p_idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT v_sub.id,v_item.id,v_existing.old_vendor_id,v_existing.new_vendor_id,
      v_existing.effective_from,true; RETURN;
  END IF;
  SELECT c.new_vendor_id INTO v_old_vendor FROM public.subscription_item_vendor_changes c
    WHERE c.subscription_item_id=v_item.id AND c.effective_from<=p_effective_from
    ORDER BY c.effective_from DESC LIMIT 1;
  v_old_vendor:=COALESCE(v_old_vendor,v_item.vendor_id);
  IF v_old_vendor IS NULL OR v_old_vendor=p_new_vendor_id THEN
    RAISE EXCEPTION 'New vendor must differ from the currently scheduled vendor' USING ERRCODE='23514';
  END IF;
  SELECT p.* INTO v_product FROM public.product_variants pv
    JOIN public.products p ON p.id=pv.product_id WHERE pv.id=v_item.product_variant_id;
  SELECT v.* INTO v_vendor FROM public.vendors v
    WHERE v.id=p_new_vendor_id AND v.is_approved AND v.ordering_enabled;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.vendor_products vp
    WHERE vp.vendor_id=p_new_vendor_id AND vp.product_id=v_product.id
      AND vp.milk_type=v_item.milk_type AND vp.is_active) THEN
    RAISE EXCEPTION 'New vendor is not approved for this milk product/type' USING ERRCODE='23514';
  END IF;
  IF (v_product.product_type='standard_milk' AND v_vendor.vendor_type<>'milk_vendor')
     OR (v_product.product_type='canteen_milk' AND
       (v_vendor.vendor_type<>'canteen_vendor' OR p_new_vendor_id<>'canteen-milk-centre')) THEN
    RAISE EXCEPTION 'New vendor type does not match the subscribed milk product' USING ERRCODE='23514';
  END IF;
  SELECT pv.* INTO v_half FROM public.product_variants pv
    WHERE pv.product_id=v_product.id AND pv.unit_quantity=0.5 AND pv.is_orderable LIMIT 1;
  SELECT pv.* INTO v_one FROM public.product_variants pv
    WHERE pv.product_id=v_product.id AND pv.unit_quantity=1 AND pv.is_orderable LIMIT 1;
  SELECT pg_catalog.count(*),pg_catalog.min(vp.price_per_delivery_paise),
    pg_catalog.min(vp.delivery_fee_paise),pg_catalog.min(vp.total_customer_delivery_paise)
    INTO v_count,v_half_base,v_half_fee,v_half_total
  FROM public.vendor_prices vp WHERE vp.vendor_id=p_new_vendor_id AND vp.product_variant_id=v_half.id
    AND vp.milk_type=v_item.milk_type AND vp.is_current AND vp.effective_to IS NULL AND vp.effective_from<=pg_catalog.now();
  IF v_count<>1 OR v_half_total IS DISTINCT FROM (v_half_base+v_half_fee) THEN
    RAISE EXCEPTION 'New vendor 500 ml pricing is missing or ambiguous' USING ERRCODE='23514';
  END IF;
  SELECT pg_catalog.count(*),pg_catalog.min(vp.price_per_delivery_paise),
    pg_catalog.min(vp.delivery_fee_paise),pg_catalog.min(vp.total_customer_delivery_paise)
    INTO v_count,v_one_base,v_one_fee,v_one_total
  FROM public.vendor_prices vp WHERE vp.vendor_id=p_new_vendor_id AND vp.product_variant_id=v_one.id
    AND vp.milk_type=v_item.milk_type AND vp.is_current AND vp.effective_to IS NULL AND vp.effective_from<=pg_catalog.now();
  IF v_count<>1 OR v_one_total IS DISTINCT FROM (v_one_base+v_one_fee) THEN
    RAISE EXCEPTION 'New vendor 1 L pricing is missing or ambiguous' USING ERRCODE='23514';
  END IF;
  IF v_item.quantity_litres=0.5 THEN v_expected:=v_half_total;
  ELSE v_expected:=(pg_catalog.floor(v_item.quantity_litres)::integer*v_one_base)
    +CASE WHEN v_item.quantity_litres-pg_catalog.floor(v_item.quantity_litres)=0.5 THEN v_half_base ELSE 0 END
    +v_one_fee;
  END IF;
  IF v_expected<>v_item.price_per_delivery_paise THEN
    RAISE EXCEPTION 'Vendor change requires an identical per-delivery price; contact support for repricing' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.subscription_deliveries d
    WHERE d.subscription_id=v_sub.id AND d.delivery_date>=p_effective_from
      AND d.status IN ('assigned','out_for_delivery')) THEN
    RAISE EXCEPTION 'A delivery is already assigned for the requested vendor-change period' USING ERRCODE='23514';
  END IF;
  INSERT INTO public.subscription_item_vendor_changes(
    subscription_id,subscription_item_id,old_vendor_id,new_vendor_id,effective_from,idempotency_key,created_by
  ) VALUES(v_sub.id,v_item.id,v_old_vendor,p_new_vendor_id,p_effective_from,p_idempotency_key,v_actor);
  INSERT INTO public.subscription_lifecycle_events(subscription_id,actor_id,event_type,effective_date,metadata)
  VALUES(v_sub.id,v_actor,'vendor_change_scheduled',p_effective_from,
    pg_catalog.jsonb_build_object('subscription_item_id',v_item.id,'old_vendor_id',v_old_vendor,'new_vendor_id',p_new_vendor_id));
  RETURN QUERY SELECT v_sub.id,v_item.id,v_old_vendor,p_new_vendor_id,p_effective_from,false;
END;
$function$;

REVOKE ALL ON FUNCTION private.pause_subscription(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.resume_subscription(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.skip_subscription_delivery(uuid,date,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.cancel_subscription(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.change_subscription_item_vendor(uuid,uuid,varchar,date,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.pause_subscription(p_subscription_id uuid)
RETURNS TABLE(subscription_id uuid,subscription_status public.subscription_status_enum,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $wrapper$ SELECT * FROM private.pause_subscription(p_subscription_id); $wrapper$;
CREATE OR REPLACE FUNCTION public.resume_subscription(p_subscription_id uuid)
RETURNS TABLE(subscription_id uuid,subscription_status public.subscription_status_enum,new_end_date date,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $wrapper$ SELECT * FROM private.resume_subscription(p_subscription_id); $wrapper$;
CREATE OR REPLACE FUNCTION public.skip_subscription_delivery(p_subscription_id uuid,p_skip_date date,p_reason text,p_idempotency_key uuid)
RETURNS TABLE(subscription_id uuid,skip_date date,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $wrapper$ SELECT * FROM private.skip_subscription_delivery(p_subscription_id,p_skip_date,p_reason,p_idempotency_key); $wrapper$;
CREATE OR REPLACE FUNCTION public.cancel_subscription(p_subscription_id uuid,p_reason text DEFAULT NULL)
RETURNS TABLE(subscription_id uuid,subscription_status public.subscription_status_enum,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $wrapper$ SELECT * FROM private.cancel_subscription(p_subscription_id,p_reason); $wrapper$;
CREATE OR REPLACE FUNCTION public.change_subscription_item_vendor(
  p_subscription_id uuid,p_subscription_item_id uuid,p_new_vendor_id varchar,p_effective_from date,p_idempotency_key uuid
)
RETURNS TABLE(subscription_id uuid,subscription_item_id uuid,old_vendor_id varchar,new_vendor_id varchar,
  effective_from date,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $wrapper$ SELECT * FROM private.change_subscription_item_vendor(
  p_subscription_id,p_subscription_item_id,p_new_vendor_id,p_effective_from,p_idempotency_key
); $wrapper$;

REVOKE ALL ON FUNCTION public.pause_subscription(uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.resume_subscription(uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.skip_subscription_delivery(uuid,date,text,uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.cancel_subscription(uuid,text) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.change_subscription_item_vendor(uuid,uuid,varchar,date,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.pause_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.skip_subscription_delivery(uuid,date,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_subscription_item_vendor(uuid,uuid,varchar,date,uuid) TO authenticated;

COMMIT;
