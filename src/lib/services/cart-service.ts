/**
 * Legacy in-memory cart calculator. Production cart validation uses the
 * database-backed service; this path follows the same CSV-inclusive rules.
 */
import { MilkType } from '@/lib/supabase/types';
import { findVariantById } from './catalogue-service';
import { calculateMilkDeliveryPricePaise, calculateOrderTotals } from './pricing-service';
import { validateLineItem } from './validation-service';
import { findVendor, getVendorMilkPrice } from './vendor-service';

export type ClientCartItemInput = {
  key: string;
  productVariantId: string;
  vendorId?: string | null;
  milkType?: MilkType | null;
  litres?: number | null;
  quantity: number;
  clientReportedPricePaise?: number | null;
};
export type ValidatedCartItem = {
  key: string;
  productVariantId: string;
  productName: string;
  variantName: string;
  vendorId: string | null;
  vendorName: string | null;
  milkType: MilkType | null;
  litres: number | null;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};
export type ValidatedCartResult = {
  isValid: boolean;
  errors: string[];
  items: ValidatedCartItem[];
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
};

export function validateAndCalculateCart(cartItems: readonly ClientCartItemInput[]): ValidatedCartResult {
  const errors: string[] = [];
  const validatedItems: ValidatedCartItem[] = [];

  for (const item of cartItems) {
    const validation = validateLineItem(item);
    if (!validation.isValid) {
      errors.push(...validation.errors);
      continue;
    }
    const variant = findVariantById(item.productVariantId);
    if (!variant) continue;

    let unitPricePaise: number | null = null;
    let vendorName: string | null = null;
    if (item.vendorId && item.milkType && item.litres != null) {
      const half = getVendorMilkPrice(item.vendorId, item.milkType, '500 ml');
      const one = getVendorMilkPrice(item.vendorId, item.milkType, '1 L');
      if (half && one) {
        unitPricePaise = calculateMilkDeliveryPricePaise({
          litres: item.litres,
          price500mlPaise: half.pricePerDeliveryPaise,
          delivery500mlPaise: half.deliveryFeePaise,
          price1lPaise: one.pricePerDeliveryPaise,
          delivery1lPaise: one.deliveryFeePaise,
        });
      }
      vendorName = findVendor(item.vendorId)?.name ?? item.vendorId;
    } else if (variant.finalPricePaise !== null) {
      unitPricePaise = variant.finalPricePaise;
    }

    if (unitPricePaise === null) {
      errors.push(`No valid authoritative price exists for ${item.productVariantId}.`);
      continue;
    }
    validatedItems.push({
      key: item.key,
      productVariantId: variant.id,
      productName: variant.brand ? `${variant.brand} ${variant.variantName}` : variant.variantName,
      variantName: variant.variantName,
      vendorId: item.vendorId || null,
      vendorName,
      milkType: item.milkType || null,
      litres: item.litres ?? null,
      quantity: item.quantity,
      unitPricePaise,
      lineTotalPaise: unitPricePaise * item.quantity,
    });
  }

  if (errors.length) return { isValid: false, errors, items: [], subtotalPaise: 0, deliveryFeePaise: 0, totalPaise: 0 };
  const totals = calculateOrderTotals(validatedItems.map((item) => ({
    unitPricePaise: item.unitPricePaise,
    quantity: item.quantity,
  })));
  return { isValid: true, errors: [], items: validatedItems, ...totals };
}
