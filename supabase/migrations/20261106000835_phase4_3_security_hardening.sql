
-- Dairybuy Phase 4.3: security hardening.
-- Preserve authenticated customer CRUD and staff access; guest carts remain client-side.

-- 1) Cart tables: no anonymous persistence; remove non-DML privileges that RLS cannot constrain.
REVOKE ALL PRIVILEGES ON TABLE public.carts, public.cart_items FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.carts, public.cart_items
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.carts, public.cart_items
  TO authenticated;

-- 2) Cart policies: authenticated owner or existing staff role only.
DROP POLICY IF EXISTS carts_owner_access ON public.carts;
CREATE POLICY carts_owner_access
  ON public.carts
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.uid()) = customer_id
    OR (SELECT public.is_staff())
  )
  WITH CHECK (
    (SELECT auth.uid()) = customer_id
    OR (SELECT public.is_staff())
  );

DROP POLICY IF EXISTS cart_items_owner_access ON public.cart_items;
CREATE POLICY cart_items_owner_access
  ON public.cart_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.carts
      WHERE public.carts.id = cart_items.cart_id
        AND (
          public.carts.customer_id = (SELECT auth.uid())
          OR (SELECT public.is_staff())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.carts
      WHERE public.carts.id = cart_items.cart_id
        AND (
          public.carts.customer_id = (SELECT auth.uid())
          OR (SELECT public.is_staff())
        )
    )
  );

-- 3) Public catalogue view must obey the caller's base-table grants and RLS.
ALTER VIEW public.public_catalogue SET (security_invoker = true);
REVOKE ALL PRIVILEGES ON TABLE public.public_catalogue FROM anon, authenticated;
GRANT SELECT ON TABLE public.public_catalogue TO anon, authenticated;

-- Only the columns projected by public_catalogue are exposed from variants.
GRANT SELECT (
  id,
  product_id,
  variant_name,
  brand,
  pack_size,
  pack_unit,
  unit_quantity,
  final_price_paise,
  is_orderable
) ON TABLE public.product_variants TO anon, authenticated;

-- 4) Pin function search_path. Function bodies already schema-qualify referenced relations.
ALTER FUNCTION public.get_auth_uid() SECURITY INVOKER;
ALTER FUNCTION public.get_auth_uid() SET search_path = '';
ALTER FUNCTION public.has_staff_permission(public.staff_permission_enum) SET search_path = '';
ALTER FUNCTION public.is_admin_or_owner() SET search_path = '';
ALTER FUNCTION public.is_owner() SET search_path = '';
ALTER FUNCTION public.is_staff() SET search_path = '';
ALTER FUNCTION public.handle_updated_at() SET search_path = 'pg_catalog';

-- 5) Event-trigger helper is invoked by the installed event trigger, not by API clients.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated, service_role;
