"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function cancelOrder() {
    if (busy || !window.confirm("Cancel this order? The reserved items will be released and this action cannot be undone.")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        cache: "no-store",
      });
      const payload: unknown = await response.json();
      const data = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
      if (!response.ok || data["success"] !== true) {
        throw new Error(typeof data["error"] === "string" ? data["error"] : "Unable to cancel this order.");
      }
      setMessage("Order cancelled successfully.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to cancel this order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={cancelOrder} disabled={busy}
        className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
        {busy ? "Cancelling…" : "Cancel order"}
      </button>
      {message ? <p className="mt-2 text-xs text-muted-foreground" role="status">{message}</p> : null}
    </div>
  );
}
