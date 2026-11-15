"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useBag } from "@/components/bag/BagContext";
import { Button, buttonClasses } from "@/components/ui/button";
import { fetchStorefrontCatalogue } from "@/lib/storefront-catalogue";
import type { CatalogueProduct } from "@/lib/catalogue";

export function BreakfastBoxActions() {
  const { addItem, openBag } = useBag();
  const [staples, setStaples] = useState<CatalogueProduct[]>([]);

  useEffect(() => {
    let active = true;
    fetchStorefrontCatalogue().then((catalogue) => {
      if (active) setStaples(catalogue.products.filter((item) => item.breakfastBoxIncluded && !item.requiresVendorSelection && item.priceInr !== null));
    }).catch(() => { if (active) setStaples([]); });
    return () => { active = false; };
  }, []);

  const handleAddStaples = () => {
    for (const product of staples) {
      const variant = product.variants
        .filter((item) => item.isOrderable && item.finalPriceInr !== null && item.finalPriceInr > 0)
        .sort((a, b) => (a.finalPriceInr ?? Infinity) - (b.finalPriceInr ?? Infinity))[0];
      if (!variant) continue;
      addItem({
        key: `catalogue:${product.id}`,
        kind: "catalogue",
        productId: product.id,
        productVariantId: variant.id,
        name: product.name,
        image: product.image,
        detail: "Morning Essentials",
        unitPriceInr: product.priceInr,
      });
    }
    openBag();
  };

  return (
    <div className="mt-7 flex flex-wrap items-center gap-3">
      <Button variant="primary" onClick={handleAddStaples} disabled={staples.length === 0}>
        Add Breakfast Staples to Bag
      </Button>
      <Link href="/milk" className={buttonClasses("secondary", "text-secondary-foreground no-underline")}>
        Add Fresh Milk
      </Link>
    </div>
  );
}
