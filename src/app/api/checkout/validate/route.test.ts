import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  isServerSupabaseConfigured: vi.fn(),
  validateCheckout: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  isServerSupabaseConfigured: mocks.isServerSupabaseConfigured,
}));

vi.mock("@/lib/services/checkout-validation-service", () => ({
  validateCheckout: mocks.validateCheckout,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/checkout/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/checkout/validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isServerSupabaseConfigured.mockReturnValue(true);
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "customer-1" } },
          error: null,
        }),
      },
    });
    mocks.validateCheckout.mockResolvedValue({
      valid: true,
      summary: {
        delivery: { date: "2026-11-14", timezone: "Asia/Kolkata" },
        cart: { subtotalPaise: 12500, deliveryFeePaise: 0, totalPaise: 12500 },
      },
    });
  });

  it("requires server Supabase configuration and authenticated customer", async () => {
    mocks.isServerSupabaseConfigured.mockReturnValue(false);
    const unavailable = await POST(request({
      addressId: "address-1",
      deliverySlotId: "slot-1",
      deliveryDate: "2026-11-14",
    }));
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get("cache-control")).toBe("no-store");

    mocks.isServerSupabaseConfigured.mockReturnValue(true);
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    });
    const anonymous = await POST(request({
      addressId: "address-1",
      deliverySlotId: "slot-1",
      deliveryDate: "2026-11-14",
    }));
    expect(anonymous.status).toBe(401);
    expect(mocks.validateCheckout).not.toHaveBeenCalled();
  });

  it("rejects incomplete checkout selections with field-level errors", async () => {
    const response = await POST(request({ addressId: "address-1" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.fieldErrors).toMatchObject({
      addressId: expect.any(String),
      deliverySlotId: expect.any(String),
      deliveryDate: expect.any(String),
    });
    expect(mocks.validateCheckout).not.toHaveBeenCalled();
  });

  it("returns a no-store server-calculated checkout preview", async () => {
    const response = await POST(request({
      addressId: "address-1",
      deliverySlotId: "slot-1",
      deliveryDate: "2026-11-14",
      customerId: "spoofed-customer",
      totalPaise: 1,
      slotLabel: "client-controlled",
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.validateCheckout).toHaveBeenCalledWith(
      expect.anything(),
      "customer-1",
      {
        addressId: "address-1",
        deliverySlotId: "slot-1",
        deliveryDate: "2026-11-14",
      },
    );
    expect(payload.data.cart.totalPaise).toBe(12500);
    expect(payload.data.delivery.timezone).toBe("Asia/Kolkata");
  });

  it("returns field-level failures without creating an order", async () => {
    mocks.validateCheckout.mockResolvedValue({
      valid: false,
      fieldErrors: { deliveryDate: "Cutoff has passed." },
    });

    const response = await POST(request({
      addressId: "address-1",
      deliverySlotId: "slot-1",
      deliveryDate: "2026-11-13",
    }));
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.fieldErrors.deliveryDate).toBe("Cutoff has passed.");
    expect(mocks.validateCheckout).toHaveBeenCalledOnce();
  });

  it("fails closed with 503 when validation encounters a database error", async () => {
    mocks.validateCheckout.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await POST(request({
      addressId: "address-1",
      deliverySlotId: "slot-1",
      deliveryDate: "2026-11-14",
    }));

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
