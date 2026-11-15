-- Phase 4.4.6.5 Stage A: execute the real COD order RPC against milk SKU fixtures.
-- All synthetic users, orders, movements and stock changes are rolled back.
BEGIN;
SELECT extensions.plan(14);

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES
 ('f1111111-1111-4111-8111-111111111111','authenticated','authenticated',
  'phase4465-sku-runtime@test.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('f2222222-2222-4222-8222-222222222222','authenticated','authenticated',
  'phase4465-sku-shortage@test.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);

INSERT INTO public.customer_addresses
 (id,customer_id,service_area_id,address_type,recipient_name,phone,address_line1,city,state,pincode,is_default)
VALUES
 ('f1111111-0000-4000-8000-000000000001','f1111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000001','home','SKU Runtime Customer','9000000111',
  '11 SKU Test Road','Kolkata','West Bengal','700046',true),
 ('f2222222-0000-4000-8000-000000000001','f2222222-2222-4222-8222-222222222222',
  '00000000-0000-0000-0000-000000000001','home','SKU Shortage Customer','9000000222',
  '22 SKU Test Road','Kolkata','West Bengal','700046',true);

INSERT INTO public.carts(id,customer_id,status)
VALUES
 ('f1111111-0000-4000-8000-000000000010','f1111111-1111-4111-8111-111111111111','active'),
 ('f2222222-0000-4000-8000-000000000010','f2222222-2222-4222-8222-222222222222','active');

-- Exact stock equals the first order's required quantities:
-- 500 ml SKU: 2 x 500 ml + 2 x 500 ml remainder from the 1.5 L line = 4.
-- 1 L SKU: 2 x 1 L + 2 x 1 L whole packs from the 1.5 L line = 4.
INSERT INTO public.inventory(product_variant_id,service_area_id,available_stock,reserved_stock,safety_stock)
VALUES
 ('milk-cow-500ml','00000000-0000-0000-0000-000000000001',4,0,0),
 ('milk-cow-1l','00000000-0000-0000-0000-000000000001',4,0,0)
ON CONFLICT (product_variant_id,service_area_id)
DO UPDATE SET available_stock=EXCLUDED.available_stock,
              reserved_stock=0,
              safety_stock=0,
              updated_at=pg_catalog.now();

-- Derive each fixture's unit price from the authoritative current vendor-price rows.
-- This keeps the runtime test coupled to the same CSV pricing contract as checkout.
WITH fixture_lines(cart_id, product_variant_id, quantity, quantity_litres) AS (
 VALUES
  ('f1111111-0000-4000-8000-000000000010'::uuid,'milk-cow-500ml'::text,2,0.5::numeric),
  ('f1111111-0000-4000-8000-000000000010'::uuid,'milk-cow-1l'::text,2,1.0::numeric),
  ('f1111111-0000-4000-8000-000000000010'::uuid,'milk-cow-1l'::text,2,1.5::numeric),
  ('f2222222-0000-4000-8000-000000000010'::uuid,'milk-cow-500ml'::text,1,0.5::numeric)
)
INSERT INTO public.cart_items
 (cart_id,product_variant_id,vendor_id,milk_type,quantity,unit_price_paise,quantity_litres)
SELECT
 f.cart_id,
 f.product_variant_id,
 'healthy-haryana',
 'cow',
 f.quantity,
 CASE
   WHEN f.quantity_litres = 0.5 THEN half_price.total_customer_delivery_paise
   ELSE pg_catalog.floor(f.quantity_litres)::integer * one_price.price_per_delivery_paise
     + CASE WHEN f.quantity_litres - pg_catalog.floor(f.quantity_litres) = 0.5
         THEN half_price.price_per_delivery_paise ELSE 0 END
     + one_price.delivery_fee_paise
 END,
 f.quantity_litres
FROM fixture_lines f
JOIN public.vendor_prices half_price
  ON half_price.vendor_id='healthy-haryana'
 AND half_price.product_variant_id='milk-cow-500ml'
 AND half_price.milk_type='cow'
 AND half_price.is_current AND half_price.effective_to IS NULL
 AND half_price.effective_from <= pg_catalog.now()
JOIN public.vendor_prices one_price
  ON one_price.vendor_id='healthy-haryana'
 AND one_price.product_variant_id='milk-cow-1l'
 AND one_price.milk_type='cow'
 AND one_price.is_current AND one_price.effective_to IS NULL
 AND one_price.effective_from <= pg_catalog.now();

CREATE TEMP TABLE phase4465_sku_order (
  order_id uuid, order_number varchar, total_paise integer, was_replayed boolean
);
GRANT INSERT, SELECT ON phase4465_sku_order TO authenticated;

SELECT set_config('request.jwt.claim.sub','f1111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claims',
 '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO phase4465_sku_order
SELECT * FROM public.create_cod_order(
 'f1111111-0000-4000-8000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000011'::uuid,
 (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date + 1,
 'f1111111-0000-4000-8000-000000000020'::uuid,
 NULL
);
RESET ROLE;

SELECT extensions.is(
 (SELECT total_paise FROM phase4465_sku_order),
 (SELECT pg_catalog.sum(ci.unit_price_paise * ci.quantity)::integer
  FROM public.cart_items ci WHERE ci.cart_id='f1111111-0000-4000-8000-000000000010'),
 'real COD RPC accepts the mixed 500 ml, 1 L and 1.5 L milk cart at authoritative pricing'
);
SELECT extensions.is(
 (SELECT count(*)::integer FROM public.order_items oi
  JOIN phase4465_sku_order o ON o.order_id=oi.order_id
  WHERE oi.product_variant_id='milk-cow-500ml' AND oi.quantity=2 AND oi.quantity_litres=0.5),
 1, '500 ml order line preserves its selected variant and quantity'
);
SELECT extensions.is(
 (SELECT count(*)::integer FROM public.order_items oi
  JOIN phase4465_sku_order o ON o.order_id=oi.order_id
  WHERE oi.product_variant_id='milk-cow-1l' AND oi.quantity=2 AND oi.quantity_litres=1.0),
 1, '1 L order line preserves its selected variant and quantity'
);
SELECT extensions.is(
 (SELECT count(*)::integer FROM public.order_items oi
  JOIN phase4465_sku_order o ON o.order_id=oi.order_id
  WHERE oi.product_variant_id='milk-cow-1l' AND oi.quantity=2 AND oi.quantity_litres=1.5),
 1, '1.5 L order line retains the selected 1 L variant and total delivery volume'
);
SELECT extensions.is(
 (SELECT reserved_stock FROM public.inventory
  WHERE product_variant_id='milk-cow-500ml' AND service_area_id='00000000-0000-0000-0000-000000000001'),
 4, 'real RPC reserves four 500 ml SKUs, without converting them into 1 L stock'
);
SELECT extensions.is(
 (SELECT reserved_stock FROM public.inventory
  WHERE product_variant_id='milk-cow-1l' AND service_area_id='00000000-0000-0000-0000-000000000001'),
 4, 'real RPC reserves four 1 L SKUs, including 1.5 L whole-litre components'
);
SELECT extensions.is(
 (SELECT count(*)::integer FROM public.inventory_movements im
  JOIN phase4465_sku_order o ON im.reference_id=o.order_id::text
  WHERE im.movement_type='order_reservation' AND im.change_amount=4
    AND im.inventory_id IN (
      SELECT id FROM public.inventory
      WHERE product_variant_id IN ('milk-cow-500ml','milk-cow-1l')
        AND service_area_id='00000000-0000-0000-0000-000000000001'
    )),
 2, 'ledger records one four-pack reservation movement for each exact milk SKU'
);
SELECT extensions.is(
 (SELECT count(*)::integer FROM public.payments p
  JOIN phase4465_sku_order o ON o.order_id=p.order_id
  WHERE p.gateway='cod' AND p.method='cod' AND p.status='pending'
    AND p.amount_paise=(SELECT total_paise FROM phase4465_sku_order)),
 1, 'successful order creates exactly one pending COD payment'
);
SELECT extensions.is(
 (SELECT status FROM public.carts WHERE id='f1111111-0000-4000-8000-000000000010'),
 'converted', 'successful RPC converts the customer cart atomically'
);
SELECT extensions.is(
 (SELECT available_stock FROM public.inventory
  WHERE product_variant_id='milk-cow-500ml' AND service_area_id='00000000-0000-0000-0000-000000000001'),
 4, 'reservation does not prematurely decrement physical available stock'
);
SELECT extensions.is(
 (SELECT count(*)::integer FROM public.orders o
  JOIN phase4465_sku_order t ON t.order_id=o.id
  WHERE o.payment_status='pending' AND o.payment_method='cod'),
 1, 'created order remains COD pending'
);

-- The production RPC creates ON COMMIT DROP temp tables. The first call above
-- runs inside this pgTAP file's outer transaction, so explicitly emulate the
-- transaction boundary between two independent PostgREST RPC requests.
DROP TABLE IF EXISTS pg_temp.dby_required_stock;
DROP TABLE IF EXISTS pg_temp.dby_checkout_lines;

SELECT set_config('request.jwt.claim.sub','f2222222-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claims',
 '{"sub":"f2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok(
 $$SELECT * FROM public.create_cod_order(
   'f2222222-0000-4000-8000-000000000001'::uuid,
   '00000000-0000-0000-0000-000000000011'::uuid,
   (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date + 1,
   'f2222222-0000-4000-8000-000000000020'::uuid,
   NULL
 )$$,
 '23514', NULL, 'real COD RPC rejects a second customer when the exact 500 ml SKU is exhausted'
);
RESET ROLE;

SELECT extensions.is(
 (SELECT count(*)::integer FROM public.orders WHERE customer_id='f2222222-2222-4222-8222-222222222222'),
 0, 'insufficient SKU stock rolls back order creation'
);
SELECT extensions.is(
 (SELECT count(*)::integer FROM public.inventory_movements
  WHERE reference_id IN (SELECT id::text FROM public.orders WHERE customer_id='f2222222-2222-4222-8222-222222222222')),
 0, 'insufficient SKU stock creates no reservation ledger movement'
);

SELECT * FROM extensions.finish();
ROLLBACK;
