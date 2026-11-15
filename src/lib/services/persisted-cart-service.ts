import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, MilkType, Tables } from '@/lib/supabase/types';
import type { ClientCartItemInput, ValidatedCartResult } from './cart-service';
import { validateAndCalculateDatabaseCart } from './database-cart-service';
import { catalogueBagKey } from '@/lib/bag';

type CartLineRow = Pick<Tables<'cart_items'>,
  'id' | 'product_variant_id' | 'vendor_id' | 'milk_type' | 'quantity' | 'quantity_litres'
>;
type VariantRow = Pick<Tables<'product_variants'>,
  'id' | 'product_id' | 'variant_name' | 'brand' | 'unit_quantity'
>;
type ProductRow = Pick<Tables<'products'>,
  'id' | 'name' | 'product_type'
>;
type ProductImageRow = Pick<Tables<'product_images'>,
  'product_id' | 'image_url' | 'is_primary' | 'display_order'
>;
type VendorRow = Pick<Tables<'vendors'>, 'id' | 'name'>;

export type PersistedBagItem = {
  key: string;
  kind: 'catalogue' | 'milk';
  productId: string;
  productVariantId: string;
  name: string;
  image: string;
  detail: string;
  vendorName?: string;
  milkType?: MilkType;
  litres?: number;
  unitPriceInr: number | null;
  quantity: number;
};

export type ActiveCartSnapshot = {
  userId: string;
  cartId: string | null;
  items: PersistedBagItem[];
  validationErrors: string[];
};

function lineIdentity(item:
  | { productVariantId: string; vendorId?: string | null; milkType?: MilkType | null; litres?: number | null }
  | { product_variant_id: string; vendor_id: string | null; milk_type: MilkType | null; quantity_litres?: number | null }
) {
  if ('productVariantId' in item) {
    return [item.productVariantId, item.vendorId ?? '', item.milkType ?? '', 'litres' in item ? item.litres ?? '' : ''].join(':');
  }
  return [item.product_variant_id, item.vendor_id ?? '', item.milk_type ?? '', 'quantity_litres' in item ? item.quantity_litres ?? '' : ''].join(':');
}

export async function replaceAuthenticatedCart(
  supabase: SupabaseClient<Database>,
  input: readonly ClientCartItemInput[],
): Promise<{ cartId: string | null; validation: ValidatedCartResult }> {
  const validation = await validateAndCalculateDatabaseCart(supabase, input);
  if (!validation.isValid) return { cartId: null, validation };

  const payload: Json[] = validation.items.map((item) => ({
    product_variant_id: item.productVariantId,
    vendor_id: item.vendorId,
    milk_type: item.milkType,
    quantity: item.quantity,
    unit_price_paise: item.unitPricePaise,
    quantity_litres: item.litres,
  }));
  const { data, error } = await supabase.rpc('sync_active_cart', { p_items: payload });
  if (error) throw new Error('Unable to save your cart securely.');
  return { cartId: data, validation };
}

export async function clearAuthenticatedCart(
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const { error } = await supabase.rpc('sync_active_cart', { p_items: [] });
  if (error) throw new Error('Unable to clear your saved cart.');
}

