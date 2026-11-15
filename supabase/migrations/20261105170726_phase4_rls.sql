BEGIN;

-- Enable RLS on every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_area_pincodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_skip_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_vendor_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cod_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security-definer helpers
CREATE OR REPLACE FUNCTION public.get_auth_uid()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.get_user_roles(lookup_user_id UUID)
RETURNS SETOF user_role_enum AS $$
BEGIN
  RETURN QUERY SELECT role FROM public.user_roles WHERE user_id = lookup_user_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN AS $$
DECLARE curr_uid UUID := auth.uid();
BEGIN
  IF curr_uid IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = curr_uid AND role IN ('owner','admin'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
DECLARE curr_uid UUID := auth.uid();
BEGIN
  IF curr_uid IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = curr_uid AND role IN ('owner','admin','manager','operations_staff'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.has_staff_permission(check_permission staff_permission_enum)
RETURNS BOOLEAN AS $$
DECLARE curr_uid UUID := auth.uid();
BEGIN
  IF curr_uid IS NULL THEN RETURN FALSE; END IF;
  IF public.is_admin_or_owner() THEN RETURN TRUE; END IF;
  RETURN EXISTS (SELECT 1 FROM public.staff_permissions WHERE user_id = curr_uid AND permission = check_permission);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Identity
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_staff());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY user_roles_select_own ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.is_admin_or_owner());
CREATE POLICY user_roles_modify_admin_only ON public.user_roles FOR ALL USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());

CREATE POLICY staff_permissions_select ON public.staff_permissions FOR SELECT USING (auth.uid() = user_id OR public.is_admin_or_owner());
CREATE POLICY staff_permissions_modify_admin_only ON public.staff_permissions FOR ALL USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());

CREATE POLICY addresses_select ON public.customer_addresses FOR SELECT USING (auth.uid() = customer_id OR public.is_staff());
CREATE POLICY addresses_insert_own ON public.customer_addresses FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY addresses_update_own ON public.customer_addresses FOR UPDATE USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);
CREATE POLICY addresses_delete_own ON public.customer_addresses FOR DELETE USING (auth.uid() = customer_id);

-- Serviceability
CREATE POLICY service_areas_read_all ON public.service_areas FOR SELECT USING (is_active = TRUE OR public.is_staff());
CREATE POLICY service_areas_modify_admin_only ON public.service_areas FOR ALL USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());
CREATE POLICY service_pincodes_read_all ON public.service_area_pincodes FOR SELECT USING (is_active = TRUE OR public.is_staff());
CREATE POLICY service_pincodes_modify_admin_only ON public.service_area_pincodes FOR ALL USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());
CREATE POLICY delivery_slots_read_all ON public.delivery_slots FOR SELECT USING (is_active = TRUE OR public.is_staff());
CREATE POLICY delivery_slots_modify_admin_only ON public.delivery_slots FOR ALL USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());
CREATE POLICY app_settings_read_all ON public.app_settings FOR SELECT USING (TRUE);
CREATE POLICY app_settings_modify_admin_only ON public.app_settings FOR ALL USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());

-- Catalogue
CREATE POLICY categories_read_public ON public.categories FOR SELECT USING (is_active = TRUE OR public.is_staff());
CREATE POLICY categories_modify_staff ON public.categories FOR ALL USING (public.has_staff_permission('manage_catalogue')) WITH CHECK (public.has_staff_permission('manage_catalogue'));
CREATE POLICY products_read_public ON public.products FOR SELECT USING (is_active = TRUE OR public.is_staff());
CREATE POLICY products_modify_staff ON public.products FOR ALL USING (public.has_staff_permission('manage_catalogue')) WITH CHECK (public.has_staff_permission('manage_catalogue'));
CREATE POLICY variants_read_public ON public.product_variants FOR SELECT USING (is_orderable = TRUE OR public.is_staff());
CREATE POLICY variants_modify_staff ON public.product_variants FOR ALL USING (public.has_staff_permission('manage_catalogue')) WITH CHECK (public.has_staff_permission('manage_catalogue'));
CREATE POLICY product_images_read_public ON public.product_images FOR SELECT USING (TRUE);
CREATE POLICY product_images_modify_staff ON public.product_images FOR ALL USING (public.has_staff_permission('manage_catalogue')) WITH CHECK (public.has_staff_permission('manage_catalogue'));

-- Vendors and pricing
CREATE POLICY vendors_read_public ON public.vendors FOR SELECT USING (is_approved = TRUE OR public.is_staff());
CREATE POLICY vendors_modify_staff ON public.vendors FOR ALL USING (public.has_staff_permission('manage_vendors')) WITH CHECK (public.has_staff_permission('manage_vendors'));
CREATE POLICY vendor_products_read_public ON public.vendor_products FOR SELECT USING (is_active = TRUE OR public.is_staff());
CREATE POLICY vendor_products_modify_staff ON public.vendor_products FOR ALL USING (public.has_staff_permission('manage_vendors')) WITH CHECK (public.has_staff_permission('manage_vendors'));
CREATE POLICY vendor_prices_read_public ON public.vendor_prices FOR SELECT USING (is_current = TRUE OR public.is_staff());
CREATE POLICY vendor_prices_modify_staff ON public.vendor_prices FOR ALL USING (public.has_staff_permission('manage_pricing')) WITH CHECK (public.has_staff_permission('manage_pricing'));

