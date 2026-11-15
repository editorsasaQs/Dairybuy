import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/brand/Container";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CancelOrderButton } from "@/components/orders/CancelOrderButton";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total_paise: number;
  delivery_date: string | null;
  delivery_slot_id: string;
  created_at: string;
};

type SlotRow = {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  cancellation_deadline_time: string;
};

function formatInr(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}

function canCancel(order: OrderRow, slot: SlotRow | undefined) {
  return Boolean(slot && order.delivery_date && order.payment_method === "cod"
    && order.payment_status === "pending"
    && ["pending_confirmation", "confirmed", "processing"].includes(order.status));
}

export default async function CustomerOrderHistoryPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/account/orders");

  const { data: orderData, error } = await supabase.from("orders")
    .select("id,order_number,status,payment_status,payment_method,total_paise,delivery_date,delivery_slot_id,created_at")
    .eq("customer_id", user.id)
    .eq("order_type", "one_time")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (error) throw new Error("Unable to load your order history.");

  const orders = (orderData ?? []) as OrderRow[];
  const slotIds = [...new Set(orders.map((order) => order.delivery_slot_id))];
  const { data: slotData, error: slotError } = slotIds.length
    ? await supabase.from("delivery_slots").select("id,label,start_time,end_time,cancellation_deadline_time").in("id", slotIds)
    : { data: [], error: null };
  if (slotError) throw new Error("Unable to load delivery slot details.");

  const slots = new Map(((slotData ?? []) as SlotRow[]).map((slot) => [slot.id, slot]));

  return (
    <main className="db-page py-(--section-y)">
      <Container className="max-w-4xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-highlight-ink">Your Dairybuy account</p>
            <h1 className="mt-2 text-3xl font-bold">My orders</h1>
            <p className="mt-2 text-sm text-muted-foreground">Your recent one-time orders and delivery updates.</p>
          </div>
          <Link href="/account" className="text-sm font-semibold text-highlight-ink underline">Back to account</Link>
        </div>

        {orders.length === 0 ? (
          <section className="rounded-3xl border-2 border-white bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold">No orders yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your placed orders will appear here.</p>
            <Link href="/products" className="mt-5 inline-flex rounded-full bg-[#573b75] px-5 py-3 text-sm font-bold text-white">Browse products</Link>
          </section>
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => {
              const slot = slots.get(order.delivery_slot_id);
              return (
                <li key={order.id} className="rounded-3xl border-2 border-white bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Order number</p>
                      <p className="mt-1 text-lg font-bold">{order.order_number}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Placed {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(order.created_at))}</p>
                    </div>
                    <span className="rounded-full bg-[#e7f6fc] px-3 py-1.5 text-xs font-bold capitalize">{order.status.replaceAll("_", " ")}</span>
                  </div>
                  <div className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
                    <div><p className="text-xs text-muted-foreground">Delivery date</p><p className="mt-1 font-semibold">{order.delivery_date ?? "To be confirmed"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Delivery slot</p><p className="mt-1 font-semibold">{slot ? `${slot.label} · ${slot.start_time.slice(0,5)}–${slot.end_time.slice(0,5)}` : "Slot details unavailable"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Total · Cash on delivery</p><p className="mt-1 font-semibold tabular-nums">{formatInr(order.total_paise)}</p></div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <Link href={`/orders/${encodeURIComponent(order.id)}`} className="text-sm font-bold text-highlight-ink underline">View order details</Link>
                    {canCancel(order, slot) ? <CancelOrderButton orderId={order.id} /> : null}
                  </div>
                  {order.payment_status === "pending" ? <p className="mt-3 text-xs text-muted-foreground">Payment is pending. Pay cash to the delivery agent only if the order is delivered.</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </main>
  );
}
