-- Remove unpriced prototype vendors from the active Dairybuy catalogue.
-- Historical commerce references are guarded before deleting the vendor rows.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.cart_items
    WHERE vendor_id IN ('fresh-punjab', 'kolkata-centre')
  ) OR EXISTS (
    SELECT 1 FROM public.order_items
    WHERE vendor_id IN ('fresh-punjab', 'kolkata-centre')
  ) OR EXISTS (
    SELECT 1 FROM public.subscription_items
    WHERE vendor_id IN ('fresh-punjab', 'kolkata-centre')
  ) OR EXISTS (
    SELECT 1 FROM public.subscription_vendor_changes
    WHERE old_vendor_id IN ('fresh-punjab', 'kolkata-centre')
       OR new_vendor_id IN ('fresh-punjab', 'kolkata-centre')
  ) THEN
    RAISE EXCEPTION 'Cannot remove Fresh Punjab Milk or Kolkata Milk Centre: historical commerce references exist';
  END IF;
END
$$;

DELETE FROM public.vendor_prices
WHERE vendor_id IN ('fresh-punjab', 'kolkata-centre');

DELETE FROM public.vendor_products
WHERE vendor_id IN ('fresh-punjab', 'kolkata-centre');

DELETE FROM public.vendors
WHERE id IN ('fresh-punjab', 'kolkata-centre');

COMMIT;
