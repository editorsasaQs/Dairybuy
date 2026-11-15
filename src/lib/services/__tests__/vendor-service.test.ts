import { describe, expect, it } from 'vitest';
import {
  APPROVED_VENDORS,
  getApprovedMilkVendors,
  getCanteenVendor,
  isVendorApproved,
  isVendorOrderable,
} from '../vendor-service';

describe('Vendor Service - Approvals, Pricing Availability & Canteen Separation', () => {
  it('lists exactly 3 approved milk vendors and 1 canteen vendor', () => {
    expect(APPROVED_VENDORS).toHaveLength(4);

    const milkVendors = getApprovedMilkVendors();
    expect(milkVendors).toHaveLength(3);

    const vendorIds = milkVendors.map((v) => v.id);
    expect(vendorIds).toContain('healthy-haryana');
    expect(vendorIds).toContain('vip-pure');
    expect(vendorIds).toContain('ghosh-dairy');
  });

  it('confirms all 3 milk vendors are approved and supply cow and buffalo milk', () => {
    const milkVendors = getApprovedMilkVendors();
    for (const vendor of milkVendors) {
      expect(vendor.isApproved).toBe(true);
      expect(vendor.suppliesCow).toBe(true);
      expect(vendor.suppliesBuffalo).toBe(true);
    }
  });

  it('has ordering enabled for vendors with workbook pricing (Healthy Haryana, VIP Pure, Ghosh Dairy)', () => {
    expect(isVendorOrderable('healthy-haryana')).toBe(true);
    expect(isVendorOrderable('vip-pure')).toBe(true);
    expect(isVendorOrderable('ghosh-dairy')).toBe(true);
  });

  it('verifies Canteen Milk Centre is a separate single vendor with no cow/buffalo selection', () => {
    const canteen = getCanteenVendor();
    expect(canteen.id).toBe('canteen-milk-centre');
    expect(canteen.vendorType).toBe('canteen_vendor');
    expect(canteen.isApproved).toBe(true);
    expect(canteen.orderingEnabled).toBe(true);
    expect(canteen.suppliesCow).toBe(false);
    expect(canteen.suppliesBuffalo).toBe(false);
  });

  it('rejects unapproved or unknown vendor IDs', () => {
    expect(isVendorApproved('unknown-dairy')).toBe(false);
    expect(isVendorOrderable('unknown-dairy')).toBe(false);
  });
});
