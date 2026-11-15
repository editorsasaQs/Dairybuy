import { describe, expect, it } from 'vitest';
import { CATALOGUE_PRODUCTS } from '@/lib/services/catalogue-service';
import { toPublicCatalogueProduct } from '@/lib/services/catalogue-public';

describe('public catalogue serialization', () => {
  it('never serializes internal purchase or delivery cost fields', () => {
    const serialized = JSON.stringify(CATALOGUE_PRODUCTS.map(toPublicCatalogueProduct));
    expect(serialized).toContain('formattedFinalPrice');
    expect(serialized).not.toContain('purchasePricePaise');
    expect(serialized).not.toContain('sheetDeliveryComponentPaise');
    expect(serialized).not.toContain('formattedPurchasePrice');
    expect(serialized).not.toContain('formattedDeliveryComponent');
  });

  it('retains the customer-facing final selling price', () => {
    const product = CATALOGUE_PRODUCTS.find((item) => item.id === 'ghee-red-cow');
    expect(product).toBeDefined();
    const publicProduct = toPublicCatalogueProduct(product!);
    expect(publicProduct.variants[0]?.finalPricePaise).toBe(17900);
    expect(publicProduct.variants[0]?.formattedFinalPrice).toBe('₹179');
  });
});
