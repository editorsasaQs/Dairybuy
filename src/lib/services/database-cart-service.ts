import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, MilkType, Tables } from '@/lib/supabase/types';
import type { ClientCartItemInput, ValidatedCartResult, ValidatedCartItem } from './cart-service';
import { calculateMilkDeliveryPricePaise, calculateOrderTotals, formatPaise, isSupportedMilkLitres } from './pricing-service';

type ProductRow = Pick<Tables<'products'>, 'id' | 'name' | 'product_type' | 'is_active'>;
type VariantRow = Pick<Tables<'product_variants'>, 'id' | 'product_id' | 'variant_name' | 'brand' | 'unit_quantity' | 'final_price_paise' | 'is_orderable'>;
type VendorRow = Pick<Tables<'vendors'>, 'id' | 'name' | 'is_approved' | 'ordering_enabled' | 'vendor_type'>;
type VendorProductRow = Pick<Tables<'vendor_products'>, 'vendor_id' | 'product_id' | 'milk_type' | 'is_active'>;
type VendorPriceRow = Pick<Tables<'vendor_prices'>,
  'vendor_id' | 'product_variant_id' | 'milk_type' | 'price_per_delivery_paise' |
  'delivery_fee_paise' | 'total_customer_delivery_paise' | 'is_current' | 'effective_from' | 'effective_to'
>;

const MAX_CART_LINES = 50;
const MAX_QUANTITY = 100;
const CANTEEN_VENDOR_ID = 'canteen-milk-centre';

function invalid(errors: string[]): ValidatedCartResult {
  return { isValid: false, errors, items: [], subtotalPaise: 0, deliveryFeePaise: 0, totalPaise: 0 };
}

function validMilkType(value: unknown): value is MilkType {
  return value === 'cow' || value === 'buffalo' || value === 'canteen';
}

