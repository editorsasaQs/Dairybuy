-- =============================================================================
-- DAIRYBUY - PHASE 4 SEED DATA MIGRATION (CORRECTED REVIEW COPY)
-- Migration: 20261031000001_phase4_seed.sql
-- Contains: Confirmed vendors, confirmed milk pricing, 16 CSV-confirmed non-milk variants,
--           canteen milk arrangement, delivery slots, Topsia service area.
-- All money amounts in integer paise (1 INR = 100 paise).
-- =============================================================================

BEGIN;

-- Static-review corrected copy. Original migration remains unchanged.
-- Stock is initialized to zero; only verified physical counts should be entered by operations.

-- 1. SERVICE AREA (Launch Area: Topsia, Kolkata)
INSERT INTO public.service_areas (id, code, name, city, state, is_active, description)
VALUES
('00000000-0000-0000-0000-000000000001','topsia-kolkata','Topsia, Kolkata','Kolkata','West Bengal',TRUE,'Dairybuy central launch area covering Topsia, Tiljala, and surrounding South Kolkata neighbourhoods.')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,is_active=EXCLUDED.is_active,description=EXCLUDED.description;

-- Service Area Pincodes for Topsia
INSERT INTO public.service_area_pincodes (service_area_id,pincode,is_active)
VALUES
('00000000-0000-0000-0000-000000000001','700046',TRUE),
('00000000-0000-0000-0000-000000000001','700039',TRUE),
('00000000-0000-0000-0000-000000000001','700100',TRUE),
('00000000-0000-0000-0000-000000000001','700105',TRUE)
ON CONFLICT (pincode) DO NOTHING;

-- 2. DELIVERY SLOTS
INSERT INTO public.delivery_slots (id,slot_code,label,start_time,end_time,order_cutoff_time,cancellation_deadline_time,is_active)
VALUES
('00000000-0000-0000-0000-000000000011','morning_slot','Morning (8 AM - 11 AM)','08:00:00','11:00:00','07:00:00','07:30:00',TRUE),
('00000000-0000-0000-0000-000000000012','evening_slot','Evening (5 PM - 9 PM)','17:00:00','21:00:00','16:00:00','16:30:00',TRUE)
ON CONFLICT (slot_code) DO UPDATE SET label=EXCLUDED.label,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time,order_cutoff_time=EXCLUDED.order_cutoff_time,cancellation_deadline_time=EXCLUDED.cancellation_deadline_time,is_active=EXCLUDED.is_active;

-- 3. APP SETTINGS
INSERT INTO public.app_settings (key,value,description)
VALUES
('delivery_fee_paise','400','Standard per-delivery customer charge: ₹4.00 (400 paise).'),
('min_milk_litres','0.5','Minimum orderable milk volume per delivery in litres.'),
('default_timezone','"Asia/Kolkata"','Application timezone.'),
('currency_code','"INR"','Standard currency code.')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;

