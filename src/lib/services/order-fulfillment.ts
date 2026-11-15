import type { Enums } from "@/lib/supabase/types";

export type FulfillableOrderStatus = Extract<
  Enums<"order_status_enum">,
  "pending_confirmation" | "confirmed" | "processing" | "out_for_delivery" | "delivered"
>;

const NEXT_STATUS: Partial<Record<FulfillableOrderStatus, FulfillableOrderStatus>> = {
  pending_confirmation: "confirmed",
  confirmed: "processing",
  processing: "out_for_delivery",
  out_for_delivery: "delivered",
};

export function getNextOrderStatus(status: string): FulfillableOrderStatus | null {
  if (!Object.prototype.hasOwnProperty.call(NEXT_STATUS, status)) return null;
  return NEXT_STATUS[status as FulfillableOrderStatus] ?? null;
}

export function isFulfillableStatus(status: string): status is FulfillableOrderStatus {
  return status === "pending_confirmation" ||
    status === "confirmed" ||
    status === "processing" ||
    status === "out_for_delivery" ||
    status === "delivered";
}
