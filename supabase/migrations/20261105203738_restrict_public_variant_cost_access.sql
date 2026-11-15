-- Restrict public product-variant reads to customer-facing columns.
-- Trusted server-side roles retain their existing access to internal costs.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE public.product_variants FROM anon, authenticated;
GRANT SELECT (
  id, product_id, variant_name, brand, pack_size, pack_unit,
  unit_quantity, final_price_paise, is_orderable
) ON TABLE public.product_variants TO anon, authenticated;

DO $$
BEGIN
  IF has_column_privilege('anon', 'public.product_variants', 'purchase_price_paise', 'SELECT')
     OR has_column_privilege('anon', 'public.product_variants', 'sheet_delivery_component_paise', 'SELECT')
     OR has_column_privilege('authenticated', 'public.product_variants', 'purchase_price_paise', 'SELECT')
     OR has_column_privilege('authenticated', 'public.product_variants', 'sheet_delivery_component_paise', 'SELECT') THEN
    RAISE EXCEPTION 'Internal product cost columns remain selectable by public roles';
  END IF;
  IF NOT has_column_privilege('anon', 'public.product_variants', 'final_price_paise', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.product_variants', 'final_price_paise', 'SELECT') THEN
    RAISE EXCEPTION 'Customer-facing final price column must remain selectable';
  END IF;
END;
$$;
COMMIT;