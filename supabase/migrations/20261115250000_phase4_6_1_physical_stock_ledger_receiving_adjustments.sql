-- Phase 4.6.1: immutable physical stock ledger, vendor receiving and stock adjustments.
-- available_stock is physical on-hand; reserved_stock is an allocation within on-hand.
-- Order reservation/release moves only reserved_stock. Order fulfilment consumes both.
BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.inventory_receipt_number_seq;
CREATE SEQUENCE IF NOT EXISTS public.inventory_stock_adjustment_number_seq;

CREATE TABLE IF NOT EXISTS public.inventory_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  vendor_id varchar NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  service_area_id uuid NOT NULL REFERENCES public.service_areas(id) ON DELETE RESTRICT,
  received_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  received_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  vendor_reference text,
  notes text,
  idempotency_key uuid NOT NULL,
  request_fingerprint text NOT NULL,
  total_units integer NOT NULL DEFAULT 0,
  total_cost_paise bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT uq_inventory_receipts_actor_idempotency UNIQUE(received_by,idempotency_key),
  CONSTRAINT chk_inventory_receipts_totals CHECK (total_units >= 0 AND total_cost_paise >= 0),
  CONSTRAINT chk_inventory_receipts_reference_length CHECK (vendor_reference IS NULL OR pg_catalog.length(vendor_reference) <= 120),
  CONSTRAINT chk_inventory_receipts_notes_length CHECK (notes IS NULL OR pg_catalog.length(notes) <= 500)
);

