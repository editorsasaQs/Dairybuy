-- Dairybuy Phase 2: authoritative November CSV pricing and selected milk volumes.
-- Forward-only, additive migration. Existing order totals and historical vendor prices remain intact.
BEGIN;

-- Persist the selected milk volume separately from the 500 ml / 1 L reference variant.
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS quantity_litres NUMERIC(4,1);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS quantity_litres NUMERIC(4,1);
ALTER TABLE public.subscription_items ADD COLUMN IF NOT EXISTS quantity_litres NUMERIC(4,1);

-- Backfill the current cart and any historical commerce rows from their original catalogue variants.
UPDATE public.cart_items ci
SET quantity_litres = pv.unit_quantity
FROM public.product_variants pv
JOIN public.products p ON p.id = pv.product_id
WHERE ci.product_variant_id = pv.id
  AND p.product_type IN ('standard_milk', 'canteen_milk')
  AND ci.quantity_litres IS NULL;

UPDATE public.order_items oi
SET quantity_litres = pv.unit_quantity
FROM public.product_variants pv
JOIN public.products p ON p.id = pv.product_id
WHERE oi.product_variant_id = pv.id
  AND p.product_type IN ('standard_milk', 'canteen_milk')
  AND oi.quantity_litres IS NULL;

UPDATE public.subscription_items si
SET quantity_litres = pv.unit_quantity
FROM public.product_variants pv
JOIN public.products p ON p.id = pv.product_id
WHERE si.product_variant_id = pv.id
  AND p.product_type IN ('standard_milk', 'canteen_milk')
  AND si.quantity_litres IS NULL;

ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS chk_cart_items_quantity_litres;
ALTER TABLE public.cart_items ADD CONSTRAINT chk_cart_items_quantity_litres
  CHECK (quantity_litres IS NULL OR (
    quantity_litres >= 0.5 AND quantity_litres <= 10
    AND quantity_litres * 2 = pg_catalog.trunc(quantity_litres * 2)
  ));
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS chk_order_items_quantity_litres;
ALTER TABLE public.order_items ADD CONSTRAINT chk_order_items_quantity_litres
  CHECK (quantity_litres IS NULL OR (
    quantity_litres >= 0.5 AND quantity_litres <= 10
    AND quantity_litres * 2 = pg_catalog.trunc(quantity_litres * 2)
  ));
ALTER TABLE public.subscription_items DROP CONSTRAINT IF EXISTS chk_subscription_items_quantity_litres;
ALTER TABLE public.subscription_items ADD CONSTRAINT chk_subscription_items_quantity_litres
  CHECK (quantity_litres IS NULL OR (
    quantity_litres >= 0.5 AND quantity_litres <= 10
    AND quantity_litres * 2 = pg_catalog.trunc(quantity_litres * 2)
  ));

COMMENT ON COLUMN public.cart_items.quantity_litres IS 'Selected milk volume per delivery, from 0.5 L to 10 L in 0.5 L increments; NULL for non-milk.';
COMMENT ON COLUMN public.order_items.quantity_litres IS 'Purchased milk volume per delivery; NULL for non-milk. Historical rows are backfilled from their original variant.';
COMMENT ON COLUMN public.subscription_items.quantity_litres IS 'Subscribed milk volume per delivery; NULL for non-milk.';

-- A 30-day subscription owns one flat discount for the complete basket.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS subtotal_paise INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_paise INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS chk_subscription_price_snapshot;
ALTER TABLE public.subscriptions ADD CONSTRAINT chk_subscription_price_snapshot
  CHECK (
    subtotal_paise >= 0 AND discount_paise >= 0
    AND discount_paise <= subtotal_paise
    AND total_paise = subtotal_paise - discount_paise
  );

-- No additional generic order fee: every CSV product/milk line already contains its delivery component.
ALTER TABLE public.orders ALTER COLUMN delivery_fee_paise SET DEFAULT 0;
UPDATE public.app_settings
SET value = '0'::jsonb,
    description = 'No additional order-level delivery fee. Approved CSV delivery components are included in product and milk prices.',
    updated_at = pg_catalog.now()
WHERE key = 'delivery_fee_paise';

-- Canteen base cost and its CSV delivery component are stored separately; customer total is inclusive.
UPDATE public.product_variants
SET purchase_price_paise = 2900,
    sheet_delivery_component_paise = 900,
    final_price_paise = 3800,
    updated_at = pg_catalog.now()
