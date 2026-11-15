import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/types";
import type { MilkOption, MilkType, MilkVendor } from "@/lib/milk";

type VendorRow = Pick<Tables<"vendors">, "id" | "name" | "code" | "vendor_type" | "is_approved" | "ordering_enabled">;
type VendorProductRow = Pick<Tables<"vendor_products">, "vendor_id" | "product_id" | "milk_type" | "is_active">;
type VendorPriceRow = Pick<Tables<"vendor_prices">, "vendor_id" | "product_variant_id" | "milk_type" | "price_per_delivery_paise" | "plan_7_day_paise" | "plan_30_day_paise" | "delivery_fee_paise" | "total_customer_delivery_paise" | "is_current" | "effective_to">;
type VariantRow = Pick<Tables<"product_variants">, "id" | "product_id" | "pack_size" | "unit_quantity">;

export type CanteenMilkPrice = {
  size: string;
  litres: number;
  productVariantId: string;
  milkPriceInr: number;
  deliveryFeeInr: number;
  totalPerDeliveryInr: number;
  plan7DayInr: number | null;
  plan30DayInr: number | null;
};

export type CanteenMilkData = {
  id: string;
  name: string;
  verification: "blueprint-confirmed";
  vendorChoiceShown: false;
  orderable: boolean;
  pricing: CanteenMilkPrice[];
};

type PriceInput = Pick<VendorPriceRow,
  "vendor_id" | "product_variant_id" | "milk_type" | "price_per_delivery_paise" |
  "plan_7_day_paise" | "plan_30_day_paise" | "delivery_fee_paise" |
  "total_customer_delivery_paise" | "is_current" | "effective_to"
>;

function inr(paise: number | null): number | null {
  return paise === null ? null : paise / 100;
}

function vendorSummary(vendor: VendorRow): string {
  return vendor.vendor_type === "canteen_vendor"
    ? "Separate single-vendor canteen milk arrangement."
    : "Approved Dairybuy milk vendor.";
}

