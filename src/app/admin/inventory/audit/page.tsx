import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/brand/Container";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterInventoryAuditByArea, filterInventoryAuditByProduct, filterInventoryAuditFindings, getInventoryAuditSeverity, resolveInventoryAuditLabels, summarizeInventoryAuditSeverity, type InventoryAuditArea, type InventoryAuditProduct, type InventoryAuditVariant } from "@/lib/services/inventory-audit-labels";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatStock(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

export default async function AdminInventoryAuditPage({ searchParams }: { searchParams: Promise<{ type?: string | string[]; area?: string | string[]; product?: string | string[] }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/admin/inventory/audit");

  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (roleError || !(roles ?? []).some((entry) => isAdminOrOwner(entry.role))) redirect("/account");

  const query = await searchParams;
  const requestedType = Array.isArray(query.type) ? query.type[0] : query.type;
  const requestedArea = Array.isArray(query.area) ? query.area[0] : query.area;
  const requestedProduct = Array.isArray(query.product) ? query.product[0] : query.product;
  const { data: findings, error: auditError } = await supabase.rpc("audit_inventory_reservations");
  const auditAvailable = !auditError;
  const rows = findings ?? [];
  const variantIds = [...new Set(rows.map((row) => row.product_variant_id))];
  const areaIds = [...new Set(rows.flatMap((row) => row.service_area_id ? [row.service_area_id] : []))];

  const [variantResult, areaResult] = await Promise.all([
    supabase.from("product_variants").select("id,product_id,variant_name,pack_size,brand").in("id", variantIds),
    supabase.from("service_areas").select("id,name,city").in("id", areaIds),
  ]);
  const variants = (variantResult.data ?? []) as InventoryAuditVariant[];
  const productIds = [...new Set(variants.map((variant) => variant.product_id))];
  const productResult = await supabase.from("products").select("id,name").in("id", productIds);
  const products = (productResult.data ?? []) as InventoryAuditProduct[];
  const areas = (areaResult.data ?? []) as InventoryAuditArea[];
  const labelsAvailable = !variantResult.error && !productResult.error && !areaResult.error;
  const displayRows = resolveInventoryAuditLabels(rows, variants, products, areas);
  const availableTypes = [...new Set(rows.map((row) => row.audit_type))].sort();
  const selectedType = requestedType && availableTypes.includes(requestedType) ? requestedType : null;
  const typeFilteredRows = filterInventoryAuditFindings(displayRows, selectedType);
  const availableAreas = [...new Map(displayRows.flatMap((row) => row.areaId && row.areaLabel ? [[row.areaId, row.areaLabel] as const] : [])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const hasUnassignedArea = displayRows.some((row) => row.areaId === null);
  const validAreaValues = new Set([...availableAreas.map(([id]) => id), ...(hasUnassignedArea ? ["unassigned"] : [])]);
  const selectedArea = requestedArea && validAreaValues.has(requestedArea) ? requestedArea : null;
  const areaFilteredRows = filterInventoryAuditByArea(typeFilteredRows, selectedArea);
  const availableProducts = [...new Map(areaFilteredRows.flatMap((row) => row.catalogProductId
    ? [[row.catalogProductId, row.catalogProductLabel] as const]
    : [])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const hasUnresolvedProduct = areaFilteredRows.some((row) => row.catalogProductId === null);
  const validProductValues = new Set([...availableProducts.map(([id]) => id), ...(hasUnresolvedProduct ? ["unresolved"] : [])]);
  const selectedProduct = requestedProduct && validProductValues.has(requestedProduct) ? requestedProduct : null;
  const filteredRows = filterInventoryAuditByProduct(areaFilteredRows, selectedProduct);
  const severitySummary = summarizeInventoryAuditSeverity(filteredRows);
  const orderIds = [...new Set(rows.flatMap((row) => row.order_id ? [row.order_id] : []))];
  const orderResult = orderIds.length
    ? await supabase.from("orders").select("id,order_number").in("id", orderIds)
    : null;
  const orderNumbers = new Map((orderResult?.data ?? []).map((order) => [order.id, order.order_number]));
  const auditHref = (type: string | null, area: string | null, product: string | null) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (area) params.set("area", area);
    if (product) params.set("product", product);
    const queryString = params.toString();
    return queryString ? `/admin/inventory/audit?${queryString}` : "/admin/inventory/audit";
  };
  const typeLabel = (type: string) => type === "inventory_balance"
    ? "Inventory balance"
    : type === "order_reservation"
      ? "Order reservation"
      : type.replaceAll("_", " ");

  return (
    <main className="db-page py-(--section-y)">
      <Container className="max-w-6xl">
        <a href="#audit-findings" className="sr-only rounded-lg bg-white px-4 py-2 font-semibold focus:not-sr-only focus:absolute focus:z-20">Skip to audit findings</a>
        <div className="mb-6 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-highlight-ink">Dairybuy operations</p>
            <h1 className="mt-2 text-3xl font-bold">Inventory audit</h1>
            <p className="mt-2 text-sm text-muted-foreground">Read-only reservation reconciliation · Owner and admin access only</p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
            <Link href="/admin/inventory" className="text-highlight-ink underline">Physical inventory</Link>\n            <Link href="/admin/orders" className="text-highlight-ink underline">Order management</Link>
            <Link href="/account" className="text-highlight-ink underline">Back to account</Link>
          </div>
        </div>

        {!auditAvailable ? (
          <section role="alert" className="rounded-3xl border-2 border-[#f1d9a8] bg-[#fff8e7] p-5">
            <h2 className="font-bold">Inventory audit is temporarily unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">The reconciliation service could not be loaded. No inventory values have been changed. Check the database migration and audit permissions, then retry.</p>
          </section>
        ) : rows.length === 0 ? (
          <section className="rounded-3xl border-2 border-white bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-semibold text-highlight-ink">Audit complete</p>
            <h2 className="mt-2 text-2xl font-bold">No reservation discrepancies found</h2>
            <p className="mt-2 text-sm text-muted-foreground">Inventory reserved counters and the available reservation ledger checks are currently consistent.</p>
          </section>
        ) : (
          <>
            <section className="mb-5 rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Findings requiring review</p>
              <p role="status" aria-live="polite" aria-atomic="true" className="mt-1 text-3xl font-bold tabular-nums">{formatStock(filteredRows.length)} <span className="text-sm font-medium text-muted-foreground">of {formatStock(rows.length)}</span></p>
              <p className="mt-2 text-xs text-muted-foreground">Read-only report. This page never repairs or adjusts stock automatically.</p>
              <div role="group" aria-label="Discrepancy severity summary" className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="min-w-0 rounded-2xl bg-[#f3f7f8] p-2 sm:p-3"><p className="text-[11px] font-semibold leading-tight text-muted-foreground sm:text-xs">Total findings</p><p className="mt-1 text-lg font-bold tabular-nums sm:text-xl">{formatStock(severitySummary.total)}</p></div>
                <div className="min-w-0 rounded-2xl border border-[#f2c6c2] bg-[#fff3f1] p-2 sm:p-3"><p className="text-[11px] font-semibold leading-tight text-[#9f3028] sm:text-xs">Critical</p><p className="mt-1 text-xl font-bold tabular-nums text-[#9f3028]">{formatStock(severitySummary.critical)}</p></div>
                <div className="min-w-0 rounded-2xl border border-[#f1d9a8] bg-[#fff8e7] p-2 sm:p-3"><p className="text-[11px] font-semibold leading-tight text-[#805b18] sm:text-xs">High</p><p className="mt-1 text-xl font-bold tabular-nums text-[#805b18]">{formatStock(severitySummary.high)}</p></div>
              </div>
            </section>
            {!labelsAvailable ? <p role="status" className="mb-4 rounded-2xl border border-[#f1d9a8] bg-[#fff8e7] p-4 text-sm text-muted-foreground">Some catalogue details could not be resolved. Stable product and area IDs remain visible below; no inventory values were changed.</p> : null}
            <nav aria-label="Filter inventory audit by discrepancy type" tabIndex={0} className="mb-4 -mx-1 flex w-[calc(100%+0.5rem)] flex-nowrap gap-2 overflow-x-auto overscroll-x-contain px-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link href={auditHref(null, selectedArea, selectedProduct)} aria-current={selectedType ? undefined : "page"} className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${selectedType ? "border-[#dce5e8] bg-white text-muted-foreground" : "border-[#172f38] bg-[#172f38] text-white"}`}>
                All types ({rows.length})
              </Link>
              {availableTypes.map((type) => (
                <Link key={type} href={auditHref(type, selectedArea, selectedProduct)} aria-current={selectedType === type ? "page" : undefined} className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold capitalize ${selectedType === type ? "border-[#172f38] bg-[#172f38] text-white" : "border-[#dce5e8] bg-white text-muted-foreground"}`}>
                  {typeLabel(type)} ({rows.filter((row) => row.audit_type === type).length})
                </Link>
              ))}
            </nav>
            <nav aria-label="Filter inventory audit by service area" tabIndex={0} className="mb-4 -mx-1 flex w-[calc(100%+0.5rem)] flex-nowrap gap-2 overflow-x-auto overscroll-x-contain px-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link href={auditHref(selectedType, null, selectedProduct)} aria-current={selectedArea ? undefined : "page"} className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${selectedArea ? "border-[#dce5e8] bg-white text-muted-foreground" : "border-[#172f38] bg-[#172f38] text-white"}`}>
                All areas ({typeFilteredRows.length})
              </Link>
              {availableAreas.map(([id, label]) => (
                <Link key={id} href={auditHref(selectedType, id, selectedProduct)} aria-current={selectedArea === id ? "page" : undefined} className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${selectedArea === id ? "border-[#172f38] bg-[#172f38] text-white" : "border-[#dce5e8] bg-white text-muted-foreground"}`}>
                  {label} ({typeFilteredRows.filter((row) => row.areaId === id).length})
                </Link>
              ))}
              {hasUnassignedArea ? (
                <Link href={auditHref(selectedType, "unassigned", selectedProduct)} aria-current={selectedArea === "unassigned" ? "page" : undefined} className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${selectedArea === "unassigned" ? "border-[#172f38] bg-[#172f38] text-white" : "border-[#dce5e8] bg-white text-muted-foreground"}`}>
                  Unassigned ({typeFilteredRows.filter((row) => row.areaId === null).length})
                </Link>
              ) : null}
            </nav>
            <nav aria-label="Filter inventory audit by product" tabIndex={0} className="mb-4 -mx-1 flex w-[calc(100%+0.5rem)] flex-nowrap gap-2 overflow-x-auto overscroll-x-contain px-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link href={auditHref(selectedType, selectedArea, null)} aria-current={selectedProduct ? undefined : "page"} className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${selectedProduct ? "border-[#dce5e8] bg-white text-muted-foreground" : "border-[#172f38] bg-[#172f38] text-white"}`}>
                All products ({areaFilteredRows.length})
              </Link>
              {availableProducts.map(([id, label]) => (
                <Link key={id} href={auditHref(selectedType, selectedArea, id)} aria-current={selectedProduct === id ? "page" : undefined} className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${selectedProduct === id ? "border-[#172f38] bg-[#172f38] text-white" : "border-[#dce5e8] bg-white text-muted-foreground"}`}>
                  {label} ({areaFilteredRows.filter((row) => row.catalogProductId === id).length})
                </Link>
              ))}
              {hasUnresolvedProduct ? (
                <Link href={auditHref(selectedType, selectedArea, "unresolved")} aria-current={selectedProduct === "unresolved" ? "page" : undefined} className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${selectedProduct === "unresolved" ? "border-[#172f38] bg-[#172f38] text-white" : "border-[#dce5e8] bg-white text-muted-foreground"}`}>
                  Unresolved ({areaFilteredRows.filter((row) => row.catalogProductId === null).length})
                </Link>
              ) : null}
            </nav>
            {filteredRows.length === 0 ? (
              <section className="rounded-3xl border-2 border-white bg-white p-8 text-center shadow-sm">
                <h2 className="font-bold">No findings for this discrepancy type</h2>
                <p className="mt-2 text-sm text-muted-foreground">Choose another filter or view all audit findings.</p>
                <Link href={auditHref(null, null, null)} className="mt-3 inline-block font-semibold text-highlight-ink underline">Clear filters</Link>
              </section>
            ) : (
            <div id="audit-findings" aria-label="Inventory audit findings" className="grid gap-3">
              {filteredRows.map((row, index) => (
                <article key={`${row.audit_type}-${row.inventory_id}-${row.order_id ?? index}`} className="rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span role="status" aria-label={`${getInventoryAuditSeverity(row)} severity`} className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${getInventoryAuditSeverity(row) === "critical" ? "bg-[#fff0ee] text-[#a12e25]" : "bg-[#fff7e6] text-[#805b18]"}`}>{getInventoryAuditSeverity(row)} severity</span>
                        <span className="text-xs text-muted-foreground">{row.audit_type.replaceAll("_", " ")}</span>
                      </div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{row.audit_type === "inventory_balance" ? "Inventory balance mismatch" : "Order reservation anomaly"}</p>
                      <h2 className="mt-1 break-words font-bold">{row.productLabel}</h2><p className="mt-1 break-all text-xs text-muted-foreground">Variant ID: {row.productId}</p>
                    </div>
                    {row.order_id ? <Link href={`/admin/orders/${row.order_id}`} className="shrink-0 text-sm font-semibold text-highlight-ink underline">Open {orderNumbers.get(row.order_id) ?? `order ${row.order_id.slice(0, 8)}`}</Link> : null}
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div className="min-w-0"><dt className="text-[11px] leading-tight text-muted-foreground sm:text-xs">Recorded reserved stock</dt><dd className="mt-1 font-bold tabular-nums">{formatStock(row.recorded_reserved_stock)}</dd></div>
                    <div className="min-w-0"><dt className="text-[11px] leading-tight text-muted-foreground sm:text-xs">Ledger balance</dt><dd className="mt-1 font-bold tabular-nums">{formatStock(row.ledger_reserved_stock)}</dd></div>
                    <div className="min-w-0"><dt className="text-[11px] leading-tight text-muted-foreground sm:text-xs">Service area</dt><dd className="mt-1 font-medium">{row.areaLabel ?? (row.areaId ? "Area details unavailable" : "Not assigned")}</dd><dd className="mt-1 break-all text-xs text-muted-foreground">{row.areaId ?? "No area ID"}</dd></div>
                    <div className="min-w-0"><dt className="text-[11px] leading-tight text-muted-foreground sm:text-xs">Order status</dt><dd className="mt-1 font-medium capitalize">{row.order_status?.replaceAll("_", " ") ?? "Inventory level"}</dd></div>
                  </dl>
                  <p className="mt-4 break-words rounded-xl bg-[#f8fbfc] p-3 text-sm text-muted-foreground">{row.detail}</p>
                </article>
              ))}
            </div>
            ) }
          </>
        )}

        <p className="mt-6 text-xs text-muted-foreground">Scope: reservation/release/fulfillment ledger only. This is not a physical stocktake or an available-stock reconciliation.</p>
      </Container>
    </main>
  );
}
