-- Dairybuy Phase 4.3–4.4 security regression tests.
-- Run with: supabase test db
-- All fixture changes are rolled back.

begin;

select extensions.plan(30);

select extensions.ok(
  (select relrowsecurity from pg_class where oid='public.carts'::regclass),
  'carts has RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid='public.cart_items'::regclass),
  'cart_items has RLS enabled'
);

select extensions.ok(not has_table_privilege('anon','public.carts','SELECT'), 'anon cannot select carts');
select extensions.ok(not has_table_privilege('anon','public.carts','INSERT'), 'anon cannot insert carts');
select extensions.ok(not has_table_privilege('anon','public.cart_items','SELECT'), 'anon cannot select cart_items');
select extensions.ok(not has_table_privilege('anon','public.cart_items','INSERT'), 'anon cannot insert cart_items');

select extensions.ok(has_table_privilege('authenticated','public.carts','SELECT'), 'authenticated can select own carts');
select extensions.ok(has_table_privilege('authenticated','public.carts','INSERT'), 'authenticated can insert own carts');
select extensions.ok(has_table_privilege('authenticated','public.carts','UPDATE'), 'authenticated can update own carts');
select extensions.ok(has_table_privilege('authenticated','public.carts','DELETE'), 'authenticated can delete own carts');
select extensions.ok(not has_table_privilege('authenticated','public.carts','TRUNCATE'), 'authenticated cannot truncate carts');
select extensions.ok(not has_table_privilege('authenticated','public.cart_items','TRIGGER'), 'authenticated cannot create cart triggers');
select extensions.ok(not has_table_privilege('authenticated','public.cart_items','MAINTAIN'), 'authenticated cannot maintain cart_items');

select extensions.ok(has_column_privilege('anon','public.product_variants','final_price_paise','SELECT'), 'anon can read public selling price');
select extensions.ok(not has_column_privilege('anon','public.product_variants','purchase_price_paise','SELECT'), 'anon cannot read purchase price');
select extensions.ok(not has_column_privilege('anon','public.product_variants','sheet_delivery_component_paise','SELECT'), 'anon cannot read delivery cost');

select extensions.ok(
  (select reloptions @> ARRAY['security_invoker=true'] from pg_class where oid='public.public_catalogue'::regclass),
  'public catalogue uses security_invoker'
);
select extensions.ok(
  (select reloptions @> ARRAY['security_barrier=true'] from pg_class where oid='public.public_catalogue'::regclass),
  'public catalogue retains security_barrier'
);

select extensions.ok(not has_function_privilege('anon','public.rls_auto_enable()','EXECUTE'), 'anon cannot execute RLS event helper');
select extensions.ok(not has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE'), 'authenticated cannot execute RLS event helper');

select extensions.ok(
  (select not prosecdef from pg_proc where oid='public.is_staff()'::regprocedure),
  'public is_staff wrapper is SECURITY INVOKER'
);
select extensions.ok(
  (select not prosecdef from pg_proc where oid='public.is_owner()'::regprocedure),
  'public is_owner wrapper is SECURITY INVOKER'
);
select extensions.ok(
  (select prosecdef from pg_proc where oid='private.is_staff()'::regprocedure),
  'private is_staff implementation is SECURITY DEFINER'
);
select extensions.ok(
  (select proconfig @> ARRAY['search_path=""'] from pg_proc where oid='private.is_staff()'::regprocedure),
  'private is_staff has an empty search_path'
);

-- Anonymous visitor can still read only the public catalogue.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select extensions.ok((select count(*) > 0 from public.public_catalogue), 'anon can read the safe public catalogue');
select extensions.ok(not public.is_staff(), 'anon helper wrapper reports not staff');
reset role;

-- Existing owner helper behavior and seeded catalogue remain intact.
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.user_roles where role='owner' limit 1),
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select user_id::text from public.user_roles where role='owner' limit 1),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select extensions.ok(public.is_owner(), 'owner retains owner helper access');
select extensions.ok(public.has_staff_permission('manage_catalogue'::public.staff_permission_enum), 'owner retains staff permission helper access');
select extensions.ok((select count(*) = 12 from public.products), 'owner can still read all 12 seeded products');
reset role;

-- A different authenticated identity cannot see the owner's cart.
insert into public.carts(customer_id, status)
select user_id, 'active'
from public.user_roles
where role='owner'
limit 1;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;
select extensions.ok(
  (select count(*) = 0 from public.carts),
  'non-owner authenticated user cannot see another customer cart'
);

reset role;

select * from extensions.finish();
rollback;
