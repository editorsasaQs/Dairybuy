-- Enforce the flat Dairybuy 30-day discount at subscription basket level.
BEGIN;
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS chk_subscription_discount_policy;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT chk_subscription_discount_policy
  CHECK (
    (plan_type = '30_day' AND (subtotal_paise = 0 OR discount_paise = 6000))
    OR (plan_type <> '30_day' AND discount_paise = 0)
  );
COMMENT ON CONSTRAINT chk_subscription_discount_policy ON public.subscriptions IS
  'A non-empty 30-day subscription receives exactly one flat ₹60 discount for the complete basket; 7-day and custom plans receive no discount.';
COMMIT;
