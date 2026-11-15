#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
CUSTOMER="e1111111-1111-4111-8111-111111111111"
ADMIN="e2222222-2222-4222-8222-222222222222"
ADDRESS="e1111111-0000-4000-8000-000000000001"
CART_A="e1111111-0000-4000-8000-000000000010"
CART_B="e1111111-0000-4000-8000-000000000011"
KEY_A="e1111111-0000-4000-8000-000000000020"
KEY_B="e1111111-0000-4000-8000-000000000021"
AREA="00000000-0000-0000-0000-000000000001"
SLOT="00000000-0000-0000-0000-000000000011"
VARIANT="ghee-red-cow-200ml"
ORDER_DELIVERY=""
ORDER_CANCEL_RACE=""

cleanup() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL >/dev/null 2>&1 || true
DELETE FROM public.order_status_history WHERE order_id IN (
 SELECT id FROM public.orders WHERE customer_id='$CUSTOMER'::uuid
);
DELETE FROM public.inventory_movements WHERE reference_id IN (
 SELECT id::text FROM public.orders WHERE customer_id='$CUSTOMER'::uuid
);
DELETE FROM public.payments WHERE order_id IN (
 SELECT id FROM public.orders WHERE customer_id='$CUSTOMER'::uuid
);
DELETE FROM public.order_items WHERE order_id IN (
 SELECT id FROM public.orders WHERE customer_id='$CUSTOMER'::uuid
);
DELETE FROM public.orders WHERE customer_id='$CUSTOMER'::uuid;
DELETE FROM public.carts WHERE customer_id='$CUSTOMER'::uuid;
DELETE FROM public.customer_addresses WHERE customer_id='$CUSTOMER'::uuid;
DELETE FROM auth.users WHERE id IN ('$CUSTOMER'::uuid,'$ADMIN'::uuid);
UPDATE public.inventory SET available_stock=0,reserved_stock=0,safety_stock=0
 WHERE product_variant_id='$VARIANT' AND service_area_id='$AREA'::uuid;
SQL
}
trap cleanup EXIT

psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO auth.users
 (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES
 ('$CUSTOMER'::uuid,'authenticated','authenticated','phase4465-lifecycle-customer@test.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Lifecycle Customer"}'::jsonb),
 ('$ADMIN'::uuid,'authenticated','authenticated','phase4465-lifecycle-admin@test.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Lifecycle Admin"}'::jsonb);

UPDATE public.user_roles SET role='admin' WHERE user_id='$ADMIN'::uuid;

INSERT INTO public.customer_addresses
 (id,customer_id,service_area_id,recipient_name,phone,address_line1,pincode,is_default)
VALUES
 ('$ADDRESS'::uuid,'$CUSTOMER'::uuid,'$AREA'::uuid,'Lifecycle Customer','9000000444',
  'Lifecycle Race Address','700046',true);

INSERT INTO public.carts(id,customer_id,status)
VALUES ('$CART_A'::uuid,'$CUSTOMER'::uuid,'active'),
       ('$CART_B'::uuid,'$CUSTOMER'::uuid,'active');

INSERT INTO public.cart_items(cart_id,product_variant_id,vendor_id,milk_type,quantity,unit_price_paise)
VALUES ('$CART_A'::uuid,'$VARIANT',NULL,NULL,1,17900),
       ('$CART_B'::uuid,'$VARIANT',NULL,NULL,1,17900);

UPDATE public.inventory SET available_stock=2,reserved_stock=0,safety_stock=0
 WHERE product_variant_id='$VARIANT' AND service_area_id='$AREA'::uuid;

DO \$assert_seed\$
BEGIN
 IF (SELECT count(*) FROM public.inventory
     WHERE product_variant_id='$VARIANT' AND service_area_id='$AREA'::uuid
       AND available_stock=2 AND reserved_stock=0) <> 1 THEN
   RAISE EXCEPTION 'Expected exactly one lifecycle test inventory row with two available packs';
 END IF;
END
\$assert_seed\$;
SQL

DELIVERY_DATE="$(psql "$DB_URL" -Atqc "SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date + 1)::text")"

