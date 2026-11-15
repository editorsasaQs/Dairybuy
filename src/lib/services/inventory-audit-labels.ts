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

export function resolveInventoryAuditLabels<T extends InventoryAuditFindingRef>(
  findings: T[],
  variants: InventoryAuditVariant[],
  products: InventoryAuditProduct[],
  areas: InventoryAuditArea[],
): (T & { productLabel: string; productId: string; catalogProductId: string | null; catalogProductLabel: string; areaLabel: string | null; areaId: string | null })[] {
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
      catalogProductId: variant?.product_id ?? null,
      catalogProductLabel: productName ?? (variant ? variant.product_id : "Product details unavailable"),
      areaLabel: area ? [area.name, area.city].filter(Boolean).join(" · ") : null,
      areaId: finding.service_area_id,
    };
  });
}

export function filterInventoryAuditFindings<T extends { audit_type: string }>(
  findings: T[],
  selectedType: string | null,
): T[] {
  if (!selectedType || !findings.some((finding) => finding.audit_type === selectedType)) {
    return findings;
  }

  return findings.filter((finding) => finding.audit_type === selectedType);
}

export function filterInventoryAuditByArea<T extends { areaId: string | null }>(
  findings: T[],
  selectedArea: string | null,
): T[] {
  if (!selectedArea) return findings;

  if (selectedArea === "unassigned") {
    return findings.some((finding) => finding.areaId === null)
      ? findings.filter((finding) => finding.areaId === null)
      : findings;
  }

  return findings.some((finding) => finding.areaId === selectedArea)
    ? findings.filter((finding) => finding.areaId === selectedArea)
    : findings;
}

export function filterInventoryAuditByProduct<T extends { catalogProductId: string | null }>(
  findings: T[],
  selectedProduct: string | null,
): T[] {
  if (!selectedProduct) return findings;

  if (selectedProduct === "unresolved") {
    return findings.some((finding) => finding.catalogProductId === null)
      ? findings.filter((finding) => finding.catalogProductId === null)
      : findings;
  }

  return findings.some((finding) => finding.catalogProductId === selectedProduct)
    ? findings.filter((finding) => finding.catalogProductId === selectedProduct)
    : findings;
}

export type InventoryAuditSeverity = "critical" | "high";

export type InventoryAuditSeverityFinding = {
  audit_type: string;
  ledger_reserved_stock: number;
  order_status: string | null;
};

export function getInventoryAuditSeverity(finding: InventoryAuditSeverityFinding): InventoryAuditSeverity {
  const status = finding.order_status;
  const terminalOrder = status === "cancelled" || status === "delivered";
  const activeOrder = status === "pending_confirmation" || status === "confirmed"
    || status === "processing" || status === "out_for_delivery";

  if (finding.ledger_reserved_stock < 0) return "critical";
  if (finding.audit_type === "order_ledger" && activeOrder && finding.ledger_reserved_stock <= 0) return "critical";
  if (finding.audit_type === "order_ledger" && terminalOrder && finding.ledger_reserved_stock !== 0) return "critical";

  return "high";
}

export function summarizeInventoryAuditSeverity<T extends InventoryAuditSeverityFinding>(findings: T[]) {
  return findings.reduce(
    (summary, finding) => {
      summary.total += 1;
      if (getInventoryAuditSeverity(finding) === "critical") summary.critical += 1;
      else summary.high += 1;
      return summary;
    },
    { total: 0, critical: 0, high: 0 },
  );
}
