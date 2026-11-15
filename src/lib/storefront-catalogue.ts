import type {
  CatalogueCategoryMeta,
  CatalogueProduct,
  ProductCategory,
} from "@/lib/catalogue";

type ApiVariant = {
  id: string;
  variantName: string;
  brand: string;
  packSize: string;
  finalPricePaise: number;
  isOrderable: boolean;
};

type ApiProduct = {
  id: string;
  slug: string;
  categoryId: ProductCategory;
  name: string;
  subtitle: string;
  description: string;
  image: string;
  imageAlt: string;
  requiresVendorSelection: boolean;
  featured: boolean;
  breakfastBoxIncluded?: boolean;
  variants: ApiVariant[];
};

export type StorefrontCatalogue = {
  categories: CatalogueCategoryMeta[];
  products: CatalogueProduct[];
  totalCount: number;
};

type CatalogueApiResponse = {
  success: boolean;
  data?: {
    categories: Array<{ id: ProductCategory; label: string; description?: string }>;
    products: ApiProduct[];
    totalCount: number;
  };
  error?: string;
};

function storefrontCategory(categoryId: ProductCategory): ProductCategory {
  return categoryId;
}

function categoryGroup(categoryId: ProductCategory): ProductCategory {
  if (categoryId === "doi" || categoryId === "sweets") return "doi";
  return categoryId;
}

export function mapApiCatalogue(payload: CatalogueApiResponse): StorefrontCatalogue {
  if (!payload.success || !payload.data) {
    throw new Error(payload.error || "Unable to load catalogue.");
  }

  const categoryRows: CatalogueCategoryMeta[] = [
    { id: "all", label: "All Essentials", description: "Everything for your daily kitchen" },
    ...payload.data.categories
      .filter((category) => category.id !== "all")
      .map((category): CatalogueCategoryMeta => ({
        id: categoryGroup(category.id),
        label: category.label,
        description: category.description ?? "",
      })),
  ];
  const categories = categoryRows.filter((category, index, all) =>
    all.findIndex((item) => item.id === category.id) === index,
  );

  const products: CatalogueProduct[] = payload.data.products.map((product) => {
    const orderableVariants = product.variants.filter((variant) => variant.isOrderable);
    const pricedVariants = orderableVariants
      .map((variant) => variant.finalPricePaise)
      .filter((price) => Number.isFinite(price) && price > 0);
    const startingPrice = pricedVariants.length
      ? Math.min(...pricedVariants) / 100
      : null;

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      category: categoryGroup(storefrontCategory(product.categoryId)),
      categoryLabel:
        categories.find((category) => category.id === categoryGroup(product.categoryId))?.label ??
        "Dairy Essentials",
      subtitle: product.subtitle,
      image: product.image,
      imageAlt: product.imageAlt,
      featured: product.featured,
      requiresVendorSelection: product.requiresVendorSelection,
      priceInr: startingPrice,
      ...(product.breakfastBoxIncluded === undefined
        ? {}
        : { breakfastBoxIncluded: product.breakfastBoxIncluded }),
      packSize: orderableVariants.map((variant) => variant.packSize).join(" / "),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.variantName,
        brand: variant.brand,
        size: variant.packSize,
        finalPriceInr: variant.finalPricePaise > 0
          ? variant.finalPricePaise / 100
          : null,
        isOrderable: variant.isOrderable,
      })),
    };
  });

  return { categories, products, totalCount: payload.data.totalCount };
}

export async function fetchStorefrontCatalogue(): Promise<StorefrontCatalogue> {
  const response = await fetch("/api/catalogue", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = (await response.json()) as CatalogueApiResponse;
  if (!response.ok) {
    throw new Error(payload.error || "Catalogue is temporarily unavailable.");
  }
  return mapApiCatalogue(payload);
}
