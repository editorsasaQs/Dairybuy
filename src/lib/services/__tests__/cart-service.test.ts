import { describe, expect, it } from 'vitest';
import { validateAndCalculateCart } from '../cart-service';

describe('CSV-authoritative cart calculation', () => {
  it('recomputes the complete customer price and ignores browser-submitted amounts', () => {
    const result = validateAndCalculateCart([
      { key:'vip-cow', productVariantId:'milk-cow-1l', vendorId:'vip-pure', milkType:'cow', litres:1, quantity:2, clientReportedPricePaise:1 },
      { key:'ghee', productVariantId:'ghee-red-cow-200ml', quantity:1, clientReportedPricePaise:10 },
    ]);
    expect(result.isValid).toBe(true);
    expect(result.items[0]?.unitPricePaise).toBe(9900);
    expect(result.items[0]?.lineTotalPaise).toBe(19800);
    expect(result.items[1]?.unitPricePaise).toBe(17900);
    expect(result.subtotalPaise).toBe(37700);
    expect(result.deliveryFeePaise).toBe(0);
    expect(result.totalPaise).toBe(37700);
  });

  it('calculates custom volume with the 1 L delivery component applied once', () => {
    const result = validateAndCalculateCart([{
      key:'healthy-cow-15', productVariantId:'milk-cow-1l',
      vendorId:'healthy-haryana', milkType:'cow', litres:1.5, quantity:1,
    }]);
    expect(result.isValid).toBe(true);
    expect(result.items[0]?.unitPricePaise).toBe(12600);
    expect(result.totalPaise).toBe(12600);
  });

  it('rejects vendors whose ordering is disabled', () => {
    const result = validateAndCalculateCart([{
      key:'pending', productVariantId:'milk-cow-500ml',
      vendorId:'fresh-punjab', milkType:'cow', litres:0.5, quantity:1,
    }]);
    expect(result.isValid).toBe(false);
  });

  it('uses the Canteen CSV total as the complete line price', () => {
    const result = validateAndCalculateCart([{
      key:'canteen-1l', productVariantId:'milk-canteen-1l',
      vendorId:'canteen-milk-centre', milkType:'canteen', litres:1, quantity:1,
    }]);
    expect(result.isValid).toBe(true);
    expect(result.items[0]?.unitPricePaise).toBe(6000);
    expect(result.deliveryFeePaise).toBe(0);
    expect(result.totalPaise).toBe(6000);
  });

  it('does not add another delivery fee to a mixed cart', () => {
    const result = validateAndCalculateCart([
      { key:'canteen-500', productVariantId:'milk-canteen-500ml', vendorId:'canteen-milk-centre', milkType:'canteen', litres:0.5, quantity:1 },
      { key:'ghee', productVariantId:'ghee-red-cow-200ml', quantity:1 },
    ]);
    expect(result.isValid).toBe(true);
    expect(result.subtotalPaise).toBe(21700);
    expect(result.deliveryFeePaise).toBe(0);
    expect(result.totalPaise).toBe(21700);
  });

  it('prices each CSV final catalogue line without a global delivery fee', () => {
    const result = validateAndCalculateCart([
      { key:'ghee', productVariantId:'ghee-red-cow-200ml', quantity:2 },
      { key:'doi', productVariantId:'doi-misti-100g', quantity:3 },
    ]);
    expect(result.isValid).toBe(true);
    expect(result.subtotalPaise).toBe(49000);
    expect(result.deliveryFeePaise).toBe(0);
    expect(result.totalPaise).toBe(49000);
  });
});
