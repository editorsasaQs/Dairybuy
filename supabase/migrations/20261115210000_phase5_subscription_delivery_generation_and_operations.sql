-- Phase 5.4: paid-only subscription delivery generation, stock reservation and staff operations.
BEGIN;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS delivery_generation_last_date date;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS subscription_delivery_id uuid,
  ADD COLUMN IF NOT EXISTS subscription_discount_paise integer NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS chk_order_total_match,
  ADD CONSTRAINT chk_order_total_match
    CHECK (total_paise = subtotal_paise + delivery_fee_paise - subscription_discount_paise),
  ADD CONSTRAINT chk_order_subscription_link
    CHECK (
      (order_type='subscription' AND subscription_id IS NOT NULL
        AND subscription_delivery_id IS NOT NULL AND delivery_date IS NOT NULL
        AND payment_method='online' AND payment_status='captured')
      OR
      (order_type='one_time' AND subscription_id IS NULL AND subscription_delivery_id IS NULL
        AND subscription_discount_paise=0)
    ),
  ADD CONSTRAINT chk_order_subscription_discount
    CHECK (subscription_discount_paise>=0 AND subscription_discount_paise<=subtotal_paise+delivery_fee_paise);

ALTER TABLE public.orders
  ADD CONSTRAINT fk_orders_subscription_delivery
  FOREIGN KEY (subscription_delivery_id) REFERENCES public.subscription_deliveries(id) ON DELETE RESTRICT;

ALTER TABLE public.subscription_deliveries
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS subtotal_paise integer,
  ADD COLUMN IF NOT EXISTS discount_paise integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paise integer;

ALTER TABLE public.subscription_deliveries
  ADD CONSTRAINT chk_subscription_delivery_daily_totals
  CHECK (
    (subtotal_paise IS NULL AND total_paise IS NULL)
    OR
    (subtotal_paise>=0 AND discount_paise>=0 AND discount_paise<=subtotal_paise
      AND total_paise=subtotal_paise-discount_paise)
  );

