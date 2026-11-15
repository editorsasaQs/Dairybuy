import { describe, expect, it } from "vitest";
import { parseAddressInput, resolveServiceAreaId } from "./customer-address-service";

const valid = {
  recipientName: "Saif",
  phone: "+919876543210",
  addressLine1: "12 Example Road",
  addressLine2: "2nd floor",
  landmark: "Near market",
  pincode: "700046",
};

describe("parseAddressInput", () => {
  it("normalizes phone formatting and trims address fields", () => {
    const parsed = parseAddressInput({ ...valid, phone: "+91 98765-43210", recipientName: " Saif " });
    expect(parsed).toMatchObject({
      recipientName: "Saif",
      phone: "+919876543210",
      addressLine1: "12 Example Road",
      pincode: "700046",
      addressType: "Home",
      city: "Kolkata",
      state: "West Bengal",
    });
  });

  it("rejects malformed or missing required fields", () => {
    expect(parseAddressInput({ ...valid, pincode: "70004" })).toBeNull();
    expect(parseAddressInput({ ...valid, phone: "abc" })).toBeNull();
    expect(parseAddressInput({ ...valid, addressLine1: " ".repeat(2) })).toBeNull();
    expect(parseAddressInput(null)).toBeNull();
  });

  it("rejects oversized optional fields instead of silently truncating them", () => {
    expect(parseAddressInput({ ...valid, landmark: "x".repeat(161) })).toBeNull();
  });

  it("allows optional address details to be omitted", () => {
    expect(parseAddressInput({
      recipientName: "Saif",
      phone: "9876543210",
      addressLine1: "12 Example Road",
      pincode: "700046",
    })).toMatchObject({ addressLine2: null, landmark: null, phone: "9876543210" });
  });
  it("rejects malformed pincodes before attempting a serviceability lookup", async () => {
    await expect(resolveServiceAreaId({} as never, "7000A6")).resolves.toBeNull();
    await expect(resolveServiceAreaId({} as never, "7000461")).resolves.toBeNull();
  });
});
