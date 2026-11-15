"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, ShoppingBag } from "lucide-react";
import { Container } from "@/components/brand/Container";
import { useBag } from "@/components/bag/BagContext";
import { Button } from "@/components/ui/button";
import { catalogueBagKey } from "@/lib/bag";
import type { CatalogueProduct } from "@/lib/catalogue";
import { fetchStorefrontCatalogue } from "@/lib/storefront-catalogue";

type ProductDetailProps = { slug: string };

export function ProductDetail({ slug }: ProductDetailProps) {
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const { addItem, openBag } = useBag();

  const loadCatalogue = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchStorefrontCatalogue()
      .then((catalogue) => setProducts(catalogue.products))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load this product.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCatalogue();
  }, [loadCatalogue, slug]);

  const product = useMemo(() => products.find((item) => item.slug === slug), [products, slug]);
  const isMilk = product?.category === "milk" || product?.category === "canteen-milk";
  const orderableVariants = useMemo(
    () => product?.variants.filter(
      (variant) => variant.isOrderable && variant.finalPriceInr !== null && variant.finalPriceInr > 0,
    ) ?? [],
    [product],
  );
  const selectedVariant = orderableVariants.find((variant) => variant.id === variantId) ?? orderableVariants[0];

  useEffect(() => {
    if (orderableVariants.length > 0 && !orderableVariants.some((variant) => variant.id === variantId)) {
      setVariantId(orderableVariants[0]?.id ?? "");
    }
  }, [orderableVariants, variantId]);

  if (loading) {
    return <Container className="py-16"><p role="status" className="rounded-card border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading product details…</p></Container>;
  }

  if (error) {
    return (
      <Container className="py-16">
        <div role="alert" className="mx-auto max-w-xl rounded-card border border-border bg-card p-8 text-center">
          <h1 className="text-2xl">Product details unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button variant="secondary" className="mt-5" onClick={loadCatalogue}>Try Again</Button>
        </div>
      </Container>
    );
  }

  if (!product) {
    return (
      <Container className="py-16">
        <div className="mx-auto max-w-xl rounded-card border border-border bg-card p-8 text-center">
          <h1 className="text-2xl">Product not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This product may no longer be listed in the current Dairybuy catalogue.</p>
          <Link href="/products" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground no-underline">Back to Catalogue</Link>
        </div>
      </Container>
    );
  }

  return (
    <main className="db-page">
      <Container className="py-(--section-y)">
        <Link href="/products" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-highlight-ink no-underline hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Catalogue
        </Link>

        <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:gap-14">
          <div className="db-product-visual overflow-hidden rounded-[2.5rem] border-[8px] border-[#ffd329] bg-[#ffd329] p-2 shadow-pop">
            <Image src={product.image} alt={product.imageAlt} width={1000} height={1000} priority className="aspect-square w-full rounded-[2rem] border-4 border-white object-cover" />
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-sm font-bold tracking-wide text-highlight-ink">{product.categoryLabel}</p>
            <h1 className="mt-2 text-balance">{product.name}</h1>
            <p className="mt-3 text-base text-muted-foreground">{product.subtitle}</p>
            {product.description ? <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{product.description}</p> : null}

            {isMilk ? (
              <div className="db-product-options mt-7 rounded-[2.5rem] border-2 border-white bg-[#dff5fc] p-5 shadow-pop">
                <p className="text-sm text-muted-foreground">Milk options are selected with the current vendor, milk type and pack-size rules.</p>
                <Link href="/milk" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground no-underline">
                  Choose Milk Options <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <div className="db-product-options mt-7 rounded-[2.5rem] border-2 border-white bg-[#dff5fc] p-5 shadow-pop">
                <h2 className="text-base font-bold">Choose pack size</h2>
                {orderableVariants.length > 0 ? (
                  <>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {orderableVariants.map((variant) => (
                        <button key={variant.id} type="button" aria-pressed={selectedVariant?.id === variant.id}
                          onClick={() => setVariantId(variant.id)}
                          className={`flex min-h-12 items-center justify-between gap-3 rounded-control border-2 px-3 py-2 text-left text-sm font-semibold transition-colors ${selectedVariant?.id === variant.id ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-background text-foreground hover:bg-muted"}`}>
                          <span>{variant.size}</span>
                          <span className="tabular-nums">{variant.finalPriceInr === null ? "Unavailable" : `₹${variant.finalPriceInr}`}</span>
                        </button>
                      ))}
                    </div>
                    {selectedVariant ? (
                      <>
                        <div className="mt-5 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Selected price</p>
                            <p className="text-2xl font-extrabold tabular-nums">₹{selectedVariant.finalPriceInr}</p>
                          </div>
                          <div className="inline-flex items-center gap-3 rounded-full border border-border bg-background p-1.5">
                            <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-card text-foreground disabled:opacity-40"><Minus className="h-4 w-4" aria-hidden="true" /></button>
                            <span className="min-w-5 text-center text-sm font-bold tabular-nums">{quantity}</span>
                            <button type="button" aria-label="Increase quantity" disabled={quantity >= 100} onClick={() => setQuantity((value) => Math.min(100, value + 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-card text-foreground disabled:opacity-40"><Plus className="h-4 w-4" aria-hidden="true" /></button>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">Final cart totals are recalculated by Dairybuy’s server-side cart validator.</p>
                        <Button className="mt-5 w-full" onClick={() => {
                          addItem({
                            key: catalogueBagKey(product.id, selectedVariant.id),
                            kind: "catalogue",
                            productId: product.id,
                            productVariantId: selectedVariant.id,
                            name: product.name,
                            image: product.image,
                            detail: selectedVariant.name,
                            unitPriceInr: selectedVariant.finalPriceInr,
                            quantity,
                          });
                          openBag();
                        }}>
                          Add {quantity} to Bag · ₹{(selectedVariant.finalPriceInr ?? 0) * quantity}
                        </Button>
                      </>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No active, priced pack sizes are available right now.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </Container>
    </main>
  );
}
