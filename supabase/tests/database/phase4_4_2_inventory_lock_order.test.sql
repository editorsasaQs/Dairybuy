-- Phase 4.4.2 inventory lock-order regression.
-- Structural assertions for the production RPC; the shell harness separately
-- exercises concurrent PostgreSQL sessions against the same row-lock strategy.
BEGIN;
SELECT extensions.plan(8);

SELECT extensions.ok(
  to_regprocedure('private.create_cod_order(uuid,uuid,date,uuid,text)') IS NOT NULL,
  'private COD order implementation exists'
);
SELECT extensions.ok(
  to_regprocedure('public.create_cod_order(uuid,uuid,date,uuid,text)') IS NOT NULL,
  'authenticated PostgREST wrapper exists'
);

SELECT extensions.ok(
  position('dby_required_stock' IN pg_get_functiondef(
    'private.create_cod_order(uuid,uuid,date,uuid,text)'::regprocedure
  )) > 0,
  'RPC aggregates inventory requirements before reservation'
);
SELECT extensions.ok(
  position('ORDER BY i.id' IN pg_get_functiondef(
    'private.create_cod_order(uuid,uuid,date,uuid,text)'::regprocedure
  )) > 0
  AND position('FOR UPDATE OF i' IN pg_get_functiondef(
    'private.create_cod_order(uuid,uuid,date,uuid,text)'::regprocedure
  )) > 0,
  'RPC locks inventory rows in deterministic inventory.id order'
);
SELECT extensions.ok(
  position('v_lines <> (SELECT count(*) FROM pg_temp.dby_required_stock)' IN
    pg_get_functiondef('private.create_cod_order(uuid,uuid,date,uuid,text)'::regprocedure)) > 0,
  'RPC fails closed when any required inventory row is missing'
);
SELECT extensions.ok(
  NOT has_function_privilege('anon','public.create_cod_order(uuid,uuid,date,uuid,text)','EXECUTE')
  AND has_function_privilege('authenticated','public.create_cod_order(uuid,uuid,date,uuid,text)','EXECUTE')
  AND NOT has_function_privilege('authenticated','private.create_cod_order(uuid,uuid,date,uuid,text)','EXECUTE'),
  'only authenticated users can execute public wrapper, private implementation stays inaccessible'
);

-- Phase 4.4.6.4: SKU-accurate reservation regression.
SELECT extensions.ok(
  position('pg_catalog.floor(l.litres)::integer * l.quantity' IN pg_get_functiondef(
    'private.create_cod_order(uuid,uuid,date,uuid,text)'::regprocedure
  )) > 0,
  'each whole-litre pack is reserved against the selected 1 L SKU per cart line'
);
SELECT extensions.ok(
  position('l.half_variant_id, l.quantity AS pack_count' IN pg_get_functiondef(
    'private.create_cod_order(uuid,uuid,date,uuid,text)'::regprocedure
  )) > 0
  AND position('pg_catalog.floor(l.litres * l.quantity)' IN pg_get_functiondef(
    'private.create_cod_order(uuid,uuid,date,uuid,text)'::regprocedure
  )) = 0,
  '500 ml remainder packs retain the selected 500 ml SKU and quantity'
);

SELECT * FROM extensions.finish();
ROLLBACK;

-- Phase 4.4.6.4: SKU-accurate reservation regression.
SELECT extensions.ok(
  position('pg_catalog.floor(l.litres)::integer * l.quantity' IN pg_get_functiondef(
    'private.create_cod_order(uuid,uuid,date,uuid,text)'::regprocedure
  )) > 0,
  'each whole-litre pack is reserved against the selected 1 L SKU per cart line'
);
SELECT extensions.ok(
  position('l.half_variant_id, l.quantity AS pack_count' IN pg_get_functiondef(
    'private.create_cod_order(uuid,uuid,date,uuid,text)'::regprocedure
  )) > 0
  AND position('pg_catalog.floor(l.litres * l.quantity)' IN pg_get_functiondef(
    'private.create_cod_order(uuid,uuid,date,uuid,text)'::regprocedure
  )) = 0,
  '500 ml remainder packs retain the selected 500 ml SKU and quantity'
);