create_order() {
  local key="$1"
  psql "$DB_URL" -X -q -t -A -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub','$CUSTOMER',true);
SET LOCAL ROLE authenticated;
SELECT order_id::text
FROM public.create_cod_order('$ADDRESS'::uuid,'$SLOT'::uuid,'$DELIVERY_DATE'::date,'$key'::uuid,NULL);
COMMIT;
SQL
}

ORDER_DELIVERY="$(create_order "$KEY_A" | grep -Eo '[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}' | tail -n 1)"
ORDER_CANCEL_RACE="$(create_order "$KEY_B" | grep -Eo '[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}' | tail -n 1)"
if [[ -z "$ORDER_DELIVERY" || -z "$ORDER_CANCEL_RACE" ]]; then
  echo "Could not create both lifecycle COD fixture orders"
  exit 1
fi

admin_transition() {
  local order_id="$1"
  local target="$2"
  psql "$DB_URL" -X -q -t -A -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub','$ADMIN',true);
SET LOCAL ROLE authenticated;
SELECT pg_sleep(0.2);
SELECT order_id::text || ':' || was_already_applied::text
FROM public.transition_one_time_cod_order('$order_id'::uuid,'$target'::public.order_status_enum,NULL);
COMMIT;
SQL
}

customer_transition() {
  local order_id="$1"
  local target="$2"
  psql "$DB_URL" -X -q -t -A -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub','$CUSTOMER',true);
SET LOCAL ROLE authenticated;
SELECT pg_sleep(0.2);
SELECT order_id::text || ':' || was_already_applied::text
FROM public.transition_one_time_cod_order('$order_id'::uuid,'$target'::public.order_status_enum,NULL);
COMMIT;
SQL
}

# Bring the first real order through the valid admin fulfillment path.
admin_transition "$ORDER_DELIVERY" confirmed >/dev/null
admin_transition "$ORDER_DELIVERY" processing >/dev/null
admin_transition "$ORDER_DELIVERY" out_for_delivery >/dev/null

# Race customer confirmation and admin fallback on the same out_for_delivery order.
customer_transition "$ORDER_DELIVERY" delivered > /tmp/phase4465-customer-delivery.log 2>&1 &
delivery_customer_pid=$!
admin_transition "$ORDER_DELIVERY" delivered > /tmp/phase4465-admin-delivery.log 2>&1 &
delivery_admin_pid=$!
wait "$delivery_customer_pid"
wait "$delivery_admin_pid"

# Race cancellation against the admin's processing -> out_for_delivery transition.
admin_transition "$ORDER_CANCEL_RACE" confirmed >/dev/null
admin_transition "$ORDER_CANCEL_RACE" processing >/dev/null

cancel_order() {
  psql "$DB_URL" -X -q -t -A -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub','$CUSTOMER',true);
SET LOCAL ROLE authenticated;
SELECT pg_sleep(0.2);
SELECT order_id::text || ':' || was_already_cancelled::text
FROM public.cancel_customer_cod_order('$ORDER_CANCEL_RACE'::uuid);
COMMIT;
SQL
}

set +e
cancel_order > /tmp/phase4465-cancel-race.log 2>&1 &
cancel_pid=$!
admin_transition "$ORDER_CANCEL_RACE" out_for_delivery > /tmp/phase4465-out-for-delivery-race.log 2>&1 &
out_for_delivery_pid=$!
wait "$cancel_pid"; cancel_result=$?
wait "$out_for_delivery_pid"; delivery_result=$?
set -e

if [[ "$cancel_result" -eq 0 && "$delivery_result" -eq 0 ]] || [[ "$cancel_result" -ne 0 && "$delivery_result" -ne 0 ]]; then
  echo "Expected exactly one winner for cancellation vs out_for_delivery; cancel=$cancel_result delivery=$delivery_result"
  cat /tmp/phase4465-cancel-race.log /tmp/phase4465-out-for-delivery-race.log
  exit 1
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
DO \$assertions\$
DECLARE
  delivered_status text;
  delivered_reserved integer;
  delivered_available integer;
  fulfilled_count integer;
  delivered_history_count integer;
  delivered_payment_status text;
  race_status text;
  race_reserved integer;
  race_available integer;
  release_count integer;
  cancelled_history_count integer;
  out_for_delivery_history_count integer;
