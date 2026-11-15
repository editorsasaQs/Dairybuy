import { describe, expect, it } from "vitest";
import { getNextOrderStatus, isFulfillableStatus } from "./order-fulfillment";

describe("one-time COD order fulfillment transitions", () => {
  it.each([
    ["pending_confirmation", "confirmed"],
    ["confirmed", "processing"],
    ["processing", "out_for_delivery"],
    ["out_for_delivery", "delivered"],
  ])("allows only the next step from %s", (current, next) => {
    expect(getNextOrderStatus(current)).toBe(next);
  });

  it.each(["draft", "delivered", "cancelled", "failed", "unknown"])(
    "does not offer a next step for terminal or unsupported status %s",
    (status) => expect(getNextOrderStatus(status)).toBeNull(),
  );

  it("recognizes only the fulfillment lifecycle statuses", () => {
    expect(isFulfillableStatus("confirmed")).toBe(true);
    expect(isFulfillableStatus("cancelled")).toBe(false);
  });
});
