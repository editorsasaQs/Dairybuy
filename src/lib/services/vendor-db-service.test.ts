import { describe, expect, it } from "vitest";
import { mapMilkVendorRows } from "@/lib/services/vendor-db-service";
import type { Tables } from "@/lib/supabase/types";

type Vendor = Pick<Tables<"vendors">, "id" | "name" | "code" | "vendor_type" | "is_approved" | "ordering_enabled">;
type VendorProduct = Pick<Tables<"vendor_products">, "vendor_id" | "product_id" | "milk_type" | "is_active">;
type Price = Pick<Tables<"vendor_prices">, "vendor_id" | "product_variant_id" | "milk_type" | "price_per_delivery_paise" | "plan_7_day_paise" | "plan_30_day_paise" | "delivery_fee_paise" | "total_customer_delivery_paise" | "is_current" | "effective_to">;
type Variant = Pick<Tables<"product_variants">, "id" | "product_id" | "pack_size" | "unit_quantity">;

const vendors: Vendor[] = [
  { id:"healthy-haryana", name:"Healthy Haryana Milk Centre", code:"HHMC", vendor_type:"milk_vendor", is_approved:true, ordering_enabled:true },
  { id:"canteen-milk-centre", name:"Canteen Milk Centre", code:"CMC", vendor_type:"canteen_vendor", is_approved:true, ordering_enabled:true },
  { id:"not-approved", name:"Unapproved", code:"NO", vendor_type:"milk_vendor", is_approved:false, ordering_enabled:true },
];
const vendorProducts: VendorProduct[] = [
  { vendor_id:"healthy-haryana", product_id:"milk-cow", milk_type:"cow", is_active:true },
  { vendor_id:"healthy-haryana", product_id:"milk-buffalo", milk_type:"buffalo", is_active:true },
  { vendor_id:"not-approved", product_id:"milk-cow", milk_type:"cow", is_active:true },
  { vendor_id:"canteen-milk-centre", product_id:"milk-canteen", milk_type:"canteen", is_active:true },
];
const variants: Variant[] = [
  { id:"cow-500", product_id:"milk-cow", pack_size:"500 ml", unit_quantity:0.5 },
  { id:"cow-1l", product_id:"milk-cow", pack_size:"1 L", unit_quantity:1 },
  { id:"buffalo-500", product_id:"milk-buffalo", pack_size:"500 ml", unit_quantity:0.5 },
  { id:"buffalo-1l", product_id:"milk-buffalo", pack_size:"1 L", unit_quantity:1 },
  { id:"canteen-500", product_id:"milk-canteen", pack_size:"500 ml", unit_quantity:0.5 },
  { id:"canteen-1l", product_id:"milk-canteen", pack_size:"1 L", unit_quantity:1 },
];
const prices: Price[] = [
  { vendor_id:"healthy-haryana", product_variant_id:"cow-500", milk_type:"cow", price_per_delivery_paise:4100, plan_7_day_paise:35000, plan_30_day_paise:150000, delivery_fee_paise:900, total_customer_delivery_paise:5000, is_current:true, effective_to:null },
  { vendor_id:"healthy-haryana", product_variant_id:"cow-1l", milk_type:"cow", price_per_delivery_paise:7800, plan_7_day_paise:59500, plan_30_day_paise:255000, delivery_fee_paise:700, total_customer_delivery_paise:8500, is_current:true, effective_to:null },
  { vendor_id:"healthy-haryana", product_variant_id:"buffalo-500", milk_type:"buffalo", price_per_delivery_paise:4100, plan_7_day_paise:35000, plan_30_day_paise:150000, delivery_fee_paise:900, total_customer_delivery_paise:5000, is_current:true, effective_to:null },
  { vendor_id:"healthy-haryana", product_variant_id:"buffalo-1l", milk_type:"buffalo", price_per_delivery_paise:7800, plan_7_day_paise:59500, plan_30_day_paise:255000, delivery_fee_paise:700, total_customer_delivery_paise:8500, is_current:true, effective_to:null },
  { vendor_id:"canteen-milk-centre", product_variant_id:"canteen-500", milk_type:"canteen", price_per_delivery_paise:2900, plan_7_day_paise:26600, plan_30_day_paise:114000, delivery_fee_paise:900, total_customer_delivery_paise:3800, is_current:true, effective_to:null },
  { vendor_id:"canteen-milk-centre", product_variant_id:"canteen-1l", milk_type:"canteen", price_per_delivery_paise:5200, plan_7_day_paise:42000, plan_30_day_paise:180000, delivery_fee_paise:800, total_customer_delivery_paise:6000, is_current:true, effective_to:null },
  { vendor_id:"healthy-haryana", product_variant_id:"cow-500", milk_type:"cow", price_per_delivery_paise:9999, plan_7_day_paise:1, plan_30_day_paise:1, delivery_fee_paise:0, total_customer_delivery_paise:9999, is_current:false, effective_to:null },
];

describe("Supabase milk vendor mapping", () => {
  const result = mapMilkVendorRows(vendors, vendorProducts, prices, variants);
  it("returns only approved regular vendors and excludes canteen from vendor selection", () => {
    expect(result.vendors.map((vendor) => vendor.id)).toEqual(["healthy-haryana"]);
  });
  it("maps customer-facing CSV totals for cow and buffalo", () => {
    expect(result.vendors[0]?.verifiedOptions).toEqual([
      { type:"cow", variantId500ml:"cow-500", variantId1l:"cow-1l", price500mlInr:50, pricePerLitreInr:85, price500mlPaise:4100, delivery500mlPaise:900, price1lPaise:7800, delivery1lPaise:700, plan7DayInr:595, plan30DayInr:2550 },
      { type:"buffalo", variantId500ml:"buffalo-500", variantId1l:"buffalo-1l", price500mlInr:50, pricePerLitreInr:85, price500mlPaise:4100, delivery500mlPaise:900, price1lPaise:7800, delivery1lPaise:700, plan7DayInr:595, plan30DayInr:2550 },
    ]);
  });
  it("maps Canteen as a single-vendor arrangement with CSV component breakdown", () => {
    expect(result.canteen?.vendorChoiceShown).toBe(false);
    expect(result.canteen?.pricing).toEqual([
      { size:"500 ml", litres:0.5, productVariantId:"canteen-500", milkPriceInr:29, deliveryFeeInr:9, totalPerDeliveryInr:38, plan7DayInr:266, plan30DayInr:1140 },
      { size:"1 L", litres:1, productVariantId:"canteen-1l", milkPriceInr:52, deliveryFeeInr:8, totalPerDeliveryInr:60, plan7DayInr:420, plan30DayInr:1800 },
    ]);
  });
});
