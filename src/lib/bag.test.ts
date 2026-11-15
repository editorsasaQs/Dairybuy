import { describe, expect, it } from "vitest";
import type { MilkType } from "@/lib/milk";
import {
  catalogueBagKey,
  isAddableBagItem,
  mergeBagItems,
  milkProductId,
  parseMilkProductId,
  sanitizeStoredBagItems,
  type AddBagItemInput,
} from "@/lib/bag";

function milkInput(
  overrides: Partial<AddBagItemInput> = {},
): AddBagItemInput {
  return {
    key: "milk:healthy-haryana:cow:1",
    kind: "milk",
    productId: milkProductId("healthy-haryana", "cow"),
    productVariantId: "cow-1l",
    name: "Cow Milk (1 L)",
    image: "/images/products/milk.jpg",
    detail: "Cow Milk · 1 L per delivery",
    vendorName: "Healthy Haryana Milk Centre",
    milkType: "cow",
    litres: 1,
    unitPriceInr: 85,
    ...overrides,
  };
}

function catalogueInput(
  overrides: Partial<AddBagItemInput> = {},
): AddBagItemInput {
  return {
    key: "catalogue:ghee",
    kind: "catalogue",
    productId: "ghee",
    productVariantId: "ghee-red-cow-200ml",
    name: "Pure Ghee",
    image: "/images/products/ghee.jpg",
    detail: "Ghee & Butter",
    unitPriceInr: 179,
    ...overrides,
  };
}

describe("isAddableBagItem: milk quantity (Phase 4 confirmed vendors)", () => {
  it.each([0.5, 1, 1.5, 2, 2.5, 9, 9.5, 10])("accepts supported %s L volume for verified vendors", (litres) => {
    expect(isAddableBagItem(milkInput({ litres }))).toBe(true);
  });

  it.each([10.5, 50, 0.75, 1.25])(
    "rejects %s L (outside 500 ml increments or 10 L maximum)",
    (litres) => {
      expect(isAddableBagItem(milkInput({ litres }))).toBe(false);
    },
  );

  it.each([0.25, 0.499, 0, -1, 50.01, Number.NaN])(
    "rejects %s L",
    (litres) => {
      expect(isAddableBagItem(milkInput({ litres }))).toBe(false);
    },
  );

  it("rejects a milk line with no quantity", () => {
    const { litres: _omit, ...withoutLitres } = milkInput();
    void _omit;
    expect(isAddableBagItem(withoutLitres)).toBe(false);
  });
});

describe("isAddableBagItem: confirmed vendor ordering", () => {
  it.each(["healthy-haryana", "vip-pure", "ghosh-dairy"])(
    "accepts cow and buffalo milk for %s with confirmed workbook prices",
    (vendorId) => {
      for (const type of ["cow", "buffalo"] as const) {
        expect(
          isAddableBagItem(
            milkInput({
              key: `milk:${vendorId}:${type}:1`,
              productId: milkProductId(vendorId, type),
              milkType: type,
              vendorName: vendorId,
              litres: 1,
            }),
          ),
        ).toBe(true);
      }
    },
  );

  it.each(["fresh-punjab", "kolkata-centre"])(
    "rejects %s because pricing is pending from owner",
    (vendorId) => {
      expect(
        isAddableBagItem(
          milkInput({
            key: `milk:${vendorId}:cow:1`,
            productId: milkProductId(vendorId, "cow"),
            vendorName: vendorId,
            milkType: "cow",
          }),
        ),
      ).toBe(false);
    },
  );

  it("accepts Canteen Milk for Canteen Milk Centre in 500 ml and 1 L", () => {
    expect(
      isAddableBagItem({
        key: "milk:canteen-milk-centre:canteen:0.5",
        kind: "milk",
        productId: "milk-canteen-milk-centre-canteen",
        productVariantId: "canteen-500",
        name: "Canteen Milk (500 ml)",
        image: "/images/products/milk.jpg",
        detail: "Canteen Milk · 500 ml per delivery",
        vendorName: "Canteen Milk Centre",
        milkType: "canteen" as MilkType,
        litres: 0.5,
        unitPriceInr: 38,
      }),
    ).toBe(true);

    expect(
      isAddableBagItem({
        key: "milk:canteen-milk-centre:canteen:1",
        kind: "milk",
        productId: "milk-canteen-milk-centre-canteen",
        productVariantId: "canteen-1l",
        name: "Canteen Milk (1 L)",
        image: "/images/products/milk.jpg",
        detail: "Canteen Milk · 1 L per delivery",
        vendorName: "Canteen Milk Centre",
        milkType: "canteen" as MilkType,
        litres: 1.0,
        unitPriceInr: 60,
      }),
    ).toBe(true);
  });
});

describe("isAddableBagItem: non-milk products", () => {
  it("accepts plain catalogue products", () => {
    expect(isAddableBagItem(catalogueInput())).toBe(true);
    expect(isAddableBagItem(catalogueInput({ productId: "ghee-red-cow" }))).toBe(true);
    expect(isAddableBagItem(catalogueInput({ productId: "butter-amul" }))).toBe(true);
    expect(
      isAddableBagItem({
        key: "catalogue:ghee",
        kind: "catalogue",
        productId: "ghee",
        productVariantId: "ghee-red-cow-200ml",
        name: "Pure Ghee",
        image: "/images/products/ghee.jpg",
        detail: "Ghee & Butter",
        unitPriceInr: 179,
      }),
    ).toBe(true);
  });

  it("rejects standard milk product added as a plain catalogue line", () => {
    expect(isAddableBagItem(catalogueInput({ productId: "milk-cow" }))).toBe(false);
    expect(
      isAddableBagItem(
        catalogueInput({ productId: "milk", key: "catalogue:milk" }),
      ),
    ).toBe(false);
  });

  it("rejects a non-milk product that carries a vendor", () => {
    expect(
      isAddableBagItem(catalogueInput({ vendorName: "Ghosh Dairy" })),
    ).toBe(false);
  });

  it("rejects a non-milk product that carries a milk type or litres", () => {
    expect(isAddableBagItem(catalogueInput({ milkType: "cow" }))).toBe(false);
    expect(isAddableBagItem(catalogueInput({ litres: 1 }))).toBe(false);
  });

  it("rejects a malformed catalogue product identifier", () => {
    expect(isAddableBagItem(catalogueInput({ productId: "not a valid product id" }))).toBe(false);
  });
});

