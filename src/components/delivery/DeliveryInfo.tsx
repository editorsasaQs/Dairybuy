"use client";

import { useEffect, useState } from "react";
import { Clock, Truck } from "lucide-react";
import { deliveryFeeLabel } from "@/lib/business";

type DeliverySlot = {
  id: string;
  slotCode: string;
  label: string;
  startTime: string;
  endTime: string;
  orderCutoffTime: string;
  cancellationDeadlineTime: string;
};

type DeliveryInfoProps = {
  tone?: "default" | "inverse";
  showFee?: boolean;
  className?: string;
};

function formatTime(value: string): string {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return minuteText === "00"
    ? `${displayHour} ${suffix}`
    : `${displayHour}:${minuteText} ${suffix}`;
}

export function DeliveryInfo({
  tone = "default",
  showFee = true,
  className = "",
}: DeliveryInfoProps) {
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const inverse = tone === "inverse";
  const text = inverse ? "text-cream" : "text-foreground";
  const muted = inverse ? "text-cream/75" : "text-muted-foreground";
  const box = inverse
    ? "border-cream/20 bg-cream/5"
    : "border-border bg-muted";

  useEffect(() => {
    let cancelled = false;

    async function loadSlots() {
      try {
        const response = await fetch("/api/delivery-slots", { cache: "no-store" });
        if (!response.ok) throw new Error("Delivery configuration unavailable");
        const payload = await response.json() as {
          success: boolean;
          data?: { slots?: DeliverySlot[] };
        };
        if (!payload.success || !payload.data) {
          throw new Error("Delivery configuration unavailable");
        }
        if (!cancelled) {
          setSlots(payload.data.slots ?? []);
          setUnavailable(false);
        }
      } catch {
        if (!cancelled) setUnavailable(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSlots();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={`rounded-control border p-3.5 text-xs leading-relaxed ${box} ${className}`}>
      {showFee ? (
        <p className={`mb-2 flex items-center gap-1.5 font-semibold ${text}`}>
          <Truck className="h-4 w-4 shrink-0" aria-hidden="true" />
          Delivery fee: {deliveryFeeLabel()}
        </p>
      ) : null}
      <p className={`flex items-center gap-1.5 font-semibold ${text}`}>
        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
        Delivery windows
      </p>
      {loading ? (
        <p className={`mt-1 ${muted}`} role="status">Loading delivery timings…</p>
      ) : unavailable ? (
        <p className={`mt-1 ${muted}`} role="status">Delivery timings are temporarily unavailable. Please try again shortly.</p>
      ) : slots.length === 0 ? (
        <p className={`mt-1 ${muted}`} role="status">No delivery slots are currently active.</p>
      ) : (
        <ul className={`mt-1 space-y-2 pl-5.5 tabular-nums ${text}`}>
          {slots.map((slot) => (
            <li key={slot.id}>
              <span className="font-semibold">{slot.label}</span>
              <span className="block">{formatTime(slot.startTime)}–{formatTime(slot.endTime)}</span>
              <span className={muted}>Order by {formatTime(slot.orderCutoffTime)} · Cancel by {formatTime(slot.cancellationDeadlineTime)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className={`mt-2 ${muted}`}>Timings are managed by Dairybuy and shown in India Standard Time. Delivery slot selection and booking will activate with checkout.</p>
    </div>
  );
}
