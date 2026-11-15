BEGIN;

-- Legacy catalogue cleanup based on owner-confirmed CSV.
-- Disable unconfirmed legacy breakfast-staple rows only; preserve history.
UPDATE public.product_variants
SET is_orderable = FALSE
WHERE product_id IN ('bread-white','eggs-farm','banana-robusta','juice-fruit','jam-fruit');

UPDATE public.products
SET is_active = FALSE
WHERE id IN ('bread-white','eggs-farm','banana-robusta','juice-fruit','jam-fruit');

UPDATE public.categories
SET is_active = FALSE
WHERE id = 'morning-essentials';

COMMIT;