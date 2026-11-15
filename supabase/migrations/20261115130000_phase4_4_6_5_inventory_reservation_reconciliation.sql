-- Phase 4.4.6.5 Stage C: read-only inventory reservation reconciliation.
-- Reports drift between inventory.reserved_stock and the immutable movement ledger.
CREATE OR REPLACE FUNCTION public.audit_inventory_reservations()
RETURNS TABLE(
  audit_type text,
  inventory_id uuid,
  order_id uuid,
  product_variant_id varchar,
  service_area_id uuid,
  recorded_reserved_stock integer,
  ledger_reserved_stock integer,
  order_status text,
  detail text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Not authorized to audit inventory reservations' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH inventory_ledger AS (
    SELECT im.inventory_id,
      COALESCE(SUM(im.change_amount) FILTER (
        WHERE im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled')
      ),0)::integer AS ledger_reserved
    FROM public.inventory_movements im
    GROUP BY im.inventory_id
  )
  SELECT
    'inventory_balance'::text,
    i.id,
    NULL::uuid,
    i.product_variant_id,
    i.service_area_id,
    i.reserved_stock,
    COALESCE(l.ledger_reserved,0),
    NULL::text,
    pg_catalog.format(
      'inventory.reserved_stock (%s) differs from reservation ledger (%s)',
      i.reserved_stock, COALESCE(l.ledger_reserved,0)
    )
  FROM public.inventory i
  LEFT JOIN inventory_ledger l ON l.inventory_id = i.id
  WHERE i.reserved_stock <> COALESCE(l.ledger_reserved,0)

  UNION ALL

  SELECT
    'order_ledger'::text,
    im.inventory_id,
    o.id,
    i.product_variant_id,
    i.service_area_id,
    i.reserved_stock,
    SUM(im.change_amount) FILTER (
      WHERE im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled')
    )::integer,
    o.status::text,
    pg_catalog.format(
      'order %s has reservation ledger balance %s for status %s; reservation/release/fulfillment movements: %s/%s/%s',
      o.id,
      SUM(im.change_amount) FILTER (
        WHERE im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled')
      ),
      o.status,
      count(*) FILTER (WHERE im.movement_type='order_reservation'),
      count(*) FILTER (WHERE im.movement_type='order_reservation_release'),
      count(*) FILTER (WHERE im.movement_type='order_fulfilled')
    )
  FROM public.inventory_movements im
  JOIN public.orders o ON o.id::text = im.reference_id
  JOIN public.inventory i ON i.id = im.inventory_id
  WHERE o.order_type='one_time' AND o.payment_method='cod'
    AND im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled')
  GROUP BY im.inventory_id,o.id,i.product_variant_id,i.service_area_id,i.reserved_stock,o.status
  HAVING
    SUM(im.change_amount) FILTER (
      WHERE im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled')
    ) < 0
    OR (o.status IN ('pending_confirmation','confirmed','processing','out_for_delivery')
        AND SUM(im.change_amount) FILTER (
          WHERE im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled')
        ) <= 0)
    OR (o.status IN ('cancelled','delivered')
        AND SUM(im.change_amount) FILTER (
          WHERE im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled')
        ) <> 0)
    OR count(*) FILTER (WHERE im.movement_type='order_reservation') > 1
    OR count(*) FILTER (WHERE im.movement_type='order_reservation_release') > 1
    OR count(*) FILTER (WHERE im.movement_type='order_fulfilled') > 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.audit_inventory_reservations() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.audit_inventory_reservations() TO authenticated;

COMMENT ON FUNCTION public.audit_inventory_reservations() IS
'Read-only owner/admin inventory reservation reconciliation. Compares inventory reserved counters to reservation/release/fulfillment movements and reports per-order ledger anomalies. Never repairs or mutates stock.';
