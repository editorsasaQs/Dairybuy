import { describe, expect, it } from "vitest";
import { milkVendors, presetLitres, priceFor } from "./milk";

const opt = (v: string, t: "cow" | "buffalo") =>
  milkVendors.find((x) => x.name === v)!.options.find((o) => o.type === t)!;

describe("milk pricing", () => {
  it("Healthy Haryana Milk", () => {
    expect(opt("Healthy Haryana Milk", "cow")).toMatchObject({ mrp: 100, off: 14, price: 88 });
    expect(opt("Healthy Haryana Milk", "buffalo")).toMatchObject({ mrp: 110, off: 16, price: 95 });
  });
  it("VIP Pure Milk", () => {
    expect(opt("VIP Pure Milk", "cow")).toMatchObject({ mrp: 95, off: 12, price: 85 });
    expect(opt("VIP Pure Milk", "buffalo")).toMatchObject({ mrp: 115, off: 15, price: 100 });
  });
  it("quantities run 500 ml to 9 L", () => {
    expect(presetLitres[0]).toBe(0.5);
    expect(presetLitres.at(-1)).toBe(9);
  });
  it("500 ml of ₹70 milk costs ₹35", () => expect(priceFor(70, 0.5)).toBe(35));
});
