/**
 * Dairybuy Phase 4 Catalogue Service
 * All 16 CSV-confirmed non-milk product variants with confirmed purchase prices,
 * sheet delivery components, and final selling prices in integer paise.
 * Authority: latest owner-uploaded `Milk vendor and pricing - updated.csv`.
 */

export type ProductCategory =
  | 'all'
  | 'milk'
  | 'canteen-milk'
  | 'ghee'
  | 'butter'
  | 'cheese'
  | 'doi'
  | 'sweets';

export type ProductVariantItem = {
  id: string;
  productId: string;
  variantName: string;
  brand: string;
  packSize: string;
  packUnit: string;
  unitQuantity: number;
  purchasePricePaise: number;
  sheetDeliveryComponentPaise: number;
  finalPricePaise: number;
  isOrderable: boolean;
};

export type ProductItem = {
  id: string;
  categoryId: ProductCategory;
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  image: string;
  imageAlt: string;
  requiresVendorSelection: boolean;
  productType: 'standard_milk' | 'canteen_milk' | 'grocery_dairy';
  featured: boolean;
  breakfastBoxIncluded?: boolean;
  variants: readonly ProductVariantItem[];
};

export type CategoryMeta = {
  id: ProductCategory;
  label: string;
  description: string;
};

export const CATALOGUE_CATEGORIES: readonly CategoryMeta[] = [
  { id: 'all', label: 'All Essentials', description: 'Everything for your daily kitchen' },
  { id: 'milk', label: 'Fresh Milk', description: 'Cow & buffalo milk from approved vendors' },
  { id: 'canteen-milk', label: 'Canteen Milk', description: 'Budget canteen milk arrangement' },
  { id: 'ghee', label: 'Ghee', description: 'Pure aromatic clarified dairy ghee' },
  { id: 'butter', label: 'Butter', description: 'Fresh table butter in 100g, 200g, and 500g packs' },
  { id: 'cheese', label: 'Cheese', description: 'Processed cheese slices and cooking cheese blocks' },
  { id: 'doi', label: 'Doi', description: 'Authentic Bengali Misti Doi and thick Tok Doi' },
  { id: 'sweets', label: 'Sweets', description: 'Traditional creamy Kolkata Firni' },
] as const;

/**
 * All 16 Confirmed Non-Milk Product Variants from the workbook:
 * GHEE (4), BUTTER (5), CHEESE (4), DOI (2), SWEETS (1).
 */
