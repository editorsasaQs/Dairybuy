#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
ADDR_A="aaaaaaaa-0000-4000-8000-000000000001"
ADDR_B="bbbbbbbb-0000-4000-8000-000000000001"
CART_A="aaaaaaaa-0000-4000-8000-000000000010"
CART_B="bbbbbbbb-0000-4000-8000-000000000010"
KEY_A="aaaaaaaa-0000-4000-8000-000000000020"
KEY_B="bbbbbbbb-0000-4000-8000-000000000020"
SLOT="00000000-0000-0000-0000-000000000011"
AREA="00000000-0000-0000-0000-000000000001"
VARIANT="ghee-red-cow-200ml"

cleanup() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL >/dev/null 2>&1 || true
DELETE FROM public.orders WHERE customer_id IN ('$A'::uuid, '$B'::uuid);
DELETE FROM public.carts WHERE customer_id IN ('$A'::uuid, '$B'::uuid);
DELETE FROM public.customer_addresses WHERE customer_id IN ('$A'::uuid, '$B'::uuid);
DELETE FROM auth.users WHERE id IN ('$A'::uuid, '$B'::uuid);
UPDATE public.inventory SET available_stock=0, reserved_stock=0, safety_stock=0
 WHERE product_variant_id='$VARIANT' AND service_area_id='$AREA'::uuid;
SQL
}
trap cleanup EXIT

# Seed two real auth identities and separate carts. The only available pack is
# intentionally shared so the actual order RPCs race on the same inventory row.
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES
 ('$A'::uuid,'authenticated','authenticated','phase442-race-a@test.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"RPC Race A"}'::jsonb),
 ('$B'::uuid,'authenticated','authenticated','phase442-race-b@test.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"RPC Race B"}'::jsonb);

INSERT INTO public.customer_addresses
 (id,customer_id,service_area_id,recipient_name,phone,address_line1,pincode,is_default)
VALUES
 ('$ADDR_A'::uuid,'$A'::uuid,'$AREA'::uuid,'RPC Race A','9000000001','RPC Race Address A','700046',true),
 ('$ADDR_B'::uuid,'$B'::uuid,'$AREA'::uuid,'RPC Race B','9000000002','RPC Race Address B','700046',true);

INSERT INTO public.carts(id,customer_id,status)
VALUES ('$CART_A'::uuid,'$A'::uuid,'active'),('$CART_B'::uuid,'$B'::uuid,'active');

INSERT INTO public.cart_items(cart_id,product_variant_id,vendor_id,milk_type,quantity,unit_price_paise)
VALUES ('$CART_A'::uuid,'$VARIANT',NULL,NULL,1,17900),
       ('$CART_B'::uuid,'$VARIANT',NULL,NULL,1,17900);

UPDATE public.inventory
SET available_stock=1,reserved_stock=0,safety_stock=0
WHERE product_variant_id='$VARIANT' AND service_area_id='$AREA'::uuid;

DO \$assert_seed\$
BEGIN
 IF (SELECT count(*) FROM public.inventory
     WHERE product_variant_id='ghee-red-cow-200ml'
       AND service_area_id='00000000-0000-0000-0000-000000000001'
       AND available_stock=1 AND reserved_stock=0) <> 1 THEN
   RAISE EXCEPTION 'Expected exactly one seeded test inventory row';
 END IF;
END
\$assert_seed\$;
SQL

delivery_date="$(psql "$DB_URL" -Atqc "SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date + 1)::text")"

place_order() {
  local user_id="$1"
  local address_id="$2"
  local key="$3"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -At <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub','$user_id',true);
SET LOCAL ROLE authenticated;
SELECT pg_sleep(0.2);
SELECT order_id::text
FROM public.create_cod_order(
 '$address_id'::uuid,
 '$SLOT'::uuid,
 '$delivery_date'::date,
 '$key'::uuid,
 NULL
);
COMMIT;
SQL
}

set +e
place_order "$A" "$ADDR_A" "$KEY_A" > /tmp/phase442-rpc-a.log 2>&1 &
pid_a=$!
place_order "$B" "$ADDR_B" "$KEY_B" > /tmp/phase442-rpc-b.log 2>&1 &
pid_b=$!
wait "$pid_a"; result_a=$?
wait "$pid_b"; result_b=$?
set -e

successes=0
[[ "$result_a" -eq 0 ]] && successes=$((successes + 1))
[[ "$result_b" -eq 0 ]] && successes=$((successes + 1))
if [[ "$successes" -ne 1 ]]; then
  echo "Expected exactly one successful create_cod_order RPC; got $successes"
  cat /tmp/phase442-rpc-a.log /tmp/phase442-rpc-b.log
  exit 1
