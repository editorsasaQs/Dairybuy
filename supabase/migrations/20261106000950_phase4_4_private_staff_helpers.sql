
-- Dairybuy Phase 4.4: isolate privileged staff helpers from the exposed API schema.
-- Public wrappers remain SECURITY INVOKER for compatibility; privileged implementations
-- live in private, which is not included in the project's exposed API schemas.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_admin_or_owner()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  curr_uid uuid := auth.uid();
BEGIN
  IF curr_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = curr_uid
      AND role IN ('owner', 'admin')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION private.is_owner()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  curr_uid uuid := auth.uid();
BEGIN
  IF curr_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = curr_uid
      AND role = 'owner'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION private.is_staff()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  curr_uid uuid := auth.uid();
BEGIN
  IF curr_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = curr_uid
      AND role IN ('owner', 'admin', 'manager', 'operations_staff')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION private.has_staff_permission(
  check_permission public.staff_permission_enum
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  curr_uid uuid := auth.uid();
BEGIN
  IF curr_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  IF private.is_admin_or_owner() THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.staff_permissions
    WHERE user_id = curr_uid
      AND permission = check_permission
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.is_admin_or_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_staff_permission(public.staff_permission_enum) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.is_admin_or_owner() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_owner() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_staff() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_staff_permission(public.staff_permission_enum) TO anon, authenticated, service_role;

-- Preserve existing RPC names while removing SECURITY DEFINER from the exposed schema.
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.is_admin_or_owner();
$function$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.is_owner();
$function$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.is_staff();
$function$;

CREATE OR REPLACE FUNCTION public.has_staff_permission(
  check_permission public.staff_permission_enum
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.has_staff_permission(check_permission);
$function$;
