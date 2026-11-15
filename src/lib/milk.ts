import { MILK_SIZES, MIN_MILK_LITRES, MAX_MILK_LITRES, MILK_QUANTITY_STEP_LITRES } from "@/lib/business";
import { calculateMilkDeliveryPricePaise } from "@/lib/services/pricing-service";

export type MilkType = "cow" | "buffalo" | "canteen";
export type MilkOption = {
  type: MilkType;
  variantId500ml?: string | null;
  variantId1l?: string | null;
  /** Customer-facing CSV final price including the pack's delivery component. */
  pricePerLitreInr: number | null;
  price500mlInr: number | null;
  /** Raw approved workbook components used to preview 1.5 L–10 L prices. */
  price500mlPaise?: number | null;
  delivery500mlPaise?: number | null;
  price1lPaise?: number | null;
  delivery1lPaise?: number | null;
  plan7DayInr: number | null;
  plan30DayInr: number | null;
};
export type MilkTypeMappingStatus = "pending-verification" | "verified";
export type MilkVendor = {
  id: string;
  name: string;
  summary: string;
  verification: "blueprint-confirmed" | "approved-pending-prices";
  mappingStatus: MilkTypeMappingStatus;
  orderingEnabled: boolean;
  pendingReason?: string;
  provisionalOptions: readonly MilkOption[];
  verifiedOptions: readonly MilkOption[];
};

const confirmed: Record<string, { name: string; summary: string; cow: [number,number,number,number] ; buffalo: [number,number,number,number] }> = {
  "healthy-haryana": {
    name: "Healthy Haryana Milk Centre", summary: "Approved Dairybuy vendor. Cow & buffalo milk prices confirmed equal.",
    cow: [50,85,350,595], buffalo: [50,85,350,595],
  },
  "vip-pure": {
    name: "VIP Pure Milk", summary: "Approved Dairybuy vendor. Verified cow and buffalo milk batches.",
    cow: [57,99,399,693], buffalo: [65,115,455,805],
  },
  "ghosh-dairy": {
    name: "Ghosh Dairy", summary: "Approved Dairybuy vendor. Traditional local dairy supply.",
    cow: [70,120,490,840], buffalo: [70,125,490,875],
  },
};

function makeOption(type: "cow" | "buffalo", values: [number,number,number,number]): MilkOption {
  return {
    type,
    price500mlInr: values[0],
    pricePerLitreInr: values[1],
    plan7DayInr: values[2],
    plan30DayInr: values[3],
  };
}

export const milkVendors: readonly MilkVendor[] = [
  ...Object.entries(confirmed).map(([id, vendor]) => ({
    id,
    name: vendor.name,
    summary: vendor.summary,
    verification: "blueprint-confirmed" as const,
    mappingStatus: "verified" as const,
    orderingEnabled: true,
    provisionalOptions: [],
    verifiedOptions: [
      makeOption("cow", vendor.cow),
      makeOption("buffalo", vendor.buffalo),
    ],
  })),
];

export const canteenMilkVendor = {
  id: "canteen-milk-centre",
  name: "Canteen Milk Centre",
  verification: "blueprint-confirmed",
  vendorChoiceShown: false,
  orderable: true,
  pricing: [
    { size: "500 ml", litres: 0.5, milkPriceInr: 29, deliveryFeeInr: 9, totalPerDeliveryInr: 38, plan7DayInr: 266, plan30DayInr: 1140 },
    { size: "1 L", litres: 1, milkPriceInr: 52, deliveryFeeInr: 8, totalPerDeliveryInr: 60, plan7DayInr: 420, plan30DayInr: 1800 },
  ],
} as const;

export { MILK_SIZES, MIN_MILK_LITRES, MAX_MILK_LITRES, MILK_QUANTITY_STEP_LITRES };
export type MilkTypeFilter = "all" | MilkType;

export function milkTypeLabel(type: MilkType): string {
  return type === "cow" ? "Cow Milk" : type === "buffalo" ? "Buffalo Milk" : "Canteen Milk";
}

export function formatQty(litres: number): string {
  if (litres < 1) return `${Math.round(litres * 1000)} ml`;
  return `${Number(litres.toFixed(1))} L`;
}

export function isValidLitres(litres: number): boolean {
  return Number.isFinite(litres) && litres >= MIN_MILK_LITRES && litres <= MAX_MILK_LITRES;
}

export function isStandardMilkSize(litres: number): boolean {
  return MILK_SIZES.some((size) => size.litres === litres);
}

export function isOrderableMilkQuantity(litres: number): boolean {
  return isValidLitres(litres) &&
    Number.isInteger(litres / MILK_QUANTITY_STEP_LITRES);
}

export function findMilkVendor(vendorId: string): MilkVendor | undefined {
  return milkVendors.find((vendor) => vendor.id === vendorId);
}

export function getVisibleOptions(vendor: MilkVendor, filter: MilkTypeFilter): readonly MilkOption[] {
  const pool = vendor.verifiedOptions.length > 0 ? vendor.verifiedOptions : vendor.provisionalOptions;
  return pool.filter((option) => filter === "all" || option.type === filter);
}

export function getMilkPackPrice(vendorId: string, type: MilkType, litres: number): number | null {
  const vendor = findMilkVendor(vendorId);
  if (!vendor?.orderingEnabled) return null;
  const option = vendor.verifiedOptions.find((entry) => entry.type === type);
  if (!option) return null;
  if (litres === 0.5) return option.price500mlInr;
  if (litres === 1) return option.pricePerLitreInr;
  return null;
}

/** Customer-facing per-delivery price using the same approved base components as the server validator. */
export function getMilkOptionPriceInr(option: MilkOption, litres: number): number | null {
  if (!isOrderableMilkQuantity(litres)) return null;
  if (litres === 0.5) return option.price500mlInr;
  if (litres === 1) return option.pricePerLitreInr;
  if (option.price500mlPaise == null || option.delivery500mlPaise == null ||
      option.price1lPaise == null || option.delivery1lPaise == null) return null;
  const pricePaise = calculateMilkDeliveryPricePaise({
    litres,
    price500mlPaise: option.price500mlPaise,
    delivery500mlPaise: option.delivery500mlPaise,
    price1lPaise: option.price1lPaise,
    delivery1lPaise: option.delivery1lPaise,
  });
  return pricePaise === null ? null : pricePaise / 100;
}

export function isSelectableMilkOption(vendorId: string, type: MilkType, vendors: readonly MilkVendor[] = milkVendors): boolean {
  const vendor = vendors.find((entry) => entry.id === vendorId);
  return Boolean(vendor?.orderingEnabled && vendor.mappingStatus === "verified" &&
    vendor.verifiedOptions.some((option) => option.type === type));
}

export function isMilkOrderingAvailable(vendors: readonly MilkVendor[] = milkVendors): boolean {
  return vendors.some((vendor) => vendor.orderingEnabled && vendor.mappingStatus === "verified" && vendor.verifiedOptions.length > 0);
}

export const unverifiedPrototypeVendors: readonly MilkVendor[] = [];