WHERE id = 'milk-canteen-500ml';

UPDATE public.product_variants
SET purchase_price_paise = 5200,
    sheet_delivery_component_paise = 800,
    final_price_paise = 6000,
    updated_at = pg_catalog.now()
WHERE id = 'milk-canteen-1l';

-- Close previous current milk price records without deleting price history.
UPDATE public.vendor_prices
SET is_current = FALSE,
    effective_to = pg_catalog.now()
WHERE is_current = TRUE
  AND effective_to IS NULL
  AND vendor_id IN (
    'healthy-haryana', 'vip-pure', 'ghosh-dairy', 'canteen-milk-centre'
  );

-- Insert the 14 current price records from the four user-supplied CSVs.
-- price_per_delivery_paise = milk selling price excluding component.
-- delivery_fee_paise = the corresponding CSV component.
-- total_customer_delivery_paise and plan prices include that component.
INSERT INTO public.vendor_prices (
  vendor_id, product_variant_id, milk_type,
  price_per_delivery_paise, plan_7_day_paise, plan_30_day_paise,
  delivery_fee_paise, total_customer_delivery_paise,
  effective_from, effective_to, is_current
) VALUES
  ('healthy-haryana','milk-cow-500ml','cow',4100,35000,150000,900,5000,pg_catalog.now(),NULL,TRUE),
  ('healthy-haryana','milk-cow-1l','cow',7800,59500,255000,700,8500,pg_catalog.now(),NULL,TRUE),
  ('healthy-haryana','milk-buffalo-500ml','buffalo',4100,35000,150000,900,5000,pg_catalog.now(),NULL,TRUE),
  ('healthy-haryana','milk-buffalo-1l','buffalo',7800,59500,255000,700,8500,pg_catalog.now(),NULL,TRUE),

  ('vip-pure','milk-cow-500ml','cow',4800,39900,171000,900,5700,pg_catalog.now(),NULL,TRUE),
  ('vip-pure','milk-cow-1l','cow',9200,69300,297000,700,9900,pg_catalog.now(),NULL,TRUE),
  ('vip-pure','milk-buffalo-500ml','buffalo',5600,45500,195000,900,6500,pg_catalog.now(),NULL,TRUE),
  ('vip-pure','milk-buffalo-1l','buffalo',10800,80500,345000,700,11500,pg_catalog.now(),NULL,TRUE),

  ('ghosh-dairy','milk-cow-500ml','cow',6100,49000,210000,900,7000,pg_catalog.now(),NULL,TRUE),
  ('ghosh-dairy','milk-cow-1l','cow',11300,84000,360000,700,12000,pg_catalog.now(),NULL,TRUE),
  ('ghosh-dairy','milk-buffalo-500ml','buffalo',6100,49000,210000,900,7000,pg_catalog.now(),NULL,TRUE),
  ('ghosh-dairy','milk-buffalo-1l','buffalo',11800,87500,375000,700,12500,pg_catalog.now(),NULL,TRUE),

  ('canteen-milk-centre','milk-canteen-500ml','canteen',2900,26600,114000,900,3800,pg_catalog.now(),NULL,TRUE),
  ('canteen-milk-centre','milk-canteen-1l','canteen',5200,42000,180000,800,6000,pg_catalog.now(),NULL,TRUE);

-- A cart line is unique by its actual selected volume, not merely by the 1 L reference variant.
DROP INDEX IF EXISTS public.uq_cart_items_line_selection;
CREATE UNIQUE INDEX uq_cart_items_line_selection
  ON public.cart_items (cart_id, product_variant_id, vendor_id, milk_type, quantity_litres)
  NULLS NOT DISTINCT;

