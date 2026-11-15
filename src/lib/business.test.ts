import { describe, expect, it } from "vitest";
import { DELIVERY_FEE_INR, MAX_MILK_LITRES, MILK_SIZES, MILK_VOLUME_OPTIONS, MIN_MILK_LITRES, deliveryFeeLabel } from "@/lib/business";

describe("CSV-backed business configuration", () => {
  it("does not add a generic order-level delivery fee", () => {
    expect(DELIVERY_FEE_INR).toBe(0);
    expect(deliveryFeeLabel()).toBe("Included in displayed prices");
  });
  it("keeps 500 ml and 1 L as reference variants while supporting up to 10 L", () => {
    expect(MILK_SIZES.map((size) => size.label)).toEqual(["500 ml", "1 L"]);
    expect(MIN_MILK_LITRES).toBe(0.5);
    expect(MAX_MILK_LITRES).toBe(10);
    expect(MILK_VOLUME_OPTIONS).toHaveLength(20);
    expect(MILK_VOLUME_OPTIONS[0]).toEqual({ litres: 0.5, label: "500 ml" });
    expect(MILK_VOLUME_OPTIONS[19]).toEqual({ litres: 10, label: "10 L" });
  });
});
