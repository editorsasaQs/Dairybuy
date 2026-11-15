-- RLS regression tests for private customer/operations data.
-- Run with: supabase test db
-- All fixtures are rolled back.
BEGIN;

SELECT extensions.plan(32);

SELECT extensions.ok(NOT has_table_privilege('anon','public.profiles','SELECT'), 'anon cannot read profiles');
SELECT extensions.ok(NOT has_table_privilege('anon','public.user_roles','SELECT'), 'anon cannot read user roles');
SELECT extensions.ok(NOT has_table_privilege('anon','public.staff_permissions','SELECT'), 'anon cannot read staff permissions');
SELECT extensions.ok(NOT has_table_privilege('anon','public.customer_addresses','SELECT'), 'anon cannot read customer addresses');
SELECT extensions.ok(NOT has_table_privilege('anon','public.orders','SELECT'), 'anon cannot read orders');
SELECT extensions.ok(NOT has_table_privilege('anon','public.order_items','SELECT'), 'anon cannot read order items');
SELECT extensions.ok(NOT has_table_privilege('anon','public.order_status_history','SELECT'), 'anon cannot read order history');
SELECT extensions.ok(NOT has_table_privilege('anon','public.notifications','SELECT'), 'anon cannot read notifications');
SELECT extensions.ok(NOT has_table_privilege('anon','public.inventory','SELECT'), 'anon cannot read inventory');
SELECT extensions.ok(NOT has_table_privilege('anon','public.cod_collections','SELECT'), 'anon cannot read COD collections');
SELECT extensions.ok(NOT has_table_privilege('anon','public.delivery_assignments','SELECT'), 'anon cannot read delivery assignments');
SELECT extensions.ok(NOT has_table_privilege('anon','public.audit_logs','SELECT'), 'anon cannot read audit logs');

SELECT extensions.ok(has_table_privilege('anon','public.products','SELECT'), 'anon retains public product access');
SELECT extensions.ok(has_table_privilege('anon','public.categories','SELECT'), 'anon retains public category access');
SELECT extensions.ok(has_table_privilege('anon','public.service_areas','SELECT'), 'anon retains public service-area access');
SELECT extensions.ok(has_table_privilege('anon','public.service_area_pincodes','SELECT'), 'anon retains public pincode access');

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('profiles','user_roles','staff_permissions','customer_addresses',
        'inventory','inventory_movements','orders','order_items','order_status_history',
        'notifications','cod_collections','delivery_assignments','audit_logs')
      AND 'public' = ANY(roles::text[])
  ),
  'private customer/operations policies do not target PUBLIC'
);
SELECT extensions.ok(
  (SELECT roles = ARRAY['authenticated']::name[] FROM pg_policies
   WHERE schemaname='public' AND tablename='customer_addresses' AND policyname='addresses_select'),
  'address ownership policy is authenticated-only'
);
SELECT extensions.ok(
  (SELECT roles = ARRAY['authenticated']::name[] FROM pg_policies
   WHERE schemaname='public' AND tablename='orders' AND policyname='orders_select'),
  'order ownership policy is authenticated-only'
);
SELECT extensions.ok(
  (SELECT count(*) = 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='user_roles' AND cmd='ALL'),
  'user_roles has one combined admin/owner write policy'
);
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.audit_logs','INSERT'), 'authenticated clients cannot write audit logs');
SELECT extensions.ok(has_table_privilege('service_role','public.audit_logs','INSERT'), 'trusted service role can write audit logs');

SELECT set_config('dairybuy.test_user_a',
  (SELECT user_id::text FROM public.user_roles
   WHERE role='customer'
     AND user_id IN (SELECT id FROM public.profiles)
     AND user_id <> (SELECT user_id FROM public.user_roles WHERE role='owner' LIMIT 1)
   ORDER BY user_id LIMIT 1), true);
SELECT set_config('dairybuy.test_user_b',
  (SELECT user_id::text FROM public.user_roles
   WHERE role='customer'
     AND user_id IN (SELECT id FROM public.profiles)
     AND user_id <> (SELECT user_id FROM public.user_roles WHERE role='owner' LIMIT 1)
     AND user_id::text <> current_setting('dairybuy.test_user_a')
   ORDER BY user_id LIMIT 1), true);

INSERT INTO public.customer_addresses(customer_id, recipient_name, phone, address_line1, pincode)
VALUES
 (current_setting('dairybuy.test_user_a')::uuid, 'RLS Test A', '9000000001', 'rls-fixture-a', '700039'),
 (current_setting('dairybuy.test_user_b')::uuid, 'RLS Test B', '9000000002', 'rls-fixture-b', '700046');

SELECT set_config('request.jwt.claim.sub', current_setting('dairybuy.test_user_a'), true);
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('dairybuy.test_user_a'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

SELECT extensions.ok((SELECT count(*) = 1 FROM public.profiles), 'customer A sees only own profile');
SELECT extensions.ok((SELECT count(*) = 1 FROM public.user_roles), 'customer A sees only own role');
SELECT extensions.ok((SELECT count(*) = 1 FROM public.customer_addresses), 'customer A sees only own address');
SELECT extensions.ok((SELECT count(*) = 1 FROM public.customer_addresses WHERE address_line1='rls-fixture-a'), 'customer A sees own fixture address');
SELECT extensions.ok((SELECT count(*) = 0 FROM public.customer_addresses WHERE address_line1='rls-fixture-b'), 'customer A cannot see customer B address');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', current_setting('dairybuy.test_user_b'), true);
SELECT set_config('request.jwt.claims',
  json_build_object('sub', current_setting('dairybuy.test_user_b'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

SELECT extensions.ok((SELECT count(*) = 1 FROM public.profiles), 'customer B sees only own profile');
SELECT extensions.ok((SELECT count(*) = 1 FROM public.user_roles), 'customer B sees only own role');
SELECT extensions.ok((SELECT count(*) = 1 FROM public.customer_addresses), 'customer B sees only own address');
SELECT extensions.ok((SELECT count(*) = 0 FROM public.customer_addresses WHERE address_line1='rls-fixture-a'), 'customer B cannot see customer A address');
SELECT extensions.ok((SELECT count(*) = 1 FROM public.customer_addresses WHERE address_line1='rls-fixture-b'), 'customer B sees own fixture address');

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
