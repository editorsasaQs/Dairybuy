import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/brand/Container";
import { MilkVendorSelector } from "@/components/milk/MilkVendorSelector";

export const metadata: Metadata = {
  title: "Fresh Milk Vendors — Dairybuy",
  description:
    "Cow and buffalo milk from approved Dairybuy vendors in 500 ml and 1 L packs. Vendor selection opens once vendor availability is confirmed.",
  openGraph: {
    title: "Fresh Milk Vendors — Dairybuy",
    description:
      "Cow and buffalo milk in 500 ml and 1 L packs from approved Dairybuy vendors.",
    type: "website",
  },
};

export default function MilkPage() {
  return (
    <main className="db-page">
      <Container as="section" className="py-(--section-y)">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-highlight-ink no-underline hover:underline"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Back to Product Catalogue</span>
        </Link>

        <div className="db-page-heading mt-5 flex flex-col gap-5 rounded-[2.5rem] border-2 border-white bg-[#dff5fc] p-6 shadow-pop sm:flex-row sm:items-center sm:p-9">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[2rem] border-[5px] border-white bg-[#ffd329] p-1 shadow-pop">
            <Image
              src="/images/products/milk.jpg"
              alt="Bottle of fresh milk"
              width={160}
              height={160}
              priority
              className="h-full w-full rounded-[1.5rem] object-cover"
            />
          </div>

          <div className="max-w-2xl">
            <p className="db-kicker inline-flex rounded-full bg-[#ffd329] px-4 py-2 text-sm font-extrabold text-[#284967]">
              Cow &amp; Buffalo Milk · 500 ml and 1 L Packs
            </p>
            <h1 className="mt-1">Choose Your Milk Vendor</h1>
            <p className="mt-2 text-base text-muted-foreground">
              Cow and buffalo milk comes from approved Dairybuy vendors, in standard 500 ml and 1 L packs. Vendor selection opens as soon as availability is confirmed.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <MilkVendorSelector />
        </div>
      </Container>
    </main>
  );
}
