import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  isServerSupabaseConfigured: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  isServerSupabaseConfigured: mocks.isServerSupabaseConfigured,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  addressId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  deliverySlotId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  deliveryDate: "2026-11-15",
  idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  deliveryNotes: "Ring the bell",
};

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isServerSupabaseConfigured.mockReturnValue(true);
    mocks.rpc.mockResolvedValue({
      data: [{
        order_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        order_number: "DBY-20261115-00000001",
        total_paise: 35800,
        was_replayed: false,
      }],
      error: null,
    });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "authenticated-customer" } },
          error: null,
        }),
      },
      rpc: mocks.rpc,
    });
  });

  it("fails closed when Supabase is not configured or the customer is anonymous", async () => {
    mocks.isServerSupabaseConfigured.mockReturnValue(false);
    const unavailable = await POST(request(validBody));
    expect(unavailable.status).toBe(503);

    mocks.isServerSupabaseConfigured.mockReturnValue(true);
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      rpc: mocks.rpc,
    });
    const anonymous = await POST(request(validBody));
    expect(anonymous.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed checkout identifiers and delivery date", async () => {
    const response = await POST(request({ ...validBody, addressId: "not-a-uuid", deliveryDate: "2026-02-31" }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("sends only the approved checkout fields to the transactional COD RPC", async () => {
    const response = await POST(request({
      ...validBody,
      customerId: "spoofed-customer",
      totalPaise: 1,
      paymentMethod: "razorpay",
      paymentStatus: "captured",
      orderStatus: "delivered",
      stock: 999,
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("create_cod_order", {
      p_address_id: validBody.addressId,
      p_delivery_slot_id: validBody.deliverySlotId,
      p_delivery_date: validBody.deliveryDate,
      p_idempotency_key: validBody.idempotencyKey,
      p_delivery_notes: validBody.deliveryNotes,
    });
    expect(payload).toMatchObject({
      success: true,
      data: {
        orderId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        orderNumber: "DBY-20261115-00000001",
        totalPaise: 35800,
        paymentMethod: "cod",
        paymentStatus: "pending",
        status: "pending_confirmation",
        replayed: false,
      },
    });
    expect(JSON.stringify(payload)).not.toContain("razorpay");
  });

  it("returns the same idempotent order as HTTP 200 on a replay", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{
        order_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        order_number: "DBY-20261115-00000001",
        total_paise: 35800,
        was_replayed: true,
      }],
      error: null,
    });
    const response = await POST(request(validBody));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.replayed).toBe(true);
  });

  it("maps business-rule rejection to 422 and hides unexpected database errors", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "23514", message: "Insufficient stock" } });
    const rejected = await POST(request(validBody));
    expect(rejected.status).toBe(422);
    expect((await rejected.json()).error).toBe("Insufficient stock");

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "internal detail" } });
    const failed = await POST(request(validBody));
    expect(failed.status).toBe(503);
    expect((await failed.json()).error).not.toContain("internal detail");
  });
});
