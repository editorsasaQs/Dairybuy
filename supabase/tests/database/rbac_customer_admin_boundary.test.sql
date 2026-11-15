-- Phase 4.2 RBAC regression tests.
-- Confirms the live Customer + Admin/Owner authorization model.
-- Synthetic auth users and all fixture rows are rolled back.
-- Run with: supabase test db

BEGIN;
SELECT extensions.plan(35);

-- The baseline migration must install the RLS event trigger before creating
-- public tables, so clean local databases match the existing dev baseline.
SELECT extensions.ok(
  to_regprocedure('public.rls_auto_enable()') IS NOT NULL,
  'RLS event-trigger function exists'
);
SELECT extensions.ok(
  (SELECT prosecdef FROM pg_proc WHERE oid='public.rls_auto_enable()'::regprocedure),
  'RLS event-trigger function is SECURITY DEFINER'
);
SELECT extensions.ok(
  (SELECT proconfig @> ARRAY['search_path=pg_catalog'] FROM pg_proc WHERE oid='public.rls_auto_enable()'::regprocedure),
  'RLS event-trigger function pins search_path to pg_catalog'
);
SELECT extensions.ok(
  (SELECT evtenabled='O' AND evtevent='ddl_command_end'
          AND evttags @> ARRAY['CREATE TABLE','CREATE TABLE AS','SELECT INTO']::text[]
   FROM pg_event_trigger WHERE evtname='ensure_rls'
     AND evtfoid='public.rls_auto_enable()'::regprocedure),
  'ensure_rls event trigger is enabled for public table creation'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE')
  AND NOT has_function_privilege('service_role','public.rls_auto_enable()','EXECUTE'),
  'API roles cannot directly execute the RLS event-trigger function'
);
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relkind IN ('r','p')
      AND NOT c.relrowsecurity
  ),
  'all public tables have row-level security enabled'
);

SELECT extensions.ok(
  (SELECT NOT prosecdef FROM pg_proc WHERE oid='public.is_staff()'::regprocedure),
  'public is_staff wrapper remains SECURITY INVOKER'
);
SELECT extensions.ok(
  (SELECT prosecdef FROM pg_proc WHERE oid='private.is_staff()'::regprocedure),
  'private is_staff implementation is SECURITY DEFINER'
);
SELECT extensions.ok(
  (SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid='private.is_staff()'::regprocedure),
  'private is_staff uses an empty search_path'
);
SELECT extensions.ok(
  position('private.is_admin_or_owner' IN pg_get_functiondef('private.is_staff()'::regprocedure)) > 0,
  'private is_staff delegates to admin-or-owner authorization'
);
SELECT extensions.ok(
  (SELECT prosecdef FROM pg_proc WHERE oid='private.has_staff_permission(public.staff_permission_enum)'::regprocedure),
  'private has_staff_permission is SECURITY DEFINER'
);
SELECT extensions.ok(
  position('private.is_admin_or_owner' IN pg_get_functiondef('private.has_staff_permission(public.staff_permission_enum)'::regprocedure)) > 0,
  'staff permissions do not elevate legacy roles'
);

-- The later policy-splitting migration replaces the original ALL policy
-- with separate INSERT, UPDATE and DELETE policies.
SELECT extensions.ok(
  (SELECT count(*) = 3
       AND bool_and(roles @> ARRAY['authenticated']::name[])
       AND array_agg(cmd ORDER BY cmd) = ARRAY['DELETE','INSERT','UPDATE']::text[]
   FROM pg_policies
   WHERE schemaname='public' AND tablename='user_roles'
     AND policyname IN (
       'user_roles_manage_admin_owner_insert',
       'user_roles_manage_admin_owner_update',
       'user_roles_manage_admin_owner_delete'
     )),
  'split role-management policies are authenticated-only'
);
SELECT extensions.ok(
  (SELECT count(*) = 3 AND bool_and(
     CASE cmd
       WHEN 'INSERT' THEN
         with_check LIKE '%owner%' AND with_check LIKE '%admin%'
         AND with_check LIKE '%customer%'
         AND with_check NOT LIKE '%manager%'
         AND with_check NOT LIKE '%operations_staff%'
       WHEN 'UPDATE' THEN
         qual LIKE '%admin%' AND qual LIKE '%customer%'
         AND with_check LIKE '%owner%' AND with_check LIKE '%admin%'
         AND with_check LIKE '%customer%'
         AND qual NOT LIKE '%manager%' AND with_check NOT LIKE '%manager%'
         AND qual NOT LIKE '%operations_staff%' AND with_check NOT LIKE '%operations_staff%'
       WHEN 'DELETE' THEN
         qual LIKE '%admin%' AND qual LIKE '%customer%'
         AND qual NOT LIKE '%manager%' AND qual NOT LIKE '%operations_staff%'
       ELSE false
     END
   )
   FROM pg_policies
   WHERE schemaname='public' AND tablename='user_roles'
     AND policyname IN (
       'user_roles_manage_admin_owner_insert',
       'user_roles_manage_admin_owner_update',
       'user_roles_manage_admin_owner_delete'
     )),
  'split role-management policies enforce the supported role allowlist'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon','public.user_roles','SELECT'),
  'anonymous clients cannot read user roles'
);
SELECT extensions.ok(
  NOT has_table_privilege('anon','public.user_roles','INSERT'),
  'anonymous clients cannot create user roles'
);
SELECT extensions.ok(
  has_table_privilege('authenticated','public.user_roles','SELECT'),
  'authenticated clients retain RLS-filtered own-role reads'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated','public.user_roles','TRUNCATE'),
  'authenticated clients cannot truncate role assignments'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon','public.handle_new_user()','EXECUTE'),
  'anonymous clients cannot execute signup provisioning function'
);

