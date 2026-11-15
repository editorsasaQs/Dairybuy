BEGIN;

-- 1. Confirmed delivery windows and deadlines (Asia/Kolkata)
ALTER TABLE public.delivery_slots ADD COLUMN IF NOT EXISTS cancellation_deadline_time TIME;

UPDATE public.delivery_slots
SET label='Morning (8 AM - 11 AM)',start_time='08:00:00',end_time='11:00:00',
    order_cutoff_time='07:00:00',cancellation_deadline_time='07:30:00'
WHERE slot_code='morning_slot';

UPDATE public.delivery_slots
SET label='Evening (5 PM - 9 PM)',start_time='17:00:00',end_time='21:00:00',
    order_cutoff_time='16:00:00',cancellation_deadline_time='16:30:00'
WHERE slot_code='evening_slot';

-- 2. Preserve price history and enforce one current open-ended price per key
UPDATE public.vendor_prices vp
SET is_current=FALSE,effective_to=COALESCE(vp.effective_to,NOW())
WHERE vp.is_current=TRUE AND EXISTS (
  SELECT 1 FROM public.vendor_prices newer
  WHERE newer.vendor_id=vp.vendor_id
    AND newer.product_variant_id=vp.product_variant_id
    AND newer.milk_type=vp.milk_type
    AND newer.is_current=TRUE AND newer.id<>vp.id
    AND (newer.created_at>vp.created_at OR (newer.created_at=vp.created_at AND newer.id>vp.id))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_prices_one_current
ON public.vendor_prices(vendor_id,product_variant_id,milk_type)
WHERE is_current=TRUE AND effective_to IS NULL;

-- 3. Prevent role escalation
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
DECLARE curr_uid UUID := auth.uid();
BEGIN
  IF curr_uid IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=curr_uid AND role='owner');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public;

DROP POLICY IF EXISTS user_roles_modify_admin_only ON public.user_roles;
DROP POLICY IF EXISTS user_roles_modify_owner ON public.user_roles;
DROP POLICY IF EXISTS user_roles_modify_admin_limited ON public.user_roles;

CREATE POLICY user_roles_modify_owner ON public.user_roles
FOR ALL USING(public.is_owner()) WITH CHECK(public.is_owner());

CREATE POLICY user_roles_modify_admin_limited ON public.user_roles
FOR ALL
USING(public.is_admin_or_owner() AND role IN ('manager','operations_staff','customer') AND user_id<>auth.uid())
WITH CHECK(public.is_admin_or_owner() AND role IN ('manager','operations_staff','customer') AND user_id<>auth.uid());

REVOKE ALL ON FUNCTION public.get_user_roles(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_roles(UUID) FROM anon,authenticated;

-- 4. Prevent client-side audit log poisoning
DROP POLICY IF EXISTS audit_logs_insert_all ON public.audit_logs;

-- 5. Server-side order creation/changes; staff-only updates
DROP POLICY IF EXISTS orders_insert_own ON public.orders;
DROP POLICY IF EXISTS orders_update_staff_or_owner ON public.orders;
DROP POLICY IF EXISTS order_items_insert_own ON public.order_items;
DROP POLICY IF EXISTS orders_update_staff ON public.orders;

CREATE POLICY orders_update_staff ON public.orders
FOR UPDATE USING(public.is_staff()) WITH CHECK(public.is_staff());

CREATE OR REPLACE FUNCTION public.prevent_order_money_edits()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.subtotal_paise,NEW.delivery_fee_paise,NEW.total_paise,NEW.customer_id,NEW.order_number)
     IS DISTINCT FROM
     (OLD.subtotal_paise,OLD.delivery_fee_paise,OLD.total_paise,OLD.customer_id,OLD.order_number)
     AND COALESCE(auth.role(),'service_role')<>'service_role'
  THEN
    RAISE EXCEPTION 'Order amounts and ownership are immutable' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path=public,pg_temp;

DROP TRIGGER IF EXISTS trg_orders_money_immutable ON public.orders;
CREATE TRIGGER trg_orders_money_immutable
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.prevent_order_money_edits();

-- 6. Subscription lifecycle changes must go through trusted server/staff paths
DROP POLICY IF EXISTS subscriptions_insert_own ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_update_own ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_update_staff ON public.subscriptions;

CREATE POLICY subscriptions_update_staff ON public.subscriptions
FOR UPDATE USING(public.is_staff()) WITH CHECK(public.is_staff());

DO $$ BEGIN
  ALTER TABLE public.subscriptions
  ADD CONSTRAINT chk_subscription_manual_renewal CHECK(auto_renew=FALSE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP POLICY IF EXISTS sub_skips_manage ON public.subscription_skip_records;
DROP POLICY IF EXISTS sub_vendor_changes_manage ON public.subscription_vendor_changes;

CREATE POLICY sub_skips_select ON public.subscription_skip_records
FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.subscriptions s
    WHERE s.id=subscription_skip_records.subscription_id
    AND (s.customer_id=auth.uid() OR public.is_staff()))
);
CREATE POLICY sub_skips_write_staff ON public.subscription_skip_records
FOR ALL USING(public.is_staff()) WITH CHECK(public.is_staff());

CREATE POLICY sub_vendor_changes_select ON public.subscription_vendor_changes
FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.subscriptions s
    WHERE s.id=subscription_vendor_changes.subscription_id
    AND (s.customer_id=auth.uid() OR public.is_staff()))
);
CREATE POLICY sub_vendor_changes_write_staff ON public.subscription_vendor_changes
FOR ALL USING(public.is_staff()) WITH CHECK(public.is_staff());

-- 7. Payment visibility limited to owners/admins, report-authorized staff, and record owner
DROP POLICY IF EXISTS payments_select ON public.payments;

CREATE POLICY payments_select ON public.payments
FOR SELECT USING (
  public.is_admin_or_owner()
  OR public.has_staff_permission('view_reports')
  OR EXISTS(SELECT 1 FROM public.orders o WHERE o.id=payments.order_id AND o.customer_id=auth.uid())
  OR EXISTS(SELECT 1 FROM public.subscriptions sub WHERE sub.id=payments.subscription_id AND sub.customer_id=auth.uid())
);

COMMIT;