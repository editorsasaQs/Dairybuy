import { describe, expect, it, vi } from "vitest";
import {
  areDatabaseIntegrationsHealthy,
  checkDatabaseIntegrations,
} from "./database-health";

function makeQuery(result: { count: number | null; error: unknown }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    then: (resolve: (value: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return query;
}

function makeClient(results: Array<{ count: number | null; error: unknown }>) {
  let index = 0;
  return {
    from: vi.fn(() => makeQuery(results[index++] ?? { count: 0, error: null })),
  } as never;
}

describe("database integration health probes", () => {
  it("checks all eight customer-facing database integration surfaces", async () => {
    const client = makeClient([
      { count: 4, error: null },
      { count: 22, error: null },
      { count: 6, error: null },
      { count: 11, error: null },
      { count: 14, error: null },
      { count: 22, error: null },
      { count: 1, error: null },
      { count: 2, error: null },
    ]);

    const result = await checkDatabaseIntegrations(client);

    expect(result).toEqual({
      database: { status: "ok", count: 4 },
      catalogue: { status: "ok", count: 22 },
      approvedVendors: { status: "ok", count: 6 },
      vendorProducts: { status: "ok", count: 11 },
      currentVendorPrices: { status: "ok", count: 14 },
      orderableVariants: { status: "ok", count: 22 },
      serviceAreas: { status: "ok", count: 1 },
      deliverySlots: { status: "ok", count: 2 },
    });
    expect(areDatabaseIntegrationsHealthy(result)).toBe(true);
  });

  it("reports degraded health when any integration query fails", async () => {
    const client = makeClient([
      { count: 4, error: null },
      { count: null, error: new Error("permission denied") },
      { count: 4, error: null },
      { count: 11, error: null },
      { count: 14, error: null },
      { count: 22, error: null },
      { count: 1, error: null },
      { count: 2, error: null },
    ]);

    const result = await checkDatabaseIntegrations(client);

    expect(result.catalogue.status).toBe("error");
    expect(result.catalogue.count).toBeNull();
    expect(areDatabaseIntegrationsHealthy(result)).toBe(false);
  });

  it("fails closed if the query throws", async () => {
    const client = {
      from: vi.fn(() => {
        throw new Error("network unavailable");
      }),
    } as never;

    const result = await checkDatabaseIntegrations(client);
    expect(areDatabaseIntegrationsHealthy(result)).toBe(false);
    expect(Object.values(result).every((check) => check.status === "error")).toBe(true);
  });
});
