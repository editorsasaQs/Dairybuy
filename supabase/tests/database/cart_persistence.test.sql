-- Dairybuy Phase 4.2 authenticated cart persistence regression tests.
-- Run after applying 20261106113620_phase4_2_authenticated_cart_persistence.sql.
-- All fixtures are rolled back.

BEGIN;
SELECT extensions.plan(23);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','authenticated','authenticated','cart-persist-a@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','authenticated','authenticated','cart-persist-b@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff','authenticated','authenticated','cart-persist-admin@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);

INSERT INTO public.user_roles (user_id, role)
VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff','admin');

SELECT extensions.ok(
  NOT has_function_privilege('anon','public.sync_active_cart(jsonb)','EXECUTE'),
  'anonymous role cannot execute the cart persistence RPC'
);

SELECT set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
SELECT set_config('request.jwt.claims','{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;

SELECT extensions.ok(
  public.sync_active_cart('[{"product_variant_id":"ghee-red-cow-200ml","vendor_id":null,"milk_type":null,"quantity":1,"unit_price_paise":17900}]'::jsonb) IS NOT NULL,
  'customer A can create an authenticated cart'
);
SELECT set_config('test.phase42_a_cart_id', (
  SELECT id::text FROM public.carts WHERE customer_id = auth.uid() AND status = 'active'
), true);
SELECT extensions.is(
  (SELECT count(*)::int FROM public.carts WHERE status = 'active'),
  1,
  'customer A has exactly one active cart'
);
SELECT extensions.is(
  (SELECT count(*)::int FROM public.cart_items),
  1,
  'customer A cart contains the saved line'
);

SELECT extensions.ok(
  public.sync_active_cart('[{"product_variant_id":"ghee-red-cow-200ml","vendor_id":null,"milk_type":null,"quantity":2,"unit_price_paise":17900}]'::jsonb)
    = current_setting('test.phase42_a_cart_id')::uuid,
  'repeated save reuses the same active cart'
);
SELECT extensions.is(
  (SELECT quantity FROM public.cart_items LIMIT 1),
  2,
  'repeated save replaces quantity instead of duplicating the line'
);

SELECT extensions.throws_ok(
  'SELECT public.sync_active_cart(''[{"product_variant_id":"ghee-red-cow-200ml","vendor_id":null,"milk_type":null,"quantity":1,"unit_price_paise":1}]''::jsonb)',
  '23514',
  NULL,
  'database trigger rejects a forged cart price even through direct RPC'
);

SELECT extensions.throws_ok(
  'INSERT INTO public.cart_items (cart_id, product_variant_id, vendor_id, milk_type, quantity, unit_price_paise) SELECT id, ''ghee-red-cow-200ml'', NULL, NULL, 1, 17900 FROM public.carts WHERE customer_id = auth.uid() AND status = ''active''',
  '23505',
  NULL,
  'unique index rejects duplicate product variant lines for the same cart'
);

SELECT extensions.ok(
  public.sync_active_cart('[{"product_variant_id":"ghee-red-cow-200ml","vendor_id":null,"milk_type":null,"quantity":1,"unit_price_paise":17900},{"product_variant_id":"milk-cow-500ml","vendor_id":"ghosh-dairy","milk_type":"cow","quantity":1,"unit_price_paise":7000,"quantity_litres":0.5},{"product_variant_id":"milk-canteen-500ml","vendor_id":"canteen-milk-centre","milk_type":"canteen","quantity":1,"unit_price_paise":3800,"quantity_litres":0.5}]'::jsonb)
    = current_setting('test.phase42_a_cart_id')::uuid,
  'valid standard milk and fixed canteen milk lines are accepted'
);
SELECT extensions.is(
  (SELECT count(*)::int FROM public.cart_items),
  3,
  'atomic snapshot persists catalogue, standard milk and canteen milk lines'
);

SELECT extensions.throws_ok(
  'SELECT public.sync_active_cart(''[{"product_variant_id":"ghee-red-cow-200ml","vendor_id":null,"milk_type":null,"quantity":1,"unit_price_paise":17900},{"product_variant_id":"milk-cow-500ml","vendor_id":"fresh-punjab","milk_type":"cow","quantity":1,"unit_price_paise":5000,"quantity_litres":0.5}]''::jsonb)',
  '23514',
  NULL,
  'database rejects a milk vendor whose ordering is disabled'
);
SELECT extensions.is(
  (SELECT count(*)::int FROM public.cart_items),
  3,
  'failed replacement rolls back and preserves the previous cart snapshot'
);

SELECT extensions.throws_ok(
  'SELECT public.sync_active_cart(''[{"product_variant_id":"ghee-red-cow-200ml","vendor_id":null,"milk_type":null,"quantity":101,"unit_price_paise":17900}]''::jsonb)',
  '22023',
  NULL,
  'RPC rejects quantities above 100'
);
SELECT extensions.throws_ok(
  'SELECT public.sync_active_cart((SELECT jsonb_agg(jsonb_build_object(''product_variant_id'', ''ghee-red-cow-200ml'', ''vendor_id'', NULL, ''milk_type'', NULL, ''quantity'', 1, ''unit_price_paise'', 17900)) FROM generate_series(1,51)))',
  '22023',
  NULL,
  'RPC rejects snapshots containing more than 50 cart lines'
);

SELECT set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
SELECT set_config('request.jwt.claims','{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}',true);
SELECT extensions.ok(
  public.sync_active_cart('[{"product_variant_id":"ghee-red-cow-200ml","vendor_id":null,"milk_type":null,"quantity":1,"unit_price_paise":17900}]'::jsonb)
    <> current_setting('test.phase42_a_cart_id')::uuid,
  'customer B receives a different cart'
);
SELECT extensions.is(
  (SELECT count(*)::int FROM public.carts WHERE status = 'active'),
  1,
  'customer B sees only their own active cart'
);

SELECT set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
SELECT set_config('request.jwt.claims','{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}',true);
SELECT extensions.is(
  (SELECT count(*)::int FROM public.carts WHERE status = 'active'),
  1,
  'customer A cannot see customer B cart'
);

SELECT set_config('request.jwt.claim.sub','ffffffff-ffff-4fff-8fff-ffffffffffff',true);
SELECT set_config('request.jwt.claims','{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}',true);
SELECT extensions.is(
  (SELECT count(*)::int FROM public.carts WHERE status = 'active' AND customer_id IN ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')),
  2,
  'admin can see both test customer carts for operations'
);

SELECT set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
SELECT set_config('request.jwt.claims','{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}',true);
SELECT extensions.ok(
  public.sync_active_cart('[{"product_variant_id":"milk-cow-1l","vendor_id":"healthy-haryana","milk_type":"cow","quantity":1,"unit_price_paise":12600,"quantity_litres":1.5}]'::jsonb) IS NOT NULL,
  'database accepts 1.5 L with one 1 L delivery component'
);
SELECT extensions.ok(
  public.sync_active_cart('[{"product_variant_id":"milk-cow-1l","vendor_id":"healthy-haryana","milk_type":"cow","quantity":1,"unit_price_paise":78700,"quantity_litres":10}]'::jsonb) IS NOT NULL,
  'database accepts the maximum 10 L selection at the CSV price'
);
SELECT extensions.is(
  (SELECT quantity_litres FROM public.cart_items ci JOIN public.carts c ON c.id = ci.cart_id WHERE c.customer_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' AND c.status = 'active'),
  10::numeric,
  'database persists the maximum 10 L selected volume'
);
SELECT public.sync_active_cart('[]'::jsonb);
SELECT extensions.is(
  (SELECT count(*)::int FROM public.cart_items),
  0,
  'empty snapshot clears the current customer cart lines'
);
SELECT extensions.is(
  (SELECT count(*)::int FROM public.carts WHERE status = 'active'),
  1,
  'clearing a cart preserves the active cart container'
);

RESET ROLE;
SELECT * FROM extensions.finish(true);
ROLLBACK;
