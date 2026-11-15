-- Phase 5.5: pause/resume must not strand already-generated reservations.
BEGIN;

CREATE OR REPLACE FUNCTION private.pause_subscription(p_subscription_id uuid)
RETURNS TABLE(subscription_id uuid,subscription_status public.subscription_status_enum,was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_actor uuid:=auth.uid();
  v_sub public.subscriptions%ROWTYPE;
  v_today date;
  v_slot public.delivery_slots%ROWTYPE;
  v_local_time time;
  v_delivery record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT s.* INTO v_sub FROM public.subscriptions s
  WHERE s.id=p_subscription_id AND (s.customer_id=v_actor OR private.is_admin_or_owner()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found' USING ERRCODE='P0002'; END IF;
  IF v_sub.status='paused' THEN RETURN QUERY SELECT v_sub.id,v_sub.status,true; RETURN; END IF;
  IF v_sub.status<>'active' THEN RAISE EXCEPTION 'Only active, payment-verified subscriptions can be paused' USING ERRCODE='23514'; END IF;

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

  -- A same-day delivery may already have been generated and reserved by the scheduler.
  -- Release it and mark it paused, not customer-skipped; resume shifts the remaining plan.
  FOR v_delivery IN
    SELECT d.id,d.order_id FROM public.subscription_deliveries d
    WHERE d.subscription_id=v_sub.id AND d.delivery_date>=v_today
      AND d.status='scheduled' AND d.assigned_staff_id IS NULL
    ORDER BY d.delivery_date,d.id FOR UPDATE
  LOOP
    IF v_delivery.order_id IS NOT NULL THEN
      PERFORM private.release_subscription_order_reservation(
        v_delivery.order_id,v_actor,'Subscription paused before dispatch'
      );
    END IF;
    UPDATE public.subscription_deliveries
    SET status='skipped',delivery_notes='Subscription paused before dispatch'
    WHERE id=v_delivery.id;
  END LOOP;

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
DECLARE
  v_actor uuid:=auth.uid();
  v_sub public.subscriptions%ROWTYPE;
  v_today date;
  v_pause_days integer;
  v_new_end date;
  v_new_next date;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT s.* INTO v_sub FROM public.subscriptions s
  WHERE s.id=p_subscription_id AND (s.customer_id=v_actor OR private.is_admin_or_owner()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found' USING ERRCODE='P0002'; END IF;
  IF v_sub.status='active' THEN RETURN QUERY SELECT v_sub.id,v_sub.status,v_sub.end_date,true; RETURN; END IF;
  IF v_sub.status<>'paused' OR v_sub.paused_at IS NULL THEN
    RAISE EXCEPTION 'Only paused subscriptions can be resumed' USING ERRCODE='23514';
  END IF;
  v_today:=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date;
  -- The pause date itself is a suspended delivery day, even if pause and resume
  -- happen on the same Kolkata calendar date.
  v_pause_days:=greatest(1,v_today-v_sub.paused_at);
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

COMMENT ON FUNCTION private.pause_subscription(uuid) IS
  'Pauses an active paid subscription; atomically releases already-generated but unassigned stock reservations and marks those rows paused/skipped without consuming plan days.';
COMMENT ON FUNCTION private.resume_subscription(uuid) IS
  'Resumes a paused subscription and shifts its remaining delivery schedule by at least one suspended Kolkata calendar day.';

COMMIT;
