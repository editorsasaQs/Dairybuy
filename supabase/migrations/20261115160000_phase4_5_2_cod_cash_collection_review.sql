-- Phase 4.5.2: owner/admin verification or rejection of COD cash collections.
-- Only an exact, recorded cash amount can settle a delivered one-time COD payment.
-- Rejection is audited and leaves the payment pending for the later reconciliation slice.

BEGIN;

ALTER TABLE public.cod_collections
  ADD COLUMN IF NOT EXISTS rejected_by_manager_id uuid
    REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.cod_collections
  DROP CONSTRAINT IF EXISTS cod_collections_status_check;

ALTER TABLE public.cod_collections
  ADD CONSTRAINT cod_collections_status_check
  CHECK (status IN ('collected','verified','disputed','rejected'));

ALTER TABLE public.cod_collections
  ADD CONSTRAINT cod_collections_rejection_reason_length
  CHECK (rejection_reason IS NULL OR pg_catalog.length(rejection_reason) <= 500);

COMMENT ON COLUMN public.cod_collections.rejected_by_manager_id IS
  'Owner/admin who rejected the cash collection record; does not settle the COD payment.';
COMMENT ON COLUMN public.cod_collections.rejected_at IS
  'Timestamp when an owner/admin rejected the COD cash collection record.';
COMMENT ON COLUMN public.cod_collections.rejection_reason IS
  'Required owner/admin reason for rejecting a COD cash collection record.';

