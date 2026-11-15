#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:55432/postgres}"
CUSTOMER="cccccccc-cccc-4ccc-8ccc-cccccccccccc"
ADDRESS="cccccccc-0000-4000-8000-000000000001"
CART="cccccccc-0000-4000-8000-000000000010"
KEY="cccccccc-0000-4000-8000-000000000020"
AREA="00000000-0000-0000-0000-000000000001"
SLOT="00000000-0000-0000-0000-000000000011"
VARIANT="ghee-red-cow-200ml"
ORDER_ID=""

cleanup() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL >/dev/null 2>&1 || true
DELETE FROM public.order_status_history WHERE order_id IN (SELECT id FROM public.orders WHERE customer_id='$CUSTOMER'::uuid);
DELETE FROM public.inventory_movements WHERE reference_id IN (SELECT id::text FROM public.orders WHERE customer_id='$CUSTOMER'::uuid);
DELETE FROM public.payments WHERE order_id IN (SELECT id FROM public.orders WHERE customer_id='$CUSTOMER'::uuid);
DELETE FROM public.orders WHERE customer_id='$CUSTOMER'::uuid;
DELETE FROM public.carts WHERE customer_id='$CUSTOMER'::uuid;
DELETE FROM public.customer_addresses WHERE customer_id='$CUSTOMER'::uuid;
DELETE FROM auth.users WHERE id='$CUSTOMER'::uuid;
UPDATE public.inventory SET available_stock=0,reserved_stock=0,safety_stock=0
 WHERE product_variant_id='$VARIANT' AND service_area_id='$AREA'::uuid;
SQL
}
trap cleanup EXIT

psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO auth.users
 (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES
 ('$CUSTOMER'::uuid,'authenticated','authenticated','phase444-cancel@test.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Cancellation Test"}'::jsonb);

INSERT INTO public.customer_addresses
 (id,customer_id,service_area_id,recipient_name,phone,address_line1,pincode,is_default)
VALUES
 ('$ADDRESS'::uuid,'$CUSTOMER'::uuid,'$AREA'::uuid,'Cancellation Test','9000000003','Cancellation Test Address','700046',true);

INSERT INTO public.carts(id,customer_id,status)
VALUES ('$CART'::uuid,'$CUSTOMER'::uuid,'active');

INSERT INTO public.cart_items(cart_id,product_variant_id,vendor_id,milk_type,quantity,unit_price_paise)
VALUES ('$CART'::uuid,'$VARIANT',NULL,NULL,1,17900);

UPDATE public.inventory SET available_stock=1,reserved_stock=0,safety_stock=0
 WHERE product_variant_id='$VARIANT' AND service_area_id='$AREA'::uuid;
SQL

DELIVERY_DATE="$(psql "$DB_URL" -Atqc "SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date + 1)::text")"
ORDER_ID="$(psql "$DB_URL" -X -q -t -A -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub','$CUSTOMER',true);
SET LOCAL ROLE authenticated;
SELECT order_id FROM public.create_cod_order('$ADDRESS'::uuid,'$SLOT'::uuid,'$DELIVERY_DATE'::date,'$KEY'::uuid,NULL);
COMMIT;
SQL
)"
ORDER_ID="$(printf '%s\n' "$ORDER_ID" | grep -Eo '[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}' | tail -n 1)"
if [[ -z "$ORDER_ID" ]]; then
  echo "Could not create the COD fixture order"
  exit 1
fi

cancel_order() {
  psql "$DB_URL" -X -q -t -A -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub','$CUSTOMER',true);
SET LOCAL ROLE authenticated;
SELECT pg_sleep(0.2);
SELECT order_id::text || ':' || was_already_cancelled::text
FROM public.cancel_customer_cod_order('$ORDER_ID'::uuid);
COMMIT;
SQL
}

cancel_order > /tmp/phase444-cancel-a.log 2>&1 &
pid_a=$!
cancel_order > /tmp/phase444-cancel-b.log 2>&1 &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
DO \$assertions\$
DECLARE
  order_status text;
  reserved integer;
  available integer;
  reservation_count integer;
  release_count integer;
  history_count integer;
  payment_status text;
BEGIN
  SELECT status::text INTO order_status FROM public.orders WHERE id='$ORDER_ID'::uuid;
  SELECT reserved_stock,available_stock INTO reserved,available FROM public.inventory
   WHERE product_variant_id='$VARIANT' AND service_area_id='$AREA'::uuid;
  SELECT count(*) INTO reservation_count FROM public.inventory_movements
   WHERE reference_id='$ORDER_ID' AND movement_type='order_reservation';
  SELECT count(*) INTO release_count FROM public.inventory_movements
   WHERE reference_id='$ORDER_ID' AND movement_type='order_reservation_release';
  SELECT count(*) INTO history_count FROM public.order_status_history
   WHERE order_id='$ORDER_ID'::uuid AND to_status='cancelled';
  SELECT status::text INTO payment_status FROM public.payments WHERE order_id='$ORDER_ID'::uuid;

  IF order_status<>'cancelled' OR reserved<>0 OR available<>1
     OR reservation_count<>1 OR release_count<>1 OR history_count<>1
     OR payment_status<>'pending' THEN
    RAISE EXCEPTION 'Cancellation atomicity failed: status %, reserved %, available %, reserve moves %, release moves %, history %, payment %',
      order_status,reserved,available,reservation_count,release_count,history_count,payment_status;
  END IF;
END
\$assertions\$;
SQL

echo "PASS: concurrent cancellation requests both completed without double release"
echo "PASS: order status and one cancellation history record committed atomically"
echo "PASS: one inverse reservation movement was recorded; reserved stock returned to zero"
echo "PASS: available stock was unchanged and pending COD payment remained pending"
