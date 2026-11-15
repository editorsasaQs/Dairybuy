-- Phase 4.4.6.2: immutable delivery-address snapshots for orders.
ALTER TABLE public.orders
  ADD COLUMN delivery_address_snapshot jsonb,
  ADD COLUMN delivery_address_snapshot_source text,
  ADD COLUMN delivery_address_snapshot_at timestamptz;

ALTER TABLE public.orders DISABLE TRIGGER trg_orders_updated_at;

UPDATE public.orders AS o
SET delivery_address_snapshot = pg_catalog.jsonb_build_object(
      'schema_version', 1,
      'recipient_name', a.recipient_name,
      'phone', a.phone,
      'address_line1', a.address_line1,
      'address_line2', a.address_line2,
      'landmark', a.landmark,
      'city', a.city,
      'state', a.state,
      'pincode', a.pincode,
      'service_area_id', o.service_area_id
    ),
    delivery_address_snapshot_source = 'legacy_reconstructed',
    delivery_address_snapshot_at = pg_catalog.transaction_timestamp()
FROM public.customer_addresses AS a
WHERE a.id = o.customer_address_id
  AND a.customer_id = o.customer_id;

ALTER TABLE public.orders ENABLE TRIGGER trg_orders_updated_at;

DO $migration_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE delivery_address_snapshot IS NULL
       OR delivery_address_snapshot_source IS NULL
       OR delivery_address_snapshot_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot snapshot every legacy order from its linked customer-owned address';
  END IF;
END;
$migration_guard$;

ALTER TABLE public.orders
  ALTER COLUMN delivery_address_snapshot SET NOT NULL,
  ALTER COLUMN delivery_address_snapshot_source SET NOT NULL,
  ALTER COLUMN delivery_address_snapshot_at SET NOT NULL,
  ADD CONSTRAINT orders_delivery_address_snapshot_shape_check CHECK (
    pg_catalog.jsonb_typeof(delivery_address_snapshot) = 'object'
    AND delivery_address_snapshot->>'schema_version' = '1'
    AND NULLIF(pg_catalog.btrim(delivery_address_snapshot->>'recipient_name'), '') IS NOT NULL
    AND NULLIF(pg_catalog.btrim(delivery_address_snapshot->>'phone'), '') IS NOT NULL
    AND NULLIF(pg_catalog.btrim(delivery_address_snapshot->>'address_line1'), '') IS NOT NULL
    AND NULLIF(pg_catalog.btrim(delivery_address_snapshot->>'city'), '') IS NOT NULL
    AND NULLIF(pg_catalog.btrim(delivery_address_snapshot->>'state'), '') IS NOT NULL
    AND NULLIF(pg_catalog.btrim(delivery_address_snapshot->>'pincode'), '') IS NOT NULL
    AND NULLIF(pg_catalog.btrim(delivery_address_snapshot->>'service_area_id'), '') IS NOT NULL
    AND delivery_address_snapshot ? 'address_line2'
    AND delivery_address_snapshot ? 'landmark'
  ),
  ADD CONSTRAINT orders_delivery_address_snapshot_source_check
    CHECK (delivery_address_snapshot_source IN ('checkout', 'legacy_reconstructed'));

COMMENT ON COLUMN public.orders.delivery_address_snapshot IS
  'Versioned immutable delivery address captured at order creation; legacy rows are reconstructed and explicitly marked.';
COMMENT ON COLUMN public.orders.delivery_address_snapshot_source IS
  'checkout = captured during order insert; legacy_reconstructed = copied from the currently linked saved address during migration.';
COMMENT ON COLUMN public.orders.delivery_address_snapshot_at IS
  'Timestamp the immutable snapshot was captured or reconstructed; legacy timestamps are migration-time, not checkout-time.';

CREATE OR REPLACE FUNCTION private.enforce_order_delivery_address_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_address public.customer_addresses%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT a.* INTO v_address
    FROM public.customer_addresses AS a
    WHERE a.id = NEW.customer_address_id
      AND a.customer_id = NEW.customer_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order address does not belong to the order customer'
        USING ERRCODE = '23514';
    END IF;

    IF v_address.service_area_id IS DISTINCT FROM NEW.service_area_id
       OR NOT EXISTS (
         SELECT 1
         FROM public.service_areas AS sa
         JOIN public.service_area_pincodes AS sp ON sp.service_area_id = sa.id
         WHERE sa.id = v_address.service_area_id
           AND sa.is_active
           AND sp.is_active
           AND sp.pincode = v_address.pincode
       ) THEN
      RAISE EXCEPTION 'Order address is not serviceable for the selected service area'
        USING ERRCODE = '23514';
    END IF;

    NEW.delivery_address_snapshot := pg_catalog.jsonb_build_object(
      'schema_version', 1,
      'recipient_name', v_address.recipient_name,
      'phone', v_address.phone,
      'address_line1', v_address.address_line1,
      'address_line2', v_address.address_line2,
      'landmark', v_address.landmark,
      'city', v_address.city,
      'state', v_address.state,
      'pincode', v_address.pincode,
      'service_area_id', v_address.service_area_id
    );
    NEW.delivery_address_snapshot_source := 'checkout';
    NEW.delivery_address_snapshot_at := pg_catalog.transaction_timestamp();
    RETURN NEW;
  END IF;

  IF ROW(
    NEW.delivery_address_snapshot,
    NEW.delivery_address_snapshot_source,
    NEW.delivery_address_snapshot_at
  ) IS DISTINCT FROM ROW(
    OLD.delivery_address_snapshot,
    OLD.delivery_address_snapshot_source,
    OLD.delivery_address_snapshot_at
  ) THEN
    RAISE EXCEPTION 'Order delivery address snapshots are immutable'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.enforce_order_delivery_address_snapshot() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS orders_delivery_address_snapshot_guard ON public.orders;
CREATE TRIGGER orders_delivery_address_snapshot_guard
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION private.enforce_order_delivery_address_snapshot();

COMMENT ON FUNCTION private.enforce_order_delivery_address_snapshot() IS
  'Captures an owned, serviceable delivery address under a row lock on order insert and prevents later snapshot/provenance mutation.';