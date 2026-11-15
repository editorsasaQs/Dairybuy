-- Dairybuy Phase 4.2: authenticated cart persistence.
-- Adds deterministic active-cart/line uniqueness and one atomic, owner-scoped
-- replacement RPC. Prices passed to this RPC are server-validated snapshots;
-- checkout MUST revalidate all prices against live catalogue/vendor data.

CREATE SCHEMA IF NOT EXISTS private;

CREATE UNIQUE INDEX IF NOT EXISTS uq_carts_one_active_per_customer
  ON public.carts (customer_id)
  WHERE customer_id IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_line_selection
  ON public.cart_items (cart_id, product_variant_id, vendor_id, milk_type)
  NULLS NOT DISTINCT;

CREATE OR REPLACE FUNCTION public.sync_active_cart(p_items jsonb)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_customer_id uuid := auth.uid();
  v_cart_id uuid;
  v_item_count integer;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_items IS NULL OR pg_catalog.jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Cart items must be a JSON array'
      USING ERRCODE = '22023';
  END IF;

  v_item_count := pg_catalog.jsonb_array_length(p_items);
  IF v_item_count > 50 THEN
    RAISE EXCEPTION 'A cart cannot contain more than 50 different items'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_to_recordset(p_items) AS item(
      product_variant_id varchar,
      vendor_id varchar,
      milk_type public.milk_type_enum,
      quantity integer,
      unit_price_paise integer
    )
    WHERE item.product_variant_id IS NULL
       OR pg_catalog.btrim(item.product_variant_id) = ''
       OR item.quantity IS NULL
       OR item.quantity < 1
       OR item.quantity > 100
       OR item.unit_price_paise IS NULL
       OR item.unit_price_paise < 0
       OR (item.vendor_id IS NULL AND item.milk_type IS NOT NULL)
       OR (item.vendor_id IS NOT NULL AND item.milk_type IS NULL)
  ) THEN
    RAISE EXCEPTION 'One or more cart lines are invalid'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_to_recordset(p_items) AS item(
      product_variant_id varchar,
      vendor_id varchar,
      milk_type public.milk_type_enum,
      quantity integer,
      unit_price_paise integer
    )
    GROUP BY item.product_variant_id, item.vendor_id, item.milk_type
    HAVING pg_catalog.count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate cart line selections are not allowed'
      USING ERRCODE = '22023';
  END IF;

  IF v_item_count = 0 THEN
    SELECT id
      INTO v_cart_id
      FROM public.carts
     WHERE customer_id = v_customer_id
       AND status = 'active'
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

  -- Replacing the full snapshot inside this function makes the write atomic.
  -- The unique active-cart index serializes concurrent writes for this customer.
  DELETE FROM public.cart_items WHERE cart_id = v_cart_id;

  INSERT INTO public.cart_items (
    cart_id,
    product_variant_id,
    vendor_id,
    milk_type,
    quantity,
    unit_price_paise
  )
  SELECT
    v_cart_id,
    item.product_variant_id,
    item.vendor_id,
    item.milk_type,
    item.quantity,
    item.unit_price_paise
  FROM pg_catalog.jsonb_to_recordset(p_items) AS item(
    product_variant_id varchar,
    vendor_id varchar,
    milk_type public.milk_type_enum,
    quantity integer,
    unit_price_paise integer
  );

  RETURN v_cart_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_active_cart(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_active_cart(jsonb) TO authenticated;

COMMENT ON FUNCTION public.sync_active_cart(jsonb) IS
  'Atomically replaces the authenticated customer active cart. Call only after server-side cart validation; persisted prices are snapshots and must never be trusted for checkout.';

-- Defense in depth: authenticated users can call public RPCs directly, so a
-- trigger independently checks every persisted line and its authoritative price.
-- The trigger implementation lives in the private schema and is not an API RPC.
CREATE OR REPLACE FUNCTION private.validate_cart_item_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product_type public.product_type_enum;
  v_product_active boolean;
  v_variant_orderable boolean;
  v_unit_quantity numeric;
  v_final_price integer;
  v_vendor_type varchar;
  v_vendor_approved boolean;
  v_vendor_ordering_enabled boolean;
  v_price_count bigint;
  v_current_price integer;
  v_current_fee integer;
  v_current_total integer;
  v_expected_fee integer;
  v_delivery_fee integer;
BEGIN
  -- Serialize line inserts per cart and enforce the 50-line limit even when
  -- authenticated clients bypass the API and write directly to the table.
  PERFORM 1 FROM public.carts WHERE id = NEW.cart_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cart does not exist'
      USING ERRCODE = '23503';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF (SELECT pg_catalog.count(*) FROM public.cart_items WHERE cart_id = NEW.cart_id) >= 50 THEN
      RAISE EXCEPTION 'A cart cannot contain more than 50 different items'
        USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.cart_id IS DISTINCT FROM NEW.cart_id THEN
    IF (
      SELECT pg_catalog.count(*)
      FROM public.cart_items
      WHERE cart_id = NEW.cart_id AND id <> NEW.id
    ) >= 50 THEN
      RAISE EXCEPTION 'A cart cannot contain more than 50 different items'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT
    product.product_type,
    product.is_active,
    variant.is_orderable,
    variant.unit_quantity,
    variant.final_price_paise
  INTO
    v_product_type,
    v_product_active,
    v_variant_orderable,
    v_unit_quantity,
    v_final_price
  FROM public.product_variants AS variant
  JOIN public.products AS product ON product.id = variant.product_id
  WHERE variant.id = NEW.product_variant_id;

  IF NOT FOUND OR NOT v_product_active OR NOT v_variant_orderable THEN
    RAISE EXCEPTION 'Cart product or variant is not currently orderable'
      USING ERRCODE = '23514';
  END IF;

  IF v_product_type = 'grocery_dairy' THEN
    IF NEW.vendor_id IS NOT NULL OR NEW.milk_type IS NOT NULL THEN
      RAISE EXCEPTION 'Non-milk cart lines cannot select a vendor or milk type'
        USING ERRCODE = '23514';
    END IF;
    IF v_final_price IS NULL OR v_final_price <= 0 OR NEW.unit_price_paise <> v_final_price THEN
      RAISE EXCEPTION 'Cart line price does not match the current catalogue price'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF v_product_type NOT IN ('standard_milk', 'canteen_milk')
     OR NEW.vendor_id IS NULL
     OR NEW.milk_type IS NULL
     OR v_unit_quantity NOT IN (0.5, 1) THEN
    RAISE EXCEPTION 'Milk cart line selection is invalid'
      USING ERRCODE = '23514';
  END IF;

  SELECT vendor_type, is_approved, ordering_enabled
    INTO v_vendor_type, v_vendor_approved, v_vendor_ordering_enabled
    FROM public.vendors
   WHERE id = NEW.vendor_id;

  IF NOT FOUND OR NOT v_vendor_approved OR NOT v_vendor_ordering_enabled THEN
    RAISE EXCEPTION 'Selected milk vendor is not currently accepting orders'
      USING ERRCODE = '23514';
  END IF;

  IF v_product_type = 'standard_milk' THEN
    IF NEW.milk_type NOT IN ('cow', 'buffalo') OR v_vendor_type <> 'milk_vendor' THEN
      RAISE EXCEPTION 'Selected vendor or milk type is not valid for standard milk'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.milk_type <> 'canteen'
       OR NEW.vendor_id <> 'canteen-milk-centre'
       OR v_vendor_type <> 'canteen_vendor' THEN
      RAISE EXCEPTION 'Canteen milk requires the confirmed Canteen Milk Centre vendor'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vendor_products AS mapping
    WHERE mapping.vendor_id = NEW.vendor_id
      AND mapping.product_id = (
        SELECT product_id FROM public.product_variants WHERE id = NEW.product_variant_id
      )
      AND mapping.milk_type = NEW.milk_type
      AND mapping.is_active
  ) THEN
    RAISE EXCEPTION 'Selected vendor does not supply this milk type'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    pg_catalog.count(*),
    pg_catalog.min(price_per_delivery_paise),
    pg_catalog.min(delivery_fee_paise),
    pg_catalog.min(total_customer_delivery_paise)
  INTO v_price_count, v_current_price, v_current_fee, v_current_total
  FROM public.vendor_prices
  WHERE vendor_id = NEW.vendor_id
    AND product_variant_id = NEW.product_variant_id
    AND milk_type = NEW.milk_type
    AND is_current
    AND effective_to IS NULL
    AND effective_from <= pg_catalog.now();

  IF v_price_count <> 1 THEN
    RAISE EXCEPTION 'Current vendor price is missing or ambiguous'
      USING ERRCODE = '23514';
  END IF;

  IF v_product_type = 'canteen_milk' THEN
    SELECT CASE
      WHEN pg_catalog.jsonb_typeof(value) = 'number' THEN (value #>> '{}')::integer
      ELSE NULL
    END
    INTO v_delivery_fee
    FROM public.app_settings
    WHERE key = 'delivery_fee_paise';
    v_expected_fee := v_delivery_fee;
  ELSE
    v_expected_fee := 0;
  END IF;

  IF v_expected_fee IS NULL
     OR NEW.unit_price_paise IS DISTINCT FROM v_current_price
     OR v_current_fee IS DISTINCT FROM v_expected_fee
     OR v_current_total IS DISTINCT FROM (v_current_price + v_expected_fee) THEN
    RAISE EXCEPTION 'Cart line price does not match current vendor pricing'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.validate_cart_item_snapshot() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS cart_items_validate_snapshot ON public.cart_items;
CREATE TRIGGER cart_items_validate_snapshot
  BEFORE INSERT OR UPDATE OF cart_id, product_variant_id, vendor_id, milk_type, quantity, unit_price_paise
  ON public.cart_items
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_cart_item_snapshot();