ALTER TABLE public.subscription_deliveries
  ADD CONSTRAINT fk_subscription_deliveries_order
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_subscription_delivery
  ON public.orders(subscription_delivery_id) WHERE subscription_delivery_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_deliveries_order
  ON public.subscription_deliveries(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscription_delivery_generation
  ON public.subscriptions(status,next_delivery_date)
  WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_subscription_deliveries_staff_date
  ON public.subscription_deliveries(assigned_staff_id,delivery_date,status);

COMMENT ON COLUMN public.orders.subscription_discount_paise IS
  'Per-delivery allocation of the prepaid subscription basket discount; one-time COD orders always keep this at zero.';
COMMENT ON COLUMN public.orders.subscription_delivery_id IS
  'Unique subscription delivery event represented by this fulfilment order.';
COMMENT ON COLUMN public.subscription_deliveries.order_id IS
  'One generated fulfilment order for this subscription delivery; null only for skipped or not-yet-generated rows.';

-- Preserve the address captured when the customer purchased the subscription, even if
-- the customer edits their saved address before a future delivery is generated.
CREATE OR REPLACE FUNCTION private.enforce_order_delivery_address_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_address public.customer_addresses%ROWTYPE;
  v_sub public.subscriptions%ROWTYPE;
  v_snapshot jsonb;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.order_type='subscription' THEN
      SELECT s.* INTO v_sub
      FROM public.subscriptions s
      WHERE s.id=NEW.subscription_id
        AND s.customer_id=NEW.customer_id
        AND s.customer_address_id=NEW.customer_address_id
        AND s.service_area_id=NEW.service_area_id
        AND s.payment_verified_at IS NOT NULL
      FOR SHARE;
      IF NOT FOUND OR v_sub.address_snapshot IS NULL THEN
        RAISE EXCEPTION 'Paid subscription address snapshot is unavailable'
          USING ERRCODE='23514';
      END IF;
      v_snapshot:=pg_catalog.jsonb_build_object(
        'schema_version',1,
        'recipient_name',v_sub.address_snapshot->>'recipient_name',
        'phone',v_sub.address_snapshot->>'phone',
        'address_line1',v_sub.address_snapshot->>'address_line1',
        'address_line2',v_sub.address_snapshot->'address_line2',
        'landmark',v_sub.address_snapshot->'landmark',
        'city',v_sub.address_snapshot->>'city',
        'state',v_sub.address_snapshot->>'state',
        'pincode',v_sub.address_snapshot->>'pincode',
        'service_area_id',v_sub.service_area_id::text
      );
      IF pg_catalog.jsonb_typeof(v_snapshot)<>'object'
         OR NULLIF(pg_catalog.btrim(v_snapshot->>'recipient_name'),'') IS NULL
         OR NULLIF(pg_catalog.btrim(v_snapshot->>'phone'),'') IS NULL
         OR NULLIF(pg_catalog.btrim(v_snapshot->>'address_line1'),'') IS NULL
         OR NULLIF(pg_catalog.btrim(v_snapshot->>'city'),'') IS NULL
         OR NULLIF(pg_catalog.btrim(v_snapshot->>'state'),'') IS NULL
         OR NULLIF(pg_catalog.btrim(v_snapshot->>'pincode'),'') IS NULL THEN
        RAISE EXCEPTION 'Subscription address snapshot is incomplete'
          USING ERRCODE='23514';
      END IF;
      NEW.delivery_address_snapshot:=v_snapshot;
      NEW.delivery_address_snapshot_source:='checkout';
      NEW.delivery_address_snapshot_at:=pg_catalog.transaction_timestamp();
      RETURN NEW;
    END IF;

    SELECT a.* INTO v_address
    FROM public.customer_addresses a
    WHERE a.id=NEW.customer_address_id AND a.customer_id=NEW.customer_id
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order address does not belong to the order customer'
        USING ERRCODE='23514';
    END IF;
    IF v_address.service_area_id IS DISTINCT FROM NEW.service_area_id
       OR NOT EXISTS (
         SELECT 1 FROM public.service_areas sa
         JOIN public.service_area_pincodes sp ON sp.service_area_id=sa.id
         WHERE sa.id=v_address.service_area_id AND sa.is_active
           AND sp.is_active AND sp.pincode=v_address.pincode
       ) THEN
      RAISE EXCEPTION 'Order address is not serviceable for the selected service area'
        USING ERRCODE='23514';
    END IF;
    NEW.delivery_address_snapshot:=pg_catalog.jsonb_build_object(
      'schema_version',1,'recipient_name',v_address.recipient_name,'phone',v_address.phone,
      'address_line1',v_address.address_line1,'address_line2',v_address.address_line2,
      'landmark',v_address.landmark,'city',v_address.city,'state',v_address.state,
      'pincode',v_address.pincode,'service_area_id',v_address.service_area_id
    );
    NEW.delivery_address_snapshot_source:='checkout';
    NEW.delivery_address_snapshot_at:=pg_catalog.transaction_timestamp();
    RETURN NEW;
  END IF;

  IF ROW(NEW.delivery_address_snapshot,NEW.delivery_address_snapshot_source,NEW.delivery_address_snapshot_at)
     IS DISTINCT FROM ROW(OLD.delivery_address_snapshot,OLD.delivery_address_snapshot_source,OLD.delivery_address_snapshot_at) THEN
    RAISE EXCEPTION 'Order delivery address snapshots are immutable' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- Generator is service-role-only. It creates one date's deliveries atomically and only
-- for a subscription whose full online payment is captured and server-verified.
CREATE OR REPLACE FUNCTION private.generate_subscription_deliveries(p_delivery_date date)
RETURNS TABLE(generated_count integer,skipped_count integer,replayed_count integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
  v_delivery_id uuid;
  v_order_id uuid;
  v_order_number varchar;
  v_item record;
  v_vendor_id varchar(100);
  v_vendor_name varchar(200);
  v_subtotal bigint;
  v_discount integer;
  v_total bigint;
  v_days_consumed integer;
  v_req record;
  v_inventory public.inventory%ROWTYPE;
  v_line_total bigint;
  v_generated integer:=0;
  v_skipped integer:=0;
  v_replayed integer:=0;
  v_local_date date:=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role is required to generate subscription deliveries'
      USING ERRCODE='42501';
  END IF;
  IF p_delivery_date IS NULL OR p_delivery_date<v_local_date THEN
    RAISE EXCEPTION 'Delivery generation date must be today or a future Kolkata date'
      USING ERRCODE='22023';
  END IF;

  FOR v_sub IN
    SELECT s.* FROM public.subscriptions s
    WHERE s.status='active'
      AND s.payment_verified_at IS NOT NULL
      AND s.next_delivery_date=p_delivery_date
      AND s.start_date<=p_delivery_date AND s.end_date>=p_delivery_date
      AND EXISTS (SELECT 1 FROM public.payments p
        WHERE p.subscription_id=s.id AND p.status='captured'
          AND p.gateway_payment_id IS NOT NULL AND p.method IN ('online','upi','card')
          AND p.gateway<>'cod')
    ORDER BY s.id
    FOR UPDATE OF s SKIP LOCKED
  LOOP
    IF EXISTS (SELECT 1 FROM public.subscription_skip_records sr
      WHERE sr.subscription_id=v_sub.id AND sr.skip_date=p_delivery_date) THEN
      INSERT INTO public.subscription_deliveries(
        subscription_id,delivery_date,delivery_slot_id,status,subtotal_paise,discount_paise,total_paise,delivery_notes
      ) VALUES(v_sub.id,p_delivery_date,v_sub.delivery_slot_id,'skipped',
        v_subtotal::integer,v_discount,v_total::integer,'Customer skipped this delivery')
      ON CONFLICT (subscription_id,delivery_date,delivery_slot_id) DO NOTHING;
      UPDATE public.subscriptions
      SET next_delivery_date=CASE WHEN p_delivery_date>=end_date THEN NULL ELSE p_delivery_date+1 END,
          delivery_generation_last_date=p_delivery_date,updated_at=pg_catalog.now()
      WHERE id=v_sub.id;
      v_skipped:=v_skipped+1;
      SELECT (SELECT count(*) FROM public.subscription_deliveries d
                WHERE d.subscription_id=v_sub.id AND d.status='delivered')
             +(SELECT count(*) FROM public.subscription_skip_records sr
                WHERE sr.subscription_id=v_sub.id)
        INTO v_days_consumed;
      IF v_days_consumed>=COALESCE(v_sub.duration_days,CASE v_sub.plan_type WHEN '7_day' THEN 7 ELSE 30 END) THEN
        UPDATE public.subscriptions SET status='completed',next_delivery_date=NULL,updated_at=pg_catalog.now()
        WHERE id=v_sub.id;
      END IF;
      CONTINUE;
    END IF;

    SELECT d.id,d.order_id INTO v_delivery_id,v_order_id
    FROM public.subscription_deliveries d
    WHERE d.subscription_id=v_sub.id AND d.delivery_date=p_delivery_date
      AND d.delivery_slot_id=v_sub.delivery_slot_id;
    IF FOUND THEN
      v_replayed:=v_replayed+1;
      UPDATE public.subscriptions
      SET next_delivery_date=CASE WHEN p_delivery_date>=end_date THEN NULL ELSE p_delivery_date+1 END,
          delivery_generation_last_date=p_delivery_date,updated_at=pg_catalog.now()
      WHERE id=v_sub.id;
      CONTINUE;
    END IF;

    INSERT INTO public.subscription_deliveries(
      subscription_id,delivery_date,delivery_slot_id,status,subtotal_paise,discount_paise,total_paise
    )
    VALUES(v_sub.id,p_delivery_date,v_sub.delivery_slot_id,'scheduled',
      v_subtotal::integer,v_discount,v_total::integer)
    ON CONFLICT (subscription_id,delivery_date,delivery_slot_id) DO NOTHING
    RETURNING id INTO v_delivery_id;
    IF v_delivery_id IS NULL THEN
      v_replayed:=v_replayed+1;
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(si.price_per_delivery_paise::bigint*si.quantity),0)
      INTO v_subtotal
    FROM public.subscription_items si WHERE si.subscription_id=v_sub.id;
    IF v_subtotal<=0 OR v_subtotal>2147483647 THEN
      RAISE EXCEPTION 'Subscription daily total is invalid for %',v_sub.id USING ERRCODE='23514';
    END IF;
    v_discount:=CASE WHEN v_sub.plan_type='30_day' THEN 200 ELSE 0 END;
    IF v_discount>v_subtotal THEN
      RAISE EXCEPTION 'Daily subscription discount exceeds daily subtotal' USING ERRCODE='23514';
    END IF;
    v_total:=v_subtotal-v_discount;

    INSERT INTO public.orders(
      customer_id,customer_address_id,service_area_id,delivery_slot_id,order_type,status,
      subtotal_paise,delivery_fee_paise,total_paise,payment_status,payment_method,
      delivery_date,subscription_id,subscription_delivery_id,subscription_discount_paise
    ) VALUES(
      v_sub.customer_id,v_sub.customer_address_id,v_sub.service_area_id,v_sub.delivery_slot_id,
      'subscription','pending_confirmation',v_subtotal::integer,0,v_total::integer,
      'captured','online',p_delivery_date,v_sub.id,v_delivery_id,v_discount
    ) RETURNING id,order_number INTO v_order_id,v_order_number;

    FOR v_item IN
      SELECT si.*,pv.variant_name,p.name AS product_name,pv.brand,pv.pack_size
      FROM public.subscription_items si
      JOIN public.product_variants pv ON pv.id=si.product_variant_id
      JOIN public.products p ON p.id=pv.product_id
      WHERE si.subscription_id=v_sub.id
      ORDER BY si.id
    LOOP
      SELECT c.new_vendor_id INTO v_vendor_id
      FROM public.subscription_item_vendor_changes c
      WHERE c.subscription_item_id=v_item.id AND c.effective_from<=p_delivery_date
      ORDER BY c.effective_from DESC LIMIT 1;
      v_vendor_id:=COALESCE(v_vendor_id,v_item.vendor_id);
      SELECT v.name INTO v_vendor_name FROM public.vendors v WHERE v.id=v_vendor_id;
      IF v_vendor_id IS NULL OR v_vendor_name IS NULL THEN
        RAISE EXCEPTION 'Subscription vendor snapshot is unavailable' USING ERRCODE='23514';
      END IF;

      v_line_total:=v_item.price_per_delivery_paise::bigint*v_item.quantity;
      INSERT INTO public.order_items(
        order_id,product_variant_id,vendor_id,milk_type,quantity,unit_price_paise,total_price_paise,
        quantity_litres,product_name_snapshot,variant_name_snapshot,brand_snapshot,
        pack_size_snapshot,vendor_name_snapshot
      ) VALUES(
        v_order_id,v_item.product_variant_id,v_vendor_id,v_item.milk_type,v_item.quantity,
        v_item.price_per_delivery_paise,v_line_total::integer,v_item.quantity_litres,
        v_item.product_name_snapshot,COALESCE(v_item.variant_name_snapshot,v_item.variant_name),
        v_item.brand,v_item.pack_size,v_vendor_name
      );
    END LOOP;

    -- Reserve each selected SKU pack count in deterministic variant order. The order
    -- transaction is rolled back in full if any required stock row is missing/short.
    FOR v_req IN
      SELECT req.variant_id,SUM(req.pack_count)::integer AS pack_count
      FROM (
        SELECT pv1.id AS variant_id,
          (pg_catalog.floor(si.quantity_litres)::integer*si.quantity)::bigint AS pack_count
        FROM public.subscription_items si
        JOIN public.product_variants chosen ON chosen.id=si.product_variant_id
        JOIN public.product_variants pv1 ON pv1.product_id=chosen.product_id
          AND pv1.unit_quantity=1 AND pv1.is_orderable
        WHERE si.subscription_id=v_sub.id AND si.quantity_litres>0.5
        UNION ALL
        SELECT pvhalf.id AS variant_id,si.quantity::bigint AS pack_count
        FROM public.subscription_items si
        JOIN public.product_variants chosen ON chosen.id=si.product_variant_id
        JOIN public.product_variants pvhalf ON pvhalf.product_id=chosen.product_id
          AND pvhalf.unit_quantity=0.5 AND pvhalf.is_orderable
        WHERE si.subscription_id=v_sub.id
          AND (si.quantity_litres=0.5 OR si.quantity_litres-pg_catalog.floor(si.quantity_litres)=0.5)
      ) req
      GROUP BY req.variant_id ORDER BY req.variant_id
    LOOP
      SELECT i.* INTO v_inventory FROM public.inventory i
      WHERE i.product_variant_id=v_req.variant_id AND i.service_area_id=v_sub.service_area_id
      FOR UPDATE;
      IF NOT FOUND OR v_inventory.available_stock-v_inventory.reserved_stock-v_inventory.safety_stock<v_req.pack_count THEN
        RAISE EXCEPTION 'Insufficient or unconfigured subscription stock for SKU %',v_req.variant_id
          USING ERRCODE='23514';
      END IF;
      UPDATE public.inventory SET reserved_stock=reserved_stock+v_req.pack_count,updated_at=pg_catalog.now()
      WHERE id=v_inventory.id;
      INSERT INTO public.inventory_movements(inventory_id,change_amount,movement_type,reference_id,notes,created_by)
      VALUES(v_inventory.id,v_req.pack_count,'order_reservation',v_order_id::text,
        'Prepaid subscription delivery stock reservation',NULL);
    END LOOP;

    UPDATE public.subscription_deliveries SET order_id=v_order_id WHERE id=v_delivery_id;
    UPDATE public.subscriptions
    SET next_delivery_date=CASE WHEN p_delivery_date>=end_date THEN NULL ELSE p_delivery_date+1 END,
        delivery_generation_last_date=p_delivery_date,updated_at=pg_catalog.now()
    WHERE id=v_sub.id;
    v_generated:=v_generated+1;
  END LOOP;

  RETURN QUERY SELECT v_generated,v_skipped,v_replayed;
END;
$function$;

REVOKE ALL ON FUNCTION private.generate_subscription_deliveries(date)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.generate_subscription_deliveries(date) TO service_role;

CREATE OR REPLACE FUNCTION public.generate_subscription_deliveries(p_delivery_date date)
RETURNS TABLE(generated_count integer,skipped_count integer,replayed_count integer)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $wrapper$ SELECT * FROM private.generate_subscription_deliveries(p_delivery_date); $wrapper$;
REVOKE ALL ON FUNCTION public.generate_subscription_deliveries(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_subscription_deliveries(date) TO service_role;

-- Owner/admin assigns an already generated subscription delivery to a staff member.
CREATE OR REPLACE FUNCTION private.assign_subscription_delivery(p_delivery_id uuid,p_staff_id uuid)
RETURNS TABLE(delivery_id uuid,assigned_staff_id uuid,delivery_status public.delivery_status_enum,was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_actor uuid:=auth.uid(); v_delivery public.subscription_deliveries%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only owner/admin can assign subscription deliveries' USING ERRCODE='42501';
  END IF;
  IF p_delivery_id IS NULL OR p_staff_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id=p_staff_id
      AND ur.role IN ('owner','admin','manager','operations_staff')
  ) THEN
    RAISE EXCEPTION 'A valid delivery and staff account are required' USING ERRCODE='22023';
  END IF;
  SELECT d.* INTO v_delivery FROM public.subscription_deliveries d
  WHERE d.id=p_delivery_id FOR UPDATE;
  IF NOT FOUND OR v_delivery.order_id IS NULL THEN
    RAISE EXCEPTION 'Generated subscription delivery not found' USING ERRCODE='P0002';
  END IF;
  IF v_delivery.assigned_staff_id=p_staff_id AND v_delivery.status IN ('assigned','out_for_delivery') THEN
    RETURN QUERY SELECT v_delivery.id,v_delivery.assigned_staff_id,v_delivery.status,true; RETURN;
  END IF;
  IF v_delivery.status<>'scheduled' THEN
    RAISE EXCEPTION 'Only scheduled subscription deliveries can be assigned' USING ERRCODE='23514';
  END IF;
  UPDATE public.subscription_deliveries SET assigned_staff_id=p_staff_id,status='assigned',assigned_at=pg_catalog.now()
  WHERE id=p_delivery_id;
  UPDATE public.orders SET status='confirmed',updated_at=pg_catalog.now()
  WHERE id=v_delivery.order_id AND status='pending_confirmation';
  INSERT INTO public.order_status_history(order_id,from_status,to_status,changed_by,note)
  VALUES(v_delivery.order_id,'pending_confirmation','confirmed',v_actor,'Subscription delivery assigned');
  RETURN QUERY SELECT p_delivery_id,p_staff_id,'assigned'::public.delivery_status_enum,false;
END;
$function$;

CREATE OR REPLACE FUNCTION private.start_subscription_delivery(p_delivery_id uuid)
RETURNS TABLE(delivery_id uuid,delivery_status public.delivery_status_enum,was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_actor uuid:=auth.uid(); v_delivery public.subscription_deliveries%ROWTYPE; v_order public.orders%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT d.* INTO v_delivery FROM public.subscription_deliveries d
  WHERE d.id=p_delivery_id FOR UPDATE;
  IF NOT FOUND OR v_delivery.order_id IS NULL THEN RAISE EXCEPTION 'Subscription delivery not found' USING ERRCODE='P0002'; END IF;
  IF NOT private.is_admin_or_owner() AND NOT (v_delivery.assigned_staff_id=v_actor AND private.is_staff()) THEN
    RAISE EXCEPTION 'Only assigned staff or owner/admin can start this delivery' USING ERRCODE='42501';
  END IF;
  IF v_delivery.status='out_for_delivery' THEN
    RETURN QUERY SELECT v_delivery.id,v_delivery.status,true; RETURN;
  END IF;
  IF v_delivery.status<>'assigned' THEN RAISE EXCEPTION 'Delivery must be assigned before dispatch' USING ERRCODE='23514'; END IF;
  SELECT o.* INTO v_order FROM public.orders o WHERE o.id=v_delivery.order_id FOR UPDATE;
  IF v_order.status<>'confirmed' THEN RAISE EXCEPTION 'Subscription order is not confirmed' USING ERRCODE='23514'; END IF;
  UPDATE public.orders SET status='processing',updated_at=pg_catalog.now() WHERE id=v_order.id;
  INSERT INTO public.order_status_history(order_id,from_status,to_status,changed_by,note)
  VALUES(v_order.id,'confirmed','processing',v_actor,'Subscription delivery prepared');
  UPDATE public.orders SET status='out_for_delivery',updated_at=pg_catalog.now() WHERE id=v_order.id;
  INSERT INTO public.order_status_history(order_id,from_status,to_status,changed_by,note)
  VALUES(v_order.id,'processing','out_for_delivery',v_actor,'Subscription delivery dispatched');
  UPDATE public.subscription_deliveries SET status='out_for_delivery' WHERE id=p_delivery_id;
  RETURN QUERY SELECT p_delivery_id,'out_for_delivery'::public.delivery_status_enum,false;
END;
$function$;

CREATE OR REPLACE FUNCTION private.complete_subscription_delivery(p_delivery_id uuid)
RETURNS TABLE(delivery_id uuid,delivery_status public.delivery_status_enum,was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_actor uuid:=auth.uid(); v_delivery public.subscription_deliveries%ROWTYPE; v_order public.orders%ROWTYPE;
  v_inv record; v_reserved integer; v_consumed integer:=0; v_sub public.subscriptions%ROWTYPE; v_days integer;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT d.* INTO v_delivery FROM public.subscription_deliveries d
  WHERE d.id=p_delivery_id FOR UPDATE;
  IF NOT FOUND OR v_delivery.order_id IS NULL THEN RAISE EXCEPTION 'Subscription delivery not found' USING ERRCODE='P0002'; END IF;
  IF NOT private.is_admin_or_owner() AND NOT (v_delivery.assigned_staff_id=v_actor AND private.is_staff()) THEN
    RAISE EXCEPTION 'Only assigned staff or owner/admin can complete this delivery' USING ERRCODE='42501';
  END IF;
  IF v_delivery.status='delivered' THEN
    RETURN QUERY SELECT v_delivery.id,v_delivery.status,true; RETURN;
  END IF;
  IF v_delivery.status<>'out_for_delivery' THEN RAISE EXCEPTION 'Only out-for-delivery subscriptions can be completed' USING ERRCODE='23514'; END IF;
  SELECT o.* INTO v_order FROM public.orders o WHERE o.id=v_delivery.order_id FOR UPDATE;
  IF v_order.status<>'out_for_delivery' OR v_order.order_type<>'subscription' THEN
    RAISE EXCEPTION 'Subscription order is not ready for delivery completion' USING ERRCODE='23514';
  END IF;

  FOR v_inv IN
    SELECT i.id,i.available_stock,i.reserved_stock
    FROM public.inventory i
    WHERE EXISTS (SELECT 1 FROM public.inventory_movements im
      WHERE im.inventory_id=i.id AND im.reference_id=v_order.id::text
        AND im.movement_type IN ('order_reservation','order_reservation_release'))
    ORDER BY i.id FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(im.change_amount),0)::integer INTO v_reserved
    FROM public.inventory_movements im WHERE im.inventory_id=v_inv.id
      AND im.reference_id=v_order.id::text
      AND im.movement_type IN ('order_reservation','order_reservation_release');
    IF v_reserved<=0 OR v_inv.reserved_stock<v_reserved OR v_inv.available_stock<v_reserved THEN
      RAISE EXCEPTION 'Subscription inventory reservation is inconsistent' USING ERRCODE='23514';
    END IF;
    UPDATE public.inventory SET available_stock=available_stock-v_reserved,
      reserved_stock=reserved_stock-v_reserved,updated_at=pg_catalog.now() WHERE id=v_inv.id;
    INSERT INTO public.inventory_movements(inventory_id,change_amount,movement_type,reference_id,notes,created_by)
    VALUES(v_inv.id,-v_reserved,'order_fulfilled',v_order.id::text,
      'Prepaid subscription delivery fulfilled',v_actor);
    v_consumed:=v_consumed+1;
  END LOOP;
  IF v_consumed=0 THEN RAISE EXCEPTION 'Subscription inventory reservation is missing' USING ERRCODE='23514'; END IF;

  UPDATE public.orders SET status='delivered',updated_at=pg_catalog.now() WHERE id=v_order.id;
  INSERT INTO public.order_status_history(order_id,from_status,to_status,changed_by,note)
  VALUES(v_order.id,'out_for_delivery','delivered',v_actor,'Subscription delivery completed');
  UPDATE public.subscription_deliveries SET status='delivered',delivered_at=pg_catalog.now()
  WHERE id=p_delivery_id;

  SELECT s.* INTO v_sub FROM public.subscriptions s WHERE s.id=v_delivery.subscription_id FOR UPDATE;
  v_days:=COALESCE(v_sub.duration_days,CASE v_sub.plan_type WHEN '7_day' THEN 7 ELSE 30 END);
  IF (SELECT count(*) FROM public.subscription_deliveries d
      WHERE d.subscription_id=v_sub.id AND d.status='delivered')
     +(SELECT count(*) FROM public.subscription_skip_records sr WHERE sr.subscription_id=v_sub.id)>=v_days THEN
    UPDATE public.subscriptions SET status='completed',next_delivery_date=NULL,updated_at=pg_catalog.now()
    WHERE id=v_sub.id;
  END IF;
  RETURN QUERY SELECT p_delivery_id,'delivered'::public.delivery_status_enum,false;
END;
$function$;

CREATE OR REPLACE FUNCTION private.fail_subscription_delivery(p_delivery_id uuid,p_reason text)
RETURNS TABLE(delivery_id uuid,delivery_status public.delivery_status_enum,was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_actor uuid:=auth.uid(); v_delivery public.subscription_deliveries%ROWTYPE; v_order public.orders%ROWTYPE;
  v_inv record; v_reserved integer; v_released integer:=0; v_reason text:=NULLIF(pg_catalog.btrim(p_reason),'');
BEGIN
  IF v_actor IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only owner/admin can resolve a failed subscription delivery' USING ERRCODE='42501';
  END IF;
  IF p_reason IS NULL OR pg_catalog.length(p_reason)>500 THEN
    RAISE EXCEPTION 'A failure reason of 1 to 500 characters is required' USING ERRCODE='22023';
  END IF;
  SELECT d.* INTO v_delivery FROM public.subscription_deliveries d
  WHERE d.id=p_delivery_id FOR UPDATE;
  IF NOT FOUND OR v_delivery.order_id IS NULL THEN RAISE EXCEPTION 'Subscription delivery not found' USING ERRCODE='P0002'; END IF;
  IF v_delivery.status='failed' THEN RETURN QUERY SELECT v_delivery.id,v_delivery.status,true; RETURN; END IF;
  IF v_delivery.status NOT IN ('assigned','out_for_delivery') THEN
    RAISE EXCEPTION 'Only assigned or dispatched deliveries can be marked failed' USING ERRCODE='23514';
  END IF;
  SELECT o.* INTO v_order FROM public.orders o WHERE o.id=v_delivery.order_id FOR UPDATE;
  FOR v_inv IN
    SELECT i.id,i.reserved_stock FROM public.inventory i
    WHERE EXISTS (SELECT 1 FROM public.inventory_movements im
      WHERE im.inventory_id=i.id AND im.reference_id=v_order.id::text
        AND im.movement_type IN ('order_reservation','order_reservation_release'))
    ORDER BY i.id FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(im.change_amount),0)::integer INTO v_reserved
    FROM public.inventory_movements im WHERE im.inventory_id=v_inv.id
      AND im.reference_id=v_order.id::text
      AND im.movement_type IN ('order_reservation','order_reservation_release');
    IF v_reserved<0 OR v_inv.reserved_stock<v_reserved THEN
      RAISE EXCEPTION 'Subscription inventory reservation is inconsistent' USING ERRCODE='23514';
    END IF;
    IF v_reserved>0 THEN
      UPDATE public.inventory SET reserved_stock=reserved_stock-v_reserved,updated_at=pg_catalog.now()
      WHERE id=v_inv.id;
      INSERT INTO public.inventory_movements(inventory_id,change_amount,movement_type,reference_id,notes,created_by)
      VALUES(v_inv.id,-v_reserved,'order_reservation_release',v_order.id::text,
        'Failed subscription delivery; release reserved stock: '||v_reason,v_actor);
      v_released:=v_released+1;
    END IF;
  END LOOP;
  IF v_released=0 THEN RAISE EXCEPTION 'Subscription inventory reservation is missing' USING ERRCODE='23514'; END IF;
  UPDATE public.orders SET status='failed',updated_at=pg_catalog.now() WHERE id=v_order.id;
  INSERT INTO public.order_status_history(order_id,from_status,to_status,changed_by,note)
  VALUES(v_order.id,v_order.status,'failed',v_actor,v_reason);
  UPDATE public.subscription_deliveries SET status='failed',failed_at=pg_catalog.now(),delivery_notes=v_reason
  WHERE id=p_delivery_id;
  RETURN QUERY SELECT p_delivery_id,'failed'::public.delivery_status_enum,false;
END;
$function$;

-- Exposed wrappers: generation is service-role only; operations require authenticated users.
REVOKE ALL ON FUNCTION private.assign_subscription_delivery(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.start_subscription_delivery(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.complete_subscription_delivery(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.fail_subscription_delivery(uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.assign_subscription_delivery(p_delivery_id uuid,p_staff_id uuid)
RETURNS TABLE(delivery_id uuid,assigned_staff_id uuid,delivery_status public.delivery_status_enum,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $wrapper$ SELECT * FROM private.assign_subscription_delivery(p_delivery_id,p_staff_id); $wrapper$;
CREATE OR REPLACE FUNCTION public.start_subscription_delivery(p_delivery_id uuid)
RETURNS TABLE(delivery_id uuid,delivery_status public.delivery_status_enum,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $wrapper$ SELECT * FROM private.start_subscription_delivery(p_delivery_id); $wrapper$;
CREATE OR REPLACE FUNCTION public.complete_subscription_delivery(p_delivery_id uuid)
RETURNS TABLE(delivery_id uuid,delivery_status public.delivery_status_enum,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $wrapper$ SELECT * FROM private.complete_subscription_delivery(p_delivery_id); $wrapper$;
CREATE OR REPLACE FUNCTION public.fail_subscription_delivery(p_delivery_id uuid,p_reason text)
RETURNS TABLE(delivery_id uuid,delivery_status public.delivery_status_enum,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $wrapper$ SELECT * FROM private.fail_subscription_delivery(p_delivery_id,p_reason); $wrapper$;

REVOKE ALL ON FUNCTION public.assign_subscription_delivery(uuid,uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.start_subscription_delivery(uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.complete_subscription_delivery(uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.fail_subscription_delivery(uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.assign_subscription_delivery(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_subscription_delivery(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_subscription_delivery(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_subscription_delivery(uuid,text) TO authenticated;

-- Subscription fulfilment audit uses the same immutable movement ledger as one-time COD,
-- but never conflates subscription prepaid orders with COD cash collection.
CREATE OR REPLACE FUNCTION public.audit_inventory_reservations()
RETURNS TABLE(
  audit_type text,inventory_id uuid,order_id uuid,product_variant_id varchar,
  service_area_id uuid,recorded_reserved_stock integer,ledger_reserved_stock integer,
  order_status text,detail text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Not authorized to audit inventory reservations' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH inventory_ledger AS (
    SELECT im.inventory_id,COALESCE(SUM(im.change_amount) FILTER (
      WHERE im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled')
    ),0)::integer AS ledger_reserved
    FROM public.inventory_movements im GROUP BY im.inventory_id
  )
  SELECT 'inventory_balance'::text,i.id,NULL::uuid,i.product_variant_id,i.service_area_id,
    i.reserved_stock,COALESCE(l.ledger_reserved,0),NULL::text,
    pg_catalog.format('inventory.reserved_stock (%s) differs from reservation ledger (%s)',
      i.reserved_stock,COALESCE(l.ledger_reserved,0))
  FROM public.inventory i LEFT JOIN inventory_ledger l ON l.inventory_id=i.id
  WHERE i.reserved_stock<>COALESCE(l.ledger_reserved,0)
  UNION ALL
  SELECT 'order_ledger'::text,im.inventory_id,o.id,i.product_variant_id,i.service_area_id,
    i.reserved_stock,
    SUM(im.change_amount) FILTER (WHERE im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled'))::integer,
    o.status::text,
    pg_catalog.format('order %s reservation ledger %s for %s; reservation/release/fulfilment rows %s/%s/%s',
      o.id,SUM(im.change_amount) FILTER (WHERE im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled')),
      o.status,count(*) FILTER (WHERE im.movement_type='order_reservation'),
      count(*) FILTER (WHERE im.movement_type='order_reservation_release'),
      count(*) FILTER (WHERE im.movement_type='order_fulfilled'))
  FROM public.inventory_movements im
  JOIN public.orders o ON o.id::text=im.reference_id
  JOIN public.inventory i ON i.id=im.inventory_id
  WHERE im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled')
    AND ((o.order_type='one_time' AND o.payment_method='cod') OR o.order_type='subscription')
  GROUP BY im.inventory_id,o.id,i.product_variant_id,i.service_area_id,i.reserved_stock,o.status
  HAVING
    SUM(im.change_amount) FILTER (WHERE im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled'))<0
    OR (o.status IN ('pending_confirmation','confirmed','processing','out_for_delivery')
      AND SUM(im.change_amount) FILTER (WHERE im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled'))<=0)
    OR (o.status IN ('cancelled','delivered','failed')
      AND SUM(im.change_amount) FILTER (WHERE im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled'))<>0)
    OR count(*) FILTER (WHERE im.movement_type='order_reservation')>1
    OR count(*) FILTER (WHERE im.movement_type='order_reservation_release')>1
    OR count(*) FILTER (WHERE im.movement_type='order_fulfilled')>1;
END;
$function$;

REVOKE ALL ON FUNCTION public.audit_inventory_reservations() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.audit_inventory_reservations() TO authenticated;

COMMIT;
