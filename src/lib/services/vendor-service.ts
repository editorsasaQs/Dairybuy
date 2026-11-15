/**
 * Dairybuy Phase 4 Vendor Service
 * Implements confirmed vendor approvals, cow/buffalo mapping, and pricing availability.
 * Authority: Section 2 (Confirmed Vendors), Section 3 (Confirmed Milk Pricing),
 *            and Section 4 (Canteen Milk Pricing) of Handover.
 */

import { MilkType } from '@/lib/supabase/types';

export type ApprovedVendorId =
  | 'healthy-haryana'
  | 'vip-pure'
  | 'ghosh-dairy';

export type CanteenVendorId = 'canteen-milk-centre';

export type VendorId = ApprovedVendorId | CanteenVendorId;

export type MilkPackSize = '500 ml' | '1 L';

export type VendorMilkPriceRecord = {
  vendorId: VendorId;
  milkType: MilkType;
  packSize: MilkPackSize;
  unitQuantityLitres: 0.5 | 1.0;
  pricePerDeliveryPaise: number; // CSV milk selling price excluding its delivery component
  plan7DayPaise: number;
  plan30DayPaise: number;
  deliveryFeePaise: number; // CSV delivery component for this selected pack
  totalCustomerPerDeliveryPaise: number;
};

export type VendorDetails = {
  id: VendorId;
  name: string;
  code: string;
  vendorType: 'milk_vendor' | 'canteen_vendor';
  isApproved: boolean;
  orderingEnabled: boolean;
  suppliesCow: boolean;
  suppliesBuffalo: boolean;
  pricingStatus: 'confirmed' | 'pending_owner_prices';
  description: string;
};

/**
 * Confirmed Approved Milk Vendors:
 * 1. Healthy Haryana Milk Centre
 * 2. VIP Pure Milk
 * 3. Ghosh Dairy
 * Plus Canteen Milk Centre (single vendor canteen arrangement).
 */
export const APPROVED_VENDORS: readonly VendorDetails[] = [
  {
    id: 'healthy-haryana',
    name: 'Healthy Haryana Milk Centre',
    code: 'HHMC',
    vendorType: 'milk_vendor',
    isApproved: true,
    orderingEnabled: true,
    suppliesCow: true,
    suppliesBuffalo: true,
    pricingStatus: 'confirmed',
    description: 'Approved Dairybuy milk vendor. Complete workbook pricing confirmed. Cow & buffalo prices are intentionally equal.',
  },
  {
    id: 'vip-pure',
    name: 'VIP Pure Milk',
    code: 'VPM',
    vendorType: 'milk_vendor',
    isApproved: true,
    orderingEnabled: true,
    suppliesCow: true,
    suppliesBuffalo: true,
    pricingStatus: 'confirmed',
    description: 'Approved Dairybuy milk vendor. Complete workbook pricing confirmed. Buffalo prices differ from cow.',
  },
  {
    id: 'ghosh-dairy',
    name: 'Ghosh Dairy',
    code: 'GD',
    vendorType: 'milk_vendor',
    isApproved: true,
    orderingEnabled: true,
    suppliesCow: true,
    suppliesBuffalo: true,
    pricingStatus: 'confirmed',
    description: 'Approved Dairybuy milk vendor. Complete workbook pricing confirmed. Buffalo prices differ from cow.',
  },
  {
    id: 'canteen-milk-centre',
    name: 'Canteen Milk Centre',
    code: 'CMC',
    vendorType: 'canteen_vendor',
    isApproved: true,
    orderingEnabled: true,
    suppliesCow: false,
    suppliesBuffalo: false,
    pricingStatus: 'confirmed',
    description: 'Special single-vendor canteen milk arrangement. Budget pricing confirmed.',
  },
] as const;

/**
 * Exact workbook milk pricing in integer paise.
 * App applies these prices to both one-time orders and subscriptions.
 */
