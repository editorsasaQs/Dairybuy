-- Phase 4.4.4 cancellation RPC privilege and policy regression tests.
BEGIN;
SELECT extensions.plan(8);

SELECT extensions.ok(
  to_regprocedure('public.cancel_customer_cod_order(uuid)') IS NOT NULL,
  'public cancellation RPC exists'
);
SELECT extensions.ok(
  to_regprocedure('private.cancel_customer_cod_order(uuid)') IS NOT NULL,
  'private cancellation implementation exists'
);
SELECT extensions.ok(
  has_function_privilege('authenticated','public.cancel_customer_cod_order(uuid)','EXECUTE'),
  'authenticated customers can invoke the public cancellation wrapper'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon','public.cancel_customer_cod_order(uuid)','EXECUTE'),
  'anonymous users cannot invoke the cancellation wrapper'
);
SELECT extensions.ok(
  NOT has_function_privilege('authenticated','private.cancel_customer_cod_order(uuid)','EXECUTE'),
  'authenticated users cannot invoke the private implementation'
);
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.order_status_history'::regclass),
  'order status history remains protected by RLS'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='order_status_history'
      AND policyname='order_history_select' AND roles=ARRAY['authenticated']::name[]
  ),
  'order history reads remain authenticated and owner-scoped'
);
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='orders' AND cmd='UPDATE'
  ),
  'direct authenticated order updates remain disabled; status changes use audited RPCs'
);

SELECT * FROM extensions.finish();
ROLLBACK;
