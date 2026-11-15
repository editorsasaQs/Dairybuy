-- Dairybuy: enforce authenticated-only access on private customer/operations tables.
-- Public catalogue/serviceability policies remain public. Financial/subscription grants
-- remain governed by the dedicated sensitive-table migration.
BEGIN;

ALTER POLICY profiles_select_own ON public.profiles TO authenticated;
ALTER POLICY profiles_update_own ON public.profiles TO authenticated;
ALTER POLICY profiles_insert_self ON public.profiles TO authenticated;

ALTER POLICY user_roles_select_own ON public.user_roles TO authenticated;
DROP POLICY IF EXISTS user_roles_modify_admin_limited ON public.user_roles;
DROP POLICY IF EXISTS user_roles_modify_owner ON public.user_roles;
CREATE POLICY user_roles_manage_admin_owner
  ON public.user_roles FOR ALL TO authenticated
  USING (
    public.is_owner()
    OR (
      public.is_admin_or_owner()
      AND role IN ('manager'::public.user_role_enum, 'operations_staff'::public.user_role_enum, 'customer'::public.user_role_enum)
      AND user_id <> (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.is_owner()
    OR (
      public.is_admin_or_owner()
      AND role IN ('manager'::public.user_role_enum, 'operations_staff'::public.user_role_enum, 'customer'::public.user_role_enum)
      AND user_id <> (SELECT auth.uid())
    )
  );

ALTER POLICY staff_permissions_select ON public.staff_permissions TO authenticated;
ALTER POLICY staff_permissions_modify_admin_only ON public.staff_permissions TO authenticated;
ALTER POLICY addresses_select ON public.customer_addresses TO authenticated;
ALTER POLICY addresses_insert_own ON public.customer_addresses TO authenticated;
ALTER POLICY addresses_update_own ON public.customer_addresses TO authenticated;
ALTER POLICY addresses_delete_own ON public.customer_addresses TO authenticated;

ALTER POLICY inventory_read_staff ON public.inventory TO authenticated;
ALTER POLICY inventory_modify_staff ON public.inventory TO authenticated;
ALTER POLICY inventory_movements_read_staff ON public.inventory_movements TO authenticated;
ALTER POLICY inventory_movements_insert_staff ON public.inventory_movements TO authenticated;

ALTER POLICY orders_select ON public.orders TO authenticated;
ALTER POLICY orders_update_staff ON public.orders TO authenticated;
ALTER POLICY order_items_select ON public.order_items TO authenticated;
ALTER POLICY order_history_select ON public.order_status_history TO authenticated;
ALTER POLICY order_history_insert_staff ON public.order_status_history TO authenticated;

ALTER POLICY notifications_select_own ON public.notifications TO authenticated;
ALTER POLICY notifications_update_own ON public.notifications TO authenticated;
ALTER POLICY cod_collections_staff ON public.cod_collections TO authenticated;
ALTER POLICY delivery_assignments_staff ON public.delivery_assignments TO authenticated;
ALTER POLICY audit_logs_admin_read ON public.audit_logs TO authenticated;

DROP POLICY IF EXISTS audit_logs_insert_all ON public.audit_logs;

REVOKE ALL PRIVILEGES ON TABLE
  public.profiles, public.user_roles, public.staff_permissions,
  public.customer_addresses, public.inventory, public.inventory_movements,
  public.orders, public.order_items, public.order_status_history,
  public.notifications, public.cod_collections, public.delivery_assignments,
  public.audit_logs
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory TO authenticated;
GRANT SELECT, INSERT ON TABLE public.inventory_movements TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.order_items TO authenticated;
GRANT SELECT, INSERT ON TABLE public.order_status_history TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;
GRANT SELECT, INSERT ON TABLE public.cod_collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_assignments TO authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.audit_logs TO service_role;

COMMIT;
