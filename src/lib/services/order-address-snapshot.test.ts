import { describe, expect, it } from "vitest";
import { parseOrderDeliveryAddressSnapshot } from "./order-address-snapshot";

const validSnapshot = {
  schema_version: 1,
  recipient_name: "Saif",
  phone: "9000000000",
  address_line1: "12 Test Road",
  address_line2: null,
  landmark: null,
  city: "Kolkata",
  state: "West Bengal",
  pincode: "700046",
  service_area_id: "00000000-0000-0000-0000-000000000001",
};

describe("parseOrderDeliveryAddressSnapshot", () => {
  it("accepts a complete version 1 snapshot with nullable optional fields", () => {
    expect(parseOrderDeliveryAddressSnapshot(validSnapshot)).toEqual(validSnapshot);
  });

  it("rejects unsupported snapshot versions", () => {
    expect(parseOrderDeliveryAddressSnapshot({ ...validSnapshot, schema_version: 2 })).toBeNull();
  });

  it("rejects missing required address fields", () => {
    const incomplete: Record<string, unknown> = { ...validSnapshot };
    delete incomplete["pincode"];
    expect(parseOrderDeliveryAddressSnapshot(incomplete)).toBeNull();
  });

  it("rejects invalid optional field types", () => {
    expect(parseOrderDeliveryAddressSnapshot({ ...validSnapshot, landmark: 42 })).toBeNull();
  });

  it("rejects null, arrays and primitive values", () => {
    expect(parseOrderDeliveryAddressSnapshot(null)).toBeNull();
    expect(parseOrderDeliveryAddressSnapshot([])).toBeNull();
    expect(parseOrderDeliveryAddressSnapshot("address")).toBeNull();
  });
});
