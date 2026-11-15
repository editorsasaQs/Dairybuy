-- Dairybuy Phase 4.4.1: additive order schema contract.
-- Development rollout only after PR review. Existing rows remain valid.
BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.orders_order_number_seq
  AS bigint
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  START WITH 1
  CACHE 1;

CREATE OR REPLACE FUNCTION private.generate_order_number()
RETURNS varchar
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 'DBY-' ||
         pg_catalog.to_char(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD') ||
         '-' ||
         pg_catalog.lpad(pg_catalog.nextval('public.orders_order_number_seq'::pg_catalog.regclass)::text, 8, '0');
$function$;

REVOKE ALL ON FUNCTION private.generate_order_number() FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.orders_order_number_seq TO postgres, service_role;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

-- Existing rows are intentionally left NULL; new checkout RPC will always supply both.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_customer_idempotency
  ON public.orders (customer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Order history must not change when catalogue names/labels are edited later.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_name_snapshot varchar(200),
  ADD COLUMN IF NOT EXISTS variant_name_snapshot varchar(200),
  ADD COLUMN IF NOT EXISTS brand_snapshot varchar(120),
  ADD COLUMN IF NOT EXISTS pack_size_snapshot varchar(80),
  ADD COLUMN IF NOT EXISTS vendor_name_snapshot varchar(200);

-- Backfill legacy display values without changing quantities or money.
UPDATE public.order_items AS oi
SET product_name_snapshot = COALESCE(
      oi.product_name_snapshot,
      (SELECT p.name
       FROM public.product_variants AS pv
       JOIN public.products AS p ON p.id = pv.product_id
       WHERE pv.id = oi.product_variant_id)
    ),
    variant_name_snapshot = COALESCE(
      oi.variant_name_snapshot,
      (SELECT pv.variant_name FROM public.product_variants AS pv
       WHERE pv.id = oi.product_variant_id)
    ),
    brand_snapshot = COALESCE(
      oi.brand_snapshot,
      (SELECT pv.brand FROM public.product_variants AS pv
       WHERE pv.id = oi.product_variant_id)
    ),
    pack_size_snapshot = COALESCE(
      oi.pack_size_snapshot,
      (SELECT pv.pack_size FROM public.product_variants AS pv
       WHERE pv.id = oi.product_variant_id)
    ),
    vendor_name_snapshot = COALESCE(
      oi.vendor_name_snapshot,
      (SELECT v.name FROM public.vendors AS v WHERE v.id = oi.vendor_id)
    )
WHERE EXISTS (
  SELECT 1 FROM public.product_variants AS pv
  WHERE pv.id = oi.product_variant_id
);

ALTER TABLE public.orders
  ALTER COLUMN order_number SET DEFAULT private.generate_order_number();

COMMENT ON COLUMN public.orders.delivery_date IS
  'Local Dairybuy delivery date in Asia/Kolkata; required by the new one-time COD order RPC, nullable only for legacy rows.';
COMMENT ON COLUMN public.orders.idempotency_key IS
  'Client-generated UUID reused on retries; unique per customer when present.';
COMMENT ON COLUMN public.order_items.product_name_snapshot IS
  'Immutable product display name captured when the order is placed.';
COMMENT ON COLUMN public.order_items.variant_name_snapshot IS
  'Immutable variant display name captured when the order is placed.';
COMMENT ON COLUMN public.order_items.brand_snapshot IS
  'Immutable product brand captured when the order is placed.';
COMMENT ON COLUMN public.order_items.pack_size_snapshot IS
  'Immutable pack-size label captured when the order is placed.';
COMMENT ON COLUMN public.order_items.vendor_name_snapshot IS
  'Immutable selected vendor display name captured when the order is placed.';

COMMIT;
