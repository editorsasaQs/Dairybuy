import { describe, expect, it } from "vitest";
import { mapDeliverySlotRows } from "./delivery-config-service";

const morning = {
  id: "morning-id",
  slot_code: "morning_slot",
  label: "Morning (8 AM - 11 AM)",
  start_time: "08:00:00",
  end_time: "11:00:00",
  order_cutoff_time: "07:00:00",
  cancellation_deadline_time: "07:30:00",
  is_active: true,
};

const evening = {
  id: "evening-id",
  slot_code: "evening_slot",
  label: "Evening (5 PM - 9 PM)",
  start_time: "17:00:00",
  end_time: "21:00:00",
  order_cutoff_time: "16:00:00",
  cancellation_deadline_time: "16:30:00",
  is_active: true,
};

describe("database delivery configuration mapping", () => {
  it("maps active slots with cutoff and cancellation deadlines", () => {
    expect(mapDeliverySlotRows([evening, morning])).toEqual([
      {
        id: "morning-id",
        slotCode: "morning_slot",
        label: "Morning (8 AM - 11 AM)",
        startTime: "08:00:00",
        endTime: "11:00:00",
        orderCutoffTime: "07:00:00",
        cancellationDeadlineTime: "07:30:00",
      },
      {
        id: "evening-id",
        slotCode: "evening_slot",
        label: "Evening (5 PM - 9 PM)",
        startTime: "17:00:00",
        endTime: "21:00:00",
        orderCutoffTime: "16:00:00",
        cancellationDeadlineTime: "16:30:00",
      },
    ]);
  });

  it("does not return inactive slots", () => {
    expect(mapDeliverySlotRows([
      morning,
      { ...evening, is_active: false },
    ])).toHaveLength(1);
  });

  it("does not invent slots when the database has no active rows", () => {
    expect(mapDeliverySlotRows([])).toEqual([]);
  });
});
