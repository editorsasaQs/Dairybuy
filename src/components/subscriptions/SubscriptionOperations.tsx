"use client";

import { useState } from "react";

type Delivery = {
  id: string; subscription_id: string; delivery_date: string; status: string;
  delivery_notes: string | null; assigned_staff_id: string | null; order_id: string | null;
};
type Staff = { id: string; label: string };
type SubscriptionOperationsProps = { deliveries: Delivery[]; staff: Staff[]; mode?: "admin" | "staff" };

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(value + "T12:00:00+05:30"));
}

export function SubscriptionOperations({ deliveries, staff, mode = "admin" }: SubscriptionOperationsProps) {
  const [rows, setRows] = useState(deliveries);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [staffChoice, setStaffChoice] = useState<Record<string, string>>({});
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
      setMessage("Delivery operation saved.");
      setRows((current) => current.map((row) => row.id === deliveryId ? {
        ...row,
        status: action === "assign" ? "assigned" : action === "start" ? "out_for_delivery" : action === "complete" ? "delivered" : "failed",
        assigned_staff_id: action === "assign" ? extra.staffId : row.assigned_staff_id,
        delivery_notes: action === "fail" ? extra.reason : row.delivery_notes,
      } : row));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Operation failed."); }
    finally { setBusy(null); }
  }

  return <section className="space-y-4">
    {message ? <p role="status" aria-live="polite" className="rounded-xl border border-border bg-white p-3 text-sm">{message}</p> : null}
    {rows.length === 0 ? <div className="rounded-3xl bg-white p-8 text-center"><h2 className="font-bold">No subscription deliveries</h2><p className="mt-2 text-sm text-muted-foreground">Generated deliveries will appear here after the trusted payment-verification process is enabled.</p></div> :
      rows.map((delivery) => <article key={delivery.id} className="rounded-2xl border-2 border-white bg-white p-5 shadow-sm">
        <div className="flex flex-wrap justify-between gap-3">
          <div><p className="text-xs text-muted-foreground">Delivery date</p><h2 className="mt-1 font-bold">{dateLabel(delivery.delivery_date)}</h2><p className="mt-1 text-xs text-muted-foreground">Subscription {delivery.subscription_id.slice(0,8)}… · Order {delivery.order_id?.slice(0,8) || "not generated"}</p></div>
          <span className="h-fit rounded-full bg-[#e7f6fc] px-3 py-1.5 text-xs font-bold capitalize">{delivery.status.replaceAll("_", " ")}</span>
        </div>
        {delivery.assigned_staff_id ? <p className="mt-3 text-xs text-muted-foreground">Assigned to {staff.find((person) => person.id === delivery.assigned_staff_id)?.label || delivery.assigned_staff_id}</p> : null}
        {delivery.delivery_notes ? <p className="mt-2 text-sm text-muted-foreground">{delivery.delivery_notes}</p> : null}
        <div className="mt-4 flex flex-wrap items-end gap-2">
          {mode === "admin" && delivery.status === "scheduled" ? <><label className="grid gap-1 text-xs font-semibold">Assign staff<select value={staffChoice[delivery.id] || ""} onChange={(event) => setStaffChoice((current) => ({ ...current, [delivery.id]: event.target.value }))} className="min-h-10 rounded-xl border border-border px-3 text-sm"><option value="">Choose staff</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}</select></label><button disabled={!!busy || !staffChoice[delivery.id]} onClick={() => void act(delivery.id, "assign", { staffId: staffChoice[delivery.id] })} className="rounded-full bg-[#573b75] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Assign</button></> : null}
          {delivery.status === "assigned" ? <button disabled={!!busy} onClick={() => void act(delivery.id, "start")} className="rounded-full bg-[#573b75] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Dispatch</button> : null}
          {delivery.status === "out_for_delivery" ? <><button disabled={!!busy} onClick={() => void act(delivery.id, "complete")} className="rounded-full bg-[#216e49] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Mark delivered</button>{mode === "admin" ? <><label className="grid gap-1 text-xs font-semibold">Failure reason<input value={failureReason[delivery.id] || ""} onChange={(event) => setFailureReason((current) => ({ ...current, [delivery.id]: event.target.value }))} maxLength={500} className="min-h-10 rounded-xl border border-border px-3 text-sm" /></label><button disabled={!!busy || !failureReason[delivery.id]?.trim()} onClick={() => { if (window.confirm("Mark this delivery failed and release its reserved stock?")) void act(delivery.id, "fail", { reason: failureReason[delivery.id] }); }} className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Mark failed</button></> : null}</> : null}
        </div>
      </article>)
    }
  </section>;
}
