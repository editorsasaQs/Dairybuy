import { describe, expect, it } from 'vitest';
import {
  calculateMilkDeliveryPricePaise,
  calculateOrderTotals,
  calculateSubscriptionBasketTotals,
  DELIVERY_FEE_PAISE,
  formatPaise,
  isSupportedMilkLitres,
  paiseToRupees,
  rupeesToPaise,
  SUBSCRIPTION_30_DAY_DISCOUNT_PAISE,
  validateProductPriceComponents,
} from '../pricing-service';
import { NON_MILK_VARIANTS } from '../catalogue-service';
import { CONFIRMED_MILK_PRICING } from '../vendor-service';

describe('CSV-backed pricing service', () => {
  it('converts paise and formats rupees without float drift', () => {
    expect(paiseToRupees(5000)).toBe(50);
    expect(rupeesToPaise(85)).toBe(8500);
    expect(formatPaise(17900)).toBe('₹179');
  });

  it('never adds a generic order-level delivery fee', () => {
    expect(DELIVERY_FEE_PAISE).toBe(0);
    const totals = calculateOrderTotals([{ unitPricePaise: 17900, quantity: 1 }]);
    expect(totals).toEqual({ subtotalPaise: 17900, deliveryFeePaise: 0, totalPaise: 17900 });
  });

  it('validates all 16 non-milk CSV component equations', () => {
    expect(NON_MILK_VARIANTS).toHaveLength(16);
    for (const variant of NON_MILK_VARIANTS) {
      expect(validateProductPriceComponents(
        variant.purchasePricePaise,
        variant.sheetDeliveryComponentPaise,
        variant.finalPricePaise,
      )).toBe(true);
    }
  });

  it('calculates Healthy Haryana cow volume with one delivery component', () => {
    const base = { price500mlPaise: 4100, delivery500mlPaise: 900, price1lPaise: 7800, delivery1lPaise: 700 };
    expect(calculateMilkDeliveryPricePaise({ litres: 0.5, ...base })).toBe(5000);
    expect(calculateMilkDeliveryPricePaise({ litres: 1, ...base })).toBe(8500);
    expect(calculateMilkDeliveryPricePaise({ litres: 1.5, ...base })).toBe(12600);
    expect(calculateMilkDeliveryPricePaise({ litres: 2, ...base })).toBe(16300);
    expect(calculateMilkDeliveryPricePaise({ litres: 2.5, ...base })).toBe(20400);
    expect(calculateMilkDeliveryPricePaise({ litres: 10, ...base })).toBe(78700);
  });

  it('calculates Canteen using its own CSV component values', () => {
    const base = { price500mlPaise: 2900, delivery500mlPaise: 900, price1lPaise: 5200, delivery1lPaise: 800 };
    expect(calculateMilkDeliveryPricePaise({ litres: 0.5, ...base })).toBe(3800);
    expect(calculateMilkDeliveryPricePaise({ litres: 1, ...base })).toBe(6000);
    expect(calculateMilkDeliveryPricePaise({ litres: 1.5, ...base })).toBe(8900);
    expect(calculateMilkDeliveryPricePaise({ litres: 10, ...base })).toBe(52800);
  });

  it('rejects volumes outside 0.5–10 L or not in 0.5 L increments', () => {
    expect(isSupportedMilkLitres(0.5)).toBe(true);
    expect(isSupportedMilkLitres(10)).toBe(true);
    for (const litres of [0.25,0.75,1.25,10.5,Number.NaN]) {
      expect(isSupportedMilkLitres(litres)).toBe(false);
      expect(calculateMilkDeliveryPricePaise({
        litres, price500mlPaise:4100, delivery500mlPaise:900, price1lPaise:7800, delivery1lPaise:700,
      })).toBeNull();
    }
  });

  it('reconciles all 14 approved milk price rows and their 7/30-day totals', () => {
    expect(CONFIRMED_MILK_PRICING).toHaveLength(14);
    for (const row of CONFIRMED_MILK_PRICING) {
      expect(row.totalCustomerPerDeliveryPaise).toBe(row.pricePerDeliveryPaise + row.deliveryFeePaise);
      expect(row.plan7DayPaise).toBe(row.totalCustomerPerDeliveryPaise * 7);
      expect(row.plan30DayPaise).toBe(row.totalCustomerPerDeliveryPaise * 30);
    }
  });

  it('calculates 70 approved vendor/type/volume combinations from the CSV base rows', () => {
    const profiles = CONFIRMED_MILK_PRICING.filter((row, index, rows) =>
      rows.findIndex((candidate) => candidate.vendorId === row.vendorId && candidate.milkType === row.milkType) === index,
    );
    const volumes = [0.5,1,1.5,2,2.5,3,5,9,9.5,10];
    let checked = 0;
    for (const profile of profiles) {
      const half = CONFIRMED_MILK_PRICING.find((row) => row.vendorId === profile.vendorId && row.milkType === profile.milkType && row.packSize === '500 ml')!;
      const one = CONFIRMED_MILK_PRICING.find((row) => row.vendorId === profile.vendorId && row.milkType === profile.milkType && row.packSize === '1 L')!;
      for (const litres of volumes) {
        const price = calculateMilkDeliveryPricePaise({
          litres,
          price500mlPaise: half.pricePerDeliveryPaise,
          delivery500mlPaise: half.deliveryFeePaise,
          price1lPaise: one.pricePerDeliveryPaise,
          delivery1lPaise: one.deliveryFeePaise,
        });
        expect(price).not.toBeNull();
        checked += 1;
      }
    }
    expect(checked).toBe(70);
  });

  it('applies ₹60 once to a complete 30-day subscription basket, never per line', () => {
    expect(SUBSCRIPTION_30_DAY_DISCOUNT_PAISE).toBe(6000);
    const basket = calculateSubscriptionBasketTotals([
      { pricePerDeliveryPaise: 8500, quantity: 1 },
      { pricePerDeliveryPaise: 3800, quantity: 1 },
    ], 30);
    expect(basket).toEqual({ subtotalPaise: 369000, discountPaise: 6000, grandTotalPaise: 363000 });
  });

  it('does not discount a 7-day basket and applies one discount to a 30-day basket', () => {
    expect(calculateSubscriptionBasketTotals([{ pricePerDeliveryPaise: 5000, quantity: 1 }], 7)).toEqual({
      subtotalPaise: 35000, discountPaise: 0, grandTotalPaise: 35000,
    });
    expect(calculateSubscriptionBasketTotals([{ pricePerDeliveryPaise: 5000, quantity: 1 }], 30)).toEqual({
      subtotalPaise: 150000, discountPaise: 6000, grandTotalPaise: 144000,
    });
  });
});
