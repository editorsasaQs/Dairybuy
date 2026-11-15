-- Dairybuy: optimize all 21 auth_rls_initplan findings without changing ownership rules.
-- Also scope financial/subscription customer-read policies to authenticated users.
-- No grants are changed here; existing least-privilege grants remain authoritative.
BEGIN;

-- Profiles
ALTER POLICY profiles_insert_self ON public.profiles
  WITH CHECK ((SELECT auth.uid()) = id);
ALTER POLICY profiles_select_own ON public.profiles
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_staff()));
ALTER POLICY profiles_update_own ON public.profiles
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Notifications
ALTER POLICY notifications_select_own ON public.notifications
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY notifications_update_own ON public.notifications
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Orders and child records
ALTER POLICY orders_select ON public.orders
  USING ((SELECT auth.uid()) = customer_id OR (SELECT public.is_staff()));
ALTER POLICY order_items_select ON public.order_items
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders
      WHERE orders.id = order_items.order_id
        AND (orders.customer_id = (SELECT auth.uid()) OR (SELECT public.is_staff()))
    )
  );
ALTER POLICY order_history_select ON public.order_status_history
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders
      WHERE orders.id = order_status_history.order_id
        AND (orders.customer_id = (SELECT auth.uid()) OR (SELECT public.is_staff()))
    )
  );

-- Subscriptions and child records
ALTER POLICY subscriptions_select ON public.subscriptions TO authenticated
  USING ((SELECT auth.uid()) = customer_id OR (SELECT public.is_staff()));
ALTER POLICY subscription_items_select ON public.subscription_items TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subscriptions
      WHERE subscriptions.id = subscription_items.subscription_id
        AND (subscriptions.customer_id = (SELECT auth.uid()) OR (SELECT public.is_staff()))
    )
  );
ALTER POLICY sub_deliveries_select ON public.subscription_deliveries TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subscriptions
      WHERE subscriptions.id = subscription_deliveries.subscription_id
        AND (subscriptions.customer_id = (SELECT auth.uid()) OR (SELECT public.is_staff()))
    )
  );
ALTER POLICY sub_skips_select ON public.subscription_skip_records TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subscriptions AS s
      WHERE s.id = subscription_skip_records.subscription_id
        AND (s.customer_id = (SELECT auth.uid()) OR (SELECT public.is_staff()))
    )
  );
ALTER POLICY sub_vendor_changes_select ON public.subscription_vendor_changes TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subscriptions AS s
      WHERE s.id = subscription_vendor_changes.subscription_id
        AND (s.customer_id = (SELECT auth.uid()) OR (SELECT public.is_staff()))
    )
  );

-- Financial reads: authenticated-only policy targets; existing grants still deny anon.
ALTER POLICY payments_select ON public.payments TO authenticated
  USING (
    (SELECT public.is_admin_or_owner())
    OR (SELECT public.has_staff_permission('view_reports'::public.staff_permission_enum))
    OR EXISTS (
      SELECT 1 FROM public.orders AS o
      WHERE o.id = payments.order_id
        AND o.customer_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.subscriptions AS sub
      WHERE sub.id = payments.subscription_id
        AND sub.customer_id = (SELECT auth.uid())
    )
  );
ALTER POLICY refunds_select_own ON public.refunds TO authenticated
  USING (
    (SELECT public.is_admin_or_owner())
    OR (SELECT public.has_staff_permission('view_reports'::public.staff_permission_enum))
    OR EXISTS (
      SELECT 1
      FROM public.payments AS p
      LEFT JOIN public.orders AS o ON o.id = p.order_id
      LEFT JOIN public.subscriptions AS sub ON sub.id = p.subscription_id
      WHERE p.id = refunds.payment_id
        AND (o.customer_id = (SELECT auth.uid()) OR sub.customer_id = (SELECT auth.uid()))
    )
  );

-- User and staff authorization reads
ALTER POLICY user_roles_select_own ON public.user_roles
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin_or_owner()));
ALTER POLICY staff_permissions_select ON public.staff_permissions
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin_or_owner()));

-- Customer addresses
ALTER POLICY addresses_select ON public.customer_addresses
  USING ((SELECT auth.uid()) = customer_id OR (SELECT public.is_staff()));
ALTER POLICY addresses_insert_own ON public.customer_addresses
  WITH CHECK ((SELECT auth.uid()) = customer_id);
ALTER POLICY addresses_update_own ON public.customer_addresses
  USING ((SELECT auth.uid()) = customer_id)
  WITH CHECK ((SELECT auth.uid()) = customer_id);
ALTER POLICY addresses_delete_own ON public.customer_addresses
  USING ((SELECT auth.uid()) = customer_id);

COMMIT;