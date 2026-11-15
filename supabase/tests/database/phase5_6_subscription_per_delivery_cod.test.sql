-- Phase 5.6 subscription COD: payment is collected per delivery, never prepaid as a plan.
BEGIN;
SELECT extensions.plan(14);

SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass
    AND conname='chk_order_subscription_link'
    AND pg_get_constraintdef(oid) LIKE '%payment_method%'
    AND pg_get_constraintdef(oid) LIKE '%cod%'
    AND pg_get_constraintdef(oid) LIKE '%pending%'),
  'subscription order contract permits pending COD deliveries while retaining the one-time branch'
);
SELECT extensions.ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.payments'::regclass
    AND conname='chk_subscription_payment_cod_or_online'
    AND pg_get_constraintdef(oid) LIKE '%gateway%'
    AND pg_get_constraintdef(oid) LIKE '%method%'
    AND pg_get_constraintdef(oid) LIKE '%cod%'),
  'subscription plan payment marker accepts COD and keeps gateway method validation'
);
SELECT extensions.ok(
  strpos(pg_get_functiondef('private.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)'::regprocedure),
    '''active'',p_start_date')>0
  AND strpos(pg_get_functiondef('private.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)'::regprocedure),
    '''cod'',''pending'',''cod''')>0
  AND strpos(pg_get_functiondef('private.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)'::regprocedure),
    'pending_online')=0,
  'authenticated checkout activates COD plan without fabricating online payment intent'
);
SELECT extensions.ok(
  strpos(pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure),
    'payment_verified_at IS NOT NULL')=0
  AND strpos(pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure),
    'gateway_payment_id IS NOT NULL')=0
  AND strpos(pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure),
    'p.status=''captured''')=0,
  'daily generator no longer depends on captured online plan payment'
);
SELECT extensions.ok(
  strpos(pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure),
    'INSERT INTO public.payments(order_id,amount_paise,currency,gateway,status,method)')>0
  AND strpos(pg_get_functiondef('private.generate_subscription_deliveries(date)'::regprocedure),
    '''cod'',''pending'',''cod''')>0,
  'each generated subscription delivery creates its own pending COD payment row'
);
SELECT extensions.ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
    FROM pg_proc WHERE oid='private.generate_subscription_deliveries(date)'::regprocedure)
  AND has_function_privilege('service_role','public.generate_subscription_deliveries(date)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.generate_subscription_deliveries(date)','EXECUTE'),
  'daily generation remains service-role-only with hardened SECURITY DEFINER context'
);
SELECT extensions.ok(
  strpos(pg_get_functiondef('private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure),
    'NOT IN (''one_time'',''subscription'')')>0
  AND strpos(pg_get_functiondef('private.record_cod_cash_collection(uuid,integer,text,text)'::regprocedure),
    'subscription_deliveries sd')>0,
  'cash collection supports assigned subscription deliveries without removing one-time assignment checks'
);
SELECT extensions.ok(
  strpos(pg_get_functiondef('private.review_cod_cash_collection(uuid,text,text)'::regprocedure),
    'NOT IN (''one_time'',''subscription'')')>0
  AND strpos(pg_get_functiondef('private.review_cod_cash_collection(uuid,text,text)'::regprocedure),
    'SET status = ''captured''')>0,
  'owner/admin review settles only the linked delivery payment after exact cash verification'
);
SELECT extensions.ok(
  strpos(pg_get_functiondef('private.resolve_cod_collection_discrepancy(uuid,integer,text,text)'::regprocedure),
    'NOT IN (''one_time'',''subscription'')')>0,
  'owner/admin discrepancy correction supports subscription COD delivery orders'
);
SELECT extensions.ok(
  strpos(pg_get_functiondef('private.submit_delivery_cash_handover(uuid[],integer,uuid)'::regprocedure),
    'NOT IN (''one_time'',''subscription'')')>0
  AND strpos(pg_get_functiondef('private.submit_delivery_cash_handover(uuid[],integer,uuid)'::regprocedure),
    'subscription_deliveries sd')>0,
  'staff cash handover accepts completed subscription deliveries assigned to that staff member'
);
SELECT extensions.ok(
  strpos(pg_get_functiondef('private.get_my_unhanded_cod_collections()'::regprocedure),
    'subscription_deliveries sd')>0
  AND strpos(pg_get_functiondef('private.get_my_unhanded_cod_collections()'::regprocedure),
    'order_type IN (''one_time'',''subscription'')')>0,
  'staff unhanded cash queue includes subscription COD collections'
);
SELECT extensions.ok(
  strpos(pg_get_functiondef('private.get_admin_cod_financial_report(date,date,uuid,uuid)'::regprocedure),
    'order_type IN (''one_time'',''subscription'')')>0,
  'owner/admin COD financial report includes subscription delivery collections'
);
SELECT extensions.ok(
  NOT has_table_privilege('authenticated','public.cod_collections','INSERT')
  AND NOT has_table_privilege('authenticated','public.cod_collections','UPDATE')
  AND NOT has_table_privilege('authenticated','public.payments','UPDATE'),
  'direct client writes remain revoked; COD operations use audited RPCs'
);

SELECT extensions.ok(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='subscriptions' AND column_name='cod_activated_at')
  AND strpos(pg_get_functiondef('private.create_subscription_payment_intent(uuid,uuid,date,public.subscription_plan_enum,jsonb,uuid)'::regprocedure),
    'cod_activated_at')>0
  AND strpos(pg_get_constraintdef((SELECT oid FROM pg_constraint
    WHERE conrelid='public.subscriptions'::regclass
      AND conname='chk_subscription_active_requires_verified_payment')),
    'cod_activated_at')>0,
  'active COD subscriptions carry a trusted COD activation timestamp distinct from online payment verification'
);

SELECT * FROM extensions.finish();
ROLLBACK;
