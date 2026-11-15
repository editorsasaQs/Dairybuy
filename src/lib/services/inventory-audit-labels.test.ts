import { describe, expect, it } from "vitest";
import { filterInventoryAuditByArea, filterInventoryAuditByProduct, filterInventoryAuditFindings, resolveInventoryAuditLabels } from "./inventory-audit-labels";

const finding = {
  product_variant_id: "cow-milk-500",
  service_area_id: "area-topsia",
};

describe("resolveInventoryAuditLabels", () => {
  it("resolves product, variant, pack size, brand and service area names", () => {
    expect(resolveInventoryAuditLabels(
      [finding],
      [{ id: "cow-milk-500", product_id: "cow-milk", variant_name: "Standard", pack_size: "500 ml", brand: "Dairybuy" }],
      [{ id: "cow-milk", name: "Cow Milk" }],
      [{ id: "area-topsia", name: "Topsia", city: "Kolkata" }],
    )).toEqual([{
      ...finding,
      productLabel: "Cow Milk · Standard · 500 ml · Dairybuy",
      productId: "cow-milk-500",
      catalogProductId: "cow-milk",
      catalogProductLabel: "Cow Milk",
      areaLabel: "Topsia · Kolkata",
      areaId: "area-topsia",
    }]);
  });

  it("keeps the stable variant ID visible when a product lookup is missing", () => {
    const [resolved] = resolveInventoryAuditLabels([finding], [], [], []);
    expect(resolved?.productLabel).toBe("cow-milk-500");
    expect(resolved?.productId).toBe("cow-milk-500");
    expect(resolved?.catalogProductId).toBeNull();
    expect(resolved?.catalogProductLabel).toBe("Product details unavailable");
    expect(resolved?.areaLabel).toBeNull();
    expect(resolved?.areaId).toBe("area-topsia");
  });

  it("supports variants without a brand and areas without a city", () => {
    const [resolved] = resolveInventoryAuditLabels(
      [finding],
      [{ id: "cow-milk-500", product_id: "cow-milk", variant_name: "Standard", pack_size: "500 ml", brand: null }],
      [{ id: "cow-milk", name: "Cow Milk" }],
      [{ id: "area-topsia", name: "Topsia", city: "" }],
    );
    expect(resolved?.productLabel).toBe("Cow Milk · Standard · 500 ml");
    expect(resolved?.areaLabel).toBe("Topsia");
  });
});

describe("filterInventoryAuditFindings", () => {
  const findings = [
    { audit_type: "inventory_balance", inventory_id: "inventory-1" },
    { audit_type: "order_reservation", inventory_id: "inventory-2" },
    { audit_type: "order_reservation", inventory_id: "inventory-3" },
  ];

  it("filters to the selected discrepancy type", () => {
    expect(filterInventoryAuditFindings(findings, "order_reservation")).toEqual([
      findings[1],
      findings[2],
    ]);
  });

  it("returns all findings for the all-types selection", () => {
    expect(filterInventoryAuditFindings(findings, null)).toEqual(findings);
  });

  it("fails open to all findings for an unknown URL filter", () => {
    expect(filterInventoryAuditFindings(findings, "unknown_type")).toEqual(findings);
  });
});

describe("filterInventoryAuditByArea", () => {
  const findings = [
    { areaId: "topsia", inventory_id: "inventory-1" },
    { areaId: "park-circus", inventory_id: "inventory-2" },
    { areaId: null, inventory_id: "inventory-3" },
  ];

  it("filters findings to one selected service area", () => {
    expect(filterInventoryAuditByArea(findings, "topsia")).toEqual([findings[0]]);
  });

  it("can show findings without an assigned service area", () => {
    expect(filterInventoryAuditByArea(findings, "unassigned")).toEqual([findings[2]]);
  });

  it("returns all findings for no or unknown area filters", () => {
    expect(filterInventoryAuditByArea(findings, null)).toEqual(findings);
    expect(filterInventoryAuditByArea(findings, "unknown-area")).toEqual(findings);
  });
});

describe("filterInventoryAuditByProduct", () => {
  const findings = [
    { catalogProductId: "cow-milk", inventory_id: "inventory-1" },
    { catalogProductId: "buffalo-milk", inventory_id: "inventory-2" },
    { catalogProductId: null, inventory_id: "inventory-3" },
  ];

  it("filters findings to one catalogue product across its variants", () => {
    expect(filterInventoryAuditByProduct(findings, "cow-milk")).toEqual([findings[0]]);
  });

  it("can show findings whose product could not be resolved", () => {
    expect(filterInventoryAuditByProduct(findings, "unresolved")).toEqual([findings[2]]);
  });

  it("returns all findings for no or unknown product filters", () => {
    expect(filterInventoryAuditByProduct(findings, null)).toEqual(findings);
    expect(filterInventoryAuditByProduct(findings, "unknown-product")).toEqual(findings);
  });
});