-- Trigger provisions each synthetic user as customer. Add legacy roles as a
-- privileged test fixture so the actual authorization helpers can be checked.
INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES
  ('c2222222-2222-4222-8222-222222222222','authenticated','authenticated',
   'rbac-manager@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('d3333333-3333-4333-8333-333333333333','authenticated','authenticated',
   'rbac-ops@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);

INSERT INTO public.user_roles (user_id,role)
VALUES
  ('c2222222-2222-4222-8222-222222222222','manager'),
  ('d3333333-3333-4333-8333-333333333333','operations_staff');

-- Real DML authorization coverage. All users below are synthetic and this
-- entire test transaction is rolled back at the end of the file.
INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES
  ('e1111111-1111-4111-8111-111111111111','authenticated','authenticated',
   'rbac-owner@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('e2222222-2222-4222-8222-222222222222','authenticated','authenticated',
   'rbac-admin@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('e3333333-3333-4333-8333-333333333333','authenticated','authenticated',
   'rbac-customer@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('e4444444-4444-4444-8444-444444444444','authenticated','authenticated',
   'rbac-owner-insert-target@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('e5555555-5555-4555-8555-555555555555','authenticated','authenticated',
   'rbac-owner-update-target@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('e6666666-6666-4666-8666-666666666666','authenticated','authenticated',
   'rbac-owner-delete-target@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('e7777777-7777-4777-8777-777777777777','authenticated','authenticated',
   'rbac-admin-insert-target@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('e8888888-8888-4888-8888-888888888888','authenticated','authenticated',
   'rbac-admin-customer-target@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('e9999999-9999-4999-8999-999999999999','authenticated','authenticated',
   'rbac-admin-promote-target@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('ea111111-1111-4111-8111-111111111111','authenticated','authenticated',
   'rbac-admin-owner-insert-target@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('eb111111-1111-4111-8111-111111111111','authenticated','authenticated',
   'rbac-customer-insert-target@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);

-- Promote actor and policy-target fixtures while running as the test owner.
UPDATE public.user_roles SET role='owner'
WHERE user_id='e1111111-1111-4111-8111-111111111111';
UPDATE public.user_roles SET role='admin'
WHERE user_id IN (
  'e2222222-2222-4222-8222-222222222222',
  'e9999999-9999-4999-8999-999999999999'
);

-- These targets need no existing role row so INSERT policy behavior is tested.
DELETE FROM public.user_roles
WHERE user_id IN (
  'e4444444-4444-4444-8444-444444444444',
  'e7777777-7777-4777-8777-777777777777',
  'e8888888-8888-4888-8888-888888888888',
  'ea111111-1111-4111-8111-111111111111',
  'eb111111-1111-4111-8111-111111111111'
);

SELECT set_config('request.jwt.claim.sub','c2222222-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claims',
  '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(NOT public.is_staff(), 'legacy manager role is not staff');
SELECT extensions.ok(
  NOT public.has_staff_permission('manage_inventory'::public.staff_permission_enum),
  'legacy manager role receives no operational permission'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub','d3333333-3333-4333-8333-333333333333',true);
SELECT set_config('request.jwt.claims',
  '{"sub":"d3333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(NOT public.is_staff(), 'legacy operations_staff role is not staff');
SELECT extensions.ok(
  NOT public.has_staff_permission('assign_deliveries'::public.staff_permission_enum),
  'legacy operations_staff role receives no delivery permission'
);


-- Owner can insert an owner assignment for a user without a current role.
SELECT set_config('request.jwt.claim.sub','e1111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claims',
  '{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.user_roles (user_id,role)
VALUES ('e4444444-4444-4444-8444-444444444444','owner');
RESET ROLE;
SELECT extensions.is(
  (SELECT role::text FROM public.user_roles WHERE user_id='e4444444-4444-4444-8444-444444444444'),
  'owner',
  'owner can insert an owner role assignment'
);

-- Owner can update and delete other users' role assignments.
SELECT set_config('request.jwt.claim.sub','e1111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claims',
  '{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
UPDATE public.user_roles SET role='admin'
WHERE user_id='e5555555-5555-4555-8555-555555555555';
RESET ROLE;
SELECT extensions.is(
  (SELECT role::text FROM public.user_roles WHERE user_id='e5555555-5555-4555-8555-555555555555'),
  'admin',
  'owner can update another user role'
);
SELECT set_config('request.jwt.claim.sub','e1111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claims',
  '{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DELETE FROM public.user_roles
WHERE user_id='e6666666-6666-4666-8666-666666666666';
RESET ROLE;
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.user_roles WHERE user_id='e6666666-6666-4666-8666-666666666666'),
  0,
  'owner can delete another user role'
);

-- Admin can assign admin/customer to other users, but cannot assign owner.
SELECT set_config('request.jwt.claim.sub','e2222222-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.user_roles (user_id,role)
VALUES ('e7777777-7777-4777-8777-777777777777','admin');
RESET ROLE;
SELECT extensions.is(
  (SELECT role::text FROM public.user_roles WHERE user_id='e7777777-7777-4777-8777-777777777777'),
  'admin',
  'admin can assign admin role to another user'
);
SELECT set_config('request.jwt.claim.sub','e2222222-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.user_roles (user_id,role)
VALUES ('e8888888-8888-4888-8888-888888888888','customer');
RESET ROLE;
SELECT extensions.is(
  (SELECT role::text FROM public.user_roles WHERE user_id='e8888888-8888-4888-8888-888888888888'),
  'customer',
  'admin can assign customer role to another user'
);
SELECT set_config('request.jwt.claim.sub','e2222222-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
  $$INSERT INTO public.user_roles (user_id,role)
    VALUES ('ea111111-1111-4111-8111-111111111111','owner')$$,
  '42501',
  NULL,
  'admin cannot insert an owner role assignment'
);
RESET ROLE;

-- Admin cannot promote a different user to owner, mutate an owner assignment,
-- or change their own role.
SELECT set_config('request.jwt.claim.sub','e2222222-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claims',
  '{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
  $$UPDATE public.user_roles SET role='owner'
    WHERE user_id='e9999999-9999-4999-8999-999999999999'$$,
  '42501',
  NULL,
  'admin cannot promote another user to owner'
);
UPDATE public.user_roles SET role='customer'
WHERE user_id='e4444444-4444-4444-8444-444444444444';
DELETE FROM public.user_roles
WHERE user_id='e4444444-4444-4444-8444-444444444444';
UPDATE public.user_roles SET role='customer'
WHERE user_id='e2222222-2222-4222-8222-222222222222';
RESET ROLE;
SELECT extensions.is(
  (SELECT role::text FROM public.user_roles WHERE user_id='e4444444-4444-4444-8444-444444444444'),
  'owner',
  'admin cannot update or delete an owner assignment'
);
SELECT extensions.is(
  (SELECT role::text FROM public.user_roles WHERE user_id='e2222222-2222-4222-8222-222222222222'),
  'admin',
  'admin cannot change their own role'
);

-- Customer cannot create, update, or delete role assignments and can only
-- read their own role row.
SELECT set_config('request.jwt.claim.sub','e3333333-3333-4333-8333-333333333333',true);
SELECT set_config('request.jwt.claims',
  '{"sub":"e3333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
  $$INSERT INTO public.user_roles (user_id,role)
    VALUES ('eb111111-1111-4111-8111-111111111111','admin')$$,
  '42501',
  NULL,
  'customer cannot insert a role assignment'
);
UPDATE public.user_roles SET role='admin'
WHERE user_id='e3333333-3333-4333-8333-333333333333';
DELETE FROM public.user_roles
WHERE user_id='e3333333-3333-4333-8333-333333333333';
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.user_roles),
  1,
  'customer can read only their own role assignment'
);
RESET ROLE;
SELECT extensions.is(
  (SELECT role::text FROM public.user_roles WHERE user_id='e3333333-3333-4333-8333-333333333333'),
  'customer',
  'customer cannot update or delete their own role'
);

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
