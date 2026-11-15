-- Split overlapping FOR ALL staff policies into write-only policies.
-- Existing SELECT policies remain untouched, preserving the intended read paths.
-- All write policies are explicitly scoped to authenticated users; helper predicates
-- already require an authenticated admin/owner, so anonymous access was never valid.
BEGIN;

DROP POLICY IF EXISTS "app_settings_modify_admin_only" ON public."app_settings";
CREATE POLICY "app_settings_modify_admin_only_insert" ON public."app_settings" FOR INSERT TO authenticated WITH CHECK (is_admin_or_owner());
CREATE POLICY "app_settings_modify_admin_only_update" ON public."app_settings" FOR UPDATE TO authenticated USING (is_admin_or_owner()) WITH CHECK (is_admin_or_owner());
CREATE POLICY "app_settings_modify_admin_only_delete" ON public."app_settings" FOR DELETE TO authenticated USING (is_admin_or_owner());

DROP POLICY IF EXISTS "categories_modify_staff" ON public."categories";
CREATE POLICY "categories_modify_staff_insert" ON public."categories" FOR INSERT TO authenticated WITH CHECK (has_staff_permission('manage_catalogue'::staff_permission_enum));
CREATE POLICY "categories_modify_staff_update" ON public."categories" FOR UPDATE TO authenticated USING (has_staff_permission('manage_catalogue'::staff_permission_enum)) WITH CHECK (has_staff_permission('manage_catalogue'::staff_permission_enum));
CREATE POLICY "categories_modify_staff_delete" ON public."categories" FOR DELETE TO authenticated USING (has_staff_permission('manage_catalogue'::staff_permission_enum));

DROP POLICY IF EXISTS "delivery_slots_modify_admin_only" ON public."delivery_slots";
CREATE POLICY "delivery_slots_modify_admin_only_insert" ON public."delivery_slots" FOR INSERT TO authenticated WITH CHECK (is_admin_or_owner());
CREATE POLICY "delivery_slots_modify_admin_only_update" ON public."delivery_slots" FOR UPDATE TO authenticated USING (is_admin_or_owner()) WITH CHECK (is_admin_or_owner());
CREATE POLICY "delivery_slots_modify_admin_only_delete" ON public."delivery_slots" FOR DELETE TO authenticated USING (is_admin_or_owner());

DROP POLICY IF EXISTS "inventory_modify_staff" ON public."inventory";
CREATE POLICY "inventory_modify_staff_insert" ON public."inventory" FOR INSERT TO authenticated WITH CHECK (has_staff_permission('manage_inventory'::staff_permission_enum));
CREATE POLICY "inventory_modify_staff_update" ON public."inventory" FOR UPDATE TO authenticated USING (has_staff_permission('manage_inventory'::staff_permission_enum)) WITH CHECK (has_staff_permission('manage_inventory'::staff_permission_enum));
CREATE POLICY "inventory_modify_staff_delete" ON public."inventory" FOR DELETE TO authenticated USING (has_staff_permission('manage_inventory'::staff_permission_enum));

DROP POLICY IF EXISTS "product_images_modify_staff" ON public."product_images";
CREATE POLICY "product_images_modify_staff_insert" ON public."product_images" FOR INSERT TO authenticated WITH CHECK (has_staff_permission('manage_catalogue'::staff_permission_enum));
CREATE POLICY "product_images_modify_staff_update" ON public."product_images" FOR UPDATE TO authenticated USING (has_staff_permission('manage_catalogue'::staff_permission_enum)) WITH CHECK (has_staff_permission('manage_catalogue'::staff_permission_enum));
CREATE POLICY "product_images_modify_staff_delete" ON public."product_images" FOR DELETE TO authenticated USING (has_staff_permission('manage_catalogue'::staff_permission_enum));

