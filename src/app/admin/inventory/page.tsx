import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/brand/Container";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InventoryReceiptForm } from "./InventoryReceiptForm";
import { InventoryAdjustmentForm } from "./InventoryAdjustmentForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Query = { area?: string | string[]; received?: string | string[]; adjusted?: string | string[] };
type VariantRow = { id: string; product_id: string; variant_name: string; pack_size: string; brand: string | null; is_orderable: boolean };
type ProductRow = { id: string; name: string };
type InventoryRow = { id: string; product_variant_id: string; service_area_id: string | null; available_stock: number; reserved_stock: number; safety_stock: number; updated_at: string };
type ReceiptRow = { id: string; receipt_number: string; vendor_id: string; service_area_id: string; received_at: string; vendor_reference: string | null; total_units: number; total_cost_paise: number; notes: string | null };
type AdjustmentRow = { id: string; adjustment_number: string; inventory_id: string; adjustment_type: string; quantity_delta: number; reason: string; evidence_reference: string | null; created_at: string };
type MovementRow = { id: string; inventory_id: string; change_amount: number; movement_type: string; reference_id: string | null; notes: string | null; created_at: string };
const value = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
const number = (n: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
const stamp = (v: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(v));

export default async function AdminInventoryPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const selectedArea = value(query.area) ?? "";
  const received = value(query.received);
  const adjusted = value(query.adjusted);
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/admin/inventory");
  const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (roleError || !(roles ?? []).some((entry) => isAdminOrOwner(entry.role))) redirect("/account");

  const [areaResult, vendorResult, variantResult, productResult, inventoryResult, receiptResult, adjustmentResult, movementResult, auditResult] = await Promise.all([
    supabase.from("service_areas").select("id,name,city").eq("is_active", true).order("name"),
    supabase.from("vendors").select("id,name,is_approved").eq("is_approved", true).order("name"),
    supabase.from("product_variants").select("id,product_id,variant_name,pack_size,brand,is_orderable").eq("is_orderable", true).order("variant_name"),
    supabase.from("products").select("id,name").eq("is_active", true).order("name"),
    supabase.from("inventory").select("id,product_variant_id,service_area_id,available_stock,reserved_stock,safety_stock,updated_at").order("updated_at", { ascending: false }),
    supabase.from("inventory_receipts").select("id,receipt_number,vendor_id,service_area_id,received_at,vendor_reference,total_units,total_cost_paise,notes").order("received_at", { ascending: false }).limit(12),
    supabase.from("inventory_stock_adjustments").select("id,adjustment_number,inventory_id,adjustment_type,quantity_delta,reason,evidence_reference,created_at").order("created_at", { ascending: false }).limit(12),
    supabase.from("inventory_movements").select("id,inventory_id,change_amount,movement_type,reference_id,notes,created_at").order("created_at", { ascending: false }).limit(20),
    supabase.rpc("audit_inventory_stock"),
  ]);
  if (areaResult.error || vendorResult.error || variantResult.error || productResult.error || inventoryResult.error || receiptResult.error || adjustmentResult.error || movementResult.error) {
    throw new Error("Unable to load physical inventory. Refresh the page or check the database connection.");
  }

  const areas = (areaResult.data ?? []) as Array<{ id: string; name: string; city: string }>;
  const vendors = (vendorResult.data ?? []) as Array<{ id: string; name: string; is_approved: boolean }>;
  const variants = (variantResult.data ?? []) as VariantRow[];
  const products = (productResult.data ?? []) as ProductRow[];
  const inventory = (inventoryResult.data ?? []) as InventoryRow[];
  const receipts = (receiptResult.data ?? []) as ReceiptRow[];
  const adjustments = (adjustmentResult.data ?? []) as AdjustmentRow[];
  const movements = (movementResult.data ?? []) as MovementRow[];
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const areaMap = new Map(areas.map((a) => [a.id, a.name]));
  const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));
  const inventoryMap = new Map(inventory.map((i) => [i.id, i]));
  const labelForInventory = (row: InventoryRow) => {
    const variant = variantMap.get(row.product_variant_id);
    const product = variant ? productMap.get(variant.product_id) : null;
    return [product ?? "Unknown product", variant?.variant_name ?? row.product_variant_id, row.service_area_id ? areaMap.get(row.service_area_id) ?? "Unknown area" : "Unassigned area"].join(" · ");
  };
  const visibleInventory = inventory.filter((row) => !selectedArea || row.service_area_id === selectedArea);
  const totalUnits = visibleInventory.reduce((sum, row) => sum + row.available_stock, 0);
  const reservedUnits = visibleInventory.reduce((sum, row) => sum + row.reserved_stock, 0);
  const freeUnits = totalUnits - reservedUnits;
  const lowStock = visibleInventory.filter((row) => row.available_stock - row.reserved_stock <= row.safety_stock);
  const variantsForForm = variants.map((variant) => ({
    id: variant.id,
    label: `${productMap.get(variant.product_id) ?? "Product"} · ${variant.variant_name}${variant.brand ? ` · ${variant.brand}` : ""}`,
  }));
  const inventoryForForm = visibleInventory.map((row) => ({
    id: row.id, label: labelForInventory(row), available: row.available_stock, reserved: row.reserved_stock,
  }));
  const auditRows = auditResult.data ?? [];
  const auditError = auditResult.error;
  const areaParam = selectedArea ? `?area=${encodeURIComponent(selectedArea)}` : "";

  return (
    <main className="db-page py-(--section-y)">
      <Container className="max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-sm font-semibold text-highlight-ink">Dairybuy operations</p><h1 className="mt-2 text-3xl font-bold">Physical inventory</h1><p className="mt-2 text-sm text-muted-foreground">Vendor receiving · stock adjustments · immutable movement ledger · Owner/admin access only</p></div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold"><Link href="/admin/inventory/audit" className="text-highlight-ink underline">Inventory audit</Link><Link href="/admin/orders" className="text-highlight-ink underline">Orders</Link><Link href="/admin/finance/cod" className="text-highlight-ink underline">COD financials</Link><Link href="/account" className="text-highlight-ink underline">Account</Link></div>
        </div>

        {received ? <p role="status" className="mb-4 rounded-2xl border border-[#b8e2c8] bg-[#eaf7ef] p-4 text-sm font-semibold text-[#17643b]">Stock receipt recorded: {received}. Inventory and movement ledger have been updated.</p> : null}
        {adjusted ? <p role="status" className="mb-4 rounded-2xl border border-[#b8e2c8] bg-[#eaf7ef] p-4 text-sm font-semibold text-[#17643b]">Stock adjustment recorded: {adjusted}. Inventory and movement ledger have been updated.</p> : null}

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border-2 border-white bg-white p-4 shadow-sm"><p className="text-xs text-muted-foreground">Physical on-hand</p><p className="mt-1 text-2xl font-bold tabular-nums">{number(totalUnits)}</p><p className="text-xs text-muted-foreground">{visibleInventory.length} inventory rows</p></div>
          <div className="rounded-3xl border-2 border-white bg-white p-4 shadow-sm"><p className="text-xs text-muted-foreground">Reserved for orders</p><p className="mt-1 text-2xl font-bold tabular-nums">{number(reservedUnits)}</p><p className="text-xs text-muted-foreground">Included within physical stock</p></div>
          <div className="rounded-3xl border-2 border-white bg-white p-4 shadow-sm"><p className="text-xs text-muted-foreground">Free to allocate</p><p className="mt-1 text-2xl font-bold tabular-nums">{number(freeUnits)}</p><p className="text-xs text-muted-foreground">On-hand less reserved</p></div>
          <div className="rounded-3xl border-2 border-white bg-white p-4 shadow-sm"><p className="text-xs text-muted-foreground">At / below safety stock</p><p className="mt-1 text-2xl font-bold tabular-nums">{number(lowStock.length)}</p><p className="text-xs text-muted-foreground">Rows needing replenishment review</p></div>
        </section>

        <form method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-3xl border-2 border-white bg-white p-4 shadow-sm">
          <label className="grid min-w-52 gap-1 text-xs font-semibold">Service area
            <select name="area" defaultValue={selectedArea} className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm"><option value="">All service areas</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name} · {area.city}</option>)}</select>
          </label>
          <button className="min-h-11 rounded-full bg-[#573b75] px-5 text-sm font-bold text-white">Apply</button>
          <Link href="/admin/inventory" className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold">Reset</Link>
          <span className="text-xs text-muted-foreground">Stock levels are scoped by SKU and delivery service area.</span>
        </form>

        <div className="mb-5 grid gap-4 xl:grid-cols-2">
          <section className="rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
            <div className="mb-4"><h2 className="text-xl font-bold">Receive stock from vendor</h2><p className="mt-1 text-sm text-muted-foreground">Record an approved supplier delivery, invoice reference and purchase cost for each SKU.</p></div>
            <InventoryReceiptForm vendors={vendors.map((v) => ({ id: v.id, label: v.name }))} areas={areas.map((a) => ({ id: a.id, label: a.name }))} variants={variantsForForm} idempotencyKey={randomUUID()} />
          </section>
          <section className="rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
            <div className="mb-4"><h2 className="text-xl font-bold">Adjust physical stock</h2><p className="mt-1 text-sm text-muted-foreground">Record spoilage, damage or a verified stocktake difference with a mandatory reason.</p></div>
            <InventoryAdjustmentForm inventory={inventoryForForm} idempotencyKey={randomUUID()} />
          </section>
        </div>

        <section className="mb-5 overflow-hidden rounded-3xl border-2 border-white bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4"><div><h2 className="text-xl font-bold">Stock by SKU</h2><p className="mt-1 text-xs text-muted-foreground">Physical on-hand includes reserved units; free stock is the amount remaining after reservations.</p></div><span className="text-xs text-muted-foreground">{visibleInventory.length} rows</span></div>
          {visibleInventory.length ? <div className="divide-y divide-border">{visibleInventory.map((row) => {
            const variant = variantMap.get(row.product_variant_id);
            const free = row.available_stock - row.reserved_stock;
            const low = free <= row.safety_stock;
            return <article key={row.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,0.8fr))] sm:items-center">
              <div className="min-w-0"><p className="font-bold">{productMap.get(variant?.product_id ?? "") ?? "Unknown product"}</p><p className="text-xs text-muted-foreground">{variant?.variant_name ?? row.product_variant_id} · {variant?.brand ?? "—"}</p><p className="mt-1 text-xs text-muted-foreground">{row.service_area_id ? areaMap.get(row.service_area_id) ?? "Unknown area" : "Unassigned area"}</p></div>
              <div><p className="text-[11px] text-muted-foreground">On hand</p><p className="font-bold tabular-nums">{number(row.available_stock)}</p></div>
              <div><p className="text-[11px] text-muted-foreground">Reserved</p><p className="font-bold tabular-nums">{number(row.reserved_stock)}</p></div>
              <div><p className="text-[11px] text-muted-foreground">Free</p><p className="font-bold tabular-nums">{number(free)}</p></div>
              <div><span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${low ? "bg-[#fff8e7] text-[#805b18]" : "bg-[#eaf7ef] text-[#17643b]"}`}>{low ? "Reorder review" : "Healthy"}</span><p className="mt-1 text-[11px] text-muted-foreground">Safety: {number(row.safety_stock)}</p></div>
            </article>;
          })}</div> : <p className="p-6 text-sm text-muted-foreground">No inventory rows exist for this service area yet. Record a receipt to create stock rows.</p>}
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="overflow-hidden rounded-3xl border-2 border-white bg-white shadow-sm">
            <div className="border-b border-border px-5 py-4"><h2 className="font-bold">Recent vendor receipts</h2><p className="mt-1 text-xs text-muted-foreground">Purchase costs are stored in paise and remain linked to each receipt line.</p></div>
            {receipts.length ? <ul className="divide-y divide-border">{receipts.map((receipt) => <li key={receipt.id} className="px-5 py-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">{receipt.receipt_number}</p><p className="font-bold tabular-nums">{money(receipt.total_cost_paise)}</p></div><p className="mt-1 text-sm">{vendorMap.get(receipt.vendor_id) ?? receipt.vendor_id} · {areaMap.get(receipt.service_area_id) ?? "Area unavailable"}</p><p className="mt-1 text-xs text-muted-foreground">{number(receipt.total_units)} units · {stamp(receipt.received_at)}{receipt.vendor_reference ? ` · Ref ${receipt.vendor_reference}` : ""}</p></li>)}</ul> : <p className="p-5 text-sm text-muted-foreground">No stock receipts recorded yet.</p>}
          </section>
          <section className="overflow-hidden rounded-3xl border-2 border-white bg-white shadow-sm">
            <div className="border-b border-border px-5 py-4"><h2 className="font-bold">Recent adjustments</h2><p className="mt-1 text-xs text-muted-foreground">Every adjustment records the actor, reason and immutable movement.</p></div>
            {adjustments.length ? <ul className="divide-y divide-border">{adjustments.map((adjustment) => <li key={adjustment.id} className="px-5 py-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">{adjustment.adjustment_number}</p><p className={`font-bold tabular-nums ${adjustment.quantity_delta < 0 ? "text-[#9f3028]" : "text-[#17643b]"}`}>{adjustment.quantity_delta > 0 ? "+" : ""}{number(adjustment.quantity_delta)} units</p></div><p className="mt-1 text-sm capitalize">{adjustment.adjustment_type.replaceAll("_", " ")} · {labelForInventory(inventoryMap.get(adjustment.inventory_id) ?? { id: "", product_variant_id: "", service_area_id: null, available_stock: 0, reserved_stock: 0, safety_stock: 0, updated_at: "" })}</p><p className="mt-1 text-xs text-muted-foreground">{adjustment.reason} · {stamp(adjustment.created_at)}</p></li>)}</ul> : <p className="p-5 text-sm text-muted-foreground">No stock adjustments recorded yet.</p>}
          </section>
        </div>

        <section className="mt-5 overflow-hidden rounded-3xl border-2 border-white bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4"><h2 className="font-bold">Immutable movement history</h2><p className="mt-1 text-xs text-muted-foreground">Latest 20 movements across all areas; the database blocks edits and deletes.</p></div>
          {movements.length ? <div className="divide-y divide-border">{movements.map((movement) => {
            const row = inventoryMap.get(movement.inventory_id);
            return <div key={movement.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[1.2fr_0.8fr_0.8fr_1fr] sm:items-center"><p className="text-sm font-semibold">{row ? labelForInventory(row) : "Inventory row unavailable"}</p><p className="text-xs capitalize text-muted-foreground">{movement.movement_type.replaceAll("_", " ")}</p><p className={`text-sm font-bold tabular-nums ${movement.change_amount < 0 ? "text-[#9f3028]" : "text-[#17643b]"}`}>{movement.change_amount > 0 ? "+" : ""}{number(movement.change_amount)} units</p><p className="text-xs text-muted-foreground">{stamp(movement.created_at)}{movement.reference_id ? ` · ${movement.reference_id.slice(0, 8)}` : ""}</p></div>;
          })}</div> : <p className="p-5 text-sm text-muted-foreground">No physical stock movements have been recorded yet.</p>}
        </section>

        <section className="mt-5 rounded-3xl border-2 border-white bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Physical stock ledger reconciliation</h2><p className="mt-1 text-sm text-muted-foreground">Compares recorded on-hand and reserved counters against immutable movement history.</p></div><Link href="/admin/inventory/audit" className="text-sm font-semibold text-highlight-ink underline">Open detailed audit</Link></div>
          {auditError ? <p role="alert" className="mt-3 rounded-xl bg-[#fff8e7] p-3 text-sm text-[#805b18]">Stock reconciliation could not be loaded. The read-only audit page remains available.</p> : <p role="status" className="mt-3 text-sm font-semibold">{auditRows.length === 0 ? "No physical stock or reservation ledger discrepancies found." : `${auditRows.length} discrepancy finding(s) need review.`}</p>}
        </section>
      </Container>
    </main>
  );
}
