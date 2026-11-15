"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { ProductCard } from "@/components/catalogue/ProductCard";
import { Button } from "@/components/ui/button";
import {
  filterCatalogueProducts,
  type CatalogueCategoryMeta,
  type CatalogueProduct,
  type ProductCategory,
} from "@/lib/catalogue";
import { fetchStorefrontCatalogue } from "@/lib/storefront-catalogue";

export function CatalogueBrowser() {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>("all");
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<CatalogueCategoryMeta[]>([
    { id: "all", label: "All Essentials" },
  ]);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchStorefrontCatalogue()
      .then((catalogue) => {
        if (!active) return;
        setCategories(catalogue.categories);
        setProducts(catalogue.products);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load products.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filteredProducts = useMemo(
    () => filterCatalogueProducts(products, selectedCategory, query),
    [products, selectedCategory, query],
  );

  if (loading) {
    return <p className="rounded-card border border-border bg-card p-8 text-center text-sm text-muted-foreground" role="status">Loading the latest Dairybuy catalogue…</p>;
  }

  if (error) {
    return (
      <div className="rounded-card border border-border bg-card p-8 text-center" role="alert">
        <h2 className="text-lg font-bold text-foreground">Catalogue temporarily unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Button variant="secondary" className="mt-5" onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 rounded-card border border-border bg-card p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Filter products by category" className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button key={cat.id} type="button" onClick={() => setSelectedCategory(cat.id)} aria-pressed={active}
                className={`min-h-10 shrink-0 rounded-full border-2 border-white px-4 py-2 text-sm font-extrabold whitespace-nowrap shadow-sm transition-colors ${active ? "bg-[#528cb5] text-white" : "bg-white/80 text-[#284967] hover:bg-white"}`}>
                {cat.label}
              </button>
            );
          })}
        </div>
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Search milk, misti doi, ghee..." aria-label="Search products" className="w-full pr-9 pl-10 text-sm" />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search query"
            className="absolute top-1/2 right-2.5 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button> : null}
        </div>
      </div>
      <p className="mt-5 text-sm text-muted-foreground tabular-nums">Showing {filteredProducts.length} of {products.length} products</p>
      {filteredProducts.length === 0 ? (
        <div className="mt-6 rounded-card border border-border bg-card p-10 text-center">
          <h2 className="text-xl font-bold text-foreground">No matching products found</h2>
          <p className="mt-2 text-sm text-muted-foreground">Try clearing your search or switching back to all confirmed dairy products.</p>
          <div className="mt-5"><Button variant="secondary" onClick={() => { setSelectedCategory("all"); setQuery(""); }}>Reset Filters</Button></div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
          {filteredProducts.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 3} />)}
        </div>
      )}
    </div>
  );
}
