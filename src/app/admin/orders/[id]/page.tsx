import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/brand/Container";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { isValidOrderId } from "@/lib/services/admin-order-filters";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OrderStatusActions } from "./OrderStatusActions";
import { CodCollectionReview, type CodCollectionReviewRecord } from "./CodCollectionReview";
import { parseOrderDeliveryAddressSnapshot } from "@/lib/services/order-address-snapshot";
import { getInventoryAuditSeverity, resolveInventoryAuditLabels, summarizeInventoryAuditSeverity, type InventoryAuditProduct, type InventoryAuditVariant } from "@/lib/services/inventory-audit-labels";

type OrderAuditFinding = {
  audit_type: string;
  inventory_id: string;
  order_id: string | null;
  product_variant_id: string;
  service_area_id: string | null;
  recorded_reserved_stock: number;
  ledger_reserved_stock: number;
  order_status: string | null;
  detail: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatInr(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(value));
}
function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

export default async function AdminOrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  if (!isValidOrderId(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect(`/login?next=${encodeURIComponent(`/admin/orders/${id}`)}`);
  const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (roleError || !(roles ?? []).some((entry) => isAdminOrOwner(entry.role))) redirect("/account");

  const { data: order, error } = await supabase.from("orders")
    .select("id,order_number,customer_id,service_area_id,delivery_slot_id,order_type,status,payment_status,payment_method,subtotal_paise,delivery_fee_paise,total_paise,delivery_date,delivery_address_snapshot,delivery_address_snapshot_source,delivery_address_snapshot_at,delivery_notes,created_at,updated_at")
    .eq("id", id)
    .eq("order_type", "one_time")
    .maybeSingle();
  if (error || !order) notFound();

  const [itemsResult, slotResult, areaResult, historyResult, auditResult, collectionResult] = await Promise.all([
    supabase.from("order_items").select("id,product_name_snapshot,variant_name_snapshot,brand_snapshot,pack_size_snapshot,vendor_name_snapshot,quantity,quantity_litres,unit_price_paise,total_price_paise").eq("order_id", order.id).order("id"),
    supabase.from("delivery_slots").select("label,start_time,end_time").eq("id", order.delivery_slot_id).maybeSingle(),
    supabase.from("service_areas").select("id,name,city,state").eq("id", order.service_area_id).maybeSingle(),
    supabase.from("order_status_history").select("from_status,to_status,changed_by,note,created_at").eq("order_id", order.id).order("created_at", { ascending: true }),
    supabase.rpc("audit_inventory_reservations"),
    supabase.rpc("get_admin_cod_collection", { p_order_id: order.id }),
  ]);
  if (itemsResult.error || slotResult.error || areaResult.error || historyResult.error || collectionResult.error) {
    throw new Error("Unable to load order details.");
  }

  const orderAuditRows = ((auditResult.data ?? []) as unknown as OrderAuditFinding[]).filter((finding) => finding.order_id === order.id);
  const auditVariantIds = [...new Set(orderAuditRows.map((finding) => finding.product_variant_id))];
  const auditVariantsResult = auditVariantIds.length
    ? await supabase.from("product_variants").select("id,product_id,variant_name,pack_size,brand").in("id", auditVariantIds)
    : null;
  const auditVariants = (auditVariantsResult?.data ?? []) as InventoryAuditVariant[];
  const auditProductIds = [...new Set(auditVariants.map((variant) => variant.product_id))];
  const auditProductsResult = auditProductIds.length
    ? await supabase.from("products").select("id,name").in("id", auditProductIds)
    : null;
  const auditProducts = (auditProductsResult?.data ?? []) as InventoryAuditProduct[];
  const auditLabelsAvailable = !auditVariantIds.length || (!auditVariantsResult?.error && (!auditProductIds.length || !auditProductsResult?.error));
  const orderAuditDisplayRows = resolveInventoryAuditLabels(orderAuditRows, auditVariants, auditProducts, areaResult.data ? [areaResult.data] : []);
  const orderAuditSummary = summarizeInventoryAuditSeverity(orderAuditDisplayRows);

  const address = parseOrderDeliveryAddressSnapshot(order.delivery_address_snapshot);
  const slot = slotResult.data;
  const area = areaResult.data;
  const codCollection = (collectionResult.data?.[0] ?? null) as CodCollectionReviewRecord | null;

  return (
    <main className="db-page py-(--section-y)">
      <Container className="max-w-4xl">
        <a href="#order-content" className="sr-only rounded-lg bg-white px-4 py-2 font-semibold focus:not-sr-only focus:absolute focus:z-20">Skip to order details</a>
        <Link href="/admin/orders" className="text-sm font-semibold text-highlight-ink underline">← Back to order queue</Link>
        <div id="order-content" className="mt-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div><p className="text-sm font-semibold text-highlight-ink">Dairybuy operations</p><h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">{order.order_number}</h1><p className="mt-2 text-sm text-muted-foreground">Placed {formatTimestamp(order.created_at)} · Updated {formatTimestamp(order.updated_at)}</p></div>
          <span className="rounded-full bg-[#e7f6fc] px-4 py-2 text-sm font-bold capitalize">{order.status.replaceAll("_", " ")}</span>
        </div>

        <div className="mt-5 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-2">
          <section className="min-w-0 rounded-3xl border-2 border-white bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-bold">Customer and delivery address</h2>
            {address ? <><p className="mt-3 break-words font-semibold">{address.recipient_name} · {address.phone}</p><p className="mt-1 text-sm">{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}{address.landmark ? `, ${address.landmark}` : ""}</p><p className="text-sm text-muted-foreground">{address.city}, {address.state} – {address.pincode}</p></> : <p className="mt-3 text-sm text-muted-foreground">Order address snapshot is unavailable.</p>}
            <p className="mt-3 break-all text-xs text-muted-foreground">Customer ID: {order.customer_id}</p>
            <p className="mt-3 rounded-xl bg-[#fff8e7] p-3 text-xs text-muted-foreground">{order.delivery_address_snapshot_source === "legacy_reconstructed"
              ? "Reconstructed from the currently linked saved address during migration; this is not a verified checkout-time address."
              : "Captured and preserved atomically when the order was placed."}</p>
            {order.delivery_notes ? <p className="mt-3 text-sm">Delivery note: {order.delivery_notes}</p> : null}
          </section>
          <section className="min-w-0 rounded-3xl border-2 border-white bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-bold">Delivery and payment</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div><dt className="text-muted-foreground">Delivery date</dt><dd className="font-semibold">{order.delivery_date ? formatDate(order.delivery_date) : "Not set"}</dd></div>
              <div><dt className="text-muted-foreground">Slot</dt><dd className="font-semibold">{slot ? `${slot.label} · ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}` : "Unavailable"}</dd></div>
              <div><dt className="text-muted-foreground">Service area</dt><dd className="font-semibold">{area ? `${area.name}, ${area.city}` : "Unavailable"}</dd></div>
              <div><dt className="text-muted-foreground">Payment</dt><dd className="font-semibold">Cash on delivery · {order.payment_status}</dd></div>
            </dl>
            <p className="mt-4 rounded-xl bg-[#e7f6fc] p-3 text-xs text-muted-foreground">Delivery completion does not mark cash as collected. COD collection is verified separately.</p>
          </section>
        </div>

        <section className="mt-4 rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
          <h2 className="font-bold">Order items</h2>
          <ul className="mt-3 divide-y divide-border">
            {(itemsResult.data ?? []).map((item) => <li key={item.id} className="flex min-w-0 flex-wrap justify-between gap-3 py-3 text-sm"><div className="min-w-0 flex-1"><p className="break-words font-semibold">{item.product_name_snapshot ?? "Dairybuy product"}</p><p className="text-xs text-muted-foreground">{[item.variant_name_snapshot,item.brand_snapshot,item.pack_size_snapshot,item.vendor_name_snapshot].filter(Boolean).join(" · ")} · Qty {item.quantity}{item.quantity_litres ? ` · ${item.quantity_litres} L` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{formatInr(item.unit_price_paise)} each</p></div><p className="shrink-0 text-right font-bold tabular-nums">{formatInr(item.total_price_paise)}</p></li>)}
          </ul>
          <dl className="mt-3 space-y-2 border-t border-border pt-4 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>{formatInr(order.subtotal_paise)}</dd></div><div className="flex justify-between"><dt>Delivery fee</dt><dd>{formatInr(order.delivery_fee_paise)}</dd></div><div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatInr(order.total_paise)}</dd></div></dl>
        </section>

        <section className="mt-4 rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-bold">Inventory reservation audit</h2><p className="mt-1 text-xs text-muted-foreground">Read-only reconciliation context for this order</p></div>
            <Link href="/admin/inventory/audit?type=order_ledger" className="text-sm font-semibold text-highlight-ink underline">Open full inventory audit</Link>
          </div>
          {auditResult.error ? (
            <p role="status" aria-live="polite" className="mt-4 rounded-xl border border-[#f1d9a8] bg-[#fff8e7] p-3 text-sm text-muted-foreground">Order-specific audit context is temporarily unavailable. The order itself loaded successfully; no inventory values were changed.</p>
          ) : orderAuditDisplayRows.length === 0 ? (
            <p role="status" aria-live="polite" className="mt-4 rounded-xl bg-[#f3f7f8] p-3 text-sm text-muted-foreground">No order-specific reservation ledger anomalies are currently reported by the read-only audit.</p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="min-w-0 rounded-2xl bg-[#f3f7f8] p-2 sm:p-3"><p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">Findings</p><p className="mt-1 text-lg font-bold tabular-nums sm:text-xl">{orderAuditSummary.total}</p></div>
                <div className="min-w-0 rounded-2xl border border-[#f2c6c2] bg-[#fff3f1] p-2 sm:p-3"><p className="text-[11px] font-semibold leading-tight text-[#9f3028] sm:text-xs">Critical</p><p className="mt-1 text-xl font-bold tabular-nums text-[#9f3028]">{orderAuditSummary.critical}</p></div>
                <div className="min-w-0 rounded-2xl border border-[#f1d9a8] bg-[#fff8e7] p-2 sm:p-3"><p className="text-[11px] font-semibold leading-tight text-[#805b18] sm:text-xs">High</p><p className="mt-1 text-xl font-bold tabular-nums text-[#805b18]">{orderAuditSummary.high}</p></div>
              </div>
              {!auditLabelsAvailable ? <p role="status" className="mt-3 text-xs text-muted-foreground">Some catalogue labels could not be resolved; stable variant IDs remain available.</p> : null}
              <ul className="mt-3 divide-y divide-border">
                {orderAuditDisplayRows.map((finding, index) => (
                  <li key={`${finding.inventory_id}-${index}`} className="min-w-0 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 break-words font-semibold">{finding.productLabel}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${getInventoryAuditSeverity(finding) === "critical" ? "bg-[#fff0ee] text-[#a12e25]" : "bg-[#fff7e6] text-[#805b18]"}`}>{getInventoryAuditSeverity(finding)} severity</span>
                    </div>
                    <p className="mt-1 break-all text-xs text-muted-foreground">Variant {finding.productId} · {finding.areaLabel ?? "Service area unavailable"} · {finding.order_status?.replaceAll("_", " ") ?? "Status unavailable"}</p>
                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-xs text-muted-foreground">Recorded reserved stock</dt><dd className="font-bold tabular-nums">{finding.recorded_reserved_stock}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">Order ledger balance</dt><dd className="font-bold tabular-nums">{finding.ledger_reserved_stock}</dd></div>
                    </dl>
                    <p className="mt-3 rounded-xl bg-[#f8fbfc] p-3 text-sm text-muted-foreground">{finding.detail}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <CodCollectionReview orderId={order.id} orderTotalPaise={order.total_paise} collection={codCollection} />

        <OrderStatusActions orderId={order.id} currentStatus={order.status} />

        <section className="mt-4 rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
          <h2 className="font-bold">Status history</h2>
          {(historyResult.data ?? []).length ? <ol className="mt-4 space-y-4">{historyResult.data!.map((event,index) => <li key={`${event.created_at}-${index}`} className="border-l-2 border-[#b9ddea] pl-4"><p className="font-semibold capitalize">{event.from_status ? `${event.from_status.replaceAll("_"," ")} → ` : ""}{event.to_status.replaceAll("_"," ")}</p><p className="mt-1 text-xs text-muted-foreground">{formatTimestamp(event.created_at)} · Actor {event.changed_by ?? "system"}</p>{event.note ? <p className="mt-1 text-sm text-muted-foreground">{event.note}</p> : null}</li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">No status changes have been recorded yet.</p>}
        </section>
      </Container>
    </main>
  );
}