export const CONFIRMED_MILK_PRICING: readonly VendorMilkPriceRecord[] = [
  {
    vendorId: 'healthy-haryana', milkType: 'cow', packSize: '500 ml',
    unitQuantityLitres: 0.5, pricePerDeliveryPaise: 4100,
    plan7DayPaise: 35000, plan30DayPaise: 150000,
    deliveryFeePaise: 900, totalCustomerPerDeliveryPaise: 5000,
  },
  {
    vendorId: 'healthy-haryana', milkType: 'cow', packSize: '1 L',
    unitQuantityLitres: 1, pricePerDeliveryPaise: 7800,
    plan7DayPaise: 59500, plan30DayPaise: 255000,
    deliveryFeePaise: 700, totalCustomerPerDeliveryPaise: 8500,
  },
  {
    vendorId: 'healthy-haryana', milkType: 'buffalo', packSize: '500 ml',
    unitQuantityLitres: 0.5, pricePerDeliveryPaise: 4100,
    plan7DayPaise: 35000, plan30DayPaise: 150000,
    deliveryFeePaise: 900, totalCustomerPerDeliveryPaise: 5000,
  },
  {
    vendorId: 'healthy-haryana', milkType: 'buffalo', packSize: '1 L',
    unitQuantityLitres: 1, pricePerDeliveryPaise: 7800,
    plan7DayPaise: 59500, plan30DayPaise: 255000,
    deliveryFeePaise: 700, totalCustomerPerDeliveryPaise: 8500,
  },
  {
    vendorId: 'vip-pure', milkType: 'cow', packSize: '500 ml',
    unitQuantityLitres: 0.5, pricePerDeliveryPaise: 4800,
    plan7DayPaise: 39900, plan30DayPaise: 171000,
    deliveryFeePaise: 900, totalCustomerPerDeliveryPaise: 5700,
  },
  {
    vendorId: 'vip-pure', milkType: 'cow', packSize: '1 L',
    unitQuantityLitres: 1, pricePerDeliveryPaise: 9200,
    plan7DayPaise: 69300, plan30DayPaise: 297000,
    deliveryFeePaise: 700, totalCustomerPerDeliveryPaise: 9900,
  },
  {
    vendorId: 'vip-pure', milkType: 'buffalo', packSize: '500 ml',
    unitQuantityLitres: 0.5, pricePerDeliveryPaise: 5600,
    plan7DayPaise: 45500, plan30DayPaise: 195000,
    deliveryFeePaise: 900, totalCustomerPerDeliveryPaise: 6500,
  },
  {
    vendorId: 'vip-pure', milkType: 'buffalo', packSize: '1 L',
    unitQuantityLitres: 1, pricePerDeliveryPaise: 10800,
    plan7DayPaise: 80500, plan30DayPaise: 345000,
    deliveryFeePaise: 700, totalCustomerPerDeliveryPaise: 11500,
  },
  {
    vendorId: 'ghosh-dairy', milkType: 'cow', packSize: '500 ml',
    unitQuantityLitres: 0.5, pricePerDeliveryPaise: 6100,
    plan7DayPaise: 49000, plan30DayPaise: 210000,
    deliveryFeePaise: 900, totalCustomerPerDeliveryPaise: 7000,
  },
  {
    vendorId: 'ghosh-dairy', milkType: 'cow', packSize: '1 L',
    unitQuantityLitres: 1, pricePerDeliveryPaise: 11300,
    plan7DayPaise: 84000, plan30DayPaise: 360000,
    deliveryFeePaise: 700, totalCustomerPerDeliveryPaise: 12000,
  },
  {
    vendorId: 'ghosh-dairy', milkType: 'buffalo', packSize: '500 ml',
    unitQuantityLitres: 0.5, pricePerDeliveryPaise: 6100,
    plan7DayPaise: 49000, plan30DayPaise: 210000,
    deliveryFeePaise: 900, totalCustomerPerDeliveryPaise: 7000,
  },
  {
    vendorId: 'ghosh-dairy', milkType: 'buffalo', packSize: '1 L',
    unitQuantityLitres: 1, pricePerDeliveryPaise: 11800,
    plan7DayPaise: 87500, plan30DayPaise: 375000,
    deliveryFeePaise: 700, totalCustomerPerDeliveryPaise: 12500,
  },
  {
    vendorId: 'canteen-milk-centre', milkType: 'canteen', packSize: '500 ml',
    unitQuantityLitres: 0.5, pricePerDeliveryPaise: 2900,
    plan7DayPaise: 26600, plan30DayPaise: 114000,
    deliveryFeePaise: 900, totalCustomerPerDeliveryPaise: 3800,
  },
  {
    vendorId: 'canteen-milk-centre', milkType: 'canteen', packSize: '1 L',
    unitQuantityLitres: 1, pricePerDeliveryPaise: 5200,
    plan7DayPaise: 42000, plan30DayPaise: 180000,
    deliveryFeePaise: 800, totalCustomerPerDeliveryPaise: 6000,
  }
];

export function findVendor(vendorId: string): VendorDetails | undefined {
  return APPROVED_VENDORS.find((v) => v.id === vendorId);
}

export function isVendorApproved(vendorId: string): boolean {
  const vendor = findVendor(vendorId);
  return Boolean(vendor && vendor.isApproved);
}

export function isVendorOrderable(vendorId: string): boolean {
  const vendor = findVendor(vendorId);
  return Boolean(vendor && vendor.isApproved && vendor.orderingEnabled);
}

export function getVendorMilkPrice(
  vendorId: string,
  milkType: MilkType,
  packSize: MilkPackSize,
): VendorMilkPriceRecord | undefined {
  return CONFIRMED_MILK_PRICING.find(
    (p) =>
      p.vendorId === vendorId &&
      p.milkType === milkType &&
      p.packSize === packSize,
  );
}

export function getApprovedMilkVendors(): readonly VendorDetails[] {
  return APPROVED_VENDORS.filter((v) => v.vendorType === 'milk_vendor');
}

export function getCanteenVendor(): VendorDetails {
  const canteen = APPROVED_VENDORS.find((v) => v.id === 'canteen-milk-centre');
  if (!canteen) {
    throw new Error('Canteen Milk Centre vendor not found');
  }
  return canteen;
}
