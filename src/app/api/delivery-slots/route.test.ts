import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  isServerSupabaseConfigured: vi.fn(),
  getDatabaseDeliverySlots: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  isServerSupabaseConfigured: mocks.isServerSupabaseConfigured,
}));

vi.mock("@/lib/services/delivery-config-service", () => ({
  getDatabaseDeliverySlots: mocks.getDatabaseDeliverySlots,
}));

import { GET } from "./route";

const slots = [
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
];

describe("GET /api/delivery-slots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isServerSupabaseConfigured.mockReturnValue(true);
    mocks.createSupabaseServerClient.mockResolvedValue({});
    mocks.getDatabaseDeliverySlots.mockResolvedValue(slots);
  });

  it("returns DB-backed slot rules and the shared business timezone", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.data.timezone).toBe("Asia/Kolkata");
    expect(payload.data.slots).toEqual(slots);
    expect(mocks.getDatabaseDeliverySlots).toHaveBeenCalledOnce();
  });

  it("fails closed with 503 when Supabase is not configured", async () => {
    mocks.isServerSupabaseConfigured.mockReturnValue(false);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when the database cannot load delivery slots", async () => {
    mocks.getDatabaseDeliverySlots.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