DROP POLICY IF EXISTS "variants_modify_staff" ON public."product_variants";
CREATE POLICY "variants_modify_staff_insert" ON public."product_variants" FOR INSERT TO authenticated WITH CHECK (has_staff_permission('manage_catalogue'::staff_permission_enum));
CREATE POLICY "variants_modify_staff_update" ON public."product_variants" FOR UPDATE TO authenticated USING (has_staff_permission('manage_catalogue'::staff_permission_enum)) WITH CHECK (has_staff_permission('manage_catalogue'::staff_permission_enum));
CREATE POLICY "variants_modify_staff_delete" ON public."product_variants" FOR DELETE TO authenticated USING (has_staff_permission('manage_catalogue'::staff_permission_enum));

DROP POLICY IF EXISTS "products_modify_staff" ON public."products";
CREATE POLICY "products_modify_staff_insert" ON public."products" FOR INSERT TO authenticated WITH CHECK (has_staff_permission('manage_catalogue'::staff_permission_enum));
CREATE POLICY "products_modify_staff_update" ON public."products" FOR UPDATE TO authenticated USING (has_staff_permission('manage_catalogue'::staff_permission_enum)) WITH CHECK (has_staff_permission('manage_catalogue'::staff_permission_enum));
CREATE POLICY "products_modify_staff_delete" ON public."products" FOR DELETE TO authenticated USING (has_staff_permission('manage_catalogue'::staff_permission_enum));

DROP POLICY IF EXISTS "service_pincodes_modify_admin_only" ON public."service_area_pincodes";
CREATE POLICY "service_pincodes_modify_admin_only_insert" ON public."service_area_pincodes" FOR INSERT TO authenticated WITH CHECK (is_admin_or_owner());
CREATE POLICY "service_pincodes_modify_admin_only_update" ON public."service_area_pincodes" FOR UPDATE TO authenticated USING (is_admin_or_owner()) WITH CHECK (is_admin_or_owner());
CREATE POLICY "service_pincodes_modify_admin_only_delete" ON public."service_area_pincodes" FOR DELETE TO authenticated USING (is_admin_or_owner());

DROP POLICY IF EXISTS "service_areas_modify_admin_only" ON public."service_areas";
CREATE POLICY "service_areas_modify_admin_only_insert" ON public."service_areas" FOR INSERT TO authenticated WITH CHECK (is_admin_or_owner());
CREATE POLICY "service_areas_modify_admin_only_update" ON public."service_areas" FOR UPDATE TO authenticated USING (is_admin_or_owner()) WITH CHECK (is_admin_or_owner());
CREATE POLICY "service_areas_modify_admin_only_delete" ON public."service_areas" FOR DELETE TO authenticated USING (is_admin_or_owner());

DROP POLICY IF EXISTS "staff_permissions_modify_admin_only" ON public."staff_permissions";
CREATE POLICY "staff_permissions_modify_admin_only_insert" ON public."staff_permissions" FOR INSERT TO authenticated WITH CHECK (is_admin_or_owner());
CREATE POLICY "staff_permissions_modify_admin_only_update" ON public."staff_permissions" FOR UPDATE TO authenticated USING (is_admin_or_owner()) WITH CHECK (is_admin_or_owner());
CREATE POLICY "staff_permissions_modify_admin_only_delete" ON public."staff_permissions" FOR DELETE TO authenticated USING (is_admin_or_owner());

