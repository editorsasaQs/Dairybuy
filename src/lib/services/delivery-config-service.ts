import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type DeliverySlotRow = Database["public"]["Tables"]["delivery_slots"]["Row"];
type Client = SupabaseClient<Database>;

export type DeliverySlotInfo = {
  id: string;
  slotCode: string;
  label: string;
  startTime: string;
  endTime: string;
  orderCutoffTime: string;
  cancellationDeadlineTime: string;
};

export function mapDeliverySlotRows(
  rows: readonly Pick<
    DeliverySlotRow,
    | "id"
    | "slot_code"
    | "label"
    | "start_time"
    | "end_time"
    | "order_cutoff_time"
    | "cancellation_deadline_time"
    | "is_active"
  >[],
): DeliverySlotInfo[] {
  return rows
    .filter((row) => row.is_active)
    .map((row) => ({
      id: row.id,
      slotCode: row.slot_code,
      label: row.label,
      startTime: row.start_time,
      endTime: row.end_time,
      orderCutoffTime: row.order_cutoff_time,
      cancellationDeadlineTime: row.cancellation_deadline_time,
    }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Customer-safe, read-only delivery configuration. */
export async function getDatabaseDeliverySlots(
  supabase: Client,
): Promise<DeliverySlotInfo[]> {
  const { data, error } = await supabase
    .from("delivery_slots")
    .select(
      "id,slot_code,label,start_time,end_time,order_cutoff_time,cancellation_deadline_time,is_active",
    )
    .eq("is_active", true)
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(`Unable to load delivery configuration: ${error.message}`);
  }

  return mapDeliverySlotRows(data ?? []);
}