export const NON_MILK_VARIANTS: readonly ProductVariantItem[] = [
  // GHEE: 4 variants
  {
    id: 'ghee-red-cow-200ml',
    productId: 'ghee-red-cow',
    variantName: 'Red Cow Pure Ghee 200 ml',
    brand: 'Red Cow',
    packSize: '200 ml',
    packUnit: 'ml',
    unitQuantity: 0.2,
    purchasePricePaise: 17000,          // ₹170
    sheetDeliveryComponentPaise: 900,   // ₹9
    finalPricePaise: 17900,             // ₹179
    isOrderable: true,
  },
  {
    id: 'ghee-red-cow-500ml',
    productId: 'ghee-red-cow',
    variantName: 'Red Cow Pure Ghee 500 ml',
    brand: 'Red Cow',
    packSize: '500 ml',
    packUnit: 'ml',
    unitQuantity: 0.5,
    purchasePricePaise: 39000,          // ₹390
    sheetDeliveryComponentPaise: 900,   // ₹9
    finalPricePaise: 39900,             // ₹399
    isOrderable: true,
  },
  {
    id: 'ghee-ashirvaad-200ml',
    productId: 'ghee-ashirvaad',
    variantName: 'Ashirvaad Ghee 200 ml',
    brand: 'Ashirvaad',
    packSize: '200 ml',
    packUnit: 'ml',
    unitQuantity: 0.2,
    purchasePricePaise: 18200,          // ₹182
    sheetDeliveryComponentPaise: 900,   // ₹9
    finalPricePaise: 19100,             // ₹191
    isOrderable: true,
  },
  {
    id: 'ghee-ashirvaad-500ml',
    productId: 'ghee-ashirvaad',
    variantName: 'Ashirvaad Ghee 500 ml',
    brand: 'Ashirvaad',
    packSize: '500 ml',
    packUnit: 'ml',
    unitQuantity: 0.5,
    purchasePricePaise: 43700,          // ₹437
    sheetDeliveryComponentPaise: 900,   // ₹9
    finalPricePaise: 44600,             // ₹446
    isOrderable: true,
  },

  // BUTTER: 5 variants
  {
    id: 'butter-amul-100g',
    productId: 'butter-amul',
    variantName: 'Amul Table Butter 100 g',
    brand: 'Amul',
    packSize: '100 g',
    packUnit: 'g',
    unitQuantity: 0.1,
    purchasePricePaise: 6600,           // ₹66
    sheetDeliveryComponentPaise: 900,   // ₹9
    finalPricePaise: 7500,              // ₹75
    isOrderable: true,
  },
  {
    id: 'butter-amul-200g',
    productId: 'butter-amul',
    variantName: 'Amul Table Butter 200 g',
    brand: 'Amul',
    packSize: '200 g',
    packUnit: 'g',
    unitQuantity: 0.2,
    purchasePricePaise: 13000,          // ₹130
    sheetDeliveryComponentPaise: 900,   // ₹9
    finalPricePaise: 13900,             // ₹139
    isOrderable: true,
  },
  {
    id: 'butter-amul-500g',
    productId: 'butter-amul',
    variantName: 'Amul Table Butter 500 g',
    brand: 'Amul',
    packSize: '500 g',
    packUnit: 'g',
    unitQuantity: 0.5,
    purchasePricePaise: 30500,          // ₹305
    sheetDeliveryComponentPaise: 900,   // ₹9
    finalPricePaise: 31400,             // ₹314
    isOrderable: true,
  },
  {
    id: 'butter-delicious-100g',
    productId: 'butter-delicious',
    variantName: 'Delicious Table Butter 100 g',
    brand: 'Delicious',
    packSize: '100 g',
    packUnit: 'g',
    unitQuantity: 0.1,
    purchasePricePaise: 2200,           // ₹22
    sheetDeliveryComponentPaise: 1100,  // ₹11
    finalPricePaise: 3300,              // ₹33
    isOrderable: true,
  },
  {
    id: 'butter-delicious-500g',
    productId: 'butter-delicious',
    variantName: 'Delicious Table Butter 500 g',
    brand: 'Delicious',
    packSize: '500 g',
    packUnit: 'g',
    unitQuantity: 0.5,
    purchasePricePaise: 11700,          // ₹117
    sheetDeliveryComponentPaise: 900,   // ₹9
    finalPricePaise: 12600,             // ₹126
    isOrderable: true,
  },

  // CHEESE: 4 variants
  {
    id: 'cheese-amul-slices-100g',
    productId: 'cheese-amul-slices',
    variantName: 'Amul Cheese Slices 100 g',
    brand: 'Amul',
    packSize: '100 g',
    packUnit: 'g',
    unitQuantity: 0.1,
    purchasePricePaise: 8200,           // ₹82
    sheetDeliveryComponentPaise: 1100,  // ₹11
    finalPricePaise: 9300,              // ₹93
    isOrderable: true,
  },
  {
    id: 'cheese-amul-slices-200g',
    productId: 'cheese-amul-slices',
    variantName: 'Amul Cheese Slices 200 g',
    brand: 'Amul',
    packSize: '200 g',
    packUnit: 'g',
    unitQuantity: 0.2,
    purchasePricePaise: 14500,          // ₹145
    sheetDeliveryComponentPaise: 900,   // ₹9
    finalPricePaise: 15400,             // ₹154
    isOrderable: true,
  },
  {
    id: 'cheese-amul-blocs-200g',
    productId: 'cheese-amul-blocs',
    variantName: 'Amul Cheese Blocs 200 g',
    brand: 'Amul',
    packSize: '200 g',
    packUnit: 'g',
    unitQuantity: 0.2,
    purchasePricePaise: 13000,          // ₹130
    sheetDeliveryComponentPaise: 1100,  // ₹11
    finalPricePaise: 14100,             // ₹141
    isOrderable: true,
  },
  {
    id: 'cheese-amul-blocs-500g',
    productId: 'cheese-amul-blocs',
    variantName: 'Amul Cheese Blocs 500 g',
    brand: 'Amul',
    packSize: '500 g',
    packUnit: 'g',
    unitQuantity: 0.5,
    purchasePricePaise: 30000,          // ₹300
    sheetDeliveryComponentPaise: 900,   // ₹9
    finalPricePaise: 30900,             // ₹309
    isOrderable: true,
  },

  // DOI: 2 variants
  {
    id: 'doi-misti-100g',
    productId: 'doi-misti',
    variantName: 'Misti Doi 100 g',
    brand: 'Misti Doi',
    packSize: '100 g',
    packUnit: 'g',
    unitQuantity: 0.1,
    purchasePricePaise: 3500,           // ₹35
    sheetDeliveryComponentPaise: 900,   // ₹9
    finalPricePaise: 4400,              // ₹44
    isOrderable: true,
  },
  {
    id: 'doi-tok-100g',
    productId: 'doi-tok',
    variantName: 'Tok Doi 100 g',
    brand: 'Tok Doi',
    packSize: '100 g',
    packUnit: 'g',
    unitQuantity: 0.1,
    purchasePricePaise: 2500,           // ₹25
    sheetDeliveryComponentPaise: 900,   // ₹9
    finalPricePaise: 3400,              // ₹34
    isOrderable: true,
  },

  // SWEETS: 1 variant
  {
    id: 'sweet-firni-1pc',
    productId: 'sweet-firni',
    variantName: 'Firni 1 piece',
    brand: 'Firni',
    packSize: '1 piece',
    packUnit: 'piece',
    unitQuantity: 1.0,
    purchasePricePaise: 3500,           // ₹35
    sheetDeliveryComponentPaise: 900,   // ₹9
    finalPricePaise: 4400,              // ₹44
    isOrderable: true,
  },
] as const;

