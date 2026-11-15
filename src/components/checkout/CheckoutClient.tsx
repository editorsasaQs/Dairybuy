"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBag } from "@/components/bag/BagContext";

type Address = {
  id: string;
  address_type: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
};

type Slot = {
  id: string;
  slotCode: string;
  label: string;
  startTime: string;
  endTime: string;
};

type CheckoutPreview = {
  address: {
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string | null;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
    serviceAreaName: string;
  };
  delivery: { date: string; label: string; startTime: string; endTime: string; timezone: string };
  cart: { items?: Array<{ name?: string; quantity?: number; totalPriceInr?: number }>; subtotalPaise: number; totalPaise: number };
  deliveryFeePaise: number;
  totalPaise: number;
};

type OrderConfirmation = {
  orderId: string;
  orderNumber: string;
  totalPaise: number;
  paymentMethod: "cod";
  paymentStatus: "pending";
  status: "pending_confirmation";
  replayed: boolean;
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function inr(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}

function todayKolkata(): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

function tomorrowKolkata(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function CheckoutClient() {
  const router = useRouter();
  const { items, clearBag } = useBag();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [addressId, setAddressId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(tomorrowKolkata);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/addresses", { cache: "no-store" }),
      fetch("/api/delivery-slots", { cache: "no-store" }),
    ]).then(async ([addressResponse, slotResponse]) => {
      const [addressPayload, slotPayload] = await Promise.all([addressResponse.json(), slotResponse.json()]);
      if (!addressResponse.ok || !addressPayload.success) throw new Error(addressPayload.error || "Unable to load saved addresses.");
      if (!slotResponse.ok || !slotPayload.success) throw new Error(slotPayload.error || "Unable to load delivery slots.");
      return {
        addresses: (addressPayload.data?.addresses ?? []) as Address[],
        slots: (slotPayload.data?.slots ?? []) as Slot[],
      };
    }).then(({ addresses: nextAddresses, slots: nextSlots }) => {
      if (cancelled) return;
      setAddresses(nextAddresses);
      setSlots(nextSlots);
      setAddressId((current) => current || nextAddresses.find((address) => address.is_default)?.id || nextAddresses[0]?.id || "");
      setSlotId((current) => current || nextSlots[0]?.id || "");
      setLoading(false);
    }).catch((error: unknown) => {
      if (cancelled) return;
      setMessage(error instanceof Error ? error.message : "Unable to load checkout details.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function validateSelection(): Promise<CheckoutPreview> {
    const response = await fetch("/api/checkout/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ addressId, deliverySlotId: slotId, deliveryDate }),
    });
    const payload = record(await response.json());
    if (!response.ok || payload["success"] !== true) {
      const errors = record(payload["fieldErrors"]);
      setFieldErrors(Object.fromEntries(Object.entries(errors).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
      throw new Error(typeof payload["error"] === "string" ? payload["error"] : "Please review your address, delivery slot and cart.");
    }
    setFieldErrors({});
    const data = record(payload["data"]) as unknown as CheckoutPreview;
    setPreview(data);
    return data;
  }

  async function reviewOrder() {
    setMessage("");
    try {
      await validateSelection();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout validation failed.");
    }
  }

  async function placeOrder() {
    if (submitting) return;
    setSubmitting(true);
    setMessage("");
    try {
      // Preview is advisory only. The transactional RPC revalidates every
      // authoritative field again while creating the order.
      await validateSelection();
      const key = idempotencyKey || crypto.randomUUID();
      if (!idempotencyKey) setIdempotencyKey(key);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          addressId,
          deliverySlotId: slotId,
          deliveryDate,
          idempotencyKey: key,
          deliveryNotes: deliveryNotes.trim() || null,
        }),
      });
      const payload = record(await response.json());
      if (!response.ok || payload["success"] !== true) {
        const errors = record(payload["fieldErrors"]);
        setFieldErrors(Object.fromEntries(Object.entries(errors).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
        throw new Error(typeof payload["error"] === "string" ? payload["error"] : "Your order could not be placed. Please retry.");
      }
      const data = record(payload["data"]) as unknown as OrderConfirmation;
      if (!data.orderId || !data.orderNumber || typeof data.totalPaise !== "number") {
        throw new Error("Order confirmation could not be verified. Your order may have been placed; retry safely.");
      }
      clearBag();
      router.push(`/orders/${encodeURIComponent(data.orderId)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to place your order. Please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="rounded-2xl bg-white p-6 text-sm" role="status">Loading your checkout…</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="space-y-5">
        <div className="rounded-[1.75rem] border-2 border-white bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-bold">1. Delivery address</h2>
          {addresses.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-[#fff6d9] p-4 text-sm">
              <p>You need a saved delivery address before checkout.</p>
              <a className="mt-2 inline-block font-semibold underline" href="/account">Add an address in your account</a>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {addresses.map((address) => (
                <label key={address.id} className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${addressId === address.id ? "border-[#573b75] bg-[#f5efff]" : "border-border"}`}>
                  <input type="radio" name="checkout-address" value={address.id} checked={addressId === address.id} onChange={() => { setAddressId(address.id); setPreview(null); setFieldErrors({}); setIdempotencyKey(""); }} />
                  <span className="min-w-0 text-sm">
                    <span className="block font-bold">{address.address_type} · {address.recipient_name}{address.is_default ? " · Default" : ""}</span>
                    <span className="mt-1 block">{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}{address.landmark ? `, ${address.landmark}` : ""}</span>
                    <span className="text-muted-foreground">{address.city}, {address.state} – {address.pincode} · {address.phone}</span>
                  </span>
                </label>
              ))}
              <a href="/account" className="text-sm font-semibold underline">Manage delivery addresses</a>
            </div>
          )}
          {fieldErrors["addressId"] ? <p className="mt-2 text-sm text-red-700" role="alert">{fieldErrors["addressId"]}</p> : null}
        </div>

        <div className="rounded-[1.75rem] border-2 border-white bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-bold">2. Delivery date and slot</h2>
          <label className="mt-4 grid gap-2 text-sm font-semibold">Delivery date
            <input type="date" min={todayKolkata()} value={deliveryDate} onChange={(event) => { setDeliveryDate(event.target.value); setPreview(null); setFieldErrors({}); setIdempotencyKey(""); }} className="rounded-xl border border-border bg-background p-3" />
          </label>
          {fieldErrors["deliveryDate"] ? <p className="mt-2 text-sm text-red-700" role="alert">{fieldErrors["deliveryDate"]}</p> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {slots.map((slot) => (
              <label key={slot.id} className={`cursor-pointer rounded-2xl border p-4 ${slotId === slot.id ? "border-[#573b75] bg-[#f5efff]" : "border-border"}`}>
                <span className="flex items-center gap-2"><input type="radio" name="delivery-slot" value={slot.id} checked={slotId === slot.id} onChange={() => { setSlotId(slot.id); setPreview(null); setFieldErrors({}); setIdempotencyKey(""); }} /><span className="font-semibold">{slot.label}</span></span>
                <span className="mt-1 block pl-6 text-xs text-muted-foreground">{slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)}</span>
              </label>
            ))}
          </div>
          {fieldErrors["deliverySlotId"] ? <p className="mt-2 text-sm text-red-700" role="alert">{fieldErrors["deliverySlotId"]}</p> : null}
          <label className="mt-4 grid gap-2 text-sm font-semibold">Delivery notes <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea maxLength={500} rows={3} value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} placeholder="Any directions for finding your address?" className="rounded-xl border border-border bg-background p-3 font-normal" />
          </label>
        </div>
      </section>

      <aside className="h-fit rounded-[1.75rem] border-2 border-white bg-[#e7f6fc] p-5 shadow-sm sm:p-7 lg:sticky lg:top-24">
        <h2 className="text-xl font-bold">Order summary</h2>
        <p className="mt-1 text-sm text-muted-foreground">{items.length} different product lines in your bag</p>
        {preview ? (
          <>
            <div className="mt-5 rounded-2xl bg-white/80 p-4 text-sm">
              <p className="font-semibold">Delivering to</p>
              <p className="mt-1">{preview.address.recipientName} · {preview.address.phone}</p>
              <p>{preview.address.addressLine1}, {preview.address.city} – {preview.address.pincode}</p>
              <p className="mt-3 font-semibold">{preview.delivery.date} · {preview.delivery.label}</p>
              <p className="text-xs text-muted-foreground">{preview.delivery.timezone}</p>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt>Subtotal</dt><dd className="font-semibold tabular-nums">{inr(preview.cart.subtotalPaise)}</dd></div>
              <div className="flex justify-between gap-4"><dt>Delivery fee</dt><dd className="font-semibold tabular-nums">{inr(preview.deliveryFeePaise)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-[#c6dce5] pt-3 text-base"><dt className="font-bold">Total</dt><dd className="font-bold tabular-nums">{inr(preview.totalPaise)}</dd></div>
            </dl>
          </>
        ) : (
          <p className="mt-4 rounded-xl bg-white/80 p-4 text-sm text-muted-foreground">Review your delivery details to load the latest database prices and total.</p>
        )}
        {fieldErrors["cart"] ? <p className="mt-3 text-sm text-red-700" role="alert">{fieldErrors["cart"]}</p> : null}
        {message ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{message}</p> : null}
        <button type="button" disabled={!addressId || !slotId || !deliveryDate || submitting || addresses.length === 0 || slots.length === 0} onClick={() => void reviewOrder()} className="mt-5 w-full rounded-full border border-[#573b75] px-5 py-3 text-sm font-bold text-[#573b75] disabled:opacity-50">Review latest total</button>
        <button type="button" disabled={!preview || submitting || addresses.length === 0} onClick={() => void placeOrder()} className="mt-3 w-full rounded-full bg-[#573b75] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{submitting ? "Placing order…" : "Place COD order"}</button>
        <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">Pay cash to the delivery agent when your order arrives. Payment is marked pending until collection is recorded.</p>
      </aside>
    </div>
  );
}
