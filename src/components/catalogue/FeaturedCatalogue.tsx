"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/catalogue/ProductCard";
import { fetchStorefrontCatalogue } from "@/lib/storefront-catalogue";
import type { CatalogueProduct } from "@/lib/catalogue";

export function FeaturedCatalogue() {
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetchStorefrontCatalogue()
      .then((catalogue) => {
        if (active) setProducts(catalogue.products.filter((product) => product.featured).slice(0, 8));
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <p className="mt-8 text-sm text-muted-foreground" role="status">Loading featured products…</p>;
  if (error) return <p className="mt-8 text-sm text-muted-foreground" role="status">Featured products are temporarily unavailable. Please browse the catalogue.</p>;
  if (!products.length) return <p className="mt-8 text-sm text-muted-foreground">No featured products are available right now.</p>;

  return (
    <div className="home-product-grid mt-8 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
      {products.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 3} />)}
    </div>
  );
}
