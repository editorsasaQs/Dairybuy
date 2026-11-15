import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/brand/Container";
import { isAdminOrOwner } from "@/lib/services/auth-service";
import { ADMIN_ORDER_STATUSES, parseAdminOrderFilters } from "@/lib/services/admin-order-filters";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseOrderDeliveryAddressSnapshot } from "@/lib/services/order-address-snapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 25;

type SearchParams = Record<string, string | string[] | undefined>;
type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total_paise: number;
  delivery_date: string | null;
  delivery_slot_id: string;
  service_area_id: string;
  delivery_address_snapshot: unknown;
  created_at: string;
};
type SlotRow = { id: string; label: string; start_time: string; end_time: string };
type AreaRow = { id: string; name: string };

function formatInr(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}

function queryString(filters: SearchParams, page: number) {
  const params = new URLSearchParams();
  for (const key of ["date", "slot", "area", "status"] as const) {
    const value = filters[key];
    if (typeof value === "string" && value) params.set(key, value);
  }
  params.set("page", String(page));
  return params.toString();
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = parseAdminOrderFilters(params);
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/admin/orders");

  const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (roleError || !(roles ?? []).some((entry) => isAdminOrOwner(entry.role))) redirect("/account");

  const [filterSlotsResult, filterAreasResult] = await Promise.all([
    supabase.from("delivery_slots").select("id,label,start_time,end_time").eq("is_active", true).order("start_time"),
    supabase.from("service_areas").select("id,name").eq("is_active", true).order("name"),
  ]);
  if (filterSlotsResult.error || filterAreasResult.error) throw new Error("Unable to load order filters.");

  let orderQuery = supabase.from("orders")
    .select("id,order_number,status,payment_status,payment_method,total_paise,delivery_date,delivery_slot_id,service_area_id,delivery_address_snapshot,created_at", { count: "exact" })
    .eq("order_type", "one_time")
    .order("delivery_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1);

  if (filters.deliveryDate) orderQuery = orderQuery.eq("delivery_date", filters.deliveryDate);
  if (filters.deliverySlotId) orderQuery = orderQuery.eq("delivery_slot_id", filters.deliverySlotId);
  if (filters.serviceAreaId) orderQuery = orderQuery.eq("service_area_id", filters.serviceAreaId);
  if (filters.status) orderQuery = orderQuery.eq("status", filters.status);

  const { data: orderData, count, error } = await orderQuery;
  if (error) {
    console.error("[admin/orders] Queue query failed:", error.message);
    throw new Error("Unable to load the order queue.");
  }
  const orders = (orderData ?? []) as OrderRow[];
  const slotIds = [...new Set(orders.map((order) => order.delivery_slot_id))];
  const areaIds = [...new Set(orders.map((order) => order.service_area_id))];

  const [slotResult, areaResult] = await Promise.all([
    supabase.from("delivery_slots").select("id,label,start_time,end_time").in("id", slotIds),
    supabase.from("service_areas").select("id,name").in("id", areaIds),
  ]);
  if (slotResult.error || areaResult.error) throw new Error("Unable to load order delivery details.");

  const slots = new Map(((slotResult.data ?? []) as SlotRow[]).map((row) => [row.id, row]));
  const areas = new Map(((areaResult.data ?? []) as AreaRow[]).map((row) => [row.id, row]));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <main className="db-page py-(--section-y)">
      <Container className="max-w-6xl">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-highlight-ink">Dairybuy operations</p>
            <h1 className="mt-2 text-3xl font-bold">Order management</h1>
            <p className="mt-2 text-sm text-muted-foreground">One-time COD orders · Owner and admin access only</p>
          </div>
          <div className="flex gap-4"><Link href="/admin/inventory/audit" className="text-sm font-semibold text-highlight-ink underline">Inventory audit</Link><Link href="/admin/finance/cod" className="text-sm font-semibold text-highlight-ink underline">COD financials</Link><Link href="/account" className="text-sm font-semibold text-highlight-ink underline">Back to account</Link></div>
        </div>

        <form method="get" className="mb-6 grid gap-3 rounded-3xl border-2 border-white bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
          <label className="grid gap-1 text-xs font-semibold">Delivery date
            <input type="date" name="date" defaultValue={filters.deliveryDate ?? ""} className="min-h-11 rounded-xl border border-border px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-semibold">Delivery slot
            <select name="slot" defaultValue={filters.deliverySlotId ?? ""} className="min-h-11 rounded-xl border border-border px-3 text-sm">
              <option value="">All slots</option>
              {(filterSlotsResult.data ?? []).map((slot) => <option key={slot.id} value={slot.id}>{slot.label} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold">Service area
            <select name="area" defaultValue={filters.serviceAreaId ?? ""} className="min-h-11 rounded-xl border border-border px-3 text-sm">
              <option value="">All service areas</option>
              {(filterAreasResult.data ?? []).map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold">Order status
            <select name="status" defaultValue={filters.status ?? ""} className="min-h-11 rounded-xl border border-border px-3 text-sm">
              <option value="">All statuses</option>
              {ADMIN_ORDER_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="min-h-11 flex-1 rounded-full bg-[#573b75] px-4 text-sm font-bold text-white">Apply filters</button>
            <Link href="/admin/orders" className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold">Reset</Link>
          </div>
        </form>

        <div className="mb-3 flex items-center justify-between text-sm">
          <p className="font-semibold">{count ?? 0} orders found</p>
          <p className="text-muted-foreground">Page {filters.page} of {totalPages}</p>
        </div>

        {orders.length === 0 ? (
          <section className="rounded-3xl border-2 border-white bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold">No matching orders</h2>
            <p className="mt-2 text-sm text-muted-foreground">Try clearing one or more filters.</p>
          </section>
        ) : (
          <div className="overflow-hidden rounded-3xl border-2 border-white bg-white shadow-sm">
            <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-4 border-b border-border bg-[#f8fbfc] px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground lg:grid">
              <span>Order</span><span>Customer</span><span>Delivery</span><span>Status / payment</span><span>Total</span>
            </div>
            <ul className="divide-y divide-border">
              {orders.map((order) => {
                const address = parseOrderDeliveryAddressSnapshot(order.delivery_address_snapshot);
                const slot = slots.get(order.delivery_slot_id);
                const area = areas.get(order.service_area_id);
                return (
                  <li key={order.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-center lg:gap-4">
                    <div><p className="text-xs text-muted-foreground">Order</p><Link href={`/admin/orders/${order.id}`} className="font-bold text-highlight-ink underline">{order.order_number}</Link><p className="mt-1 text-xs text-muted-foreground">{order.delivery_date ?? "Date unavailable"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-semibold">{address?.recipient_name ?? "Address unavailable"}</p><p className="text-xs text-muted-foreground">{address?.phone ?? "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Delivery</p><p className="font-semibold">{slot?.label ?? "Slot unavailable"}</p><p className="text-xs text-muted-foreground">{area?.name ?? "Area unavailable"} · {address?.city ?? "—"} {address?.pincode ?? ""}</p></div>
                    <div><p className="text-xs text-muted-foreground">Status / payment</p><p className="font-semibold capitalize">{order.status.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">COD · {order.payment_status}</p></div>
                    <div className="text-left font-bold tabular-nums lg:text-right">{formatInr(order.total_paise)}</div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <nav aria-label="Order queue pagination" className="mt-6 flex items-center justify-between">
          {filters.page > 1 ? <Link href={`/admin/orders?${queryString(params, filters.page - 1)}`} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">Previous</Link> : <span />}
          {filters.page < totalPages ? <Link href={`/admin/orders?${queryString(params, filters.page + 1)}`} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">Next</Link> : <span />}
        </nav>
      </Container>
    </main>
  );
}
