BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (id,email,phone,full_name)
  VALUES (
    NEW.id,
    NULLIF(BTRIM(NEW.email),''),
    NULLIF(BTRIM(NEW.phone),''),
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'),'')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id,role)
  VALUES (NEW.id,'customer')
  ON CONFLICT (user_id,role) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

COMMIT;