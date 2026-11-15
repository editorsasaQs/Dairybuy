import type { Metadata } from "next";
import { ProductDetail } from "@/components/catalogue/ProductDetail";

export const metadata: Metadata = {
  title: "Product Details — Dairybuy",
  description: "View current product pack sizes and add confirmed Dairybuy products to your bag.",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProductDetail slug={slug} />;
}
