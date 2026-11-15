-- Phase 4.4.2: transactional one-time COD order placement.
CREATE OR REPLACE FUNCTION private.create_cod_order(
  p_address_id uuid, p_delivery_slot_id uuid, p_delivery_date date,
  p_idempotency_key uuid, p_delivery_notes text DEFAULT NULL
)
RETURNS TABLE(order_id uuid, order_number varchar, total_paise integer, was_replayed boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_customer uuid := auth.uid();
  v_cart_id uuid;
  v_area uuid;
  v_pincode varchar;
  v_slot public.delivery_slots%ROWTYPE;
  v_line record;
  v_saved record;
  v_product public.products%ROWTYPE;
  v_variant public.product_variants%ROWTYPE;
  v_vendor public.vendors%ROWTYPE;
  v_half public.product_variants%ROWTYPE;
  v_one public.product_variants%ROWTYPE;
  v_half_price integer;
  v_one_price integer;
  v_half_fee integer;
  v_one_fee integer;
  v_price integer;
  v_total bigint := 0;
  v_order uuid;
  v_number varchar;
  v_existing record;
  v_local timestamp;
  v_lines integer := 0;
  v_litres numeric;
BEGIN
  IF v_customer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_address_id IS NULL OR p_delivery_slot_id IS NULL OR p_delivery_date IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Address, slot, delivery date and idempotency key are required' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_customer::text||':'||p_idempotency_key::text,0));
  SELECT o.id,o.order_number,o.total_paise INTO v_existing FROM public.orders o
   WHERE o.customer_id=v_customer AND o.idempotency_key=p_idempotency_key;
  IF FOUND THEN RETURN QUERY SELECT v_existing.id,v_existing.order_number,v_existing.total_paise,true; RETURN; END IF;
  SELECT c.id INTO v_cart_id FROM public.carts c WHERE c.customer_id=v_customer AND c.status='active' FOR UPDATE;
  IF v_cart_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.cart_items ci WHERE ci.cart_id=v_cart_id) THEN
    RAISE EXCEPTION 'Your cart is empty' USING ERRCODE='P0001';
  END IF;
  SELECT a.service_area_id,a.pincode INTO v_area,v_pincode FROM public.customer_addresses a WHERE a.id=p_address_id AND a.customer_id=v_customer;
  IF NOT FOUND OR v_area IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.service_areas sa JOIN public.service_area_pincodes sp ON sp.service_area_id=sa.id
    WHERE sa.id=v_area AND sa.is_active AND sp.is_active AND sp.pincode=v_pincode
  ) THEN RAISE EXCEPTION 'Selected address is not serviceable' USING ERRCODE='23514'; END IF;
  SELECT * INTO v_slot FROM public.delivery_slots WHERE id=p_delivery_slot_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected delivery slot is unavailable' USING ERRCODE='23514'; END IF;
  v_local:=pg_catalog.now() AT TIME ZONE 'Asia/Kolkata';
  IF p_delivery_date<v_local::date OR (p_delivery_date=v_local::date AND v_local::time>=v_slot.order_cutoff_time) THEN
    RAISE EXCEPTION 'Delivery date has passed its order cutoff' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM public.cart_items ci WHERE ci.cart_id=v_cart_id ORDER BY ci.product_variant_id,ci.vendor_id,ci.id FOR UPDATE;
  CREATE TEMP TABLE pg_temp.dby_checkout_lines(
    variant_id varchar, vendor_id varchar, milk_type public.milk_type_enum,
    quantity integer, litres numeric, unit_price integer, line_total integer,
    product_name varchar, variant_name varchar, brand varchar, pack_size varchar, vendor_name varchar,
    is_milk boolean, one_variant_id varchar, half_variant_id varchar
  ) ON COMMIT DROP;
  FOR v_line IN SELECT ci.* FROM public.cart_items ci WHERE ci.cart_id=v_cart_id ORDER BY ci.product_variant_id,ci.vendor_id,ci.id LOOP
    v_lines:=v_lines+1;
    IF v_lines>50 OR v_line.quantity<1 OR v_line.quantity>100 THEN RAISE EXCEPTION 'Cart quantity/size invalid' USING ERRCODE='23514'; END IF;
    SELECT * INTO v_variant FROM public.product_variants pv WHERE pv.id=v_line.product_variant_id AND pv.is_orderable;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cart product is not orderable' USING ERRCODE='23514'; END IF;
    SELECT * INTO v_product FROM public.products p WHERE p.id=v_variant.product_id AND p.is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cart product is inactive' USING ERRCODE='23514'; END IF;
    v_price:=0; v_vendor.name:=NULL; v_half.id:=NULL; v_one.id:=NULL;
    IF v_product.product_type='grocery_dairy' THEN
      IF v_line.vendor_id IS NOT NULL OR v_line.milk_type IS NOT NULL OR v_line.quantity_litres IS NOT NULL OR
         v_variant.final_price_paise IS NULL OR v_variant.final_price_paise<=0 THEN
        RAISE EXCEPTION 'Non-milk cart selection or price invalid' USING ERRCODE='23514';
      END IF;
      v_price:=v_variant.final_price_paise; v_litres:=NULL;
    ELSE
      IF v_line.vendor_id IS NULL OR v_line.milk_type IS NULL OR v_line.quantity_litres IS NULL OR
         v_line.quantity_litres<0.5 OR v_line.quantity_litres>10 OR v_line.quantity_litres*2<>pg_catalog.trunc(v_line.quantity_litres*2) THEN
        RAISE EXCEPTION 'Milk volume/vendor selection invalid' USING ERRCODE='23514';
      END IF;
      SELECT * INTO v_vendor FROM public.vendors v WHERE v.id=v_line.vendor_id AND v.is_approved AND v.ordering_enabled;
      IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.vendor_products vp WHERE vp.vendor_id=v_line.vendor_id
        AND vp.product_id=v_product.id AND vp.milk_type=v_line.milk_type AND vp.is_active) THEN
        RAISE EXCEPTION 'Selected milk vendor is not eligible' USING ERRCODE='23514';
      END IF;
      IF (v_product.product_type='standard_milk' AND (v_line.milk_type NOT IN ('cow','buffalo') OR v_vendor.vendor_type<>'milk_vendor')) OR
         (v_product.product_type='canteen_milk' AND (v_line.milk_type<>'canteen' OR v_line.vendor_id<>'canteen-milk-centre' OR v_vendor.vendor_type<>'canteen_vendor')) THEN
        RAISE EXCEPTION 'Milk vendor/type mismatch' USING ERRCODE='23514';
      END IF;
      SELECT * INTO v_half FROM public.product_variants pv WHERE pv.product_id=v_product.id AND pv.unit_quantity=0.5 AND pv.is_orderable ORDER BY pv.id LIMIT 1;
      SELECT * INTO v_one FROM public.product_variants pv WHERE pv.product_id=v_product.id AND pv.unit_quantity=1 AND pv.is_orderable ORDER BY pv.id LIMIT 1;
      IF v_half.id IS NULL OR v_one.id IS NULL OR (v_line.quantity_litres=0.5 AND v_variant.id<>v_half.id) OR
         (v_line.quantity_litres>0.5 AND v_variant.id<>v_one.id) THEN
        RAISE EXCEPTION 'Milk reference variants are missing or mismatched' USING ERRCODE='23514';
      END IF;
      SELECT vp.price_per_delivery_paise,vp.delivery_fee_paise INTO v_half_price,v_half_fee FROM public.vendor_prices vp
       WHERE vp.vendor_id=v_line.vendor_id AND vp.product_variant_id=v_half.id AND vp.milk_type=v_line.milk_type
         AND vp.is_current AND vp.effective_to IS NULL AND vp.effective_from<=pg_catalog.now();
      IF NOT FOUND OR (SELECT count(*) FROM public.vendor_prices vp WHERE vp.vendor_id=v_line.vendor_id AND vp.product_variant_id=v_half.id
        AND vp.milk_type=v_line.milk_type AND vp.is_current AND vp.effective_to IS NULL AND vp.effective_from<=pg_catalog.now())<>1 THEN
        RAISE EXCEPTION '500 ml milk pricing missing/ambiguous' USING ERRCODE='23514';
      END IF;
      SELECT vp.price_per_delivery_paise,vp.delivery_fee_paise INTO v_one_price,v_one_fee FROM public.vendor_prices vp
       WHERE vp.vendor_id=v_line.vendor_id AND vp.product_variant_id=v_one.id AND vp.milk_type=v_line.milk_type
         AND vp.is_current AND vp.effective_to IS NULL AND vp.effective_from<=pg_catalog.now();
      IF NOT FOUND OR (SELECT count(*) FROM public.vendor_prices vp WHERE vp.vendor_id=v_line.vendor_id AND vp.product_variant_id=v_one.id
        AND vp.milk_type=v_line.milk_type AND vp.is_current AND vp.effective_to IS NULL AND vp.effective_from<=pg_catalog.now())<>1 THEN
        RAISE EXCEPTION '1 L milk pricing missing/ambiguous' USING ERRCODE='23514';
      END IF;
      IF least(v_half_price,v_half_fee,v_one_price,v_one_fee)<0 THEN RAISE EXCEPTION 'Milk price data invalid' USING ERRCODE='23514'; END IF;
      IF v_line.quantity_litres=0.5 THEN v_price:=v_half_price+v_half_fee;
      ELSE v_price:=pg_catalog.floor(v_line.quantity_litres)::integer*v_one_price+
        CASE WHEN v_line.quantity_litres-pg_catalog.floor(v_line.quantity_litres)=0.5 THEN v_half_price ELSE 0 END+v_one_fee;
      END IF;
      v_litres:=v_line.quantity_litres;
    END IF;
    IF v_price<=0 OR v_price*v_line.quantity>2147483647 THEN RAISE EXCEPTION 'Calculated price invalid' USING ERRCODE='23514'; END IF;
    v_total:=v_total+(v_price*v_line.quantity);
    IF v_total>2147483647 THEN RAISE EXCEPTION 'Order total exceeds supported limit' USING ERRCODE='22003'; END IF;
    INSERT INTO pg_temp.dby_checkout_lines VALUES(v_variant.id,v_line.vendor_id,v_line.milk_type,v_line.quantity,v_litres,v_price,v_price*v_line.quantity,
      v_product.name,v_variant.variant_name,v_variant.brand,v_variant.pack_size,CASE WHEN v_line.vendor_id IS NULL THEN NULL ELSE v_vendor.name END,
      v_product.product_type<>'grocery_dairy',v_one.id,v_half.id);
  END LOOP;
  IF v_total<=0 THEN RAISE EXCEPTION 'Order total is invalid' USING ERRCODE='23514'; END IF;
  INSERT INTO public.orders(customer_id,customer_address_id,service_area_id,delivery_slot_id,delivery_date,idempotency_key,
    order_type,status,subtotal_paise,delivery_fee_paise,total_paise,payment_status,payment_method,delivery_notes)
  VALUES(v_customer,p_address_id,v_area,p_delivery_slot_id,p_delivery_date,p_idempotency_key,'one_time','pending_confirmation',
    v_total::integer,0,v_total::integer,'pending','cod',NULLIF(pg_catalog.btrim(p_delivery_notes),''))
  RETURNING id,public.orders.order_number INTO v_order,v_number;
  CREATE TEMP TABLE pg_temp.dby_required_stock(variant_id varchar PRIMARY KEY,pack_count integer NOT NULL CHECK(pack_count>0)) ON COMMIT DROP;
  INSERT INTO pg_temp.dby_required_stock(variant_id,pack_count)
  SELECT required.variant_id,sum(required.pack_count)::integer FROM (
    SELECT l.variant_id,l.quantity AS pack_count FROM pg_temp.dby_checkout_lines l WHERE NOT l.is_milk
    UNION ALL
    SELECT l.one_variant_id,pg_catalog.floor(l.litres*l.quantity)::integer FROM pg_temp.dby_checkout_lines l
      WHERE l.is_milk AND pg_catalog.floor(l.litres*l.quantity)>0
    UNION ALL
    SELECT l.half_variant_id,1 FROM pg_temp.dby_checkout_lines l
      WHERE l.is_milk AND l.litres*l.quantity-pg_catalog.floor(l.litres*l.quantity)=0.5
  ) required GROUP BY required.variant_id;
  v_lines:=0;
  FOR v_saved IN SELECT i.id,i.product_variant_id,i.available_stock,i.reserved_stock,i.safety_stock,r.pack_count
    FROM public.inventory i JOIN pg_temp.dby_required_stock r ON r.variant_id=i.product_variant_id
    WHERE i.service_area_id=v_area ORDER BY i.id FOR UPDATE OF i LOOP
    v_lines:=v_lines+1;
    IF v_saved.available_stock-v_saved.reserved_stock-v_saved.safety_stock<v_saved.pack_count THEN
      RAISE EXCEPTION 'Insufficient stock for product variant %',v_saved.product_variant_id USING ERRCODE='23514';
    END IF;
    UPDATE public.inventory SET reserved_stock=reserved_stock+v_saved.pack_count,updated_at=pg_catalog.now() WHERE id=v_saved.id;
    INSERT INTO public.inventory_movements(inventory_id,change_amount,movement_type,reference_id,notes,created_by)
    VALUES(v_saved.id,v_saved.pack_count,'order_reservation',v_order::text,'COD order pack reservation',v_customer);
  END LOOP;
  IF v_lines<>(SELECT count(*) FROM pg_temp.dby_required_stock) THEN RAISE EXCEPTION 'Inventory is not configured for every cart item' USING ERRCODE='23514'; END IF;
  FOR v_saved IN SELECT * FROM pg_temp.dby_checkout_lines ORDER BY variant_id,vendor_id LOOP
    INSERT INTO public.order_items(order_id,product_variant_id,vendor_id,milk_type,quantity,unit_price_paise,total_price_paise,
      quantity_litres,product_name_snapshot,variant_name_snapshot,brand_snapshot,pack_size_snapshot,vendor_name_snapshot)
    VALUES(v_order,v_saved.variant_id,v_saved.vendor_id,v_saved.milk_type,v_saved.quantity,v_saved.unit_price,v_saved.line_total,
      v_saved.litres,v_saved.product_name,v_saved.variant_name,v_saved.brand,v_saved.pack_size,v_saved.vendor_name);
  END LOOP;
  INSERT INTO public.payments(order_id,amount_paise,currency,gateway,status,method) VALUES(v_order,v_total::integer,'INR','cod','pending','cod');
  UPDATE public.carts SET status='converted',updated_at=pg_catalog.now() WHERE id=v_cart_id AND customer_id=v_customer AND status='active';
  RETURN QUERY SELECT v_order,v_number,v_total::integer,false;
END;
$function$;
REVOKE ALL ON FUNCTION private.create_cod_order(uuid,uuid,date,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION private.create_cod_order(uuid,uuid,date,uuid,text) IS 'Atomic one-time COD order creation for auth.uid(); validates address/serviceability, slot cutoff, live pricing, and pack inventory; idempotent; no subscriptions or online payment.';
CREATE OR REPLACE FUNCTION public.create_cod_order(
  p_address_id uuid,p_delivery_slot_id uuid,p_delivery_date date,p_idempotency_key uuid,p_delivery_notes text DEFAULT NULL
)
RETURNS TABLE(order_id uuid,order_number varchar,total_paise integer,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $wrapper$
SELECT * FROM private.create_cod_order(p_address_id,p_delivery_slot_id,p_delivery_date,p_idempotency_key,p_delivery_notes);
$wrapper$;
REVOKE ALL ON FUNCTION public.create_cod_order(uuid,uuid,date,uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.create_cod_order(uuid,uuid,date,uuid,text) TO authenticated;