fi

# A real RPC retry from the winning authenticated customer must replay the
# same order even though its cart is already converted.
if [[ "$result_a" -eq 0 ]]; then
  winner="$A"; winner_address="$ADDR_A"; winner_key="$KEY_A"
  winner_log="/tmp/phase442-rpc-a.log"
else
  winner="$B"; winner_address="$ADDR_B"; winner_key="$KEY_B"
  winner_log="/tmp/phase442-rpc-b.log"
fi
original_order="$(grep -Eo '[0-9a-f]{8}-[0-9a-f-]{27,}' "$winner_log" | tail -n 1)"
if [[ -z "$original_order" ]]; then
  echo "Could not extract successful order UUID"
  cat "$winner_log"
  exit 1
fi

retry_output="$(psql "$DB_URL" -X -q -t -A -v ON_ERROR_STOP=1 -c "
BEGIN;
SELECT set_config('request.jwt.claim.sub','$winner',true);
SET LOCAL ROLE authenticated;
SELECT order_id::text || ':' || was_replayed::text
FROM public.create_cod_order('$winner_address'::uuid,'$SLOT'::uuid,'$delivery_date'::date,'$winner_key'::uuid,NULL);
COMMIT;
")"
retry_order="$(printf '%s\n' "$retry_output" | grep -E '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}:true$' | tail -n 1 || true)"

if [[ "$retry_order" != "$original_order:true" ]]; then
  echo "Idempotent RPC retry did not replay the original order: $retry_order"
  exit 1
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
DO \$assertions\$
DECLARE
  order_count integer;
  item_count integer;
  payment_count integer;
  movement_count integer;
  snapshot_count integer;
  converted_count integer;
  active_count integer;
  reserved integer;
BEGIN
  SELECT count(*) INTO order_count FROM public.orders
   WHERE customer_id IN ('$A'::uuid,'$B'::uuid) AND idempotency_key IN ('$KEY_A'::uuid,'$KEY_B'::uuid);
  SELECT count(*) INTO item_count FROM public.order_items oi JOIN public.orders o ON o.id=oi.order_id
   WHERE o.customer_id IN ('$A'::uuid,'$B'::uuid);
  SELECT count(*) INTO payment_count FROM public.payments p JOIN public.orders o ON o.id=p.order_id
   WHERE o.customer_id IN ('$A'::uuid,'$B'::uuid) AND p.gateway='cod' AND p.method='cod' AND p.status='pending';
  SELECT count(*) INTO movement_count FROM public.inventory_movements
   WHERE reference_id IN (SELECT id::text FROM public.orders WHERE customer_id IN ('$A'::uuid,'$B'::uuid));
  SELECT count(*) INTO snapshot_count FROM public.orders
   WHERE customer_id IN ('$A'::uuid,'$B'::uuid)
     AND delivery_address_snapshot_source='checkout'
     AND delivery_address_snapshot->>'schema_version'='1'
     AND delivery_address_snapshot->>'recipient_name' IN ('RPC Race A','RPC Race B');
  SELECT count(*) INTO converted_count FROM public.carts
   WHERE customer_id IN ('$A'::uuid,'$B'::uuid) AND status='converted';
  SELECT count(*) INTO active_count FROM public.carts
   WHERE customer_id IN ('$A'::uuid,'$B'::uuid) AND status='active';
  SELECT reserved_stock INTO reserved FROM public.inventory
   WHERE product_variant_id='$VARIANT' AND service_area_id='$AREA'::uuid;

  IF order_count<>1 OR item_count<>1 OR payment_count<>1 OR movement_count<>1 OR snapshot_count<>1
     OR converted_count<>1 OR active_count<>1 OR reserved<>1 THEN
    RAISE EXCEPTION 'RPC race atomicity failed: orders %, items %, payments %, movements %, snapshots %, converted %, active %, reserved %',
      order_count,item_count,payment_count,movement_count,snapshot_count,converted_count,active_count,reserved;
  END IF;
END
\$assertions\$;
SQL

echo "PASS: two independent authenticated create_cod_order RPCs raced against one final pack"
echo "PASS: exactly one order committed; losing RPC rolled back"
echo "PASS: order item, pending COD payment, inventory movement, checkout address snapshot and cart conversion are atomic"
echo "PASS: same-customer idempotent retry returned the original order without duplicates"
