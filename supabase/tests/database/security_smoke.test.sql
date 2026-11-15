-- Dairybuy database security smoke tests (pgTAP)
-- Run with: supabase test db
-- Uses only transaction-local JWT claims and rolls back all changes.

begin;

select extensions.plan(31);

-- Schema and auth provisioning baseline.
select extensions.ok(
  (select count(*) = 34 from pg_tables where schemaname = 'public' and rowsecurity),
  'all 34 public tables have row-level security enabled'
);
select extensions.ok(to_regclass('public.profiles') is not null, 'profiles table exists');
select extensions.ok(to_regclass('public.user_roles') is not null, 'user_roles table exists');
select extensions.ok(to_regclass('public.products') is not null, 'products table exists');
select extensions.ok(to_regclass('public.orders') is not null, 'orders table exists');
select extensions.ok(to_regprocedure('public.handle_new_user()') is not null, 'signup provisioning function exists');
select extensions.ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth'
      and c.relname = 'users'
      and t.tgname = 'on_auth_user_created'
      and not t.tgisinternal
  ),
  'auth.users signup trigger exists'
);

-- Simulate the already-created owner account using transaction-local JWT claims.
-- Set claims before switching to authenticated so the owner UUID can be resolved
-- under the database test runner's privileged session.
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.user_roles where role = 'owner' limit 1),
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select user_id::text from public.user_roles where role = 'owner' limit 1),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select extensions.ok(public.is_owner(), 'owner is_owner helper returns true');
select extensions.ok(public.is_admin_or_owner(), 'owner admin-or-owner helper returns true');
select extensions.ok(public.is_staff(), 'owner is_staff helper returns true');
select extensions.ok(
  (select count(*) = 2 from public.user_roles where user_id = auth.uid()),
  'owner can read their two assigned roles'
);
select extensions.ok(
  (select count(*) = 12 from public.products),
  'owner can read the seeded product catalogue'
);

-- A non-owner authenticated identity must not gain staff/owner privileges.
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
select extensions.ok(not public.is_owner(), 'ordinary authenticated user is not owner');
select extensions.ok(not public.is_admin_or_owner(), 'ordinary authenticated user is not admin or owner');
select extensions.ok(not public.is_staff(), 'ordinary authenticated user is not staff');
select extensions.ok(
  (select count(*) = 0 from public.user_roles where user_id = auth.uid()),
  'ordinary authenticated user cannot see another user roles'
);
select extensions.ok((select count(*) = 0 from public.orders), 'ordinary user sees no other customers orders');
select extensions.ok((select count(*) = 0 from public.profiles), 'ordinary user sees no other customers profiles');

-- Anonymous visitors may read public catalogue data, but not private records.
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select extensions.ok(not public.is_owner(), 'anonymous visitor is not owner');
select extensions.ok(not public.is_admin_or_owner(), 'anonymous visitor is not admin or owner');
select extensions.ok(not public.is_staff(), 'anonymous visitor is not staff');
select extensions.ok((select count(*) = 12 from public.products), 'anonymous visitor can read active public products');
select extensions.ok((select count(*) = 0 from public.orders), 'anonymous visitor cannot read orders');
select extensions.ok((select count(*) = 0 from public.profiles), 'anonymous visitor cannot read profiles');

-- Privilege hardening checks.
reset role;
select extensions.ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and cmd in ('INSERT', 'ALL')
  ),
  'orders has no direct client INSERT or ALL policy'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'public.get_user_roles(uuid)', 'EXECUTE'),
  'authenticated cannot directly execute get_user_roles'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.get_user_roles(uuid)', 'EXECUTE'),
  'anonymous cannot directly execute get_user_roles'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'),
  'authenticated cannot directly execute signup trigger function'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'),
  'anonymous cannot directly execute signup trigger function'
);
select extensions.ok(
  not has_schema_privilege('authenticated', 'public', 'CREATE'),
  'authenticated cannot create objects in public schema'
);
select extensions.ok(
  not has_schema_privilege('anon', 'public', 'CREATE'),
  'anonymous cannot create objects in public schema'
);

select * from extensions.finish();
rollback;