export async function loadAuthenticatedCart(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ActiveCartSnapshot> {
  const { data: cart, error: cartError } = await supabase
    .from('carts')
    .select('id')
    .eq('customer_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (cartError) throw new Error('Unable to load your saved cart.');
  if (!cart) return { userId, cartId: null, items: [], validationErrors: [] };

  const { data: rawLines, error: linesError } = await supabase
    .from('cart_items')
    .select('id,product_variant_id,vendor_id,milk_type,quantity,quantity_litres')
    .eq('cart_id', cart.id);
  if (linesError) throw new Error('Unable to load your saved cart items.');
  const lines = (rawLines ?? []) as CartLineRow[];
  if (lines.length === 0) return { userId, cartId: cart.id, items: [], validationErrors: [] };

  const variantIds = [...new Set(lines.map((line) => line.product_variant_id))];
  const vendorIds = [...new Set(lines.map((line) => line.vendor_id).filter((id): id is string => Boolean(id)))];
  const [variantResult, vendorResult] = await Promise.all([
    supabase.from('product_variants')
      .select('id,product_id,variant_name,brand,unit_quantity')
      .in('id', variantIds),
    vendorIds.length
      ? supabase.from('vendors').select('id,name').in('id', vendorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (variantResult.error || vendorResult.error) throw new Error('Unable to load saved product details.');

  const variants = (variantResult.data ?? []) as VariantRow[];
  const productIds = [...new Set(variants.map((variant) => variant.product_id))];
  const [productResult, imageResult] = await Promise.all([
    productIds.length
      ? supabase.from('products').select('id,name,product_type').in('id', productIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? supabase.from('product_images').select('product_id,image_url,is_primary,display_order').in('product_id', productIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (productResult.error || imageResult.error) throw new Error('Unable to load saved product details.');

  const variantById = new Map(((variantResult.data ?? []) as VariantRow[]).map((row) => [row.id, row]));
  const productById = new Map(((productResult.data ?? []) as ProductRow[]).map((row) => [row.id, row]));
  const vendorById = new Map(((vendorResult.data ?? []) as VendorRow[]).map((row) => [row.id, row]));
  const imageByProduct = new Map<string, string>();
  const images = [...((imageResult.data ?? []) as ProductImageRow[])].sort((a, b) =>
    Number(b.is_primary) - Number(a.is_primary) || a.display_order - b.display_order,
  );
  for (const image of images) {
    if (!imageByProduct.has(image.product_id)) imageByProduct.set(image.product_id, image.image_url);
  }

  const validationInput: ClientCartItemInput[] = [];
  for (const line of lines) {
    const variant = variantById.get(line.product_variant_id);
    if (!variant) continue;
    const product = productById.get(variant.product_id);
    const isMilk = product?.product_type === 'standard_milk' || product?.product_type === 'canteen_milk';
    validationInput.push({
      key: line.id,
      productVariantId: line.product_variant_id,
      vendorId: line.vendor_id,
      milkType: line.milk_type,
      ...(isMilk ? { litres: Number(line.quantity_litres ?? variant.unit_quantity) } : {}),
      quantity: line.quantity,
    });
  }
  const validation = validationInput.length
    ? await validateAndCalculateDatabaseCart(supabase, validationInput)
    : { isValid: false, errors: ['One or more saved products are no longer available.'], items: [], subtotalPaise: 0, deliveryFeePaise: 0, totalPaise: 0 };

  const priceByIdentity = new Map(
    validation.items.map((item) => [lineIdentity(item), item.unitPricePaise / 100]),
  );
  const resultItems: PersistedBagItem[] = [];
  for (const line of lines) {
    const variant = variantById.get(line.product_variant_id);
    const product = variant ? productById.get(variant.product_id) : undefined;
    if (!variant || !product) continue;
    const isMilk = product.product_type === 'standard_milk' || product.product_type === 'canteen_milk';
    const milkType = line.milk_type ?? undefined;
    const litres = isMilk ? Number(line.quantity_litres ?? variant.unit_quantity) : undefined;
    const key = isMilk && line.vendor_id && milkType
      ? `milk:${line.vendor_id}:${milkType}:${litres}`
      : catalogueBagKey(product.id, variant.id);
    const item: PersistedBagItem = {
      key,
      kind: isMilk ? 'milk' : 'catalogue',
      productId: isMilk && line.vendor_id && milkType
        ? `milk-${line.vendor_id}-${milkType}`
        : product.id,
      productVariantId: variant.id,
      name: product.name,
      image: imageByProduct.get(product.id) ?? '/images/original/hello.jpg',
      detail: variant.variant_name,
      unitPriceInr: priceByIdentity.get(lineIdentity(line)) ?? null,
      quantity: line.quantity,
    };
    if (isMilk && line.vendor_id && milkType) {
      item.vendorName = vendorById.get(line.vendor_id)?.name ?? 'Selected milk vendor';
      item.milkType = milkType;
      if (litres !== undefined) item.litres = litres;
    }
    resultItems.push(item);
  }

  return {
    userId,
    cartId: cart.id,
    items: resultItems,
    validationErrors: validation.errors,
  };
}
