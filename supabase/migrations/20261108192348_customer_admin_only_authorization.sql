BEGIN;

CREATE OR REPLACE FUNCTION private.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT private.is_admin_or_owner();
$function$;

CREATE OR REPLACE FUNCTION private.has_staff_permission(
  check_permission public.staff_permission_enum
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT private.is_admin_or_owner();
$function$;

DROP POLICY IF EXISTS user_roles_manage_admin_owner ON public.user_roles;
CREATE POLICY user_roles_manage_admin_owner
ON public.user_roles
FOR ALL
TO authenticated
USING (
  (SELECT public.is_owner())
  OR (
    (SELECT public.is_admin_or_owner())
    AND role IN ('admin'::public.user_role_enum, 'customer'::public.user_role_enum)
    AND user_id <> (SELECT auth.uid())
  )
)
WITH CHECK (
  role IN ('owner'::public.user_role_enum, 'admin'::public.user_role_enum, 'customer'::public.user_role_enum)
  AND (
    (SELECT public.is_owner())
    OR (
      (SELECT public.is_admin_or_owner())
      AND role IN ('admin'::public.user_role_enum, 'customer'::public.user_role_enum)
      AND user_id <> (SELECT auth.uid())
    )
  )
);

COMMIT;