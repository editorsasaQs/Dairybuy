-- A customer-safe projection for the public catalogue Data API.
-- The view intentionally runs with its owner privileges (security_invoker is
-- false) because anon/authenticated cannot select the restricted base table.
-- It exposes only active categories/products and orderable variants, and only
-- customer-facing columns. Internal cost columns are never selected here.
BEGIN;

CREATE OR REPLACE VIEW public.public_catalogue
WITH (security_barrier = true)
AS
SELECT
  c.id AS category_id,
  c.name AS category_name,
  c.slug AS category_slug,
  c.description AS category_description,
  c.display_order AS category_display_order,
  p.id AS product_id,
  p.name AS product_name,
  p.slug AS product_slug,
  p.subtitle AS product_subtitle,
  p.description AS product_description,
  p.product_type AS product_type,
  p.requires_vendor_selection AS product_requires_vendor_selection,
  v.id AS variant_id,
  v.variant_name AS variant_name,
  v.brand AS variant_brand,
  v.pack_size AS variant_pack_size,
  v.pack_unit AS variant_pack_unit,
  v.unit_quantity AS variant_unit_quantity,
  v.final_price_paise AS variant_final_price_paise,
  v.is_orderable AS variant_is_orderable
FROM public.categories AS c
JOIN public.products AS p
  ON p.category_id = c.id
JOIN public.product_variants AS v
  ON v.product_id = p.id
WHERE c.is_active = true
  AND p.is_active = true
  AND v.is_orderable = true;

REVOKE ALL PRIVILEGES ON TABLE public.public_catalogue FROM PUBLIC;
GRANT SELECT ON TABLE public.public_catalogue TO anon, authenticated;

COMMIT;