BEGIN
  SELECT status::text INTO delivered_status FROM public.orders WHERE id='$ORDER_DELIVERY'::uuid;
  SELECT reserved_stock,available_stock INTO delivered_reserved,delivered_available
   FROM public.inventory WHERE product_variant_id='$VARIANT' AND service_area_id='$AREA'::uuid;
  SELECT count(*) INTO fulfilled_count FROM public.inventory_movements
   WHERE reference_id='$ORDER_DELIVERY' AND movement_type='order_fulfilled' AND change_amount=-1;
  SELECT count(*) INTO delivered_history_count FROM public.order_status_history
   WHERE order_id='$ORDER_DELIVERY'::uuid AND to_status='delivered';
  SELECT payment_status::text INTO delivered_payment_status FROM public.orders WHERE id='$ORDER_DELIVERY'::uuid;

  IF delivered_status<>'delivered' OR delivered_reserved<>1 OR delivered_available<>1
     OR fulfilled_count<>1 OR delivered_history_count<>1 OR delivered_payment_status<>'pending' THEN
    RAISE EXCEPTION 'Customer/admin delivery race failed: status %, reserved %, available %, fulfilled movements %, delivered history %, COD payment %',
      delivered_status,delivered_reserved,delivered_available,fulfilled_count,delivered_history_count,delivered_payment_status;
  END IF;

  SELECT status::text INTO race_status FROM public.orders WHERE id='$ORDER_CANCEL_RACE'::uuid;
  SELECT reserved_stock,available_stock INTO race_reserved,race_available
   FROM public.inventory WHERE product_variant_id='$VARIANT' AND service_area_id='$AREA'::uuid;
  SELECT count(*) INTO release_count FROM public.inventory_movements
   WHERE reference_id='$ORDER_CANCEL_RACE' AND movement_type='order_reservation_release';
  SELECT count(*) INTO cancelled_history_count FROM public.order_status_history
   WHERE order_id='$ORDER_CANCEL_RACE'::uuid AND to_status='cancelled';
  SELECT count(*) INTO out_for_delivery_history_count FROM public.order_status_history
   WHERE order_id='$ORDER_CANCEL_RACE'::uuid AND to_status='out_for_delivery';

  IF race_status='cancelled' THEN
    IF cancel_result_placeholder THEN NULL; END IF;
    IF race_reserved<>1 OR race_available<>1 OR release_count<>1
       OR cancelled_history_count<>1 OR out_for_delivery_history_count<>0 THEN
      RAISE EXCEPTION 'Cancellation won but ledger/state inconsistent: reserved %, available %, releases %, cancelled history %, out_for_delivery history %',
        race_reserved,race_available,release_count,cancelled_history_count,out_for_delivery_history_count;
    END IF;
  ELSIF race_status='out_for_delivery' THEN
    IF race_reserved<>2 OR race_available<>1 OR release_count<>0
       OR cancelled_history_count<>0 OR out_for_delivery_history_count<>1 THEN
      RAISE EXCEPTION 'Delivery dispatch won but ledger/state inconsistent: reserved %, available %, releases %, cancelled history %, out_for_delivery history %',
        race_reserved,race_available,release_count,cancelled_history_count,out_for_delivery_history_count;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unexpected final state for cancel/delivery race: %',race_status;
  END IF;
END
\$assertions\$;
SQL

echo "PASS: customer confirmation and admin delivery fallback raced on one order"
echo "PASS: exactly one fulfillment movement and delivered history event committed"
echo "PASS: COD payment remained pending; no duplicate stock settlement"
echo "PASS: cancellation and dispatch raced; order-row lock selected one valid winner"
echo "PASS: losing transition did not create duplicate history or inventory release"
