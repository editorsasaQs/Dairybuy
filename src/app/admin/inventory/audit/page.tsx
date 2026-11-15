import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/brand/Container";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterInventoryAuditByArea, filterInventoryAuditFindings, resolveInventoryAuditLabels, type InventoryAuditArea, type InventoryAuditProduct, type InventoryAuditVariant } from "@/lib/services/inventory-audit-labels";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatStock(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

export default async function AdminInventoryAuditPage({ searchParams }: { searchParams: Promise<{ type?: string | string[]; area?: string | string[] }> }) {
  const query = await searchParams;
  const requestedType = Array.isArray(query.type) ? query.type[0] : query.type;\n  const requestedArea = Array.isArray(query.area) ? query.area[0] : query.area;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/admin/inventory/audit");

  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (roleError || !(roles ?? []).some((entry) => isAdminOrOwner(entry.role))) redirect("/account");

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
  const filteredRows = filterInventoryAuditByArea(typeFilteredRows, selectedArea);
  const auditHref = (type: string | null, area: string | null) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (area) params.set("area", area);
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
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-highlight-ink">Dairybuy operations</p>
            <h1 className="mt-2 text-3xl font-bold">Inventory audit</h1>
            <p className="mt-2 text-sm text-muted-foreground">Read-only reservation reconciliation · Owner and admin access only</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/admin/orders" className="text-highlight-ink underline">Order management</Link>
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
              <p className="mt-1 text-3xl font-bold tabular-nums">{formatStock(filteredRows.length)} <span className="text-sm font-medium text-muted-foreground">of {formatStock(rows.length)}</span></p>
              <p className="mt-2 text-xs text-muted-foreground">Read-only report. This page never repairs or adjusts stock automatically.</p>
            </section>
            {!labelsAvailable ? <p role="status" className="mb-4 rounded-2xl border border-[#f1d9a8] bg-[#fff8e7] p-4 text-sm text-muted-foreground">Some catalogue details could not be resolved. Stable product and area IDs remain visible below; no inventory values were changed.</p> : null}
            <nav aria-label="Filter inventory audit by discrepancy type" className="mb-4 flex flex-wrap gap-2">
              <Link href={auditHref(null, selectedArea)} aria-current={selectedType ? undefined : "page"} className={`rounded-full border px-4 py-2 text-sm font-semibold ${selectedType ? "border-[#dce5e8] bg-white text-muted-foreground" : "border-[#172f38] bg-[#172f38] text-white"}`}>
                All types ({rows.length})
              </Link>
              {availableTypes.map((type) => (
                <Link key={type} href={auditHref(type, selectedArea)} aria-current={selectedType === type ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize ${selectedType === type ? "border-[#172f38] bg-[#172f38] text-white" : "border-[#dce5e8] bg-white text-muted-foreground"}`}>
                  {typeLabel(type)} ({rows.filter((row) => row.audit_type === type).length})
                </Link>
              ))}
            </nav>
            <nav aria-label="Filter inventory audit by service area" className="mb-4 flex flex-wrap gap-2">
              <Link href={auditHref(selectedType, null)} aria-current={selectedArea ? undefined : "page"} className={`rounded-full border px-4 py-2 text-sm font-semibold ${selectedArea ? "border-[#dce5e8] bg-white text-muted-foreground" : "border-[#172f38] bg-[#172f38] text-white"}`}>
                All areas ({typeFilteredRows.length})
              </Link>
              {availableAreas.map(([id, label]) => (
                <Link key={id} href={auditHref(selectedType, id)} aria-current={selectedArea === id ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold ${selectedArea === id ? "border-[#172f38] bg-[#172f38] text-white" : "border-[#dce5e8] bg-white text-muted-foreground"}`}>
                  {label} ({typeFilteredRows.filter((row) => row.areaId === id).length})
                </Link>
              ))}
              {hasUnassignedArea ? (
                <Link href={auditHref(selectedType, "unassigned")} aria-current={selectedArea === "unassigned" ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold ${selectedArea === "unassigned" ? "border-[#172f38] bg-[#172f38] text-white" : "border-[#dce5e8] bg-white text-muted-foreground"}`}>
                  Unassigned ({typeFilteredRows.filter((row) => row.areaId === null).length})
                </Link>
              ) : null}
            </nav>
            {filteredRows.length === 0 ? (
              <section className="rounded-3xl border-2 border-white bg-white p-8 text-center shadow-sm">
                <h2 className="font-bold">No findings for this discrepancy type</h2>
                <p className="mt-2 text-sm text-muted-foreground">Choose another filter or view all audit findings.</p>
                <Link href={auditHref(null, null)} className="mt-3 inline-block font-semibold text-highlight-ink underline">Clear filters</Link>
              </section>
            ) : (
            <div className="grid gap-3">
              {filteredRows.map((row, index) => (
                <article key={`${row.audit_type}-${row.inventory_id}-${row.order_id ?? index}`} className="rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{row.audit_type === "inventory_balance" ? "Inventory balance mismatch" : "Order reservation anomaly"}</p>
                      <h2 className="mt-1 font-bold">{row.productLabel}</h2><p className="mt-1 break-all text-xs text-muted-foreground">Variant ID: {row.productId}</p>
                    </div>
                    {row.order_id ? <Link href={`/admin/orders/${row.order_id}`} className="text-sm font-semibold text-highlight-ink underline">Open order</Link> : null}
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="text-xs text-muted-foreground">Recorded reserved stock</dt><dd className="mt-1 font-bold tabular-nums">{formatStock(row.recorded_reserved_stock)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Ledger balance</dt><dd className="mt-1 font-bold tabular-nums">{formatStock(row.ledger_reserved_stock)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Service area</dt><dd className="mt-1 font-medium">{row.areaLabel ?? (row.areaId ? "Area details unavailable" : "Not assigned")}</dd><dd className="mt-1 break-all text-xs text-muted-foreground">{row.areaId ?? "No area ID"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Order status</dt><dd className="mt-1 font-medium capitalize">{row.order_status?.replaceAll("_", " ") ?? "Inventory level"}</dd></div>
                  </dl>
                  <p className="mt-4 rounded-xl bg-[#f8fbfc] p-3 text-sm text-muted-foreground">{row.detail}</p>
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