/** Recomputes all prices from live database rows; browser-submitted prices are ignored. */
export async function validateAndCalculateDatabaseCart(
  supabase: SupabaseClient<Database>,
  cartItems: readonly ClientCartItemInput[],
): Promise<ValidatedCartResult> {
  if (!Array.isArray(cartItems) || cartItems.length === 0) return invalid(['Your cart is empty.']);
  if (cartItems.length > MAX_CART_LINES) return invalid([`A cart cannot contain more than ${MAX_CART_LINES} different items.`]);

  const errors: string[] = [];
  for (const [index, item] of cartItems.entries()) {
    if (!item || typeof item.productVariantId !== 'string' || !item.productVariantId.trim()) {
      errors.push(`Item ${index + 1}: product variant is required.`);
    }
    if (!Number.isInteger(item?.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      errors.push(`Item ${index + 1}: quantity must be an integer between 1 and ${MAX_QUANTITY}.`);
    }
    if (item?.key !== undefined && typeof item.key !== 'string') errors.push(`Item ${index + 1}: invalid item key.`);
  }

  const quantityBySelection = new Map<string, number>();
  for (const item of cartItems) {
    const selectionKey = [item.productVariantId, item.vendorId ?? '', item.milkType ?? '', item.litres ?? ''].join(':');
    const combined = (quantityBySelection.get(selectionKey) ?? 0) + item.quantity;
    quantityBySelection.set(selectionKey, combined);
    if (combined > MAX_QUANTITY) errors.push('The combined quantity for the same product, vendor and volume cannot exceed 100.');
  }
  if (errors.length) return invalid(errors);

  const requestedVariantIds = [...new Set(cartItems.map((item) => item.productVariantId))];
  const requestedVariants = await supabase.from('product_variants')
    .select('id,product_id,variant_name,brand,unit_quantity,final_price_paise,is_orderable')
    .in('id', requestedVariantIds);
  if (requestedVariants.error) throw new Error('Unable to validate product variants against the catalogue.');
  const initialVariants = (requestedVariants.data ?? []) as VariantRow[];
  const productIds = [...new Set(initialVariants.map((variant) => variant.product_id))];
  const productResult = productIds.length
    ? await supabase.from('products').select('id,name,product_type,is_active').in('id', productIds)
    : { data: [], error: null };
  if (productResult.error) throw new Error('Unable to validate products against the catalogue.');
  const products = (productResult.data ?? []) as ProductRow[];
  const productById = new Map(products.map((product) => [product.id, product]));

  const milkProductIds = [...new Set(initialVariants
    .filter((variant) => {
      const product = productById.get(variant.product_id);
      return product?.product_type === 'standard_milk' || product?.product_type === 'canteen_milk';
    })
    .map((variant) => variant.product_id))];
  const allMilkVariantsResult = milkProductIds.length
    ? await supabase.from('product_variants')
      .select('id,product_id,variant_name,brand,unit_quantity,final_price_paise,is_orderable')
      .in('product_id', milkProductIds)
    : { data: [], error: null };
  if (allMilkVariantsResult.error) throw new Error('Unable to load the base milk pricing variants.');

  const variantsById = new Map<string, VariantRow>();
  for (const variant of [...initialVariants, ...((allMilkVariantsResult.data ?? []) as VariantRow[])]) {
    variantsById.set(variant.id, variant);
  }
  const variants = [...variantsById.values()];
  const milkItems = cartItems.filter((item) =>
    Boolean(item.vendorId || item.milkType || (item.litres !== undefined && item.litres !== null)),
  );
  const vendorIds = [...new Set(milkItems.map((item) => item.vendorId).filter((id): id is string => Boolean(id)))];
  const priceVariantIds = [...new Set(variants
    .filter((variant) => milkProductIds.includes(variant.product_id))
    .map((variant) => variant.id))];

  const [vendorResult, mappingResult, priceResult] = await Promise.all([
    vendorIds.length
      ? supabase.from('vendors').select('id,name,is_approved,ordering_enabled,vendor_type').in('id', vendorIds)
      : Promise.resolve({ data: [], error: null }),
    vendorIds.length && milkProductIds.length
      ? supabase.from('vendor_products').select('vendor_id,product_id,milk_type,is_active')
        .in('vendor_id', vendorIds).in('product_id', milkProductIds).eq('is_active', true)
      : Promise.resolve({ data: [], error: null }),
    vendorIds.length && priceVariantIds.length
      ? supabase.from('vendor_prices')
        .select('vendor_id,product_variant_id,milk_type,price_per_delivery_paise,delivery_fee_paise,total_customer_delivery_paise,is_current,effective_from,effective_to')
        .in('product_variant_id', priceVariantIds).in('vendor_id', vendorIds)
        .eq('is_current', true).is('effective_to', null).lte('effective_from', new Date().toISOString())
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (vendorResult.error || mappingResult.error || priceResult.error) {
    throw new Error('Unable to validate live vendor availability and pricing.');
  }

  const vendorById = new Map(((vendorResult.data ?? []) as VendorRow[]).map((vendor) => [vendor.id, vendor]));
  const mappingRows = (mappingResult.data ?? []) as VendorProductRow[];
  const priceRows = (priceResult.data ?? []) as VendorPriceRow[];
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const validatedItems: ValidatedCartItem[] = [];

  for (const [index, item] of cartItems.entries()) {
    const variant = variantById.get(item.productVariantId);
    const product = variant ? productById.get(variant.product_id) : undefined;
    if (!variant || !product || !product.is_active || !variant.is_orderable) {
      errors.push(`Item ${index + 1}: this product is no longer available.`);
      continue;
    }

    let unitPricePaise: number;
    let vendorName: string | null = null;
    let normalizedMilkType: MilkType | null = null;
    let litres: number | null = null;

    if (product.product_type === 'grocery_dairy') {
      if (item.vendorId || item.milkType || item.litres != null) {
        errors.push(`Item ${index + 1}: non-milk products cannot include vendor, milk or volume selections.`);
        continue;
      }
      if (variant.final_price_paise === null || !Number.isSafeInteger(variant.final_price_paise) || variant.final_price_paise <= 0) {
        errors.push(`Item ${index + 1}: this product has no valid active selling price.`);
        continue;
      }
      unitPricePaise = variant.final_price_paise;
    } else {
      const expectedType: unknown = product.product_type === 'canteen_milk' ? 'canteen' : item.milkType;
      if (!item.vendorId || !validMilkType(expectedType) ||
          (product.product_type === 'standard_milk' && expectedType !== 'cow' && expectedType !== 'buffalo') ||
          (product.product_type === 'canteen_milk' &&
            (item.vendorId !== CANTEEN_VENDOR_ID || item.milkType !== 'canteen' || expectedType !== 'canteen'))) {
        errors.push(`Item ${index + 1}: milk type or vendor selection is invalid.`);
        continue;
      }
      if (item.litres == null || !isSupportedMilkLitres(item.litres)) {
        errors.push(`Item ${index + 1}: milk volume must be 500 ml–10 L in 500 ml increments.`);
        continue;
      }
      const expectedVariantLitres = item.litres === 0.5 ? 0.5 : 1;
      if (Number(variant.unit_quantity) !== expectedVariantLitres) {
        errors.push(`Item ${index + 1}: milk reference variant does not match the selected volume.`);
        continue;
      }
      const vendor = vendorById.get(item.vendorId);
      if (!vendor || !vendor.is_approved || !vendor.ordering_enabled) {
        errors.push(`Item ${index + 1}: selected vendor is not currently accepting orders.`);
        continue;
      }
      if ((product.product_type === 'canteen_milk' && vendor.vendor_type !== 'canteen_vendor') ||
          (product.product_type === 'standard_milk' && vendor.vendor_type !== 'milk_vendor')) {
        errors.push(`Item ${index + 1}: selected vendor is not eligible for this milk product.`);
        continue;
      }
      const mappingExists = mappingRows.some((row) =>
        row.vendor_id === vendor.id && row.product_id === product.id && row.milk_type === expectedType && row.is_active,
      );
      if (!mappingExists) {
        errors.push(`Item ${index + 1}: selected vendor does not supply this milk type.`);
        continue;
      }
      const findCurrentPrice = (unitQuantity: number) => {
        const baseVariant = variants.find((candidate) =>
          candidate.product_id === product.id && Number(candidate.unit_quantity) === unitQuantity,
        );
        if (!baseVariant) return null;
        const matches = priceRows.filter((row) =>
          row.vendor_id === vendor.id && row.product_variant_id === baseVariant.id &&
          row.milk_type === expectedType && row.is_current && row.effective_to === null,
        );
        return matches.length === 1 ? matches[0] : null;
      };
      const half = findCurrentPrice(0.5);
      const one = findCurrentPrice(1);
      if (!half || !one ||
          half.total_customer_delivery_paise !== half.price_per_delivery_paise + half.delivery_fee_paise ||
          one.total_customer_delivery_paise !== one.price_per_delivery_paise + one.delivery_fee_paise) {
        errors.push(`Item ${index + 1}: complete current vendor pricing is unavailable or invalid.`);
        continue;
      }
      const calculated = calculateMilkDeliveryPricePaise({
        litres: item.litres,
        price500mlPaise: half.price_per_delivery_paise,
        delivery500mlPaise: half.delivery_fee_paise,
        price1lPaise: one.price_per_delivery_paise,
        delivery1lPaise: one.delivery_fee_paise,
      });
      if (calculated === null) {
        errors.push(`Item ${index + 1}: milk price calculation failed.`);
        continue;
      }
      unitPricePaise = calculated;
      vendorName = vendor.name;
      normalizedMilkType = expectedType;
      litres = item.litres;
    }

    validatedItems.push({
      key: item.key || `line-${index + 1}`,
      productVariantId: variant.id,
      productName: variant.brand ? `${variant.brand} ${variant.variant_name}` : variant.variant_name,
      variantName: variant.variant_name,
      vendorId: item.vendorId || null,
      vendorName,
      milkType: normalizedMilkType,
      litres,
      quantity: item.quantity,
      unitPricePaise,
      lineTotalPaise: unitPricePaise * item.quantity,
    });
  }

  if (errors.length) return invalid(errors);
  const totals = calculateOrderTotals(validatedItems.map((item) => ({
    unitPricePaise: item.unitPricePaise,
    quantity: item.quantity,
  })));
  return { isValid: true, errors: [], items: validatedItems, ...totals };
}

export function formatDatabaseCartResult(result: ValidatedCartResult) {
  return {
    ...result,
    formattedSubtotal: formatPaise(result.subtotalPaise),
    formattedDeliveryFee: formatPaise(result.deliveryFeePaise),
    formattedTotal: formatPaise(result.totalPaise),
    items: result.items.map((item) => ({
      ...item,
      formattedUnitPrice: formatPaise(item.unitPricePaise),
      formattedLineTotal: formatPaise(item.lineTotalPaise),
    })),
  };
}
