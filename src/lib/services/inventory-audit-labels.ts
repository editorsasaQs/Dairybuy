export type InventoryAuditVariant = {
  id: string;
  product_id: string;
  variant_name: string;
  pack_size: string;
  brand: string | null;
};

export type InventoryAuditProduct = {
  id: string;
  name: string;
};

export type InventoryAuditArea = {
  id: string;
  name: string;
  city: string;
};

export type InventoryAuditFindingRef = {
  product_variant_id: string;
  service_area_id: string | null;
};

export function resolveInventoryAuditLabels(
  findings: InventoryAuditFindingRef[],
  variants: InventoryAuditVariant[],
  products: InventoryAuditProduct[],
  areas: InventoryAuditArea[],
) {
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const productById = new Map(products.map((product) => [product.id, product.name]));
  const areaById = new Map(areas.map((area) => [area.id, area]));

  return findings.map((finding) => {
    const variant = variantById.get(finding.product_variant_id);
    const productName = variant ? productById.get(variant.product_id) : undefined;
    const productLabel = variant
      ? [productName, variant.variant_name, variant.pack_size, variant.brand]
          .filter((part): part is string => Boolean(part && part.trim()))
          .join(" · ")
      : finding.product_variant_id;
    const area = finding.service_area_id ? areaById.get(finding.service_area_id) : undefined;

    return {
      ...finding,
      productLabel: productLabel || finding.product_variant_id,
      productId: finding.product_variant_id,
      areaLabel: area ? [area.name, area.city].filter(Boolean).join(" · ") : null,
      areaId: finding.service_area_id,
    };
  });
}
