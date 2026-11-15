import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  isServerSupabaseConfigured: vi.fn(),
  getDatabaseServiceability: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  isServerSupabaseConfigured: mocks.isServerSupabaseConfigured,
}));

vi.mock("@/lib/services/service-area-db-service", () => ({
  getDatabaseServiceability: mocks.getDatabaseServiceability,
  findServiceArea: (areas: Array<{ isActive: boolean; pincodes: readonly string[] }>, pincode: string) =>
    areas.find((area) => area.isActive && area.pincodes.includes(pincode)) ?? null,
  isValidPincode: (value: string) => /^\d{6}$/.test(value.trim()),
}));

import { GET } from "./route";

const topsia = {
  id: "area-1",
  code: "topsia-kolkata",
  name: "Topsia, Kolkata",
  city: "Kolkata",
  state: "West Bengal",
  isActive: true,
  pincodes: ["700039", "700046", "700100", "700105"],
  description: "Topsia launch area",
};

function request(pincode?: string) {
  const url = new URL("http://localhost/api/service-areas/check");
  if (pincode !== undefined) url.searchParams.set("pincode", pincode);
  return new Request(url);
}

describe("GET /api/service-areas/check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isServerSupabaseConfigured.mockReturnValue(true);
    mocks.createSupabaseServerClient.mockResolvedValue({});
    mocks.getDatabaseServiceability.mockResolvedValue({
      areas: [topsia],
      serviceablePincodes: topsia.pincodes,
    });
  });

  it("returns serviceability based on the active database mapping", async () => {
    const response = await GET(request("700046"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.isServiceable).toBe(true);
    expect(payload.data.serviceArea.id).toBe("area-1");
    expect(mocks.getDatabaseServiceability).toHaveBeenCalledOnce();
  });

  it("returns not-serviceable for a valid pincode outside the active launch area", async () => {
    const response = await GET(request("700001"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.isServiceable).toBe(false);
    expect(payload.data.serviceArea).toBeNull();
  });

  it("rejects malformed pincode values before querying Supabase", async () => {
    const response = await GET(request("7000A6"));

    expect(response.status).toBe(400);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when the database lookup fails", async () => {
    mocks.getDatabaseServiceability.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await GET(request("700046"));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.success).toBe(false);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("fails closed with 503 when Supabase is not configured", async () => {
    mocks.isServerSupabaseConfigured.mockReturnValue(false);

    const response = await GET(request("700046"));

    expect(response.status).toBe(503);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("returns only the active serviceability catalogue when no pincode is supplied", async () => {
    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.launchArea.id).toBe("area-1");
    expect(payload.data.serviceablePincodes).toEqual(topsia.pincodes);
  });
});