-- Inventory
CREATE POLICY inventory_read_staff ON public.inventory FOR SELECT USING (public.is_staff());
CREATE POLICY inventory_modify_staff ON public.inventory FOR ALL USING (public.has_staff_permission('manage_inventory')) WITH CHECK (public.has_staff_permission('manage_inventory'));
CREATE POLICY inventory_movements_read_staff ON public.inventory_movements FOR SELECT USING (public.is_staff());
CREATE POLICY inventory_movements_insert_staff ON public.inventory_movements FOR INSERT WITH CHECK (public.has_staff_permission('manage_inventory'));

-- Commerce
CREATE POLICY carts_owner_access ON public.carts FOR ALL USING (auth.uid() = customer_id OR public.is_staff()) WITH CHECK (auth.uid() = customer_id OR public.is_staff());
CREATE POLICY cart_items_owner_access ON public.cart_items FOR ALL
USING (EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_items.cart_id AND (carts.customer_id = auth.uid() OR public.is_staff())))
WITH CHECK (EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_items.cart_id AND (carts.customer_id = auth.uid() OR public.is_staff())));

CREATE POLICY orders_select ON public.orders FOR SELECT USING (auth.uid() = customer_id OR public.is_staff());
CREATE POLICY orders_insert_own ON public.orders FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY orders_update_staff_or_owner ON public.orders FOR UPDATE USING (public.is_staff() OR (auth.uid() = customer_id AND status = 'draft')) WITH CHECK (public.is_staff() OR (auth.uid() = customer_id AND status = 'draft'));

CREATE POLICY order_items_select ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND (orders.customer_id = auth.uid() OR public.is_staff())));
CREATE POLICY order_items_insert_own ON public.order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.customer_id = auth.uid()));
CREATE POLICY order_history_select ON public.order_status_history FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_status_history.order_id AND (orders.customer_id = auth.uid() OR public.is_staff())));
CREATE POLICY order_history_insert_staff ON public.order_status_history FOR INSERT WITH CHECK (public.is_staff());

CREATE POLICY subscriptions_select ON public.subscriptions FOR SELECT USING (auth.uid() = customer_id OR public.is_staff());
CREATE POLICY subscriptions_insert_own ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY subscriptions_update_own ON public.subscriptions FOR UPDATE USING (auth.uid() = customer_id OR public.is_staff()) WITH CHECK (auth.uid() = customer_id OR public.is_staff());
CREATE POLICY subscription_items_select ON public.subscription_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.subscriptions WHERE subscriptions.id = subscription_items.subscription_id AND (subscriptions.customer_id = auth.uid() OR public.is_staff())));
CREATE POLICY sub_deliveries_select ON public.subscription_deliveries FOR SELECT USING (EXISTS (SELECT 1 FROM public.subscriptions WHERE subscriptions.id = subscription_deliveries.subscription_id AND (subscriptions.customer_id = auth.uid() OR public.is_staff())));
CREATE POLICY sub_deliveries_update_staff ON public.subscription_deliveries FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY sub_skips_manage ON public.subscription_skip_records FOR ALL USING (EXISTS (SELECT 1 FROM public.subscriptions WHERE subscriptions.id = subscription_skip_records.subscription_id AND (subscriptions.customer_id = auth.uid() OR public.is_staff())));
CREATE POLICY sub_vendor_changes_manage ON public.subscription_vendor_changes FOR ALL USING (EXISTS (SELECT 1 FROM public.subscriptions WHERE subscriptions.id = subscription_vendor_changes.subscription_id AND (subscriptions.customer_id = auth.uid() OR public.is_staff())));

-- Payments and refunds: customers can only see their own records
CREATE POLICY payments_select ON public.payments FOR SELECT USING (
 public.is_admin_or_owner() OR public.has_staff_permission('view_reports')
 OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payments.order_id AND o.customer_id = auth.uid())
 OR EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = payments.subscription_id AND s.customer_id = auth.uid())
);
CREATE POLICY refunds_select_own ON public.refunds FOR SELECT USING (
 public.is_admin_or_owner() OR public.has_staff_permission('view_reports')
 OR EXISTS (SELECT 1 FROM public.payments p LEFT JOIN public.orders o ON o.id=p.order_id LEFT JOIN public.subscriptions sub ON sub.id=p.subscription_id WHERE p.id=refunds.payment_id AND (o.customer_id=auth.uid() OR sub.customer_id=auth.uid()))
);

-- Operations
CREATE POLICY cod_collections_staff ON public.cod_collections FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY delivery_assignments_staff ON public.delivery_assignments FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- payment_webhook_events intentionally has no user-facing policy; service role only
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY audit_logs_admin_read ON public.audit_logs FOR SELECT USING (public.is_admin_or_owner());
CREATE POLICY audit_logs_insert_all ON public.audit_logs FOR INSERT WITH CHECK (TRUE);

COMMIT;