CREATE OR REPLACE FUNCTION private.review_cod_cash_collection(
  p_order_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
)
RETURNS TABLE(
  collection_id uuid,
  order_id uuid,
  collection_status text,
  payment_status public.payment_status_enum,
  was_replayed boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_collection public.cod_collections%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_payment_count integer;
  v_note text := NULLIF(pg_catalog.btrim(p_note), '');
  v_now timestamptz := pg_catalog.now();
BEGIN
  IF v_actor IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only owner/admin can review COD cash collections'
      USING ERRCODE = '42501';
  END IF;

  IF p_order_id IS NULL OR p_decision NOT IN ('verify','reject') THEN
    RAISE EXCEPTION 'A valid order and review decision are required'
      USING ERRCODE = '22023';
  END IF;

  IF p_note IS NOT NULL AND pg_catalog.length(p_note) > 500 THEN
    RAISE EXCEPTION 'Review note must be 500 characters or fewer'
      USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'reject' AND (v_note IS NULL OR pg_catalog.length(v_note) < 5) THEN
    RAISE EXCEPTION 'A rejection reason of at least 5 characters is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT o.* INTO v_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.order_type <> 'one_time'
     OR v_order.payment_method <> 'cod'
     OR v_order.status <> 'delivered' THEN
    RAISE EXCEPTION 'Only delivered one-time COD orders can be reviewed'
      USING ERRCODE = '23514';
  END IF;

  SELECT c.* INTO v_collection
  FROM public.cod_collections AS c
  WHERE c.order_id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COD cash collection record not found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_payment_count
  FROM public.payments AS p
  WHERE p.order_id = p_order_id;
  IF v_payment_count <> 1 THEN
    RAISE EXCEPTION 'Exactly one payment record must exist for this COD order'
      USING ERRCODE = '23514';
  END IF;

  SELECT p.* INTO v_payment
  FROM public.payments AS p
  WHERE p.order_id = p_order_id
  FOR UPDATE;
  IF v_payment.gateway <> 'cod'
     OR v_payment.amount_paise <> v_order.total_paise THEN
    RAISE EXCEPTION 'COD payment does not match the authoritative order total'
      USING ERRCODE = '23514';
  END IF;

  -- Safe retries are read-only and require the financial state to agree with
  -- the already recorded decision.
  IF p_decision = 'verify' AND v_collection.status = 'verified' THEN
    IF v_payment.status <> 'captured'
       OR v_order.payment_status <> 'captured'
       OR v_collection.verified_by_manager_id IS NULL
       OR v_collection.verified_at IS NULL THEN
      RAISE EXCEPTION 'Verified collection has an inconsistent payment state'
        USING ERRCODE = '23514';
    END IF;
    RETURN QUERY SELECT v_collection.id, p_order_id,
      v_collection.status, v_payment.status, true;
    RETURN;
  ELSIF p_decision = 'reject' AND v_collection.status = 'rejected' THEN
    IF v_payment.status <> 'pending'
       OR v_order.payment_status <> 'pending'
       OR v_collection.rejected_by_manager_id IS NULL
       OR v_collection.rejected_at IS NULL THEN
      RAISE EXCEPTION 'Rejected collection has an inconsistent payment state'
        USING ERRCODE = '23514';
    END IF;
    RETURN QUERY SELECT v_collection.id, p_order_id,
      v_collection.status, v_payment.status, true;
    RETURN;
  END IF;

  IF v_payment.status <> 'pending' OR v_order.payment_status <> 'pending' THEN
    RAISE EXCEPTION 'COD payment is no longer pending and cannot be reviewed again'
      USING ERRCODE = '23514';
  END IF;

  IF p_decision = 'verify' THEN
    IF v_collection.status <> 'collected' THEN
      RAISE EXCEPTION 'Only an undisputed collected record can be verified'
        USING ERRCODE = '23514';
    END IF;
    IF v_collection.amount_collected_paise <> v_order.total_paise THEN
      RAISE EXCEPTION 'Collected cash must exactly match the order total before verification'
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.cod_collections
    SET status = 'verified',
        verified_by_manager_id = v_actor,
        verified_at = v_now,
        rejected_by_manager_id = NULL,
        rejected_at = NULL,
        rejection_reason = NULL
    WHERE id = v_collection.id;

    UPDATE public.payments
    SET status = 'captured',
        updated_at = v_now
    WHERE id = v_payment.id AND status = 'pending';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'COD payment changed during verification'
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.orders
    SET payment_status = 'captured',
        updated_at = v_now
    WHERE id = v_order.id AND payment_status = 'pending';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order payment status changed during verification'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF v_collection.status NOT IN ('collected','disputed') THEN
      RAISE EXCEPTION 'Only collected or disputed records can be rejected'
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.cod_collections
    SET status = 'rejected',
        rejected_by_manager_id = v_actor,
        rejected_at = v_now,
        rejection_reason = v_note
    WHERE id = v_collection.id;
    -- Rejection never captures or otherwise changes the pending payment.
  END IF;

  INSERT INTO public.audit_logs(
    user_id, action, table_name, record_id, old_values, new_values
  )
  VALUES (
    v_actor,
    CASE WHEN p_decision = 'verify'
      THEN 'cod_collection.verified'
      ELSE 'cod_collection.rejected'
    END,
    'cod_collections',
    v_collection.id::text,
    pg_catalog.jsonb_build_object(
      'status', v_collection.status,
      'payment_status', v_payment.status,
      'amount_collected_paise', v_collection.amount_collected_paise
    ),
    pg_catalog.jsonb_build_object(
      'status', CASE WHEN p_decision = 'verify' THEN 'verified' ELSE 'rejected' END,
      'payment_status', CASE WHEN p_decision = 'verify' THEN 'captured' ELSE 'pending' END,
      'reviewed_by', v_actor,
      'review_note', v_note
    )
  );

  RETURN QUERY
  SELECT v_collection.id, p_order_id,
    CASE WHEN p_decision = 'verify' THEN 'verified' ELSE 'rejected' END,
    CASE WHEN p_decision = 'verify'
      THEN 'captured'::public.payment_status_enum
      ELSE 'pending'::public.payment_status_enum
    END,
    false;
END;
$function$;

REVOKE ALL ON FUNCTION private.review_cod_cash_collection(uuid,text,text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.review_cod_cash_collection(
  p_order_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
)
RETURNS TABLE(
  collection_id uuid,
  order_id uuid,
  collection_status text,
  payment_status public.payment_status_enum,
  was_replayed boolean
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $wrapper$
  SELECT * FROM private.review_cod_cash_collection(
    p_order_id, p_decision, p_note
  );
$wrapper$;

REVOKE ALL ON FUNCTION public.review_cod_cash_collection(uuid,text,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.review_cod_cash_collection(uuid,text,text)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.get_admin_cod_collection(
  p_order_id uuid
)
RETURNS TABLE(
  collection_id uuid,
  order_id uuid,
  amount_collected_paise integer,
  collection_status text,
  collected_by_staff_id uuid,
  collected_at timestamptz,
  receipt_reference text,
  collection_notes text,
  verified_by_manager_id uuid,
  verified_at timestamptz,
  rejected_by_manager_id uuid,
  rejected_at timestamptz,
  rejection_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only owner/admin can view COD collection review details'
      USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order is required' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT c.id, c.order_id, c.amount_collected_paise, c.status,
    c.collected_by_staff_id, c.collected_at, c.receipt_reference,
    c.collection_notes, c.verified_by_manager_id, c.verified_at,
    c.rejected_by_manager_id, c.rejected_at, c.rejection_reason
  FROM public.cod_collections AS c
  JOIN public.orders AS o ON o.id = c.order_id
  WHERE c.order_id = p_order_id
    AND o.order_type = 'one_time'
    AND o.payment_method = 'cod';
END;
$function$;

REVOKE ALL ON FUNCTION private.get_admin_cod_collection(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_admin_cod_collection(
  p_order_id uuid
)
RETURNS TABLE(
  collection_id uuid,
  order_id uuid,
  amount_collected_paise integer,
  collection_status text,
  collected_by_staff_id uuid,
  collected_at timestamptz,
  receipt_reference text,
  collection_notes text,
  verified_by_manager_id uuid,
  verified_at timestamptz,
  rejected_by_manager_id uuid,
  rejected_at timestamptz,
  rejection_reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $wrapper$
  SELECT * FROM private.get_admin_cod_collection(p_order_id);
$wrapper$;

REVOKE ALL ON FUNCTION public.get_admin_cod_collection(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_cod_collection(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.review_cod_cash_collection(uuid,text,text) IS
'Owner/admin-only atomic COD cash verification/rejection. Exact cash match verifies and captures the COD payment; rejection is audited and leaves payment pending. Idempotent same-decision retries do not duplicate audit entries.';
COMMENT ON FUNCTION public.get_admin_cod_collection(uuid) IS
'Returns the minimal COD collection review record only to authenticated owner/admin users; direct cod_collections table access remains revoked.';

COMMIT;
