import type { ProductItem, ProductVariantItem } from '@/lib/services/catalogue-service';
import { formatPaise } from '@/lib/services/pricing-service';

/** Explicit customer-facing allowlist; internal costs must remain server-only. */
export type PublicCatalogueVariant = Pick<
  ProductVariantItem,
  'id' | 'productId' | 'variantName' | 'brand' | 'packSize' | 'packUnit' |
  'unitQuantity' | 'finalPricePaise' | 'isOrderable'
> & { formattedFinalPrice: string };

export type PublicCatalogueProduct = Omit<ProductItem, 'variants'> & {
  variants: PublicCatalogueVariant[];
};

export function toPublicCatalogueProduct(product: ProductItem): PublicCatalogueProduct {
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    slug: product.slug,
    subtitle: product.subtitle,
    description: product.description,
    image: product.image,
    imageAlt: product.imageAlt,
    requiresVendorSelection: product.requiresVendorSelection,
    productType: product.productType,
    featured: product.featured,
    ...(product.breakfastBoxIncluded === undefined ? {} : { breakfastBoxIncluded: product.breakfastBoxIncluded }),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      productId: variant.productId,
      variantName: variant.variantName,
      brand: variant.brand,
      packSize: variant.packSize,
      packUnit: variant.packUnit,
      unitQuantity: variant.unitQuantity,
      finalPricePaise: variant.finalPricePaise,
      isOrderable: variant.isOrderable,
      formattedFinalPrice: variant.finalPricePaise > 0
        ? formatPaise(variant.finalPricePaise)
        : 'Vendor pricing',
    })),
  };
}
