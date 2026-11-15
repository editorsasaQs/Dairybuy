import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/brand/Container";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatStock(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

export default async function AdminInventoryAuditPage() {
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
              <p className="mt-1 text-3xl font-bold tabular-nums">{formatStock(rows.length)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Read-only report. This page never repairs or adjusts stock automatically.</p>
            </section>
            <div className="grid gap-3">
              {rows.map((row, index) => (
                <article key={`${row.audit_type}-${row.inventory_id}-${row.order_id ?? index}`} className="rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{row.audit_type === "inventory_balance" ? "Inventory balance mismatch" : "Order reservation anomaly"}</p>
                      <h2 className="mt-1 break-all font-bold">{row.product_variant_id}</h2>
                    </div>
                    {row.order_id ? <Link href={`/admin/orders/${row.order_id}`} className="text-sm font-semibold text-highlight-ink underline">Open order</Link> : null}
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="text-xs text-muted-foreground">Recorded reserved stock</dt><dd className="mt-1 font-bold tabular-nums">{formatStock(row.recorded_reserved_stock)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Ledger balance</dt><dd className="mt-1 font-bold tabular-nums">{formatStock(row.ledger_reserved_stock)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Service area ID</dt><dd className="mt-1 break-all font-medium">{row.service_area_id ?? "Not assigned"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Order status</dt><dd className="mt-1 font-medium capitalize">{row.order_status?.replaceAll("_", " ") ?? "Inventory level"}</dd></div>
                  </dl>
                  <p className="mt-4 rounded-xl bg-[#f8fbfc] p-3 text-sm text-muted-foreground">{row.detail}</p>
                </article>
              ))}
            </div>
          </>
        )}

        <p className="mt-6 text-xs text-muted-foreground">Scope: reservation/release/fulfillment ledger only. This is not a physical stocktake or an available-stock reconciliation.</p>
      </Container>
    </main>
  );
}
