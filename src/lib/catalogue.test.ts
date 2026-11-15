import { describe, expect, it } from "vitest";
import { filterCatalogueProducts, type CatalogueProduct } from "@/lib/catalogue";
import { mapApiCatalogue } from "@/lib/storefront-catalogue";

const sampleProducts: CatalogueProduct[] = [
  { id: "milk-cow", slug: "cow-milk", description: "Fresh cow milk", name: "Fresh Cow Milk", category: "milk", categoryLabel: "Fresh Milk", subtitle: "Approved vendor milk", image: "/images/products/milk.jpg", imageAlt: "Milk", featured: true, requiresVendorSelection: true, priceInr: null, variants: [] },
  { id: "milk-canteen", slug: "canteen-milk", description: "Canteen supply", name: "Canteen Milk", category: "canteen-milk", categoryLabel: "Canteen Milk", subtitle: "Single vendor", image: "/images/products/milk.jpg", imageAlt: "Milk", featured: false, requiresVendorSelection: false, priceInr: 28, variants: [] },
  { id: "doi-misti", slug: "misti-doi", description: "Traditional Bengali sweet curd", name: "Misti Doi", category: "doi", categoryLabel: "Doi", subtitle: "Bengali sweet curd", image: "/images/products/mistidoi.jpg", imageAlt: "Doi", featured: true, requiresVendorSelection: false, priceInr: 44, variants: [{ id: "doi-100", name: "Misti Doi 100 g", brand: "Dairybuy", size: "100 g", finalPriceInr: 44, isOrderable: true }] },
];

describe("customer catalogue filters", () => {
  it("filters by category", () => {
    expect(filterCatalogueProducts(sampleProducts, "milk", "")).toHaveLength(1);
  });
  it("searches product names, descriptions and variant labels", () => {
    expect(filterCatalogueProducts(sampleProducts, "all", "BENGALI")).toHaveLength(1);
    expect(filterCatalogueProducts(sampleProducts, "all", "100 g")).toHaveLength(1);
  });
  it("returns no result for unmatched query", () => {
    expect(filterCatalogueProducts(sampleProducts, "all", "not-a-product")).toHaveLength(0);
  });
});

describe("API catalogue mapping", () => {
  it("uses only customer-facing prices and never invents a zero price for vendor-priced milk", () => {
    const mapped = mapApiCatalogue({
      success: true,
      data: {
        categories: [{ id: "milk", label: "Fresh Milk" }, { id: "doi", label: "Doi" }],
        totalCount: 2,
        products: [
          { id: "milk-cow", slug: "cow-milk", categoryId: "milk", name: "Fresh Cow Milk", description: "Fresh cow milk", subtitle: "Vendor milk", image: "/images/products/milk.jpg", imageAlt: "Milk", requiresVendorSelection: true, featured: true, variants: [{ id: "cow-500", variantName: "Cow Milk 500 ml", brand: "Vendor", packSize: "500 ml", finalPricePaise: 0, isOrderable: true }] },
          { id: "doi-misti", slug: "misti-doi", categoryId: "doi", name: "Misti Doi", description: "Traditional Bengali sweet curd", subtitle: "Sweet curd", image: "/images/products/mistidoi.jpg", imageAlt: "Doi", requiresVendorSelection: false, featured: true, variants: [{ id: "doi-100", variantName: "Misti Doi 100 g", brand: "Dairybuy", packSize: "100 g", finalPricePaise: 4400, isOrderable: true }] },
        ],
      },
    });
    expect(mapped.products.find((product) => product.id === "milk-cow")?.priceInr).toBeNull();
    expect(mapped.products.find((product) => product.id === "doi-misti")?.priceInr).toBe(44);
    expect(mapped.products.find((product) => product.id === "doi-misti")?.slug).toBe("misti-doi");
    expect(mapped.products.find((product) => product.id === "doi-misti")?.description).toBe("Traditional Bengali sweet curd");
    expect(JSON.stringify(mapped)).not.toContain("purchasePrice");
    expect(JSON.stringify(mapped)).not.toContain("deliveryComponent");
  });
});
