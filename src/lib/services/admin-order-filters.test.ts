import { describe, expect, it } from "vitest";
import { isValidOrderId, parseAdminOrderFilters } from "./admin-order-filters";

describe("parseAdminOrderFilters", () => {
  it("accepts valid filters and a positive page", () => {
    expect(parseAdminOrderFilters({
      date: "2026-11-15",
      slot: "00000000-0000-4000-8000-000000000011",
      area: "00000000-0000-4000-8000-000000000001",
      status: "confirmed",
      page: "3",
    })).toEqual({
      deliveryDate: "2026-11-15",
      deliverySlotId: "00000000-0000-4000-8000-000000000011",
      serviceAreaId: "00000000-0000-4000-8000-000000000001",
      status: "confirmed",
      page: 3,
    });
  });

  it("drops malformed dates, IDs and statuses", () => {
    expect(parseAdminOrderFilters({
      date: "2026-02-30",
      slot: "not-a-uuid",
      area: "bad",
      status: "paid",
      page: "-2",
    })).toEqual({ page: 1 });
  });

  it("uses the first repeated query value and clamps large pages", () => {
    expect(parseAdminOrderFilters({ status: ["processing", "delivered"], page: "999999" }))
      .toEqual({ status: "processing", page: 10_000 });
  });
});

describe("isValidOrderId", () => {
  it("accepts UUIDs and rejects malformed identifiers", () => {
    expect(isValidOrderId("a5555555-0000-4000-8000-000000000002")).toBe(true);
    expect(isValidOrderId("order-123")).toBe(false);
  });
});
