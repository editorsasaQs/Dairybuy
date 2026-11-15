/**
 * Dairybuy server-side validation for vendor-selected milk and catalogue products.
 * Milk volumes: 500 ml to 10 L in 500 ml increments.
 */
import { MilkType } from '@/lib/supabase/types';
import { isPincodeServiceable } from './service-area-service';
import { findVendor, getVendorMilkPrice } from './vendor-service';
import { findProductById, findVariantById } from './catalogue-service';
import { isSupportedMilkLitres } from './pricing-service';

export type ValidationResult = { isValid: boolean; errors: string[] };
export const STANDARD_MILK_LITRES = [0.5, 1.0] as const;
export const MIN_MILK_LITRES = 0.5;

export function isStandardMilkVolume(litres: number): boolean {
  return isSupportedMilkLitres(litres);
}

export function litresToPackSize(litres: number): '500 ml' | '1 L' | null {
  if (!isSupportedMilkLitres(litres)) return null;
  return litres === 0.5 ? '500 ml' : '1 L';
}

export function validateLineItem(input: {
  productVariantId: string;
  vendorId?: string | null;
  milkType?: MilkType | null;
  litres?: number | null;
  quantity: number;
}): ValidationResult {
  const errors: string[] = [];
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) {
    errors.push(`Quantity must be an integer between 1 and 100 (got ${input.quantity}).`);
  }
  const variant = findVariantById(input.productVariantId);
  if (!variant) return { isValid: false, errors: [...errors, `Product variant '${input.productVariantId}' was not found in the catalogue.`] };
  const product = findProductById(variant.productId);
  if (!product) return { isValid: false, errors: [...errors, `Parent product for variant '${input.productVariantId}' was not found.`] };

  if (product.productType === 'grocery_dairy') {
    if (input.vendorId || input.milkType || input.litres != null) {
      errors.push(`Non-milk product '${product.name}' cannot include vendor, milk type or volume selections.`);
    }
    return { isValid: errors.length === 0, errors };
  }

  const litres = input.litres;
  if (litres == null || !isSupportedMilkLitres(litres)) {
    errors.push('Milk volume must be between 500 ml and 10 L in 500 ml increments.');
    return { isValid: false, errors };
  }
  const expectedVariantLitres = litres === 0.5 ? 0.5 : 1;
  if (variant.unitQuantity !== expectedVariantLitres) {
    errors.push('Milk variant reference does not match the selected volume.');
  }

  if (product.productType === 'canteen_milk') {
    if (input.vendorId !== 'canteen-milk-centre' || input.milkType !== 'canteen') {
      errors.push('Canteen milk requires the dedicated Canteen Milk Centre vendor.');
    }
  } else if (product.productType === 'standard_milk') {
    if (!input.vendorId) {
      errors.push(`Milk product '${product.name}' requires a vendor selection.`);
    } else {
      const vendor = findVendor(input.vendorId);
      if (!vendor) errors.push(`Unknown vendor '${input.vendorId}'.`);
      else if (!vendor.isApproved) errors.push(`Vendor '${vendor.name}' is not approved.`);
      else if (!vendor.orderingEnabled) errors.push(`Ordering for vendor '${vendor.name}' is disabled pending owner pricing.`);
      if (input.milkType !== 'cow' && input.milkType !== 'buffalo') {
        errors.push("Standard milk must specify 'cow' or 'buffalo' milk type.");
      }
    }
  } else {
    errors.push('Unsupported product type.');
  }

  if (input.vendorId && input.milkType) {
    const one = getVendorMilkPrice(input.vendorId, input.milkType, '1 L');
    const half = getVendorMilkPrice(input.vendorId, input.milkType, '500 ml');
    if (!one || !half) errors.push('Complete confirmed pricing for both base milk sizes is required.');
  }
  return { isValid: errors.length === 0, errors };
}

export function validateServicePincode(pincode: string): ValidationResult {
  const errors: string[] = [];
  if (!pincode || !/^\d{6}$/.test(pincode.trim())) {
    errors.push('Pincode must be a valid 6-digit postal code.');
  } else if (!isPincodeServiceable(pincode)) {
    errors.push(`Pincode ${pincode} is not currently serviceable. Launch area is Topsia, Kolkata.`);
  }
  return { isValid: errors.length === 0, errors };
}
