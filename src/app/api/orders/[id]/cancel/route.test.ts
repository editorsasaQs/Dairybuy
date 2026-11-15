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

const orderId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const context = { params: Promise.resolve({ id: orderId }) };

describe("POST /api/orders/[id]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isServerSupabaseConfigured.mockReturnValue(true);
    mocks.rpc.mockResolvedValue({
      data: [{ order_id: orderId, resulting_status: "cancelled", was_already_cancelled: false }],
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

  it("requires configuration and an authenticated customer", async () => {
    mocks.isServerSupabaseConfigured.mockReturnValue(false);
    expect((await POST(new Request("http://localhost"), context)).status).toBe(503);

    mocks.isServerSupabaseConfigured.mockReturnValue(true);
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      rpc: mocks.rpc,
    });
    expect((await POST(new Request("http://localhost"), context)).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed order IDs without calling the database", async () => {
    const response = await POST(new Request("http://localhost"), { params: Promise.resolve({ id: "bad-id" }) });
    expect(response.status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls only the authenticated cancellation RPC and returns its verified result", async () => {
    const response = await POST(new Request("http://localhost"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_customer_cod_order", { p_order_id: orderId });
    expect(await response.json()).toMatchObject({
      success: true,
      data: { orderId, status: "cancelled", alreadyCancelled: false },
    });
  });

  it("returns not-found for foreign or unknown orders", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "Order not found" } });
    const response = await POST(new Request("http://localhost"), context);
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Order not found.");
  });

  it("maps business-rule rejection to 422 and hides unexpected database details", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "23514", message: "Deadline passed" } });
    const rejected = await POST(new Request("http://localhost"), context);
    expect(rejected.status).toBe(422);
    expect((await rejected.json()).error).toBe("Deadline passed");

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "internal detail" } });
    const failed = await POST(new Request("http://localhost"), context);
    expect(failed.status).toBe(503);
    expect((await failed.json()).error).not.toContain("internal detail");
  });

  it("treats an already-cancelled order as an idempotent success", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ order_id: orderId, resulting_status: "cancelled", was_already_cancelled: true }],
      error: null,
    });
    const response = await POST(new Request("http://localhost"), context);
    expect(response.status).toBe(200);
    expect((await response.json()).data.alreadyCancelled).toBe(true);
  });
});
