-- Phase 5.6: subscription COD, settled independently per delivery.
-- This migration replaces the online-only Phase 5 payment gate without changing
-- the one-time COD path. Every generated subscription delivery owns its own COD payment.
BEGIN;

-- Subscription-level payment row is an agreement marker for the COD plan total.
-- Daily COD receivables are separate order-scoped payment rows.
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS chk_subscription_payment_online_only;
ALTER TABLE public.payments
  ADD CONSTRAINT chk_subscription_payment_cod_or_online
  CHECK (
    subscription_id IS NULL OR
    (gateway='cod' AND method='cod') OR
    (gateway<>'cod' AND method IN ('online','upi','card'))
  );

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS chk_order_subscription_link;
ALTER TABLE public.orders
  ADD CONSTRAINT chk_order_subscription_link
  CHECK (
    (order_type='subscription' AND subscription_id IS NOT NULL
      AND subscription_delivery_id IS NOT NULL AND delivery_date IS NOT NULL
      AND (
        (payment_method='online' AND payment_status='captured') OR
        (payment_method='cod' AND payment_status IN ('pending','captured'))
      ))
    OR
    (order_type='one_time' AND subscription_id IS NULL
      AND subscription_delivery_id IS NULL AND subscription_discount_paise=0)
  );

-- Checkout becomes an authenticated COD plan activation. The existing quote,
-- ownership checks, price snapshots and idempotency lock remain authoritative.
DO $patch$
DECLARE v_def text; v_next text;
BEGIN
  v_def:=pg_catalog.pg_get_functiondef(
    'private.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)'::regprocedure
  );
  v_next:=pg_catalog.replace(v_def,
    '''pending_payment'',p_start_date','''active'',p_start_date');
  v_next:=pg_catalog.replace(v_next,
    '''pending_online'',''pending'',''online''','''cod'',''pending'',''cod''');
  v_next:=pg_catalog.replace(v_next,
    '''subscription.payment_intent.created''','''subscription.cod.activated''');
  v_next:=pg_catalog.replace(v_next,
    '''pending_payment''::public.subscription_status_enum','''active''::public.subscription_status_enum');
  v_next:=pg_catalog.replace(v_next,
    '''Creates an idempotent pending online-payment intent only. Subscription remains pending_payment until trusted server-side verification; no deliveries are generated.''',
    '''Activates an idempotent COD subscription. Each future delivery is a separate pending COD receivable, recorded and verified independently.''');
  IF v_next=v_def
     OR pg_catalog.strpos(v_next, '''pending_payment'',p_start_date')>0
     OR pg_catalog.strpos(v_next, '''pending_online'',''pending'',''online''')>0 THEN
    RAISE EXCEPTION 'Subscription COD checkout patch did not match the expected source';
  END IF;
  EXECUTE v_next;
END;
$patch$;

-- Address snapshot validation remains tied to the original customer-owned address,
-- but COD activation does not fabricate an online payment verification timestamp.
DO $patch$
DECLARE v_def text; v_next text;
BEGIN
  v_def:=pg_catalog.pg_get_functiondef(
    'private.enforce_order_delivery_address_snapshot()'::regprocedure
  );
  v_next:=pg_catalog.replace(v_def,
    E'        AND s.payment_verified_at IS NOT NULL\n','');
  v_next:=pg_catalog.replace(v_next,
    '''Paid subscription address snapshot is unavailable''',
    '''Active subscription address snapshot is unavailable''');
  IF v_next=v_def OR pg_catalog.strpos(v_next, 's.payment_verified_at IS NOT NULL')>0 THEN
    RAISE EXCEPTION 'Subscription address snapshot patch did not match the expected source';
  END IF;
  EXECUTE v_next;
END;
$patch$;

-- Daily generation no longer requires a captured online plan payment. It creates
-- one pending COD order-payment pair for each generated delivery, atomically with
-- the existing order items and stock reservations.
DO $patch$
DECLARE v_def text; v_next text;
BEGIN
  v_def:=pg_catalog.pg_get_functiondef(
    'private.generate_subscription_deliveries(date)'::regprocedure
  );
  v_next:=pg_catalog.replace(v_def,
    E'      AND s.payment_verified_at IS NOT NULL\n','');
  v_next:=pg_catalog.replace(v_next,
    E'      AND EXISTS (SELECT 1 FROM public.payments p\n        WHERE p.subscription_id=s.id AND p.status=''captured''\n          AND p.gateway_payment_id IS NOT NULL AND p.method IN (''online'',''upi'',''card'')\n          AND p.gateway<>''cod'')\n','');
  v_next:=pg_catalog.replace(v_next,
    '''captured'',''online'',p_delivery_date','''pending'',''cod'',p_delivery_date');
  v_next:=pg_catalog.replace(v_next,
    'RETURNING id,order_number INTO v_order_id,v_order_number;',
    'RETURNING id,order_number INTO v_order_id,v_order_number;'||E'\n\n    INSERT INTO public.payments(order_id,amount_paise,currency,gateway,status,method)\n    VALUES(v_order_id,v_total::integer,''INR'',''cod'',''pending'',''cod'');');
  IF v_next=v_def
     OR pg_catalog.strpos(v_next, 'payment_verified_at IS NOT NULL')>0
     OR pg_catalog.strpos(v_next, 'gateway_payment_id IS NOT NULL')>0
     OR pg_catalog.strpos(v_next, '''pending'',''cod'',p_delivery_date')=0
     OR pg_catalog.strpos(v_next, 'INSERT INTO public.payments(order_id,amount_paise,currency,gateway,status,method)')=0 THEN
    RAISE EXCEPTION 'Subscription delivery COD generator patch did not match the expected source';
  END IF;
  EXECUTE v_next;
END;
$patch$;

-- Clarify that stock movements belong to COD fulfilment, not prepaid fulfilment.
DO $patch$
DECLARE v_def text; v_next text;
BEGIN
  v_def:=pg_catalog.pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure);
  v_next:=pg_catalog.replace(v_def,'Prepaid subscription delivery stock reservation','Subscription COD delivery stock reservation');
  IF v_next=v_def THEN RAISE EXCEPTION 'Subscription reservation note patch did not match'; END IF;
  EXECUTE v_next;
  v_def:=pg_catalog.pg_get_functiondef('private.complete_subscription_delivery(uuid)'::regprocedure);
  v_next:=pg_catalog.replace(v_def,'Prepaid subscription delivery fulfilled','Subscription COD delivery fulfilled');
  IF v_next=v_def THEN RAISE EXCEPTION 'Subscription fulfilment note patch did not match'; END IF;
  EXECUTE v_next;
END;
$patch$;

-- Shared cash recording: one-time assignment remains unchanged; subscription
-- authorization is sourced only from the delivery's assigned_staff_id.
DO $patch$
DECLARE v_def text; v_next text;
BEGIN
  v_def:=pg_catalog.pg_get_functiondef(
    'private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure
  );
  v_next:=pg_catalog.replace(v_def,
    'v_order.order_type<>''one_time''',
    'v_order.order_type NOT IN (''one_time'',''subscription'')');
  v_next:=pg_catalog.replace(v_next,
    E'  SELECT EXISTS (\n    SELECT 1\n    FROM public.delivery_assignment_orders dao\n    JOIN public.delivery_assignments da\n      ON da.id=dao.delivery_assignment_id\n    WHERE dao.order_id=p_order_id\n      AND da.staff_id=v_actor\n      AND da.status IN (''assigned'',''in_progress'',''completed'')\n  ) INTO v_assignment_authorized;',
    E'  SELECT EXISTS (\n    SELECT 1 FROM public.delivery_assignment_orders dao\n    JOIN public.delivery_assignments da ON da.id=dao.delivery_assignment_id\n    WHERE dao.order_id=p_order_id AND da.staff_id=v_actor\n      AND da.status IN (''assigned'',''in_progress'',''completed'')\n  ) OR EXISTS (\n    SELECT 1 FROM public.subscription_deliveries sd\n    WHERE sd.order_id=p_order_id AND sd.assigned_staff_id=v_actor\n      AND sd.status=''delivered''\n  ) INTO v_assignment_authorized;');
  IF v_next=v_def OR pg_catalog.strpos(v_next, 'subscription_deliveries sd')=0
     OR pg_catalog.strpos(v_next, 'NOT IN (''one_time'',''subscription'')')=0 THEN
    RAISE EXCEPTION 'COD collection recording patch did not match the expected source';
  END IF;
  EXECUTE v_next;
END;
$patch$;

-- Owner/admin review and discrepancy resolution are valid for either COD order
-- type; the existing per-order payment lock and exact amount settlement are retained.
DO $patch$
DECLARE v_name text; v_sig regprocedure; v_def text; v_next text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'private.review_cod_cash_collection(uuid,text,text)'::regprocedure,
    'private.resolve_cod_collection_discrepancy(uuid,integer,text,text)'::regprocedure
  ] LOOP
    v_def:=pg_catalog.pg_get_functiondef(v_sig);
    v_next:=pg_catalog.replace(v_def,
      'v_order.order_type <> ''one_time''',
      'v_order.order_type NOT IN (''one_time'',''subscription'')');
    IF v_next=v_def THEN
      RAISE EXCEPTION 'COD review/reconciliation patch did not match %',v_sig;
    END IF;
    EXECUTE v_next;
  END LOOP;

  v_def:=pg_catalog.pg_get_functiondef('private.get_admin_cod_collection(uuid)'::regprocedure);
  v_next:=pg_catalog.replace(v_def,
    'AND o.order_type = ''one_time''',
    'AND o.order_type IN (''one_time'',''subscription'')');
  IF v_next=v_def THEN RAISE EXCEPTION 'Admin COD collection reader patch did not match'; END IF;
  EXECUTE v_next;
END;
$patch$;

-- Cash handover accepts a subscription collection only when the same delivery
-- row links the order to the authenticated assigned staff member.
DO $patch$
DECLARE v_def text; v_next text;
BEGIN
  v_def:=pg_catalog.pg_get_functiondef(
    'private.submit_delivery_cash_handover(uuid[],integer,uuid)'::regprocedure
  );
  v_next:=pg_catalog.replace(v_def,
    'v_first.order_type<>''one_time''',
    'v_first.order_type NOT IN (''one_time'',''subscription'')');
  v_next:=pg_catalog.replace(v_next,
    E'    IF NOT EXISTS (\n      SELECT 1 FROM public.delivery_assignment_orders dao\n      JOIN public.delivery_assignments da ON da.id=dao.delivery_assignment_id\n      WHERE dao.order_id=v_first.id AND da.staff_id=v_actor\n        AND da.delivery_date=v_first.delivery_date\n        AND da.delivery_slot_id=v_first.delivery_slot_id\n        AND da.service_area_id=v_first.service_area_id\n    ) THEN RAISE EXCEPTION ''Collection is not linked to the staff delivery assignment'' USING ERRCODE=''42501''; END IF;',
    E'    IF NOT (v_first.order_type=''subscription'' AND EXISTS (\n      SELECT 1 FROM public.subscription_deliveries sd\n      WHERE sd.order_id=v_first.id AND sd.assigned_staff_id=v_actor AND sd.status=''delivered''\n    )) AND NOT EXISTS (\n      SELECT 1 FROM public.delivery_assignment_orders dao\n      JOIN public.delivery_assignments da ON da.id=dao.delivery_assignment_id\n      WHERE dao.order_id=v_first.id AND da.staff_id=v_actor\n        AND da.delivery_date=v_first.delivery_date\n        AND da.delivery_slot_id=v_first.delivery_slot_id\n        AND da.service_area_id=v_first.service_area_id\n    ) THEN RAISE EXCEPTION ''Collection is not linked to the staff delivery assignment'' USING ERRCODE=''42501''; END IF;');
  IF v_next=v_def OR pg_catalog.strpos(v_next, 'subscription_deliveries sd')=0 THEN
    RAISE EXCEPTION 'COD handover patch did not match the expected source';
  END IF;
  EXECUTE v_next;
END;
$patch$;

-- Staff's unhanded collection queue includes their completed subscription runs
-- as well as legacy one-time delivery assignments.
DO $patch$
DECLARE v_def text; v_next text;
BEGIN
  v_def:=pg_catalog.pg_get_functiondef('private.get_my_unhanded_cod_collections()'::regprocedure);
  v_next:=pg_catalog.replace(v_def,
    E'  JOIN public.delivery_assignment_orders dao ON dao.order_id=o.id\n  JOIN public.delivery_assignments da ON da.id=dao.delivery_assignment_id',
    E'  LEFT JOIN public.delivery_assignment_orders dao ON dao.order_id=o.id\n  LEFT JOIN public.delivery_assignments da ON da.id=dao.delivery_assignment_id');
  v_next:=pg_catalog.replace(v_next,
    E'    AND da.delivery_date=o.delivery_date AND da.delivery_slot_id=o.delivery_slot_id\n    AND da.service_area_id=o.service_area_id AND o.status=''delivered''\n    AND o.order_type=''one_time'' AND o.payment_method=''cod''',
    E'    AND o.status=''delivered'' AND o.order_type IN (''one_time'',''subscription'') AND o.payment_method=''cod''\n    AND ((o.order_type=''subscription'' AND EXISTS (SELECT 1 FROM public.subscription_deliveries sd WHERE sd.order_id=o.id AND sd.assigned_staff_id=auth.uid() AND sd.status=''delivered'')) OR (o.order_type=''one_time'' AND dao.order_id IS NOT NULL AND da.staff_id=auth.uid() AND da.delivery_date=o.delivery_date AND da.delivery_slot_id=o.delivery_slot_id AND da.service_area_id=o.service_area_id))');
  IF v_next=v_def OR pg_catalog.strpos(v_next, 'subscription_deliveries sd')=0 THEN
    RAISE EXCEPTION 'Staff COD handover queue patch did not match the expected source';
  END IF;
  EXECUTE v_next;
END;
$patch$;

-- Owner/admin financial report includes COD subscription delivery orders.
DO $patch$
DECLARE v_def text; v_next text;
BEGIN
  v_def:=pg_catalog.pg_get_functiondef(
    'private.get_admin_cod_financial_report(date,date,uuid,uuid)'::regprocedure
  );
  v_next:=pg_catalog.replace(v_def,
    'o.order_type=''one_time''',
    'o.order_type IN (''one_time'',''subscription'')');
  v_next:=pg_catalog.replace(v_next,
    'o.order_type = ''one_time''',
    'o.order_type IN (''one_time'',''subscription'')');
  IF v_next=v_def THEN
    RAISE EXCEPTION 'Admin COD financial report patch did not match expected one-time filter';
  END IF;
  EXECUTE v_next;
END;
$patch$;

COMMENT ON CONSTRAINT chk_order_subscription_link ON public.orders IS
  'Subscription delivery orders may be COD pending until that specific delivery cash is verified, or legacy online captured; one-time COD rules remain separate.';
COMMENT ON CONSTRAINT chk_subscription_payment_cod_or_online ON public.payments IS
  'Subscription plan agreement uses COD; each delivery has a separate order-scoped COD payment. Online methods remain permitted only for explicit gateway scope.';

COMMIT;
