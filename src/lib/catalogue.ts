export type ProductCategory =
  | "all"
  | "milk"
  | "canteen-milk"
  | "ghee"
  | "butter"
  | "cheese"
  | "doi"
  | "sweets";

export type CatalogueCategoryMeta = {
  id: ProductCategory;
  label: string;
  description?: string;
};

export type ProductVariant = {
  id: string;
  name: string;
  brand: string;
  size: string;
  finalPriceInr: number | null;
  isOrderable: boolean;
};

/** Customer-safe storefront model. Never add internal purchase-cost fields here. */
export type CatalogueProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: ProductCategory;
  categoryLabel: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  featured: boolean;
  breakfastBoxIncluded?: boolean;
  requiresVendorSelection: boolean;
  priceInr: number | null;
  packSize?: string;
  variants: readonly ProductVariant[];
};

export function filterCatalogueProducts(
  products: readonly CatalogueProduct[],
  category: ProductCategory,
  query: string,
): readonly CatalogueProduct[] {
  const trimmed = query.trim().toLowerCase();
  return products.filter((product) => {
    if (category !== "all" && product.category !== category) return false;
    if (!trimmed) return true;
    return (
      product.name.toLowerCase().includes(trimmed) ||
      product.subtitle.toLowerCase().includes(trimmed) ||
      product.categoryLabel.toLowerCase().includes(trimmed) ||
      product.variants.some((variant) =>
        [variant.name, variant.brand, variant.size].some((value) =>
          value.toLowerCase().includes(trimmed),
        ),
      )
    );
  });
}
