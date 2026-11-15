-- Regression tests for the 21 auth_rls_initplan policy optimizations.
-- Run with: supabase test db
BEGIN;

SELECT extensions.plan(35);

-- Each policy flagged by the advisor must now use a scalar SELECT for auth.uid().
SELECT extensions.ok((SELECT qual IS NOT NULL AND qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_own'), 'profiles_select_own wraps auth.uid');
SELECT extensions.ok((SELECT with_check ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_insert_self'), 'profiles_insert_self wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_select_own'), 'notifications_select_own wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' AND with_check ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_update_own'), 'notifications_update_own wraps auth.uid in USING and CHECK');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders_select'), 'orders_select wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='order_items' AND policyname='order_items_select'), 'order_items_select wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='subscriptions' AND policyname='subscriptions_select'), 'subscriptions_select wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='subscription_items' AND policyname='subscription_items_select'), 'subscription_items_select wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='order_status_history' AND policyname='order_history_select'), 'order_history_select wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='subscription_deliveries' AND policyname='sub_deliveries_select'), 'sub_deliveries_select wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='refunds' AND policyname='refunds_select_own'), 'refunds_select_own wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='subscription_skip_records' AND policyname='sub_skips_select'), 'sub_skips_select wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='subscription_vendor_changes' AND policyname='sub_vendor_changes_select'), 'sub_vendor_changes_select wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='payments_select'), 'payments_select wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_own'), 'profiles_update_own wraps auth.uid in USING');
SELECT extensions.ok((SELECT with_check ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_own'), 'profiles_update_own wraps auth.uid in CHECK');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='user_roles_select_own'), 'user_roles_select_own wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='staff_permissions' AND policyname='staff_permissions_select'), 'staff_permissions_select wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='customer_addresses' AND policyname='addresses_select'), 'addresses_select wraps auth.uid');
SELECT extensions.ok((SELECT with_check ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='customer_addresses' AND policyname='addresses_insert_own'), 'addresses_insert_own wraps auth.uid');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' AND with_check ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='customer_addresses' AND policyname='addresses_update_own'), 'addresses_update_own wraps auth.uid in USING and CHECK');
SELECT extensions.ok((SELECT qual ~* '\(\s*SELECT auth\.uid\(\)' FROM pg_policies WHERE schemaname='public' AND tablename='customer_addresses' AND policyname='addresses_delete_own'), 'addresses_delete_own wraps auth.uid');

-- Financial/subscription customer-data policies are authenticated-only.
SELECT extensions.ok((SELECT roles = ARRAY['authenticated']::name[] FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='payments_select'), 'payments policy targets authenticated');
SELECT extensions.ok((SELECT roles = ARRAY['authenticated']::name[] FROM pg_policies WHERE schemaname='public' AND tablename='refunds' AND policyname='refunds_select_own'), 'refunds policy targets authenticated');
SELECT extensions.ok((SELECT roles = ARRAY['authenticated']::name[] FROM pg_policies WHERE schemaname='public' AND tablename='subscriptions' AND policyname='subscriptions_select'), 'subscriptions policy targets authenticated');
SELECT extensions.ok((SELECT roles = ARRAY['authenticated']::name[] FROM pg_policies WHERE schemaname='public' AND tablename='subscription_items' AND policyname='subscription_items_select'), 'subscription_items policy targets authenticated');
SELECT extensions.ok((SELECT roles = ARRAY['authenticated']::name[] FROM pg_policies WHERE schemaname='public' AND tablename='subscription_deliveries' AND policyname='sub_deliveries_select'), 'subscription_deliveries policy targets authenticated');
SELECT extensions.ok((SELECT roles = ARRAY['authenticated']::name[] FROM pg_policies WHERE schemaname='public' AND tablename='subscription_skip_records' AND policyname='sub_skips_select'), 'subscription_skip_records policy targets authenticated');
SELECT extensions.ok((SELECT roles = ARRAY['authenticated']::name[] FROM pg_policies WHERE schemaname='public' AND tablename='subscription_vendor_changes' AND policyname='sub_vendor_changes_select'), 'subscription_vendor_changes policy targets authenticated');

-- Existing least-privilege grants must remain unchanged.
SELECT extensions.ok(NOT has_table_privilege('anon','public.payments','SELECT'), 'anon still cannot select payments');
SELECT extensions.ok(NOT has_table_privilege('anon','public.refunds','SELECT'), 'anon still cannot select refunds');
SELECT extensions.ok(has_table_privilege('authenticated','public.payments','SELECT'), 'authenticated retains RLS-filtered payment reads');
SELECT extensions.ok(has_table_privilege('authenticated','public.subscriptions','SELECT'), 'authenticated retains RLS-filtered subscription reads');
SELECT extensions.ok(has_table_privilege('service_role','public.payments','INSERT'), 'service role retains payment writes');
SELECT extensions.ok(has_table_privilege('service_role','public.refunds','INSERT'), 'service role retains refund writes');

SELECT * FROM extensions.finish();
ROLLBACK;