-- 4. CATEGORIES
INSERT INTO public.categories (id,name,slug,description,display_order,is_active)
VALUES
('milk','Fresh Milk','fresh-milk','Pure cow & buffalo milk sourced from approved Kolkata dairy centres.',1,TRUE),
('canteen-milk','Canteen Milk','canteen-milk','Special single-vendor canteen milk arrangement for budget daily delivery.',2,TRUE),
('ghee','Pure Ghee','pure-ghee','Traditional granular clarified dairy ghee.',3,TRUE),
('butter','Table Butter','table-butter','Fresh pasteurized salted table butter.',4,TRUE),
('cheese','Cheese','cheese','Quality cheese slices and cooking cheese blocks.',5,TRUE),
('doi','Doi','doi','Authentic Bengali Misti Doi and thick Tok Doi.',6,TRUE),
('sweets','Sweets','sweets','Traditional Kolkata dairy desserts like creamy Firni.',7,TRUE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,slug=EXCLUDED.slug,description=EXCLUDED.description,display_order=EXCLUDED.display_order,is_active=EXCLUDED.is_active;

-- 5. PRODUCTS
INSERT INTO public.products (id,category_id,name,slug,subtitle,description,product_type,requires_vendor_selection,is_active)
VALUES
('milk-cow','milk','Cow Milk','cow-milk','Fresh cow milk from approved vendors','Pure, nutritious cow milk collected daily from approved milk vendors.','standard_milk',TRUE,TRUE),
('milk-buffalo','milk','Buffalo Milk','buffalo-milk','Rich buffalo milk from approved vendors','High-fat, rich buffalo milk suitable for chai, paneer, and rich cooking.','standard_milk',TRUE,TRUE),
('milk-canteen','canteen-milk','Canteen Milk','canteen-milk','Budget milk via Canteen Milk Centre','Value-conscious daily milk delivery under special single-vendor canteen arrangement.','canteen_milk',FALSE,TRUE),
('ghee-red-cow','ghee','Red Cow Pure Ghee','ghee-red-cow','Authentic aroma and golden granules','Heritage Bengali brand clarified dairy ghee.','grocery_dairy',FALSE,TRUE),
('ghee-ashirvaad','ghee','Ashirvaad Ghee','ghee-ashirvaad','Specially cooked aromatic ghee','Premium quality pure cow ghee.','grocery_dairy',FALSE,TRUE),
('butter-amul','butter','Amul Butter','butter-amul','The Taste of India pasteurized table butter','India''s iconic butter for breakfast and cooking.','grocery_dairy',FALSE,TRUE),
('butter-delicious','butter','Delicious Table Butter','butter-delicious','Creamy everyday table butter','Smooth, affordable dairy spread.','grocery_dairy',FALSE,TRUE),
('cheese-amul-slices','cheese','Amul Cheese Slices','cheese-amul-slices','Processed cheese slices','Perfect square cheese slices for breakfast toast and sandwiches.','grocery_dairy',FALSE,TRUE),
('cheese-amul-blocs','cheese','Amul Cheese Blocs','cheese-amul-blocs','Processed cheese blocks','Solid cheese blocks for grating, melting and toppings.','grocery_dairy',FALSE,TRUE),
('doi-misti','doi','Misti Doi','doi-misti','Traditional Bengali sweet curd','Authentic caramelized sweet curd crafted in earthen pots.','grocery_dairy',FALSE,TRUE),
('doi-tok','doi','Tok Doi','doi-tok','Fresh plain sour curd','Thick unsweetened curd for daily cooking, raita and lassi.','grocery_dairy',FALSE,TRUE),
('sweet-firni','sweets','Firni','sweet-firni','Slow-cooked creamy rice pudding','Classic Kolkata sweet pudding infused with cardamom and saffron.','grocery_dairy',FALSE,TRUE)
ON CONFLICT (id) DO UPDATE SET category_id=EXCLUDED.category_id,name=EXCLUDED.name,slug=EXCLUDED.slug,subtitle=EXCLUDED.subtitle,description=EXCLUDED.description,product_type=EXCLUDED.product_type,requires_vendor_selection=EXCLUDED.requires_vendor_selection,is_active=EXCLUDED.is_active;

-- 6. PRODUCT VARIANTS
INSERT INTO public.product_variants (id,product_id,variant_name,brand,pack_size,pack_unit,unit_quantity,purchase_price_paise,sheet_delivery_component_paise,final_price_paise,is_orderable)
VALUES
('milk-cow-500ml','milk-cow','Cow Milk 500 ml','Dairybuy Standard','500 ml','ml',0.50,NULL,NULL,NULL,TRUE),
('milk-cow-1l','milk-cow','Cow Milk 1 L','Dairybuy Standard','1 L','L',1.00,NULL,NULL,NULL,TRUE),
('milk-buffalo-500ml','milk-buffalo','Buffalo Milk 500 ml','Dairybuy Standard','500 ml','ml',0.50,NULL,NULL,NULL,TRUE),
('milk-buffalo-1l','milk-buffalo','Buffalo Milk 1 L','Dairybuy Standard','1 L','L',1.00,NULL,NULL,NULL,TRUE),
('milk-canteen-500ml','milk-canteen','Canteen Milk 500 ml','Canteen Milk Centre','500 ml','ml',0.50,2400,400,2800,TRUE),
('milk-canteen-1l','milk-canteen','Canteen Milk 1 L','Canteen Milk Centre','1 L','L',1.00,4500,400,4900,TRUE),
('ghee-red-cow-200ml','ghee-red-cow','Red Cow Ghee 200 ml','Red Cow','200 ml','ml',0.20,17000,900,17900,TRUE),
('ghee-red-cow-500ml','ghee-red-cow','Red Cow Ghee 500 ml','Red Cow','500 ml','ml',0.50,39000,900,39900,TRUE),
('ghee-ashirvaad-200ml','ghee-ashirvaad','Ashirvaad Ghee 200 ml','Ashirvaad','200 ml','ml',0.20,18200,900,19100,TRUE),
('ghee-ashirvaad-500ml','ghee-ashirvaad','Ashirvaad Ghee 500 ml','Ashirvaad','500 ml','ml',0.50,43700,900,44600,TRUE),
('butter-amul-100g','butter-amul','Amul Butter 100 g','Amul','100 g','g',0.10,6600,900,7500,TRUE),
('butter-amul-200g','butter-amul','Amul Butter 200 g','Amul','200 g','g',0.20,13000,900,13900,TRUE),
('butter-amul-500g','butter-amul','Amul Butter 500 g','Amul','500 g','g',0.50,30500,900,31400,TRUE),
('butter-delicious-100g','butter-delicious','Delicious Butter 100 g','Delicious','100 g','g',0.10,2200,1100,3300,TRUE),
('butter-delicious-500g','butter-delicious','Delicious Butter 500 g','Delicious','500 g','g',0.50,11700,900,12600,TRUE),
('cheese-amul-slices-100g','cheese-amul-slices','Amul Cheese Slices 100 g','Amul','100 g','g',0.10,8200,1100,9300,TRUE),
('cheese-amul-slices-200g','cheese-amul-slices','Amul Cheese Slices 200 g','Amul','200 g','g',0.20,14500,900,15400,TRUE),
('cheese-amul-blocs-200g','cheese-amul-blocs','Amul Cheese Blocs 200 g','Amul','200 g','g',0.20,13000,1100,14100,TRUE),
('cheese-amul-blocs-500g','cheese-amul-blocs','Amul Cheese Blocs 500 g','Amul','500 g','g',0.50,30000,900,30900,TRUE),
('doi-misti-100g','doi-misti','Misti Doi 100 g','Misti Doi','100 g','g',0.10,3500,900,4400,TRUE),
('doi-tok-100g','doi-tok','Tok Doi 100 g','Tok Doi','100 g','g',0.10,2500,900,3400,TRUE),
('sweet-firni-1pc','sweet-firni','Firni 1 piece','Firni','1 piece','piece',1.00,3500,900,4400,TRUE)
ON CONFLICT (id) DO UPDATE SET product_id=EXCLUDED.product_id,variant_name=EXCLUDED.variant_name,brand=EXCLUDED.brand,pack_size=EXCLUDED.pack_size,pack_unit=EXCLUDED.pack_unit,unit_quantity=EXCLUDED.unit_quantity,purchase_price_paise=EXCLUDED.purchase_price_paise,sheet_delivery_component_paise=EXCLUDED.sheet_delivery_component_paise,final_price_paise=EXCLUDED.final_price_paise,is_orderable=EXCLUDED.is_orderable;

-- Product image mappings
INSERT INTO public.product_images (product_id,image_url,alt_text,is_primary,display_order)
VALUES
('milk-cow','/images/products/milk.jpg','Bottle of fresh cow milk',TRUE,1),
('milk-buffalo','/images/products/milk.jpg','Bottle of rich buffalo milk',TRUE,1),
('milk-canteen','/images/products/milk.jpg','Bottle of canteen milk',TRUE,1),
('ghee-red-cow','/images/products/ghee.jpg','Jar of Red Cow pure ghee',TRUE,1),
('ghee-ashirvaad','/images/products/ghee.jpg','Jar of Aashirvaad Svasti pure ghee',TRUE,1),
('butter-amul','/images/products/butter.jpg','Block of Amul butter',TRUE,1),
('butter-delicious','/images/products/butter.jpg','Block of Delicious table butter',TRUE,1),
('cheese-amul-slices','/images/products/butter.jpg','Amul processed cheese slices',TRUE,1),
('cheese-amul-blocs','/images/products/butter.jpg','Amul processed cheese bloc',TRUE,1),
('doi-misti','/images/products/mistidoi.jpg','Earthen pot of Kolkata Misti Doi',TRUE,1),
('doi-tok','/images/products/curd.jpg','Bowl of fresh thick Tok Doi',TRUE,1),
('sweet-firni','/images/products/firni.jpg','Traditional bowl of chilled creamy Firni',TRUE,1)
ON CONFLICT (product_id,image_url) DO UPDATE SET alt_text=EXCLUDED.alt_text,is_primary=EXCLUDED.is_primary,display_order=EXCLUDED.display_order;

-- 7. APPROVED VENDORS
INSERT INTO public.vendors (id,name,code,vendor_type,is_approved,ordering_enabled)
VALUES
('healthy-haryana','Healthy Haryana Milk Centre','HHMC','milk_vendor',TRUE,TRUE),
('vip-pure','VIP Pure Milk','VPM','milk_vendor',TRUE,TRUE),
('ghosh-dairy','Ghosh Dairy','GD','milk_vendor',TRUE,TRUE),
('fresh-punjab','Fresh Punjab Milk','FPM','milk_vendor',TRUE,FALSE),
('kolkata-centre','Kolkata Milk Centre','KMC','milk_vendor',TRUE,FALSE),
('canteen-milk-centre','Canteen Milk Centre','CMC','canteen_vendor',TRUE,TRUE)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,code=EXCLUDED.code,vendor_type=EXCLUDED.vendor_type,is_approved=EXCLUDED.is_approved,ordering_enabled=EXCLUDED.ordering_enabled;

-- 8. VENDOR PRODUCT SUPPORT
INSERT INTO public.vendor_products (vendor_id,product_id,milk_type,is_active)
VALUES
('healthy-haryana','milk-cow','cow',TRUE),('healthy-haryana','milk-buffalo','buffalo',TRUE),
('vip-pure','milk-cow','cow',TRUE),('vip-pure','milk-buffalo','buffalo',TRUE),
('ghosh-dairy','milk-cow','cow',TRUE),('ghosh-dairy','milk-buffalo','buffalo',TRUE),
('fresh-punjab','milk-cow','cow',TRUE),('fresh-punjab','milk-buffalo','buffalo',TRUE),
('kolkata-centre','milk-cow','cow',TRUE),('kolkata-centre','milk-buffalo','buffalo',TRUE),
('canteen-milk-centre','milk-canteen','canteen',TRUE)
ON CONFLICT (vendor_id,product_id,milk_type) DO UPDATE SET is_active=EXCLUDED.is_active;

-- 9. CONFIRMED VENDOR PRICING
INSERT INTO public.vendor_prices (vendor_id,product_variant_id,milk_type,price_per_delivery_paise,plan_7_day_paise,plan_30_day_paise,delivery_fee_paise,total_customer_delivery_paise,effective_from,is_current)
VALUES
('healthy-haryana','milk-cow-500ml','cow',4200,29400,126000,0,4200,'2026-01-01 00:00:00+05:30',TRUE),
('healthy-haryana','milk-cow-1l','cow',7500,52500,225000,0,7500,'2026-01-01 00:00:00+05:30',TRUE),
('vip-pure','milk-cow-500ml','cow',4900,34300,147000,0,4900,'2026-01-01 00:00:00+05:30',TRUE),
('vip-pure','milk-cow-1l','cow',8900,62300,267000,0,8900,'2026-01-01 00:00:00+05:30',TRUE),
('ghosh-dairy','milk-cow-500ml','cow',5900,41300,177000,0,5900,'2026-01-01 00:00:00+05:30',TRUE),
('ghosh-dairy','milk-cow-1l','cow',10900,76300,327000,0,10900,'2026-01-01 00:00:00+05:30',TRUE),
('healthy-haryana','milk-buffalo-500ml','buffalo',4200,29400,126000,0,4200,'2026-01-01 00:00:00+05:30',TRUE),
('healthy-haryana','milk-buffalo-1l','buffalo',7500,52500,225000,0,7500,'2026-01-01 00:00:00+05:30',TRUE),
('vip-pure','milk-buffalo-500ml','buffalo',5900,41300,177000,0,5900,'2026-01-01 00:00:00+05:30',TRUE),
('vip-pure','milk-buffalo-1l','buffalo',10900,76300,327000,0,10900,'2026-01-01 00:00:00+05:30',TRUE),
('ghosh-dairy','milk-buffalo-500ml','buffalo',6400,44800,192000,0,6400,'2026-01-01 00:00:00+05:30',TRUE),
('ghosh-dairy','milk-buffalo-1l','buffalo',11900,83300,357000,0,11900,'2026-01-01 00:00:00+05:30',TRUE),
('canteen-milk-centre','milk-canteen-500ml','canteen',2400,19600,84000,400,2800,'2026-01-01 00:00:00+05:30',TRUE),
('canteen-milk-centre','milk-canteen-1l','canteen',4500,34300,147000,400,4900,'2026-01-01 00:00:00+05:30',TRUE)
ON CONFLICT (vendor_id,product_variant_id,milk_type,effective_from) DO UPDATE SET price_per_delivery_paise=EXCLUDED.price_per_delivery_paise,plan_7_day_paise=EXCLUDED.plan_7_day_paise,plan_30_day_paise=EXCLUDED.plan_30_day_paise,delivery_fee_paise=EXCLUDED.delivery_fee_paise,total_customer_delivery_paise=EXCLUDED.total_customer_delivery_paise,is_current=EXCLUDED.is_current;

-- 10. INITIAL INVENTORY (zero until physically verified)
INSERT INTO public.inventory (product_variant_id,service_area_id,available_stock,reserved_stock,safety_stock)
VALUES
('milk-cow-500ml','00000000-0000-0000-0000-000000000001',0,0,0),
('milk-cow-1l','00000000-0000-0000-0000-000000000001',0,0,0),
('milk-buffalo-500ml','00000000-0000-0000-0000-000000000001',0,0,0),
('milk-buffalo-1l','00000000-0000-0000-0000-000000000001',0,0,0),
('milk-canteen-500ml','00000000-0000-0000-0000-000000000001',0,0,0),
('milk-canteen-1l','00000000-0000-0000-0000-000000000001',0,0,0),
('ghee-red-cow-200ml','00000000-0000-0000-0000-000000000001',0,0,0),
('ghee-red-cow-500ml','00000000-0000-0000-0000-000000000001',0,0,0),
('ghee-ashirvaad-200ml','00000000-0000-0000-0000-000000000001',0,0,0),
('ghee-ashirvaad-500ml','00000000-0000-0000-0000-000000000001',0,0,0),
('butter-amul-100g','00000000-0000-0000-0000-000000000001',0,0,0),
('butter-amul-200g','00000000-0000-0000-0000-000000000001',0,0,0),
('butter-amul-500g','00000000-0000-0000-0000-000000000001',0,0,0),
('butter-delicious-100g','00000000-0000-0000-0000-000000000001',0,0,0),
('butter-delicious-500g','00000000-0000-0000-0000-000000000001',0,0,0),
('cheese-amul-slices-100g','00000000-0000-0000-0000-000000000001',0,0,0),
('cheese-amul-slices-200g','00000000-0000-0000-0000-000000000001',0,0,0),
('cheese-amul-blocs-200g','00000000-0000-0000-0000-000000000001',0,0,0),
('cheese-amul-blocs-500g','00000000-0000-0000-0000-000000000001',0,0,0),
('doi-misti-100g','00000000-0000-0000-0000-000000000001',0,0,0),
('doi-tok-100g','00000000-0000-0000-0000-000000000001',0,0,0),
('sweet-firni-1pc','00000000-0000-0000-0000-000000000001',0,0,0)
ON CONFLICT (product_variant_id,service_area_id) DO NOTHING;

COMMIT;