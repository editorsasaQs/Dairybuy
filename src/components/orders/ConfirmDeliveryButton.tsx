"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConfirmDeliveryButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelivery() {
    if (!window.confirm("Have you received this Dairybuy order? Confirm delivery only after receiving it.")) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/confirm-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Delivery confirmation failed. Please refresh and retry.");
        return;
      }
      router.refresh();
    } catch {
      setError("Delivery confirmation failed due to a network issue. Please retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={confirmDelivery}
        disabled={pending}
        className="min-h-11 rounded-full bg-[#573b75] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Confirming…" : "I have received my order"}
      </button>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <p className="text-xs text-muted-foreground">Confirm only after the complete order has reached you. This does not record COD cash collection.</p>
    </div>
  );
}
