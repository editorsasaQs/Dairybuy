import { describe, expect, it } from "vitest";
import { canteenMilkVendor, findMilkVendor, getVisibleOptions, isMilkOrderingAvailable, milkVendors } from "@/lib/milk";

const approved = ["Healthy Haryana Milk Centre","VIP Pure Milk","Ghosh Dairy"] as const;
function vendor(id: string) { const found = findMilkVendor(id); if (!found) throw new Error(`Missing ${id}`); return found; }

describe("approved Dairybuy milk vendors", () => {
  it("keeps only the three confirmed regular vendors", () => expect(milkVendors.map((v) => v.name)).toEqual([...approved]));
  it("has unique ids", () => expect(new Set(milkVendors.map((v) => v.id)).size).toBe(milkVendors.length));
  it("keeps Healthy Haryana cow and buffalo CSV totals equal", () => {
    const hh = vendor("healthy-haryana");
    const cow = hh.verifiedOptions.find((o) => o.type === "cow");
    const buffalo = hh.verifiedOptions.find((o) => o.type === "buffalo");
    expect(cow?.price500mlInr).toBe(50); expect(cow?.pricePerLitreInr).toBe(85);
    expect(buffalo?.price500mlInr).toBe(50); expect(buffalo?.pricePerLitreInr).toBe(85);
  });
  it("uses updated VIP and Ghosh cow/buffalo prices", () => {
    const vip = vendor("vip-pure");
    expect(vip.verifiedOptions.find((o) => o.type === "cow")?.price500mlInr).toBe(57);
    expect(vip.verifiedOptions.find((o) => o.type === "cow")?.pricePerLitreInr).toBe(99);
    expect(vip.verifiedOptions.find((o) => o.type === "buffalo")?.price500mlInr).toBe(65);
    expect(vip.verifiedOptions.find((o) => o.type === "buffalo")?.pricePerLitreInr).toBe(115);
    const ghosh = vendor("ghosh-dairy");
    expect(ghosh.verifiedOptions.find((o) => o.type === "cow")?.price500mlInr).toBe(70);
    expect(ghosh.verifiedOptions.find((o) => o.type === "cow")?.pricePerLitreInr).toBe(120);
    expect(ghosh.verifiedOptions.find((o) => o.type === "buffalo")?.pricePerLitreInr).toBe(125);
  });
  it("reports milk ordering available through confirmed vendors", () => expect(isMilkOrderingAvailable()).toBe(true));
  it("filters cow and buffalo options", () => {
    expect(getVisibleOptions(vendor("healthy-haryana"),"all")).toHaveLength(2);
    expect(getVisibleOptions(vendor("healthy-haryana"),"cow")).toHaveLength(1);
  });
});

describe("Canteen Milk Centre CSV pricing", () => {
  it("remains a single-vendor arrangement", () => {
    expect(canteenMilkVendor.id).toBe("canteen-milk-centre");
    expect(canteenMilkVendor.vendorChoiceShown).toBe(false);
    expect(canteenMilkVendor.orderable).toBe(true);
  });
  it("uses ₹29 + ₹9 = ₹38 and ₹52 + ₹8 = ₹60", () => {
    expect(canteenMilkVendor.pricing[0]).toMatchObject({
      litres:0.5, milkPriceInr:29, deliveryFeeInr:9, totalPerDeliveryInr:38,
      plan7DayInr:266, plan30DayInr:1140,
    });
    expect(canteenMilkVendor.pricing[1]).toMatchObject({
      litres:1, milkPriceInr:52, deliveryFeeInr:8, totalPerDeliveryInr:60,
      plan7DayInr:420, plan30DayInr:1800,
    });
  });
});
