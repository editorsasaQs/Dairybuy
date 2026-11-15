-- Regression tests for least-privilege access to financial/subscription tables.
-- Run with: supabase test db
BEGIN;

SELECT extensions.plan(37);

-- Anonymous clients must not have any access to sensitive tables.
SELECT extensions.ok(NOT has_table_privilege('anon','public.payments','SELECT'), 'anon cannot read payments');
SELECT extensions.ok(NOT has_table_privilege('anon','public.refunds','SELECT'), 'anon cannot read refunds');
SELECT extensions.ok(NOT has_table_privilege('anon','public.payment_webhook_events','SELECT'), 'anon cannot read webhook events');
SELECT extensions.ok(NOT has_table_privilege('anon','public.subscriptions','SELECT'), 'anon cannot read subscriptions');
SELECT extensions.ok(NOT has_table_privilege('anon','public.subscription_items','SELECT'), 'anon cannot read subscription items');
SELECT extensions.ok(NOT has_table_privilege('anon','public.subscription_deliveries','SELECT'), 'anon cannot read subscription deliveries');
SELECT extensions.ok(NOT has_table_privilege('anon','public.subscription_skip_records','SELECT'), 'anon cannot read subscription skips');
SELECT extensions.ok(NOT has_table_privilege('anon','public.subscription_vendor_changes','SELECT'), 'anon cannot read subscription vendor changes');
SELECT extensions.ok(NOT has_table_privilege('anon','public.payments','INSERT'), 'anon cannot create payments');
SELECT extensions.ok(NOT has_table_privilege('anon','public.payment_webhook_events','INSERT'), 'anon cannot insert webhook events');

-- Authenticated customers retain SELECT only; writes stay server-side.
SELECT extensions.ok(has_table_privilege('authenticated','public.payments','SELECT'), 'authenticated retains RLS-filtered payment reads');
SELECT extensions.ok(has_table_privilege('authenticated','public.refunds','SELECT'), 'authenticated retains RLS-filtered refund reads');
SELECT extensions.ok(has_table_privilege('authenticated','public.subscriptions','SELECT'), 'authenticated retains RLS-filtered subscription reads');
SELECT extensions.ok(has_table_privilege('authenticated','public.subscription_items','SELECT'), 'authenticated retains RLS-filtered subscription item reads');
SELECT extensions.ok(has_table_privilege('authenticated','public.subscription_deliveries','SELECT'), 'authenticated retains RLS-filtered delivery reads');
SELECT extensions.ok(has_table_privilege('authenticated','public.subscription_skip_records','SELECT'), 'authenticated retains RLS-filtered skip reads');
SELECT extensions.ok(has_table_privilege('authenticated','public.subscription_vendor_changes','SELECT'), 'authenticated retains RLS-filtered vendor-change reads');

SELECT extensions.ok(NOT has_table_privilege('authenticated','public.payments','INSERT'), 'customers cannot create payment rows directly');
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.payments','UPDATE'), 'customers cannot mutate payment rows directly');
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.payments','DELETE'), 'customers cannot delete payment rows directly');
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.refunds','INSERT'), 'customers cannot create refund rows directly');
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.refunds','UPDATE'), 'customers cannot mutate refund rows directly');
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.refunds','DELETE'), 'customers cannot delete refund rows directly');
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.subscriptions','INSERT'), 'customers cannot create subscriptions directly');
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.subscriptions','UPDATE'), 'customers cannot mutate subscription state directly');
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.subscriptions','DELETE'), 'customers cannot delete subscriptions directly');
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.subscription_items','INSERT'), 'customers cannot create subscription items directly');
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.subscription_deliveries','UPDATE'), 'customers cannot mutate delivery records directly');
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.subscription_skip_records','INSERT'), 'customers cannot write skip records directly');
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.subscription_vendor_changes','INSERT'), 'customers cannot write vendor changes directly');

SELECT extensions.ok(NOT has_table_privilege('authenticated','public.payment_webhook_events','SELECT'), 'webhook payloads are not client-readable');
SELECT extensions.ok(NOT has_table_privilege('authenticated','public.payment_webhook_events','INSERT'), 'clients cannot insert webhook events');

-- The trusted server role retains the access required for payment/webhook workflows.
SELECT extensions.ok(has_table_privilege('service_role','public.payments','SELECT'), 'service role can read payments');
SELECT extensions.ok(has_table_privilege('service_role','public.payments','INSERT'), 'service role can create payments');
SELECT extensions.ok(has_table_privilege('service_role','public.refunds','INSERT'), 'service role can create refunds');
SELECT extensions.ok(has_table_privilege('service_role','public.payment_webhook_events','SELECT'), 'service role can read webhook events');
SELECT extensions.ok(has_table_privilege('service_role','public.payment_webhook_events','INSERT'), 'service role can record webhook events');

SELECT * FROM extensions.finish();
ROLLBACK;