-- Preserve the authenticated, SECURITY INVOKER atomic cart replacement contract.
CREATE OR REPLACE FUNCTION public.sync_active_cart(p_items jsonb)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_customer_id uuid := auth.uid();
  v_cart_id uuid;
  v_item_count integer;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Cart items must be a JSON array' USING ERRCODE = '22023';
  END IF;
  v_item_count := pg_catalog.jsonb_array_length(p_items);
  IF v_item_count > 50 THEN
    RAISE EXCEPTION 'A cart cannot contain more than 50 different items' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_to_recordset(p_items) AS item(
      product_variant_id varchar,
      vendor_id varchar,
      milk_type public.milk_type_enum,
      quantity integer,
      unit_price_paise integer,
      quantity_litres numeric
    )
    WHERE item.product_variant_id IS NULL
       OR pg_catalog.btrim(item.product_variant_id) = ''
       OR item.quantity IS NULL OR item.quantity < 1 OR item.quantity > 100
       OR item.unit_price_paise IS NULL OR item.unit_price_paise < 0
       OR (item.vendor_id IS NULL AND (item.milk_type IS NOT NULL OR item.quantity_litres IS NOT NULL))
       OR (item.vendor_id IS NOT NULL AND (item.milk_type IS NULL OR item.quantity_litres IS NULL))
       OR (item.quantity_litres IS NOT NULL AND (
         item.quantity_litres < 0.5 OR item.quantity_litres > 10
         OR item.quantity_litres * 2 <> pg_catalog.trunc(item.quantity_litres * 2)
       ))
  ) THEN
    RAISE EXCEPTION 'One or more cart lines are invalid' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_to_recordset(p_items) AS item(
      product_variant_id varchar,
      vendor_id varchar,
      milk_type public.milk_type_enum,
      quantity integer,
      unit_price_paise integer,
      quantity_litres numeric
    )
    GROUP BY item.product_variant_id, item.vendor_id, item.milk_type, item.quantity_litres
    HAVING pg_catalog.count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate cart line selections are not allowed' USING ERRCODE = '22023';
  END IF;

  IF v_item_count = 0 THEN
    SELECT id INTO v_cart_id
    FROM public.carts
    WHERE customer_id = v_customer_id AND status = 'active'
    FOR UPDATE;
    IF v_cart_id IS NOT NULL THEN
      DELETE FROM public.cart_items WHERE cart_id = v_cart_id;
      UPDATE public.carts SET updated_at = pg_catalog.now() WHERE id = v_cart_id;
    END IF;
    RETURN v_cart_id;
  END IF;

  INSERT INTO public.carts (customer_id, status)
  VALUES (v_customer_id, 'active')
  ON CONFLICT (customer_id) WHERE customer_id IS NOT NULL AND status = 'active'
  DO UPDATE SET updated_at = pg_catalog.now()
  RETURNING id INTO v_cart_id;

  DELETE FROM public.cart_items WHERE cart_id = v_cart_id;
  INSERT INTO public.cart_items (
    cart_id, product_variant_id, vendor_id, milk_type,
    quantity, unit_price_paise, quantity_litres
  )
  SELECT
    v_cart_id, item.product_variant_id, item.vendor_id, item.milk_type,
    item.quantity, item.unit_price_paise, item.quantity_litres
  FROM pg_catalog.jsonb_to_recordset(p_items) AS item(
    product_variant_id varchar,
    vendor_id varchar,
    milk_type public.milk_type_enum,
    quantity integer,
    unit_price_paise integer,
    quantity_litres numeric
  );
  RETURN v_cart_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_active_cart(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_active_cart(jsonb) TO authenticated;
COMMENT ON FUNCTION public.sync_active_cart(jsonb) IS
  'Atomically replaces the authenticated customer active cart. Prices and selected volume are validated by the server and the private database trigger.';

-- Defense-in-depth trigger: direct authenticated RPC/table writes cannot forge prices or milk volume.
CREATE OR REPLACE FUNCTION private.validate_cart_item_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_product_id varchar;
  v_product_type public.product_type_enum;
  v_product_active boolean;
  v_variant_orderable boolean;
  v_variant_quantity numeric;
  v_final_price integer;
  v_vendor_type varchar;
  v_vendor_approved boolean;
  v_vendor_ordering_enabled boolean;
  v_half_variant_id varchar;
  v_one_variant_id varchar;
  v_half_count bigint;
  v_one_count bigint;
  v_half_base integer;
  v_half_fee integer;
  v_half_total integer;
  v_one_base integer;
  v_one_fee integer;
  v_one_total integer;
  v_expected_price integer;
  v_whole_litres integer;
  v_has_half boolean;
BEGIN
  PERFORM 1 FROM public.carts WHERE id = NEW.cart_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cart does not exist' USING ERRCODE = '23503';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF (SELECT pg_catalog.count(*) FROM public.cart_items WHERE cart_id = NEW.cart_id) >= 50 THEN
      RAISE EXCEPTION 'A cart cannot contain more than 50 different items' USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.cart_id IS DISTINCT FROM NEW.cart_id THEN
    IF (SELECT pg_catalog.count(*) FROM public.cart_items WHERE cart_id = NEW.cart_id AND id <> NEW.id) >= 50 THEN
      RAISE EXCEPTION 'A cart cannot contain more than 50 different items' USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT product.id, product.product_type, product.is_active,
         variant.is_orderable, variant.unit_quantity, variant.final_price_paise
    INTO v_product_id, v_product_type, v_product_active,
         v_variant_orderable, v_variant_quantity, v_final_price
  FROM public.product_variants AS variant
  JOIN public.products AS product ON product.id = variant.product_id
  WHERE variant.id = NEW.product_variant_id;

  IF NOT FOUND OR NOT v_product_active OR NOT v_variant_orderable THEN
    RAISE EXCEPTION 'Cart product or variant is not currently orderable' USING ERRCODE = '23514';
  END IF;

  IF v_product_type = 'grocery_dairy' THEN
    IF NEW.vendor_id IS NOT NULL OR NEW.milk_type IS NOT NULL OR NEW.quantity_litres IS NOT NULL THEN
      RAISE EXCEPTION 'Non-milk cart lines cannot select vendor, milk type or volume' USING ERRCODE = '23514';
    END IF;
    IF v_final_price IS NULL OR v_final_price <= 0 OR NEW.unit_price_paise <> v_final_price THEN
      RAISE EXCEPTION 'Cart line price does not match the current catalogue price' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF v_product_type NOT IN ('standard_milk', 'canteen_milk')
     OR NEW.vendor_id IS NULL OR NEW.milk_type IS NULL OR NEW.quantity_litres IS NULL
     OR NEW.quantity_litres < 0.5 OR NEW.quantity_litres > 10
     OR NEW.quantity_litres * 2 <> pg_catalog.trunc(NEW.quantity_litres * 2)
     OR (NEW.quantity_litres = 0.5 AND v_variant_quantity <> 0.5)
     OR (NEW.quantity_litres > 0.5 AND v_variant_quantity <> 1.0) THEN
    RAISE EXCEPTION 'Milk cart line selection or volume is invalid' USING ERRCODE = '23514';
  END IF;

  SELECT vendor_type, is_approved, ordering_enabled
    INTO v_vendor_type, v_vendor_approved, v_vendor_ordering_enabled
  FROM public.vendors WHERE id = NEW.vendor_id;
  IF NOT FOUND OR NOT v_vendor_approved OR NOT v_vendor_ordering_enabled THEN
    RAISE EXCEPTION 'Selected milk vendor is not currently accepting orders' USING ERRCODE = '23514';
  END IF;

  IF v_product_type = 'standard_milk' THEN
    IF NEW.milk_type NOT IN ('cow', 'buffalo') OR v_vendor_type <> 'milk_vendor' THEN
      RAISE EXCEPTION 'Selected vendor or milk type is not valid for standard milk' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.milk_type <> 'canteen' OR NEW.vendor_id <> 'canteen-milk-centre' OR v_vendor_type <> 'canteen_vendor' THEN
      RAISE EXCEPTION 'Canteen milk requires the confirmed Canteen Milk Centre vendor' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_products AS mapping
    WHERE mapping.vendor_id = NEW.vendor_id
      AND mapping.product_id = v_product_id
      AND mapping.milk_type = NEW.milk_type
      AND mapping.is_active
  ) THEN
    RAISE EXCEPTION 'Selected vendor does not supply this milk type' USING ERRCODE = '23514';
  END IF;

  SELECT id INTO v_half_variant_id
  FROM public.product_variants WHERE product_id = v_product_id AND unit_quantity = 0.5;
  SELECT id INTO v_one_variant_id
  FROM public.product_variants WHERE product_id = v_product_id AND unit_quantity = 1.0;
  IF v_half_variant_id IS NULL OR v_one_variant_id IS NULL THEN
    RAISE EXCEPTION 'Both base milk variants are required for authoritative pricing' USING ERRCODE = '23514';
  END IF;

  SELECT pg_catalog.count(*), pg_catalog.min(price_per_delivery_paise),
         pg_catalog.min(delivery_fee_paise), pg_catalog.min(total_customer_delivery_paise)
    INTO v_half_count, v_half_base, v_half_fee, v_half_total
  FROM public.vendor_prices
  WHERE vendor_id = NEW.vendor_id AND product_variant_id = v_half_variant_id
    AND milk_type = NEW.milk_type AND is_current AND effective_to IS NULL
    AND effective_from <= pg_catalog.now();

  SELECT pg_catalog.count(*), pg_catalog.min(price_per_delivery_paise),
         pg_catalog.min(delivery_fee_paise), pg_catalog.min(total_customer_delivery_paise)
    INTO v_one_count, v_one_base, v_one_fee, v_one_total
  FROM public.vendor_prices
  WHERE vendor_id = NEW.vendor_id AND product_variant_id = v_one_variant_id
    AND milk_type = NEW.milk_type AND is_current AND effective_to IS NULL
    AND effective_from <= pg_catalog.now();

  IF v_half_count <> 1 OR v_one_count <> 1
     OR v_half_total IS DISTINCT FROM (v_half_base + v_half_fee)
     OR v_one_total IS DISTINCT FROM (v_one_base + v_one_fee) THEN
    RAISE EXCEPTION 'Current vendor pricing is missing, ambiguous or invalid' USING ERRCODE = '23514';
  END IF;

  IF NEW.quantity_litres = 0.5 THEN
    v_expected_price := v_half_total;
  ELSE
    v_whole_litres := pg_catalog.floor(NEW.quantity_litres)::integer;
    v_has_half := NEW.quantity_litres - v_whole_litres = 0.5;
    v_expected_price := (v_whole_litres * v_one_base)
      + CASE WHEN v_has_half THEN v_half_base ELSE 0 END
      + v_one_fee;
  END IF;

  IF NEW.unit_price_paise IS DISTINCT FROM v_expected_price THEN
    RAISE EXCEPTION 'Cart line price does not match current CSV vendor pricing' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.validate_cart_item_snapshot() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS cart_items_validate_snapshot ON public.cart_items;
