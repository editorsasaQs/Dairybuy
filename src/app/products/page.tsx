import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/brand/Container";
import { CatalogueBrowser } from "@/components/catalogue/CatalogueBrowser";

export const metadata: Metadata = {
  title: "Product Catalogue — Dairybuy",
  description:
    "Browse cow and buffalo milk, Ghee, Butter, Cheese, Misti Doi, Tok Doi and Firni in Kolkata.",
  openGraph: {
    title: "Product Catalogue — Dairybuy",
    description:
      "Daily milk, Bengali dairy classics and confirmed essentials delivered in Kolkata.",
    type: "website",
  },
};

export default function ProductsPage() {
  return (
    <main className="db-page">
      <Container as="section" className="py-(--section-y)">
        <div className="db-page-heading flex flex-col justify-between gap-6 rounded-[2.5rem] border-2 border-white bg-[#dff5fc] p-6 shadow-pop sm:p-9 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="db-kicker inline-flex rounded-full bg-[#ffd329] px-4 py-2 text-sm font-extrabold text-[#284967]">
              Kolkata Daily Storefront · Morning &amp; Evening Slots
            </p>
            <h1 className="mt-2">Product Catalogue</h1>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
              Explore confirmed dairy products from the latest product and pricing list. Looking for daily cow or buffalo milk by vendor and pack size?
            </p>
          </div>

          <Link
            href="/milk"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-secondary-foreground no-underline transition-colors hover:bg-secondary-hover md:self-auto"
          >
            <span>Compare Milk Vendors</span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-8">
          <CatalogueBrowser />
        </div>
      </Container>
    </main>
  );
}