export function mapMilkVendorRows(
  vendors: readonly VendorRow[],
  vendorProducts: readonly VendorProductRow[],
  prices: readonly PriceInput[],
  variants: readonly VariantRow[],
): { vendors: MilkVendor[]; canteen: CanteenMilkData | null } {
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const activeProductsByVendor = new Map<string, Set<MilkType>>();
  for (const row of vendorProducts) {
    if (!row.is_active) continue;
    const types = activeProductsByVendor.get(row.vendor_id) ?? new Set<MilkType>();
    types.add(row.milk_type);
    activeProductsByVendor.set(row.vendor_id, types);
  }

  const currentPrices = prices.filter((price) => price.is_current && price.effective_to === null);
  const priceRowsByVendorType = new Map<string, PriceInput[]>();
  for (const price of currentPrices) {
    const key = `${price.vendor_id}:${price.milk_type}`;
    const rows = priceRowsByVendorType.get(key) ?? [];
    rows.push(price);
    priceRowsByVendorType.set(key, rows);
  }

  const milkVendors: MilkVendor[] = [];
  let canteen: CanteenMilkData | null = null;

  for (const vendor of vendors) {
    if (!vendor.is_approved) continue;
    const activeTypes = activeProductsByVendor.get(vendor.id) ?? new Set<MilkType>();

    if (vendor.vendor_type === "canteen_vendor") {
      const rows = priceRowsByVendorType.get(`${vendor.id}:canteen`) ?? [];
      const pricing = rows.flatMap((price): CanteenMilkPrice[] => {
        const variant = variantById.get(price.product_variant_id);
        if (!variant || !vendor.ordering_enabled) return [];
        const milkPrice = inr(price.price_per_delivery_paise);
        const total = inr(price.total_customer_delivery_paise);
        if (milkPrice === null || total === null) return [];
        return [{
          size: variant.pack_size,
          litres: Number(variant.unit_quantity),
          productVariantId: variant.id,
          milkPriceInr: milkPrice,
          deliveryFeeInr: price.delivery_fee_paise / 100,
          totalPerDeliveryInr: total,
          plan7DayInr: inr(price.plan_7_day_paise),
          plan30DayInr: inr(price.plan_30_day_paise),
        }];
      }).sort((a, b) => a.litres - b.litres);

      const hasBothStandardPacks = pricing.some((item) => item.litres === 0.5) &&
        pricing.some((item) => item.litres === 1);
      canteen = {
        id: vendor.id,
        name: vendor.name,
        verification: "blueprint-confirmed",
        vendorChoiceShown: false,
        orderable: vendor.ordering_enabled && hasBothStandardPacks,
        pricing,
      };
      continue;
    }

    const verifiedOptions: MilkOption[] = [];
    const provisionalOptions: MilkOption[] = [];
    for (const milkType of ["cow", "buffalo"] as const) {
      if (!activeTypes.has(milkType)) continue;
      const rows = priceRowsByVendorType.get(`${vendor.id}:${milkType}`) ?? [];
      const byLitres = new Map<number, PriceInput>();
      for (const price of rows) {
        const variant = variantById.get(price.product_variant_id);
        if (variant) byLitres.set(Number(variant.unit_quantity), price);
      }
      const half = byLitres.get(0.5);
      const one = byLitres.get(1);
      const option: MilkOption = {
        type: milkType,
        variantId500ml: half ? half.product_variant_id : null,
        variantId1l: one ? one.product_variant_id : null,
        price500mlInr: half ? inr(half.total_customer_delivery_paise) : null,
        pricePerLitreInr: one ? inr(one.total_customer_delivery_paise) : null,
        price500mlPaise: half?.price_per_delivery_paise ?? null,
        delivery500mlPaise: half?.delivery_fee_paise ?? null,
        price1lPaise: one?.price_per_delivery_paise ?? null,
        delivery1lPaise: one?.delivery_fee_paise ?? null,
        plan7DayInr: one ? inr(one.plan_7_day_paise) : null,
        plan30DayInr: one ? inr(one.plan_30_day_paise) : null,
      };
      if (option.price500mlInr !== null && option.pricePerLitreInr !== null) {
        verifiedOptions.push(option);
      } else {
        provisionalOptions.push(option);
      }
    }

    const orderingEnabled = vendor.ordering_enabled && verifiedOptions.length > 0;
    milkVendors.push({
      id: vendor.id,
      name: vendor.name,
      summary: vendorSummary(vendor),
      verification: orderingEnabled ? "blueprint-confirmed" : "approved-pending-prices",
      mappingStatus: orderingEnabled ? "verified" : "pending-verification",
      orderingEnabled,
      ...(orderingEnabled ? {} : { pendingReason: "Pricing pending from owner" }),
      provisionalOptions,
      verifiedOptions,
    });
  }

  return { vendors: milkVendors, canteen };
}

export async function getDatabaseMilkCatalogue(
  supabase: SupabaseClient<Database>,
): Promise<{ vendors: MilkVendor[]; canteen: CanteenMilkData | null }> {
  const [vendorResult, productResult, priceResult] = await Promise.all([
    supabase.from("vendors").select("id,name,code,vendor_type,is_approved,ordering_enabled").eq("is_approved", true),
    supabase.from("vendor_products").select("vendor_id,product_id,milk_type,is_active").eq("is_active", true),
    supabase.from("vendor_prices").select("vendor_id,product_variant_id,milk_type,price_per_delivery_paise,plan_7_day_paise,plan_30_day_paise,delivery_fee_paise,total_customer_delivery_paise,is_current,effective_to").eq("is_current", true).is("effective_to", null),
  ]);

  if (vendorResult.error) throw new Error(`Unable to load vendors: ${vendorResult.error.message}`);
  if (productResult.error) throw new Error(`Unable to load vendor products: ${productResult.error.message}`);
  if (priceResult.error) throw new Error(`Unable to load vendor prices: ${priceResult.error.message}`);

  const variantIds = [...new Set((priceResult.data ?? []).map((row) => row.product_variant_id))];
  const variantResult = variantIds.length
    ? await supabase.from("product_variants").select("id,product_id,pack_size,unit_quantity").in("id", variantIds)
    : { data: [], error: null };
  if (variantResult.error) throw new Error(`Unable to load milk pack sizes: ${variantResult.error.message}`);

  return mapMilkVendorRows(
    vendorResult.data ?? [],
    productResult.data ?? [],
    priceResult.data ?? [],
    variantResult.data ?? [],
  );
}
