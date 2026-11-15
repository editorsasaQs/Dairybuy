-- Dairybuy authentication provisioning + two-customer RLS isolation tests.
-- Synthetic auth.users rows and all fixtures are rolled back at the end.
-- Run with: supabase test db

begin;
select extensions.plan(22);

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','rls-customer-a@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"RLS Customer A"}'::jsonb),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','rls-customer-b@test.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"RLS Customer B"}'::jsonb);

select extensions.ok(exists(select 1 from auth.users where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'synthetic signup user A inserted');
select extensions.ok(exists(select 1 from public.profiles where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'signup trigger creates profile A');
select extensions.ok(exists(select 1 from public.user_roles where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role='customer'),'signup trigger grants customer role A');
select extensions.ok(exists(select 1 from public.profiles where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'signup trigger creates profile B');
select extensions.ok(exists(select 1 from public.user_roles where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and role='customer'),'signup trigger grants customer role B');

insert into public.customer_addresses (id,customer_id,service_area_id,recipient_name,phone,address_line1,pincode,is_default)
values
('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000001','Customer A','9000000001','Test Address A','700046',true),
('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','00000000-0000-0000-0000-000000000001','Customer B','9000000002','Test Address B','700046',true);

insert into public.orders (id,order_number,customer_id,customer_address_id,service_area_id,delivery_slot_id,subtotal_paise,delivery_fee_paise,total_paise)
values
('aaaaaaaa-0000-4000-8000-000000000002','RLS-TEST-A','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011',10000,400,10400),
('bbbbbbbb-0000-4000-8000-000000000002','RLS-TEST-B','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011',12000,400,12400);

insert into public.order_items (order_id,product_variant_id,quantity,unit_price_paise,total_price_paise)
values
('aaaaaaaa-0000-4000-8000-000000000002','milk-cow-500ml',1,10000,10000),
('bbbbbbbb-0000-4000-8000-000000000002','milk-cow-500ml',1,12000,12000);

insert into public.payments (order_id,amount_paise,gateway,status,method)
values
('aaaaaaaa-0000-4000-8000-000000000002',10400,'test','pending','test'),
('bbbbbbbb-0000-4000-8000-000000000002',12400,'test','pending','test');

-- Customer A JWT session.
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',true);
set local role authenticated;

select extensions.ok(auth.uid()='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,'JWT session resolves customer A');
select extensions.is((select count(*)::int from public.profiles where id=auth.uid()),1,'A can read own profile');
select extensions.is((select count(*)::int from public.profiles where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),0,'A cannot read B profile');
select extensions.is((select count(*)::int from public.customer_addresses),1,'A sees only own address');
select extensions.is((select count(*)::int from public.orders),1,'A sees only own order');
select extensions.is((select count(*)::int from public.order_items),1,'A sees only own order item');
select extensions.is((select count(*)::int from public.payments),1,'A sees only own payment');

-- Switch JWT identity to customer B in the same transaction.
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}',true);

select extensions.ok(auth.uid()='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,'JWT session resolves customer B');
select extensions.is((select count(*)::int from public.profiles where id=auth.uid()),1,'B can read own profile');
select extensions.is((select count(*)::int from public.profiles where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'B cannot read A profile');
select extensions.is((select count(*)::int from public.customer_addresses),1,'B sees only own address');
select extensions.is((select count(*)::int from public.orders),1,'B sees only own order');
select extensions.is((select count(*)::int from public.order_items),1,'B sees only own order item');
select extensions.is((select count(*)::int from public.payments),1,'B sees only own payment');
select extensions.ok(not public.is_staff(),'customer B is not staff');
select extensions.ok(not public.is_admin_or_owner(),'customer B is not admin or owner');
select extensions.is((select count(*)::int from public.user_roles where user_id=auth.uid()),1,'B sees only own customer role');

reset role;
select * from extensions.finish();
rollback;