/**
 */
export const ALL_PRODUCT_VARIANTS: readonly ProductVariantItem[] = [
  ...NON_MILK_VARIANTS,
];

/** Full products listing with mapped variants */
export const CATALOGUE_PRODUCTS: readonly ProductItem[] = [
  {
    id: 'milk-cow',
    categoryId: 'milk',
    name: 'Fresh Cow Milk',
    slug: 'cow-milk',
    subtitle: '500 ml & 1 L from approved Kolkata milk vendors',
    description: 'Pure, wholesome cow milk collected daily from approved milk vendors.',
    image: '/images/products/milk.jpg',
    imageAlt: 'Bottle of fresh cow milk',
    requiresVendorSelection: true,
    productType: 'standard_milk',
    featured: true,
    breakfastBoxIncluded: true,
    variants: [
      {
        id: 'milk-cow-500ml',
        productId: 'milk-cow',
        variantName: 'Cow Milk 500 ml',
        brand: 'Dairybuy Standard',
        packSize: '500 ml',
        packUnit: 'ml',
        unitQuantity: 0.5,
        purchasePricePaise: 0,
        sheetDeliveryComponentPaise: 0,
        finalPricePaise: 0, // Varies by vendor
        isOrderable: true,
      },
      {
        id: 'milk-cow-1l',
        productId: 'milk-cow',
        variantName: 'Cow Milk 1 L',
        brand: 'Dairybuy Standard',
        packSize: '1 L',
        packUnit: 'L',
        unitQuantity: 1.0,
        purchasePricePaise: 0,
        sheetDeliveryComponentPaise: 0,
        finalPricePaise: 0, // Varies by vendor
        isOrderable: true,
      },
    ],
  },
  {
    id: 'milk-buffalo',
    categoryId: 'milk',
    name: 'Fresh Buffalo Milk',
    slug: 'buffalo-milk',
    subtitle: 'Rich, full-cream buffalo milk from approved vendors',
    description: 'High-fat buffalo milk suitable for rich cooking, chai, and traditional homemade sweets.',
    image: '/images/products/milk.jpg',
    imageAlt: 'Bottle of fresh buffalo milk',
    requiresVendorSelection: true,
    productType: 'standard_milk',
    featured: true,
    variants: [
      {
        id: 'milk-buffalo-500ml',
        productId: 'milk-buffalo',
        variantName: 'Buffalo Milk 500 ml',
        brand: 'Dairybuy Standard',
        packSize: '500 ml',
        packUnit: 'ml',
        unitQuantity: 0.5,
        purchasePricePaise: 0,
        sheetDeliveryComponentPaise: 0,
        finalPricePaise: 0, // Varies by vendor
        isOrderable: true,
      },
      {
        id: 'milk-buffalo-1l',
        productId: 'milk-buffalo',
        variantName: 'Buffalo Milk 1 L',
        brand: 'Dairybuy Standard',
        packSize: '1 L',
        packUnit: 'L',
        unitQuantity: 1.0,
        purchasePricePaise: 0,
        sheetDeliveryComponentPaise: 0,
        finalPricePaise: 0, // Varies by vendor
        isOrderable: true,
      },
    ],
  },
  {
    id: 'milk-canteen',
    categoryId: 'canteen-milk',
    name: 'Canteen Milk',
    slug: 'canteen-milk',
    subtitle: 'Single-vendor budget arrangement (₹38 / 500 ml, ₹60 / 1 L)',
    description: 'Direct supply via Canteen Milk Centre with confirmed delivery fee included.',
    image: '/images/products/milk.jpg',
    imageAlt: 'Bottle of fresh canteen milk',
    requiresVendorSelection: false,
    productType: 'canteen_milk',
    featured: false,
    variants: [
      {
        id: 'milk-canteen-500ml',
        productId: 'milk-canteen',
        variantName: 'Canteen Milk 500 ml',
        brand: 'Canteen Milk Centre',
        packSize: '500 ml',
        packUnit: 'ml',
        unitQuantity: 0.5,
        purchasePricePaise: 2900,
        sheetDeliveryComponentPaise: 900,
        finalPricePaise: 3800,
        isOrderable: true,
      },
      {
        id: 'milk-canteen-1l',
        productId: 'milk-canteen',
        variantName: 'Canteen Milk 1 L',
        brand: 'Canteen Milk Centre',
        packSize: '1 L',
        packUnit: 'L',
        unitQuantity: 1.0,
        purchasePricePaise: 5200,
        sheetDeliveryComponentPaise: 800,
        finalPricePaise: 6000,
        isOrderable: true,
      },
    ],
  },
  {
    id: 'ghee-red-cow',
    categoryId: 'ghee',
    name: 'Red Cow Pure Ghee',
    slug: 'red-cow-ghee',
    subtitle: 'Heritage granular ghee (200 ml ₹179, 500 ml ₹399)',
    description: 'Rich aroma and golden texture from Red Cow.',
    image: '/images/products/ghee.jpg',
    imageAlt: 'Jar of golden Red Cow ghee',
    requiresVendorSelection: false,
    productType: 'grocery_dairy',
    featured: true,
    variants: NON_MILK_VARIANTS.filter((v) => v.productId === 'ghee-red-cow'),
  },
  {
    id: 'ghee-ashirvaad',
    categoryId: 'ghee',
    name: 'Ashirvaad Ghee',
    slug: 'ashirvaad-ghee',
    subtitle: 'Slow-cooked pure cow ghee (200 ml ₹191, 500 ml ₹446)',
    description: 'Golden aroma crafted with slow-cooking process.',
    image: '/images/products/ghee.jpg',
    imageAlt: 'Jar of Aashirvaad pure ghee',
    requiresVendorSelection: false,
    productType: 'grocery_dairy',
    featured: false,
    variants: NON_MILK_VARIANTS.filter((v) => v.productId === 'ghee-ashirvaad'),
  },
  {
    id: 'butter-amul',
    categoryId: 'butter',
    name: 'Amul Butter',
    slug: 'amul-butter',
    subtitle: 'Classic pasteurized salted butter (100 g ₹75, 200 g ₹139, 500 g ₹314)',
    description: "India's staple table butter for toast and morning parathas.",
    image: '/images/products/butter.jpg',
    imageAlt: 'Block of Amul butter',
    requiresVendorSelection: false,
    productType: 'grocery_dairy',
    featured: true,
    breakfastBoxIncluded: true,
    variants: NON_MILK_VARIANTS.filter((v) => v.productId === 'butter-amul'),
  },
  {
    id: 'butter-delicious',
    categoryId: 'butter',
    name: 'Delicious Butter',
    slug: 'delicious-butter',
    subtitle: 'Creamy everyday table butter (100 g ₹33, 500 g ₹126)',
    description: 'Smooth, budget-friendly dairy table spread.',
    image: '/images/products/butter.jpg',
    imageAlt: 'Block of Delicious table butter',
    requiresVendorSelection: false,
    productType: 'grocery_dairy',
    featured: false,
    variants: NON_MILK_VARIANTS.filter((v) => v.productId === 'butter-delicious'),
  },
  {
    id: 'cheese-amul-slices',
    categoryId: 'cheese',
    name: 'Amul Cheese Slices',
    slug: 'amul-cheese-slices',
    subtitle: 'Individually wrapped slices (100 g ₹93, 200 g ₹154)',
    description: 'Convenient processed cheese slices for breakfast sandwiches.',
    image: '/images/products/butter.jpg',
    imageAlt: 'Amul processed cheese slices',
    requiresVendorSelection: false,
    productType: 'grocery_dairy',
    featured: true,
    variants: NON_MILK_VARIANTS.filter((v) => v.productId === 'cheese-amul-slices'),
  },
  {
    id: 'cheese-amul-blocs',
    categoryId: 'cheese',
    name: 'Amul Cheese Blocs',
    slug: 'amul-cheese-blocs',
    subtitle: 'Cooking cheese block (200 g ₹141, 500 g ₹309)',
    description: 'Solid cheese block for grating over dosa, pasta, and parathas.',
    image: '/images/products/butter.jpg',
    imageAlt: 'Amul cheese bloc',
    requiresVendorSelection: false,
    productType: 'grocery_dairy',
    featured: false,
    variants: NON_MILK_VARIANTS.filter((v) => v.productId === 'cheese-amul-blocs'),
  },
  {
    id: 'doi-misti',
    categoryId: 'doi',
    name: 'Misti Doi',
    slug: 'misti-doi',
    subtitle: 'Classic Bengali sweetened curd (100 g ₹44)',
    description: 'Rich, caramelized earthen pot Bengali sweet curd.',
    image: '/images/products/mistidoi.jpg',
    imageAlt: 'Earthen pot of Misti Doi',
    requiresVendorSelection: false,
    productType: 'grocery_dairy',
    featured: true,
    variants: NON_MILK_VARIANTS.filter((v) => v.productId === 'doi-misti'),
  },
  {
    id: 'doi-tok',
    categoryId: 'doi',
    name: 'Tok Doi',
    slug: 'tok-doi',
    subtitle: 'Thick plain unsweetened curd (100 g ₹34)',
    description: 'Everyday fresh curd for lunch, raita, and marinades.',
    image: '/images/products/curd.jpg',
    imageAlt: 'Bowl of plain white Tok Doi',
    requiresVendorSelection: false,
    productType: 'grocery_dairy',
    featured: true,
    variants: NON_MILK_VARIANTS.filter((v) => v.productId === 'doi-tok'),
  },
  {
    id: 'sweet-firni',
    categoryId: 'sweets',
    name: 'Firni',
    slug: 'firni',
    subtitle: 'Slow-cooked creamy rice dessert (1 piece ₹44)',
    description: 'Cardamom and saffron-flavoured Kolkata chilled pudding.',
    image: '/images/products/firni.jpg',
    imageAlt: 'Bowl of chilled creamy Firni',
    requiresVendorSelection: false,
    productType: 'grocery_dairy',
    featured: true,
    variants: NON_MILK_VARIANTS.filter((v) => v.productId === 'sweet-firni'),
  },

];

export function findProductById(productId: string): ProductItem | undefined {
  return CATALOGUE_PRODUCTS.find((p) => p.id === productId);
}

export function findVariantById(variantId: string): ProductVariantItem | undefined {
  for (const product of CATALOGUE_PRODUCTS) {
    const match = product.variants.find((v) => v.id === variantId);
    if (match) return match;
  }
  return undefined;
}

export function getProductsByCategory(categoryId: ProductCategory): readonly ProductItem[] {
  if (categoryId === 'all') {
    return CATALOGUE_PRODUCTS;
  }
  return CATALOGUE_PRODUCTS.filter((p) => p.categoryId === categoryId);
}
