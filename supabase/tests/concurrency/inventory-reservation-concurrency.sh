#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:55432/postgres}"
TEST_TABLE="public.phase442_inventory_concurrency_test"

cleanup() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS $TEST_TABLE" >/dev/null 2>&1 || true
}
trap cleanup EXIT

psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP TABLE IF EXISTS public.phase442_inventory_concurrency_test;
CREATE TABLE public.phase442_inventory_concurrency_test (
  id integer PRIMARY KEY,
  available_stock integer NOT NULL,
  reserved_stock integer NOT NULL DEFAULT 0,
  safety_stock integer NOT NULL DEFAULT 0
);
INSERT INTO public.phase442_inventory_concurrency_test(id, available_stock)
VALUES (1, 10), (2, 10), (3, 1);
SQL

# Two transactions request the same pair in opposite logical/cart order.
# The production strategy sorts by inventory.id before FOR UPDATE, so both
# transactions acquire row locks in the same order and must finish without deadlock.
reserve_pair() {
  local requested_ids="$1"
  psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SELECT pg_sleep(0.15);
SELECT id
FROM public.phase442_inventory_concurrency_test
WHERE id IN ($requested_ids)
ORDER BY id
FOR UPDATE;
UPDATE public.phase442_inventory_concurrency_test
SET reserved_stock = reserved_stock + 1
WHERE id IN (1, 2);
COMMIT;
SQL
}

reserve_pair "1,2" > /tmp/phase442-lock-a.log 2>&1 &
pid_a=$!
reserve_pair "2,1" > /tmp/phase442-lock-b.log 2>&1 &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

pair_reserved=$(psql "$DB_URL" -Atqc "SELECT sum(reserved_stock) FROM $TEST_TABLE WHERE id IN (1,2)")
if [[ "$pair_reserved" != "4" ]]; then
  echo "Expected both pair transactions to reserve 2 packs each; got $pair_reserved"
  cat /tmp/phase442-lock-a.log /tmp/phase442-lock-b.log
  exit 1
fi

# Two independent customers race for the final single pack. Exactly one
# transaction may reserve it; the loser must fail after waiting for the row lock.
reserve_last_pack() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SELECT pg_sleep(0.15);
SELECT id
FROM public.phase442_inventory_concurrency_test
WHERE id = 3
FOR UPDATE;
DO $reserve$
DECLARE affected integer;
BEGIN
  UPDATE public.phase442_inventory_concurrency_test
  SET reserved_stock = reserved_stock + 1
  WHERE id = 3
    AND available_stock - reserved_stock - safety_stock >= 1;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'insufficient stock: concurrent reservation must fail closed';
  END IF;
END
$reserve$;
COMMIT;
SQL
}

set +e
reserve_last_pack > /tmp/phase442-oversell-a.log 2>&1 &
pid_a=$!
reserve_last_pack > /tmp/phase442-oversell-b.log 2>&1 &
pid_b=$!
wait "$pid_a"; result_a=$?
wait "$pid_b"; result_b=$?
set -e

successes=0
[[ "$result_a" -eq 0 ]] && successes=$((successes + 1))
[[ "$result_b" -eq 0 ]] && successes=$((successes + 1))
final_reserved=$(psql "$DB_URL" -Atqc "SELECT reserved_stock FROM $TEST_TABLE WHERE id = 3")

if [[ "$successes" -ne 1 || "$final_reserved" != "1" ]]; then
  echo "Oversell guard failed: successes=$successes reserved=$final_reserved"
  cat /tmp/phase442-oversell-a.log /tmp/phase442-oversell-b.log
  exit 1
fi

echo "PASS: opposite cart ordering completed without deadlock"
echo "PASS: concurrent final-pack race allowed exactly one reservation"
echo "PASS: reserved stock never exceeded available stock"
