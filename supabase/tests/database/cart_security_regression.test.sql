-- Dairybuy Phase 4.3/4.4 cart and security regression tests.
-- Run with: supabase test db
-- Synthetic users and cart fixtures are rolled back at the end.

BEGIN;
SELECT extensions.plan(14);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','cart-rls-a@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','cart-rls-b@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','authenticated','authenticated','cart-rls-admin@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);

INSERT INTO public.user_roles (user_id, role)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','admin');

INSERT INTO public.carts (id, customer_id, status)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active'),
  ('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','active');

INSERT INTO public.cart_items (id, cart_id, product_variant_id, vendor_id, milk_type, quantity_litres, quantity, unit_price_paise)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','milk-cow-500ml','healthy-haryana','cow',0.5,1,5000),
  ('bbbbbbbb-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000001','milk-cow-500ml','healthy-haryana','cow',0.5,1,5000);

-- Anonymous users must not persist or inspect carts.
SELECT extensions.ok(
  NOT has_table_privilege('anon','public.carts','SELECT')
  AND NOT has_table_privilege('anon','public.carts','INSERT'),
  'anonymous role cannot read or create database carts'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated','public.carts','TRUNCATE')
  AND NOT has_table_privilege('authenticated','public.cart_items','TRUNCATE'),
  'authenticated role cannot truncate cart tables'
);
SELECT extensions.ok(
  NOT has_column_privilege('anon','public.product_variants','purchase_price_paise','SELECT')
  AND has_column_privilege('anon','public.product_variants','final_price_paise','SELECT'),
  'public catalogue exposes selling price but not purchase cost'
);
SELECT extensions.ok(
  (SELECT reloptions @> ARRAY['security_invoker=true']
   FROM pg_class WHERE oid='public.public_catalogue'::regclass),
  'public catalogue view uses security_invoker'
);
SELECT extensions.ok(
  NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.is_staff()'::regprocedure),
  'public is_staff compatibility wrapper is SECURITY INVOKER'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE'),
  'API roles cannot execute the RLS event-trigger helper'
);

-- Customer A can see only A's cart and cart item.
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.is((SELECT count(*)::int FROM public.carts),1,'customer A sees only their own cart');
SELECT extensions.is((SELECT count(*)::int FROM public.cart_items),1,'customer A sees only their own cart item');

-- Customer B can see only B's cart and cart item.
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
SELECT set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}',true);
SELECT extensions.is((SELECT count(*)::int FROM public.carts),1,'customer B sees only their own cart');
SELECT extensions.is((SELECT count(*)::int FROM public.cart_items),1,'customer B sees only their own cart item');
SELECT extensions.ok(NOT public.is_staff(),'customer B is not treated as staff');

-- admin role can see both customers' carts and items for operations.
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
SELECT set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}',true);
SELECT extensions.is((SELECT count(*)::int FROM public.carts WHERE customer_id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')),2,'admin can see both test customer carts');
SELECT extensions.is((SELECT count(*)::int FROM public.cart_items ci JOIN public.carts c ON c.id = ci.cart_id WHERE c.customer_id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')),2,'admin can see both test customer cart items');
SELECT extensions.ok(public.is_staff(),'admin is recognized as staff');

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