CREATE TABLE IF NOT EXISTS public.inventory_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.inventory_receipts(id) ON DELETE RESTRICT,
  inventory_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE RESTRICT,
  product_variant_id varchar NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity_received integer NOT NULL CHECK (quantity_received > 0),
  unit_cost_paise integer NOT NULL CHECK (unit_cost_paise >= 0),
  line_total_paise bigint GENERATED ALWAYS AS (quantity_received::bigint * unit_cost_paise::bigint) STORED,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT uq_inventory_receipt_items_variant UNIQUE(receipt_id,product_variant_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_number text NOT NULL UNIQUE,
  inventory_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE RESTRICT,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('spoilage','damage','stocktake_adjustment')),
  quantity_delta integer NOT NULL CHECK (quantity_delta <> 0),
  reason text NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(reason)) BETWEEN 5 AND 500),
  evidence_reference text,
  adjusted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  request_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT uq_inventory_adjustments_actor_idempotency UNIQUE(adjusted_by,idempotency_key),
  CONSTRAINT chk_inventory_adjustment_evidence_length CHECK (evidence_reference IS NULL OR pg_catalog.length(evidence_reference) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_inventory_receipts_vendor_date
  ON public.inventory_receipts(vendor_id,received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_receipts_area_date
  ON public.inventory_receipts(service_area_id,received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_receipt_items_inventory
  ON public.inventory_receipt_items(inventory_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_adjustments_inventory
  ON public.inventory_stock_adjustments(inventory_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_inventory_type_created
  ON public.inventory_movements(inventory_id,movement_type,created_at DESC);

ALTER TABLE public.inventory_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_adjustments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.inventory_receipts,public.inventory_receipt_items,public.inventory_stock_adjustments
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.inventory_receipts,public.inventory_receipt_items,public.inventory_stock_adjustments
  TO authenticated;

DROP POLICY IF EXISTS inventory_receipts_read_admin ON public.inventory_receipts;
CREATE POLICY inventory_receipts_read_admin ON public.inventory_receipts
  FOR SELECT TO authenticated USING ((SELECT private.is_admin_or_owner()));
DROP POLICY IF EXISTS inventory_receipt_items_read_admin ON public.inventory_receipt_items;
CREATE POLICY inventory_receipt_items_read_admin ON public.inventory_receipt_items
  FOR SELECT TO authenticated USING ((SELECT private.is_admin_or_owner()));
DROP POLICY IF EXISTS inventory_stock_adjustments_read_admin ON public.inventory_stock_adjustments;
CREATE POLICY inventory_stock_adjustments_read_admin ON public.inventory_stock_adjustments
  FOR SELECT TO authenticated USING ((SELECT private.is_admin_or_owner()));

-- Inventory mutations are performed only by audited SECURITY DEFINER RPCs.
-- No staff role or client can write counters or movement rows directly.
DROP POLICY IF EXISTS inventory_modify_staff_insert ON public.inventory;
DROP POLICY IF EXISTS inventory_modify_staff_update ON public.inventory;
DROP POLICY IF EXISTS inventory_modify_staff_delete ON public.inventory;
DROP POLICY IF EXISTS inventory_read_staff ON public.inventory;
DROP POLICY IF EXISTS inventory_movements_insert_staff ON public.inventory_movements;
DROP POLICY IF EXISTS inventory_movements_read_staff ON public.inventory_movements;

CREATE POLICY inventory_read_admin ON public.inventory
  FOR SELECT TO authenticated USING ((SELECT private.is_admin_or_owner()));
CREATE POLICY inventory_movements_read_admin ON public.inventory_movements
  FOR SELECT TO authenticated USING ((SELECT private.is_admin_or_owner()));

REVOKE INSERT,UPDATE,DELETE ON TABLE public.inventory FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON TABLE public.inventory_movements FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.prevent_inventory_movement_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
BEGIN
  RAISE EXCEPTION 'Inventory movement history is immutable'
    USING ERRCODE='55000';
END;
$function$;

REVOKE ALL ON FUNCTION private.prevent_inventory_movement_mutation() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS trg_inventory_movements_immutable ON public.inventory_movements;
CREATE TRIGGER trg_inventory_movements_immutable
  BEFORE UPDATE OR DELETE ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION private.prevent_inventory_movement_mutation();

CREATE OR REPLACE FUNCTION private.receive_inventory_stock(
  p_vendor_id varchar,
  p_service_area_id uuid,
  p_vendor_reference text,
  p_notes text,
  p_items jsonb,
  p_idempotency_key uuid
)
RETURNS TABLE(
  receipt_id uuid,
  receipt_number text,
  total_units integer,
  total_cost_paise bigint,
  was_replayed boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  v_actor uuid:=auth.uid();
  v_existing public.inventory_receipts%ROWTYPE;
  v_receipt_id uuid;
  v_receipt_number text;
  v_fingerprint text;
  v_total_units integer;
  v_total_cost bigint;
  v_line record;
  v_inventory_id uuid;
  v_item_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only owner/admin can receive inventory stock' USING ERRCODE='42501';
  END IF;
  IF p_vendor_id IS NULL OR pg_catalog.btrim(p_vendor_id)='' OR p_service_area_id IS NULL
     OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Vendor, service area and idempotency key are required' USING ERRCODE='22023';
  END IF;
  IF p_vendor_reference IS NOT NULL AND pg_catalog.length(p_vendor_reference)>120 THEN
    RAISE EXCEPTION 'Vendor reference must be 120 characters or fewer' USING ERRCODE='22023';
  END IF;
  IF p_notes IS NOT NULL AND pg_catalog.length(p_notes)>500 THEN
    RAISE EXCEPTION 'Receipt notes must be 500 characters or fewer' USING ERRCODE='22023';
  END IF;
  v_fingerprint:=pg_catalog.md5(pg_catalog.concat_ws('|',p_vendor_id,p_service_area_id::text,
    COALESCE(p_vendor_reference,''),COALESCE(p_notes,''),COALESCE(p_items::text,'')));

  SELECT r.* INTO v_existing FROM public.inventory_receipts r
  WHERE r.received_by=v_actor AND r.idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_existing.request_fingerprint<>v_fingerprint THEN
      RAISE EXCEPTION 'Receipt idempotency key was already used with different details' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT v_existing.id,v_existing.receipt_number,v_existing.total_units,v_existing.total_cost_paise,true;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.vendors v WHERE v.id=p_vendor_id AND v.is_approved=true) THEN
    RAISE EXCEPTION 'Choose an approved inventory vendor' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.service_areas a WHERE a.id=p_service_area_id AND a.is_active=true) THEN
    RAISE EXCEPTION 'Choose an active service area' USING ERRCODE='23514';
  END IF;
  IF p_items IS NULL OR pg_catalog.jsonb_typeof(p_items)<>'array' THEN
    RAISE EXCEPTION 'Receipt items must be a JSON array' USING ERRCODE='22023';
  END IF;
  IF pg_catalog.jsonb_array_length(p_items)<1 OR pg_catalog.jsonb_array_length(p_items)>100 THEN
    RAISE EXCEPTION 'A receipt must contain between 1 and 100 SKU lines' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_items) AS e(value)
    WHERE pg_catalog.jsonb_typeof(e.value)<>'object'
      OR pg_catalog.jsonb_typeof(e.value->'product_variant_id')<>'string'
      OR COALESCE(e.value->>'product_variant_id','')=''
      OR pg_catalog.jsonb_typeof(e.value->'quantity')<>'number'
      OR COALESCE(e.value->>'quantity','') !~ '^[1-9][0-9]*$'
      OR pg_catalog.jsonb_typeof(e.value->'unit_cost_paise')<>'number'
      OR COALESCE(e.value->>'unit_cost_paise','') !~ '^(0|[1-9][0-9]*)$'
  ) THEN
    RAISE EXCEPTION 'Each receipt line needs a SKU, positive integer quantity and non-negative integer unit cost in paise' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_items)) <>
     (SELECT count(DISTINCT e.value->>'product_variant_id') FROM pg_catalog.jsonb_array_elements(p_items) AS e(value)) THEN
    RAISE EXCEPTION 'A SKU can appear only once per receipt; combine its quantity' USING ERRCODE='22023';
  END IF;

  DROP TABLE IF EXISTS pg_temp.dby_receipt_lines;
  CREATE TEMP TABLE pg_temp.dby_receipt_lines(
    product_variant_id varchar PRIMARY KEY,
    quantity_received integer NOT NULL,
    unit_cost_paise integer NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO pg_temp.dby_receipt_lines(product_variant_id,quantity_received,unit_cost_paise)
  SELECT e.value->>'product_variant_id',(e.value->>'quantity')::integer,(e.value->>'unit_cost_paise')::integer
  FROM pg_catalog.jsonb_array_elements(p_items) AS e(value);

  IF EXISTS (
    SELECT 1 FROM pg_temp.dby_receipt_lines l
    LEFT JOIN public.product_variants pv ON pv.id=l.product_variant_id
    WHERE pv.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A receipt contains an unknown product SKU' USING ERRCODE='23503';
  END IF;
  SELECT COALESCE(pg_catalog.sum(l.quantity_received),0)::integer,
    COALESCE(pg_catalog.sum(l.quantity_received::bigint*l.unit_cost_paise::bigint),0)::bigint
  INTO v_total_units,v_total_cost FROM pg_temp.dby_receipt_lines l;
  IF v_total_cost<0 THEN RAISE EXCEPTION 'Receipt cost is outside the supported range' USING ERRCODE='22003'; END IF;

  v_receipt_number:='DBY-RCV-'||pg_catalog.to_char(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata','YYYYMMDD')
    ||'-'||pg_catalog.lpad(pg_catalog.nextval('public.inventory_receipt_number_seq')::text,6,'0');
  INSERT INTO public.inventory_receipts(
    receipt_number,vendor_id,service_area_id,received_by,vendor_reference,notes,idempotency_key,
    request_fingerprint,total_units,total_cost_paise
  ) VALUES (
    v_receipt_number,p_vendor_id,p_service_area_id,v_actor,NULLIF(pg_catalog.btrim(p_vendor_reference),''),
    NULLIF(pg_catalog.btrim(p_notes),''),p_idempotency_key,v_fingerprint,v_total_units,v_total_cost
  ) RETURNING id INTO v_receipt_id;

  FOR v_line IN SELECT * FROM pg_temp.dby_receipt_lines ORDER BY product_variant_id LOOP
    INSERT INTO public.inventory(product_variant_id,service_area_id,available_stock,reserved_stock)
    VALUES(v_line.product_variant_id,p_service_area_id,0,0)
    ON CONFLICT (product_variant_id,service_area_id) DO NOTHING;

    SELECT i.id INTO v_inventory_id FROM public.inventory i
    WHERE i.product_variant_id=v_line.product_variant_id AND i.service_area_id=p_service_area_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Inventory row could not be created for SKU %',v_line.product_variant_id USING ERRCODE='23514'; END IF;

    UPDATE public.inventory SET available_stock=available_stock+v_line.quantity_received,
      updated_at=pg_catalog.now() WHERE id=v_inventory_id;

    INSERT INTO public.inventory_receipt_items(
      receipt_id,inventory_id,product_variant_id,quantity_received,unit_cost_paise
    ) VALUES (
      v_receipt_id,v_inventory_id,v_line.product_variant_id,v_line.quantity_received,v_line.unit_cost_paise
    ) RETURNING id INTO v_item_id;

    INSERT INTO public.inventory_movements(inventory_id,change_amount,movement_type,reference_id,notes,created_by)
    VALUES(v_inventory_id,v_line.quantity_received,'stock_receipt',v_receipt_id::text,
      'Receipt '||v_receipt_number||'; item '||v_item_id::text,v_actor);
  END LOOP;

  RETURN QUERY SELECT v_receipt_id,v_receipt_number,v_total_units,v_total_cost,false;
END;
$function$;

REVOKE ALL ON FUNCTION private.receive_inventory_stock(varchar,uuid,text,text,jsonb,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.receive_inventory_stock(
  p_vendor_id varchar,p_service_area_id uuid,p_vendor_reference text,p_notes text,
  p_items jsonb,p_idempotency_key uuid
)
RETURNS TABLE(receipt_id uuid,receipt_number text,total_units integer,total_cost_paise bigint,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $wrapper$ SELECT * FROM private.receive_inventory_stock(
  p_vendor_id,p_service_area_id,p_vendor_reference,p_notes,p_items,p_idempotency_key
); $wrapper$;

REVOKE ALL ON FUNCTION public.receive_inventory_stock(varchar,uuid,text,text,jsonb,uuid)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.receive_inventory_stock(varchar,uuid,text,text,jsonb,uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.adjust_inventory_stock(
  p_inventory_id uuid,
  p_adjustment_type text,
  p_quantity integer,
  p_reason text,
  p_evidence_reference text,
  p_idempotency_key uuid
)
RETURNS TABLE(
  adjustment_id uuid,
  adjustment_number text,
  inventory_id uuid,
  adjustment_type text,
  quantity_delta integer,
  available_stock integer,
  reserved_stock integer,
  was_replayed boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  v_actor uuid:=auth.uid();
  v_existing public.inventory_stock_adjustments%ROWTYPE;
  v_inventory public.inventory%ROWTYPE;
  v_adjustment_id uuid;
  v_adjustment_number text;
  v_delta integer;
  v_new_available integer;
  v_fingerprint text;
BEGIN
  IF v_actor IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only owner/admin can adjust inventory stock' USING ERRCODE='42501';
  END IF;
  IF p_inventory_id IS NULL OR p_idempotency_key IS NULL
     OR p_adjustment_type IS NULL OR p_adjustment_type NOT IN ('spoilage','damage','stocktake_adjustment')
     OR p_quantity IS NULL OR p_quantity=0
     OR p_reason IS NULL OR pg_catalog.length(pg_catalog.btrim(p_reason))<5
     OR pg_catalog.length(p_reason)>500
     OR (p_evidence_reference IS NOT NULL AND pg_catalog.length(p_evidence_reference)>200) THEN
    RAISE EXCEPTION 'Valid inventory, adjustment type, non-zero quantity, reason and idempotency key are required' USING ERRCODE='22023';
  END IF;
  IF p_adjustment_type IN ('spoilage','damage') AND p_quantity<0 THEN
    RAISE EXCEPTION 'Spoilage and damage quantities must be entered as positive units' USING ERRCODE='22023';
  END IF;
  v_delta:=CASE WHEN p_adjustment_type IN ('spoilage','damage') THEN -p_quantity ELSE p_quantity END;
  v_fingerprint:=pg_catalog.md5(pg_catalog.concat_ws('|',p_inventory_id::text,p_adjustment_type,
    p_quantity::text,pg_catalog.btrim(p_reason),COALESCE(p_evidence_reference,'')));

  SELECT a.* INTO v_existing FROM public.inventory_stock_adjustments a
  WHERE a.adjusted_by=v_actor AND a.idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_existing.request_fingerprint<>v_fingerprint THEN
      RAISE EXCEPTION 'Adjustment idempotency key was already used with different details' USING ERRCODE='23505';
    END IF;
    SELECT i.* INTO v_inventory FROM public.inventory i WHERE i.id=v_existing.inventory_id;
    RETURN QUERY SELECT v_existing.id,v_existing.adjustment_number,v_existing.inventory_id,
      v_existing.adjustment_type,v_existing.quantity_delta,v_inventory.available_stock,
      v_inventory.reserved_stock,true;
    RETURN;
  END IF;

  SELECT i.* INTO v_inventory FROM public.inventory i WHERE i.id=p_inventory_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory row not found' USING ERRCODE='P0002'; END IF;
  v_new_available:=v_inventory.available_stock+v_delta;
  IF v_new_available<0 OR v_new_available<v_inventory.reserved_stock THEN
    RAISE EXCEPTION 'Adjustment would consume reserved stock or make on-hand stock negative' USING ERRCODE='23514';
  END IF;

  v_adjustment_number:='DBY-ADJ-'||pg_catalog.to_char(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata','YYYYMMDD')
    ||'-'||pg_catalog.lpad(pg_catalog.nextval('public.inventory_stock_adjustment_number_seq')::text,6,'0');
  INSERT INTO public.inventory_stock_adjustments(
    adjustment_number,inventory_id,adjustment_type,quantity_delta,reason,evidence_reference,
    adjusted_by,idempotency_key,request_fingerprint
  ) VALUES (
    v_adjustment_number,p_inventory_id,p_adjustment_type,v_delta,pg_catalog.btrim(p_reason),
    NULLIF(pg_catalog.btrim(p_evidence_reference),''),v_actor,p_idempotency_key,v_fingerprint
  ) RETURNING id INTO v_adjustment_id;

  UPDATE public.inventory SET available_stock=v_new_available,updated_at=pg_catalog.now()
  WHERE id=p_inventory_id;

  INSERT INTO public.inventory_movements(inventory_id,change_amount,movement_type,reference_id,notes,created_by)
  VALUES(p_inventory_id,v_delta,p_adjustment_type,v_adjustment_id::text,
    'Adjustment '||v_adjustment_number||'; '||pg_catalog.btrim(p_reason),v_actor);

  RETURN QUERY SELECT v_adjustment_id,v_adjustment_number,p_inventory_id,p_adjustment_type,
    v_delta,v_new_available,v_inventory.reserved_stock,false;
END;
$function$;

REVOKE ALL ON FUNCTION private.adjust_inventory_stock(uuid,text,integer,text,text,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
  p_inventory_id uuid,p_adjustment_type text,p_quantity integer,p_reason text,
  p_evidence_reference text,p_idempotency_key uuid
)
RETURNS TABLE(adjustment_id uuid,adjustment_number text,inventory_id uuid,adjustment_type text,
  quantity_delta integer,available_stock integer,reserved_stock integer,was_replayed boolean)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=''
AS $wrapper$ SELECT * FROM private.adjust_inventory_stock(
  p_inventory_id,p_adjustment_type,p_quantity,p_reason,p_evidence_reference,p_idempotency_key
); $wrapper$;

REVOKE ALL ON FUNCTION public.adjust_inventory_stock(uuid,text,integer,text,text,uuid)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(uuid,text,integer,text,text,uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION private.audit_inventory_stock()
RETURNS TABLE(
  audit_type text,
  inventory_id uuid,
  product_variant_id varchar,
  service_area_id uuid,
  recorded_available_stock integer,
  ledger_available_stock integer,
  recorded_reserved_stock integer,
  ledger_reserved_stock integer,
  free_stock integer,
  safety_stock integer,
  detail text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Only owner/admin can audit physical inventory stock' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH movement_ledger AS (
    SELECT im.inventory_id,
      COALESCE(pg_catalog.sum(im.change_amount) FILTER (
        WHERE im.movement_type IN ('stock_receipt','spoilage','damage','stocktake_adjustment','order_fulfilled')
      ),0)::integer AS ledger_available,
      COALESCE(pg_catalog.sum(im.change_amount) FILTER (
        WHERE im.movement_type IN ('order_reservation','order_reservation_release','order_fulfilled')
      ),0)::integer AS ledger_reserved
    FROM public.inventory_movements im
    GROUP BY im.inventory_id
  )
  SELECT 'on_hand_balance'::text,i.id,i.product_variant_id,i.service_area_id,
    i.available_stock,COALESCE(l.ledger_available,0),i.reserved_stock,COALESCE(l.ledger_reserved,0),
    i.available_stock-i.reserved_stock,i.safety_stock,
    pg_catalog.format('available_stock (%s) differs from physical movement ledger (%s)',
      i.available_stock,COALESCE(l.ledger_available,0))
  FROM public.inventory i LEFT JOIN movement_ledger l ON l.inventory_id=i.id
  WHERE i.available_stock<>COALESCE(l.ledger_available,0)
  UNION ALL
  SELECT 'reserved_balance'::text,i.id,i.product_variant_id,i.service_area_id,
    i.available_stock,COALESCE(l.ledger_available,0),i.reserved_stock,COALESCE(l.ledger_reserved,0),
    i.available_stock-i.reserved_stock,i.safety_stock,
    pg_catalog.format('reserved_stock (%s) differs from reservation ledger (%s)',
      i.reserved_stock,COALESCE(l.ledger_reserved,0))
  FROM public.inventory i LEFT JOIN movement_ledger l ON l.inventory_id=i.id
  WHERE i.reserved_stock<>COALESCE(l.ledger_reserved,0)
  UNION ALL
  SELECT 'free_stock_negative'::text,i.id,i.product_variant_id,i.service_area_id,
    i.available_stock,COALESCE(l.ledger_available,0),i.reserved_stock,COALESCE(l.ledger_reserved,0),
    i.available_stock-i.reserved_stock,i.safety_stock,
    pg_catalog.format('reserved_stock (%s) exceeds physical on-hand stock (%s)',
      i.reserved_stock,i.available_stock)
  FROM public.inventory i LEFT JOIN movement_ledger l ON l.inventory_id=i.id
  WHERE i.available_stock<i.reserved_stock;
END;
$function$;

REVOKE ALL ON FUNCTION private.audit_inventory_stock() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.audit_inventory_stock()
RETURNS TABLE(
  audit_type text,inventory_id uuid,product_variant_id varchar,service_area_id uuid,
  recorded_available_stock integer,ledger_available_stock integer,
  recorded_reserved_stock integer,ledger_reserved_stock integer,
  free_stock integer,safety_stock integer,detail text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $wrapper$ SELECT * FROM private.audit_inventory_stock(); $wrapper$;

REVOKE ALL ON FUNCTION public.audit_inventory_stock() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.audit_inventory_stock() TO authenticated;

COMMENT ON TABLE public.inventory_receipts IS
  'Immutable vendor receipt headers. Stock is increased only by the trusted receive_inventory_stock RPC.';
COMMENT ON TABLE public.inventory_receipt_items IS
  'Immutable per-SKU quantities and purchase costs linked to a vendor receipt.';
COMMENT ON TABLE public.inventory_stock_adjustments IS
  'Audited spoilage, damage and stocktake adjustments. Quantity deltas are signed and cannot consume reserved units.';
COMMENT ON FUNCTION public.receive_inventory_stock(varchar,uuid,text,text,jsonb,uuid) IS
  'Owner/admin-only idempotent vendor stock receipt. Atomically increases physical on-hand inventory and appends stock_receipt movements for every SKU line.';
COMMENT ON FUNCTION public.adjust_inventory_stock(uuid,text,integer,text,text,uuid) IS
  'Owner/admin-only idempotent spoilage, damage or stocktake adjustment. Negative adjustments cannot reduce on-hand below reserved stock.';
COMMENT ON FUNCTION public.audit_inventory_stock() IS
  'Read-only owner/admin physical stock audit. Reconciles available_stock to stock receipt/adjustment/fulfilment movements and reserved_stock to reservation movements; never repairs stock.';

COMMIT;
