"use client";

import { useState } from "react";

type CodCollection = {
  collection_id: string; order_id: string; amount_collected_paise: number;
  collection_status: string; collected_at?: string; receipt_reference?: string | null;
  verified_at?: string | null; rejected_at?: string | null; rejection_reason?: string | null;
};
type Delivery = {
  id: string; subscription_id: string; delivery_date: string; status: string;
  delivery_notes: string | null; assigned_staff_id: string | null; order_id: string | null;
  codCollection: CodCollection | null;
};
type Props = { deliveries: Delivery[] };

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(value + "T12:00:00+05:30"));
}
function money(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}
function rpcRow(value: unknown): Record<string, unknown> {
  return Array.isArray(value) ? (value[0] as Record<string, unknown> | undefined) ?? {} : (value as Record<string, unknown> | null) ?? {};
}

export function SubscriptionOperations({ deliveries }: Props) {
  const [rows, setRows] = useState(deliveries);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [failureReason, setFailureReason] = useState<Record<string, string>>({});

  async function act(deliveryId: string, action: string, extra: Record<string, string> = {}) {
    setBusy(deliveryId); setMessage("");
    try {
      const response = await fetch("/api/admin/subscriptions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId, action, ...extra }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Operation failed.");
      const result = rpcRow(payload.data);
      const collectionStatus = typeof result["collection_status"] === "string" ? result["collection_status"] : null;
      const amount = typeof result["amount_collected_paise"] === "number" ? result["amount_collected_paise"] : Number(extra["amountRupees"] || 0) * 100;
      setRows((current) => current.map((row) => row.id === deliveryId ? {
        ...row,
        status: action === "start" ? "out_for_delivery" : action === "complete" ? "delivered" : action === "fail" ? "failed" : row.status,
        codCollection: action === "record_cod"
          ? { collection_id: String(result["collection_id"] || ""), order_id: row.order_id || "", amount_collected_paise: amount, collection_status: collectionStatus || "collected" }
          : ["verify_cod", "reject_cod", "resolve_cod"].includes(action)
            ? row.codCollection ? { ...row.codCollection, amount_collected_paise: amount || row.codCollection.amount_collected_paise, collection_status: collectionStatus || (action === "verify_cod" ? "verified" : action === "reject_cod" ? "rejected" : "disputed") } : row.codCollection
            : row.codCollection,
      } : row));
      setMessage(action === "complete" ? "Delivery marked delivered." : action === "record_cod" ? "Cash collection recorded. Payment remains pending until owner/admin verification." : "Delivery operation saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Operation failed."); }
    finally { setBusy(null); }
  }

  function recordCash(delivery: Delivery) {
    const amount = window.prompt("Enter the cash actually received for this delivery (₹):");
    if (amount !== null && amount.trim()) void act(delivery.id, "record_cod", { amountRupees: amount.trim() });
  }
  function resolveCash(delivery: Delivery) {
    const amount = window.prompt("Enter the corrected cash amount (₹):", delivery.codCollection ? String(delivery.codCollection.amount_collected_paise / 100) : "");
    if (amount === null || !amount.trim()) return;
    const reason = window.prompt("Explain the discrepancy and correction (minimum 5 characters):");
    if (reason !== null && reason.trim().length >= 5) void act(delivery.id, "resolve_cod", { amountRupees: amount.trim(), reason: reason.trim() });
  }

  return <section className="space-y-4">
    {message ? <p role="status" aria-live="polite" className="rounded-xl border border-border bg-white p-3 text-sm">{message}</p> : null}
    {rows.length === 0 ? <div className="rounded-3xl bg-white p-8 text-center"><h2 className="font-bold">No subscription deliveries</h2><p className="mt-2 text-sm text-muted-foreground">Generated deliveries will appear here for owner/admin operations.</p></div> :
      rows.map((delivery) => {
        const collection = delivery.codCollection;
        return <article key={delivery.id} className="rounded-2xl border-2 border-white bg-white p-5 shadow-sm">
          <div className="flex flex-wrap justify-between gap-3">
            <div><p className="text-xs text-muted-foreground">Delivery date</p><h2 className="mt-1 font-bold">{dateLabel(delivery.delivery_date)}</h2><p className="mt-1 text-xs text-muted-foreground">Subscription {delivery.subscription_id.slice(0,8)}… · Order {delivery.order_id?.slice(0,8) || "not generated"}</p></div>
            <span className="h-fit rounded-full bg-[#e7f6fc] px-3 py-1.5 text-xs font-bold capitalize">{delivery.status.replaceAll("_", " ")}</span>
          </div>
          {delivery.delivery_notes ? <p className="mt-2 text-sm text-muted-foreground">{delivery.delivery_notes}</p> : null}
          {delivery.status === "delivered" ? <div className="mt-4 rounded-xl bg-[#f6fbfd] p-3 text-sm">
            {collection ? <>
              <p className="font-semibold">Cash {collection.collection_status.replaceAll("_", " ")} · {money(collection.amount_collected_paise)}</p>
              {collection.collection_status === "collected" ? <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={!!busy} onClick={() => void act(delivery.id, "verify_cod")} className="rounded-full bg-[#216e49] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Verify cash</button>
                <button disabled={!!busy} onClick={() => { const reason = window.prompt("Reason for rejecting this cash collection (minimum 5 characters):"); if (reason !== null && reason.trim().length >= 5) void act(delivery.id, "reject_cod", { reason: reason.trim() }); }} className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject collection</button>
              </div> : null}
              {collection.collection_status === "disputed" || collection.collection_status === "rejected" ? <button disabled={!!busy} onClick={() => resolveCash(delivery)} className="mt-3 rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50">Resolve cash discrepancy</button> : null}
              {collection.collection_status === "verified" ? <p className="mt-1 text-xs font-semibold text-[#216e49]">Payment verified and settled</p> : null}
            </> : <><p className="font-semibold">Cash not yet recorded</p><p className="mt-1 text-xs text-muted-foreground">Record the amount actually received, then verify it against the delivery total.</p><button disabled={!!busy} onClick={() => recordCash(delivery)} className="mt-3 rounded-full bg-[#216e49] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Record COD cash</button></>}
          </div> : null}
          <div className="mt-4 flex flex-wrap items-end gap-2">
            {["scheduled", "assigned"].includes(delivery.status) ? <button disabled={!!busy} onClick={() => void act(delivery.id, "start")} className="rounded-full bg-[#573b75] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Mark out for delivery</button> : null}
            {["scheduled", "assigned", "out_for_delivery"].includes(delivery.status) ? <button disabled={!!busy} onClick={() => void act(delivery.id, "complete")} className="rounded-full bg-[#216e49] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Mark delivered</button> : null}
            {["scheduled", "assigned", "out_for_delivery"].includes(delivery.status) ? <><label className="grid gap-1 text-xs font-semibold">Failure reason<input value={failureReason[delivery.id] || ""} onChange={(event) => setFailureReason((current) => ({ ...current, [delivery.id]: event.target.value }))} maxLength={500} className="min-h-10 rounded-xl border border-border px-3 text-sm" /></label><button disabled={!!busy || !failureReason[delivery.id]?.trim()} onClick={() => { if (window.confirm("Mark this delivery failed and release its reserved stock?")) void act(delivery.id, "fail", { reason: failureReason[delivery.id] ?? "" }); }} className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Mark failed</button></> : null}
          </div>
        </article>;
      })
    }
  </section>;
}
