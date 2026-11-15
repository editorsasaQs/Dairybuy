"use client";

import { useCallback, useEffect, useState } from "react";

type Subscription = {
  id: string; subscription_number: string; plan_type: string; status: string;
  start_date: string; end_date: string | null; next_delivery_date: string | null;
  duration_days: number | null; subtotal_paise: number; discount_paise: number;
  total_paise: number; paused_at: string | null; delivery_slot_id: string;
};
type Item = { id: string; subscription_id: string; vendor_id: string | null; product_name_snapshot: string | null;
  variant_name_snapshot: string | null; vendor_name_snapshot: string | null; milk_type: string | null;
  quantity: number; quantity_litres: number | null; price_per_delivery_paise: number };
type Delivery = { id: string; subscription_id: string; delivery_date: string; status: string;
  delivery_notes: string | null; order_id: string | null; delivery_slot_id: string };
type Slot = { id: string; label: string; start_time: string; end_time: string };
type Vendor = { id: string; name: string; orderingEnabled: boolean; verifiedOptions: Array<{ type: string }> };
type Payload = { subscriptions: Subscription[]; items: Item[]; deliveries: Delivery[]; slots: Slot[] };

function money(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}
function dateLabel(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(value + "T12:00:00+05:30"));
}

export function SubscriptionDashboard() {
  const [data, setData] = useState<Payload>({ subscriptions: [], items: [], deliveries: [], slots: [] });
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorChoice, setVendorChoice] = useState<Record<string, string>>({});
  const [vendorDate, setVendorDate] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [response, vendorResponse] = await Promise.all([
        fetch("/api/subscriptions", { cache: "no-store" }),
        fetch("/api/vendors/milk", { cache: "no-store" }),
      ]);
      const [payload, vendorPayload] = await Promise.all([response.json(), vendorResponse.json()]);
      if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to load subscriptions.");
      setData(payload.data as Payload);
      if (vendorResponse.ok && vendorPayload.success) setVendors(vendorPayload.data.vendors as Vendor[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load subscriptions.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(subscriptionId: string, action: string, extra: Record<string, string> = {}) {
    const key = subscriptionId + ":" + action;
    setBusy(key); setMessage("");
    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId, action, ...extra }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Action could not be completed.");
      setMessage("Subscription updated successfully.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action could not be completed.");
    } finally { setBusy(null); }
  }

  if (loading) return <p className="rounded-3xl bg-white p-6 text-sm" role="status">Loading your subscriptions…</p>;

  return <section className="space-y-5">
    {message ? <p role="status" aria-live="polite" className="rounded-2xl border border-border bg-white p-4 text-sm">{message}</p> : null}
    {data.subscriptions.length === 0 ? <div className="rounded-3xl border-2 border-white bg-white p-8 text-center shadow-sm">
      <h2 className="text-xl font-bold">No subscriptions yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">Your prepaid daily milk plans will appear here once online subscription checkout is available.</p>
      <p className="mt-4 text-xs text-muted-foreground">Subscription payments are not yet enabled. No payment will be collected from this page.</p>
    </div> : data.subscriptions.map((sub) => {
      const items = data.items.filter((item) => item.subscription_id === sub.id);
      const deliveries = data.deliveries.filter((item) => item.subscription_id === sub.id);
      const slot = data.slots.find((item) => item.id === sub.delivery_slot_id);
      const canManage = ["active", "paused"].includes(sub.status);
      const canSkip = sub.status === "active" && sub.next_delivery_date;
      return <article key={sub.id} className="rounded-3xl border-2 border-white bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-semibold text-highlight-ink">Subscription</p><h2 className="mt-1 text-xl font-bold">{sub.subscription_number}</h2><p className="mt-1 text-xs text-muted-foreground">{sub.plan_type === "30_day" ? "30-day plan" : "7-day plan"} · {sub.duration_days ?? (sub.plan_type === "30_day" ? 30 : 7)} delivery days</p></div>
          <span className="rounded-full bg-[#e7f6fc] px-3 py-1.5 text-xs font-bold capitalize">{sub.status.replaceAll("_", " ")}</span>
        </div>
        <div className="mt-5 grid gap-3 border-y border-border py-4 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Plan total</p><p className="mt-1 font-bold">{money(sub.total_paise)}</p></div>
          <div><p className="text-xs text-muted-foreground">Next delivery</p><p className="mt-1 font-semibold">{dateLabel(sub.next_delivery_date)}</p></div>
          <div><p className="text-xs text-muted-foreground">Delivery slot</p><p className="mt-1 font-semibold">{slot ? slot.label + " · " + slot.start_time.slice(0,5) + "–" + slot.end_time.slice(0,5) : "As selected"}</p></div>
        </div>
        <h3 className="mt-4 text-sm font-bold">Your milk basket</h3>
        <ul className="mt-2 space-y-2">{items.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-[#f6fbfd] p-3 text-sm">
          <span>{item.product_name_snapshot || "Milk"} · {item.variant_name_snapshot || item.milk_type || "Milk"} <span className="text-muted-foreground">× {item.quantity} · {item.quantity_litres ?? "—"} L</span><span className="block text-xs text-muted-foreground">Vendor: {item.vendor_name_snapshot || "Selected vendor"}</span></span>
          <strong>{money(item.price_per_delivery_paise * item.quantity)}/day</strong>
          {sub.status === "active" && item.milk_type !== "canteen" ? <div className="w-full border-t border-border pt-3">
            <p className="text-xs font-semibold">Schedule a vendor change</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs">New vendor<select value={vendorChoice[item.id] || ""} onChange={(event) => setVendorChoice((current) => ({ ...current, [item.id]: event.target.value }))} className="min-h-10 rounded-lg border border-border bg-white px-2 text-sm"><option value="">Choose approved vendor</option>{vendors.filter((vendor) => vendor.orderingEnabled && vendor.id !== item.vendor_id && vendor.verifiedOptions.some((option) => option.type === item.milk_type)).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
              <label className="grid gap-1 text-xs">Effective from<input type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0,10)} value={vendorDate[item.id] || ""} onChange={(event) => setVendorDate((current) => ({ ...current, [item.id]: event.target.value }))} className="min-h-10 rounded-lg border border-border bg-white px-2 text-sm" /></label>
              <button disabled={!!busy || !vendorChoice[item.id] || !vendorDate[item.id]} onClick={() => void act(sub.id, "change_vendor", { itemId: item.id, vendorId: vendorChoice[item.id], effectiveFrom: vendorDate[item.id] })} className="rounded-full border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">Schedule change</button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">The new vendor must have the same approved milk type and identical current pricing. Existing deliveries stay unchanged.</p>
          </div> : null}
        </li>)}</ul>
        <div className="mt-5 flex flex-wrap gap-2">
          {canManage ? sub.status === "active" ? <button disabled={!!busy} onClick={() => void act(sub.id, "pause")} className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy === sub.id + ":pause" ? "Pausing…" : "Pause plan"}</button> : <button disabled={!!busy} onClick={() => void act(sub.id, "resume")} className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy === sub.id + ":resume" ? "Resuming…" : "Resume plan"}</button> : null}
          {canSkip ? <button disabled={!!busy} onClick={() => { const date = window.prompt("Enter a future delivery date (YYYY-MM-DD)", sub.next_delivery_date || ""); if (date) void act(sub.id, "skip", { skipDate: date }); }} className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">Skip a delivery</button> : null}
          {canManage ? <button disabled={!!busy} onClick={() => { if (window.confirm("Cancel this subscription? Future unassigned deliveries will stop. No automatic refund is created.")) void act(sub.id, "cancel", { reason: "Customer requested cancellation" }); }} className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Cancel plan</button> : null}
        </div>
        <h3 className="mt-5 text-sm font-bold">Delivery calendar</h3>
        {deliveries.length ? <ol className="mt-2 grid gap-2 sm:grid-cols-2">{deliveries.map((delivery) => <li key={delivery.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm"><span>{dateLabel(delivery.delivery_date)}</span><span className="rounded-full bg-[#f0f5f7] px-2.5 py-1 text-xs font-semibold capitalize">{delivery.status.replaceAll("_", " ")}</span></li>)}</ol> : <p className="mt-2 text-sm text-muted-foreground">Delivery entries will appear once your payment is verified and deliveries are generated.</p>}
      </article>;
    })}
  </section>;
}
