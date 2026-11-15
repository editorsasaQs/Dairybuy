-- Phase 5.1–5.2: secure subscription pricing and pending online-payment intent.
-- No subscription is activated and no delivery is generated until a trusted Phase 6
-- payment verification transition is introduced.
BEGIN;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS duration_days integer,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at date,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS address_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS delivery_slot_snapshot jsonb;

ALTER TABLE public.subscription_items
  ADD COLUMN IF NOT EXISTS product_name_snapshot text,
  ADD COLUMN IF NOT EXISTS variant_name_snapshot text,
  ADD COLUMN IF NOT EXISTS vendor_name_snapshot text,
  ADD COLUMN IF NOT EXISTS line_total_paise integer;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS chk_subscription_duration_days;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT chk_subscription_duration_days
  CHECK (duration_days IS NULL OR
    (plan_type='7_day' AND duration_days=7) OR
    (plan_type='30_day' AND duration_days=30));

ALTER TABLE public.subscription_items
  DROP CONSTRAINT IF EXISTS chk_subscription_item_line_total;
ALTER TABLE public.subscription_items
  ADD CONSTRAINT chk_subscription_item_line_total
  CHECK (line_total_paise IS NULL OR line_total_paise >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_customer_idempotency
  ON public.subscriptions(customer_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_payment_intent
  ON public.payments(subscription_id)
  WHERE subscription_id IS NOT NULL;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS chk_subscription_payment_online_only;
ALTER TABLE public.payments
  ADD CONSTRAINT chk_subscription_payment_online_only
  CHECK (subscription_id IS NULL OR (gateway <> 'cod' AND method IN ('online','upi','card')));

COMMENT ON COLUMN public.subscriptions.duration_days IS 'Fixed purchased delivery duration: 7 or 30 calendar delivery days; custom plans are not offered.';
COMMENT ON COLUMN public.subscriptions.idempotency_key IS 'Customer-scoped idempotency key for subscription checkout intent creation.';
COMMENT ON COLUMN public.subscriptions.payment_verified_at IS 'Set only by trusted server-side payment verification; never set by client checkout.';
COMMENT ON COLUMN public.subscriptions.address_snapshot IS 'Immutable checkout-time delivery address snapshot.';
COMMENT ON COLUMN public.subscription_items.line_total_paise IS 'Frozen line total for the full plan duration, before the one-time basket-level discount.';

-- Only customers/staff may read through existing RLS. All subscription writes go through RPCs.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.subscriptions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.subscription_items FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.subscription_deliveries FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.subscription_skip_records FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.subscription_vendor_changes FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.payments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.subscriptions, public.subscription_items,
  public.subscription_deliveries, public.subscription_skip_records,
  public.subscription_vendor_changes, public.payments TO authenticated;

CREATE OR REPLACE FUNCTION private.build_subscription_quote(
  p_address_id uuid,
  p_delivery_slot_id uuid,
  p_start_date date,
  p_plan_type public.subscription_plan_enum,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_customer uuid := auth.uid();
  v_days integer;
  v_area uuid;
  v_pincode varchar;
  v_address public.customer_addresses%ROWTYPE;
  v_slot public.delivery_slots%ROWTYPE;
  v_line record;
  v_product public.products%ROWTYPE;
  v_variant public.product_variants%ROWTYPE;
  v_vendor public.vendors%ROWTYPE;
  v_half public.product_variants%ROWTYPE;
  v_one public.product_variants%ROWTYPE;
  v_half_base integer;
  v_half_fee integer;
  v_half_total integer;
  v_one_base integer;
  v_one_fee integer;
  v_one_total integer;
  v_half_count bigint;
  v_one_count bigint;
  v_price integer;
  v_daily_line bigint;
  v_line_total bigint;
  v_subtotal bigint := 0;
  v_discount integer := 0;
  v_total bigint;
  v_lines jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_local timestamp;
BEGIN
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF p_address_id IS NULL OR p_delivery_slot_id IS NULL OR p_start_date IS NULL
     OR p_plan_type IS NULL OR p_items IS NULL OR pg_catalog.jsonb_typeof(p_items)<>'array' THEN
    RAISE EXCEPTION 'Address, delivery slot, start date, plan and milk items are required' USING ERRCODE='22023';
  END IF;
  v_days := CASE p_plan_type WHEN '7_day' THEN 7 WHEN '30_day' THEN 30 ELSE NULL END;
  IF v_days IS NULL THEN
    RAISE EXCEPTION 'Only fixed 7-day and 30-day subscriptions are supported' USING ERRCODE='22023';
  END IF;
  IF pg_catalog.jsonb_array_length(p_items)<1 OR pg_catalog.jsonb_array_length(p_items)>20 THEN
    RAISE EXCEPTION 'A subscription must contain 1 to 20 distinct milk lines' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_to_recordset(p_items) AS x(
      product_variant_id varchar,vendor_id varchar,milk_type public.milk_type_enum,
      quantity integer,quantity_litres numeric
    )
    WHERE x.product_variant_id IS NULL OR pg_catalog.btrim(x.product_variant_id)=''
       OR x.vendor_id IS NULL OR pg_catalog.btrim(x.vendor_id)=''
       OR x.milk_type IS NULL OR x.quantity IS NULL OR x.quantity<1 OR x.quantity>100
       OR x.quantity_litres IS NULL OR x.quantity_litres<0.5 OR x.quantity_litres>10
       OR x.quantity_litres*2<>pg_catalog.trunc(x.quantity_litres*2)
  ) THEN
    RAISE EXCEPTION 'Every subscription line must be valid milk with a 0.5 L increment and positive quantity' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_to_recordset(p_items) AS x(
      product_variant_id varchar,vendor_id varchar,milk_type public.milk_type_enum,
      quantity integer,quantity_litres numeric
    )
    GROUP BY x.product_variant_id,x.vendor_id,x.milk_type,x.quantity_litres
    HAVING pg_catalog.count(*)>1
  ) THEN
    RAISE EXCEPTION 'Duplicate subscription line selections are not allowed' USING ERRCODE='22023';
  END IF;

  v_local := pg_catalog.now() AT TIME ZONE 'Asia/Kolkata';
  IF p_start_date < v_local::date + 1 THEN
    RAISE EXCEPTION 'Subscription start date must be at least one day ahead' USING ERRCODE='23514';
  END IF;

  SELECT a.* INTO v_address
  FROM public.customer_addresses a
  WHERE a.id=p_address_id AND a.customer_id=v_customer;
  IF NOT FOUND OR v_address.service_area_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.service_areas sa
    JOIN public.service_area_pincodes sp ON sp.service_area_id=sa.id
    WHERE sa.id=v_address.service_area_id AND sa.is_active AND sp.is_active
      AND sp.pincode=v_address.pincode
  ) THEN
    RAISE EXCEPTION 'Selected address is not serviceable' USING ERRCODE='23514';
  END IF;
  v_area := v_address.service_area_id;

  SELECT ds.* INTO v_slot FROM public.delivery_slots ds
  WHERE ds.id=p_delivery_slot_id AND ds.is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected delivery slot is unavailable' USING ERRCODE='23514';
  END IF;

  FOR v_line IN
    SELECT x.* FROM pg_catalog.jsonb_to_recordset(p_items) AS x(
      product_variant_id varchar,vendor_id varchar,milk_type public.milk_type_enum,
      quantity integer,quantity_litres numeric
    )
    ORDER BY x.product_variant_id,x.vendor_id,x.milk_type,x.quantity_litres
  LOOP
    v_count := v_count+1;
    SELECT p.* INTO v_product
    FROM public.product_variants pv
    JOIN public.products p ON p.id=pv.product_id
    WHERE pv.id=v_line.product_variant_id AND pv.is_orderable AND p.is_active;
    IF NOT FOUND OR v_product.product_type NOT IN ('standard_milk','canteen_milk') THEN
      RAISE EXCEPTION 'Subscriptions support only active, orderable milk products' USING ERRCODE='23514';
    END IF;
    SELECT pv.* INTO v_variant FROM public.product_variants pv
    WHERE pv.id=v_line.product_variant_id AND pv.product_id=v_product.id;
    SELECT v.* INTO v_vendor FROM public.vendors v
    WHERE v.id=v_line.vendor_id AND v.is_approved AND v.ordering_enabled;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected milk vendor is not approved or accepting orders' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.vendor_products vp
      WHERE vp.vendor_id=v_line.vendor_id AND vp.product_id=v_product.id
        AND vp.milk_type=v_line.milk_type AND vp.is_active
    ) THEN
      RAISE EXCEPTION 'Selected vendor does not supply this milk type' USING ERRCODE='23514';
    END IF;
    IF (v_product.product_type='standard_milk' AND
        (v_line.milk_type NOT IN ('cow','buffalo') OR v_vendor.vendor_type<>'milk_vendor'))
       OR (v_product.product_type='canteen_milk' AND
        (v_line.milk_type<>'canteen' OR v_line.vendor_id<>'canteen-milk-centre'
         OR v_vendor.vendor_type<>'canteen_vendor')) THEN
      RAISE EXCEPTION 'Milk type/vendor selection is not valid for this product' USING ERRCODE='23514';
    END IF;

    SELECT pv.* INTO v_half FROM public.product_variants pv
    WHERE pv.product_id=v_product.id AND pv.unit_quantity=0.5 AND pv.is_orderable
    ORDER BY pv.id LIMIT 1;
    SELECT pv.* INTO v_one FROM public.product_variants pv
    WHERE pv.product_id=v_product.id AND pv.unit_quantity=1 AND pv.is_orderable
    ORDER BY pv.id LIMIT 1;
    IF v_half.id IS NULL OR v_one.id IS NULL
       OR (v_line.quantity_litres=0.5 AND v_variant.id<>v_half.id)
       OR (v_line.quantity_litres>0.5 AND v_variant.id<>v_one.id) THEN
      RAISE EXCEPTION 'Milk reference SKU does not match selected volume' USING ERRCODE='23514';
    END IF;

    SELECT pg_catalog.count(*),pg_catalog.min(vp.price_per_delivery_paise),
      pg_catalog.min(vp.delivery_fee_paise),pg_catalog.min(vp.total_customer_delivery_paise)
      INTO v_half_count,v_half_base,v_half_fee,v_half_total
    FROM public.vendor_prices vp
    WHERE vp.vendor_id=v_line.vendor_id AND vp.product_variant_id=v_half.id
      AND vp.milk_type=v_line.milk_type AND vp.is_current AND vp.effective_to IS NULL
      AND vp.effective_from<=pg_catalog.now();
    SELECT pg_catalog.count(*),pg_catalog.min(vp.price_per_delivery_paise),
      pg_catalog.min(vp.delivery_fee_paise),pg_catalog.min(vp.total_customer_delivery_paise)
      INTO v_one_count,v_one_base,v_one_fee,v_one_total
    FROM public.vendor_prices vp
    WHERE vp.vendor_id=v_line.vendor_id AND vp.product_variant_id=v_one.id
      AND vp.milk_type=v_line.milk_type AND vp.is_current AND vp.effective_to IS NULL
      AND vp.effective_from<=pg_catalog.now();
    IF v_half_count<>1 OR v_one_count<>1
       OR v_half_total IS DISTINCT FROM (v_half_base+v_half_fee)
       OR v_one_total IS DISTINCT FROM (v_one_base+v_one_fee) THEN
      RAISE EXCEPTION 'Current milk vendor pricing is missing, ambiguous or invalid' USING ERRCODE='23514';
    END IF;

    IF v_line.quantity_litres=0.5 THEN
      v_price:=v_half_total;
    ELSE
      v_price:=(pg_catalog.floor(v_line.quantity_litres)::integer*v_one_base)
        + CASE WHEN v_line.quantity_litres-pg_catalog.floor(v_line.quantity_litres)=0.5
          THEN v_half_base ELSE 0 END + v_one_fee;
    END IF;
    IF v_price<=0 OR v_price*v_line.quantity::bigint>2147483647 THEN
      RAISE EXCEPTION 'Calculated subscription delivery price is invalid' USING ERRCODE='23514';
    END IF;
    v_daily_line:=v_price::bigint*v_line.quantity;
    v_line_total:=v_daily_line*v_days;
    v_subtotal:=v_subtotal+v_line_total;
    IF v_subtotal>2147483647 THEN
      RAISE EXCEPTION 'Subscription total exceeds supported limit' USING ERRCODE='22003';
    END IF;
    v_lines:=v_lines||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'product_variant_id',v_variant.id,'vendor_id',v_vendor.id,'milk_type',v_line.milk_type,
      'quantity',v_line.quantity,'quantity_litres',v_line.quantity_litres,
      'price_per_delivery_paise',v_price,'line_total_paise',v_line_total,
      'product_name_snapshot',v_product.name,'variant_name_snapshot',v_variant.name,
      'vendor_name_snapshot',v_vendor.name
    ));
  END LOOP;

  IF v_count=0 OR v_subtotal<=0 THEN
    RAISE EXCEPTION 'Subscription quote is empty or invalid' USING ERRCODE='23514';
  END IF;
  IF p_plan_type='30_day' THEN v_discount:=6000; END IF;
  IF v_discount>v_subtotal THEN
    RAISE EXCEPTION 'Subscription discount exceeds basket subtotal' USING ERRCODE='23514';
  END IF;
  v_total:=v_subtotal-v_discount;
  RETURN pg_catalog.jsonb_build_object(
    'plan_type',p_plan_type,'duration_days',v_days,'start_date',p_start_date,
    'end_date',p_start_date+(v_days-1),'service_area_id',v_area,
    'delivery_slot_id',v_slot.id,'subtotal_paise',v_subtotal,
    'discount_paise',v_discount,'total_paise',v_total,
    'address_snapshot',pg_catalog.to_jsonb(v_address),
    'delivery_slot_snapshot',pg_catalog.to_jsonb(v_slot),
    'items',v_lines
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.build_subscription_quote(uuid,uuid,date,public.subscription_plan_enum,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.quote_subscription(
  p_address_id uuid,p_delivery_slot_id uuid,p_start_date date,
  p_plan_type public.subscription_plan_enum,p_items jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $wrapper$
  SELECT private.build_subscription_quote(
    p_address_id,p_delivery_slot_id,p_start_date,p_plan_type,p_items
  );
$wrapper$;
REVOKE ALL ON FUNCTION public.quote_subscription(uuid,uuid,date,public.subscription_plan_enum,jsonb)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.quote_subscription(uuid,uuid,date,public.subscription_plan_enum,jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.create_subscription_payment_intent(
  p_address_id uuid,p_delivery_slot_id uuid,p_start_date date,
  p_plan_type public.subscription_plan_enum,p_items jsonb,p_idempotency_key uuid
)
RETURNS TABLE(subscription_id uuid,subscription_number varchar,payment_id uuid,
  amount_paise integer,subscription_status public.subscription_status_enum,was_replayed boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_customer uuid:=auth.uid();
  v_quote jsonb;
  v_subscription uuid;
  v_number varchar;
  v_payment uuid;
  v_existing record;
  v_item jsonb;
BEGIN
  IF v_customer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'Idempotency key is required' USING ERRCODE='22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_customer::text||':'||p_idempotency_key::text,0)
  );
  SELECT s.id,s.subscription_number,p.id,p.amount_paise,s.status
    INTO v_existing
  FROM public.subscriptions s
  JOIN public.payments p ON p.subscription_id=s.id
  WHERE s.customer_id=v_customer AND s.idempotency_key=p_idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id,v_existing.subscription_number,v_existing.id,
      v_existing.amount_paise,v_existing.status,true;
    RETURN;
  END IF;

  v_quote:=private.build_subscription_quote(
    p_address_id,p_delivery_slot_id,p_start_date,p_plan_type,p_items
  );
  INSERT INTO public.subscriptions(
    subscription_number,customer_id,customer_address_id,service_area_id,delivery_slot_id,
    plan_type,status,start_date,end_date,next_delivery_date,auto_renew,
    subtotal_paise,discount_paise,total_paise,duration_days,idempotency_key,
    address_snapshot,delivery_slot_snapshot
  ) VALUES(
    'DBY-SUB-'||pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),1,12)),
    v_customer,p_address_id,(v_quote->>'service_area_id')::uuid,p_delivery_slot_id,
    p_plan_type,'pending_payment',p_start_date,(v_quote->>'end_date')::date,p_start_date,FALSE,
    (v_quote->>'subtotal_paise')::integer,(v_quote->>'discount_paise')::integer,
    (v_quote->>'total_paise')::integer,(v_quote->>'duration_days')::integer,p_idempotency_key,
    v_quote->'address_snapshot',v_quote->'delivery_slot_snapshot'
  ) RETURNING id,subscription_number INTO v_subscription,v_number;

  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(v_quote->'items')
  LOOP
    INSERT INTO public.subscription_items(
      subscription_id,product_variant_id,vendor_id,milk_type,quantity,quantity_litres,
      price_per_delivery_paise,product_name_snapshot,variant_name_snapshot,
      vendor_name_snapshot,line_total_paise
    ) VALUES(
      v_subscription,v_item->>'product_variant_id',v_item->>'vendor_id',
      (v_item->>'milk_type')::public.milk_type_enum,(v_item->>'quantity')::integer,
      (v_item->>'quantity_litres')::numeric,(v_item->>'price_per_delivery_paise')::integer,
      v_item->>'product_name_snapshot',v_item->>'variant_name_snapshot',
      v_item->>'vendor_name_snapshot',(v_item->>'line_total_paise')::integer
    );
  END LOOP;

  -- This is a pending online-payment intent only. No gateway call or paid state is fabricated.
  INSERT INTO public.payments(
    subscription_id,amount_paise,currency,gateway,status,method
  ) VALUES(v_subscription,(v_quote->>'total_paise')::integer,'INR','pending_online','pending','online')
  RETURNING id INTO v_payment;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,old_values,new_values)
  VALUES(v_customer,'subscription.payment_intent.created','subscriptions',v_subscription::text,NULL,
    pg_catalog.jsonb_build_object('plan_type',p_plan_type,'duration_days',v_quote->>'duration_days',
      'amount_paise',v_quote->>'total_paise','payment_status','pending'));
  RETURN QUERY SELECT v_subscription,v_number,v_payment,
    (v_quote->>'total_paise')::integer,'pending_payment'::public.subscription_status_enum,false;
END;
$function$;

REVOKE ALL ON FUNCTION private.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.create_subscription_payment_intent(
  p_address_id uuid,p_delivery_slot_id uuid,p_start_date date,
  p_plan_type public.subscription_plan_enum,p_items jsonb,p_idempotency_key uuid
)
RETURNS TABLE(subscription_id uuid,subscription_number varchar,payment_id uuid,
  amount_paise integer,subscription_status public.subscription_status_enum,was_replayed boolean)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $wrapper$
  SELECT * FROM private.create_subscription_payment_intent(
    p_address_id,p_delivery_slot_id,p_start_date,p_plan_type,p_items,p_idempotency_key
  );
$wrapper$;
REVOKE ALL ON FUNCTION public.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)
  TO authenticated;

COMMENT ON FUNCTION public.quote_subscription(uuid,uuid,date,public.subscription_plan_enum,jsonb) IS
  'Authoritative quote for fixed 7/30-day milk subscriptions; validates serviceability, vendor, SKU, volume and current prices.';
COMMENT ON FUNCTION public.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid) IS
  'Creates an idempotent pending online-payment intent only. Subscription remains pending_payment until trusted server-side verification; no deliveries are generated.';

COMMIT;
