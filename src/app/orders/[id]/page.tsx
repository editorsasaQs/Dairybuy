import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/brand/Container";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CancelOrderButton } from "@/components/orders/CancelOrderButton";
import { parseOrderDeliveryAddressSnapshot } from "@/lib/services/order-address-snapshot";
import { ConfirmDeliveryButton } from "@/components/orders/ConfirmDeliveryButton";

export const dynamic = "force-dynamic";

function formatInr(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}

export default async function OrderConfirmationPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect(`/login?next=${encodeURIComponent(`/orders/${id}`)}`);

  const { data: order, error } = await supabase.from("orders")
    .select("id,order_number,status,payment_status,payment_method,subtotal_paise,delivery_fee_paise,total_paise,delivery_date,delivery_slot_id,delivery_address_snapshot,delivery_address_snapshot_source,delivery_address_snapshot_at,delivery_notes,created_at")
    .eq("id", id)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (error || !order) notFound();

  const [itemsResult, slotResult, historyResult] = await Promise.all([
    supabase.from("order_items").select("id,product_name_snapshot,variant_name_snapshot,brand_snapshot,pack_size_snapshot,vendor_name_snapshot,quantity,quantity_litres,unit_price_paise,total_price_paise").eq("order_id", order.id).order("id"),
    supabase.from("delivery_slots").select("label,start_time,end_time,cancellation_deadline_time").eq("id", order.delivery_slot_id).maybeSingle(),
    supabase.from("order_status_history").select("from_status,to_status,note,created_at").eq("order_id", order.id).order("created_at", { ascending: true }),
  ]);
  const address = parseOrderDeliveryAddressSnapshot(order.delivery_address_snapshot);
  if (itemsResult.error || slotResult.error || historyResult.error || !address || !slotResult.data) notFound();
  const canCancel = order.payment_method === "cod" && order.payment_status === "pending"
    && ["pending_confirmation", "confirmed", "processing"].includes(order.status);

  return (
    <main className="db-page py-(--section-y)">
      <Container className="max-w-3xl">
        <section className="rounded-[2rem] border-2 border-white bg-[#e7f6fc] p-6 shadow-pop sm:p-9">
          <p className="text-sm font-bold text-highlight-ink">Dairybuy order confirmation</p>
          <h1 className="mt-2 text-3xl font-bold">Thanks, your order is placed!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {order.status === "delivered"
              ? "Your delivery is complete. Thank you for ordering with Dairybuy."
              : order.status === "out_for_delivery"
                ? "Your order is out for delivery. You can confirm once it has safely reached you."
                : "Your order has been received and is awaiting confirmation by the Dairybuy team."}
          </p>
          <div className="mt-6 rounded-2xl bg-white p-5">
            <p className="text-xs text-muted-foreground">Order number</p>
            <p className="mt-1 text-2xl font-bold">{order.order_number}</p>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><p className="text-muted-foreground">Order status</p><p className="font-semibold">{order.status.replaceAll("_", " ")}</p></div>
              <div><p className="text-muted-foreground">Payment</p><p className="font-semibold">Cash on delivery · {order.payment_status}</p></div>
              <div><p className="text-muted-foreground">Delivery date</p><p className="font-semibold">{order.delivery_date ?? "To be confirmed"}</p></div>
              <div><p className="text-muted-foreground">Delivery slot</p><p className="font-semibold">{slotResult.data.label} ({slotResult.data.start_time.slice(0, 5)}–{slotResult.data.end_time.slice(0, 5)})</p></div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-5">
            <h2 className="font-bold">Items ordered</h2>
            <ul className="mt-3 divide-y divide-border">
              {(itemsResult.data ?? []).map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{item.product_name_snapshot ?? "Dairybuy product"}</p>
                    <p className="text-xs text-muted-foreground">{[item.variant_name_snapshot, item.pack_size_snapshot, item.vendor_name_snapshot].filter(Boolean).join(" · ")} · Qty {item.quantity}{item.quantity_litres ? ` · ${item.quantity_litres} L` : ""}</p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{formatInr(item.total_price_paise)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatInr(order.subtotal_paise)}</dd></div>
              <div className="flex justify-between"><dt>Delivery fee</dt><dd>{formatInr(order.delivery_fee_paise)}</dd></div>
              <div className="flex justify-between text-base font-bold"><dt>Total to pay on delivery</dt><dd>{formatInr(order.total_paise)}</dd></div>
            </dl>
          </div>

          {order.status === "out_for_delivery" ? (
            <div className="mt-6 rounded-2xl border border-[#d8c9ec] bg-white p-5 text-sm">
              <h2 className="font-bold">Have you received your order?</h2>
              <p className="mt-2 text-muted-foreground">Once your order has arrived, confirm it here. The Dairybuy team can also complete delivery from the admin interface.</p>
              <div className="mt-4"><ConfirmDeliveryButton orderId={order.id} /></div>
            </div>
          ) : null}
          {order.status === "delivered" ? (
            <div className="mt-6 rounded-2xl bg-[#eaf8ef] p-5 text-sm">
              <h2 className="font-bold text-green-800">Order delivered</h2>
              <p className="mt-1 text-green-800">Delivery has been marked complete. COD payment status remains separate.</p>
            </div>
          ) : null}
          <div className="mt-6 rounded-2xl bg-white p-5 text-sm">
            <h2 className="font-bold">Order updates</h2>
            {historyResult.data?.length ? (
              <ol className="mt-3 space-y-3">
                {historyResult.data.map((event, index) => (
                  <li key={`${event.created_at}-${index}`} className="border-l-2 border-[#b9ddea] pl-3">
                    <p className="font-semibold capitalize">{event.to_status.replaceAll("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(event.created_at))}</p>
                    {event.note ? <p className="mt-1 text-xs text-muted-foreground">{event.note}</p> : null}
                  </li>
                ))}
              </ol>
            ) : <p className="mt-2 text-xs text-muted-foreground">No additional status updates yet.</p>}
          </div>
          <div className="mt-6 rounded-2xl bg-white p-5 text-sm">
            <h2 className="font-bold">Delivery address</h2>
            <p className="mt-2 font-semibold">{address.recipient_name} · {address.phone}</p>
            <p>{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}{address.landmark ? `, ${address.landmark}` : ""}</p>
            <p className="text-muted-foreground">{address.city}, {address.state} – {address.pincode}</p>
            <p className="mt-2 text-xs text-muted-foreground">{order.delivery_address_snapshot_source === "legacy_reconstructed"
              ? "Address reconstructed from the currently linked saved address during migration; the original checkout-time address was not retained."
              : "Address captured and preserved when this order was placed."}</p>
            {order.delivery_notes ? <p className="mt-2 text-muted-foreground">Note: {order.delivery_notes}</p> : null}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Payment is pending. Please pay the delivery agent in cash when the order is delivered. Do not pay online for this order.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            {canCancel ? <CancelOrderButton orderId={order.id} /> : null}
            <Link href="/account/orders" className="rounded-full border border-[#573b75] px-5 py-3 text-sm font-bold text-[#573b75]">My orders</Link>
            <Link href="/products" className="rounded-full bg-[#573b75] px-5 py-3 text-sm font-bold text-white">Continue shopping</Link>
            <Link href="/account" className="rounded-full border border-[#573b75] px-5 py-3 text-sm font-bold text-[#573b75]">My account</Link>
          </div>
        </section>
      </Container>
    </main>
  );
}
