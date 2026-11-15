-- Dairybuy Phase 4.A: cross-customer cart mutation isolation.
-- Synthetic users and fixtures are rolled back at the end.

BEGIN;
SELECT extensions.plan(6);
INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES
('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','phase4a-a@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
('b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','phase4a-b@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);
INSERT INTO public.carts(id,customer_id,status) VALUES
('a1a1a1a1-0000-4000-8000-000000000001','a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active'),
('b2b2b2b2-0000-4000-8000-000000000001','b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb','active');
INSERT INTO public.cart_items(id,cart_id,product_variant_id,quantity,unit_price_paise) VALUES
('a1a1a1a1-0000-4000-8000-000000000002','a1a1a1a1-0000-4000-8000-000000000001','ghee-red-cow-200ml',1,17900),
('b2b2b2b2-0000-4000-8000-000000000002','b2b2b2b2-0000-4000-8000-000000000001','ghee-red-cow-200ml',1,17900);

SELECT extensions.ok(
  NOT has_table_privilege('anon','public.carts','SELECT')
  AND NOT has_table_privilege('anon','public.carts','INSERT')
  AND NOT has_table_privilege('anon','public.cart_items','SELECT')
  AND NOT has_table_privilege('anon','public.cart_items','INSERT'),
  'anonymous role has no cart read or write privileges'
);

SELECT set_config('request.jwt.claim.sub','a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
SELECT set_config('request.jwt.claims','{"sub":"a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.is((SELECT count(*)::int FROM public.carts),1,'customer A sees only their own cart');
UPDATE public.cart_items SET quantity=2 WHERE id='a1a1a1a1-0000-4000-8000-000000000002';
SELECT extensions.is((SELECT quantity::int FROM public.cart_items WHERE id='a1a1a1a1-0000-4000-8000-000000000002'),2,'customer A can update their own cart item');
UPDATE public.cart_items SET quantity=9 WHERE id='b2b2b2b2-0000-4000-8000-000000000002';
DELETE FROM public.cart_items WHERE id='b2b2b2b2-0000-4000-8000-000000000002';
RESET ROLE;
SELECT extensions.ok(
  EXISTS(SELECT 1 FROM public.cart_items WHERE id='b2b2b2b2-0000-4000-8000-000000000002' AND quantity=1),
  'customer A cannot update or delete customer B cart item'
);
SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claim.sub','b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
SELECT set_config('request.jwt.claims','{"sub":"b2b2b2b2-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}',true);
SELECT extensions.is((SELECT count(*)::int FROM public.carts),1,'customer B sees only their own cart');
UPDATE public.cart_items SET quantity=9 WHERE id='a1a1a1a1-0000-4000-8000-000000000002';
DELETE FROM public.cart_items WHERE id='a1a1a1a1-0000-4000-8000-000000000002';
RESET ROLE;
SELECT extensions.ok(
  EXISTS(SELECT 1 FROM public.cart_items WHERE id='a1a1a1a1-0000-4000-8000-000000000002' AND quantity=2),
  'customer B cannot update or delete customer A cart item'
);

RESET ROLE;
SELECT * FROM extensions.finish(true);
ROLLBACK;