DROP POLICY IF EXISTS "sub_skips_write_staff" ON public."subscription_skip_records";
CREATE POLICY "sub_skips_write_staff_insert" ON public."subscription_skip_records" FOR INSERT TO authenticated WITH CHECK (is_staff());
CREATE POLICY "sub_skips_write_staff_update" ON public."subscription_skip_records" FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY "sub_skips_write_staff_delete" ON public."subscription_skip_records" FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "sub_vendor_changes_write_staff" ON public."subscription_vendor_changes";
CREATE POLICY "sub_vendor_changes_write_staff_insert" ON public."subscription_vendor_changes" FOR INSERT TO authenticated WITH CHECK (is_staff());
CREATE POLICY "sub_vendor_changes_write_staff_update" ON public."subscription_vendor_changes" FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY "sub_vendor_changes_write_staff_delete" ON public."subscription_vendor_changes" FOR DELETE TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "user_roles_manage_admin_owner" ON public."user_roles";
CREATE POLICY "user_roles_manage_admin_owner_insert" ON public."user_roles" FOR INSERT TO authenticated WITH CHECK (((role = ANY (ARRAY['owner'::user_role_enum, 'admin'::user_role_enum, 'customer'::user_role_enum])) AND ((SELECT is_owner()) OR ((SELECT is_admin_or_owner()) AND role = ANY (ARRAY['admin'::user_role_enum, 'customer'::user_role_enum]) AND user_id <> (SELECT auth.uid())))));
CREATE POLICY "user_roles_manage_admin_owner_update" ON public."user_roles" FOR UPDATE TO authenticated USING (((SELECT is_owner()) OR ((SELECT is_admin_or_owner()) AND role = ANY (ARRAY['admin'::user_role_enum, 'customer'::user_role_enum]) AND user_id <> (SELECT auth.uid())))) WITH CHECK (((role = ANY (ARRAY['owner'::user_role_enum, 'admin'::user_role_enum, 'customer'::user_role_enum])) AND ((SELECT is_owner()) OR ((SELECT is_admin_or_owner()) AND role = ANY (ARRAY['admin'::user_role_enum, 'customer'::user_role_enum]) AND user_id <> (SELECT auth.uid())))));
CREATE POLICY "user_roles_manage_admin_owner_delete" ON public."user_roles" FOR DELETE TO authenticated USING (((SELECT is_owner()) OR ((SELECT is_admin_or_owner()) AND role = ANY (ARRAY['admin'::user_role_enum, 'customer'::user_role_enum]) AND user_id <> (SELECT auth.uid()))));

DROP POLICY IF EXISTS "vendor_prices_modify_staff" ON public."vendor_prices";
CREATE POLICY "vendor_prices_modify_staff_insert" ON public."vendor_prices" FOR INSERT TO authenticated WITH CHECK (has_staff_permission('manage_pricing'::staff_permission_enum));
CREATE POLICY "vendor_prices_modify_staff_update" ON public."vendor_prices" FOR UPDATE TO authenticated USING (has_staff_permission('manage_pricing'::staff_permission_enum)) WITH CHECK (has_staff_permission('manage_pricing'::staff_permission_enum));
CREATE POLICY "vendor_prices_modify_staff_delete" ON public."vendor_prices" FOR DELETE TO authenticated USING (has_staff_permission('manage_pricing'::staff_permission_enum));

DROP POLICY IF EXISTS "vendor_products_modify_staff" ON public."vendor_products";
CREATE POLICY "vendor_products_modify_staff_insert" ON public."vendor_products" FOR INSERT TO authenticated WITH CHECK (has_staff_permission('manage_vendors'::staff_permission_enum));
CREATE POLICY "vendor_products_modify_staff_update" ON public."vendor_products" FOR UPDATE TO authenticated USING (has_staff_permission('manage_vendors'::staff_permission_enum)) WITH CHECK (has_staff_permission('manage_vendors'::staff_permission_enum));
CREATE POLICY "vendor_products_modify_staff_delete" ON public."vendor_products" FOR DELETE TO authenticated USING (has_staff_permission('manage_vendors'::staff_permission_enum));

DROP POLICY IF EXISTS "vendors_modify_staff" ON public."vendors";
CREATE POLICY "vendors_modify_staff_insert" ON public."vendors" FOR INSERT TO authenticated WITH CHECK (has_staff_permission('manage_vendors'::staff_permission_enum));
CREATE POLICY "vendors_modify_staff_update" ON public."vendors" FOR UPDATE TO authenticated USING (has_staff_permission('manage_vendors'::staff_permission_enum)) WITH CHECK (has_staff_permission('manage_vendors'::staff_permission_enum));
CREATE POLICY "vendors_modify_staff_delete" ON public."vendors" FOR DELETE TO authenticated USING (has_staff_permission('manage_vendors'::staff_permission_enum));

COMMIT;
