"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CatalogueProduct } from "@/lib/catalogue";

type ProductCardProps = { product: CatalogueProduct; priority?: boolean };

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const isMilk = product.category === "milk" || product.category === "canteen-milk";
  const href = isMilk ? "/milk" : `/products/${product.slug}`;

  return (
    <article className="home-product-card group flex min-w-0 flex-col rounded-[2.25rem] border-[2px] border-white p-3 shadow-pop transition-transform duration-200 hover:-translate-y-1 sm:p-4">
      <Link href={href} aria-label={`View ${product.name}`} className="home-product-image block overflow-hidden rounded-[1.8rem] bg-white p-2">
        <Image src={product.image} alt={product.imageAlt} width={816} height={816}
          sizes="(min-width: 1280px) 260px, (min-width: 768px) 33vw, 50vw" priority={priority}
          className="aspect-square h-full w-full rounded-[1.4rem] object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
      </Link>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-4 sm:px-2">
        <p className="text-[.68rem] font-bold uppercase tracking-wide text-[#528cb5]">{product.categoryLabel}</p>
        <h3 className="mt-1 font-heading text-lg font-extrabold leading-tight text-[#284967] sm:text-xl">
          <Link href={href} className="text-inherit no-underline hover:underline">{product.name}</Link>
        </h3>
        <p className="mt-1 flex-1 text-sm leading-snug text-[#526b80]">{product.subtitle}</p>
        <p className="mt-3 text-lg font-extrabold text-[#284967] tabular-nums">
          {product.priceInr !== null ? `From ₹${product.priceInr}` : isMilk ? "Choose vendor & rate" : "Rate unavailable"}
        </p>
        <Link href={href} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-[#528cb5] px-3 py-2 text-sm font-bold text-white no-underline shadow-[0_4px_0_#284967] transition-transform hover:brightness-95 active:translate-y-1 active:shadow-none">
          <span>{isMilk ? "Choose" : "Add / View sizes"}</span><ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true"/>
        </Link>
      </div>
    </article>
  );
}
