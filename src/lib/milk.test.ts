import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MILK_SIZES, MIN_MILK_LITRES, MAX_MILK_LITRES, MILK_VOLUME_OPTIONS } from "@/lib/business";
import { formatQty, getMilkOptionPriceInr, isOrderableMilkQuantity, isStandardMilkSize, isValidLitres } from "@/lib/milk";

describe("milk quantity rules", () => {
  it("supports 500 ml through 10 L in 500 ml increments", () => {
    for (const litres of [0.5,1,1.5,2,2.5,3,5,9,9.5,10]) {
      expect(isOrderableMilkQuantity(litres), String(litres)).toBe(true);
    }
    expect(MIN_MILK_LITRES).toBe(0.5);
    expect(MAX_MILK_LITRES).toBe(10);
  });
  it.each([0.25,0.499,0, -1,10.5,50,0.75,1.25,1.75])("rejects unsupported volume %s L", (litres) => {
    expect(isOrderableMilkQuantity(litres)).toBe(false);
  });
  it("distinguishes reference variants from valid selected volumes", () => {
    expect(MILK_SIZES.map((size) => size.litres)).toEqual([0.5,1]);
    expect(isStandardMilkSize(0.5)).toBe(true);
    expect(isStandardMilkSize(1)).toBe(true);
    expect(isStandardMilkSize(1.5)).toBe(false);
    expect(isValidLitres(1.5)).toBe(true);
  });
  it("rejects non-finite volumes", () => {
    for (const value of [Number.NaN,Number.POSITIVE_INFINITY,Number.NEGATIVE_INFINITY]) {
      expect(isValidLitres(value)).toBe(false);
      expect(isOrderableMilkQuantity(value)).toBe(false);
    }
  });
  it("provides all twenty selectable volumes from 500 ml to 10 L", () => {
    expect(MILK_VOLUME_OPTIONS).toHaveLength(20);
    expect(MILK_VOLUME_OPTIONS.map((item) => item.litres)).toEqual(
      Array.from({ length: 20 }, (_, index) => (index + 1) * 0.5),
    );
  });
  it("calculates customer display prices from approved database components", () => {
    const option = {
      type: "cow" as const,
      price500mlInr: 50,
      pricePerLitreInr: 85,
      price500mlPaise: 4100,
      delivery500mlPaise: 900,
      price1lPaise: 7800,
      delivery1lPaise: 700,
      plan7DayInr: 595,
      plan30DayInr: 2550,
    };
    expect(getMilkOptionPriceInr(option, 0.5)).toBe(50);
    expect(getMilkOptionPriceInr(option, 1)).toBe(85);
    expect(getMilkOptionPriceInr(option, 1.5)).toBe(126);
    expect(getMilkOptionPriceInr(option, 2.5)).toBe(204);
    expect(getMilkOptionPriceInr(option, 10)).toBe(787);
    expect(getMilkOptionPriceInr(option, 10.5)).toBeNull();
  });
  it("formats half-litre and multi-litre volumes", () => {
    expect(formatQty(0.5)).toBe("500 ml");
    expect(formatQty(1)).toBe("1 L");
    expect(formatQty(1.5)).toBe("1.5 L");
    expect(formatQty(10)).toBe("10 L");
  });
});

describe("customer-facing selector reference sizes", () => {
  const selector = readFileSync(join(process.cwd(), "src/components/milk/MilkVendorSelector.tsx"), "utf8");
  it("renders all customer-selectable volumes from 500 ml to 10 L", () => {
    expect(selector).toContain("MILK_VOLUME_OPTIONS");
    expect(selector).toContain("Select milk volume");
  });
  it("validates selected volumes before adding to bag", () => {
    expect(selector).toContain("isOrderableMilkQuantity(");
  });
});
