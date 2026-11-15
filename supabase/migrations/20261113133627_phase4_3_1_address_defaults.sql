BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_addresses_one_default
ON public.customer_addresses(customer_id)
WHERE is_default = TRUE;

CREATE OR REPLACE FUNCTION public.set_customer_default_address(p_address_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_customer_id UUID := auth.uid();
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.customer_addresses
    WHERE id = p_address_id AND customer_id = v_customer_id
  ) THEN
    RAISE EXCEPTION 'Address not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.customer_addresses
  SET is_default = FALSE, updated_at = NOW()
  WHERE customer_id = v_customer_id AND is_default = TRUE AND id <> p_address_id;

  UPDATE public.customer_addresses
  SET is_default = TRUE, updated_at = NOW()
  WHERE id = p_address_id AND customer_id = v_customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_customer_default_address(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_customer_default_address(UUID) TO authenticated;

COMMIT;