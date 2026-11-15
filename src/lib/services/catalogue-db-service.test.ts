import { describe, expect, it } from 'vitest';
import { mapPublicCatalogueRows } from '@/lib/services/catalogue-db-service';
import { toPublicCatalogueProduct } from '@/lib/services/catalogue-public';
import type { Database } from '@/lib/supabase/types';

type Row = Database['public']['Views']['public_catalogue']['Row'];
const rows: Row[] = [
  {
    category_id: 'milk', category_name: 'Fresh Milk', category_slug: 'fresh-milk',
    category_description: 'Cow and buffalo milk', category_display_order: 1,
    product_id: 'milk-cow', product_name: 'Cow Milk', product_slug: 'cow-milk',
    product_subtitle: null, product_description: 'Fresh cow milk',
    product_type: 'standard_milk', product_requires_vendor_selection: true,
    variant_id: 'milk-cow-500ml', variant_name: 'Cow Milk 500 ml',
    variant_brand: 'Dairybuy Standard', variant_pack_size: '500 ml',
    variant_pack_unit: 'ml', variant_unit_quantity: 0.5,
    variant_final_price_paise: null, variant_is_orderable: true,
  },
  {
    category_id: 'ghee', category_name: 'Pure Ghee', category_slug: 'pure-ghee',
    category_description: null, category_display_order: 3,
    product_id: 'ghee-red-cow', product_name: 'Red Cow Ghee', product_slug: 'red-cow-ghee',
    product_subtitle: 'Pure ghee', product_description: 'Ghee',
    product_type: 'grocery_dairy', product_requires_vendor_selection: false,
    variant_id: 'ghee-red-cow-200ml', variant_name: 'Red Cow Ghee 200 ml',
    variant_brand: 'Red Cow', variant_pack_size: '200 ml',
    variant_pack_unit: 'ml', variant_unit_quantity: 0.2,
    variant_final_price_paise: 17900, variant_is_orderable: true,
  },
];

describe('Supabase public catalogue mapping', () => {
  it('maps view rows to active customer categories, products and variants', () => {
    const result = mapPublicCatalogueRows(rows);
    expect(result.categories.map((category) => category.id)).toEqual(['all', 'milk', 'ghee']);
    expect(result.products.map((product) => product.id)).toEqual(['milk-cow', 'ghee-red-cow']);
    expect(result.products[0]?.requiresVendorSelection).toBe(true);
    expect(result.products[1]?.variants[0]?.finalPricePaise).toBe(17900);
  });

  it('labels null vendor-specific milk prices without showing a false ₹0 price', () => {
    const result = mapPublicCatalogueRows(rows);
    const milk = toPublicCatalogueProduct(result.products[0]!);
    expect(milk.variants[0]?.formattedFinalPrice).toBe('Vendor pricing');
  });

  it('keeps the customer DTO free of internal cost fields', () => {
    const result = mapPublicCatalogueRows(rows);
    const serialized = JSON.stringify(result.products.map(toPublicCatalogueProduct));
    expect(serialized).not.toContain('purchasePricePaise');
    expect(serialized).not.toContain('sheetDeliveryComponentPaise');
    expect(serialized).toContain('finalPricePaise');
  });
});