describe("isAddableBagItem: pack quantity", () => {
  it.each([0, -1, 1.5])("rejects pack quantity %s", (quantity) => {
    expect(isAddableBagItem(catalogueInput({ quantity }))).toBe(false);
  });

  it("accepts a positive whole pack quantity", () => {
    expect(isAddableBagItem(catalogueInput({ quantity: 3 }))).toBe(true);
  });
});

describe("milk product ids", () => {
  it("round-trips vendor id and milk type", () => {
    const id = milkProductId("healthy-haryana", "buffalo");
    expect(id).toBe("milk-healthy-haryana-buffalo");
    expect(parseMilkProductId(id)).toEqual({
      vendorId: "healthy-haryana",
      type: "buffalo",
    });
  });

  it.each(["milk", "milk-vip-pure", "bread", "milk--cow", "milk-vip-pure-goat"])(
    "does not parse %s",
    (value) => {
      expect(parseMilkProductId(value)).toBeNull();
    },
  );
});

describe("sanitizeStoredBagItems: stale bag cleanup", () => {
  it("cleans unsupported milk volumes and keeps valid catalogue items", () => {
    const staleItems = [
      {
        key: "milk:healthy-haryana:cow:2.75",
        kind: "milk",
        productId: "milk-healthy-haryana-cow",
        productVariantId: "milk-cow-1l",
        name: "Cow Milk (2.75 L)",
        image: "/images/products/milk.jpg",
        detail: "Cow Milk · 2.75 L",
        vendorName: "Healthy Haryana Milk Centre",
        milkType: "cow",
        litres: 2.75, // Not a 500 ml increment.
        unitPriceInr: 180,
        quantity: 1,
      },
      {
        key: "milk:fresh-punjab:cow:1",
        kind: "milk",
        productId: "milk-fresh-punjab-cow",
        name: "Cow Milk (1 L)",
        image: "/images/products/milk.jpg",
        detail: "Cow Milk · 1 L",
        vendorName: "Fresh Punjab Milk",
        milkType: "cow",
        litres: 1.0,
        unitPriceInr: null,
        quantity: 1, // Fresh Punjab is disabled!
      },
      {
        key: "catalogue:ghee",
        kind: "catalogue",
        productId: "ghee",
        productVariantId: "ghee-red-cow-200ml",
        name: "Pure Ghee",
        image: "/images/products/ghee.jpg",
        detail: "Ghee & Butter",
        unitPriceInr: 179,
        quantity: 2,
      },
    ];

    const cleaned = sanitizeStoredBagItems(staleItems);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0]?.productId).toBe("ghee");
  });
});


describe("mergeBagItems: guest to authenticated cart", () => {
  it("adds guest quantities to matching account lines without exceeding 100", () => {
    const guest = { ...catalogueInput({ quantity: 4 }), quantity: 4 };
    const account = { ...catalogueInput({ quantity: 3 }), quantity: 3, name: "Server product name" };
    const merged = mergeBagItems([guest], [account]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantity).toBe(7);
    expect(merged[0]?.name).toBe("Server product name");
  });

  it("caps merged quantities at the database maximum", () => {
    const merged = mergeBagItems(
      [{ ...catalogueInput({ quantity: 80 }), quantity: 80 }],
      [{ ...catalogueInput({ quantity: 40 }), quantity: 40 }],
    );
    expect(merged[0]?.quantity).toBe(100);
  });

  it("does not merge a key collision that points at a different variant", () => {
    const guest = { ...catalogueInput({ quantity: 5, productVariantId: "variant-guest" }), quantity: 5 };
    const account = { ...catalogueInput({ quantity: 2, productVariantId: "variant-account" }), quantity: 2 };
    const merged = mergeBagItems([guest], [account]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.productVariantId).toBe("variant-account");
    expect(merged[0]?.quantity).toBe(2);
  });
});

describe("catalogue bag identity", () => {
  it("keeps different pack variants of the same product as separate lines", () => {
    expect(catalogueBagKey("butter-amul", "butter-amul-100g")).not.toBe(catalogueBagKey("butter-amul", "butter-amul-200g"));
    expect(catalogueBagKey("butter-amul", "butter-amul-100g")).toBe("catalogue:butter-amul:butter-amul-100g");
  });
});

describe("catalogue bag storage migration", () => {
  it("normalizes legacy product-only keys to variant-specific keys", () => {
    const legacy = catalogueInput({ key: "catalogue:ghee-red-cow", productId: "ghee-red-cow", productVariantId: "ghee-red-cow-200ml" });
    const restored = sanitizeStoredBagItems([{ ...legacy, quantity: 2 }]);
    expect(restored).toHaveLength(1);
    expect(restored[0]?.key).toBe("catalogue:ghee-red-cow:ghee-red-cow-200ml");
  });
});
