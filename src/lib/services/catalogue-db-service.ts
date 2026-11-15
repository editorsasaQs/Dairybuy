import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type {
  CategoryMeta,
  ProductCategory,
  ProductItem,
  ProductVariantItem,
} from '@/lib/services/catalogue-service';

type PublicCatalogueRow = Database['public']['Views']['public_catalogue']['Row'];
export type CatalogueQueryClient = SupabaseClient<Database>;

const CATEGORY_IDS = new Set<ProductCategory>([
  'milk', 'canteen-milk', 'ghee', 'butter', 'cheese', 'doi', 'sweets',
]);

/** Images and merchandising flags are presentation metadata, not price/catalogue facts. */
const PRESENTATION: Record<string, { image: string; imageAlt: string; featured?: boolean; breakfastBoxIncluded?: boolean }> = {
  'milk-cow': { image: '/images/products/milk.jpg', imageAlt: 'Bottle of fresh cow milk', featured: true, breakfastBoxIncluded: true },
  'milk-buffalo': { image: '/images/products/milk.jpg', imageAlt: 'Bottle of fresh buffalo milk', featured: true },
  'milk-canteen': { image: '/images/products/milk.jpg', imageAlt: 'Bottle of fresh canteen milk' },
  'ghee-red-cow': { image: '/images/products/ghee.jpg', imageAlt: 'Jar of golden Red Cow ghee', featured: true },
  'ghee-ashirvaad': { image: '/images/products/ghee.jpg', imageAlt: 'Jar of Ashirvaad ghee' },
  'butter-amul': { image: '/images/products/butter.jpg', imageAlt: 'Block of Amul butter', featured: true, breakfastBoxIncluded: true },
  'butter-delicious': { image: '/images/products/butter.jpg', imageAlt: 'Block of Delicious table butter' },
  'cheese-amul-slices': { image: '/images/products/butter.jpg', imageAlt: 'Amul processed cheese slices', featured: true },
  'cheese-amul-blocs': { image: '/images/products/butter.jpg', imageAlt: 'Amul cheese block' },
  'doi-misti': { image: '/images/products/mistidoi.jpg', imageAlt: 'Earthen pot of Misti Doi', featured: true },
  'doi-tok': { image: '/images/products/curd.jpg', imageAlt: 'Bowl of plain Tok Doi', featured: true },
  'sweet-firni': { image: '/images/products/firni.jpg', imageAlt: 'Bowl of creamy Firni', featured: true },
};

const FALLBACK_PRESENTATION: { image: string; imageAlt: string; featured?: boolean; breakfastBoxIncluded?: boolean } = {
  image: '/images/products/milk.jpg',
  imageAlt: 'Dairybuy dairy product',
};

function required<T>(value: T | null, field: string): T {
  if (value === null) throw new Error(`Public catalogue view returned null for required field: ${field}`);
  return value;
}

export function mapPublicCatalogueRows(
  rows: readonly PublicCatalogueRow[],
): { categories: CategoryMeta[]; products: ProductItem[] } {
  const categoryMap = new Map<string, CategoryMeta>();
  const productMap = new Map<string, ProductItem>();

  for (const row of rows) {
    const categoryId = required(row.category_id, 'category_id');
    const categoryName = required(row.category_name, 'category_name');
    if (!CATEGORY_IDS.has(categoryId as ProductCategory)) continue;

    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        id: categoryId as ProductCategory,
        label: categoryName,
        description: row.category_description ?? '',
      });
    }

    const productId = required(row.product_id, 'product_id');
    let product = productMap.get(productId);
    if (!product) {
      const presentation = PRESENTATION[productId] ?? FALLBACK_PRESENTATION;
      product = {
        id: productId,
        categoryId: categoryId as ProductCategory,
        name: required(row.product_name, 'product_name'),
        slug: required(row.product_slug, 'product_slug'),
        subtitle: row.product_subtitle ?? '',
        description: row.product_description ?? '',
        image: presentation.image,
        imageAlt: presentation.imageAlt,
        requiresVendorSelection: required(row.product_requires_vendor_selection, 'product_requires_vendor_selection'),
        productType: required(row.product_type, 'product_type'),
        featured: presentation.featured ?? false,
        ...(presentation.breakfastBoxIncluded === undefined
          ? {}
          : { breakfastBoxIncluded: presentation.breakfastBoxIncluded }),
        variants: [],
      };
      productMap.set(productId, product);
    }

    const variant: ProductVariantItem = {
      id: required(row.variant_id, 'variant_id'),
      productId,
      variantName: required(row.variant_name, 'variant_name'),
      brand: row.variant_brand ?? 'Dairybuy',
      packSize: required(row.variant_pack_size, 'variant_pack_size'),
      packUnit: required(row.variant_pack_unit, 'variant_pack_unit'),
      unitQuantity: Number(required(row.variant_unit_quantity, 'variant_unit_quantity')),
      // Internal costs are intentionally absent from the public database view.
      purchasePricePaise: 0,
      sheetDeliveryComponentPaise: 0,
      finalPricePaise: row.variant_final_price_paise ?? 0,
      isOrderable: row.variant_is_orderable === true,
    };
    (product.variants as ProductVariantItem[]).push(variant);
  }

  const categories: CategoryMeta[] = [
    { id: 'all', label: 'All Essentials', description: 'Everything for your daily kitchen' },
    ...Array.from(categoryMap.values()),
  ];
  const products = Array.from(productMap.values()).map((product) => ({
    ...product,
    variants: [...product.variants].sort(
      (a, b) => a.unitQuantity - b.unitQuantity || a.variantName.localeCompare(b.variantName),
    ),
  }));

  return { categories, products };
}

export async function getDatabaseCatalogue(
  supabase: CatalogueQueryClient,
  requestedCategory: ProductCategory = 'all',
): Promise<{ categories: CategoryMeta[]; products: ProductItem[] }> {
  let query = supabase
    .from('public_catalogue')
    .select(
      'category_id, category_name, category_slug, category_description, category_display_order, product_id, product_name, product_slug, product_subtitle, product_description, product_type, product_requires_vendor_selection, variant_id, variant_name, variant_brand, variant_pack_size, variant_pack_unit, variant_unit_quantity, variant_final_price_paise, variant_is_orderable',
    )
    .order('category_display_order', { ascending: true })
    .order('product_name', { ascending: true })
    .order('variant_name', { ascending: true });

  if (requestedCategory !== 'all') {
    query = query.eq('category_id', requestedCategory);
  }

  const { data, error } = await query;
  if (error) throw error;
  return mapPublicCatalogueRows(data ?? []);
}
