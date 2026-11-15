import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabaseServiceability: vi.fn(),
  validateAndCalculateDatabaseCart: vi.fn(),
  formatDatabaseCartResult: vi.fn(),
}));

vi.mock("@/lib/services/service-area-db-service", () => ({
  getDatabaseServiceability: mocks.getDatabaseServiceability,
  isValidPincode: (value: string) => /^\d{6}$/.test(value.trim()),
  findServiceArea: (areas: Array<{ id: string; name: string; isActive: boolean; pincodes: readonly string[] }>, pincode: string) =>
    areas.find((area) => area.isActive && area.pincodes.includes(pincode)) ?? null,
}));

vi.mock("@/lib/services/database-cart-service", () => ({
  validateAndCalculateDatabaseCart: mocks.validateAndCalculateDatabaseCart,
  formatDatabaseCartResult: mocks.formatDatabaseCartResult,
}));

import { validateCheckout } from "./checkout-validation-service";

type QueryResult = { data: unknown; error: null | { message: string } };

function fakeSupabase(results: Record<string, QueryResult>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder["maybeSingle"] = async () => results[table] ?? { data: null, error: null };
      builder["then"] = (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve, reject);
      return builder;
    },
  };
  return { client: client as never, calls };
}

const address = {
  id: "address-1",
  recipient_name: "Customer",
  phone: "9876543210",
  address_line1: "Topsia Road",
  address_line2: null,
  landmark: null,
  city: "Kolkata",
  state: "West Bengal",
  pincode: "700046",
  service_area_id: "area-1",
};

const slot = {
  id: "slot-morning",
  slot_code: "morning_slot",
  label: "Morning (8 AM - 11 AM)",
  start_time: "08:00:00",
  end_time: "11:00:00",
  order_cutoff_time: "07:00:00",
  cancellation_deadline_time: "07:30:00",
  is_active: true,
};

function validResults(): Record<string, QueryResult> {
  return {
    customer_addresses: { data: address, error: null },
    delivery_slots: { data: slot, error: null },
    carts: { data: { id: "cart-1" }, error: null },
    cart_items: {
      data: [{
        id: "line-1",
        product_variant_id: "variant-1",
        vendor_id: null,
        milk_type: null,
        quantity: 2,
        quantity_litres: null,
      }],
      error: null,
    },
    product_variants: {
      data: [{ id: "variant-1", product_id: "product-1", unit_quantity: 1 }],
      error: null,
    },
    products: { data: [{ id: "product-1", product_type: "grocery_dairy" }], error: null },
  };
}

describe("validateCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabaseServiceability.mockResolvedValue({
      areas: [{ id: "area-1", name: "Topsia", isActive: true, pincodes: ["700046"] }],
      serviceablePincodes: ["700046"],
    });
    mocks.validateAndCalculateDatabaseCart.mockResolvedValue({
      isValid: true,
      errors: [],
      items: [{ productVariantId: "variant-1", unitPricePaise: 6250, quantity: 2 }],
      subtotalPaise: 12500,
      deliveryFeePaise: 0,
      totalPaise: 12500,
    });
    mocks.formatDatabaseCartResult.mockReturnValue({
      subtotalPaise: 12500,
      deliveryFeePaise: 0,
      totalPaise: 12500,
      formattedTotal: "₹125",
      items: [],
    });
  });

  it("validates address ownership, active serviceability, active slot and persisted live-priced cart", async () => {
    const { client, calls } = fakeSupabase(validResults());
    const result = await validateCheckout(
      client,
      "customer-1",
      { addressId: "address-1", deliverySlotId: "slot-morning", deliveryDate: "2026-11-14" },
      new Date("2026-11-13T00:00:00.000Z"),
    );

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.summary).toMatchObject({
        address: { id: "address-1", serviceAreaId: "area-1", serviceAreaName: "Topsia" },
        delivery: { slotId: "slot-morning", timezone: "Asia/Kolkata" },
        cart: { totalPaise: 12500 },
        deliveryFeePaise: 0,
        totalPaise: 12500,
      });
    }
    expect(calls).toContainEqual({ table: "customer_addresses", method: "eq", args: ["customer_id", "customer-1"] });
    expect(mocks.validateAndCalculateDatabaseCart).toHaveBeenCalledWith(
      client,
      [expect.objectContaining({ productVariantId: "variant-1", quantity: 2 })],
    );
    expect(calls.every((call) => ["select", "eq", "in"].includes(call.method))).toBe(true);
  });

  it("does not reveal or use an address owned by another customer", async () => {
    const results = validResults();
    results["customer_addresses"] = { data: null, error: null };
    const { client, calls } = fakeSupabase(results);

    const result = await validateCheckout(
      client,
      "customer-1",
      { addressId: "someone-elses-address", deliverySlotId: "slot-morning", deliveryDate: "2026-11-14" },
    );

    expect(result).toEqual({
      valid: false,
      fieldErrors: { addressId: "Select a saved delivery address." },
    });
    expect(calls.some((call) => call.table === "carts")).toBe(false);
  });

  it("rejects same-day orders at the exact Kolkata cutoff before loading the cart", async () => {
    const { client, calls } = fakeSupabase(validResults());

    const result = await validateCheckout(
      client,
      "customer-1",
      { addressId: "address-1", deliverySlotId: "slot-morning", deliveryDate: "2026-11-13" },
      new Date("2026-11-13T01:30:00.000Z"),
    );

    expect(result).toEqual({
      valid: false,
      fieldErrors: { deliveryDate: "This delivery date is no longer available for the selected slot." },
    });
    expect(calls.some((call) => call.table === "carts")).toBe(false);
  });

  it("returns a field error when the saved cart has stale or invalid authoritative prices", async () => {
    mocks.validateAndCalculateDatabaseCart.mockResolvedValueOnce({
      isValid: false,
      errors: ["Current vendor price is no longer available."],
      items: [],
      subtotalPaise: 0,
      deliveryFeePaise: 0,
      totalPaise: 0,
    });
    const { client } = fakeSupabase(validResults());

    const result = await validateCheckout(
      client,
      "customer-1",
      { addressId: "address-1", deliverySlotId: "slot-morning", deliveryDate: "2026-11-14" },
      new Date("2026-11-13T00:00:00.000Z"),
    );

    expect(result).toEqual({
      valid: false,
      fieldErrors: { cart: "Current vendor price is no longer available." },
    });
  });
});