CREATE TRIGGER cart_items_validate_snapshot
  BEFORE INSERT OR UPDATE OF cart_id, product_variant_id, vendor_id, milk_type, quantity, quantity_litres, unit_price_paise
  ON public.cart_items
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_cart_item_snapshot();


-- Reprice saved milk cart snapshots against the newly active CSV rows. This preserves
-- cart contents while preventing stale client-facing totals after the price cutover.
UPDATE public.cart_items AS ci
SET unit_price_paise = CASE
  WHEN ci.quantity_litres = 0.5 THEN half_price.total_customer_delivery_paise
  ELSE
    (pg_catalog.floor(ci.quantity_litres)::integer * one_price.price_per_delivery_paise)
    + CASE WHEN ci.quantity_litres - pg_catalog.floor(ci.quantity_litres) = 0.5
        THEN half_price.price_per_delivery_paise ELSE 0 END
    + one_price.delivery_fee_paise
END
FROM public.product_variants AS selected_variant
JOIN public.products AS selected_product ON selected_product.id = selected_variant.product_id
JOIN public.product_variants AS half_variant
  ON half_variant.product_id = selected_product.id AND half_variant.unit_quantity = 0.5
JOIN public.product_variants AS one_variant
  ON one_variant.product_id = selected_product.id AND one_variant.unit_quantity = 1.0
JOIN public.vendor_prices AS half_price
  ON half_price.product_variant_id = half_variant.id
 AND half_price.is_current AND half_price.effective_to IS NULL
 AND half_price.effective_from <= pg_catalog.now()
JOIN public.vendor_prices AS one_price
  ON one_price.product_variant_id = one_variant.id
 AND one_price.vendor_id = half_price.vendor_id
 AND one_price.milk_type = half_price.milk_type
 AND one_price.is_current AND one_price.effective_to IS NULL
 AND one_price.effective_from <= pg_catalog.now()
WHERE ci.product_variant_id = selected_variant.id
  AND selected_product.product_type IN ('standard_milk', 'canteen_milk')
  AND ci.vendor_id = half_price.vendor_id
  AND ci.milk_type = half_price.milk_type
  AND half_price.vendor_id = one_price.vendor_id
  AND half_price.milk_type = one_price.milk_type
  AND ci.quantity_litres IS NOT NULL;

COMMIT;
