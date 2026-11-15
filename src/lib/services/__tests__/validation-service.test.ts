import { describe, expect, it } from 'vitest';
import { isStandardMilkVolume, MIN_MILK_LITRES, validateLineItem, validateServicePincode } from '../validation-service';

describe('milk and catalogue validation', () => {
  it('accepts 500 ml to 10 L in 500 ml increments', () => {
    for (const litres of [0.5,1,1.5,2,2.5,9,9.5,10]) expect(isStandardMilkVolume(litres)).toBe(true);
    for (const litres of [0.25,0.75,1.25,10.5,50]) expect(isStandardMilkVolume(litres)).toBe(false);
    expect(MIN_MILK_LITRES).toBe(0.5);
  });

  it('validates 500 ml and 1 L base variants and supports 1.5 L using the 1 L reference', () => {
    for (const [variant,litres] of [['milk-cow-500ml',0.5],['milk-buffalo-1l',1],['milk-cow-1l',1.5],['milk-cow-1l',10]] as const) {
      const result = validateLineItem({
        productVariantId:variant, vendorId:'healthy-haryana', milkType:'cow',
        litres, quantity:1,
      });
      expect(result.isValid, result.errors.join('; ')).toBe(true);
    }
  });

  it('rejects milk ordering for vendors removed from the approved catalogue', () => {
    for (const vendorId of ['fresh-punjab','kolkata-centre']) {
      const result = validateLineItem({
        productVariantId:'milk-cow-500ml', vendorId, milkType:'cow', litres:0.5, quantity:1,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => /not approved|unknown vendor|not found/i.test(error))).toBe(true);
    }
  });

  it('rejects vendor or volume metadata for non-milk products', () => {
    const result = validateLineItem({
      productVariantId:'ghee-red-cow-200ml', vendorId:'healthy-haryana', litres:0.5, quantity:1,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('cannot include vendor, milk type or volume');
  });

  it('validates non-milk catalogue products without vendor metadata', () => {
    expect(validateLineItem({ productVariantId:'ghee-red-cow-200ml', quantity:2 }).isValid).toBe(true);
    expect(validateLineItem({ productVariantId:'doi-misti-100g', quantity:4 }).isValid).toBe(true);
  });

  it('enforces the dedicated single-vendor Canteen arrangement', () => {
    expect(validateLineItem({
      productVariantId:'milk-canteen-500ml', vendorId:'canteen-milk-centre',
      milkType:'canteen', litres:0.5, quantity:1,
    }).isValid).toBe(true);
    const wrongVendor = validateLineItem({
      productVariantId:'milk-canteen-500ml', vendorId:'vip-pure',
      milkType:'canteen', litres:0.5, quantity:1,
    });
    expect(wrongVendor.isValid).toBe(false);
    expect(wrongVendor.errors.some((error) => /Canteen Milk Centre/i.test(error))).toBe(true);
  });

  it('rejects a milk reference variant that does not match the selected volume', () => {
    const result = validateLineItem({
      productVariantId:'milk-cow-500ml', vendorId:'healthy-haryana',
      milkType:'cow', litres:1.5, quantity:1,
    });
    expect(result.isValid).toBe(false);
  });

  it('validates serviceability and quantity count bounds', () => {
    for (const pincode of ['700046','700039','700100','700105']) expect(validateServicePincode(pincode).isValid).toBe(true);
    expect(validateServicePincode('700001').isValid).toBe(false);
    expect(validateServicePincode('1234').isValid).toBe(false);
    for (const quantity of [0,-1,1.5,101]) {
      expect(validateLineItem({ productVariantId:'doi-misti-100g', quantity }).isValid).toBe(false);
    }
  });
});
