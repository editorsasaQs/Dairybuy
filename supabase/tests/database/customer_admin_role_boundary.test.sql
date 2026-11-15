-- Dairybuy strict role boundary regression tests.
-- Hinglish: Customer sirf apna data dekhega; admin/owner ko authorized admin access milega.
-- Legacy manager/operations_staff role ko staff access nahi milega.
-- Run with: supabase test db

BEGIN;
SELECT extensions.plan(15);

INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','authenticated','authenticated','rls-legacy-manager@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Legacy Manager"}'::jsonb);

-- Test fixture only: simulate a legacy role row that may exist from older deployments.
INSERT INTO public.user_roles (user_id, role)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','manager'::public.user_role_enum)
ON CONFLICT DO NOTHING;

SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
SELECT set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;

SELECT extensions.ok(NOT public.is_staff(), 'legacy manager is not staff');
SELECT extensions.ok(NOT public.is_admin_or_owner(), 'legacy manager is not admin or owner');
SELECT extensions.ok(NOT public.has_staff_permission('manage_catalogue'::public.staff_permission_enum), 'legacy manager cannot manage catalogue');
SELECT extensions.ok(NOT public.has_staff_permission('manage_inventory'::public.staff_permission_enum), 'legacy manager cannot manage inventory');
SELECT extensions.ok(NOT public.has_staff_permission('manage_pricing'::public.staff_permission_enum), 'legacy manager cannot manage pricing');
SELECT extensions.ok(NOT public.has_staff_permission('manage_vendors'::public.staff_permission_enum), 'legacy manager cannot manage vendors');
SELECT extensions.is((SELECT count(*)::int FROM public.inventory), 0, 'legacy manager cannot read inventory');
SELECT extensions.is((SELECT count(*)::int FROM public.inventory_movements), 0, 'legacy manager cannot read inventory movements');
SELECT extensions.is((SELECT count(*)::int FROM public.cod_collections), 0, 'legacy manager cannot read COD collections');
SELECT extensions.is((SELECT count(*)::int FROM public.delivery_assignments), 0, 'legacy manager cannot read delivery assignments');
SELECT extensions.is((SELECT count(*)::int FROM public.audit_logs), 0, 'legacy manager cannot read admin audit logs');

-- Provision a dedicated admin identity and verify its privileges remain intact.
RESET ROLE;
INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','authenticated','authenticated','rls-admin@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"RLS Admin"}'::jsonb);
INSERT INTO public.user_roles (user_id, role)
VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','admin'::public.user_role_enum)
ON CONFLICT DO NOTHING;

SELECT set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
SELECT set_config('request.jwt.claims','{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(public.is_admin_or_owner(), 'admin retains admin authorization');
SELECT extensions.ok(public.is_staff(), 'admin retains privileged staff access');
SELECT extensions.ok(public.has_staff_permission('manage_catalogue'::public.staff_permission_enum), 'admin retains catalogue management access');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM public.user_roles WHERE role='owner'::public.user_role_enum LIMIT 1),true);
SELECT set_config('request.jwt.claims',json_build_object('sub',(SELECT user_id::text FROM public.user_roles WHERE role='owner'::public.user_role_enum LIMIT 1),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(public.is_admin_or_owner(), 'owner retains admin-level authorization');

SELECT * FROM extensions.finish();
ROLLBACK;
